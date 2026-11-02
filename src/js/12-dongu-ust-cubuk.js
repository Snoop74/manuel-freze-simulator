// ── Ana döngü ve arayüz: klavye, kamera, frame(), HUD, devir göstergesi, acil stop (paneller ve üst çubuk 11-paneller'de)
import { ayarDinle } from './00-tercihler.js';
import { $, C, H, NX, NY, PD, PW, RAPID, S, TAU, app, clamp, isDrill, log, mat, rapid, tipZ, tool } from './00-temel.js';
import { beep, initAudio, thud, updateAudio } from './01-ses.js';
import { FLOOR_Y, camera, controls, motorSwitch, mush, quill, renderer, scene, spLampMat, spindleG, stage, startBtnMat,
  toolRot, updateCoolant, zFine, zLever } from './02-sahne-tezgah.js';
import { ROT, pfLever, rotG, saddle, table, wheels, yWheel } from './03-tabla-parca.js';
import { VX } from './04-voksel.js';
import { FIX, KAY, divCrank, divRot, flushMesh, nV, rotCrank } from './05-baglama.js';
import { CHIP_TXT, ambientParticles, psAdd, psAlpha, updateChips, updatePS } from './06-talas.js';
import { profile } from './07-takim-gorsel.js';
import { loadRatio, motion, press, pressed, release, stopMotion } from './08-kesme.js';
import { COL, addSpin, drawWheels, droVals, fmt, requestToolChange, setStep, spinAng, spindle, toggleCoolant,
  tok, updateSpindleUI } from './09-kumanda.js';
import { mmss } from './10-is-emri-muayene.js';
import { PM } from './11-paneller.js';

// Klavye
const KEYMAP = { ArrowLeft:['x',-1], ArrowRight:['x',1], ArrowUp:['y',1], ArrowDown:['y',-1], PageUp:['z',1], PageDown:['z',-1], KeyW:['z',1], KeyS:['z',-1] };
window.addEventListener('keydown', e => {
  if (e.target instanceof Element && e.target.matches('input, select, textarea')) return;
  if (e.key === 'Shift') { S.rapidKey = true; return; }
  const km = KEYMAP[e.code];
  if (km) { e.preventDefault(); if (!e.repeat) press('key-' + e.code, km[0], km[1]); return; }
  if (e.code === 'KeyQ' || e.code === 'KeyE') { if (!e.repeat && (ROT.on || FIX === 'div')) { if (ROT.lock) log('Döner tabla kilitli: önce kilidi açın.', 'warn'); else ROT.hold = e.code === 'KeyQ' ? 1 : -1; } return; }
  if (e.repeat) return;
  if (e.code === 'Space') { e.preventDefault(); spindle(!S.spindle); }
  else if (e.code === 'KeyC') toggleCoolant();
  else if (e.code === 'KeyG') app.FD.setOn(!app.FD.on);
  else if (e.code === 'KeyB') app.AG.setOn(!app.AG.on);
  else if (e.code === 'KeyR') $('spDir').click();
  else if (e.code === 'Escape') estop();
  else if (/^Digit[1-4]$/.test(e.code)) setStep([0.01, 0.1, 1, 10][+e.code.slice(5) - 1]);
});
window.addEventListener('keyup', e => {
  if (e.key === 'Shift') S.rapidKey = false;
  if (KEYMAP[e.code]) release('key-' + e.code);
  if (e.code === 'KeyQ' || e.code === 'KeyE') { ROT.hold = 0; ROT.pend = 0; }
});
window.addEventListener('blur', () => { pressed.clear(); S.rapidKey = false; });

// Kamera görünümleri
const VIEWS = {
  vOp:   { p:[330, 250, 420], t:[0, 20, -30] },
  vNear: { p:[120, 95, 150],  t:[0, 35, -10] },
  vTop:  { p:[0, 560, 0.1],   t:[0, 0, 0] },
  vFront:{ p:[0, 60, 380],    t:[0, 40, 0] },
};
let camAnim = null;
function setView(id, instant) {
  const v = VIEWS[id];
  if (instant) { camera.position.set(...v.p); controls.target.set(...v.t); controls.update(); return; }
  camAnim = { t:0, p0:camera.position.clone(), t0:controls.target.clone(), p1:new THREE.Vector3(...v.p), t1:new THREE.Vector3(...v.t) };
}
Object.keys(VIEWS).forEach(id => $(id).addEventListener('click', () => setView(id)));
setView('vOp', true);

function resize() {
  const w = stage.clientWidth, h = stage.clientHeight;
  renderer.setSize(w, h, false); camera.aspect = w / Math.max(1, h); camera.updateProjectionMatrix();
  const sc = renderer.getDrawingBufferSize(new THREE.Vector2()).y / (2 * Math.tan(camera.fov * Math.PI / 360));
  psAdd.mat.uniforms.scale.value = psAlpha.mat.uniforms.scale.value = sc;
}
new ResizeObserver(resize).observe(stage); resize();
ayarDinle('cozunurluk', resize);                                 // piksel oranı değişince tampon ve partikül ölçeği yenilensin

/* ---------------- Ana döngü ---------------- */
// kamera atölyenin içinde kalır: uzaklaşma sınırı ve duvar/zemin/tavan içinde (duvar iç yüzlerinden 50 mm pay)
controls.maxDistance = 2600;
function odadaKal() {
  const p = camera.position;
  p.set(clamp(p.x, -3310, 3550), clamp(p.y, FLOOR_Y + 60, 2350), clamp(p.z, -1550, 2950));
}
let last = performance.now(), uiT = 0;
const vA = new THREE.Vector3(), vB = new THREE.Vector3();
function frame(now) {
  if (S.duraklat) {                                                // menü açık: simülasyon durur, sahne çizilmeye devam eder
    last = now; flushMesh(); controls.update(); odadaKal(); renderer.render(scene, camera); requestAnimationFrame(frame); return;   // parça yüzeyi menü açıkken de çizilir (açılışta kararmasın)
  }
  S.realDt = Math.max(0.001, (now - last) / 1000);
  const dt = Math.min(0.05, S.realDt); last = now;
  app.GK.update(dt); app.EG.kare();                                               // G-kod programı hareketi S.pend'e verir
  motion(dt);
  if (now - S.lastCut > 500) S.damage = Math.max(0, S.damage - 0.06 * dt);   // kesme bitince takım soğur
  if (!S.spindle || now - S.lastCut > 400) { S.power = 0; S.chatNow = 0; }
  S.rpmEff += ((S.spindle ? S.rpm * (S.power > 1 ? 1 - (S.power - 1) * 0.5 : 1) : S.rpm) - S.rpmEff) * Math.min(1, dt * 3);
  S.temp = Math.max(0, S.temp - S.temp * dt * S.sim * (S.coolant && !mat.dry ? 1 / 25 : 1 / 400));
  if ((S.hcT = (S.hcT || 0) + dt) > 0.5) { S.hcT = 0; let v = 0; for (let k = 0; k < nV; k++) v += H[k]; S.heatCap = v * C * C * mat.rho * 1e-3 * mat.c; }
  S.cutting += ((S.cutAcc > 0 ? Math.min(0.3, 0.05 + S.cutAcc / (dt * 4000)) : 0) - S.cutting) * Math.min(1, dt * 12);
  flushMesh();
  updateChips(dt); app.AG.update(dt); app.PR.update(dt); app.VAC.update(dt); app.DT.update();

  const T = tool(), tip = tipZ();
  saddle.position.z = S.py;
  table.position.x = -(S.px + KAY);                               // parça mengenede KAY kadar kayık bağlı
  rotG.rotation.y = ROT.on ? ROT.a * Math.PI / 180 : 0;
  if (rotCrank) rotCrank.rotation.z = -ROT.a * 90 * Math.PI / 180;
  divRot.rotation.x = FIX === 'div' ? ROT.a * Math.PI / 180 : 0;
  if (divCrank) divCrank.rotation.z = -ROT.a * 40 * Math.PI / 180;   // 40:1 sonsuz vida: kolun bir turu 9°
  if (FIX === 'div') VX.flush(6);
  if ((ROT.on || FIX === 'div') && ROT.shown !== ROT.a) { ROT.shown = ROT.a; const d = ((ROT.a - ROT.z0) % 360 + 360) % 360; $('rotA').textContent = d.toFixed(3) + '°'; }
  wheels.forEach(w => w.rotation.x = -S.px / 5 * Math.PI * 2);
  spindleG.position.y = S.nose;
  const qTop = 310;
  quill.scale.y = Math.max(1, qTop - S.nose); quill.position.y = (qTop + S.nose) / 2;
  zLever.rotation.x = -(S.nose - 150) / 60;
  spLampMat.emissiveIntensity += ((S.spindle ? 2.4 : 0) - spLampMat.emissiveIntensity) * Math.min(1, dt * 10);
  startBtnMat.emissiveIntensity = S.spindle ? 0.9 : 0;
  mush.position.z = S.alarm ? 29 : 34;
  motorSwitch.rotation.x += ((S.spindle ? (S.dir < 0 ? 0.7 : -0.7) : 0) - motorSwitch.rotation.x) * Math.min(1, dt * 12);
  if (S.spindle) addSpin(-S.dir * Math.min(S.rpm / 60, 14) * Math.PI * 2 * dt * 0.35);
  toolRot.rotation.y = spinAng;
  yWheel.rotation.z = -S.py / 5 * Math.PI * 2;
  updateCoolant(dt, tip);
  ambientParticles(dt, tip);
  updatePS(psAdd, dt); updatePS(psAlpha, dt);
  if (S.job && !S.job.done && (S.spindle || now - S.lastMove < 120)) S.job.time += dt * S.sim;
  if (app.CR.on && (S.spindle || now - S.lastMove < 120)) app.CR.ilerle(dt * S.sim);   // kariyerde mesai saati: 1 s ≈ 1 dk
  drawWheels(); drawGauge(); app.IA.update(dt); app.MG.update(dt);
  zFine.rotation.z = -S.nose / 2;
  pfLever.parent.rotation.z += (-S.autoX * 0.5 - pfLever.parent.rotation.z) * Math.min(1, dt * 12);
  if (camAnim) {
    camAnim.t = Math.min(1, camAnim.t + dt * 2.2);
    const e = camAnim.t < .5 ? 2 * camAnim.t * camAnim.t : 1 - Math.pow(-2 * camAnim.t + 2, 2) / 2;
    camera.position.lerpVectors(camAnim.p0, camAnim.p1, e);
    controls.target.lerpVectors(camAnim.t0, camAnim.t1, e);
    if (camAnim.t >= 1) camAnim = null;
  }
  controls.update(); odadaKal();
  renderer.render(scene, camera);
  updateAudio(dt);

  uiT += dt;
  if (uiT > 0.066) { uiT = 0; updateHud(T, tip); }
  requestAnimationFrame(frame);
}
function updateHud(T, tip) {
  updateLamps(); app.CP.update(T);
  { const vc = Math.PI * T.d * (S.spindle ? S.rpmEff : S.rpm) / 1000, rec = T.vc * mat.vcf;
    $('hMat').textContent = mat.short;
    $('hVc').textContent = T.type === 'edge' ? '—' : `${Math.round(vc)} m/dk (öneri ${Math.round(rec)})`;
    $('hVc').style.color = T.type !== 'edge' && (vc > rec * 1.5 || vc < rec * 0.4) ? 'var(--warn)' : '';
    $('hPow').textContent = S.power > 0.02 ? `%${Math.round(S.power * 100)}` : '—';
    $('hPow').style.color = S.power > 1 ? 'var(--bad)' : S.power > 0.8 ? 'var(--warn)' : '';
    $('hTemp').textContent = (20 + S.temp).toFixed(1) + ' °C';
    $('hWear').textContent = `VB ${S.wear[S.tool].toFixed(2)} mm`; $('ctWear').textContent = `${T.no} aşınma VB ${S.wear[S.tool].toFixed(2)} mm`;
    $('hWear').style.color = S.wear[S.tool] > 0.3 ? 'var(--warn)' : '';
    $('hRa').textContent = S.lastRa === null ? '—' : S.lastRa.toFixed(2) + ' µm';
    $('hChip').textContent = S.chipForm && performance.now() - S.chipT < 800 ? CHIP_TXT[S.chipForm] : '—'; }
  const d = droVals();
  $('droX').textContent = fmt(d.x); $('droY').textContent = fmt(d.y); $('droZ').textContent = fmt(d.z);
  $('hwxv').textContent = fmt(d.x); $('hwyv').textContent = fmt(d.y); $('hwzv').textContent = fmt(d.z);
  $('hTool').textContent = `${T.no} Ø${T.d} ${T.name.toLowerCase()}${S.broken ? ' (kırık)' : ''}`;
  $('hSpin').textContent = S.spindle ? `${S.rpm} dev/dk` : 'DURUYOR';
  $('hSpin').style.color = S.spindle ? 'var(--ok)' : 'var(--muted)';
  $('rapidState').textContent = rapid() ? 'hızlı hareket' : 'ilerleme';
  // yüzeye mesafe
  let gap = null;
  const r = T.d / 2;
  if (S.px > -r && S.px < PW + r && S.py > -r && S.py < PD + r) {
    let mh = -1;
    const i0 = Math.max(0, Math.floor((S.px - r) / C)), i1 = Math.min(NX - 1, Math.ceil((S.px + r) / C));
    const j0 = Math.max(0, Math.floor((S.py - r) / C)), j1 = Math.min(NY - 1, Math.ceil((S.py + r) / C));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const dx = i * C - S.px, dy = j * C - S.py;
      if (dx * dx + dy * dy <= r * r) { const p = H[j * NX + i] - (profile(T, Math.hypot(dx, dy), tip) - tip); if (p > mh) mh = p; }
    }
    if (mh >= 0) gap = tip - mh;
  }
  $('hGap').textContent = gap === null ? 'parça dışında' : gap.toFixed(3) + ' mm';
  $('hPaper').hidden = !(gap !== null && gap >= -0.001 && gap < 0.06 && !S.spindle && T.type !== 'edge');
  // talaş yükü
  const cuttingNow = performance.now() - S.lastCut < 400;
  const chip = cuttingNow ? S.lastChip : loadRatio(T, rapid() ? RAPID : S.feed, !isDrill(T));
  const stress = cuttingNow ? S.lastStress : 0;
  $('hLoadK').textContent = cuttingNow ? 'Talaş kalınlığı' : 'Talaş kalınlığı (tam kanal)';
  $('hLoad').textContent = T.type === 'edge' ? '—' : chip.toFixed(2) + '×';
  $('hStress').textContent = cuttingNow ? stress.toFixed(2) + '×' : 'kesmiyor';
  const m = $('hMeter');
  m.style.width = Math.min(100, stress / 6 * 100) + '%';
  m.style.background = stress > 1.5 ? 'var(--bad)' : stress > 1.1 ? 'var(--warn)' : 'var(--ok)';
  $('hDmg').textContent = Math.round(S.damage * 100) + '%';
  const db = $('hDmgBar');
  db.style.width = Math.min(100, S.damage * 100) + '%';
  db.style.background = S.damage > 0.6 ? 'var(--bad)' : 'var(--warn)';
  // görüş alanında takım yükü: keserken ya da zorlanma birikmişken görünür; zorlanma tehlikeli bölgedeyse bipler
  const yh = $('yukHud'), gor = (S.spindle && performance.now() - S.lastCut < 1500) || S.damage > 0.05;
  yh.hidden = !gor;
  if (gor) {
    $('yhLoad').style.width = Math.min(100, stress / 3 * 100) + '%';
    $('yhLoad').style.background = stress > 1.5 ? 'var(--bad)' : stress > 1.1 ? 'var(--warn)' : 'var(--ok)';
    $('yhDmg').style.width = Math.min(100, S.damage * 100) + '%';
    $('yhLoadV').textContent = cuttingNow ? stress.toFixed(1) + '×' : '—';
    $('yhDmgV').textContent = Math.round(S.damage * 100) + '%';
    const tal = isDrill(T) && performance.now() - (S.talasT || 0) < 1500 ? S.talas || 0 : 0;   // matkap: kanallardaki talaş
    $('yhTalasRow').hidden = !isDrill(T);
    $('yhTalas').style.width = Math.min(100, tal * 100) + '%'; $('yhTalas').style.background = tal > 0.7 ? 'var(--bad)' : tal > 0.45 ? 'var(--warn)' : 'var(--ok)';
    $('yhTalasV').textContent = Math.round(tal * 100) + '%';
    if (tal > 0.7 && cuttingNow && performance.now() - (S.talasBip || 0) > 800) { S.talasBip = performance.now(); beep(1200, 0.05, 0.05); }
    yh.classList.toggle('tehlike', S.damage > 0.6 || tal > 0.85);
    if (S.damage > 0.6 && cuttingNow && performance.now() - (S.yukBip || 0) > 650) { S.yukBip = performance.now(); beep(1500, 0.05, 0.05); }
  }
  $('hFeed').textContent = S.changing ? 'takım değişimi' : S.feedNow > 0 && (performance.now() - S.lastMove < 200) ? `${Math.round(S.curFeed)} mm/dk` : rapid() ? `HIZLI ${RAPID} mm/dk` : `${S.feed} mm/dk`;
  $('hJobRow').hidden = $('hTimeRow').hidden = !S.job;
  if (S.job) {
    $('hJob').textContent = `${S.job.order ? '#' + S.job.order.id + ' · ' : S.job.idx >= 0 ? S.job.idx + 1 + ' · ' : ''}${S.job.J.title}${S.job.done ? ' (teslim edildi)' : ''}`;
    $('hTime').textContent = `${mmss(S.job.time)} / ${mmss(S.job.J.target)}`;
    $('hTime').style.color = S.job.time > S.job.J.target ? 'var(--warn)' : 'var(--fg)';
  }
  $('stVol').textContent = (S.removed / 1000).toFixed(2) + ' cm³';
  const s = Math.floor(S.cutTime);
  $('stTime').textContent = Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
}

/* ---------------- İş mili göstergesi: devir ibresi ve motor yükü ---------------- */
let gaugeV = 0;
function drawGauge() {
  const c = $('spGauge'); if (!c || !c.clientWidth || c.closest('.panel[hidden]')) return;
  const w = c.clientWidth, h = c.clientHeight, dpr = Math.min(2, window.devicePixelRatio || 1);
  if (c.width !== Math.round(w * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
  const g = c.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
  const cx = w / 2, cy = h * 0.9, Rr = Math.min(w / 2 - 12, h * 0.8), MAXR = 4200;
  const target = S.spindle ? (S.rpmEff || S.rpm) : 0;
  gaugeV += (target - gaugeV) * 0.25;
  const ang = v => Math.PI + Math.PI * clamp(v / MAXR, 0, 1);
  g.lineCap = 'round';
  g.strokeStyle = COL.panel2; g.lineWidth = Rr * 0.16; g.beginPath(); g.arc(cx, cy, Rr, Math.PI, 2 * Math.PI); g.stroke();
  // yük yayı: motor gücünün yüzdesi
  const pw = clamp(S.power || 0, 0, 1.5) / 1.5;
  if (pw > 0.01) { g.strokeStyle = S.power > 1 ? COL.bad : S.power > 0.8 ? COL.safety : COL.ok; g.lineWidth = Rr * 0.07; g.beginPath(); g.arc(cx, cy, Rr * 0.78, Math.PI, Math.PI + Math.PI * pw); g.stroke(); }
  // ölçek
  g.strokeStyle = COL.muted; g.fillStyle = COL.muted; g.lineWidth = 1.2; g.font = `${Math.max(9, Rr * 0.11)}px "Share Tech Mono", monospace`; g.textAlign = 'center'; g.textBaseline = 'middle';
  for (let v = 0; v <= MAXR; v += 300) {
    const a = ang(v), major = v % 1200 === 0 || v === MAXR, r0 = Rr * (major ? 1.1 : 1.04), r1 = Rr * 1.16;
    g.beginPath(); g.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0); g.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1); g.stroke();
    if (major) g.fillText(v >= 1000 ? (v / 1000) + 'k' : String(v), cx + Math.cos(a) * Rr * 0.6, cy + Math.sin(a) * Rr * 0.6);
  }
  // ayarlanan devir işareti
  const as = ang(S.rpm); g.fillStyle = COL.safety; g.beginPath(); g.arc(cx + Math.cos(as) * Rr, cy + Math.sin(as) * Rr, Rr * 0.06, 0, TAU); g.fill();
  // ibre
  const a = ang(gaugeV);
  g.strokeStyle = S.spindle ? COL.fg : COL.muted; g.lineWidth = Math.max(2, Rr * 0.035);
  g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * Rr * 0.92, cy + Math.sin(a) * Rr * 0.92); g.stroke();
  g.fillStyle = COL.steel; g.beginPath(); g.arc(cx, cy, Rr * 0.07, 0, TAU); g.fill();
  g.fillStyle = S.spindle ? tok('--vfd') : COL.muted; g.font = `${Math.max(14, Rr * 0.26)}px "Share Tech Mono", monospace`;
  g.fillText(Math.round(gaugeV), cx, cy - Rr * 0.34);
  g.fillStyle = COL.muted; g.font = `${Math.max(9, Rr * 0.1)}px "IBM Plex Sans", sans-serif`;
  g.fillText(S.spindle ? 'dev/dk' : 'dev/dk · duruyor', cx, cy - Rr * 0.14);
}
COL.ok = tok('--ok'); COL.bad = tok('--bad');

/* ---------------- Acil stop ve hızlı kurtarma ---------------- */
function estop() {
  initAudio();
  const was = S.spindle || S.pend.x || S.pend.y || S.pend.z || S.wheel.x || S.wheel.y || S.wheel.z;
  if (S.spindle) { S.spindle = false; updateSpindleUI(); }
  stopMotion();
  if (was) { log('ACİL STOP: mil ve tüm hareketler durduruldu.', 'bad'); thud(70, 0.3, 0.25); }
}
$('alarmFix').addEventListener('click', () => {
  S.alarm = false; $('alarm').hidden = true;
  if (S.broken) requestToolChange(S.tool);
  PM.flash('tools');
});
$('estopBtn').addEventListener('click', estop);
function updateLamps() {
  PM.lamp('spindle', S.spindle ? 'on' : '');
  PM.lamp('tools', S.broken ? 'bad' : S.changing ? 'warn' : S.wear[S.tool] > 0.3 ? 'warn' : '');
  PM.lamp('hud', S.alarm ? 'bad' : S.lastStress > 1.2 || S.damage > 0.5 ? 'warn' : S.spindle ? 'on' : '');
  PM.lamp('jobs', S.job && !S.job.done ? 'on' : '');
  PM.lamp('console', S.alarm ? 'bad' : S.spindle ? 'on' : '');
  PM.lamp('jog', S.autoX ? 'warn' : app.FD.on ? 'on' : '');
  PM.lamp('spindle', S.spindle ? (S.dir < 0 ? 'warn' : 'on') : '');
}

/* ---------------- Makine üstünde kumanda: çarkları çevir, düğmelere bas ----------------
   Fare bir kumandanın üstündeyken kamera dönmez; çark sürüklenerek ya da tekerlekle çevrilir, düğmelere tıklanır. */

export { estop, frame };
