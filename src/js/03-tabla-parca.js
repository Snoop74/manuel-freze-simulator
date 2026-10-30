// ── Tabla ve parça: konsol, kızak, tabla, el çarkları, mengene gövdesi, parça yüzeyi (yükseklik haritası), döner tabla dönüşümü
import { M, MX, boxR, cyl, hwheel, lever, rbox, scene } from './02-sahne-tezgah.js';

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

export { FIXLIM, FIXNAME, LX, LY, ROT, pfLever, rotG, rotIn, saddle, table, toLv, viseBase, wheels, yWheel };
