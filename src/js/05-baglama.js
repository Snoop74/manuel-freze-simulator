// ── Bağlama: divizör gövdesi, mengene, pabuç, paraleller, çarpışma kutuları, parça yüzeyinin çizimi
import { C, CUT, H, INSP, NX, NY, PD, PH, PW, SURF, allocGrid, app, clamp, log, mat } from './00-temel.js';
import { M, MX, box, boxR, cyl, hwheel, rbox, smat } from './02-sahne-tezgah.js';
import { ROT, VISE_PAINT, rotG, rotIn, table, viseBase } from './03-tabla-parca.js';
import { DIVY, DIVZ, VX } from './04-voksel.js';

/* ---- Parça mesh'i: ham parça ölçüsü değişince (buildStock) yükseklik haritası, mesh ve mengene yeniden kurulur ---- */
const topMat = new THREE.MeshStandardMaterial({ vertexColors:true, roughness:0.34, metalness:0.62 });
topMat.envMapIntensity = 0.45; M.raw.envMapIntensity = 0.45;   // düz üst yüzey ortamın parlak tavanını yansıtıp beyaza dönmesin
// Alın ve parmak frezenin taban izleri: takımın arka kenarının çizdiği yaylar, devir başına ilerleme aralığıyla ("balık pulu").
// Yay ailesi |p − (c0 + s·d)| = R; s = p·d + √(R² − dik²) mutlak koordinatta hesaplanır, böylece komşu hücreler aynı deseni paylaşır.
topMat.extensions = { derivatives:true };
topMat.onBeforeCompile = sh => {
  sh.vertexShader = 'attribute vec4 mk1;\nattribute vec4 mk2;\nvarying vec4 vK1;\nvarying vec4 vK2;\nvarying vec3 vLoc;\nvarying float vUp;\n' +
    sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  vK1 = mk1; vK2 = mk2; vLoc = position; vUp = normal.y;');
  sh.fragmentShader = 'varying vec4 vK1;\nvarying vec4 vK2;\nvarying vec3 vLoc;\nvarying float vUp;\n' + sh.fragmentShader
    .replace('#include <color_fragment>', `#include <color_fragment>
      float mkAmp = 0.0, mkG = 0.0, rip = 0.0;
      if (vK2.x > 0.001 && vUp > 0.6) {
        vec2 p = vec2(vLoc.x, -vLoc.z), q = p - vK1.xy;
        float al = dot(q, vK1.zw); float dp = length(q - al * vK1.zw);
        float sArc = dot(p, vK1.zw) + sqrt(max(vK2.y * vK2.y - dp * dp, 0.0));
        float ph = sArc / vK2.x;
        float aa = clamp(1.0 - fwidth(ph) * 1.2, 0.0, 1.0);
        mkG = 0.5 + 0.5 * cos(6.2831853 * ph);
        mkAmp = clamp(vK2.z / 3.0, 0.08, 0.9) * aa;
      }
      if (vK2.w > 0.01) rip = vK2.w * (0.5 + 0.5 * sin(dot(vec2(vLoc.x, -vLoc.z), vec2(1.7, 1.1)) * 2.4));
      diffuseColor.rgb *= 1.0 - 0.16 * mkAmp * mkG - 0.12 * rip;`)
    .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
      roughnessFactor = clamp(roughnessFactor + mkAmp * (mkG - 0.35) * 0.45 + rip * 0.3, 0.05, 1.0);`);
};
let nV, pos, nor, col, topGeo, MK1, MK2, TINTC, TAPC, topMesh = null, walls = [], stockBase = null;
function makeWall(n, place, normal) {
  const g = new THREE.BufferGeometry();
  const p = new Float32Array(n * 2 * 3), nn = new Float32Array(n * 2 * 3);
  for (let k = 0; k < n; k++) { place(p, k); for (const v of [k, n + k]) nn.set(normal, v * 3); }
  const ix = [];
  for (let k = 0; k < n - 1; k++) ix.push(k, k + 1, n + k, k + 1, n + k + 1, n + k);
  g.setAttribute('position', new THREE.BufferAttribute(p, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nn, 3));
  g.setIndex(ix);
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(PW/2, PH/2, -PD/2), Math.hypot(PW, PD, PH));
  const m = new THREE.Mesh(g, M.raw); m.castShadow = true; m.receiveShadow = true; rotIn.add(m);
  return { g, n, m };
}
/* Kılavuz dişleri: yükseklik haritası deliğin iç duvarını gösteremez. Kılavuz deliğe girdikçe deliğin içine, duvara
   oturan ve içe doğru çıkıntı yapan sağ helis dişli bir yüzey konur (yalnızca görünüm; muayene ölçüleri değişmez).
   th: { cx, cy: delik merkezi (parça koordinatı), rd: delik yarıçapı, p: adım, y0..y1: dişin alt ve üst yüksekliği } */
const threadG = new THREE.Group(); rotIn.add(threadG);
const threads = [];
function threadGeo(rd, p, y0, y1) {
  const seg = 72, ys = [], h = Math.min(0.54 * p, rd * 0.25), rRoot = rd + 0.25;
  for (let y = y0; y < y1; y += p / 8) ys.push(y);
  ys.push(y1);
  const pos = [], idx = [], W = seg + 1;
  for (const y of ys) for (let j = 0; j <= seg; j++) {
    const th = j / seg * Math.PI * 2, ph = ((y / p - th / (Math.PI * 2)) % 1 + 1) % 1;
    const tri = Math.min(1, Math.max(0, 1.25 - 2.5 * Math.abs(ph - 0.5)));      // kesik üçgen diş profili
    const top = Math.min(1, (y1 - y) / p);                                         // ağızda diş yumuşakça başlar
    const rr = rRoot - h * tri * top;
    pos.push(Math.cos(th) * rr, y, Math.sin(th) * rr);
  }
  for (let k = 0; k < ys.length - 1; k++) for (let j = 0; j < seg; j++) { const a = k * W + j, b = a + 1, c = a + W, d = c + 1; idx.push(a, b, c, b, d, c); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  return g;
}
function tapThread(th) {
  if (th.y1 - th.y0 < 0.3) return;
  if (th.mesh) { threadG.remove(th.mesh); th.mesh.geometry.dispose(); }
  else { th.mat = new THREE.MeshStandardMaterial({ color:new THREE.Color(...mat.cutL).multiplyScalar(0.62), roughness:0.42, metalness:0.6, side:THREE.DoubleSide }); threads.push(th); }   // deliğin içi gölgede: koyu
  th.mesh = new THREE.Mesh(threadGeo(th.rd, th.p, th.y0, th.y1), th.mat);
  th.mesh.position.set(th.cx, 0, -th.cy); threadG.add(th.mesh);
}
// Parça değişince (pah, havşa, yüzey alma, büyük delik) diş yüzeyi kalan malzemeye göre kırpılır: delik çevresindeki
// yüzey deliğin hemen kenarında ölçülür (36 nokta; delik içine düşen noktalar sayılmaz, ızgara basamağına takılmamak için
// en alçak değil alçak çeyrek), dişin üst ucu onun altına iner;
// malzeme diş boyunca gittiyse diş silinir. flushMesh değişen bölgeyle çağırır.
function trimThreads(i0, i1, j0, j1) {
  for (let n = threads.length - 1; n >= 0; n--) {
    const th = threads[n], rr = th.rd + 0.6;
    if ((th.cx + rr) / C < i0 || (th.cx - rr) / C > i1 || (th.cy + rr) / C < j0 || (th.cy - rr) / C > j1) continue;
    const hs = [];
    for (let k = 0; k < 36; k++) {
      const a = k * Math.PI / 18, i = Math.round((th.cx + Math.cos(a) * rr) / C), j = Math.round((th.cy + Math.sin(a) * rr) / C);
      if (i >= 0 && j >= 0 && i < NX && j < NY && H[j * NX + i] > th.y0 + 0.3) hs.push(H[j * NX + i]);
    }
    hs.sort((a, b) => a - b);
    const top = hs.length < 9 ? -1 : hs[Math.floor(hs.length / 4)];   // çevre delik içinde kaldıysa diş gitmiştir
    if (top >= th.y1 - 0.15) continue;
    threadG.remove(th.mesh); th.mesh.geometry.dispose();
    if (top - 0.05 <= th.y0 + 0.3) { th.mat.dispose(); threads.splice(n, 1); th.mesh = null; continue; }
    th.y1 = top - 0.05;
    th.mesh = new THREE.Mesh(threadGeo(th.rd, th.p, th.y0, th.y1), th.mat);
    th.mesh.position.set(th.cx, 0, -th.cy); threadG.add(th.mesh);
  }
}
function clearThreads() {
  for (const th of threads) { threadG.remove(th.mesh); th.mesh.geometry.dispose(); th.mat.dispose(); }
  threads.length = 0;
}
function buildStock(w, d, h) {
  jawOverride = null; clearThreads();
  nV = allocGrid(w, d, h);
  if (topMesh) { rotIn.remove(topMesh); topGeo.dispose(); }
  for (const w of walls) { rotIn.remove(w.w.m); w.w.g.dispose(); }
  if (stockBase) { rotIn.remove(stockBase); stockBase.geometry.dispose(); }
  pos = new Float32Array(nV * 3); nor = new Float32Array(nV * 3); col = new Float32Array(nV * 3);
  for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) { const k = j * NX + i; pos[k*3] = i * C; pos[k*3+1] = PH; pos[k*3+2] = -j * C; }
  topGeo = new THREE.BufferGeometry();
  topGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  topGeo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  topGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  topGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(PW/2, PH/2, -PD/2), Math.hypot(PW, PD, PH));
  MK1 = new Float32Array(nV * 4); MK2 = new Float32Array(nV * 4); TINTC = new Float32Array(nV); TAPC = new Uint8Array(nV);
  topGeo.setAttribute('mk1', new THREE.BufferAttribute(MK1, 4));
  topGeo.setAttribute('mk2', new THREE.BufferAttribute(MK2, 4));
  topMesh = new THREE.Mesh(topGeo, topMat); topMesh.castShadow = true; topMesh.receiveShadow = true; rotIn.add(topMesh);
  // Her duvar: üst sıra (0..n-1) yüksekliği izler, alt sıra y=0
  walls = [
    { w: makeWall(NX, (p, k) => { p.set([k*C, PH, 0], k*3); p.set([k*C, 0, 0], (NX+k)*3); }, [0,0,1]), at: k => H[k] },
    { w: makeWall(NX, (p, k) => { p.set([k*C, PH, -PD], k*3); p.set([k*C, 0, -PD], (NX+k)*3); }, [0,0,-1]), at: k => H[(NY-1)*NX + k] },
    { w: makeWall(NY, (p, k) => { p.set([0, PH, -k*C], k*3); p.set([0, 0, -k*C], (NY+k)*3); }, [-1,0,0]), at: k => H[k*NX] },
    { w: makeWall(NY, (p, k) => { p.set([PW, PH, -k*C], k*3); p.set([PW, 0, -k*C], (NY+k)*3); }, [1,0,0]), at: k => H[k*NX + NX - 1] },
  ];
  // alt yüz: üst yüzle aynı ızgara, y = 0'da ve aşağı bakar; delinip geçilen hücreler ikisinden de çıkarılır
  const bp = new Float32Array(nV * 3), bn = new Float32Array(nV * 3);
  for (let k = 0; k < nV; k++) { bp[k*3] = pos[k*3]; bp[k*3+1] = 0.01; bp[k*3+2] = pos[k*3+2]; bn[k*3+1] = -1; }
  const bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.BufferAttribute(bp, 3)); bg.setAttribute('normal', new THREE.BufferAttribute(bn, 3));
  bg.boundingSphere = topGeo.boundingSphere.clone();
  stockBase = new THREE.Mesh(bg, M.raw); stockBase.receiveShadow = true; rotIn.add(stockBase);
  throughDirty = true; rebuildIndex();
  dirty = { i0:0, i1:NX - 1, j0:0, j1:NY - 1 }; isDirty = true;
  buildVise();
}
// Divizör: tablaya cıvatalı gövde, arkada bölüntü diski ve kol; önde dönen üç ayaklı ayna (parçayla birlikte A açısında döner)
const divG = new THREE.Group(), divRot = new THREE.Group(), divJaws = new THREE.Group(); divG.visible = false; table.add(divG);
divRot.position.set(0, DIVZ, -DIVY); divG.add(divRot); divRot.add(VX.grp); divRot.add(divJaws);
let divCrank = null;
function buildDivBody() {
  if (divCrank) return;
  rbox(-172, -38, -60, -22, -72, 72, 4, M.paintDark, divG);                  // taban
  rbox(-152, -50, -22, DIVZ + 45, -55, 55, 8, M.paint, divG);                // gövde
  const nose = cyl(30, 30, 8, M.ground, 40); nose.rotation.z = Math.PI / 2; nose.position.set(-47, DIVZ, -DIVY); divG.add(nose);
  const plate = cyl(36, 36, 4, MX.chrome, 48); plate.rotation.x = Math.PI / 2; plate.position.set(-100, DIVZ, -DIVY - 57); divG.add(plate);   // bölüntü diski
  for (let k = 0; k < 36; k++) { const a = k / 36 * Math.PI * 2, h = cyl(1, 1, 1, M.black, 6); h.rotation.x = Math.PI / 2; h.position.set(-100 + Math.cos(a) * 30, DIVZ + Math.sin(a) * 30, -DIVY - 59.2); divG.add(h); }
  divCrank = new THREE.Group(); divCrank.position.set(-100, DIVZ, -DIVY - 62); divG.add(divCrank);
  box(8, 34, 5, M.ground, 0, 15, 0, divCrank);
  const kn = cyl(4, 4, 18, M.black, 12); kn.rotation.x = Math.PI / 2; kn.position.set(0, 30, -8); divCrank.add(kn);
  const ch = cyl(50, 50, 36, M.ground, 48); ch.rotation.z = Math.PI / 2; ch.position.x = -26; divRot.add(ch);   // ayna gövdesi
  const fc = cyl(46, 46, 1, M.steel, 48); fc.rotation.z = Math.PI / 2; fc.position.x = -7.6; divRot.add(fc);
}
function buildDivJaws(rs) {
  while (divJaws.children.length) { const o = divJaws.children[0]; divJaws.remove(o); o.traverse(q => { if (q.geometry) q.geometry.dispose(); }); }
  for (let k = 0; k < 3; k++) {
    const g = new THREE.Group(); g.rotation.x = k * Math.PI * 2 / 3; divJaws.add(g);
    const h = Math.max(6, 47 - rs);
    box(14, h, 11, M.steel, -8, rs + h / 2, 0, g);
    box(8, 5, 11, M.steel, -2, rs + 2.5, 0, g);                              // çenenin parçaya basan ucu
  }
}
let FIX = 'vise', clampLay = 'fb', straps = [];
const setFIX = k => { FIX = k; }, setClampLay = v => { clampLay = v; };
const viseG = new THREE.Group(); rotIn.add(viseG);
const rotBase = new THREE.Group(); table.add(rotBase);   // döner tablanın sabit gövdesi
let rotCrank = null;
const MDF = smat(0x8a6a48, 0.85, 0, 0.1), ALU = smat(0xa7aeb3, 0.4, 0.75);
/* Paraleller (mengene, pabuç, döner tabla): kenardan içeri uzaklık (off) ve genişlik (w) ayarlanır; delik paralelin üstüne denk
   gelirse kaydırılır, ince paralel seçilir ya da parça kurban plakasına (MDF, 6 mm; döner tablada 4 mm) oturtulur. Kurban plakada
   paraleller plakanın altında kalır: matkap plakaya girebilir. Mengene ve pabuçta bantlar Y'de (ön/arka), döner tablada X'te (sol/sağ). */
const PAR = { off:3, w:10, sac:false };
const parAxis = () => FIX === 'rot' ? 'x' : 'y';
const parBands = () => { const n = parAxis() === 'x' ? PW : PD; return [[PAR.off, PAR.off + PAR.w], [n - PAR.off - PAR.w, n - PAR.off]]; };
const sacT = () => !PAR.sac ? 0 : FIX === 'rot' ? 4 : 6;
// boydan boya deliklerden paralel bandına denk gelenler (kurban plakada sorun yok)
function parConflicts(J) {
  if (PAR.sac || !['vise', 'clamp', 'rot'].includes(FIX)) return [];
  const ax = parAxis(), out = [];
  J.holes.forEach((h, i) => { const c = ax === 'x' ? h.x : h.y; if (parBands().some(([a, b]) => c + h.d / 2 > a - 0.5 && c - h.d / 2 < b + 0.5)) out.push('D' + (i + 1)); });
  return out;
}
function warnParallels(J) {
  const c = parConflicts(J);
  if (c.length) log(`${c.join(', ')} paralel altlığın üstüne denk geliyor: delip geçerken matkap paralele çarpar. Parça panelinde paralelleri kaydırın, ince paralel seçin ya da kurban plaka kullanın.`, 'warn');
}
let jawTop = 22, jawOverride = null;      // hazır parçada çene, parçanın kenar yüksekliğine göre
const setJawOverride = v => { jawOverride = v; };
// pabuç: kenara basan lama, kademeli destek, saplama ve somun; side f/b (ön/arka) ya da l/r (sol/sağ), c kenar boyunca konum
function strap(c, side) {
  const t = PH, X = side === 'l' || side === 'r';
  const o = side === 'f' ? -1 : side === 'b' ? 1 : side === 'l' ? -1 : 1;   // dışarı yönü
  const e = side === 'f' || side === 'l' ? 0 : X ? PW : PD;                 // kenar
  const a0 = e - o * 12, a1 = e + o * 26, h0 = e + o * 30, h1 = e + o * 40, sd = e + o * 8;
  const R = (u0, u1, y0, y1, r, m) => X ? rbox(Math.min(u0, u1), Math.max(u0, u1), y0, y1, -(c + 8), -(c - 8), r, m, viseG)
                                        : rbox(c - 8, c + 8, y0, y1, -Math.max(u0, u1), -Math.min(u0, u1), r, m, viseG);
  R(a0, a1, t, t + 10, 1, M.ground);                                        // lama
  R(h0, h1, -60, t + 1, 1, M.paintDark);                                    // kademeli destek
  const st = cyl(5.5, 5.5, t + 80, MX.chrome, 12); st.position.set(X ? sd : c, (t + 20 - 60) / 2, X ? -c : -sd); viseG.add(st);
  const nut = cyl(10, 10, 8, M.ground, 6); nut.position.set(X ? sd : c, t + 14, X ? -c : -sd); viseG.add(nut);
  const lo = Math.min(a0, h1), hi = Math.max(a0, h1);
  straps.push({ n:'pabuca', b:X ? [lo, hi, c - 10, c + 10] : [c - 10, c + 10, lo, hi], top:t + 18, strapTop:t + 10, cover:X ? [Math.min(a0, e), Math.max(a0, e), c - 8, c + 8] : [c - 8, c + 8, Math.min(a0, e), Math.max(a0, e)] });
}
function buildVise() {
  while (viseG.children.length) { const o = viseG.children[0]; viseG.remove(o); if (o.geometry) o.geometry.dispose(); }
  while (rotBase.children.length) { const o = rotBase.children[0]; rotBase.remove(o); if (o.geometry) o.geometry.dispose(); }
  viseBase.visible = FIX === 'vise'; straps = []; rotCrank = null;
  if (stockReady) app.syncParUI();
  divG.visible = FIX === 'div'; rotIn.visible = FIX !== 'div';
  if (FIX === 'div') { buildDivBody(); buildDivJaws(PD / 2); }
  ROT.on = FIX === 'rot'; ROT.a = ROT.a0 = ROT.pend = ROT.hold = ROT.z0 = 0; ROT.cx = PW / 2; ROT.cy = PD / 2;
  rotG.position.set(ROT.cx, 0, -ROT.cy); rotIn.position.set(-ROT.cx, 0, ROT.cy); rotG.rotation.y = 0;
  if (FIX === 'rot') {
    const cx = ROT.cx, cz = -ROT.cy;
    // sabit gövde: tablaya cıvatalı kutu, önde kırmızı gösterge ve sonsuz vida krankı (90:1)
    rbox(cx - 125, cx + 125, -60, -30, cz - 115, cz + 115, 6, M.paintDark, rotBase);
    const bd = cyl(118, 122, 8, M.paint, 64); bd.position.set(cx, -26, cz); rotBase.add(bd);
    box(5, 4, 12, app.TMAT.red, cx, -9, cz + 118, rotBase);
    const cr = new THREE.Group(); cr.position.set(cx + 80, -46, cz + 124); rotBase.add(cr);
    const ci = new THREE.Group(); ci.scale.setScalar(0.5); cr.add(ci); hwheel(ci, 44); rotCrank = ci;
    // dönen plaka (parçayla birlikte döner): T kanalları, 5°'lik derece çizgileri
    const pl = cyl(112, 112, 18, M.ground, 72); pl.position.set(cx, -13, cz); viseG.add(pl);
    for (let k = 0; k < 4; k++) { const ts = box(200, 0.8, 10, M.black, cx, -3.95, cz, viseG, false); ts.rotation.y = k * Math.PI / 4; }
    for (let k = 0; k < 72; k++) {
      const a = k * 5 * Math.PI / 180, big = k % 2 === 0, tk = box(0.9, big ? 9 : 5, 0.6, k === 0 ? app.TMAT.red : app.TMAT.bright, cx + Math.cos(a) * 112.3, -8 - (big ? 0 : 2), cz - Math.sin(a) * 112.3, viseG, false);
      tk.rotation.y = a + Math.PI / 2;
    }
    // parça iki ince paralel üstünde (X yanlarında; ortadan boydan boya delik açılabilsin) ve dört pabuçla bağlı
    if (PAR.sac) rbox(0, PW, -4, -0.05, -PD, 0, 0.5, MDF, viseG);            // kurban plaka paralellerin yerine
    else for (const [a, b] of parBands()) rbox(a, b, -4, 0, -(PD - 4), -4, 0.5, M.steel, viseG);
    for (const [c, sd] of [[PW * 0.5, 'f'], [PW * 0.5, 'b']]) strap(c, sd);
    if (stockReady) syncFixtures();
    return;
  }
  if (FIX === 'clamp') {
    for (const [a, b] of parBands()) rbox(4, PW - 4, -60, -sacT(), -b, -a, 1, M.steel, viseG);   // altlıklar
    if (PAR.sac) rbox(0, PW, -6, -0.05, -PD, 0, 0.5, MDF, viseG);
    const pts = clampLay === 'fb' ? [[PW * 0.22, 'f'], [PW * 0.78, 'f'], [PW * 0.22, 'b'], [PW * 0.78, 'b']] : [[PD * 0.25, 'l'], [PD * 0.75, 'l'], [PD * 0.25, 'r'], [PD * 0.75, 'r']];
    for (const [c, sd] of pts) strap(c, sd);
    if (stockReady) syncFixtures();
    return;
  }
  if (FIX === 'vac') {
    rbox(-30, 290, -60, -8, -165, 25, 3, ALU, viseG);                       // vakum tablası gövdesi
    for (let z = -150; z <= 10; z += 20) boxR(-28, 288, -8.6, -7.9, z - 0.6, z + 0.6, M.black, viseG).castShadow = false;   // vakum kanalları
    rbox(-26, 286, -8, 0, -161, 21, 1, MDF, viseG);                          // kurban plakası (MDF)
    const hs = cyl(8, 8, 60, M.black, 12); hs.rotation.x = Math.PI / 2; hs.position.set(260, -34, -185); viseG.add(hs);   // vakum hortumu
    if (stockReady) syncFixtures();
    return;
  }
  jawTop = jawOverride ?? clamp(PH - 5, 4, 22);
  // çeneler: döküm ağız (y -25..0 önde, PD..PD+25 arkada) ve arkalarında daha alçak ağız gövdeleri (y -60..-25, PD+25..PD+50)
  const jb = Math.max(-30, jawTop - 3);
  rbox(-35, 185, -35, jawTop, -PD - 25, -PD - 6, 2, VISE_PAINT, viseG);           // arka (sabit) ağız
  rbox(-35, 185, -35, jb, -PD - 50, -PD - 24, 3, VISE_PAINT, viseG);
  rbox(-35, 185, -35, jawTop, 6, 25, 2, VISE_PAINT, viseG);                      // ön (hareketli) ağız
  rbox(-35, 185, -35, jb, 24, 60, 3, VISE_PAINT, viseG);
  // taşlanmış çene plakaları (6 mm) ve havşa başlı iki vida; plakanın parçaya bakan yüzü y = 0 ve y = PD
  const py0 = Math.max(-33, jawTop - 32), pym = (py0 + jawTop) / 2;
  for (const [z0, z1, fz] of [[-PD - 6, -PD, -PD + 0.15], [0, 6, -0.15]]) {
    rbox(-30, 180, py0, jawTop - 0.3, z0, z1, 0.6, M.ground, viseG);
    for (const x of [-14, 164]) { const sc = cyl(4.5, 4.5, 0.4, M.black, 16); sc.rotation.x = Math.PI / 2; sc.position.set(x, pym, fz); viseG.add(sc); }
  }
  for (const [a, b] of parBands()) rbox(-5, 155, -35, -sacT(), -b, -a, 1, M.steel, viseG);   // paraleller
  if (PAR.sac) rbox(0, PW, -6, -0.05, -PD, 0, 0.5, MDF, viseG);             // kurban plaka
  if (stockReady) syncFixtures();
}
// çarpışma kutuları çenelerle birlikte taşınır (FIXTURES dosyada daha aşağıda tanımlı; başlangıçta bir kez eşitlenir)
let stockReady = false, throughDirty = false;
const markThrough = () => { throughDirty = true; }, markStockReady = () => { stockReady = true; };
// Üçgenler: dört köşesi de tabana inmiş (boydan boya delinmiş) dörtgen çizilmez; böylece delikten karşısı görünür
function rebuildIndex() {
  const thr = 0.02, n = (NX - 1) * (NY - 1) * 6, ti = new Uint32Array(n), bi = new Uint32Array(n);
  let p = 0;
  for (let j = 0; j < NY - 1; j++) for (let i = 0; i < NX - 1; i++) {
    const a = j * NX + i, b = a + 1, c = a + NX, d = c + 1;
    if (H[a] <= thr && H[b] <= thr && H[c] <= thr && H[d] <= thr) continue;
    ti[p] = a; ti[p+1] = b; ti[p+2] = c; ti[p+3] = b; ti[p+4] = d; ti[p+5] = c;
    bi[p] = a; bi[p+1] = c; bi[p+2] = b; bi[p+3] = b; bi[p+4] = c; bi[p+5] = d;
    p += 6;
  }
  topGeo.setIndex(new THREE.BufferAttribute(ti.slice(0, p), 1));
  stockBase.geometry.setIndex(new THREE.BufferAttribute(bi.slice(0, p), 1));
  throughDirty = false;
}
function syncFixtures() {
  app.FIXTURES.length = 0;
  if (FIX === 'vise') app.FIXTURES.push({ n:'mengene ön çenesine', b:[-35, 185, -25, 0], top:jawTop }, { n:'mengene arka çenesine', b:[-35, 185, PD, PD + 25], top:jawTop },
    ...parBands().map(([a, b]) => ({ n:'paralel altlığa', b:[-10, 160, a, b], top:-sacT() })), { n:'mengene ağız gövdesine', b:[-35, 185, -60, -25], top:Math.max(-30, jawTop - 3) },
    { n:'mengene ağız gövdesine', b:[-35, 185, PD + 25, PD + 50], top:Math.max(-30, jawTop - 3) },
    { n:'mengene vida yatağına', b:[25, 125, -95, -75], top:-18 }, { n:'mengene koluna', b:[-5, 155, -125, -95], top:-24 },
    { n:'mengene gövdesine', b:[-40, 190, -95, 200], top:-35 });
  else if (FIX === 'clamp') app.FIXTURES.push(...straps, ...parBands().map(([a, b]) => ({ n:'altlığa', b:[4, PW - 4, a, b], top:-sacT() })));
  else if (FIX === 'div') app.FIXTURES.push({ n:'divizör aynasına', b:[-46, 0.5, DIVY - 52, DIVY + 52], top:DIVZ + 52 }, { n:'divizör gövdesine', b:[-152, -46, -57, 57], top:DIVZ + 47 });
  else if (FIX === 'rot') app.FIXTURES.push(...straps.map(f => Object.assign({ rot:true }, f)), ...(PAR.sac ? [] : parBands().map(([a, b]) => ({ n:'paralel altlığa', b:[a, b, 4, PD - 4], top:0, rot:true }))),
    { n:'döner tabla plakasına', c:[ROT.cx, ROT.cy, 112], top:-4 }, { n:'döner tabla gövdesine', b:[ROT.cx - 125, ROT.cx + 125, ROT.cy - 115, ROT.cy + 115], top:-26 });
  else app.FIXTURES.push({ n:'vakum tablasına (kurban plakasını geçti)', b:[-30, 290, -25, 165], top:-5 });
  app.FIXTURES.push({ n:'tablaya', b:[-400, 550, -50, 150], top:-60 });
}
let dirty = { i0:0, i1:0, j0:0, j1:0 }, isDirty = true;
buildStock(PW, PD, PH);
function markDirty(i0, i1, j0, j1) {
  if (!isDirty) { dirty = { i0, i1, j0, j1 }; isDirty = true; return; }
  dirty.i0 = Math.min(dirty.i0, i0); dirty.i1 = Math.max(dirty.i1, i1);
  dirty.j0 = Math.min(dirty.j0, j0); dirty.j1 = Math.max(dirty.j1, j1);
}
function flushMesh() {
  if (!isDirty) return;
  const i0 = Math.max(0, dirty.i0 - 1), i1 = Math.min(NX - 1, dirty.i1 + 1);
  const j0 = Math.max(0, dirty.j0 - 1), j1 = Math.min(NY - 1, dirty.j1 + 1);
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
    const k = j * NX + i, h = H[k];
    pos[k*3+1] = h;
    const hl = H[j*NX + Math.max(0, i-1)], hr = H[j*NX + Math.min(NX-1, i+1)];
    const hd = H[Math.max(0, j-1)*NX + i], hu = H[Math.min(NY-1, j+1)*NX + i];
    // parça normali (-dh/dx, -dh/dy, 1) -> three (x, z, -y)
    const nx = -(hr - hl), ny = 2 * C, nz = (hu - hd);
    const L = Math.hypot(nx, ny, nz) || 1;
    nor[k*3] = nx / L; nor[k*3+1] = ny / L; nor[k*3+2] = nz / L;
    let r, g, b;
    if (INSP[k]) { r = 0.92; g = 0.2; b = 0.16; }
    else if (h <= 0.05) { r = 0.05; g = 0.06; b = 0.065; }
    else if (CUT[k]) {
      const f = (1 - Math.min(0.2, MK2[k*4+2] * 0.03)) * (1 + 0.03 * Math.sin(i * 0.9 + j * 0.35)), c = mat.cutL, tn = TINTC[k];
      r = c[0] * f; g = c[1] * f; b = c[2] * f;
      if (tn > 0.02) { const tc = tn < 0.5 ? [0.70, 0.45, 0.12] : [0.07, 0.15, 0.55], kk = Math.min(0.6, tn); r += (tc[0] - r) * kk; g += (tc[1] - g) * kk; b += (tc[2] - b) * kk; }
    }
    else {
      // hazır parça yüzeyleri: döküm koyu ve benekli, taşlanmış parlak ve ince çizgili, eski işleme donuk işlenmiş, kaynak isli, tufal koyu mavi-gri
      const sf = SURF[k], nz = 0.9 + 0.2 * ((((Math.sin(i * 12.9898 + j * 78.233) * 43758.5453) % 1) + 1) % 1), R0 = mat.rawL, C0 = mat.cutL;
      if (sf === 1) { const f = 0.6 * nz; r = R0[0] * f; g = R0[1] * f; b = R0[2] * f; }
      else if (sf === 2) { const f = 1 + 0.04 * Math.sin((i + j * 0.3) * 2.1); r = C0[0] * f; g = C0[1] * f; b = C0[2] * f * 1.02; }
      else if (sf === 3) { const f = 0.84 * (0.97 + 0.03 * nz); r = C0[0] * f; g = C0[1] * f; b = C0[2] * f; }
      else if (sf === 4) { r = 0.17 * nz + 0.06; g = 0.13 * nz + 0.04; b = 0.1 * nz + 0.04; }
      else if (sf === 5) { r = 0.075 * nz; g = 0.085 * nz; b = 0.105 * nz; }
      else { r = R0[0]; g = R0[1]; b = R0[2]; }
    }
    if (TAPC[k]) { r *= 0.45; g *= 0.45; b *= 0.45; }
    col[k*3] = r; col[k*3+1] = g; col[k*3+2] = b;
  }
  topGeo.attributes.position.needsUpdate = true;
  topGeo.attributes.normal.needsUpdate = true;
  topGeo.attributes.color.needsUpdate = true;
  topGeo.attributes.mk1.needsUpdate = true; topGeo.attributes.mk2.needsUpdate = true;
  for (const w of walls) {
    const p = w.w.g.attributes.position.array;
    for (let k = 0; k < w.w.n; k++) p[k*3+1] = w.at(k);
    w.w.g.attributes.position.needsUpdate = true;
  }
  if (throughDirty) rebuildIndex();
  trimThreads(i0, i1, j0, j1);
  isDirty = false;
}

/* ---- Talaşlar: yassı kesitli, kıvrık şeritler ----
   Freze talaşı bir ağzın kestiği virgül biçimli şerittir: bir ucu ince, öbür ucu kalın; bir yüzü takıma sürtünüp parlar, öbürü mat kalır.
   Her biçimin birkaç rastgele çeşidi üretilir. Talaşlar havada döner, sekip yatar ve düştükleri yerde yığılır (iç içe geçmez). */

export { FIX, MK1, MK2, PAR, TAPC, TINTC, buildStock, clearThreads, tapThread, buildVise, clampLay, divCrank, divRot, flushMesh, jawTop,
  markDirty, markStockReady, markThrough, nV, parAxis, parBands, parConflicts, rotCrank, setClampLay, setFIX,
  setJawOverride, stockBase, straps, syncFixtures, topGeo, topMat, topMesh, walls, warnParallels };
