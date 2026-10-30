// ── Atölye donanımı: arka plandaki makineler ve eşyalar (sütunlu matkap, taş motoru, kompresör, malzeme rafı, paletler, variller),
// pencereler, tavan vinci, elektrik panosu, tabelalar ve duvar saati. Yalnızca görünüm; çarpışma ve oyun mantığına girmez.
import { TAU } from './00-temel.js';
import { FLOOR_Y, M, MX, addSurface, cyl, rbox, renderer, scene, smat } from './02-sahne-tezgah.js';

const F = FLOOR_Y;
const WALL_Z = -1600, WALL_X = -3360;   // arka duvarın ve sol duvarın iç yüzü

// boyalı makine ve eşya malzemeleri: renk bizden, aşınma detayı tezgâh boyasının dokusundan
function paint(hex, rough = 0.8, metal = 0.08) {
  const m = smat(hex, rough, metal, 0.25);
  addSurface(m, 'green_metal_rust', { mSc:0.08, mAmt:0.05, sc:1 / 700, alb:0, mean:0.063, rough:0.7, nStr:0.6, det:0.5 });
  return m;
}
const P = {
  grey: paint(0x6d7478), blue: paint(0x3b5a7a), red: paint(0xa3261d), yellow: paint(0xe0a92a, 0.7),
  orange: paint(0xd0611d, 0.7), dark: paint(0x2d3236, 0.7, 0.2),
};
const steelBar = smat(0x8d9499, 0.42, 0.85, 0.6), aluBar = smat(0xc4c9cc, 0.3, 0.9, 0.7), brass = smat(0xc8a252, 0.35, 0.9, 0.6);
const blackBar = smat(0x2a2c2e, 0.6, 0.6, 0.3);          // haddeden çıkmış, tufallı çelik
const wood = smat(0x9a7a52, 0.9, 0, 0.1), woodDark = smat(0x6b5236, 0.9, 0, 0.1);
const add = (m, x, y, z) => { m.position.set(x, y, z); scene.add(m); return m; };

/* ---- Sütunlu matkap (sol arka, dolapla tezgâh arasında) ---- */
{
  const x = -1300, z = -1320;
  rbox(x - 220, x + 220, F, F + 70, z - 180, z + 220, 10, P.grey);                       // ayak
  const col = add(cyl(48, 48, 1750, M.steel, 24), x, F + 70 + 875, z - 60);
  rbox(x - 170, x + 170, F + 780, F + 820, z - 90, z + 240, 8, P.grey);                   // tabla
  rbox(x - 60, x + 60, F + 740, F + 790, z - 110, z - 10, 6, P.grey);                     // tabla kolu bileziği
  rbox(x - 150, x + 150, F + 1480, F + 1760, z - 150, z + 230, 20, P.grey);               // kafa
  rbox(x - 120, x + 120, F + 1760, F + 1830, z - 120, z + 200, 14, P.grey);               // kayış kapağı
  add(cyl(95, 95, 260, P.dark, 24), x, F + 1620, z - 250).rotation.x = Math.PI / 2;      // motor (arkada)
  add(cyl(30, 30, 160, M.steel, 16), x, F + 1400, z + 140);                              // kovan
  add(cyl(22, 12, 70, M.steel, 16), x, F + 1295, z + 140);                               // mandren
  const hub = add(cyl(24, 24, 40, M.steel, 16), x + 170, F + 1560, z + 80); hub.rotation.z = Math.PI / 2;
  for (let k = 0; k < 3; k++) {                                                         // ilerleme kolları
    const g = new THREE.Group(); g.position.set(x + 190, F + 1560, z + 80); g.rotation.x = k * TAU / 3 + 0.4; scene.add(g);
    const rod = cyl(5, 5, 200, M.steel, 8); rod.position.y = 100; g.add(rod);
    const kn = new THREE.Mesh(new THREE.SphereGeometry(14, 12, 10), M.black); kn.position.y = 200; g.add(kn);
  }
}

/* ---- Taş motoru ayağıyla (sağ arka, tezgâhın solunda) ---- */
{
  const x = 950, z = -1380;
  rbox(x - 200, x + 200, F, F + 40, z - 200, z + 200, 8, P.grey);
  add(cyl(55, 70, 900, P.grey, 20), x, F + 470, z);
  rbox(x - 120, x + 120, F + 920, F + 950, z - 90, z + 90, 6, P.grey);
  const mot = add(cyl(85, 85, 260, P.blue, 24), x, F + 1050, z); mot.rotation.z = Math.PI / 2;
  for (const s of [-1, 1]) {
    const wheel = add(cyl(95, 95, 28, smat(0xb8b3a6, 0.95, 0, 0.1), 32), x + s * 190, F + 1050, z); wheel.rotation.z = Math.PI / 2;
    const guard = add(cyl(110, 110, 50, P.blue, 24, ), x + s * 190, F + 1065, z - 10); guard.rotation.z = Math.PI / 2; guard.scale.set(1, 1, 0.55);
    rbox(x + s * 190 - 45, x + s * 190 + 45, F + 1170, F + 1180, z + 20, z + 130, 2, smat(0xbfd8e0, 0.1, 0, 0.6, { transparent:true, opacity:0.35 }));
  }
}

/* ---- Kompresör (sağ arka köşe) ---- */
{
  const x = 3150, z = -1250;
  const tank = add(cyl(230, 230, 1100, P.red, 32), x, F + 300, z); tank.rotation.x = Math.PI / 2;
  for (const s of [-1, 1]) { const cap = new THREE.Mesh(new THREE.SphereGeometry(230, 24, 12, 0, TAU, 0, Math.PI / 2), P.red); cap.rotation.x = s * Math.PI / 2; add(cap, x, F + 300, z + s * 550); cap.scale.y = 0.35; }
  for (const s of [-1, 1]) rbox(x - 200, x + 200, F, F + 90, z + s * 380 - 40, z + s * 380 + 40, 6, P.dark);
  rbox(x - 150, x + 150, F + 520, F + 720, z - 380, z + 20, 12, P.dark);                // motor
  rbox(x - 120, x + 120, F + 520, F + 800, z + 80, z + 330, 12, P.grey);                 // pompa
  add(cyl(55, 55, 30, smat(0xeeeeea, 0.4, 0.1), 24), x + 160, F + 640, z + 420).rotation.z = Math.PI / 2;   // manometre
}

/* ---- Variller (sağda): yağ varili el pompasıyla ve talaş varili yanında sarı varil ---- */
{
  const tray = smat(0x31363a, 0.6, 0.5, 0.3);
  rbox(2440, 3800, F, F + 60, -400, 200, 8, tray);
  const d1 = add(cyl(290, 290, 880, P.red, 32), 2780, F + 60 + 440, -110);
  const d2 = add(cyl(290, 290, 880, P.yellow, 32), 3440, F + 60 + 440, -110);   // aralarında 60 mm boşluk
  for (const d of [d1, d2]) for (const y of [-260, 260]) { const r = new THREE.Mesh(new THREE.TorusGeometry(292, 8, 8, 48), tray); r.rotation.x = Math.PI / 2; r.position.set(0, y, 0); d.add(r); }
  add(cyl(18, 18, 700, M.steel, 10), 2780, F + 60 + 880 + 250, -110);                  // pompa gövdesi
  const h = add(cyl(8, 8, 300, M.steel, 8), 2780, F + 60 + 880 + 560, -110); h.rotation.z = Math.PI / 2 - 0.5;
}

/* ---- Malzeme rafı (sol duvar): konsol kollarda yuvarlak çubuklar, lamalar ---- */
{
  const x0 = WALL_X, ups = [-900, -100, 700], lev = [F + 380, F + 900, F + 1420];
  for (const z of ups) {
    rbox(x0, x0 + 90, F, F + 1900, z - 45, z + 45, 4, P.blue);
    rbox(x0, x0 + 520, F, F + 60, z - 60, z + 60, 4, P.blue);                             // ayak
    for (const y of lev) rbox(x0 + 90, x0 + 480, y - 35, y, z - 30, z + 30, 4, P.blue);
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
  rbox(x - 260, x + 260, F + 1150, F + 1950, WALL_Z, WALL_Z + 200, 10, P.grey);
  rbox(x - 240, x + 240, F + 1170, F + 1930, WALL_Z + 200, WALL_Z + 206, 4, P.grey);
  rbox(x + 150, x + 200, F + 1500, F + 1580, WALL_Z + 206, WALL_Z + 236, 6, P.dark);   // kol
  rbox(x - 60, x + 60, F + 1950, F + 2700, WALL_Z, WALL_Z + 90, 6, P.dark).castShadow = false;
  rbox(-3300, 3500, F + 2700, F + 2760, WALL_Z, WALL_Z + 110, 4, P.dark).castShadow = false;
  for (const px of [-2000, 1400]) add(cyl(18, 18, 2100, P.dark, 10), px, F + 1650, WALL_Z + 30).castShadow = false;   // boru inişleri
}

/* ---- Yangın tüpü (sol duvar) ---- */
{
  const z = -1200;
  add(cyl(80, 80, 520, P.red, 24), WALL_X + 100, F + 640, z);
  add(cyl(30, 40, 80, M.black, 12), WALL_X + 100, F + 940, z);
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
}
