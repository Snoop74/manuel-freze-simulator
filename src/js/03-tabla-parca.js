// ── Tabla ve parça: konsol, kızak, tabla, el çarkları, mengene gövdesi, parça yüzeyi (yükseklik haritası), döner tabla dönüşümü
// Konsol (sabit), kızak (Y) ve tabla (X). Tabla grubu = parça koordinatları (x, z, -y)
rbox(-210, 210, -310, -160, -330, 90, 12, M.paint);                         // konsol (knee)
for (const x of [-196, 150]) rbox(x, x + 46, -162, -157, -320, 84, 2, M.ground);   // konsol üstü kızak yolları
{ const c = new THREE.Group(); c.position.set(-150, -250, 92); scene.add(c);         // konsol kaldırma krankı
  const sh = cyl(9, 9, 24, MX.chrome, 14); sh.rotation.x = Math.PI / 2; sh.position.z = 10; c.add(sh);
  const arm = rbox(-6, 6, -4, 60, 20, 30, 3, MX.chrome, c);
  const h = cyl(7, 7, 40, M.black, 12); h.rotation.x = Math.PI / 2; h.position.set(0, 58, 46); c.add(h); }
lever(scene, 160, -200, 92, 34, 0.7, 8);                                     // konsol kilidi
const saddle = new THREE.Group(); scene.add(saddle);
rbox(-210, 210, -160, -100, -200, 100, 6, M.paint, saddle);                 // kızak, X'te sabit
for (const x of [-200, 186]) rbox(x, x + 14, -150, -110, 100, 104, 2, M.paintDark, saddle);
lever(saddle, 170, -130, 102, 30, 0.6, 7);                                   // kızak kilidi
const table = new THREE.Group(); saddle.add(table);
// parça, bağlama ve markalama bu grupta: döner tabla takılıyken parçanın ortası çevresinde döner
const rotG = new THREE.Group(), rotIn = new THREE.Group(); table.add(rotG); rotG.add(rotIn);
rbox(-400, 550, -100, -60, -160, 60, 4, M.ground, table);
for (const zz of [-10, -50, -90]) boxR(-400, 550, -60.5, -59.2, zz - 8, zz + 8, M.black, table).castShadow = false;   // T-kanalları
rbox(-400, 550, -102, -96, 58, 66, 2, M.paintDark, table);                  // ön kenarda durdurucu kanalı
for (const x of [-250, 400]) rbox(x, x + 22, -112, -94, 62, 80, 3, M.ground, table);   // tabla durdurucuları
// otomatik tabla ilerleme ünitesi (sol uçta)
rbox(-392, -300, -98, -62, 60, 112, 8, M.paintDark, table);
const pfLever = lever(table, -346, -80, 112, 34, 0.5, 8);
// X el çarkları (tablanın iki ucunda, x ekseninde döner)
const wheels = [];
for (const sx of [-410, 560]) {
  const g = new THREE.Group(); g.position.set(sx, -80, -50); table.add(g);
  const inner = new THREE.Group(); inner.rotation.y = sx < 0 ? -Math.PI / 2 : Math.PI / 2; g.add(inner);
  hwheel(inner, 48);
  wheels.push(g);
}
// Y el çarkı (konsolun önünde, sabit)
const yWheel = new THREE.Group(); yWheel.position.set(0, -235, 112); scene.add(yWheel);
hwheel(yWheel, 48);
// Mengene (gövde ve vida; pabuç ya da vakum tabla bağlanınca gizlenir)
const viseBase = new THREE.Group(); table.add(viseBase);
rbox(-40, 190, -60, -35, -160, 60, 3, M.paint, viseBase);                 // gövde (-60..-35)
{ const s = cyl(9, 9, 90, MX.chrome, 14); s.rotation.x = Math.PI / 2; s.position.set(75, -40, 70); viseBase.add(s);
  const b = cyl(16, 16, 14, M.ground, 6); b.rotation.x = Math.PI / 2; b.position.set(75, -40, 112); viseBase.add(b);
  const hd = cyl(5, 5, 110, MX.chrome, 10); hd.rotation.z = Math.PI / 2; hd.position.set(75, -40, 120); viseBase.add(hd);
  for (const x of [20, 130]) { const k = new THREE.Mesh(new THREE.SphereGeometry(8, 12, 8), M.black); k.position.set(x, -40, 120); viseBase.add(k); } }

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
function buildStock(w, d, h) {
  jawOverride = null;
  PW = w; PD = d; PH = h;
  NX = Math.round(PW / C) + 1; NY = Math.round(PD / C) + 1; nV = NX * NY;
  H = new Float32Array(nV).fill(PH); CUT = new Uint8Array(nV); INSP = new Uint8Array(nV); EDGE = new Float32Array(nV).fill(9); SURF = new Uint8Array(nV);
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
/* ---- Bağlama: mengene, pabuç ya da vakum tabla ----
   Mengene: çeneler parçaya göre; arka çene parçanın arkasına dayanır, çene yüksekliği parçanın 5 mm altında biter.
   Pabuç: parça iki altlık üstünde tablaya bağlanır; dört pabuç kenarın 12 mm'sini kapatır (takım çarparsa kırılır).
   Vakum tabla: kurban plakası üstünde, parçanın her yeri açık; tutma kuvveti alan ve hava kaçağına bağlı (VAC). */
const FIXLIM = { vise:{ x:[20, 220], y:[20, 135], z:[10, 80] }, clamp:{ x:[40, 260], y:[40, 140], z:[5, 80] }, vac:{ x:[30, 260], y:[30, 150], z:[3, 40] }, rot:{ x:[20, 150], y:[20, 120], z:[5, 60] }, div:{ x:[20, 150], y:[10, 70], z:[5, 200] } };
const FIXNAME = { vise:'Mengene', clamp:'Pabuç', vac:'Vakum tabla', rot:'Döner tabla', div:'Divizör' };
/* Döner tabla: parça, ortası tabla merkezinde olacak şekilde bağlanır ve bu merkez çevresinde döner (C ekseni, derece).
   Kesim haritası parçaya bağlı kalır; tezgâh koordinatı (S.px, S.py) her okumada parçanın kendi koordinatına çevrilir.
   a0: son kabul edilen adımın açısı; takım hareketsizken tabla dönerse aradaki fark kesme yolu sayılır (yay kanal). */
const ROT = { on:false, a:0, a0:0, cx:75, cy:50, lock:true, pend:0, hold:0, z0:0, turning:false };
let LX = 0, LY = 0;
function toLv(x, y, a = ROT.a) {
  const t = a * Math.PI / 180, c = Math.cos(t), sn = Math.sin(t), dx = x - ROT.cx, dy = y - ROT.cy;
  LX = ROT.cx + dx * c + dy * sn; LY = ROT.cy - dx * sn + dy * c;
}
/* ---------------- Divizör parçası: 3B hacim (voksel) modeli ----------------
   Yükseklik haritası yalnızca yukarıdan kesilen parçayı tutar; divizörde parça döndüğü için takım yandan ve alttan da keser.
   Parça 0.5 mm'lik vokseller halinde tutulur: her voksel 0–255 doluluk (128 = yüzey). Takım, şekli (profile) ile tanımlı bir
   cisim olarak dolulukları düşürür; sınırda bir voksellik yumuşak geçiş, yüzeyin pürüzsüz çıkmasını sağlar.
   Yüzey 16³ hücrelik bloklar halinde "surface nets" ile çizilir; kesilen bloklar her karede birkaçı yeniden kurulur.
   Parçanın yerel ekseni: x divizör ekseni boyunca (0 = ayna yüzü), y yatay, z dikey; A açısı x çevresinde döndürür.
   Izgaranın her yanında 2 voksel boşluk vardır (uç yüzler kapalı çizilsin).
   Tezgâh (parça) koordinatında eksen y = DIVY, z = DIVZ çizgisidir. */
