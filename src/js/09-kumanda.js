// ── Kumanda: DRO, devir/ilerleme, takım dolabı, takım değişimi, mil, jog, el çarkları, malzeme ve parça sıfırlama
const fmt = v => (v < -0.0005 ? '−' : '+') + Math.abs(v).toFixed(3);
const droVals = () => ({ x: S.px - S.zx, y: S.py - S.zy, z: S.nose - S.zn });

function updateSpindleUI() {
  $('spinState').textContent = S.spindle ? `DÖNÜYOR · ${S.rpm}` : 'DURUYOR';
  $('spinState').style.color = S.spindle ? 'var(--ok)' : 'var(--muted)';
}
function updateToolUI() {
  const T = tool();
  $('ctNo').textContent = T.no;
  $('ctName').textContent = `${T.name} Ø${T.d}${S.broken ? ' · KIRIK' : ''}`;
  $('ctMeta').textContent = `${T.mat} · ağız boyu ${T.flute} mm · takım boyu ${T.len} mm`;
  const hk = holderOf(T), H0 = hk && HOLDERS[hk];
  $('holderRow').classList.toggle('off', !hk);
  [...$('holderSeg').children].forEach(b => b.classList.toggle('on', b.dataset.h === hk));
  $('holderNote').textContent = H0 ? `${H0.n}: salgı ${Math.round(H0.ro * 1000)} µm · ${H0.t}${T.slipped ? ` · TAKIM ${T.slipped} mm KAYDI: düğmeye basıp yeniden bağlayın` : ''}`
    : T.type === 'face' ? 'Kabuk freze malafası' : isDrill(T) || T.type === 'tap' ? 'Matkap aynası' : 'Sabit tutucu';
  $('curTool').classList.toggle('broken', S.broken);
  $('probeBox').hidden = !isProbe(T); $('dialBox').hidden = T.type !== 'dial';
  if (T.type === 'dial') spinAng = 0;              // kadran operatöre dönük
  [...$('rack').children].forEach(b => b.classList.toggle('active', b.dataset.i !== undefined && +b.dataset.i === S.tool));
}
function updateRec() {
  const T = tool();
  $('recTxt').textContent = T.type === 'dial' ? 'mil DURUR · el çarkıyla yaklaş, ibreyi 0\'a getir' : isProbe(T) ? 'mil DURUR · ≤ 400 mm/dk yaklaşma, döngüleri kullanın' : T.type === 'edge' ? '1000 dev/dk, yavaş yaklaşma' : T.type === 'tap' ? `${T.rpm} dev/dk · kovan kendini çeker (adım ${T.p}), delik Ø${T.drill}` : `${recRpm(T)} dev/dk · ${recFeed(T)} mm/dk`;
}
function setRpm(v) { S.rpm = v; $('rpm').value = v; $('rpmOut').textContent = v + ' dev/dk'; updateSpindleUI(); }
function setFeed(v) { S.feed = v; $('feed').value = v; $('feedOut').textContent = v + ' mm/dk'; }

// Takım dolabı
let rackTag = null;                        // kariyer: (i) => { own, price }
function renderRack() {
  const rk = $('rack'); rk.innerHTML = '';
  TOOLS.forEach((T, i) => {
    if (T.gone) return;
    const b = document.createElement('button'); b.dataset.i = i;
    if (T.custom) { b.classList.add('custom'); b.title = 'Sağ tık: editörde aç'; b.addEventListener('contextmenu', e => { e.preventDefault(); TE.show(i); }); }
    const tg = rackTag && rackTag(i);
    if (tg && !tg.own) b.classList.add('locked');
    b.innerHTML = `<span class="ico">${toolIcon(T)}</span><span class="nm"><b>${T.no}</b>${T.name}</span><span class="d">Ø${T.d} · ${tg && !tg.own ? 'satın al ' + tg.price : T.mat.split(',')[0]}</span>`;
    b.addEventListener('click', () => requestToolChange(i));
    rk.append(b);
  });
  const nb = document.createElement('button'); nb.className = 'add';
  nb.innerHTML = '<span class="ico">+</span><span class="nm"><b>Yeni</b>Takım tasarla</span><span class="d">editör</span>';
  nb.addEventListener('click', () => TE.show(null)); rk.append(nb);
}
// tutucu değişimi: takılı takım yeni tutucuya bağlanır (mil durmalı); kayan takım da böylece yeniden bağlanır
$('holderSeg').addEventListener('click', e => {
  const b = e.target.closest('[data-h]'); if (!b) return;
  initAudio();
  const T = tool(), k = b.dataset.h;
  if (!holds(T)) return;
  if (S.spindle || S.changing) { log('Tutucu değiştirmek için önce mili durdurun.', 'warn'); return; }
  if (!CR.hasEq('h_' + k) && k !== 'er') { log(`${HOLDERS[k].n} tutucu atölyede yok: dükkândan alabilirsiniz.`, 'warn'); CR.openShop(); return; }
  if (holderOf(T) === k && !T.slipped) return;
  const was = T.slipped;
  unslip(T); HSEL[T.no] = k;
  try { localStorage.setItem(HKEY, JSON.stringify(HSEL)); } catch (_) {}
  buildToolVisual(); updateToolUI(); thud(200, 0.12, 0.1);
  log(was ? `${T.no} ${HOLDERS[k].n} tutucuya yeniden bağlandı; takım boyu düzeldi. Z'yi kontrol edin.` : `${T.no} artık ${HOLDERS[k].n} tutucuda: salgı ${Math.round(HOLDERS[k].ro * 1000)} µm.`, 'ok');
});
function requestToolChange(i) {
  initAudio();
  if (S.alarm) { log('Önce alarmı sıfırlayın.', 'warn'); return; }
  if (S.spindle) { log('Takım değiştirmek için önce mili durdurun.', 'warn'); return; }
  if (S.changing) return;
  if (!CR.allowTool(i)) return;
  if (i === S.tool && !S.broken) { log(`${TOOLS[i].no} zaten takılı.`); return; }
  stopMotion();
  S.changing = { to:i, t:0 };
  log(`Takım değişimi: mil yukarı çekiliyor, ${TOOLS[i].no} takılacak…`);
}

$('spStart').addEventListener('click', () => spindle(true));
$('spStop').addEventListener('click', () => spindle(false));
function spindle(on) {
  initAudio();
  if (on && S.alarm) { log('Alarm aktifken mil çalıştırılamaz.', 'warn'); return; }
  if (on && S.changing) return;
  if (on && S.broken) { log('Takım kırık. Mili çalıştırmadan önce takımı değiştirin.', 'warn'); return; }
  if (on && isTaster(tool())) { log('3B taster takılıyken mil çalıştırılmaz: taster dönerken kırılır.', 'warn'); return; }
  if (S.spindle === on) return;
  S.spindle = on; updateSpindleUI(); thud(on ? 120 : 85, 0.16, 0.16);   // kavrama / fren
  log(on ? `Mil çalıştı: ${S.rpm} dev/dk.` : 'Mil durdu.');
}
$('rpm').addEventListener('input', e => setRpm(+e.target.value));
$('feed').addEventListener('input', e => setFeed(+e.target.value));
$('matSel').addEventListener('change', e => {
  if (S.job && !S.job.done) { e.target.value = S.mat; log('İş sürerken malzeme değiştirilemez; iş emri malzemeyi belirler.', 'warn'); return; }
  if (CR.on) { e.target.value = S.mat; log('Kariyerde ham parça siparişle gelir; malzemeyi sipariş belirler.', 'warn'); return; }
  resetPart(e.target.value);
  log(`Malzeme: ${mat.name}. Yeni ham parça bağlandı; önerilen hız ve ilerleme buna göre değişti.`, 'ok');
});
$('renewTool').addEventListener('click', () => {
  if (S.spindle) { log('Takımı yenilemek için önce mili durdurun.', 'warn'); return; }
  if (!S.wear[S.tool]) { log(`${tool().no} zaten keskin.`); return; }
  if (!CR.charge(Math.round(CR.priceOf(tool()) * 0.3 / 10) * 10, `${tool().no} bileme`)) return;
  S.wear[S.tool] = 0; log(`${tool().no} yenilendi: keskin takım takıldı.`, 'ok');
});
function updateAutoUI() {
  $('autoState').textContent = S.autoX ? (S.autoX > 0 ? 'SAĞA →' : '← SOLA') + ` · ${S.feed} mm/dk` : 'kapalı';
  $('autoState').style.color = S.autoX ? 'var(--warn)' : '';
  [...$('autoBtns').children].forEach(b => b.classList.toggle('on', +b.dataset.af === S.autoX));
}
function setAuto(v) {
  initAudio();
  if (v && (S.alarm || S.changing || S.tap)) return;
  if (v) S.lastAuto = v;
  if (S.autoX !== v) thud(170, 0.12, 0.08);
  S.autoX = v; updateAutoUI();
  if (v) log(`Otomatik tabla ilerlemesi: ${v > 0 ? 'sağa' : 'sola'}, ${S.feed} mm/dk. Durmak için kolu ortalayın ya da Dur'a basın.`);
}
$('autoBtns').addEventListener('click', e => { const b = e.target.closest('button'); if (b) setAuto(+b.dataset.af); });
$('spDir').addEventListener('click', () => {
  initAudio();
  if (S.tap && S.spindle) thud(140, 0.14, 0.1);
  S.dir = -S.dir;
  $('spDir').textContent = 'Mil yönü: ' + (S.dir > 0 ? 'İLERİ ⟳' : 'GERİ ⟲'); $('spDir').classList.toggle('on', S.dir < 0);
  log(S.dir > 0 ? 'Mil yönü İLERİ.' : 'Mil yönü GERİ: frezeler bu yönde kesmez; kılavuzu çıkarmak içindir.');
});
$('applyRec').addEventListener('click', () => { const T = tool(); setRpm(recRpm(T)); setFeed(recFeed(T)); log(`Önerilen kesme değerleri uygulandı: ${recRpm(T)} dev/dk, ${recFeed(T)} mm/dk.`); });
$('coolant').addEventListener('click', toggleCoolant);
function toggleCoolant() { S.coolant = !S.coolant; $('coolant').textContent = 'Soğutma sıvısı: ' + (S.coolant ? 'AÇIK' : 'KAPALI'); $('coolant').classList.toggle('on', S.coolant); }
$('mute').addEventListener('click', () => { S.muted = !S.muted; $('mute').textContent = 'Ses: ' + (S.muted ? 'KAPALI' : 'AÇIK'); if (master) master.gain.value = S.muted ? 0 : 0.9; });

function setStep(v) { S.step = v; [...$('steps').children].forEach(b => b.classList.toggle('on', +b.dataset.step === v)); }
$('steps').addEventListener('click', e => { const b = e.target.closest('button'); if (b) setStep(+b.dataset.step); });
$('sims').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; S.sim = +b.dataset.sim; [...$('sims').children].forEach(x => x.classList.toggle('on', x === b)); });

// Jog düğmeleri (basılı tutma destekli)
$('jog').querySelectorAll('button[data-ax]').forEach(b => {
  const id = 'btn-' + b.dataset.ax + b.dataset.dir;
  b.addEventListener('pointerdown', e => { e.preventDefault(); b.setPointerCapture(e.pointerId); b.classList.add('hold'); press(id, b.dataset.ax, +b.dataset.dir); });
  const up = () => { b.classList.remove('hold'); release(id); };
  b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('lostpointercapture', up);
});
$('feedHold').addEventListener('click', () => { stopMotion(); log('Hareket durduruldu.'); });
$('rapidBtn').addEventListener('click', () => {
  S.rapidBtn = !S.rapidBtn;
  $('rapidBtn').style.background = S.rapidBtn ? 'var(--safety)' : 'var(--panel-2)';
  $('rapidBtn').style.color = S.rapidBtn ? '#1a1405' : 'var(--fg)';
});
$('goBtn').addEventListener('click', () => {
  initAudio();
  const gx = parseFloat($('gx').value.replace(',', '.')), gy = parseFloat($('gy').value.replace(',', '.'));
  if (!isFinite(gx) || !isFinite(gy)) { log('Hedef X ve Y için sayı girin.', 'warn'); return; }
  if (S.alarm || S.changing) return;
  const d = droVals();
  S.pend.x = gx - d.x; S.pend.y = gy - d.y;
  log(`X${fmt(gx)} Y${fmt(gy)} konumuna ${rapid() ? 'hızlı' : S.feed + ' mm/dk ilerlemeyle'} gidiliyor.`);
});

// DRO
document.querySelectorAll('[data-zero]').forEach(b => b.addEventListener('click', () => setAxis(b.dataset.zero, 0)));
document.querySelectorAll('[data-set]').forEach(b => b.addEventListener('click', () => {
  const ax = b.dataset.set, inp = $('set' + ax.toUpperCase());
  const v = parseFloat(inp.value.replace(',', '.'));
  if (!isFinite(v)) { log(`${ax.toUpperCase()} için bir sayı girin.`, 'warn'); return; }
  setAxis(ax, v); inp.value = '';
}));
['X','Y','Z'].forEach(a => $('set' + a).addEventListener('keydown', e => { if (e.key === 'Enter') document.querySelector(`[data-set="${a.toLowerCase()}"]`).click(); }));
function setAxis(ax, v) {
  if (ax === 'x') S.zx = S.px - v;
  if (ax === 'y') S.zy = S.py - v;
  if (ax === 'z') S.zn = S.nose - v;
  log(`${ax.toUpperCase()} ekseni ${fmt(v)} olarak ayarlandı.`, 'ok');
}

/* ---- El çarkları ---- */
const rootCss = getComputedStyle(document.documentElement);
const tok = n => rootCss.getPropertyValue(n).trim();
const COL = { panel2:tok('--panel-2'), line:tok('--line'), fg:tok('--fg'), muted:tok('--muted'), steel:tok('--steel'), safety:tok('--safety'), knob:tok('--bg') };
const TICK = Math.PI * 2 / 100;
const HW = ['x', 'y', 'z'].map(ax => ({ ax, cv:$('hw' + ax), out:$('hw' + ax + 'v'), acc:0, last:null }));
let lastClick = 0;
function wheelClick() {
  if (!ac || S.muted) return;
  const t = ac.currentTime;
  if (t - lastClick < 0.03) return;
  lastClick = t;
  noiseHit(t, 'bandpass', 3200 + Math.random() * 400, 3, 0.05, 0.012);   // çark çentiği
}
function wheelTicks(ax, t) {
  if (!t) return;
  initAudio();
  if (S.alarm || S.changing) return;
  S.wheel[ax] += t * S.wheelMul;
  wheelClick();
}
HW.forEach(w => {
  const ang = e => { const r = w.cv.getBoundingClientRect(); return Math.atan2(e.clientY - r.top - r.height / 2, e.clientX - r.left - r.width / 2); };
  w.cv.addEventListener('pointerdown', e => { e.preventDefault(); w.cv.setPointerCapture(e.pointerId); w.last = ang(e); w.acc = 0; });
  w.cv.addEventListener('pointermove', e => {
    if (w.last === null) return;
    const a = ang(e);
    let d = a - w.last;
    if (d > Math.PI) d -= Math.PI * 2;
    if (d < -Math.PI) d += Math.PI * 2;
    w.last = a; w.acc += d;
    const t = Math.trunc(w.acc / TICK);
    if (t) { w.acc -= t * TICK; wheelTicks(w.ax, t); }
  });
  const end = () => { w.last = null; };
  w.cv.addEventListener('pointerup', end);
  w.cv.addEventListener('pointercancel', end);
  w.cv.addEventListener('wheel', e => { e.preventDefault(); wheelTicks(w.ax, e.deltaY < 0 ? 1 : -1); }, { passive:false });
});
$('muls').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  S.wheelMul = +b.dataset.mul;
  [...$('muls').children].forEach(x => x.classList.toggle('on', x === b));
});
function drawWheels() {
  const pos = { x:S.px, y:S.py, z:S.nose };
  for (const w of HW) {
    const c = w.cv, s = c.clientWidth;
    if (!s) continue;
    const dpr = Math.min(2, window.devicePixelRatio || 1), px = Math.round(s * dpr);
    if (c.width !== px) { c.width = px; c.height = px; }
    const g = c.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, s, s);
    const cx = s / 2, R = s / 2 - 2;
    // Kadran bileziği tezgâh konumuyla döner: bir tur = 100 çentik
    const rot = pos[w.ax] / (100 * S.wheelMul) * Math.PI * 2;
    g.fillStyle = COL.panel2; g.beginPath(); g.arc(cx, cx, R, 0, Math.PI * 2); g.fill();
    g.strokeStyle = COL.line; g.lineWidth = 1; g.stroke();
    g.save(); g.translate(cx, cx); g.rotate(rot);
    for (let i = 0; i < 100; i++) {
      const a = i * TICK, major = i % 10 === 0, L = major ? 8 : i % 5 === 0 ? 5.5 : 3;
      g.strokeStyle = major ? COL.fg : COL.muted; g.lineWidth = major ? 1.4 : 0.8;
      g.beginPath(); g.moveTo(Math.sin(a) * (R - 2), -Math.cos(a) * (R - 2)); g.lineTo(Math.sin(a) * (R - 2 - L), -Math.cos(a) * (R - 2 - L)); g.stroke();
    }
    g.fillStyle = COL.muted; g.font = `${Math.max(8, s * 0.075)}px "Share Tech Mono", monospace`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    for (let i = 0; i < 100; i += 10) { const a = i * TICK, rr = R - 15 - s * 0.03; g.fillText(String(i), Math.sin(a) * rr, -Math.cos(a) * rr); }
    const rIn = R * 0.52;
    g.strokeStyle = COL.steel; g.lineCap = 'round'; g.lineWidth = Math.max(3, s * 0.045);
    for (let k = 0; k < 3; k++) { const a = k * Math.PI * 2 / 3; g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.sin(a) * rIn, -Math.cos(a) * rIn); g.stroke(); }
    g.lineWidth = Math.max(2, s * 0.03); g.beginPath(); g.arc(0, 0, rIn, 0, Math.PI * 2); g.stroke();
    g.fillStyle = COL.steel; g.beginPath(); g.arc(0, 0, s * 0.08, 0, Math.PI * 2); g.fill();
    g.fillStyle = COL.knob; g.strokeStyle = COL.safety; g.lineWidth = 2;
    g.beginPath(); g.arc(0, -rIn, s * 0.075, 0, Math.PI * 2); g.fill(); g.stroke();
    g.restore();
    g.fillStyle = COL.safety;
    g.beginPath(); g.moveTo(cx - 5, 0); g.lineTo(cx + 5, 0); g.lineTo(cx, 8); g.closePath(); g.fill();
  }
}

$('alarmReset').addEventListener('click',() => { S.alarm = false; $('alarm').hidden = true; log('Alarm sıfırlandı. Takımı değiştirin.'); });
$('clearChips').addEventListener('click', () => { clearChips(); log('Talaşlar süpürüldü.'); });
let newPartArm = 0;
$('newPart').addEventListener('click', () => {
  if (CR.on) { log('Kariyerde ham parça siparişle gelir: panodan bir iş başlatın.', 'warn'); return; }
  const now = performance.now();
  if (now - newPartArm > 3000) { newPartArm = now; $('newPart').textContent = 'Onayla: parçayı değiştir'; setTimeout(() => $('newPart').textContent = 'Yeni ham parça', 3000); return; }
  newPartArm = 0; $('newPart').textContent = 'Yeni ham parça';
  resetPart($('matSel').value);
  log(`Mengeneye yeni ham parça bağlandı: ${mat.name}, ${PW}×${PD}×${PH} mm.`, 'ok');
});
function setMaterial(k) {
  mat = MATS[k] || MATS.al; S.mat = MATS[k] ? k : 'al';
  $('matSel').value = S.mat;
  $('brandMat').textContent = $('tbMat').textContent = `${mat.short} · ${PW}×${PD}×${PH}`;
  topMat.metalness = mat.nonMetal ? 0 : 0.62; topMat.roughness = mat.nonMetal ? 0.5 : 0.34;
  M.raw.color.setRGB(...mat.rawL); VX.setMat(mat); M.raw.metalness = mat.nonMetal ? 0 : 0.55; M.raw.roughness = mat.nonMetal ? 0.6 : 0.55;
  chipMat.metalness = mat.nonMetal ? 0 : 0.8; chipMat.roughness = mat.nonMetal ? 0.55 : 0.28;
  updateRec();
}
function resetPart(k) {
  if (S.spindle) spindle(false);
  if (k) setMaterial(k);
  H.fill(PH); CUT.fill(0); INSP.fill(0); MK1.fill(0); MK2.fill(0); TINTC.fill(0); TAPC.fill(0); S.tap = null; markDirty(0, NX - 1, 0, NY - 1);
  throughDirty = true;                       // delik yüzey listesi de yenilensin (yoksa eski delikler açık görünür)
  EDGE.fill(9); SURF.fill(0); S.blank = null;
  S.temp = 0; S.power = 0; S.chatNow = 0; S.lastRa = null;
  S.removed = 0; S.cutTime = 0; S.peck.active = false; clearChips();
  S.loose = null; for (const m of partMeshes()) { m.position.set(0, 0, 0); m.rotation.set(0, 0, 0); }
  if (FIX === 'div') VX.build(PW, PD);
  stopMotion();
  if (tipZ() < PH + 5) S.nose = PH + 20 + tool().len;
}

/* ---------------- İş emirleri, muayene ve puanlama ---------------- */
