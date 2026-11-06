// ── Parça masası (CP): ayrı sahnede inceleme, kumpas, yükseklik, delik/cep, kesit; ham parça ölçüsü (BN)
import { $, C, H, INSP, NX, NY, PD, PH, PW, S, TAU, TEST, app, clamp, log, mat, rapid, tool, warnOnce } from './00-temel.js';
import { t } from './00-dil.js';
import { initAudio, thud } from './01-ses.js';
import { M, MX, bakeRest } from './02-sahne-tezgah.js';
import { FIXLIM } from './03-tabla-parca.js';
import { DIVZ } from './04-voksel.js';
import { FIX, buildStock, flushMesh, markDirty, markStockReady, stockBase, syncFixtures, topGeo, topMat, walls } from './05-baglama.js';
import { CHIP_TXT } from './06-talas.js';
import { press, release } from './08-kesme.js';
import { TICK, droVals, fmt, resetPart, setAuto, setAutoY, setAxis, setFeed, setRpm, spindle, wheelTicks } from './09-kumanda.js';
import { JOBS, allowedAt, inspect, localTop, selJob } from './10-is-emri-muayene.js';
import { estop } from './12-dongu-ust-cubuk.js';

const CP = (() => {
  const st = { sel:null, buf:'', tgt:{}, page:1, axis:'x', mpgAcc:0, mpgAng:0, mpgLast:null };
  const SVG = 'http://www.w3.org/2000/svg';
  // Topuz: −135°…+135° arası döner; sürükle (yukarı/aşağı ya da döndür) ya da tekerlek. steps verilirse kademeli
  function knob(el, o) {
    const svg = document.createElementNS(SVG, 'svg'); svg.setAttribute('viewBox', '-60 -60 120 120'); el.append(svg);
    const n = o.steps ? o.steps.length : 11;
    for (let k = 0; k < n; k++) {
      const a = (-135 + 270 * k / (n - 1)) * Math.PI / 180, r0 = 43, r1 = o.steps ? 49 : (k % 5 === 0 ? 50 : 47);
      const l = document.createElementNS(SVG, 'line');
      l.setAttribute('x1', Math.sin(a) * r0); l.setAttribute('y1', -Math.cos(a) * r0); l.setAttribute('x2', Math.sin(a) * r1); l.setAttribute('y2', -Math.cos(a) * r1);
      l.setAttribute('stroke', '#cfd5d1'); l.setAttribute('stroke-width', o.steps || k % 5 === 0 ? 2.4 : 1.4); svg.append(l);
      if (o.steps) { const t = document.createElementNS(SVG, 'text'); t.textContent = o.labels[k]; t.setAttribute('x', Math.sin(a) * 58); t.setAttribute('y', -Math.cos(a) * 58 + 4); t.setAttribute('text-anchor', 'middle'); t.setAttribute('font-size', '15'); t.setAttribute('font-weight', '700'); t.setAttribute('fill', '#e3e6e2'); t.setAttribute('font-family', 'Chakra Petch, sans-serif'); svg.append(t); }
    }
    svg.insertAdjacentHTML('beforeend', `<defs><radialGradient id="kg${el.id}" cx="40%" cy="35%"><stop offset="0" stop-color="#5e666a"/><stop offset=".7" stop-color="#1c1f21"/></radialGradient></defs>
      <circle r="38" fill="#0f1112"/><g class="kr"><circle r="34" fill="url(#kg${el.id})" stroke="#0a0b0c" stroke-width="2"/>
      ${Array.from({ length:24 }, (_, k) => { const a = k / 24 * Math.PI * 2; return `<line x1="${Math.sin(a) * 30}" y1="${-Math.cos(a) * 30}" x2="${Math.sin(a) * 34}" y2="${-Math.cos(a) * 34}" stroke="#3a4044" stroke-width="2"/>`; }).join('')}
      <circle r="22" fill="#2a2e31"/><line x1="0" y1="-8" x2="0" y2="-31" stroke="#f2f2ec" stroke-width="4" stroke-linecap="round"/></g>`);
    const g = svg.querySelector('.kr');
    const toU = () => o.steps ? o.steps.indexOf(o.get()) / (n - 1) : (o.get() - o.min) / (o.max - o.min);
    const draw = () => g.setAttribute('transform', `rotate(${-135 + 270 * clamp(toU(), 0, 1)})`);
    const setU = u => {
      u = clamp(u, 0, 1);
      if (o.steps) o.set(o.steps[Math.round(u * (n - 1))]);
      else o.set(Math.round((o.min + u * (o.max - o.min)) / o.step) * o.step);
      draw();
    };
    let drag = null;
    el.addEventListener('pointerdown', e => { e.preventDefault(); initAudio(); el.setPointerCapture(e.pointerId); drag = { y:e.clientY, u:toU() }; el.style.cursor = 'grabbing'; });
    el.addEventListener('pointermove', e => { if (!drag) return; const u = drag.u + (drag.y - e.clientY) / 180; if (o.steps) { const k = Math.round(clamp(u, 0, 1) * (n - 1)); if (k !== o.steps.indexOf(o.get())) { setU(k / (n - 1)); thud(260, 0.05, 0.03); } } else setU(u); });
    const up = () => { drag = null; el.style.cursor = ''; };
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
    el.addEventListener('wheel', e => { e.preventDefault(); initAudio(); const d = e.deltaY < 0 ? 1 : -1; setU(toU() + d / (o.steps ? n - 1 : 40)); if (o.steps) thud(260, 0.05, 0.03); }, { passive:false });
    el.addEventListener('keydown', e => { if (e.key === 'ArrowUp' || e.key === 'ArrowRight') { setU(toU() + 1 / (o.steps ? n - 1 : 40)); e.preventDefault(); } if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') { setU(toU() - 1 / (o.steps ? n - 1 : 40)); e.preventDefault(); } });
    draw(); return { draw };
  }
  const kRpm = knob($('kRpm'), { min:100, max:4200, step:10, get:() => S.rpm, set:v => setRpm(v) });
  const kFeed = knob($('kFeed'), { min:10, max:1600, step:5, get:() => S.feed, set:v => setFeed(v) });
  const kAxis = knob($('kAxis'), { steps:['x', 'y', 'z'], labels:['X', 'Y', 'Z'], get:() => st.axis, set:v => { st.axis = v; } });
  const kMul = knob($('kMul'), { steps:[0.01, 0.1, 1], labels:['×1', '×10', '×100'], get:() => S.wheelMul, set:v => { S.wheelMul = v; [...$('muls').children].forEach(b => b.classList.toggle('on', +b.dataset.mul === v)); } });
  // El çarkı (MPG): sürükleyerek döndür ya da tekerlek; her çentik seçili eksende bir adım
  const mpg = $('cpMpg');
  const mpgAng = e => { const r = mpg.getBoundingClientRect(); return Math.atan2(e.clientY - r.top - r.height / 2, e.clientX - r.left - r.width / 2); };
  mpg.addEventListener('pointerdown', e => { e.preventDefault(); initAudio(); mpg.setPointerCapture(e.pointerId); st.mpgLast = mpgAng(e); st.mpgAcc = 0; mpg.style.cursor = 'grabbing'; });
  mpg.addEventListener('pointermove', e => {
    if (st.mpgLast === null) return;
    const a = mpgAng(e); let d = a - st.mpgLast; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU;
    st.mpgLast = a; st.mpgAcc += d; st.mpgAng += d;
    const t = Math.trunc(st.mpgAcc / TICK); if (t) { st.mpgAcc -= t * TICK; wheelTicks(st.axis, t); }
    mpg.firstElementChild.style.transform = `rotate(${st.mpgAng}rad)`;
  });
  const mup = () => { st.mpgLast = null; mpg.style.cursor = ''; };
  mpg.addEventListener('pointerup', mup); mpg.addEventListener('pointercancel', mup);
  mpg.addEventListener('wheel', e => { e.preventDefault(); initAudio(); const t = e.deltaY < 0 ? 1 : -1; wheelTicks(st.axis, t); st.mpgAng += t * TICK * 3; mpg.firstElementChild.style.transform = `rotate(${st.mpgAng}rad)`; }, { passive:false });
  // tuş takımı: eksen seç, değer yaz, ENT ile ata; CLR siler
  // eksen değiştirirken yazılmış değer GİT hedefi olarak saklanır: X 20 → Y 30 → GİT
  function keep() { if (st.sel && st.buf && isFinite(parseFloat(st.buf))) st.tgt[st.sel] = parseFloat(st.buf); }
  function selAxis(ax) { keep(); st.sel = st.sel === ax && !st.buf ? null : ax; st.buf = ''; }
  function goTo() {
    keep();
    const axes = Object.keys(st.tgt);
    if (!axes.length) { log('GİT için eksen seçip hedef değeri yazın: örn. X 20, Y 30, GİT.', 'warn'); return; }
    if (S.alarm || S.changing) return;
    const d = droVals();
    for (const ax of axes) S.pend[ax] = st.tgt[ax] - d[ax];
    if ('z' in st.tgt && st.tgt.z < d.z) warnOnce('goZ', 'Dikkat: Z aşağı iniyor; takım yoluna parça ya da mengene girmesin.', 'warn');
    log(`${axes.map(a => a.toUpperCase() + fmt(st.tgt[a])).join(' ')} konumuna ${rapid() ? 'hızlı' : S.feed + ' mm/dk ilerlemeyle'} gidiliyor.`);
    st.tgt = {}; st.sel = null; st.buf = '';
  }
  $('cpKeys').addEventListener('click', e => {
    const b = e.target.closest('[data-k]'); if (!b) return;
    initAudio(); thud(320, 0.04, 0.025);
    const k = b.dataset.k;
    if (k === 'x' || k === 'y' || k === 'z') selAxis(k);
    else if (k === 'clr') { if (st.buf) st.buf = ''; else if (st.sel) st.sel = null; else st.tgt = {}; }
    else if (k === 'git') goTo();
    else if (k === 'ent') {
      if (!st.sel) { log('Önce X, Y ya da Z eksen tuşuna basın.', 'warn'); return; }
      const v = parseFloat(st.buf || '0');
      if (isFinite(v)) setAxis(st.sel, v);
      st.buf = ''; st.sel = null; st.tgt = {};
    } else if (k === '±') st.buf = st.buf.startsWith('-') ? st.buf.slice(1) : '-' + st.buf;
    else if (st.buf.length < 9 && !(k === '.' && st.buf.includes('.'))) { if (!st.sel) { log('Önce X, Y ya da Z eksen tuşuna basın.', 'warn'); return; } st.buf += k; }
    render();
  });
  // yazılım tuşları: X0, Y0, Z0, 1/2 (seçili ekseni ortala), sayfa
  $('cpSoft').addEventListener('click', e => {
    const b = e.target.closest('[data-sk]'); if (!b) return;
    initAudio(); thud(320, 0.04, 0.025);
    const k = +b.dataset.sk, d = droVals();
    if (k < 3) setAxis('xyz'[k], 0);
    else if (k === 3) { if (!st.sel) { log('1/2 için önce eksen seçin (X, Y ya da Z).', 'warn'); return; } setAxis(st.sel, d[st.sel] / 2); log(`Orta bulma: ${st.sel.toUpperCase()} değeri yarıya bölündü; ${st.sel.toUpperCase()}=0'a giderseniz iki kenarın ortasındasınız.`, 'ok'); st.sel = null; }
    else { st.page = st.page === 1 ? 2 : 1; $('lcdP1').hidden = st.page !== 1; $('lcdP2').hidden = st.page !== 2; $('lcdPgK').textContent = st.page === 1 ? 'DURUM' : 'DRO'; $('lcdMode').textContent = st.page === 1 ? 'DRO · MUTLAK' : 'DURUM'; }
    render();
  });
  // mil, yön, soğutma, acil stop: mevcut düğmeleri çağırır
  $('cpStart').addEventListener('click', () => $('spStart').click());
  $('cpStop').addEventListener('click', () => $('spStop').click());
  $('cpDir').addEventListener('click', () => $('spDir').click());
  $('cpCool').addEventListener('click', () => $('coolant').click());
  $('cpEstop').addEventListener('click', () => { $('cpEstop').classList.add('down'); setTimeout(() => $('cpEstop').classList.remove('down'), 300); estop(); });
  // hareket tuşları: tıkla bir adım, basılı tut sürekli; HIZLI basılıyken hızlı hareket
  $('cpJog').querySelectorAll('[data-j]').forEach(b => {
    const ax = b.dataset.j[0], dir = +b.dataset.j.slice(1), id = 'cp-' + b.dataset.j;
    b.addEventListener('pointerdown', e => { e.preventDefault(); b.setPointerCapture(e.pointerId); b.classList.add('hold'); press(id, ax, dir); });
    const up = () => { b.classList.remove('hold'); release(id); };
    b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('lostpointercapture', up);
  });
  $('cpRapid').addEventListener('click', () => $('rapidBtn').click());
  $('cpAuto').addEventListener('click', e => { const b = e.target.closest('[data-af]'); if (b) { initAudio(); thud(320, 0.04, 0.025); setAuto(+b.dataset.af); return; } const y = e.target.closest('[data-afy]'); if (y) { thud(320, 0.04, 0.025); setAutoY(+y.dataset.afy); } });
  function render() {
    for (const ax of ['x', 'y', 'z']) document.querySelector(`.lcd-ax[data-ax="${ax}"]`).classList.toggle('sel', st.sel === ax);
    document.querySelectorAll('.key.ax').forEach(b => b.classList.toggle('on', b.dataset.k === st.sel));
    const tg = Object.keys(st.tgt).map(a => a.toUpperCase() + st.tgt[a]).join(' ');
    $('lcdSel').textContent = (tg ? t('k.git') + ' ' + tg + ' · ' : '') + (st.sel ? `${st.sel.toUpperCase()} =` : tg ? '' : t('k.eksen_sec'));
    $('lcdBuf').textContent = st.sel ? (st.buf || '_') : '';
  }
  // ekran ve ışıklar (updateHud içinden ~15 Hz)
  function update(T) {
    const d = droVals();
    $('lcdX').textContent = fmt(d.x); $('lcdY').textContent = fmt(d.y); $('lcdZ').textContent = fmt(d.z);
    $('lcdS').textContent = `S ${Math.round(S.spindle ? S.rpmEff : 0)}${S.spindle && S.dir < 0 ? ' ' + t('k.geri') : ''}`;
    $('lcdF').textContent = `F ${Math.round(S.curFeed && performance.now() - S.lastMove < 200 ? S.curFeed : S.feed)}`;
    $('lcdT').textContent = `${T.no} Ø${T.d}`;
    $('lcdState').textContent = t(S.alarm ? 'k.alarm' : S.changing ? 'k.takim_deg' : S.tap ? 'k.kilavuz' : S.autoX || S.autoY ? 'k.oto' : S.spindle ? 'k.mil_donuyor' : 'k.hazir');
    const cutting = performance.now() - S.lastCut < 400, ld = cutting ? S.lastStress : 0;
    const bar = (id, v) => { const e = $(id); e.style.width = clamp(v * 100, 0, 100) + '%'; e.className = v > 1 ? 'bad' : v > 0.8 ? 'hi' : ''; };
    bar('lcdLoad', ld / 1.5); $('lcdLoadV').textContent = cutting ? ld.toFixed(2) + '×' : '—';
    bar('lcdPow', S.power || 0); $('lcdPowV').textContent = S.power > 0.02 ? '%' + Math.round(S.power * 100) : '—';
    $('lcdMat').textContent = mat.short.toUpperCase(); $('lcdTemp').textContent = (20 + S.temp).toFixed(1) + ' °C';
    $('lcdWear').textContent = `VB ${S.wear[S.tool].toFixed(2)} mm`; $('lcdRa').textContent = S.lastRa === null ? '—' : S.lastRa.toFixed(2) + ' µm';
    $('lcdChip').textContent = S.chipForm && performance.now() - S.chipT < 800 ? CHIP_TXT[S.chipForm].toUpperCase() : '—';
    $('cpStart').classList.toggle('lit', S.spindle); $('cpCool').classList.toggle('lit', S.coolant);
    $('cpDir').classList.toggle('rev', S.dir < 0); $('cpDirL').textContent = t(S.dir < 0 ? 'k.geri' : 'k.ileri');
    $('lpSpin').classList.toggle('on', S.spindle); $('lpAlarm').classList.toggle('on', S.alarm);
    $('cpRapid').classList.toggle('on', S.rapidBtn);
    $('cpAuto').querySelectorAll('[data-af]').forEach(b => { const f = +b.dataset.af; b.classList.toggle('on', f ? Math.sign(S.autoX) === f : !S.autoX); });
    $('cpAutoY').hidden = !app.CR.yukVar('yIlerleme');
    $('cpAutoY').querySelectorAll('[data-afy]').forEach(b => { const f = +b.dataset.afy; b.classList.toggle('on', f ? Math.sign(S.autoY) === f : !S.autoY); });
    $('kRpmV').textContent = S.rpm; $('kFeedV').textContent = S.feed;
    $('kAxisV').textContent = st.axis.toUpperCase(); $('kMulV').textContent = '×' + Math.round(S.wheelMul * 100);   // topuz değeri adın altında, okunur boyda
    $('cpMpgL').textContent = `${st.axis.toUpperCase()} ×${Math.round(S.wheelMul * 100)}`;
    kRpm.draw(); kFeed.draw(); kMul.draw();
  }
  render();
  return { update };
})();

markStockReady(); syncFixtures();
/* ---------------- Ham parça ölçüsü ---------------- */
function setStock(w, d, h, quiet) {
  const L = FIXLIM[FIX];
  w = clamp(Math.round(w * 2) / 2, ...L.x); d = clamp(Math.round(d * 2) / 2, ...L.y); h = clamp(Math.round(h * 2) / 2, ...L.z);
  if (FIX === 'div') h = DIVZ + d / 2;                             // divizör: X boy, Y çap; Z0 çubuğun üstü
  if (S.spindle) spindle(false);
  buildStock(w, d, h);
  resetPart(S.mat);
  S.zn = PH + tool().len; S.nose = Math.max(S.nose, PH + 20 + tool().len);
  $('stW').value = w; $('stD').value = d; $('stH').value = h;
  $('brandMat').textContent = $('tbMat').textContent = `${mat.short} · ${w}×${d}×${h}`;
  if (!quiet) log(`Yeni ham parça: ${w} × ${d} × ${h} mm. Sıfır noktası sol-ön-üst köşede; Z0 yeni üst yüzeyde.`, 'ok');
}
$('stApply').addEventListener('click', () => app.CR.on ? log('Kariyerde ham parça ölçüsünü sipariş belirler.', 'warn') : setStock(+$('stW').value, +$('stD').value, +$('stH').value));

/* ---------------- Parça masası: incele, ölç, kesit al ----------------
   Parça ayrı bir sahnede granit pleyt üstünde durur; aynı geometri paylaşılır, kesilen her şey burada da görünür.
   Ölçüm: kumpas (iki nokta arası), yükseklik ölçer (tabandan yükseklik, üstten derinlik), delik/cep (taban alanından eşdeğer çap). */
const BN = (() => {
  let r = null, sc, cam, ctl, grp, raf = 0, tool = 'cal', pts = [], marks = [], open = false;
  const clipX = new THREE.Plane(new THREE.Vector3(-1, 0, 0), 1e4), clipY = new THREE.Plane(new THREE.Vector3(0, 0, 1), 1e4);
  const mats = {};
  function init() {
    const cv = $('bnC');
    r = new THREE.WebGLRenderer({ canvas:cv, antialias:true });
    r.setPixelRatio(Math.min(2, window.devicePixelRatio || 1)); r.outputEncoding = THREE.sRGBEncoding;
    r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 0.9; r.localClippingEnabled = true; r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    sc = new THREE.Scene(); sc.background = new THREE.Color(0x221f1c); sc.fog = new THREE.Fog(0x221f1c, 2600, 5200);
    if (THREE.RoomEnvironment) { const pm = new THREE.PMREMGenerator(r); sc.environment = pm.fromScene(new THREE.RoomEnvironment(), 0.04).texture; pm.dispose(); }
    sc.add(new THREE.HemisphereLight(0xe8eef5, 0x2a2622, 0.35));
    const l1 = new THREE.DirectionalLight(0xfff1dc, 0.85); l1.position.set(140, 320, 200); l1.castShadow = true; l1.shadow.mapSize.set(2048, 2048);
    l1.shadow.bias = -0.0006; l1.shadow.normalBias = 0.6;           // çift yüzlü parça malzemesinde gölge sivilcesi (yan yüzlerde dikey çizgiler) olmasın
    Object.assign(l1.shadow.camera, { left:-220, right:220, top:220, bottom:-220, near:10, far:900 }); sc.add(l1);
    const l2 = new THREE.DirectionalLight(0x9fc4ff, 0.25); l2.position.set(-200, 80, -120); sc.add(l2);
    ortam();
    cam = new THREE.PerspectiveCamera(38, 1, 2, 4000);
    ctl = new THREE.OrbitControls(cam, cv); ctl.enableDamping = true; ctl.maxPolarAngle = Math.PI * 0.49;
    grp = new THREE.Group(); sc.add(grp);
    // parçanın üst yüzeyi işleme izleriyle; kesit için malzemeler kopyalanır (ana görünüm kesilmesin)
    mats.top = topMat.clone(); mats.top.onBeforeCompile = topMat.onBeforeCompile; mats.top.customProgramCacheKey = () => 'benchTop';
    mats.raw = M.raw.clone();
    for (const m of [mats.top, mats.raw]) { m.clippingPlanes = [clipX, clipY]; m.side = THREE.DoubleSide; m.shadowSide = THREE.BackSide; }
    mats.sapma = new THREE.MeshStandardMaterial({ vertexColors:true, roughness:0.6, metalness:0.05, clippingPlanes:[clipX, clipY], side:THREE.DoubleSide, shadowSide:THREE.BackSide });
    cv.addEventListener('pointerdown', e => { if (e.button === 0) down = { x:e.clientX, y:e.clientY }; });
    cv.addEventListener('pointerup', e => { if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 5) pick(e); down = null; });
    new ResizeObserver(resize).observe(cv.parentElement);
  }
  let down = null;
  // ortam: atölyenin köşesinde ölçüm masası: granit pleyt, masa gövdesi, atölye duvarı ve zemini (aynı malzemeler)
  function ortam() {
    const tex = (w, h, ciz) => { const c = document.createElement('canvas'); c.width = w; c.height = h; ciz(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.anisotropy = 4; return t; };
    const std = (hex, r, m, o) => new THREE.MeshStandardMaterial(Object.assign({ color:new THREE.Color(hex).convertSRGBToLinear(), roughness:r, metalness:m }, o || {}));
    const kut = (w, h, d, mat, x, y, z, par = sc) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); o.position.set(x, y, z); o.castShadow = o.receiveShadow = true; par.add(o); return o; };
    const A = { krom:std(0xd9dde0, 0.15, 1) };
    // granit pleyt
    const granit = tex(512, 512, (x, w, h) => {
      x.fillStyle = '#1b1c1e'; x.fillRect(0, 0, w, h);
      for (let k = 0; k < 14000; k++) { const v = Math.random(); x.fillStyle = v < 0.6 ? `rgba(0,0,0,${0.25 + Math.random() * 0.35})` : v < 0.97 ? `rgba(95,96,100,${0.12 + Math.random() * 0.22})` : `rgba(170,166,158,${0.12 + Math.random() * 0.2})`; const s = 0.5 + Math.random() * 1.4; x.fillRect(Math.random() * w, Math.random() * h, s, s); }
    });
    granit.wrapS = granit.wrapT = THREE.RepeatWrapping; granit.repeat.set(5, 3.4);
    const sh = new THREE.Shape(), a = 450, b = 300, rc = 14;
    sh.moveTo(-a + rc, -b); sh.lineTo(a - rc, -b); sh.quadraticCurveTo(a, -b, a, -b + rc); sh.lineTo(a, b - rc); sh.quadraticCurveTo(a, b, a - rc, b);
    sh.lineTo(-a + rc, b); sh.quadraticCurveTo(-a, b, -a, b - rc); sh.lineTo(-a, -b + rc); sh.quadraticCurveTo(-a, -b, -a + rc, -b);
    const pg = new THREE.ExtrudeGeometry(sh, { depth:70, bevelEnabled:true, bevelThickness:4, bevelSize:4, bevelSegments:2 });
    pg.rotateX(-Math.PI / 2); pg.translate(0, -78.2, 0);
    const uv = pg.attributes.uv; for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) / 900, uv.getY(k) / 600);
    const plate = new THREE.Mesh(pg, new THREE.MeshStandardMaterial({ map:granit, roughness:0.32, metalness:0.05, envMapIntensity:0.45 }));
    plate.receiveShadow = true; sc.add(plate);
    // masa: koyu yeşil çelik gövde, çekmeceler, ayaklar
    const govdeM = std(0x2f3a36, 0.65, 0.25);
    kut(880, 40, 580, govdeM, 0, -102, 0);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) kut(50, 680, 50, govdeM, sx * 400, -122 - 340, sz * 250);
    kut(360, 300, 540, govdeM, 230, -272, 0);
    for (let k = 0; k < 3; k++) { kut(340, 86, 6, std(0x3a4843, 0.6, 0.25), 230, -160 - k * 96, 272); kut(90, 12, 10, A.krom, 230, -150 - k * 96, 277); }
    // zemin ve duvarlar: atölyeyle aynı malzemeler (boyalı beton, sarı şerit)
    const Y0 = -802;
    const zemin = new THREE.Mesh(new THREE.PlaneGeometry(5000, 5000), M.floor); zemin.rotation.x = -Math.PI / 2; zemin.position.y = Y0; zemin.receiveShadow = true; sc.add(zemin);
    const duvar = (w, x, z, ry) => {
      const g = new THREE.Group(); g.position.set(x, Y0, z); g.rotation.y = ry; sc.add(g);
      const p1 = new THREE.Mesh(new THREE.PlaneGeometry(w, 1300), MX.wallLow); p1.position.y = 650; p1.receiveShadow = true; g.add(p1);
      const p2 = new THREE.Mesh(new THREE.PlaneGeometry(w, 1700), MX.wallHigh); p2.position.y = 1300 + 850; p2.receiveShadow = true; g.add(p2);
      const st = new THREE.Mesh(new THREE.PlaneGeometry(w, 30), MX.stripe); st.position.set(0, 1305, 1); g.add(st);
      return g;
    };
    const arka = duvar(3200, 0, -620, 0); duvar(2400, -1150, 300, Math.PI / 2);
    // panoda tabela
    const pano = tex(1024, 400, (x, w, h) => {
      x.fillStyle = '#e8e3d4'; x.fillRect(0, 0, w, h); x.strokeStyle = '#1f2624'; x.lineWidth = 10; x.strokeRect(5, 5, w - 10, h - 10);
      x.fillStyle = '#1f2624'; x.font = 'bold 92px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('KALİTE KONTROL', w / 2, h * 0.36);
      x.font = '38px monospace'; x.fillText('ÖLÇMEDEN TESLİM YOK', w / 2, h * 0.72);
    });
    const tab = new THREE.Mesh(new THREE.PlaneGeometry(520, 203), new THREE.MeshStandardMaterial({ map:pano, roughness:0.8 })); tab.position.set(-120, 1720, 2); arka.add(tab);
    // Masa üstü aletler ve raftaki kutular kodla çizilmişti, atölyenin hazır modelleri yanında oyuncak gibi duruyordu (Onat, 2026-11-06): kaldırıldı.
    // Yerlerine onaylı hazır modeller geldi (aşağıda koy).
    const isik = new THREE.PointLight(0xffd9a0, 0.7, 1600, 1.4); isik.position.set(-120, 420, -60); sc.add(isik);
    // hazır modeller (Poly Haven CC0, assets/LISANS.md): masa lambası, rapor panosu, şerit metre; granitin kenarlarında (parça ortada)
    const gl = THREE.GLTFLoader && !TEST ? new THREE.GLTFLoader() : null;
    const koy = (id, x, z, ry, f, k = 1) => gl && gl.load(`assets/model/${id}/${id}.gltf`, g => {
      const o = g.scene; o.scale.setScalar(1000 * k); o.rotation.y = ry;
      o.traverse(c => { if (c.isMesh) { c.castShadow = c.receiveShadow = true; if (c.material) c.material.envMapIntensity = 0.6; } });
      o.updateMatrixWorld(true); const bb = new THREE.Box3().setFromObject(o);
      o.position.set(x - (bb.min.x + bb.max.x) / 2, -bb.min.y, z - (bb.min.z + bb.max.z) / 2); sc.add(o);
      if (f) { o.updateMatrixWorld(true); f(o, new THREE.Box3().setFromObject(o)); }
    }, undefined, () => {});
    // kol lambası (iskeletsiz: hep gergin duruşta): masanın sol kenarına tutturulmuş, başı parçaya bakar; ışık ampulde
    koy('desk_lamp_arm_01', -300, -60, 0.7, o => { const b = o.getObjectByName('Box001_1'); if (b) { const bb = new THREE.Box3().setFromObject(b); bb.getCenter(isik.position); isik.position.y -= 30; } }, 0.8);
    koy('clipboard', 250, -190, -0.25);
    koy('measuring_tape_01', 330, 170, 0.6);
    // atölye malzemeleri (üç düzlemli doku) köşe noktalarının duruş konumunu ister; yoksa yüzey siyah çizilir
    sc.updateMatrixWorld(true);
    sc.traverse(o => { if (o.isMesh && o.material && o.material.userData && o.material.userData.restSurface) bakeRest(o, o.geometry); });
  }
  // kamera parçayı çerçeveler (eskiden parça burnun dibinde açılıyordu)
  function cerceve() {
    const R = Math.max(110, Math.hypot(PW, PD, PH) / 2), d = R / Math.sin(cam.fov / 2 * Math.PI / 180) * 2.3;   // aletler ve köşe de görünsün
    const dir = new THREE.Vector3(0.36, 0.42, 1).normalize();
    ctl.target.set(0, PH * 0.4, 0); cam.position.copy(ctl.target).addScaledVector(dir, d); ctl.minDistance = 40; ctl.maxDistance = d * 3; ctl.update();
  }

  /* -- Kontrol listesi: teknik resmin ölçüleri, teslim muayenesiyle aynı hesap (inspect) -- */
  let kon = null, sapmaAcik = false, sapmaMesh = null, odak = null;
  const aktifIs = () => S.job && !S.job.done ? S.job.J : app.CR.on ? (app.CR.sel && app.CR.sel.kabul ? app.CR.sel.J : null) : selJob >= 0 ? JOBS[selJob] : null;
  function olcumler(J) {                                           // muayene parçanın üstüne iz bırakmasın (INSP)
    const yedek = INSP.slice(); const it = inspect(J); INSP.set(yedek); markDirty(0, NX - 1, 0, NY - 1); return it;
  }
  function yer(J, g) {                                             // ölçünün parçadaki yeri: kamera oraya döner
    let m;
    if ((m = /^D(\d+)/.exec(g)) && J.holes[m[1] - 1]) { const h = J.holes[m[1] - 1]; return { x:h.x, y:h.y }; }
    if ((m = /^C(\d+)/.exec(g)) && J.pockets[m[1] - 1]) { const p = J.pockets[m[1] - 1]; return { x:(p.x0 + p.x1) / 2, y:(p.y0 + p.y1) / 2 }; }
    const q = (J.pads || []).find((q, i) => g === (q.ad || 'Ayak ' + (i + 1))); if (q) return { x:(q.x0 + q.x1) / 2, y:(q.y0 + q.y1) / 2 };
    if (g === 'Çukurlar' && J.cukur) return J.cukur.pts[0];
    return { x:PW / 2, y:PD / 2 };
  }
  function kontrol() {
    const L = $('bnKontrol'); L.innerHTML = ''; const J = aktifIs();
    $('bnJob').textContent = J ? '· ' + J.title : '';
    if (!J) { kon = null; L.innerHTML = '<li class="bos">Aktif iş yok: serbest ölçüm yapabilirsiniz. Bir iş seçince resmin ölçüleri burada listelenir.</li>'; $('bnHepsi').disabled = true; return; }
    $('bnHepsi').disabled = false;
    kon = { J, it:olcumler(J), olc:new Set() };
    kon.it.forEach((q, k) => {
      const li = document.createElement('li'); li.dataset.k = k;
      li.innerHTML = `<b>${q.grp}</b><span>${q.label}</span><i>—</i><small>istenen ${q.nom || '—'}</small>`;
      li.addEventListener('click', () => olc(k, true)); L.append(li);
    });
  }
  function olc(k, git) {
    if (!kon) return; const q = kon.it[k], li = $('bnKontrol').children[k]; if (!q || !li) return;
    kon.olc.add(k); li.className = q.ok ? 'ok' : 'bad';
    li.querySelector('i').textContent = `${q.meas} ${q.ok ? '✓' : '✗'}`;
    if (git) {
      const p = yer(kon.J, q.grp), z = Math.max(0, localTop(kon.J, p.x, p.y));
      odak = { t:0, t0:ctl.target.clone(), t1:new THREE.Vector3(p.x - PW / 2, z, PD / 2 - p.y), p0:cam.position.clone() };
      thud(900, 0.03, 0.03);
      const bad = kon.it.filter((_, i) => kon.olc.has(i) && !kon.it[i].ok).length;
      hint(`${q.grp} · ${q.label}: ${q.meas} (istenen ${q.nom}) ${q.ok ? '✓ tolerans içi' : '✗ TOLERANS DIŞI'} · ölçülen ${kon.olc.size}/${kon.it.length}${bad ? `, ${bad} dışarıda` : ''}`);
    }
  }
  function hepsi() {
    if (!kon) return; kon.it.forEach((_, k) => olc(k, false));
    const bad = kon.it.filter(q => !q.ok).length;
    hint(bad ? `${kon.it.length} ölçüden ${bad} tanesi tolerans dışı: kırmızı satırlara bakın.` : `${kon.it.length} ölçünün hepsi tolerans içinde: teslime hazır.`);
    if (!sapmaAcik) sapma(true);
  }

  /* -- Sapma haritası (CMM renkleri): her hücre resimdeki hedefe göre boyanır -- */
  const _c = new THREE.Color();
  function sapmaRenk() {
    const J = aktifIs(), n = NX * NY, col = new Float32Array(n * 3);
    for (let k = 0; k < n; k++) {
      const i = k % NX, j = (k - i) / NX, x = i * C, y = j * C, h = H[k];
      let c = [0.54, 0.56, 0.57];                                  // işlenmeyecek / iş yok
      if (J) {
        const e = allowedAt(J, x, y), t = localTop(J, x, y), o = J._P ? J._P.H(x, y) : J.h;
        if (e < 0) c = h < 0.3 ? [0.18, 0.72, 0.38] : [0.16, 0.48, 0.9];                       // delik: delinmiş mi
        else if (h < e - 0.05) c = [0.9, 0.18, 0.2];                                             // fazla kesilmiş
        else if (t < o - 0.01) c = h > t + 0.05 ? [0.16, 0.48, 0.9] : [0.18, 0.72, 0.38];      // işlenecek yer: kaldı mı, tamam mı
      }
      _c.setRGB(c[0], c[1], c[2]).convertSRGBToLinear(); col[k * 3] = _c.r; col[k * 3 + 1] = _c.g; col[k * 3 + 2] = _c.b;   // renkler doğrusal uzayda: soluk görünmesin
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', topGeo.attributes.position); g.setAttribute('normal', topGeo.attributes.normal); if (topGeo.index) g.setIndex(topGeo.index);
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return g;
  }
  function sapma(on) {
    sapmaAcik = on; $('bnSapma').classList.toggle('on', on); $('bnLejant').hidden = !on;
    if (sapmaMesh) { grp.remove(sapmaMesh); sapmaMesh.geometry.dispose(); sapmaMesh = null; }
    const top = grp.children.find(o => o.geometry === topGeo); if (top) top.visible = !on;
    if (on) { sapmaMesh = new THREE.Mesh(sapmaRenk(), mats.sapma); sapmaMesh.castShadow = sapmaMesh.receiveShadow = true; grp.add(sapmaMesh); }
  }

  function build() {
    while (grp.children.length) grp.remove(grp.children[0]);
    mats.raw.color.copy(M.raw.color); mats.raw.metalness = M.raw.metalness; mats.raw.roughness = M.raw.roughness;
    mats.top.metalness = topMat.metalness; mats.top.roughness = topMat.roughness;
    const add = (g, m) => { const o = new THREE.Mesh(g, m); o.castShadow = o.receiveShadow = true; grp.add(o); return o; };
    flushMesh();
    add(topGeo, mats.top); for (const w of walls) add(w.w.g, mats.raw).castShadow = false; add(stockBase.geometry, mats.raw).castShadow = false;   // yan duvar tek katlı: gölge düşürürse kendi üstünde çizgi yapar; parçanın gölgesini üst yüzey verir
    grp.position.set(-PW / 2, 0, PD / 2);
    $('bnSecX').max = PW; $('bnSecY').max = PD; $('bnSecX').value = PW; $('bnSecY').value = PD; section();
    clearMarks(); sapmaMesh = null; sapma(sapmaAcik); kontrol();
  }
  function resize() {
    if (!r) return;
    const el = $('bnC').parentElement, w = el.clientWidth, h = el.clientHeight;
    r.setSize(w, h, false); cam.aspect = w / Math.max(1, h); cam.updateProjectionMatrix();
  }
  function section() {
    const x = +$('bnSecX').value, y = +$('bnSecY').value;
    // kapalıyken düzlem parçadan uzakta: tam kenarda durursa kenar yüzü düzlemle çakışır, her karede rastgele kesilip çizgi çizgi titrer (Onat'ın gördüğü)
    clipX.constant = x >= PW ? 1e4 : x - PW / 2;                      // grp −PW/2 kaydırılmış: dünya x = parça x − PW/2
    clipY.constant = y >= PD ? 1e4 : y - PD / 2;                      // dünya z = PD/2 − parça y; z ≥ PD/2 − y tarafı görünür
    $('bnSecXv').textContent = x >= PW ? 'kapalı' : 'X ' + x.toFixed(1);
    $('bnSecYv').textContent = y >= PD ? 'kapalı' : 'Y ' + y.toFixed(1);
  }
  // tıklanan noktayı parça koordinatına çevir (x, y, z = yükseklik)
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  function pick(e) {
    const rc = $('bnC').getBoundingClientRect();
    ndc.set((e.clientX - rc.left) / rc.width * 2 - 1, -(e.clientY - rc.top) / rc.height * 2 + 1);
    ray.setFromCamera(ndc, cam);
    const hits = ray.intersectObjects(grp.children, false).filter(h => clipX.distanceToPoint(h.point) >= -0.01 && clipY.distanceToPoint(h.point) >= -0.01);
    if (!hits.length) return;
    const w = hits[0].point, p = { x:w.x + PW / 2, y:PD / 2 - w.z, z:w.y, w:w.clone() };
    thud(900, 0.03, 0.03);
    if (tool === 'h') { marker(p); line(p.w, new THREE.Vector3(p.w.x, 0, p.w.z), 0xffd36a); result(`Yükseklik: <b>${p.z.toFixed(2)}</b> mm tabandan · üstten derinlik <b>${(PH - p.z).toFixed(2)}</b> mm · konum X${p.x.toFixed(1)} Y${p.y.toFixed(1)}`, p.w); return; }
    if (tool === 'hole') { holeAt(p); return; }
    pts.push(p); marker(p);
    if (pts.length === 2) {
      const [a, b] = pts, dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
      line(a.w, b.w, 0x7dffb2);
      result(`Mesafe: <b>${Math.hypot(dx, dy, dz).toFixed(2)}</b> mm · ΔX ${Math.abs(dx).toFixed(2)} · ΔY ${Math.abs(dy).toFixed(2)} · ΔZ ${Math.abs(dz).toFixed(2)}`, a.w.clone().lerp(b.w, 0.5));
      pts = [];
    } else hint('İkinci noktayı tıklayın.');
  }
  // delik ya da cep: tıklanan hücrenin yüksekliğindeki bağlı taban alanı → eşdeğer çap, merkez, derinlik
  function holeAt(p) {
    const i0 = clamp(Math.round(p.x / C), 0, NX - 1), j0 = clamp(Math.round(p.y / C), 0, NY - 1), h0 = H[j0 * NX + i0];
    if (h0 > PH - 0.05) { hint('Üst yüzeye tıkladınız; delik ya da cebin tabanına tıklayın.'); return; }
    const seen = new Uint8Array(NX * NY), st = [j0 * NX + i0]; seen[st[0]] = 1;
    let n = 0, sx = 0, sy = 0, mnx = 1e9, mxx = -1e9, mny = 1e9, mxy = -1e9;
    while (st.length && n < 200000) {
      const k = st.pop(), i = k % NX, j = (k - i) / NX; n++; sx += i; sy += j;
      mnx = Math.min(mnx, i); mxx = Math.max(mxx, i); mny = Math.min(mny, j); mxy = Math.max(mxy, j);
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const a = i + di, b = j + dj; if (a < 0 || b < 0 || a >= NX || b >= NY) continue;
        const kk = b * NX + a; if (!seen[kk] && H[kk] < PH - 0.05 && Math.abs(H[kk] - h0) < 0.35) { seen[kk] = 1; st.push(kk); }
      }
    }
    const area = n * C * C, dEq = 2 * Math.sqrt(area / Math.PI), dExt = ((mxx - mnx) + (mxy - mny)) / 2 * C + C, cx = sx / n * C, cy = sy / n * C, wx = (mxx - mnx) * C, wy = (mxy - mny) * C;
    const round = Math.abs(wx - wy) < Math.max(1, 0.12 * Math.max(wx, wy)) && Math.abs(dEq - (wx + wy) / 2) < Math.max(1, 0.1 * dEq);
    const c = new THREE.Vector3(cx - PW / 2, h0 + 0.3, PD / 2 - cy);
    const ring = new THREE.Mesh(new THREE.RingGeometry(Math.max(0.5, (round ? dEq : Math.max(wx, wy)) / 2 - 0.4), (round ? dEq : Math.max(wx, wy)) / 2 + 0.4, 48), new THREE.MeshBasicMaterial({ color:0x7dffb2, side:THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2; ring.position.copy(c); sc.add(ring); marks.push(ring);
    result(round ? `Delik: <b>Ø${dExt.toFixed(2)}</b> mm · merkez X${cx.toFixed(2)} Y${cy.toFixed(2)} · derinlik ${(PH - h0).toFixed(2)} mm`
      : `Cep: <b>${(wx + C).toFixed(1)} × ${(wy + C).toFixed(1)}</b> mm · taban alanı ${area.toFixed(0)} mm² · derinlik ${(PH - h0).toFixed(2)} mm`, c);
  }
  function marker(p) { const m = new THREE.Mesh(new THREE.SphereGeometry(0.9, 12, 8), new THREE.MeshBasicMaterial({ color:0xff5a4a })); m.position.copy(p.w); sc.add(m); marks.push(m); }
  function line(a, b, color) { const g = new THREE.BufferGeometry().setFromPoints([a, b]); const l = new THREE.Line(g, new THREE.LineBasicMaterial({ color, depthTest:false })); l.renderOrder = 5; sc.add(l); marks.push(l); }
  const labels = [];
  function result(html, at) {
    const li = document.createElement('li'); li.innerHTML = html; $('bnList').prepend(li);
    while ($('bnList').children.length > 8) $('bnList').lastChild.remove();
    const lb = document.createElement('div'); lb.className = 'bn-label'; lb.innerHTML = html.replace(/ · .*/, ''); $('bnView').append(lb); labels.push({ el:lb, at:at.clone() });
    hint('Ölçüm eklendi.');
  }
  function hint(t) { $('bnHint').textContent = t; }
  function clearMarks() {
    for (const m of marks) { sc.remove(m); if (m.geometry) m.geometry.dispose(); }
    marks = []; pts = []; labels.forEach(l => l.el.remove()); labels.length = 0;
  }
  function setTool(t) {
    tool = t; pts = [];
    document.querySelectorAll('[data-bt]').forEach(b => b.classList.toggle('on', b.dataset.bt === t));
    hint({ cal:'Kumpas: iki noktaya tıklayın (köşe, kenar, cep tabanı…).', h:'Yükseklik ölçer: bir noktaya tıklayın.', hole:'Delik/cep: tabanına tıklayın; çap ya da ölçüler hesaplanır.' }[t]);
  }
  const _v = new THREE.Vector3();
  function loop() {
    if (!open) return;
    if (odak) {                                                    // kontrol satırı: kamera ölçünün yerine süzülür
      odak.t = Math.min(1, odak.t + 0.04); const e = 1 - (1 - odak.t) ** 3;
      const tt = odak.t0.clone().lerp(odak.t1, e), off = odak.p0.clone().sub(odak.t0), L = off.length(), hedefL = clamp(Math.hypot(PW, PD) * 1.25, 120, L);
      off.setLength(L + (hedefL - L) * e); ctl.target.copy(tt); cam.position.copy(tt).add(off);
      if (odak.t >= 1) odak = null;
    }
    ctl.update(); r.render(sc, cam);
    const rc = $('bnC').getBoundingClientRect();
    for (const l of labels) { _v.copy(l.at).project(cam); l.el.style.left = ((_v.x + 1) / 2 * rc.width) + 'px'; l.el.style.top = ((1 - _v.y) / 2 * rc.height) + 'px'; l.el.style.display = _v.z < 1 ? '' : 'none'; }
    raf = requestAnimationFrame(loop);
  }
  function show() {
    if (!r) init();
    open = true; $('bench').hidden = false; build(); resize();
    cerceve();
    $('bnInfo').textContent = `${mat.short} · ${PW}×${PD}×${PH} mm · kaldırılan talaş ${(S.removed / 1000).toFixed(1)} cm³`;
    setTool(tool); cancelAnimationFrame(raf); loop();
  }
  function hide() { open = false; $('bench').hidden = true; cancelAnimationFrame(raf); }
  $('benchOpen').addEventListener('click', () => { initAudio(); if (FIX === 'div') { log('Divizör parçası parça masasında henüz incelenemiyor.', 'warn'); return; } if (S.spindle) { log('Parçayı masaya almak için önce mili durdurun.', 'warn'); return; } show(); });
  $('bnClose').addEventListener('click', hide);
  $('bnHepsi').addEventListener('click', () => { initAudio(); hepsi(); });
  $('bnSapma').addEventListener('click', () => sapma(!sapmaAcik));
  document.querySelectorAll('[data-bt]').forEach(b => b.addEventListener('click', () => setTool(b.dataset.bt)));
  $('bnClear').addEventListener('click', () => { clearMarks(); $('bnList').innerHTML = ''; hint('Ölçümler temizlendi.'); });
  $('bnSecX').addEventListener('input', section); $('bnSecY').addEventListener('input', section);
  window.addEventListener('keydown', e => { if (open && e.code === 'Escape') { e.stopImmediatePropagation(); hide(); } }, true);
  return { show, hide, get kon() { return kon; }, hepsi, sapma, get sc() { return sc; }, get cam() { return cam; }, get ctl() { return ctl; } };   // kon, hepsi, sapma: duman testi; sc, cam, ctl: geliştirici incelemesi
})();

/* ---------------- Takım editörü: kendi takımını tasarla ----------------
   Tip, çap, ağız sayısı, boylar, helis, köşe radyüsü, uç açısı, malzeme ve kaplama seçilir; takım T13'ten itibaren dolaba eklenir.
   Parametreler fiziğe bağlıdır (toolMods): önerilen hız ve ilerleme, aşınma, kırılma direnci, tırlama, yüzey, talaş sıkışması. */
Object.assign(app, { BN, CP, setStock });   // önceki modüllerin geç başvuruları

export { setStock };
