// ── Atölye donanımı: arka plandaki makineler ve eşyalar (sütunlu matkap, taş motoru, kompresör, malzeme rafı, paletler, variller),
// pencereler, tavan vinci, elektrik panosu, tabelalar ve duvar saati. Yalnızca görünüm; çarpışma ve oyun mantığına girmez.
import { TAU } from './00-temel.js';
import { FLOOR_Y, M, MX, addSurface, cyl, rbox, renderer, scene, smat } from './02-sahne-tezgah.js';
import { table } from './03-tabla-parca.js';

const F = FLOOR_Y;
const WALL_Z = -1600, WALL_X = -3360;   // arka duvarın ve sol duvarın iç yüzü

// boyalı makine ve eşya malzemeleri: renk bizden, aşınma detayı tezgâh boyasının dokusundan
function paint(hex, rough = 0.8, metal = 0.08, o) {
  const m = smat(hex, rough, metal, 0.25);
  addSurface(m, 'green_metal_rust', Object.assign({ mSc:0.08, mAmt:0.05, sc:1 / 700, alb:0, mean:0.063, rough:0.7, nStr:0.6, det:0.5 }, o));
  return m;
}
const P = {
  grey: paint(0x6d7478), blue: paint(0x3b5a7a), red: paint(0xa3261d), yellow: paint(0xe0a92a, 0.7),
  orange: paint(0xd0611d, 0.7), dark: paint(0x2d3236, 0.7, 0.2),
};
const steelBar = smat(0x8d9499, 0.42, 0.85, 0.6), aluBar = smat(0xc4c9cc, 0.3, 0.9, 0.7), brass = smat(0xc8a252, 0.35, 0.9, 0.6);
const blackBar = smat(0x2a2c2e, 0.6, 0.6, 0.3);          // haddeden çıkmış, tufallı çelik
// çubuklara metal yüzey detayı (çizik, leke, tufal): tezgâh boyası dokusunun açık-koyu deseni, ince ölçekte
for (const [m, det, rough, n] of [[steelBar, 0.7, 0.4, 0.35], [blackBar, 1, 0.6, 0.6], [aluBar, 0.35, 0.3, 0.2], [brass, 0.5, 0.35, 0.25]])
  addSurface(m, 'green_metal_rust', { mSc:0.05, mAmt:0.04, sc:1 / 300, alb:0, mean:0.063, rough, nStr:n, det });
const rackPaint = paint(0x3b5a7a, 0.75, 0.1, { det:1, nStr:1, rough:0.8, sc:1 / 500 });   // malzeme rafı: belirgin aşınma
const extRed = paint(0xb3221a, 0.45, 0.1, { det:0.9, nStr:0.8, rough:0.5, sc:1 / 400 });   // yangın tüpü
const wood = smat(0x9a7a52, 0.9, 0, 0.1), woodDark = smat(0x6b5236, 0.9, 0, 0.1);
const add = (m, x, y, z) => { m.position.set(x, y, z); scene.add(m); return m; };

/* ---- Hazır modeller (assets/model, Poly Haven CC0, glTF; metre → mm) ----
   Sayfa açıldıktan sonra arka planda yüklenir; yüklenemezse (file://) yeri boş kalır, oyun etkilenmez.
   x, z: taban ortası; y: tabanın oturduğu yükseklik; ry: Y ekseninde dönüş; wallZ verilirse arkası o duvara dayanır;
   on: başka bir modelin sözü (Promise) verilirse model onun (x, z) noktasındaki gerçek yüzeyine oturur (aşağı ışın);
   fromY: ışının başladığı yükseklik (rafın alt katı için üst katın hemen altı); topY: üstü bu yüksekliğe asılır (tavan).
   Aynı model bir kez indirilir, sonraki kullanımlar kopyadır (geometri ve doku paylaşılır). */
const gltf = new THREE.GLTFLoader(), ray = new THREE.Raycaster(), gltfCache = {};
function model(id, { x, z, y = F, ry = 0, wallZ, env = 0.6, on, fromY = F + 5000, topY }) {
  if (!gltfCache[id]) gltfCache[id] = new Promise(res => gltf.load(`assets/model/${id}/${id}.gltf`, g => res(g.scene), undefined, () => res(null)));
  const load = gltfCache[id].then(s => s && (s.parent || s.userData.used ? s.clone(true) : (s.userData.used = true, s)));
  return Promise.all([load, on]).then(([o, base]) => {
    if (!o) return null;
    o.scale.setScalar(1000); o.rotation.y = ry;
    o.traverse(c => { if (c.isMesh) { c.castShadow = c.receiveShadow = true; if (c.material) c.material.envMapIntensity = env; } });
    o.updateMatrixWorld(true);
    if (base) {   // altındaki modelin yüzeyi: aşağı ışın, ilk çarptığı nokta
      ray.set(new THREE.Vector3(x, fromY, z), new THREE.Vector3(0, -1, 0));
      const hit = ray.intersectObject(base, true)[0];
      if (hit) y = hit.point.y;
    }
    const bb = new THREE.Box3().setFromObject(o);
    const py = topY != null ? topY - bb.max.y : y - bb.min.y;
    o.position.set(x - (bb.min.x + bb.max.x) / 2, py, wallZ != null ? wallZ - bb.min.z : z - (bb.min.z + bb.max.z) / 2);
    scene.add(o); o.updateMatrixWorld(true);
    return o;
  });
}
// sol arka: takım arabası ve üstünde takım sandığı; sağ arka: çalışma tezgâhında masa matkabı ve tezgâh mengenesi, önünde tabure
const cart = model('tool_cart', { x:-1250, z:-1200 });
model('metal_tool_chest', { x:-1400, z:-1230, on:cart });
model('drill_press_01', { x:1600, z:-1420, y:F + 880, ry:0 });
model('bench_vice_01', { x:2420, z:-1180, y:F + 880, ry:0 });
model('metal_stool_01', { x:1850, z:-750 });

// oksijen-asetilen arabası (tezgâhın solunda), kompresör (sağ ön), el arabası, ıslak zemin levhası (soğutma sıvısı)
model('portable_welding_cart', { x:950, z:-1300, ry:0.3 });
model('old_military_compressor', { x:2750, z:800, ry:Math.PI / 2 });
model('hand_truck', { x:3350, z:-900, ry:-0.6 });
model('WetFloorSign_01', { x:1200, z:450, ry:-0.4 });
// sol arka köşe: eski metal raf (dolabın yerinde) ve katlarında koli, yağ tenekesi, yağdanlık; yanında ahşap sandık
const rack = model('worn_metal_rack', { x:-2400, wallZ:WALL_Z + 10 });
const RZ = -1310;   // rafın orta derinliği (600 derin, duvara dayalı)
model('cardboard_box_01', { x:-2550, z:RZ, on:rack, fromY:F + 1150 });
model('oil_tin', { x:-2150, z:RZ, on:rack, fromY:F + 1150 });
model('small_oil_can_01', { x:-2350, z:RZ, on:rack, fromY:F + 1600, ry:0.8 });
model('cardboard_box_01', { x:-2450, z:RZ, on:rack, fromY:F + 650, ry:0.15 });
model('wooden_crate_01', { x:-2250, z:-750, ry:0.1 });
// tavan lambaları (eski floresan şeritlerin yerinde)
for (const lx of [-1200, 300, 1800]) for (const lz of [-700, 700]) model('hanging_industrial_lamp', { x:lx, z:lz, topY:2480 });

/* ---- Variller (sağda, damlama tavasında): hazır modeller ---- */
{
  rbox(2300, 3580, F, F + 60, -400, 200, 8, smat(0x31363a, 0.6, 0.5, 0.3));
  model('Barrel_01', { x:2620, z:-100, y:F + 60 });
  model('barrel_03', { x:3240, z:-100, y:F + 60, ry:0.6 });
  model('barrel_03', { x:2500, z:-760, ry:2.2 });                                    // talaş varili
}

/* ---- Malzeme rafı (sol duvar): konsol kollarda yuvarlak çubuklar, lamalar ---- */
{
  const x0 = WALL_X, ups = [-900, -100, 700], lev = [F + 380, F + 900, F + 1420];
  for (const z of ups) {
    rbox(x0, x0 + 90, F, F + 1900, z - 45, z + 45, 4, rackPaint);
    rbox(x0, x0 + 520, F, F + 60, z - 60, z + 60, 4, rackPaint);                          // ayak
    for (const y of lev) rbox(x0 + 90, x0 + 480, y - 35, y, z - 30, z + 30, 4, rackPaint);
  }
  const bar = (mat, r, len, y, xo, zc) => { const b = add(cyl(r, r, len, mat, 18), x0 + xo, y + r, zc); b.rotation.x = Math.PI / 2; return b; };
  const L0 = lev[0], L1 = lev[1], L2 = lev[2];
  [[steelBar, 25, 2200], [steelBar, 30, 2000], [blackBar, 40, 2300], [blackBar, 35, 1900], [steelBar, 20, 2100]].forEach(([m, r, l], k) => bar(m, r, l, L0, 130 + k * 70, -100 + (k % 2) * 60));
  [[aluBar, 30, 1800], [aluBar, 45, 1500], [aluBar, 20, 2000], [brass, 25, 1200], [brass, 15, 1400]].forEach(([m, r, l], k) => bar(m, r, l, L1, 130 + k * 70, -150 + k * 40));
  for (let k = 0; k < 4; k++) rbox(x0 + 120 + k * 85, x0 + 190 + k * 85, L2, L2 + 12 + k * 4, -1050, 900 - k * 150, 1, k < 2 ? blackBar : aluBar);   // lamalar
}

/* ---- Palette plakalar (sol ön) ---- */
{
  const x = -2350, z = 250;
  for (const dz of [-330, 0, 330]) rbox(x - 600, x + 600, F, F + 100, z + dz - 50, z + dz + 50, 3, woodDark);
  for (let k = 0; k < 7; k++) rbox(x - 600 + k * 190, x - 600 + k * 190 + 140, F + 100, F + 125, z - 400, z + 400, 2, wood);
  const plates = [[steelBar, 30, 1100, 700], [blackBar, 40, 1000, 650], [aluBar, 25, 900, 600], [blackBar, 20, 800, 500]];
  let y = F + 125;
  plates.forEach(([m, t, w, d], k) => { rbox(x - w / 2 + k * 20, x + w / 2 + k * 20, y, y + t, z - d / 2, z + d / 2, 2, m); y += t; });
}

/* ---- Pencereler (arka duvar, yüksekte) ---- */
{
  const glass = new THREE.MeshBasicMaterial({ color:new THREE.Color(0xcfdde6).convertSRGBToLinear() });
  const frame = smat(0x2b2f33, 0.6, 0.4, 0.3);
  for (const x of [-2300, -800, 2400]) {
    const y0 = F + 2150, y1 = F + 3050, w = 600;
    rbox(x - w - 30, x + w + 30, y0 - 30, y1 + 30, WALL_Z - 2, WALL_Z + 18, 4, frame).castShadow = false;
    rbox(x - w, x + w, y0, y1, WALL_Z + 18, WALL_Z + 20, 0, glass).castShadow = false;
    for (const t of [-0.5, 0, 0.5]) rbox(x + t * w * 2 - 10, x + t * w * 2 + 10, y0, y1, WALL_Z + 18, WALL_Z + 30, 2, frame).castShadow = false;
    rbox(x - w, x + w, (y0 + y1) / 2 - 10, (y0 + y1) / 2 + 10, WALL_Z + 18, WALL_Z + 30, 2, frame).castShadow = false;
  }
}

/* ---- Tavan vinci: duvar boyunca iki yol kirişi, sarı köprü, kanca bloğu ---- */
{
  const y = 2330;
  for (const z of [-1450, 1300]) {
    rbox(-3300, 3600, y - 60, y + 60, z - 80, z + 80, 4, P.dark).castShadow = false;
  }
  const bx = -2150, tz = 250;   // köprü sol tarafta, araba plaka paletinin üstünde
  rbox(bx - 140, bx + 140, y + 60, y + 280, -1500, 1350, 6, P.yellow).castShadow = false;
  rbox(bx - 180, bx + 180, y - 40, y + 70, tz - 160, tz + 160, 8, P.dark).castShadow = false;     // araba
  const chain = add(cyl(6, 6, 900, M.steel, 6), bx, y - 490, tz);
  chain.castShadow = false;
  rbox(bx - 70, bx + 70, y - 1080, y - 940, tz - 70, tz + 70, 12, P.yellow);                   // kanca bloğu
  const hook = new THREE.Mesh(new THREE.TorusGeometry(45, 12, 10, 24, Math.PI * 1.4), M.steel);
  add(hook, bx, y - 1150, tz).rotation.z = Math.PI * 0.8;
  // kirişte uyarı şeridi
  rbox(bx - 141, bx + 141, y + 150, y + 190, -1500, 1350, 0, P.dark).castShadow = false;
}

/* ---- Elektrik panosu ve kablo kanalı (arka duvar) ---- */
{
  const x = -480;
  model('power_box_01', { x, y:F + 1300, wallZ:WALL_Z });                                // sigorta kutusu (hazır model)
  rbox(x - 50, x + 50, F + 1800, F + 2700, WALL_Z, WALL_Z + 80, 6, P.dark).castShadow = false;
  rbox(-3300, 3500, F + 2700, F + 2760, WALL_Z, WALL_Z + 110, 4, P.dark).castShadow = false;
  for (const px of [-2000, 1400]) add(cyl(18, 18, 2100, P.dark, 10), px, F + 1650, WALL_Z + 30).castShadow = false;   // boru inişleri
}

/* ---- Yangın tüpü (sol duvar) ---- */
{
  const z = -1200;
  add(cyl(80, 80, 520, extRed, 32), WALL_X + 100, F + 640, z);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(80, 32, 12, 0, TAU, 0, Math.PI / 2), extRed);
  add(dome, WALL_X + 100, F + 900, z).scale.y = 0.45;                                    // omuz
  add(cyl(30, 40, 80, M.black, 12), WALL_X + 100, F + 955, z);
  rbox(WALL_X + 120, WALL_X + 200, F + 960, F + 990, z - 15, z + 15, 4, M.black);
  rbox(WALL_X, WALL_X + 20, F + 600, F + 700, z - 60, z + 60, 2, M.steel);
}

/* ---- Tabelalar, poster ve duvar saati: tuvale çizilir (dosya gerekmez) ---- */
function canvasPlane(w, h, px, draw) {
  const cv = document.createElement('canvas'); cv.width = px; cv.height = Math.round(px * h / w);
  const tex = new THREE.CanvasTexture(cv); tex.encoding = THREE.sRGBEncoding; tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const redraw = () => { draw(cv.getContext('2d'), cv.width, cv.height); tex.needsUpdate = true; };
  redraw();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(redraw);   // gömülü yazı tipleri yüklenince yeniden çiz
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map:tex, roughness:0.75, metalness:0 }));
  m.material.envMapIntensity = 0.2; m.receiveShadow = true;
  return { m, redraw };
}
const FONT = '"Chakra Petch", "Segoe UI", sans-serif';
// yazıyı verilen genişliğe sığacak en büyük boyutla yaz
function fitText(g, txt, x, y, maxW, size, weight) {
  g.font = `${weight} ${size}px ${FONT}`;
  const tw = g.measureText(txt).width;
  if (tw > maxW) g.font = `${weight} ${Math.floor(size * maxW / tw)}px ${FONT}`;
  g.fillText(txt, x, y);
}
function sign(g, w, h, bg, fg, title, sub, icon) {
  g.fillStyle = '#f2f0e8'; g.fillRect(0, 0, w, h);
  g.fillStyle = bg; g.fillRect(0, 0, w, h * 0.62);
  icon(g, w / 2, h * 0.31, h * 0.22);
  g.fillStyle = '#16191b'; g.textAlign = 'center'; g.textBaseline = 'middle';
  fitText(g, title, w / 2, h * 0.75, w * 0.88, Math.round(h * 0.12), 700);
  fitText(g, sub, w / 2, h * 0.88, w * 0.9, Math.round(h * 0.075), 600);
  g.strokeStyle = '#16191b'; g.lineWidth = h * 0.02; g.strokeRect(0, 0, w, h);
}
const onWall = (o, x, y) => add(o.m, x, y, WALL_Z + 6);
// koruyucu gözlük (mavi zorunluluk işareti)
onWall(canvasPlane(320, 420, 256, (g, w, h) => sign(g, w, h, '#1f5aa6', '#fff', 'GÖZLÜK TAKINIZ', 'Koruyucu gözlük zorunludur', (g, cx, cy, r) => {
  g.fillStyle = '#fff'; g.beginPath(); g.arc(cx, cy, r * 1.15, 0, TAU); g.fill();
  g.fillStyle = '#1f5aa6'; g.beginPath(); g.arc(cx, cy, r * 1.0, 0, TAU); g.fill();
  g.strokeStyle = '#fff'; g.lineWidth = r * 0.14;
  for (const s of [-1, 1]) { g.beginPath(); g.ellipse(cx + s * r * 0.42, cy, r * 0.32, r * 0.24, 0, 0, TAU); g.stroke(); }
  g.beginPath(); g.moveTo(cx - r * 0.1, cy - r * 0.05); g.lineTo(cx + r * 0.1, cy - r * 0.05); g.stroke();
})), 600, F + 1640);
// dönen takım uyarısı (sarı üçgen)
onWall(canvasPlane(320, 420, 256, (g, w, h) => sign(g, w, h, '#f0b429', '#16191b', 'DİKKAT', 'Dönen takıma dokunmayın', (g, cx, cy, r) => {
  g.fillStyle = '#16191b'; g.beginPath(); g.moveTo(cx, cy - r * 1.15); g.lineTo(cx + r * 1.3, cy + r * 1.0); g.lineTo(cx - r * 1.3, cy + r * 1.0); g.closePath(); g.fill();
  g.fillStyle = '#f0b429'; g.beginPath(); g.moveTo(cx, cy - r * 0.85); g.lineTo(cx + r * 1.02, cy + r * 0.85); g.lineTo(cx - r * 1.02, cy + r * 0.85); g.closePath(); g.fill();
  g.fillStyle = '#16191b'; g.font = `700 ${Math.round(r * 1.2)}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('!', cx, cy + r * 0.2);
})), 1000, F + 1640);
// kesme hızları posteri
onWall(canvasPlane(620, 820, 512, (g, w, h) => {
  g.fillStyle = '#efeadc'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#2b4f45'; g.fillRect(0, 0, w, h * 0.13);
  g.fillStyle = '#fff'; g.textAlign = 'left'; g.textBaseline = 'middle';
  g.font = `700 ${Math.round(h * 0.06)}px ${FONT}`; g.fillText('KESME HIZLARI', w * 0.06, h * 0.065);
  g.fillStyle = '#16191b'; g.font = `600 ${Math.round(h * 0.034)}px ${FONT}`;
  g.fillText('Malzeme', w * 0.06, h * 0.19); g.textAlign = 'right'; g.fillText('Vc HSS', w * 0.68, h * 0.19); g.fillText('Vc Karbür', w * 0.94, h * 0.19);
  const rows = [['Alüminyum', '90', '300'], ['S235 çelik', '30', '180'], ['C45 çelik', '25', '150'], ['304 paslanmaz', '15', '90'], ['Pirinç', '60', '220'], ['GG25 döküm', '20', '120'], ['Delrin / PA6', '80', '250']];
  g.font = `500 ${Math.round(h * 0.034)}px ${FONT}`;
  rows.forEach(([a, b, c], k) => {
    const y = h * (0.27 + k * 0.085);
    if (k % 2 === 0) { g.fillStyle = 'rgba(43,79,69,0.1)'; g.fillRect(w * 0.04, y - h * 0.038, w * 0.92, h * 0.076); }
    g.fillStyle = '#16191b'; g.textAlign = 'left'; g.fillText(a, w * 0.06, y);
    g.textAlign = 'right'; g.fillText(b, w * 0.68, y); g.fillText(c, w * 0.94, y);
  });
  g.font = `500 ${Math.round(h * 0.03)}px ${FONT}`; g.textAlign = 'left'; g.fillStyle = '#4a4f50';
  g.fillText('n = Vc × 1000 / (π × D)   [dev/dk]', w * 0.06, h * 0.9);
  g.strokeStyle = '#16191b'; g.lineWidth = 4; g.strokeRect(0, 0, w, h);
}), 1550, F + 1800);
// duvar saati: bilgisayarın saatini gösterir
const clock = canvasPlane(360, 360, 256, (g, w) => {
  const c = w / 2, r = w * 0.47, d = new Date(), hh = d.getHours() % 12, mm = d.getMinutes();
  g.clearRect(0, 0, w, w);
  g.fillStyle = '#202426'; g.beginPath(); g.arc(c, c, r, 0, TAU); g.fill();
  g.fillStyle = '#f4f2ea'; g.beginPath(); g.arc(c, c, r * 0.9, 0, TAU); g.fill();
  g.strokeStyle = '#202426';
  for (let k = 0; k < 60; k++) { const a = k / 60 * TAU, l = k % 5 ? 0.06 : 0.14; g.lineWidth = k % 5 ? 2 : 5;
    g.beginPath(); g.moveTo(c + Math.sin(a) * r * 0.85, c - Math.cos(a) * r * 0.85); g.lineTo(c + Math.sin(a) * r * (0.85 - l), c - Math.cos(a) * r * (0.85 - l)); g.stroke(); }
  const hand = (a, l, wd) => { g.lineWidth = wd; g.lineCap = 'round'; g.beginPath(); g.moveTo(c, c); g.lineTo(c + Math.sin(a) * r * l, c - Math.cos(a) * r * l); g.stroke(); };
  hand((hh + mm / 60) / 12 * TAU, 0.5, 9); hand(mm / 60 * TAU, 0.75, 6);
  g.fillStyle = '#202426'; g.beginPath(); g.arc(c, c, 8, 0, TAU); g.fill();
});
clock.m.material.transparent = true;
onWall(clock, 700, F + 2350);
setInterval(clock.redraw, 30000);
// yangın tüpü tabelası (sol duvar)
{
  const t = canvasPlane(260, 260, 128, (g, w, h) => {
    g.fillStyle = '#c0261d'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = `700 ${Math.round(h * 0.17)}px ${FONT}`; g.fillText('YANGIN', w / 2, h * 0.38); g.fillText('TÜPÜ', w / 2, h * 0.62);
  });
  add(t.m, WALL_X + 3, F + 1250, -1200).rotation.y = Math.PI / 2;
  // tüpün üstündeki kıvrık etiket (odaya, +X yönüne bakar)
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 320;
  const tex = new THREE.CanvasTexture(cv); tex.encoding = THREE.sRGBEncoding;
  const draw = () => {
    const g = cv.getContext('2d'), w = cv.width, h = cv.height;
    g.fillStyle = '#f1efe6'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#b3221a'; g.fillRect(0, 0, w, h * 0.2);
    g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle'; fitText(g, 'YANGIN SÖNDÜRÜCÜ', w / 2, h * 0.1, w * 0.9, 30, 700);
    g.fillStyle = '#16191b'; fitText(g, 'ABC', w / 2, h * 0.36, w * 0.8, 74, 700);
    fitText(g, 'KURU KİMYEVİ TOZ', w / 2, h * 0.54, w * 0.9, 28, 600);
    fitText(g, '6 kg', w / 2, h * 0.68, w * 0.8, 40, 700);
    g.fillStyle = '#4a4f50'; fitText(g, 'Pimi çek · Hortumu yönelt · Bas', w / 2, h * 0.86, w * 0.92, 18, 500);
  };
  draw(); if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { draw(); tex.needsUpdate = true; });
  const lab = new THREE.Mesh(new THREE.CylinderGeometry(81, 81, 240, 24, 1, true, Math.PI / 2 - 0.85, 1.7),
    new THREE.MeshStandardMaterial({ map:tex, roughness:0.6, metalness:0 }));
  lab.material.envMapIntensity = 0.3;
  add(lab, WALL_X + 100, F + 620, -1200);
}

/* ---- Tezgâhın üstündeki plakalar, etiketler, yağ lekeleri ve yağlama nipelleri ----
   Çıkartma (decal): yüzeyin 0.3 mm önünde tuval dokulu düzlem; polygonOffset ile yüzeye gömülmez, saydam kenarlı olabilir. */
function decal(w, h, px, draw, { metal = 0, rough = 0.6, transparent = false } = {}) {
  const o = canvasPlane(w, h, px, draw);
  Object.assign(o.m.material, { metalness:metal, roughness:rough, transparent, polygonOffset:true, polygonOffsetFactor:-2, polygonOffsetUnits:-2 });
  o.m.material.envMapIntensity = metal ? 0.8 : 0.3;
  o.m.castShadow = false; return o.m;
}
const place = (m, x, y, z, ry = 0, rx = 0, parent = scene) => { m.position.set(x, y, z); m.rotation.set(rx, ry, 0); parent.add(m); return m; };
// fırçalanmış alüminyum zemin ve vida delikleri (plakalar için ortak)
function plate(g, w, h) {
  const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#c9ccc9'); gr.addColorStop(0.5, '#e4e6e2'); gr.addColorStop(1, '#b8bbb8');
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
  g.globalAlpha = 0.08; g.fillStyle = '#000';
  for (let y = 0; y < h; y += 2) g.fillRect(0, y, w, Math.random() < 0.5 ? 1 : 0);   // fırça izleri
  g.globalAlpha = 1; g.strokeStyle = '#33383a'; g.lineWidth = Math.max(2, h * 0.025); g.strokeRect(g.lineWidth / 2, g.lineWidth / 2, w - g.lineWidth, h - g.lineWidth);
  g.fillStyle = '#6d7275';
  for (const [x, y] of [[0.05, 0.12], [0.95, 0.12], [0.05, 0.88], [0.95, 0.88]]) { g.beginPath(); g.arc(w * x, h * y, h * 0.045, 0, TAU); g.fill(); }
}
// SNOOP3000 isim plakası: kayış muhafazasının önü (z = 72)
place(decal(150, 52, 512, (g, w, h) => {
  plate(g, w, h);
  g.fillStyle = '#b3261e'; g.fillRect(w * 0.08, h * 0.2, w * 0.06, h * 0.6);
  g.fillStyle = '#1d2124'; g.textAlign = 'left'; g.textBaseline = 'middle';
  fitText(g, 'SNOOP3000', w * 0.17, h * 0.44, w * 0.76, Math.round(h * 0.42), 700);
  g.fillStyle = '#4a4f50'; fitText(g, 'KONSOLLU DİK FREZE · MADE IN TÜRKİYE', w * 0.17, h * 0.76, w * 0.76, Math.round(h * 0.13), 600);
}, { metal:0.7, rough:0.35 }), 0, 515, 72.3);
// devir tablosu: kafanın sağ yanı (x = 112)
place(decal(120, 80, 384, (g, w, h) => {
  plate(g, w, h);
  g.fillStyle = '#1d2124'; g.textAlign = 'center'; g.textBaseline = 'middle';
  fitText(g, 'DEVİR · dev/dk', w / 2, h * 0.18, w * 0.8, Math.round(h * 0.13), 700);
  const rows = [['YÜKSEK', '660 – 4200'], ['DÜŞÜK', '100 – 660']];
  rows.forEach(([a, b], k) => { const y = h * (0.42 + k * 0.22); g.textAlign = 'left'; fitText(g, a, w * 0.1, y, w * 0.35, Math.round(h * 0.11), 600); g.textAlign = 'right'; fitText(g, b, w * 0.9, y, w * 0.45, Math.round(h * 0.11), 600); });
  g.fillStyle = '#b3261e'; g.textAlign = 'center'; fitText(g, 'Vites değiştirmeden önce mili durdurun', w / 2, h * 0.86, w * 0.84, Math.round(h * 0.07), 600);
}, { metal:0.6, rough:0.4 }), 112.4, 515, -45, Math.PI / 2);
// dönen takım uyarısı: kovan gövdesinin önü (z = 62), sağda
place(decal(48, 42, 192, (g, w, h) => {
  g.fillStyle = '#f0b429'; g.beginPath(); g.moveTo(w / 2, h * 0.04); g.lineTo(w * 0.97, h * 0.66); g.lineTo(w * 0.03, h * 0.66); g.closePath(); g.fill();
  g.strokeStyle = '#16191b'; g.lineWidth = w * 0.05; g.stroke();
  g.fillStyle = '#16191b'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `700 ${Math.round(h * 0.4)}px ${FONT}`; g.fillText('!', w / 2, h * 0.43);
  g.fillStyle = '#f2f0e8'; g.fillRect(0, h * 0.7, w, h * 0.3);
  g.fillStyle = '#16191b'; fitText(g, 'DÖNEN TAKIM', w / 2, h * 0.85, w * 0.92, Math.round(h * 0.15), 700);
}, { transparent:true }), 58, 395, 62.3);
// seri plakası: kolonun sağ yanı (x = 150)
place(decal(130, 90, 384, (g, w, h) => {
  plate(g, w, h);
  g.fillStyle = '#1d2124'; g.textAlign = 'left'; g.textBaseline = 'middle';
  fitText(g, 'SNOOP3000 KD', w * 0.1, h * 0.17, w * 0.8, Math.round(h * 0.13), 700);
  const L = [['Seri No', '2026-0074'], ['Motor', '2.2 kW · 3 HP'], ['Gerilim', '400 V · 50 Hz'], ['Devir', '100 – 4200 dev/dk'], ['İmal yılı', '2026']];
  L.forEach(([a, b], k) => { const y = h * (0.33 + k * 0.13); g.fillStyle = '#4a4f50'; fitText(g, a, w * 0.1, y, w * 0.3, Math.round(h * 0.085), 500); g.fillStyle = '#1d2124'; fitText(g, b, w * 0.42, y, w * 0.5, Math.round(h * 0.085), 600); });
}, { metal:0.6, rough:0.4 }), 150.4, 340, -470, Math.PI / 2);   // kumanda kutusunun üstünde
// yağ lekeleri: tezgâhın çevresinde zeminde (koyu, kenarları saydam, yumuşak)
function stain(g, w, h, a = 0.55) {
  g.clearRect(0, 0, w, h);
  for (let k = 0; k < 7; k++) {
    const x = w * (0.3 + Math.random() * 0.4), y = h * (0.3 + Math.random() * 0.4), r = w * (0.12 + Math.random() * 0.2);
    const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `rgba(12,10,6,${a})`); gr.addColorStop(0.6, `rgba(16,13,8,${a * 0.5})`); gr.addColorStop(1, 'rgba(16,13,8,0)');
    g.fillStyle = gr; g.beginPath(); g.ellipse(x, y, r, r * (0.5 + Math.random() * 0.5), Math.random() * TAU, 0, TAU); g.fill();
  }
}
for (const [x, z, s] of [[-180, 250, 520], [260, 180, 380], [-420, -150, 300], [120, -620, 340], [520, 420, 260]]) {
  const m = decal(s, s, 256, (g, w, h) => stain(g, w, h, 0.5), { transparent:true, rough:0.25 });
  m.material.depthWrite = false; m.renderOrder = 1;
  place(m, x, F + 0.8, z, Math.random() * TAU, -Math.PI / 2);
}
// tablada yağ izi ve kızakların önünde kırmızı yağlama nipelleri (tablayla birlikte hareket eder)
for (const [x, z, s] of [[-300, -40, 120], [470, 20, 90]]) {
  const m = decal(s, s * 0.6, 128, (g, w, h) => stain(g, w, h, 0.35), { transparent:true, rough:0.2 });
  m.material.depthWrite = false; m.renderOrder = 1;
  place(m, x, -59.6, z, 0, -Math.PI / 2, table);
}
const nip = smat(0xb3261e, 0.4, 0.3, 0.4);
for (const x of [-360, 520]) { const n = cyl(4, 4, 8, nip, 10); n.rotation.x = Math.PI / 2; n.position.set(x, -75, 58); table.add(n); }
