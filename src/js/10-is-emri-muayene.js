// ── İş emirleri: görevler, teknik resim, markalama, muayene ve puan, teslim raporu
import { $, C, CUT, EDGE, H, INSP, NX, NY, PD, PH, PW, S, TOOLS, app, clamp, isDrill, log } from './00-temel.js';
import { beep, initAudio } from './01-ses.js';
import { rotIn } from './03-tabla-parca.js';
import { FIX, PAR, markDirty, parAxis, parBands, straps, warnParallels } from './05-baglama.js';
import { burst } from './06-talas.js';
import { resetPart } from './09-kumanda.js';

const JOBS = [
  { title:'Yüzey alma', target:180,
    brief:'Ham parçanın üst yüzeyinden 1.00 mm alın. Yüzeyin tamamı işlenmiş ve düz olmalı. T1 alın frezesi bu iş için uygundur.',
    face:{ depth:1, tol:0.1 } },
  { title:'İlk delik', target:150,
    brief:'Parçanın tam ortasına Ø8.5 boydan boya delik açın. Önce T6 ile punta vurun, sonra T8 ile delin.',
    holes:[{ x:75, y:50, d:8.5 }] },
  { title:'Delik dizisi', target:330,
    brief:'Dört köşeye Ø5 boydan boya delik. 40 mm derinlik matkap çapının 8 katı: talaşı boşaltmak için gagalayarak delin.',
    holes:[{ x:20, y:20, d:5 }, { x:130, y:20, d:5 }, { x:130, y:80, d:5 }, { x:20, y:80, d:5 }] },
  { title:'Dikdörtgen cep', target:420,
    brief:'40×30 mm, 5.00 mm derin cep. Takım merkezi duvarlardan takım yarıçapı kadar içeride gezmeli; Ø10 frezeyle merkez X 60…90, Y 40…60 arasında kalır.',
    pockets:[{ x0:55, x1:95, y0:35, y1:65, depth:5 }] },
  { title:'Flanş plakası', target:960,
    brief:'Üst yüzeyden 0.5 mm alın, ortaya 60×40×4 cep açın, cebin ortasına Ø12 delik, köşelere 4×Ø8.5 delik açın. Delikler boydan boya.',
    face:{ depth:0.5, tol:0.1 },
    pockets:[{ x0:45, x1:105, y0:30, y1:70, depth:4 }],
    holes:[{ x:75, y:50, d:12 }, { x:15, y:20, d:8.5 }, { x:135, y:20, d:8.5 }, { x:135, y:80, d:8.5 }, { x:15, y:80, d:8.5 }] },
  { title:'Döner tabla: cıvata dairesi ve yay kanal', target:900, rot:true,
    brief:'Döner tablayla çalışın (iş başlarken bağlanır; parçanın ortası (75, 50) tabla merkezinde). R35 dairesi üzerine 60°\'de bir 6×Ø8.5 boydan boya delik (ilki 0°, merkezin sağında), ortaya R20, 10 mm genişlikte, 3 mm derin, 30°–150° arası yay kanal. İpucu: matkabı X 110, Y 50\'ye getirip delin; her delikten sonra takımı pabuçların üstüne kaldırıp (Z +20) tablayı 60° çevirin. Yay için T3 Ø10\'u X 95, Y 50\'ye getirin, tablayı −30°\'ye alıp kilidi açın, 3 mm dalın ve tablayı −150°\'ye çevirin: tabla döndükçe takım parçaya göre ters yönde ilerler.',
    holes:[0, 60, 120, 180, 240, 300].map(a => ({ x:+(75 + 35 * Math.cos(a * Math.PI / 180)).toFixed(3), y:+(50 + 35 * Math.sin(a * Math.PI / 180)).toFixed(3), d:8.5 })),
    arcs:[{ cx:75, cy:50, r:20, w:10, a0:30, a1:150, depth:3 }] },
];
JOBS.forEach(J => { J.pockets = J.pockets || []; J.holes = J.holes || []; J.arcs = J.arcs || []; J.pockets.forEach(p => { if (p.r == null) p.r = 5; }); });
// cep köşe radyüslü dikdörtgen: dönen takım iç köşeyi keskin açamaz, resimdeki R en büyük köşe radyüsüdür (daha küçüğü fazla kesim sayılmaz)
function inRR(x, y, p, m = 0) {
  if (!inRect(x, y, p, m)) return false;
  const r = p.r || 0; if (r <= 0) return true;
  const cx = clamp(x, p.x0 + r, p.x1 - r), cy = clamp(y, p.y0 + r, p.y1 - r);
  return Math.hypot(x - cx, y - cy) <= r + m;
}
// yay kanal: merkez (cx, cy), yarıçap r, genişlik w, açı a0..a1 (derece, +X'ten saat yönünün tersine), uçlar yuvarlak
function inArc(x, y, A, m = 0) {
  const dx = x - A.cx, dy = y - A.cy, hw = A.w / 2 + m;
  let t = Math.atan2(dy, dx) * 180 / Math.PI; if (t < 0) t += 360;
  if (t >= A.a0 && t <= A.a1 && Math.abs(Math.hypot(dx, dy) - A.r) <= hw) return true;
  for (const a of [A.a0, A.a1]) if (Math.hypot(x - A.cx - Math.cos(a * Math.PI / 180) * A.r, y - A.cy - Math.sin(a * Math.PI / 180) * A.r) <= hw) return true;
  return false;
}
const HOLE_TOL0 = 0.2, DEPTH_TOL0 = 0.1, SIZE_TOL0 = 0.3;
let HOLE_TOL = HOLE_TOL0, DEPTH_TOL = DEPTH_TOL0, SIZE_TOL = SIZE_TOL0;

let progress = {};
try { progress = JSON.parse(localStorage.getItem('freze-progress') || '{}') || {}; } catch (e) { progress = {}; }
function saveProgress() { try { localStorage.setItem('freze-progress', JSON.stringify(progress)); } catch (e) {} }
const bestStars = i => (progress['j' + i] && progress['j' + i].stars) || 0;
const unlocked = i => i === 0 || bestStars(i - 1) >= 1;

const jobTop = J => (J.h || PH) - (J.face ? J.face.depth : 0);
const inRect = (x, y, p, m = 0) => x >= p.x0 - m && x <= p.x1 + m && y >= p.y0 - m && y <= p.y1 + m;
// hazır parça: istenen bitmiş yükseklik (düzlenecek seviye) ya da parçanın kendi yüzeyi
function blankTop(J, x, y) {
  const P = J._P, o = P.H(x, y);
  if (J.levels) { const g = P.geo, r = Math.hypot(x - g.c, y - g.c); for (const L of J.levels) if (r >= (L.rmin || 0) && r <= L.rmax) return Math.min(o, L.z); }
  if (J.flush && o > J.flush.top) return J.flush.top;
  if (J.deck && P.Sf(x, y) === (J.deck.sf ?? app.SF.old) && o >= J.deck.base) return Math.min(o, J.deck.floor + J.deck.maxCut * 0.5);
  if (J.pads) for (const q of J.pads) if (inRect(x, y, q)) return Math.min(o, q.z);
  if (J.face) return Math.min(o, jobTop(J));
  return o;
}
function localTop(J, x, y) {
  if (J._P) {                                                      // hazır parça: bitmiş üst yüzey (eski delik dipleri değil)
    const g = J._P.geo, pd = J.pads && J.pads.find(q => inRect(x, y, q));
    const top = pd ? pd.z : J.levels ? (Math.hypot(x - g.c, y - g.c) <= g.Rh ? J.levels[0].z : J.levels[1].z) : J.face ? jobTop(J) : J.flush ? J.flush.top : J.h;
    let t = top; for (const p of J.pockets) if (inRR(x, y, p)) t = Math.min(t, top - p.depth); return t;
  }
  let t = jobTop(J);
  for (const p of J.pockets) if (inRR(x, y, p)) t = Math.min(t, jobTop(J) - p.depth);
  for (const A of J.arcs || []) if (inArc(x, y, A)) t = Math.min(t, jobTop(J) - A.depth);
  return t;
}
// Resme göre bir noktada inilebilecek en düşük yükseklik (bunun altı "fazla kesilmiş")
function allowedAt(J, x, y) {
  for (const h of J.holes) if (Math.hypot(x - h.x, y - h.y) <= h.d / 2 + 0.6) return -1;
  if (J._P) {                                                      // hazır parça: istenmeyen yerde parçanın kendi yüzeyi sınırdır
    const P = J._P, o = P.H(x, y);
    let e = o;
    if (J.deck && P.Sf(x, y) === (J.deck.sf ?? app.SF.old) && o >= J.deck.base) e = Math.min(o, J.deck.floor);
    if (J.pads) for (const q of J.pads) if (inRect(x, y, q, 1)) e = Math.min(e, q.z - q.tol);
    if (J.levels) { const g = P.geo, r = Math.hypot(x - g.c, y - g.c), [Lh, Lf] = J.levels; e = Math.min(e, r <= g.Rh ? Lh.z - Lh.tol : Lf.z - Lf.tol); }   // göbek dibi ve kenar pahı da alın seviyesine inebilir
    if (J.flush) e = Math.min(e, J.flush.top - 0.2);
    if (J.face) e = Math.min(e, jobTop(J));
    for (const p of J.pockets) if (inRect(x, y, p, 0.6)) e = Math.min(e, blankTop(J, x, y) - p.depth);
    return e;
  }
  let e = jobTop(J);
  for (const p of J.pockets) if (inRect(x, y, p, 0.6)) e = Math.min(e, jobTop(J) - p.depth);
  for (const A of J.arcs || []) if (inArc(x, y, A, 0.6)) e = Math.min(e, jobTop(J) - A.depth);
  return e;
}

/* -- Markalama çizgileri (parçanın üstünde) -- */
const scribe = new THREE.Group(); rotIn.add(scribe);
const scribeMat = new THREE.LineBasicMaterial({ color:0xf0b429, transparent:true, opacity:0.85, depthTest:false });
function buildScribe(J) {
  while (scribe.children.length) { const c = scribe.children.pop(); c.geometry.dispose(); }
  if (!J) return;
  const y = jobTop(J) + 0.05, v = [];
  const seg = (x1, y1, x2, y2, z = y) => v.push(x1, z, -y1, x2, z, -y2);
  for (const p of J.pockets) {                                     // radyüslü köşeli cep çizgisi
    const r = Math.min(p.r || 0, (p.x1 - p.x0) / 2, (p.y1 - p.y0) / 2);
    seg(p.x0 + r, p.y0, p.x1 - r, p.y0); seg(p.x1, p.y0 + r, p.x1, p.y1 - r); seg(p.x1 - r, p.y1, p.x0 + r, p.y1); seg(p.x0, p.y1 - r, p.x0, p.y0 + r);
    for (const [cx, cy, a0] of [[p.x1 - r, p.y0 + r, -90], [p.x1 - r, p.y1 - r, 0], [p.x0 + r, p.y1 - r, 90], [p.x0 + r, p.y0 + r, 180]])
      for (let k = 0; k < 6; k++) { const a = (a0 + k * 15) * Math.PI / 180, b = (a0 + k * 15 + 15) * Math.PI / 180; seg(cx + Math.cos(a) * r, cy + Math.sin(a) * r, cx + Math.cos(b) * r, cy + Math.sin(b) * r); }
  }
  for (const h of J.holes) {
    const r = h.d / 2, z = localTop(J, h.x, h.y) + 0.05;
    for (let k = 0; k < 32; k++) { const a = k / 32 * Math.PI * 2, b = (k + 1) / 32 * Math.PI * 2; seg(h.x + Math.cos(a) * r, h.y + Math.sin(a) * r, h.x + Math.cos(b) * r, h.y + Math.sin(b) * r, z); }
    seg(h.x - r - 3, h.y, h.x + r + 3, h.y, z); seg(h.x, h.y - r - 3, h.x, h.y + r + 3, z);
  }
  for (const A of J.arcs || []) {                                  // yay kanal: iç ve dış yay, uç yarım daireleri
    const P = (a, rr) => [A.cx + Math.cos(a * Math.PI / 180) * rr, A.cy + Math.sin(a * Math.PI / 180) * rr];
    for (const rr of [A.r - A.w / 2, A.r + A.w / 2]) for (let a = A.a0; a < A.a1; a += 3) { const [x1, y1] = P(a, rr), [x2, y2] = P(Math.min(A.a1, a + 3), rr); seg(x1, y1, x2, y2); }
    for (const [ea, sg] of [[A.a0, -1], [A.a1, 1]]) { const [ex, ey] = P(ea, A.r); for (let k = 0; k < 12; k++) { const b0 = ea * Math.PI / 180 + sg * k / 12 * Math.PI, b1 = ea * Math.PI / 180 + sg * (k + 1) / 12 * Math.PI, h = A.w / 2; seg(ex + Math.cos(b0) * h, ey + Math.sin(b0) * h, ex + Math.cos(b1) * h, ey + Math.sin(b1) * h); } }
  }
  if (!v.length) return;
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  const l = new THREE.LineSegments(g, scribeMat); l.renderOrder = 4; scribe.add(l);
}

/* -- Teknik resim -- */
function drawingSVG(J) {
  const W = J.w || 150, D = J.d || 100, k = Math.min(150 / W, 100 / D);   // resim 150×100 alana sığar
  const ox = 30, oy = 16, X = x => ox + x * k, Y = y => oy + (D - y) * k;
  let s = `<svg viewBox="0 0 200 146" role="img" aria-label="Teknik resim üstten görünüş">
    <defs><pattern id="hatch" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="4" stroke="currentColor" stroke-width=".6" style="stroke:var(--ink-2)"/></pattern></defs>`;
  if (J.face) s += `<rect class="dw-face" x="${X(0)}" y="${Y(D)}" width="${W * k}" height="${D * k}"/>`;
  if (J.round) s += `<circle class="dw-part" cx="${X(J.round.c)}" cy="${Y(J.round.c)}" r="${J.round.R * k}"/>`;
  else s += `<rect class="dw-part" x="${X(0)}" y="${Y(D)}" width="${W * k}" height="${D * k}"/>`;
  for (const q of J.pads || []) s += `<rect x="${X(q.x0)}" y="${Y(q.y1)}" width="${(q.x1 - q.x0) * k}" height="${(q.y1 - q.y0) * k}" fill="none" class="dw-feat"/><text x="${X(q.x0) + 1.5}" y="${Y(q.y1) + 5}" font-size="4.5">PED ${q.z}</text>`;
  for (const [ex, ey, er] of J.exist || []) s += `<circle cx="${X(ex)}" cy="${Y(ey)}" r="${er * k}" fill="none" style="stroke:var(--ink-2)" stroke-width=".45" stroke-dasharray="1.2 1"/>`;   // parçada zaten var
  if (['vise', 'clamp', 'rot'].includes(FIX) && !PAR.sac && W === PW && D === PD) for (const [a, b] of parBands())   // paraleller: kesik çizgi
    s += parAxis() === 'x' ? `<rect x="${X(a)}" y="${Y(D)}" width="${(b - a) * k}" height="${D * k}" fill="none" style="stroke:var(--ink-2)" stroke-width=".5" stroke-dasharray="2 1.5"/>`
      : `<rect x="${X(0)}" y="${Y(b)}" width="${W * k}" height="${(b - a) * k}" fill="none" style="stroke:var(--ink-2)" stroke-width=".5" stroke-dasharray="2 1.5"/>`;
  J.pockets.forEach((p, i) => {
    s += `<rect class="dw-feat" style="fill:var(--paper)" x="${X(p.x0)}" y="${Y(p.y1)}" width="${(p.x1 - p.x0) * k}" height="${(p.y1 - p.y0) * k}" rx="${(p.r || 0) * k}"/>`;
    s += `<text x="${X(p.x0) + 2}" y="${Y(p.y1) + 6}" font-size="5">C${i + 1}  ${p.x1 - p.x0}×${p.y1 - p.y0} ↓${p.depth}  R${p.r || 0}</text>`;
  });
  J.holes.forEach((h, i) => {
    const r = h.d / 2 * k;
    s += `<line class="dw-cl" x1="${X(h.x) - r - 4}" y1="${Y(h.y)}" x2="${X(h.x) + r + 4}" y2="${Y(h.y)}"/><line class="dw-cl" x1="${X(h.x)}" y1="${Y(h.y) - r - 4}" x2="${X(h.x)}" y2="${Y(h.y) + r + 4}"/>`;
    s += `<circle class="dw-feat" cx="${X(h.x)}" cy="${Y(h.y)}" r="${r}"/>`;
    s += `<text x="${X(h.x) + r + 1}" y="${Y(h.y) - r - 0.5}" font-size="5">D${i + 1}</text>`;
  });
  (J.arcs || []).forEach((A, i) => {
    const P = a => [X(A.cx + Math.cos(a * Math.PI / 180) * A.r), Y(A.cy + Math.sin(a * Math.PI / 180) * A.r)];
    const [x0, y0] = P(A.a0), [x1, y1] = P(A.a1), lg = A.a1 - A.a0 > 180 ? 1 : 0, d = `M${x0} ${y0} A${A.r * k} ${A.r * k} 0 ${lg} 0 ${x1} ${y1}`;
    s += `<path d="${d}" fill="none" style="stroke:var(--ink);opacity:.22" stroke-width="${A.w * k}" stroke-linecap="round"/><path d="${d}" class="dw-cl" fill="none"/>`;
    s += `<line class="dw-cl" x1="${X(A.cx) - 3}" y1="${Y(A.cy)}" x2="${X(A.cx) + 3}" y2="${Y(A.cy)}"/><line class="dw-cl" x1="${X(A.cx)}" y1="${Y(A.cy) - 3}" x2="${X(A.cx)}" y2="${Y(A.cy) + 3}"/>`;
    s += `<text x="${X(A.cx) - 12}" y="${Y(A.cy) + 8}" font-size="5">Y${i + 1} R${A.r}</text>`;
  });
  // ölçü çizgileri ve sıfır noktası
  s += `<line class="dw-dim" x1="${X(0)}" y1="${Y(0) + 8}" x2="${X(W)}" y2="${Y(0) + 8}"/><text x="${X(W / 2) - 5}" y="${Y(0) + 14}" font-size="5.5">${W}</text>`;
  s += `<line class="dw-dim" x1="${X(W) + 6}" y1="${Y(D)}" x2="${X(W) + 6}" y2="${Y(0)}"/><text x="${X(W) + 8}" y="${Y(D / 2) + 2}" font-size="5.5">${D}</text>`;
  s += `<circle cx="${X(0)}" cy="${Y(0)}" r="2.2" style="fill:var(--ink)"/><text x="${X(0) - 19}" y="${Y(0) + 2}" font-size="5">0,0</text>`;
  s += `<line x1="${X(0)}" y1="${Y(0)}" x2="${X(0) + 14}" y2="${Y(0)}" style="stroke:var(--ink);stroke-width:.8"/><text x="${X(0) + 15}" y="${Y(0) + 1.8}" font-size="5">X</text>`;
  s += `<line x1="${X(0)}" y1="${Y(0)}" x2="${X(0)}" y2="${Y(0) - 14}" style="stroke:var(--ink);stroke-width:.8"/><text x="${X(0) - 1.6}" y="${Y(0) - 15.5}" font-size="5">Y</text>`;
  if (J.face) s += `<text x="${X(0)}" y="${oy - 4}" font-size="5">ÜST YÜZEY −${J.face.depth.toFixed(2)} ±${J.face.tol}  (Z ${jobTop(J).toFixed(2)})</text>`;
  return s + '</svg>';
}
function drawingTable(J) {
  const HOLE_TOL = HOLE_TOL0 * (J.tolK || 1), SIZE_TOL = SIZE_TOL0 * (J.tolK || 1), DEPTH_TOL = DEPTH_TOL0 * (J.tolK || 1);   // hassas işte yarıya iner
  let t = '';
  if (J.holes.length) {
    t += '<tr><th>Delik</th><th>X</th><th>Y</th><th>Ø</th><th>Derinlik</th></tr>';
    J.holes.forEach((h, i) => t += `<tr><td>D${i + 1}</td><td>${h.x.toFixed(2)}</td><td>${h.y.toFixed(2)}</td><td>${h.d}</td><td>boydan boya</td></tr>`);
  }
  if (J.pockets.length) {
    t += '<tr><th>Cep</th><th>X</th><th>Y</th><th>Ölçü</th><th>Derinlik</th></tr>';
    J.pockets.forEach((p, i) => t += `<tr><td>C${i + 1}</td><td>${p.x0}–${p.x1}</td><td>${p.y0}–${p.y1}</td><td>${p.x1 - p.x0}×${p.y1 - p.y0} ±${SIZE_TOL}, köşe R${p.r || 0}</td><td>${p.depth.toFixed(2)} ±${DEPTH_TOL}</td></tr>`);
  }
  if ((J.arcs || []).length) {
    t += '<tr><th>Yay</th><th>Merkez</th><th>R × genişlik</th><th>Açı</th><th>Derinlik</th></tr>';
    J.arcs.forEach((A, i) => t += `<tr><td>Y${i + 1}</td><td>${A.cx}, ${A.cy}</td><td>R${A.r} × ${A.w} ±${SIZE_TOL}</td><td>${A.a0}°–${A.a1}°</td><td>${A.depth.toFixed(2)} ±${DEPTH_TOL}</td></tr>`);
  }
  if (J.deck) t += `<tr><td colspan="5">Conta yüzü: tamamen düzlenecek, düzlemsellik ≤ ${J.deck.flat}, en çok ${J.deck.maxCut} mm alınacak (en yüksek noktaya göre)</td></tr>`;
  for (const L of J.levels || []) t += `<tr><td colspan="5">${L.name}: ${L.z.toFixed(2)} ±${L.tol} (tablaya göre yükseklik)</td></tr>`;
  (J.pads || []).forEach((q, i) => t += `<tr><td colspan="5">Ayak ${i + 1} pedi: ${q.z.toFixed(2)} ±${q.tol} (tablaya göre yükseklik)</td></tr>`);
  if (J.flush) t += `<tr><td colspan="5">Kaynak dikişleri plaka yüzeyiyle sıfırlanacak (${J.flush.top.toFixed(2)} +${J.flush.tol}); plakaya en çok 0.2 mm dalınabilir</td></tr>`;
  if (J.exist && J.exist.length) t += '<tr><td colspan="5">Kesik daireler parçada zaten olan delik ve detaylardır.</td></tr>';
  if (J.holes.length) t += `<tr><td colspan="5">Delik konum toleransı ±${HOLE_TOL}</td></tr>`;
  return t;
}

/* -- Muayene -- */
function inspect(J) {
  const HOLE_TOL = HOLE_TOL0 * (J.tolK || 1), SIZE_TOL = SIZE_TOL0 * (J.tolK || 1), DEPTH_TOL = DEPTH_TOL0 * (J.tolK || 1);   // hassas işte yarıya iner
  const items = [];
  const add = (grp, label, nom, meas, ok, sc, w = 1) => items.push({ grp, label, nom, meas, ok, sc: clamp(sc, 0, 1), w });
  const dev = (d, tol) => d <= tol ? 1 : Math.max(0, 1 - (d - tol) / (2 * tol));
  const top = jobTop(J);
  if (J.face) {
    let n = 0, cut = 0, sum = 0, mn = 1e9, mx = -1e9;
    for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
      if (allowedAt(J, i * C, j * C) < top - 0.01) continue;
      if (straps.some(f => i * C >= f.cover[0] && i * C <= f.cover[1] && j * C >= f.cover[2] && j * C <= f.cover[3])) continue;   // pabuç altı işlenemez
      const k = j * NX + i; n++;
      if (CUT[k] && H[k] < PH - 0.001) { cut++; sum += H[k]; if (H[k] < mn) mn = H[k]; if (H[k] > mx) mx = H[k]; }
    }
    const cov = n ? cut / n : 0, mean = cut ? sum / cut : PH, tol = J.face.tol;
    add('Yüzey', 'İşlenmiş alan', '≥ %97', '%' + (cov * 100).toFixed(1), cov >= 0.97, cov / 0.97);
    add('Yüzey', 'Üst yüzey yüksekliği', top.toFixed(2) + ' ±' + tol, mean.toFixed(3), Math.abs(mean - top) <= tol, dev(Math.abs(mean - top), tol), 2);
    const flat = cut ? mx - mn : 0;
    add('Yüzey', 'Düzlemsellik', '≤ ' + tol.toFixed(2), flat.toFixed(3), cut > 0 && flat <= tol, cut ? dev(flat, tol) : 0);
  }
  J.pockets.forEach((p, idx) => {
    const g = 'C' + (idx + 1), floorN = top - p.depth, thr = top - p.depth / 2;
    let n = 0, sum = 0, clean = 0;
    for (let j = Math.ceil((p.y0 + 1) / C); j <= Math.floor((p.y1 - 1) / C); j++) for (let i = Math.ceil((p.x0 + 1) / C); i <= Math.floor((p.x1 - 1) / C); i++) {
      const x = i * C, y = j * C;
      if (!inRR(x, y, p, -1) || allowedAt(J, x, y) < 0) continue;   // köşe radyüsünün dışı ve delikler hariç
      const h = H[j * NX + i]; n++; sum += h; if (h <= floorN + DEPTH_TOL) clean++;
    }
    const depth = n ? top - sum / n : 0;
    add(g, 'Cep derinliği', p.depth.toFixed(2) + ' ±' + DEPTH_TOL, depth.toFixed(3), Math.abs(depth - p.depth) <= DEPTH_TOL, dev(Math.abs(depth - p.depth), DEPTH_TOL), 2);
    add(g, 'Taban temizliği', '≥ %98', '%' + (n ? clean / n * 100 : 0).toFixed(1), n && clean / n >= 0.98, n ? clean / n / 0.98 : 0);
    // Kenarlar: cep ekseni boyunca derinliğin yarısını geçen hücre koşusu
    const span = (fixed, alongX) => {
      const c0 = Math.round((alongX ? (p.x0 + p.x1) : (p.y0 + p.y1)) / 2 / C), f = Math.round(fixed / C);
      const at = q => alongX ? H[f * NX + q] : H[q * NX + f];
      const lim = alongX ? NX - 1 : NY - 1;
      if (at(c0) >= thr) return null;
      let a = c0, b = c0;
      while (a > 0 && at(a - 1) < thr) a--;
      while (b < lim && at(b + 1) < thr) b++;
      // duvar: son kesik hücrenin ötesindeki dolu hücreye takım kenarının ne kadar yaklaştığı (bilgi yoksa yarım hücre)
      const ed = q => { const k = alongX ? f * NX + q : q * NX + f, e = EDGE[k]; return e <= C + 0.01 ? Math.min(e, C) : C / 2; };
      return [a > 0 ? (a - 1) * C + ed(a - 1) : a * C, b < lim ? (b + 1) * C - ed(b + 1) : b * C];
    };
    const runs = (alongX) => {
      const fs = alongX ? [p.y0 + (p.y1 - p.y0) / 3, p.y0 + (p.y1 - p.y0) * 2 / 3] : [p.x0 + (p.x1 - p.x0) / 3, p.x0 + (p.x1 - p.x0) * 2 / 3];
      const r = fs.map(f => span(f, alongX)).filter(Boolean);
      if (!r.length) return null;
      const a = r.reduce((s, q) => s + q[0], 0) / r.length, b = r.reduce((s, q) => s + q[1], 0) / r.length;
      return { w: b - a, c: (a + b) / 2 };
    };
    const rx = runs(true), ry = runs(false);
    const wN = p.x1 - p.x0, hN = p.y1 - p.y0;
    if (!rx || !ry) {
      ['Genişlik X', 'Genişlik Y', 'Cep konumu'].forEach(l => add(g, l, '', 'yok', false, 0, l === 'Cep konumu' ? 2 : 1));
      return;
    }
    const mx = rx.w, my = ry.w, tl = SIZE_TOL;
    add(g, 'Genişlik X', wN.toFixed(2) + ' ±' + SIZE_TOL, mx.toFixed(2), Math.abs(mx - wN) <= tl, dev(Math.abs(mx - wN), tl));
    add(g, 'Genişlik Y', hN.toFixed(2) + ' ±' + SIZE_TOL, my.toFixed(2), Math.abs(my - hN) <= tl, dev(Math.abs(my - hN), tl));
    const pd = Math.hypot(rx.c - (p.x0 + p.x1) / 2, ry.c - (p.y0 + p.y1) / 2);
    add(g, 'Cep konumu', `(${(p.x0 + p.x1) / 2}, ${(p.y0 + p.y1) / 2}) ±${SIZE_TOL}`, `(${rx.c.toFixed(2)}, ${ry.c.toFixed(2)})`, pd <= SIZE_TOL, dev(pd, SIZE_TOL), 2);
  });
  J.holes.forEach((h, idx) => {
    const g = 'D' + (idx + 1), lt = localTop(J, h.x, h.y), R = h.d / 2 + 3;
    let n = 0, sx = 0, sy = 0; const votes = {};
    for (let j = Math.max(0, Math.floor((h.y - R) / C)); j <= Math.min(NY - 1, Math.ceil((h.y + R) / C)); j++)
      for (let i = Math.max(0, Math.floor((h.x - R) / C)); i <= Math.min(NX - 1, Math.ceil((h.x + R) / C)); i++) {
        const x = i * C, y = j * C, k = j * NX + i;
        if (Math.hypot(x - h.x, y - h.y) > R || H[k] >= lt - 0.5) continue;
        n++; sx += x; sy += y; votes[CUT[k]] = (votes[CUT[k]] || 0) + 1;
      }
    if (n < 4) { add(g, 'Konum', `(${h.x}, ${h.y})`, 'yok', false, 0, 2); add(g, 'Çap', 'Ø' + h.d, 'yok', false, 0); add(g, 'Boydan boya', 'evet', 'yok', false, 0); return; }
    const cx = sx / n, cy = sy / n, pd = Math.hypot(cx - h.x, cy - h.y);
    add(g, 'Konum', `(${h.x.toFixed(2)}, ${h.y.toFixed(2)}) ±${HOLE_TOL}`, `(${cx.toFixed(2)}, ${cy.toFixed(2)})`, pd <= HOLE_TOL, dev(pd, HOLE_TOL), 2);
    const best = +Object.keys(votes).sort((a, b) => votes[b] - votes[a])[0];
    const T = TOOLS[best - 1];
    const okD = T && isDrill(T) && T.type === 'drill' && Math.abs(T.d - h.d) < 0.01;
    add(g, 'Çap', 'Ø' + h.d, T ? `Ø${T.d} (${T.no})` : '?', okD, okD ? 1 : 0);
    let inner = 0, thru = 0; const ri = Math.max(0.6, h.d / 2 - 0.6);
    for (let j = Math.floor((cy - ri) / C); j <= Math.ceil((cy + ri) / C); j++) for (let i = Math.floor((cx - ri) / C); i <= Math.ceil((cx + ri) / C); i++) {
      if (i < 0 || j < 0 || i >= NX || j >= NY || Math.hypot(i * C - cx, j * C - cy) > ri) continue;
      inner++; if (H[j * NX + i] <= 0.05) thru++;
    }
    const tf = inner ? thru / inner : 0;
    add(g, 'Boydan boya', '%100 açık', '%' + (tf * 100).toFixed(0), tf >= 0.9, tf);
  });
  (J.arcs || []).forEach((A, idx) => {
    const g = 'Y' + (idx + 1), floorN = top - A.depth, thr = top - A.depth / 2;
    let n = 0, sum = 0, clean = 0;
    for (let a = A.a0 + 4; a <= A.a1 - 4; a += 1) for (const dr of [-A.w / 4, 0, A.w / 4]) {
      const x = A.cx + Math.cos(a * Math.PI / 180) * (A.r + dr), y = A.cy + Math.sin(a * Math.PI / 180) * (A.r + dr);
      const i = Math.round(x / C), j = Math.round(y / C);
      if (i < 0 || j < 0 || i >= NX || j >= NY || allowedAt(J, x, y) < 0) continue;
      const h = H[j * NX + i]; n++; sum += h; if (Math.abs(h - floorN) <= DEPTH_TOL) clean++;
    }
    const depth = n ? top - sum / n : 0;
    add(g, 'Kanal derinliği', A.depth.toFixed(2) + ' ±' + DEPTH_TOL, depth.toFixed(3), Math.abs(depth - A.depth) <= DEPTH_TOL, dev(Math.abs(depth - A.depth), DEPTH_TOL), 2);
    add(g, 'Kanal tabanı', '≥ %95', '%' + (n ? clean / n * 100 : 0).toFixed(1), n && clean / n >= 0.95, n ? clean / n / 0.95 : 0);
    const ws = [], rs = [];
    for (const f of [0.25, 0.5, 0.75]) {                          // üç açıda radyal tarama: genişlik ve yarıçap
      const a = (A.a0 + (A.a1 - A.a0) * f) * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a);
      // çift doğrusal örnekleme, 0.05 mm adım: yay boyunca takım merkezi ızgaraya hizalı olmadığından eşik geçişi gerçek kenarı ortalamada doğru verir
      const at = rr => {
        const fx = (A.cx + ca * rr) / C, fy = (A.cy + sa * rr) / C, i = Math.floor(fx), j = Math.floor(fy), u = fx - i, w = fy - j;
        if (i < 0 || j < 0 || i >= NX - 1 || j >= NY - 1) return top;
        const k = j * NX + i;
        return (H[k] * (1 - u) + H[k + 1] * u) * (1 - w) + (H[k + NX] * (1 - u) + H[k + NX + 1] * u) * w;
      };
      if (at(A.r) >= thr) continue;
      let r0 = A.r, r1 = A.r;
      while (r0 > 0 && at(r0 - 0.05) < thr) r0 -= 0.05;
      while (r1 < A.r + 80 && at(r1 + 0.05) < thr) r1 += 0.05;
      ws.push(r1 - r0); rs.push((r0 + r1) / 2);
    }
    if (!ws.length) { add(g, 'Kanal genişliği', A.w.toFixed(2), 'yok', false, 0); add(g, 'Kanal yarıçapı', 'R' + A.r, 'yok', false, 0, 2); return; }
    const wm = ws.reduce((a, b) => a + b) / ws.length, rm = rs.reduce((a, b) => a + b) / rs.length;
    add(g, 'Kanal genişliği', A.w.toFixed(2) + ' ±' + SIZE_TOL, wm.toFixed(2), Math.abs(wm - A.w) <= SIZE_TOL, dev(Math.abs(wm - A.w), SIZE_TOL));
    add(g, 'Kanal yarıçapı', 'R' + A.r.toFixed(2) + ' ±' + SIZE_TOL, 'R' + rm.toFixed(2), Math.abs(rm - A.r) <= SIZE_TOL, dev(Math.abs(rm - A.r), SIZE_TOL), 2);
  });
  if (J.deck) {                                                    // silindir kapağı: conta yüzü
    let n = 0, cut = 0, sum = 0, mn = 1e9, mx = -1e9;
    for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
      const x = i * C, y = j * C;
      if (J._P.Sf(x, y) !== (J.deck.sf ?? app.SF.old) || J._P.H(x, y) < J.deck.base) continue;
      const k = j * NX + i, h = H[k]; n++; if (CUT[k]) cut++; sum += h; if (h < mn) mn = h; if (h > mx) mx = h;
    }
    const cov = n ? cut / n : 0, mean = n ? sum / n : 0, flat = mx - mn, take = J.deck.top0 - mean;
    add('Conta yüzü', 'Temizlenen alan', '≥ %98', '%' + (cov * 100).toFixed(1), cov >= 0.98, cov / 0.98, 2);
    add('Conta yüzü', 'Düzlemsellik', '≤ ' + J.deck.flat.toFixed(2), flat.toFixed(3), flat <= J.deck.flat, dev(flat, J.deck.flat), 2);
    add('Conta yüzü', 'Alınan talaş', '≤ ' + J.deck.maxCut.toFixed(2), take.toFixed(3), take <= J.deck.maxCut, take <= J.deck.maxCut ? 1 : Math.max(0, 1 - (take - J.deck.maxCut) / 0.3), 2);
  }
  for (const L of J.levels || []) {                                // döküm flanş: alın ve göbek seviyeleri
    const g = J._P.geo; let n = 0, cut = 0, sum = 0;
    for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
      const x = i * C, y = j * C, r = Math.hypot(x - g.c, y - g.c);
      if (r < (L.rmin || 0) || r > L.rmax || allowedAt(J, x, y) < 0 || J._P.H(x, y) < 1) continue;
      const k = j * NX + i; n++; if (CUT[k]) cut++; sum += H[k];
    }
    const mean = n ? sum / n : 0, cov = n ? cut / n : 0;
    add(L.name, 'Yükseklik', L.z.toFixed(2) + ' ±' + L.tol, mean.toFixed(3), Math.abs(mean - L.z) <= L.tol, dev(Math.abs(mean - L.z), L.tol), 2);
    add(L.name, 'Temizlenen alan', '≥ %97', '%' + (cov * 100).toFixed(1), cov >= 0.97, cov / 0.97);
  }
  (J.pads || []).forEach((q, idx) => {                             // yatak gövdesi: ayak pedleri aynı yükseklikte
    let n = 0, cut = 0, sum = 0;
    for (let j = Math.ceil((q.y0 + 1) / C); j <= Math.floor((q.y1 - 1) / C); j++) for (let i = Math.ceil((q.x0 + 1) / C); i <= Math.floor((q.x1 - 1) / C); i++) {
      if (allowedAt(J, i * C, j * C) < 0) continue;
      const k = j * NX + i; n++; if (CUT[k]) cut++; sum += H[k];
    }
    const mean = n ? sum / n : 0, cov = n ? cut / n : 0, nm = 'Ayak ' + (idx + 1);
    add(nm, 'Ped yüksekliği', q.z.toFixed(2) + ' ±' + q.tol, mean.toFixed(3), Math.abs(mean - q.z) <= q.tol, dev(Math.abs(mean - q.z), q.tol), 2);
    add(nm, 'Temizlenen alan', '≥ %97', '%' + (cov * 100).toFixed(1), cov >= 0.97, cov / 0.97);
  });
  if (J.flush) {                                                   // kaynaklı plaka: dikiş yüzeyle sıfır
    let n = 0, hi = 0, mx = -1e9;
    for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
      const x = i * C, y = j * C; if (J._P.Sf(x, y) !== app.SF.weld) continue;
      const h = H[j * NX + i]; n++; if (h > J.flush.top + J.flush.tol) hi++; if (h > mx) mx = h;
    }
    const ok = n ? 1 - hi / n : 0;
    add('Kaynak dikişi', 'Sıfırlanan dikiş', '%100', '%' + (ok * 100).toFixed(1), ok >= 0.995, ok, 2);
    add('Kaynak dikişi', 'En yüksek nokta', (J.flush.top).toFixed(2) + ' +' + J.flush.tol, mx.toFixed(3), mx <= J.flush.top + J.flush.tol, dev(Math.max(0, mx - J.flush.top), J.flush.tol), 2);
  }
  // Resim dışı kesilmiş bölgeler
  let gouge = 0;
  INSP.fill(0);
  for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
    const k = j * NX + i;
    if (H[k] < allowedAt(J, i * C, j * C) - 0.17) { INSP[k] = 1; gouge++; }
  }
  markDirty(0, NX - 1, 0, NY - 1);
  const ga = gouge * C * C;
  add('Genel', 'Fazla kesilmiş alan', '0 mm²', ga.toFixed(1) + ' mm²', ga < 1, ga < 1 ? 1 : Math.max(0, 1 - ga / 80), 2);
  return items;
}

function scoreJob(J, run, items) {
  const wsum = items.reduce((s, i) => s + i.w, 0);
  const acc = items.reduce((s, i) => s + i.w * i.sc, 0) / wsum;
  const accPts = 70 * acc;
  const timePts = 15 * clamp(1 - (run.time - J.target) / (1.5 * J.target), 0, 1);
  const st = run.stats;
  const carePts = clamp(15 - 6 * st.breaks - 1 * st.load - 3 * st.spot - 2 * st.peck - 1 * st.rub, 0, 15);
  const total = Math.round(accPts + timePts + carePts);
  const allOk = items.every(i => i.ok);
  // Tolerans dışı ölçüsü olan parça en fazla 1 yıldız alır (şartlı kabul)
  const stars = allOk ? (total >= 90 ? 3 : total >= 75 ? 2 : total >= 55 ? 1 : 0) : (total >= 60 ? 1 : 0);
  return { accPts, timePts, carePts, total, stars, allOk };
}

/* -- Arayüz -- */
const mmss = t => { t = Math.max(0, Math.floor(t)); return String(Math.floor(t / 60)).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0'); };
let selJob = -1;
const setSelJob = i => { selJob = i; };
function renderJobs() {
  const L = $('jobList'); L.innerHTML = '';
  JOBS.forEach((J, i) => {
    const b = document.createElement('button');
    const st = bestStars(i), lock = !unlocked(i);
    b.disabled = lock; b.classList.toggle('active', i === selJob);
    b.innerHTML = `<span class="jn">${i + 1}</span><span class="jt">${J.title}</span><span class="js">${lock ? '<i>kilitli</i>' : '★'.repeat(st) + '<i>' + '★'.repeat(3 - st) + '</i>'}</span>`;
    b.addEventListener('click', () => selectJob(i));
    L.append(b);
  });
  const f = document.createElement('button');
  f.className = 'free' + (selJob < 0 ? ' active' : '');
  f.innerHTML = '<span class="jn">∞</span><span class="jt">Serbest çalışma</span><span class="js"><i>puan yok</i></span>';
  f.addEventListener('click', () => selectJob(-1));
  L.append(f);
  const tot = JOBS.reduce((s, J, i) => s + bestStars(i), 0);
  if (!app.CR.on) $('starTotal').textContent = `${tot} / ${JOBS.length * 3} yıldız`;
}
function selectJob(i) {
  selJob = i;
  const J = JOBS[i];
  if (S.job && S.job.idx !== i) S.job = null;
  renderJobs();
  $('jcBtns').hidden = !J; $('vDraw').hidden = !J;
  if (!J) {
    $('jcNo').textContent = app.CR.on ? 'KARİYER' : 'SERBEST'; $('jcTitle').textContent = app.CR.on ? 'Sipariş seçin' : 'Serbest çalışma';
    $('jcBrief').textContent = app.CR.on ? 'Panodan bir sipariş seçin: teknik resim açılır, "İşe başla" ile ham parça kasadan alınır ve mengeneye bağlanır. Teslimde parça ölçülür, müşteri ödemeyi yapar.'
      : 'İş emri seçmeden tezgâhı serbestçe kullanın. Bir iş seçerseniz teknik resim açılır, teslimde parça ölçülür ve puanlanır.';
    $('jcMeta').innerHTML = ''; $('drawing').hidden = true; buildScribe(null); S.job = null;
    return;
  }
  $('jcNo').textContent = 'İŞ ' + (i + 1); $('jcTitle').textContent = J.title; $('jcBrief').textContent = J.brief;
  const best = progress['j' + i];
  $('jcMeta').innerHTML = `<span>Hedef süre <b>${mmss(J.target)}</b></span><span>En iyi <b>${best ? best.score : '—'}</b></span>`;
  $('dwTitle').textContent = `TEKNİK RESİM · İŞ ${i + 1} · ${J.title.toLocaleUpperCase('tr')}`;
  $('dwSvg').innerHTML = drawingSVG(J);
  $('dwTable').innerHTML = drawingTable(J);
  $('drawing').hidden = window.innerWidth < 900;
  buildScribe(J);
  $('jobStart').textContent = S.job && !S.job.done ? 'Yeniden başla' : 'İşe başla';
}
function startJob() {
  initAudio();
  if (app.CR.on) { app.CR.start(); return; }
  if (selJob < 0) return;
  if (JOBS[selJob].rot && FIX !== 'rot') app.setFix('rot', true);
  else if (FIX === 'div') app.setFix('vise', true);
  if (PW !== 150 || PD !== 100 || PH !== 40) app.setStock(150, 100, 40, true);   // iş emirleri standart ham parçayla
  resetPart(JOBS[selJob].mat || 'al');
  S.job = { idx:selJob, J:JOBS[selJob], time:0, done:false, stats:{ breaks:0, load:0, spot:0, peck:0, rub:0 } };
  setTimeout(() => warnParallels(JOBS[selJob] || S.job.J), 300);
  $('report').hidden = true;
  $('jobStart').textContent = 'Yeniden başla';
  log(`İş ${selJob + 1} başladı: ${JOBS[selJob].title}. Yeni ham parça bağlandı, makine süresi işliyor.`, 'ok');
}
function submitJob() {
  if (!S.job || S.job.done) { log('Önce "İşe başla" ile işi başlatın.', 'warn'); return; }
  if (S.loose) { log('Parça tabladan koptu, hurda oldu. İşi yeniden başlatın.', 'warn'); return; }
  if (S.spindle) { log('Parçayı teslim etmeden önce mili durdurun.', 'warn'); return; }
  const run = S.job, J = run.J;
  const items = inspect(J);
  const r = scoreJob(J, run, items);
  run.done = true;
  if (run.order) {
    const res = app.CR.settle(run, r);
    showReport(run, items, r, false);
    showPayout(res);
    $('rpVerdict').textContent = res.txt; $('rpVerdict').style.color = r.allOk ? 'var(--ok)' : r.stars ? 'var(--warn)' : 'var(--bad)';
    $('rpRetry').hidden = !app.CR.sel;   // hurda ya da seri iş: sipariş panoda
    $('rpRetry').textContent = app.CR.sel && app.CR.sel.qty && app.CR.sel.doneQty && res.pay > 0 ? 'Sıradaki adet' : 'Tekrar dene';
  } else {
    const key = 'j' + run.idx, prev = progress[key];
    const record = !prev || r.total > prev.score;
    if (record) progress[key] = { score:r.total, stars:Math.max(r.stars, prev ? prev.stars : 0) };
    else if (r.stars > prev.stars) progress[key].stars = r.stars;
    saveProgress();
    showReport(run, items, r, record && !!prev);
    $('rpRetry').hidden = false;
    renderJobs(); selectJob(run.idx);
  }
  // kutlama: yıldız başına altın kıvılcım
  const cx = 75 - S.px, cz = -50 + S.py, cy = jobTop(J) + 2;
  if (r.stars) for (let s = 0; s < r.stars; s++) setTimeout(() => { burst('gold', 110, cx, cy, cz, 260, 900, 1.8); beep(1200 + s * 300); }, 250 + s * 250);
  else burst('smoke', 30, cx, cy, cz, 60, 80, 2.2);
  if (r.allOk) setTimeout(() => app.FW.show(r.stars), 700);           // kabul edilen parça: havai fişek
}
const STAR = '<svg viewBox="0 0 24 24"><path d="M12 2.6l2.9 6 6.5.8-4.8 4.5 1.2 6.5L12 17.3l-5.8 3.1 1.2-6.5L2.6 9.4l6.5-.8z" stroke-width="1.4" stroke-linejoin="round"/></svg>';
function showReport(run, items, r, newBest) {
  $('rpJob').textContent = `${run.order ? 'SİPARİŞ #' + run.order.id : 'İŞ ' + (run.idx + 1)} · ${run.J.title.toLocaleUpperCase('tr')} · MAKİNE SÜRESİ ${mmss(run.time)}`;
  $('rpTitle').textContent = r.stars === 3 ? 'Kusursuz parça' : r.allOk ? 'Parça kabul edildi' : r.stars ? 'Şartlı kabul: tolerans dışı ölçü var' : 'Parça hurdaya ayrıldı';
  $('rpStars').innerHTML = [0, 1, 2].map(i => STAR.replace('<svg', `<svg class="${i < r.stars ? 'on' : 'off'}"`)).join('');
  $('rpTotal').textContent = r.total;
  $('rpVerdict').textContent = newBest ? 'YENİ REKOR' : '';
  $('rpVerdict').style.color = 'var(--safety)';
  const bar = (name, v, max) => `<div class="rp-bar"><span>${name}</span><div class="meter"><i style="width:${v / max * 100}%;background:${v / max > 0.8 ? 'var(--ok)' : v / max > 0.5 ? 'var(--warn)' : 'var(--bad)'}"></i></div><span>${Math.round(v)} / ${max}</span></div>`;
  const st = run.stats;
  $('rpBars').innerHTML = bar('Ölçü doğruluğu', r.accPts, 70) + bar('Süre', r.timePts, 15) + bar('Takım bakımı', r.carePts, 15) +
    `<div class="dro-note">Süre: ${mmss(run.time)} (hedef ${mmss(run.J.target)}) · kırılan takım ${st.breaks} · aşırı yük uyarısı ${st.load} · puntasız delme ${st.spot} · gagalama uyarısı ${st.peck} · sürtünme ${st.rub}</div>`;
  $('rpTable').innerHTML = '<tr><th></th><th>Ölçü</th><th>İstenen</th><th>Ölçülen</th><th></th></tr>' +
    items.map(i => `<tr><td>${i.grp}</td><td>${i.label}</td><td class="num">${i.nom}</td><td class="num">${i.meas}</td><td class="${i.ok ? 'ok-t' : 'bad-t'}">${i.ok ? '✓' : '✗'}</td></tr>`).join('');
  const hasNext = !run.order && run.idx + 1 < JOBS.length && unlocked(run.idx + 1);
  $('rpNext').hidden = !hasNext;
  // özet: tolerans dışı ölçüler tek cümlede, ayrıntılar "Detayları gör"de
  const bad = items.filter(i => !i.ok);
  $('rpSum').textContent = !bad.length ? 'Bütün ölçüler tolerans içinde.' : `${bad.length} ölçü tolerans dışında: ${bad.slice(0, 4).map(i => `${i.grp} ${i.label.toLocaleLowerCase('tr')}`).join(', ')}${bad.length > 4 ? '…' : ''}.`;
  $('rpHero').classList.toggle('two', !run.order);
  if (!run.order) {
    $('rpHero').innerHTML = `<div class="rp-card big ${r.allOk ? 'gold' : r.stars ? '' : 'bad'}"><span>Puan</span><b>${r.total}</b><small>/ 100</small></div>` +
      `<div class="rp-card"><span>Süre</span><b>${mmss(run.time)}</b><small>hedef ${mmss(run.J.target)}</small></div>`;
    $('rpTags').innerHTML = newBest ? '<span class="rp-tag gold">YENİ REKOR</span>' : '';
  }
  $('rpDetail').hidden = true; $('rpMore').setAttribute('aria-expanded', 'false');
  $('report').hidden = false;
}
// kariyer teslimi: kazanç, itibar ve kasa büyük; primler etiket
function showPayout(res) {
  $('rpHero').innerHTML = `<div class="rp-card big ${res.pay > 0 ? 'good' : 'bad'}"><span>Kazanç</span><b>${res.pay > 0 ? '+' : ''}${res.pay.toLocaleString('tr-TR')} ₺</b><small>${res.pay > 0 ? 'müşteri ödedi' : res.pay < 0 ? 'parça bedeli ödendi' : 'ödeme yok'}</small></div>` +
    `<div class="rp-card ${res.rep > 0 ? 'good' : res.rep < 0 ? 'bad' : ''}"><span>İtibar</span><b>${res.rep > 0 ? '+' : ''}${res.rep}</b><small>toplam ${res.repTotal}</small></div>` +
    `<div class="rp-card"><span>Kasa</span><b>${Math.round(res.money).toLocaleString('tr-TR')}</b><small>₺</small></div>`;
  $('rpTags').innerHTML = res.tags.map(([t, c]) => `<span class="rp-tag ${c}">${t}</span>`).join('');
}
$('rpMore').addEventListener('click', () => { const open = $('rpDetail').hidden; $('rpDetail').hidden = !open; $('rpMore').setAttribute('aria-expanded', String(open)); $('rpMore').firstChild.textContent = open ? 'Detayları gizle ' : 'Detayları gör '; });
$('rpClose').addEventListener('click', () => { $('report').hidden = true; app.FW.stop(); });

/* ---------------- Havai fişek: başarılı teslimde ekranın üstünde patlar ----------------
   Yıldız sayısı gösteriyi büyütür; 2B tuval, olayı bitince kendini kapatır. Patlama sesi süzülmüş gürültü + kısa çıtırtı. */

export { JOBS, buildScribe, drawingSVG, drawingTable, inRect, mmss, renderJobs, selJob, selectJob, setSelJob,
  startJob, submitJob };
