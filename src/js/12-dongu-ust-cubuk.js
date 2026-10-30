// ── Ana döngü ve arayüz: klavye, kamera, frame(), HUD, üst çubuk simgeleri, paneller (PM), devir göstergesi, acil stop
import { $, C, H, NX, NY, PD, PW, RAPID, S, TAU, app, clamp, isDrill, log, mat, rapid, tipZ, tool } from './00-temel.js';
import { initAudio, thud, updateAudio } from './01-ses.js';
import { camera, controls, motorSwitch, mush, quill, renderer, scene, spLampMat, spindleG, stage, startBtnMat,
  toolRot, updateCoolant, zFine, zLever } from './02-sahne-tezgah.js';
import { ROT, pfLever, rotG, saddle, table, wheels, yWheel } from './03-tabla-parca.js';
import { VX } from './04-voksel.js';
import { FIX, divCrank, divRot, flushMesh, nV, rotCrank } from './05-baglama.js';
import { CHIP_TXT, ambientParticles, psAdd, psAlpha, updateChips, updatePS } from './06-talas.js';
import { profile } from './07-takim-gorsel.js';
import { loadRatio, motion, press, pressed, release, stopMotion } from './08-kesme.js';
import { COL, addSpin, drawWheels, droVals, fmt, requestToolChange, setStep, spinAng, spindle, toggleCoolant,
  tok, updateSpindleUI } from './09-kumanda.js';
import { mmss } from './10-is-emri-muayene.js';

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

/* ---------------- Ana döngü ---------------- */
let last = performance.now(), uiT = 0;
const vA = new THREE.Vector3(), vB = new THREE.Vector3();
function frame(now) {
  S.realDt = Math.max(0.001, (now - last) / 1000);
  const dt = Math.min(0.05, S.realDt); last = now;
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
  table.position.x = -S.px;
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
  drawWheels(); drawGauge(); app.IA.update(dt);
  zFine.rotation.z = -S.nose / 2;
  pfLever.parent.rotation.z += (-S.autoX * 0.5 - pfLever.parent.rotation.z) * Math.min(1, dt * 12);
  if (camAnim) {
    camAnim.t = Math.min(1, camAnim.t + dt * 2.2);
    const e = camAnim.t < .5 ? 2 * camAnim.t * camAnim.t : 1 - Math.pow(-2 * camAnim.t + 2, 2) / 2;
    camera.position.lerpVectors(camAnim.p0, camAnim.p1, e);
    controls.target.lerpVectors(camAnim.t0, camAnim.t1, e);
    if (camAnim.t >= 1) camAnim = null;
  }
  controls.update();
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
  $('hFeed').textContent = S.changing ? 'takım değişimi' : S.feedNow > 0 && (performance.now() - S.lastMove < 200) ? `${Math.round(S.curFeed)} mm/dk` : rapid() ? `HIZLI ${RAPID} mm/dk` : `${S.feed} mm/dk`;
  $('hJobRow').hidden = $('hTimeRow').hidden = !S.job;
  if (S.job) {
    $('hJob').textContent = `${S.job.order ? '#' + S.job.order.id : S.job.idx + 1} · ${S.job.J.title}${S.job.done ? ' (teslim edildi)' : ''}`;
    $('hTime').textContent = `${mmss(S.job.time)} / ${mmss(S.job.J.target)}`;
    $('hTime').style.color = S.job.time > S.job.J.target ? 'var(--warn)' : 'var(--fg)';
  }
  $('stVol').textContent = (S.removed / 1000).toFixed(2) + ' cm³';
  const s = Math.floor(S.cutTime);
  $('stTime').textContent = Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
}

/* ---------------- Takım simgeleri (kalem kartları için) ---------------- */
function toolIcon(T) {
  const s = '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round">';
  switch (T.type) {
    case 'face': return s + '<path d="M12 3h8v9h-8z"/><path d="M5 12h22v6H5z" fill="currentColor" fill-opacity=".25"/><path d="M6 18l2 4M12 18l1 4M19 18l1 4M25 18l-1 4"/></svg>';
    case 'end': return s + '<path d="M11 3h10v11H11z"/><path d="M12 14h8v15h-8z" fill="currentColor" fill-opacity=".25"/><path d="M12 17l8 3M12 22l8 3"/></svg>';
    case 'ball': return s + '<path d="M11 3h10v11H11z"/><path d="M12 14h8v11a4 4 0 0 1-8 0z" fill="currentColor" fill-opacity=".25"/><path d="M12 17l8 3"/></svg>';
    case 'chamfer': return s + '<path d="M11 3h10v12H11z"/><path d="M9 15h14l-7 12z" fill="currentColor" fill-opacity=".25"/><path d="M12 18h8"/></svg>';
    case 'dial': return s + '<path d="M13 2h6v6h-6z"/><rect x="8" y="8" width="16" height="15" rx="6" fill="currentColor" fill-opacity=".25"/><circle cx="16" cy="15.5" r="4.5"/><path d="M16 15.5l2-3"/><path d="M16 23v5"/><circle cx="16" cy="29" r="1.6" fill="currentColor"/></svg>';
    case 'probe': return s + '<path d="M11 3h10v12H11z"/><path d="M12 15h8l-2 4h-4z" fill="currentColor" fill-opacity=".25"/><path d="M16 19v6"/><circle cx="16" cy="27" r="2.6" fill="currentColor"/></svg>';
    case 'spot': return s + '<path d="M11 3h10v13H11z"/><path d="M11 16h10l-5 11z" fill="currentColor" fill-opacity=".25"/></svg>';
    case 'drill': return s + '<path d="M12 3h8v7h-8z"/><path d="M13 10h6v16l-3 4-3-4z"/><path d="M13 13l6 3M13 18l6 3M13 23l5 2"/></svg>';
    case 'tap': return s + '<path d="M12 3h8v9h-8z"/><path d="M12 12h8v13l-4 4-4-4z"/><path d="M12 15l8 2M12 19l8 2M12 23l7 2"/></svg>';
    case 'edge': return s + '<path d="M12 3h8v12h-8z"/><path d="M14 15h4v7h-4z"/><circle cx="16" cy="25" r="3.5" fill="currentColor" fill-opacity=".25"/></svg>';
  }
  return s + '<circle cx="16" cy="16" r="10"/></svg>';
}

const TBICON = {
  logo:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M9 2h6v6H9z"/><path d="M10 8h4v10l-2 3-2-3z"/><path d="M10 11l4 2M10 15l4 2"/></svg>',
  console:'<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="10" r="2.3"/><circle cx="15.5" cy="10" r="2.3"/><path d="M7 16h10"/>',
  dro:'<rect x="2.5" y="5" width="19" height="14" rx="2"/><path d="M6.5 9.5v5M9.5 9.5h2.5v2.5h-2.5v2.5h2.5M15 9.5h2.5v5H15M15 12h2.5"/>',
  wheels:'<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="2"/><path d="M12 10V3.5M10.3 13l-5.6 3.3M13.7 13l5.6 3.3"/>',
  jog:'<path d="M12 3v18M3 12h18M9 6l3-3 3 3M9 18l3 3 3-3M6 9l-3 3 3 3M18 9l3 3-3 3"/>',
  spindle:'<path d="M4 17a8 8 0 1 1 16 0"/><path d="M12 17l4-5"/><circle cx="12" cy="17" r="1.3"/>',
  tools:'<path d="M9 2h6v7H9z"/><path d="M10 9h4v11l-2 2-2-2z"/><path d="M10 12l4 2M10 16l4 2"/>',
  part:'<path d="M4.5 8.5l7.5-4 7.5 4-7.5 4z"/><path d="M4.5 8.5v7l7.5 4 7.5-4v-7"/><path d="M12 12.5v7"/>',
  jobs:'<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V2.5h6V4M8.5 10h7M8.5 14h7M8.5 18h4"/>',
  drawing:'<rect x="3" y="4" width="18" height="16" rx="1.5"/><circle cx="12" cy="12" r="3.5"/><path d="M12 6.5v11M6.5 12h11" stroke-dasharray="2 1.6"/>',
  air:'<path d="M3 8.5h11v4H3z"/><path d="M14 10.5h6"/><path d="M5 12.5l-1.5 7.5h4.5L9.5 12.5"/><path d="M21 7.5c1.2 1 1.2 5 0 6"/>',
  fd:'<path d="M4 20l1-5L16 4l4 4L9 19z"/><path d="M14 6l4 4"/>',
  bench:'<path d="M3 5h18v4H3z"/><path d="M5 9v10l3-4V9M15 9v6l3 4V9"/><path d="M8 5v2M11 5v2M14 5v2M17 5v2"/>',
  editor:'<path d="M7 2h6v6H7z"/><path d="M8 8h4v9l-2 2-2-2z"/><path d="M15 21l6-6-2-2-6 6v2z"/>',
  shop:'<path d="M3 4h2l2.5 11h11L21 7H6.2"/><circle cx="9" cy="19" r="1.5"/><circle cx="17" cy="19" r="1.5"/>',
  hud:'<path d="M3 12h4l2-5 4 10 2-5h6"/>',
  log:'<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1"/><circle cx="4.5" cy="12" r="1"/><circle cx="4.5" cy="18" r="1"/>',
  layout:'<rect x="3" y="3" width="8" height="10" rx="1.5"/><rect x="13" y="3" width="8" height="6" rx="1.5"/><rect x="13" y="11" width="8" height="10" rx="1.5"/><rect x="3" y="15" width="8" height="6" rx="1.5"/>',
  camera:'<path d="M3 8h3.5l2-3h7l2 3H21v11H3z"/><circle cx="12" cy="13" r="3.5"/>',
  sound:'<path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/>',
  mute:'<path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M17 9.5l5 5M22 9.5l-5 5"/>',
  blank:'<path d="M4 8.5l8-4.5 8 4.5v7.5l-8 4.5-8-4.5z"/><path d="M4 8.5l8 4.5 8-4.5M12 13v7.5"/><path d="M8 6.3l8 4.5"/>',
  help:'<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .9-1 1.7v.5"/><circle cx="12" cy="17" r=".7"/>'
};
/* ---------------- Paneller: taşınabilir, ölçeklenebilir kumanda pencereleri ---------------- */
const PM = (() => {
  const TOP = 46, KEY = 'freze-panels-v2';
  const CFG = [
    { id:'console', title:'Kumanda paneli',   col:'B', w:760 },
    { id:'hud',     title:'Durum',            col:'L', w:290 },
    { id:'jobs',    title:'İş emirleri',      col:'L', w:340 },
    { id:'part',    title:'Parça',            col:'L', w:320 },
    { id:'log',     title:'Olay kaydı',       col:'L', w:340 },
    { id:'spindle', title:'İş mili',          col:'R', w:330 },
    { id:'tools',   title:'Takımlar',         col:'R', w:340 },
    { id:'dro',     title:'DRO',              col:'R', w:360 },
    { id:'wheels',  title:'El çarkları',      col:'B', w:440 },
    { id:'jog',     title:'Hareket',          col:'BL', w:330 },
    { id:'drawing', title:'Teknik resim',     col:'C', w:340 },
    { id:'keys',    title:'Kısayollar',       col:'C', w:300 },
  ];
  const PRESETS = {
    kumanda: ['console', 'tools', 'hud'],
    temel: ['hud', 'spindle', 'dro', 'tools', 'wheels', 'jog'],
    tam:   ['hud', 'jobs', 'log', 'spindle', 'dro', 'tools', 'wheels', 'jog'],
    is:    ['hud', 'jobs', 'spindle', 'dro', 'tools', 'wheels'],
    kariyer: ['console', 'jobs', 'tools'],
  };
  const P = {};
  let z = 30, store = {}, leftEdge = 310;
  try { store = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { store = {}; }
  const save = () => {
    const o = {};
    for (const id in P) { const p = P[id]; o[id] = { x:p.x, y:p.y, w:p.w, h:p.h, vis:p.vis, col:p.collapsed }; }
    try { localStorage.setItem(KEY, JSON.stringify(o)); } catch (e) {}
  };
  const narrow = () => window.innerWidth <= 900;
  const vh = () => window.innerHeight - TOP;

  function place(p) {
    if (narrow()) return;
    const W = window.innerWidth, H = vh();
    p.w = clamp(p.w, 210, W - 8);
    p.x = clamp(p.x, 0, Math.max(0, W - 60));
    p.y = clamp(p.y, 0, Math.max(0, H - 34));
    Object.assign(p.el.style, { left:p.x + 'px', top:p.y + 'px', width:p.w + 'px', height:p.h ? p.h + 'px' : '', maxHeight:(H - p.y - 6) + 'px' });
  }
  function front(p) { p.el.style.zIndex = ++z; }
  function setVis(id, v, noSave) {
    const p = P[id]; if (!p) return;
    p.vis = v; p.el.hidden = !v;
    const chip = document.querySelector(`.tbi[data-p="${id}"]`); if (chip) chip.classList.toggle('on', v);
    if (v) { front(p); place(p); }
    if (!noSave) save();
  }
  function build(cfg) {
    let body = document.querySelector(`[data-panel="${cfg.id}"]`);
    if (!body) return;
    const el = document.createElement('section'); el.className = 'panel'; el.hidden = true;
    el.innerHTML = `<div class="ph"><span class="lamp"></span><b>${cfg.title}</b><span class="pstat"></span><button class="pcol" title="Küçült" aria-label="Paneli küçült">–</button><button class="pclose" title="Kapat" aria-label="Paneli kapat">×</button></div><div class="pb"></div><div class="grip" title="Boyutlandır"></div>`;
    el.querySelector('.pb').append(body);
    $('panelLayer').append(el);
    // başlıktaki durum yazısı: bölümün başlığındaki ikinci alanı (ör. mil durumu) başlığa taşı
    const h2s = body.querySelector && body.querySelector(':scope > h2 > span:last-child');
    if (h2s && h2s.id) el.querySelector('.pstat').append(h2s);
    const p = P[cfg.id] = { cfg, el, lamp:el.querySelector('.lamp'), x:0, y:0, w:cfg.w, h:0, vis:false, collapsed:false };
    const ph = el.querySelector('.ph');
    el.addEventListener('pointerdown', () => front(p));
    // sürükle
    ph.addEventListener('pointerdown', e => {
      if (e.target.closest('button') || narrow()) return;
      e.preventDefault(); ph.setPointerCapture(e.pointerId);
      const sx = e.clientX - p.x, sy = e.clientY - p.y;
      const mv = ev => { p.x = ev.clientX - sx; p.y = ev.clientY - sy; place(p); };
      const up = () => { ph.removeEventListener('pointermove', mv); ph.removeEventListener('pointerup', up); ph.removeEventListener('pointercancel', up); save(); };
      ph.addEventListener('pointermove', mv); ph.addEventListener('pointerup', up); ph.addEventListener('pointercancel', up);
    });
    ph.addEventListener('dblclick', e => { if (!e.target.closest('button')) toggleCollapse(p); });
    // boyutlandır: içerik pencere genişliğiyle ölçeklenir
    const grip = el.querySelector('.grip');
    grip.addEventListener('pointerdown', e => {
      e.preventDefault(); e.stopPropagation(); grip.setPointerCapture(e.pointerId);
      const sx = e.clientX, sy = e.clientY, w0 = p.w, h0 = el.offsetHeight;
      const mv = ev => { p.w = Math.max(210, w0 + ev.clientX - sx); p.h = Math.max(80, h0 + ev.clientY - sy); place(p); };
      const up = () => { grip.removeEventListener('pointermove', mv); grip.removeEventListener('pointerup', up); grip.removeEventListener('pointercancel', up); save(); };
      grip.addEventListener('pointermove', mv); grip.addEventListener('pointerup', up); grip.addEventListener('pointercancel', up);
    });
    el.querySelector('.pcol').addEventListener('click', () => toggleCollapse(p));
    el.querySelector('.pclose').addEventListener('click', () => { if (cfg.id === 'drawing') $('drawing').hidden = true; else setVis(cfg.id, false); });
  }
  function toggleCollapse(p) { p.collapsed = !p.collapsed; p.el.classList.toggle('collapsed', p.collapsed); p.el.querySelector('.pcol').textContent = p.collapsed ? '+' : '–'; save(); }
  // Görünür panelleri sütunlara diz: sağda mil/DRO/takımlar, solda durum/iş, altta çarklar ve hareket
  function autoLayout() {
    const W = window.innerWidth, H = vh();
    // önce alttaki çark ve hareket panelleri; sütunlar onların üstünde biter
    const wh = P.wheels, jg = P.jog, cs = P.console, low = [];
    let wx = W / 2;
    if (cs && cs.vis) { cs.w = Math.min(cs.cfg.w, W - 40); cs.h = 0; place(cs); cs.x = (W - cs.w) / 2; cs.y = Math.max(10, H - cs.el.offsetHeight - 10); place(cs); wx = cs.x; low.push(cs); }
    if (wh && wh.vis) { wh.w = Math.min(wh.cfg.w, W - 40); wh.h = 0; place(wh); wh.x = cs && cs.vis ? Math.max(10, wx - wh.w - 10) : (W - wh.w) / 2; wh.y = H - wh.el.offsetHeight - 10; place(wh); wx = wh.x; low.push(wh); }
    if (jg && jg.vis) { jg.w = jg.cfg.w; jg.h = 0; place(jg); jg.x = Math.max(10, wx - jg.w - 10); jg.y = H - jg.el.offsetHeight - 10; place(jg); low.push(jg); }
    const floor = (x0, x1) => low.reduce((f, q) => (x1 > q.x && x0 < q.x + q.w) ? Math.min(f, q.y - 10) : f, H - 10);
    const cols = { L:{ x:10, y:10, dir:1, wm:0 }, R:{ x:W - 10, y:10, dir:-1, wm:0 } };
    for (const cfg of CFG) {
      const p = P[cfg.id]; if (!p || !p.vis || !['L', 'R'].includes(cfg.col)) continue;
      p.h = 0; p.w = cfg.w; place(p);
      const c = cols[cfg.col], nat = p.el.offsetHeight;
      let x = cfg.col === 'L' ? c.x : c.x - cfg.w, fl = floor(x, x + cfg.w);
      if (c.y + Math.min(nat, 220) > fl && c.y > 10) {
        c.x += c.dir * (c.wm + 10); c.y = 10; c.wm = 0;
        x = cfg.col === 'L' ? c.x : c.x - cfg.w; fl = floor(x, x + cfg.w);
      }
      p.x = x; p.y = c.y; c.wm = Math.max(c.wm, cfg.w);
      if (c.y + nat > fl) p.h = Math.max(120, fl - c.y);
      place(p);
      c.y += p.el.offsetHeight + 10;
    }
    leftEdge = cols.L.x + cols.L.wm + 10;
    for (const id of ['drawing', 'keys']) { const p = P[id]; if (p && p.vis) { p.w = p.cfg.w; p.h = 0; place(p); p.x = id === 'drawing' ? leftEdge : (W - p.w) / 2; p.y = 10; place(p); } }
    save();
  }
  function preset(name) {
    const set = PRESETS[name] || PRESETS.temel;
    for (const id in P) if (id !== 'drawing') setVis(id, set.includes(id), true);
    for (const id in P) { P[id].collapsed = false; P[id].el.classList.remove('collapsed'); P[id].el.querySelector('.pcol').textContent = '–'; }
    autoLayout();
    log(`Panel düzeni: ${{ kumanda:'Kumanda', temel:'Temel', tam:'Tam', is:'İş emri', kariyer:'Kariyer' }[name] || 'Temel'}.`);
  }
  function init() {
    CFG.forEach(build);
    // üst çubuk: marka, panel düğmeleri, düzenler, kamera, acil stop
    const tb = $('topbar');
    // simgeler, panel düğmeleri, aletler ve açılır menüler
    tb.querySelectorAll('[data-ic]').forEach(el => { const k = el.dataset.ic; el.innerHTML = k === 'logo' ? TBICON.logo : `<svg viewBox="0 0 24 24">${TBICON[k]}</svg>`; });
    const views = document.querySelector('.views'); if (views) views.hidden = true;     // kamera düğmeleri menüden tetiklenir
    const menus = { layout:$('mnLayout'), camera:$('mnCamera'), help:$('mnHelp') };
    const closeMenus = () => { for (const k in menus) menus[k].hidden = true; tb.querySelectorAll('.tbi.open').forEach(q => q.classList.remove('open')); };
    tb.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.menu) {
        const m = menus[b.dataset.menu], was = !m.hidden; closeMenus(); if (was) return;
        m.hidden = false; b.classList.add('open');
        const r = b.getBoundingClientRect(); m.style.left = Math.max(6, Math.min(window.innerWidth - m.offsetWidth - 6, r.left + r.width / 2 - m.offsetWidth / 2)) + 'px';
        return;
      }
      if (b.dataset.p) { setVis(b.dataset.p, !P[b.dataset.p].vis); return; }
      if (b.dataset.l) { closeMenus(); if (b.dataset.l === 'reset') { try { localStorage.removeItem(KEY); } catch (_) {} preset('kumanda'); } else preset(b.dataset.l); return; }
      if (b.dataset.v) { closeMenus(); const v = $(b.dataset.v); if (v) v.click(); return; }
      const a = b.dataset.act; if (!a) return;
      initAudio(); closeMenus();
      if (a === 'drawing') $('drawing').hidden = !$('drawing').hidden;
      else if (a === 'air') app.AG.setOn(!app.AG.on);
      else if (a === 'fd') app.FD.setOn(!app.FD.on);
      else if (a === 'bench') $('benchOpen').click();
      else if (a === 'editor') app.TE.show(S.tool);
      else if (a === 'shop') app.CR.openShop();
      else if (a === 'blanks') app.BG.toggle();
      else if (a === 'keys') setVis('keys', true);
      else if (a === 'sound') { $('mute').click(); b.innerHTML = `<svg viewBox="0 0 24 24">${TBICON[S.muted ? 'mute' : 'sound']}</svg>`; b.classList.toggle('on', S.muted); }
    });
    document.addEventListener('pointerdown', e => { if (!e.target.closest('.tb-menu') && !e.target.closest('[data-menu]')) closeMenus(); });
    window.addEventListener('keydown', e => { if (e.code === 'Escape') closeMenus(); });
    // kaydedilmiş düzen ya da varsayılan
    const has = Object.keys(store).length > 0;
    for (const id in P) {
      const s = store[id], p = P[id];
      if (s) { Object.assign(p, { x:s.x, y:s.y, w:s.w || p.w, h:s.h || 0, collapsed:!!s.col }); p.el.classList.toggle('collapsed', p.collapsed); p.el.querySelector('.pcol').textContent = p.collapsed ? '+' : '–'; }
      if (id !== 'drawing') setVis(id, has ? !!(s && s.vis) : PRESETS.kumanda.includes(id), true);
    }
    if (!has) requestAnimationFrame(() => autoLayout()); else for (const id in P) if (P[id].vis) place(P[id]);
    // teknik resim paneli, resmin kendi görünürlüğünü izler
    const dw = $('drawing');
    if (dw && P.drawing) {
      const sync = () => { const v = !dw.hidden; P.drawing.vis = v; P.drawing.el.hidden = !v; $('tbDraw').classList.toggle('on', v); if (v) { if (!P.drawing.x && !P.drawing.y) { P.drawing.x = leftEdge; P.drawing.y = 10; } front(P.drawing); place(P.drawing); } };
      new MutationObserver(sync).observe(dw, { attributes:true, attributeFilter:['hidden'] }); sync();
    }
    window.addEventListener('resize', () => { for (const id in P) if (P[id].vis) place(P[id]); });
  }
  function flash(id) { const p = P[id]; if (!p) return; if (!p.vis) setVis(id, true); front(p); p.el.classList.remove('flash'); void p.el.offsetWidth; p.el.classList.add('flash'); }
  function lamp(id, state) { const p = P[id]; if (!p) return; p.lamp.className = 'lamp' + (state ? ' ' + state : ''); }
  return { init, preset, flash, lamp, setVis, P };
})();

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
Object.assign(app, { PM, toolIcon });   // önceki modüllerin geç başvuruları

export { PM, estop, frame, toolIcon };
