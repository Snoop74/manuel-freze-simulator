// ── Parça masası (CP): ayrı sahnede inceleme, kumpas, yükseklik, delik/cep, kesit; ham parça ölçüsü (BN)
import { $, C, H, NX, NY, PD, PH, PW, S, TAU, app, clamp, log, mat, rapid, tool, warnOnce } from './00-temel.js';
import { initAudio, thud } from './01-ses.js';
import { M } from './02-sahne-tezgah.js';
import { FIXLIM } from './03-tabla-parca.js';
import { DIVZ } from './04-voksel.js';
import { FIX, buildStock, flushMesh, markStockReady, stockBase, syncFixtures, topGeo, topMat, walls } from './05-baglama.js';
import { CHIP_TXT } from './06-talas.js';
import { press, release } from './08-kesme.js';
import { TICK, droVals, fmt, resetPart, setAxis, setFeed, setRpm, spindle, wheelTicks } from './09-kumanda.js';
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
      if (o.steps) { const t = document.createElementNS(SVG, 'text'); t.textContent = o.labels[k]; t.setAttribute('x', Math.sin(a) * 58); t.setAttribute('y', -Math.cos(a) * 58 + 4); t.setAttribute('text-anchor', 'middle'); t.setAttribute('font-size', '11'); t.setAttribute('fill', '#cfd5d1'); t.setAttribute('font-family', 'Chakra Petch, sans-serif'); svg.append(t); }
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
  function render() {
    for (const ax of ['x', 'y', 'z']) document.querySelector(`.lcd-ax[data-ax="${ax}"]`).classList.toggle('sel', st.sel === ax);
    document.querySelectorAll('.key.ax').forEach(b => b.classList.toggle('on', b.dataset.k === st.sel));
    const tg = Object.keys(st.tgt).map(a => a.toUpperCase() + st.tgt[a]).join(' ');
    $('lcdSel').textContent = (tg ? 'GİT ' + tg + ' · ' : '') + (st.sel ? `${st.sel.toUpperCase()} =` : tg ? '' : 'EKSEN SEÇ');
    $('lcdBuf').textContent = st.sel ? (st.buf || '_') : '';
  }
  // ekran ve ışıklar (updateHud içinden ~15 Hz)
  function update(T) {
    const d = droVals();
    $('lcdX').textContent = fmt(d.x); $('lcdY').textContent = fmt(d.y); $('lcdZ').textContent = fmt(d.z);
    $('lcdS').textContent = `S ${Math.round(S.spindle ? S.rpmEff : 0)}${S.spindle && S.dir < 0 ? ' GERİ' : ''}`;
    $('lcdF').textContent = `F ${Math.round(S.curFeed && performance.now() - S.lastMove < 200 ? S.curFeed : S.feed)}`;
    $('lcdT').textContent = `${T.no} Ø${T.d}`;
    $('lcdState').textContent = S.alarm ? 'ALARM' : S.changing ? 'TAKIM DEĞ.' : S.tap ? 'KILAVUZ' : S.autoX ? 'OTO. İLERLEME' : S.spindle ? 'MİL DÖNÜYOR' : 'HAZIR';
    const cutting = performance.now() - S.lastCut < 400, ld = cutting ? S.lastStress : 0;
    const bar = (id, v) => { const e = $(id); e.style.width = clamp(v * 100, 0, 100) + '%'; e.className = v > 1 ? 'bad' : v > 0.8 ? 'hi' : ''; };
    bar('lcdLoad', ld / 1.5); $('lcdLoadV').textContent = cutting ? ld.toFixed(2) + '×' : '—';
    bar('lcdPow', S.power || 0); $('lcdPowV').textContent = S.power > 0.02 ? '%' + Math.round(S.power * 100) : '—';
    $('lcdMat').textContent = mat.short.toUpperCase(); $('lcdTemp').textContent = (20 + S.temp).toFixed(1) + ' °C';
    $('lcdWear').textContent = `VB ${S.wear[S.tool].toFixed(2)} mm`; $('lcdRa').textContent = S.lastRa === null ? '—' : S.lastRa.toFixed(2) + ' µm';
    $('lcdChip').textContent = S.chipForm && performance.now() - S.chipT < 800 ? CHIP_TXT[S.chipForm].toUpperCase() : '—';
    $('cpStart').classList.toggle('lit', S.spindle); $('cpCool').classList.toggle('lit', S.coolant);
    $('cpDir').classList.toggle('rev', S.dir < 0); $('cpDirL').textContent = S.dir < 0 ? 'GERİ' : 'İLERİ';
    $('lpSpin').classList.toggle('on', S.spindle); $('lpAlarm').classList.toggle('on', S.alarm);
    $('cpRapid').classList.toggle('on', S.rapidBtn);
    $('kRpmV').textContent = S.rpm; $('kFeedV').textContent = S.feed;
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
    sc = new THREE.Scene(); sc.background = new THREE.Color(0x1a1f22);
    if (THREE.RoomEnvironment) { const pm = new THREE.PMREMGenerator(r); sc.environment = pm.fromScene(new THREE.RoomEnvironment(), 0.04).texture; pm.dispose(); }
    sc.add(new THREE.HemisphereLight(0xe8eef5, 0x2a2622, 0.35));
    const l1 = new THREE.DirectionalLight(0xffffff, 0.8); l1.position.set(120, 260, 180); l1.castShadow = true; l1.shadow.mapSize.set(2048, 2048);
    Object.assign(l1.shadow.camera, { left:-200, right:200, top:200, bottom:-200, near:10, far:800 }); sc.add(l1);
    const l2 = new THREE.DirectionalLight(0x9fc4ff, 0.3); l2.position.set(-200, 80, -120); sc.add(l2);
    const plate = new THREE.Mesh(new THREE.BoxGeometry(520, 30, 380), new THREE.MeshStandardMaterial({ color:new THREE.Color(0x2c3235).convertSRGBToLinear(), roughness:0.85 }));
    plate.position.y = -15.2; plate.receiveShadow = true; plate.material.envMapIntensity = 0.25; sc.add(plate);
    cam = new THREE.PerspectiveCamera(38, 1, 2, 4000);
    ctl = new THREE.OrbitControls(cam, cv); ctl.enableDamping = true; ctl.maxPolarAngle = Math.PI * 0.49;
    grp = new THREE.Group(); sc.add(grp);
    // parçanın üst yüzeyi işleme izleriyle; kesit için malzemeler kopyalanır (ana görünüm kesilmesin)
    mats.top = topMat.clone(); mats.top.onBeforeCompile = topMat.onBeforeCompile; mats.top.customProgramCacheKey = () => 'benchTop';
    mats.raw = M.raw.clone();
    for (const m of [mats.top, mats.raw]) { m.clippingPlanes = [clipX, clipY]; m.side = THREE.DoubleSide; }
    cv.addEventListener('pointerdown', e => { if (e.button === 0) down = { x:e.clientX, y:e.clientY }; });
    cv.addEventListener('pointerup', e => { if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 5) pick(e); down = null; });
    new ResizeObserver(resize).observe(cv.parentElement);
  }
  let down = null;
  function build() {
    while (grp.children.length) grp.remove(grp.children[0]);
    mats.raw.color.copy(M.raw.color); mats.raw.metalness = M.raw.metalness; mats.raw.roughness = M.raw.roughness;
    mats.top.metalness = topMat.metalness; mats.top.roughness = topMat.roughness;
    const add = (g, m) => { const o = new THREE.Mesh(g, m); o.castShadow = o.receiveShadow = true; grp.add(o); return o; };
    flushMesh();
    add(topGeo, mats.top); for (const w of walls) add(w.w.g, mats.raw); add(stockBase.geometry, mats.raw);
    grp.position.set(-PW / 2, 0, PD / 2);
    $('bnSecX').max = PW; $('bnSecY').max = PD; $('bnSecX').value = PW; $('bnSecY').value = PD; section();
    clearMarks();
  }
  function resize() {
    if (!r) return;
    const el = $('bnC').parentElement, w = el.clientWidth, h = el.clientHeight;
    r.setSize(w, h, false); cam.aspect = w / Math.max(1, h); cam.updateProjectionMatrix();
  }
  function section() {
    const x = +$('bnSecX').value, y = +$('bnSecY').value;
    clipX.constant = x - PW / 2;                      // grp −PW/2 kaydırılmış: dünya x = parça x − PW/2
    clipY.constant = y - PD / 2;                      // dünya z = PD/2 − parça y; z ≥ PD/2 − y tarafı görünür
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
    ctl.update(); r.render(sc, cam);
    const rc = $('bnC').getBoundingClientRect();
    for (const l of labels) { _v.copy(l.at).project(cam); l.el.style.left = ((_v.x + 1) / 2 * rc.width) + 'px'; l.el.style.top = ((1 - _v.y) / 2 * rc.height) + 'px'; l.el.style.display = _v.z < 1 ? '' : 'none'; }
    raf = requestAnimationFrame(loop);
  }
  function show() {
    if (!r) init();
    open = true; $('bench').hidden = false; build(); resize();
    cam.position.set(PW * 0.6, Math.max(PW, PD) * 0.9 + PH, PD * 1.4 + 60); ctl.target.set(0, PH * 0.4, 0); ctl.update();
    $('bnInfo').textContent = `${mat.short} · ${PW}×${PD}×${PH} mm · kaldırılan talaş ${(S.removed / 1000).toFixed(1)} cm³`;
    setTool(tool); cancelAnimationFrame(raf); loop();
  }
  function hide() { open = false; $('bench').hidden = true; cancelAnimationFrame(raf); }
  $('benchOpen').addEventListener('click', () => { initAudio(); if (FIX === 'div') { log('Divizör parçası parça masasında henüz incelenemiyor.', 'warn'); return; } if (S.spindle) { log('Parçayı masaya almak için önce mili durdurun.', 'warn'); return; } show(); });
  $('bnClose').addEventListener('click', hide);
  document.querySelectorAll('[data-bt]').forEach(b => b.addEventListener('click', () => setTool(b.dataset.bt)));
  $('bnClear').addEventListener('click', () => { clearMarks(); $('bnList').innerHTML = ''; hint('Ölçümler temizlendi.'); });
  $('bnSecX').addEventListener('input', section); $('bnSecY').addEventListener('input', section);
  window.addEventListener('keydown', e => { if (open && e.code === 'Escape') { e.stopImmediatePropagation(); hide(); } }, true);
  return { show, hide };
})();

/* ---------------- Takım editörü: kendi takımını tasarla ----------------
   Tip, çap, ağız sayısı, boylar, helis, köşe radyüsü, uç açısı, malzeme ve kaplama seçilir; takım T13'ten itibaren dolaba eklenir.
   Parametreler fiziğe bağlıdır (toolMods): önerilen hız ve ilerleme, aşınma, kırılma direnci, tırlama, yüzey, talaş sıkışması. */
Object.assign(app, { CP, setStock });   // önceki modüllerin geç başvuruları

export { setStock };
