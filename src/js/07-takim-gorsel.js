// ── Takım görselleri ve tutucular: helisli gövdeler, ER/Weldon/shrink/hidrolik, kadranlı taster, takım profili
import { kayit } from './00-kayit.js';
import { S, TAN59, TAU, app, isDrill, tool } from './00-temel.js';
import { box, cyl, smat, toolRot } from './02-sahne-tezgah.js';

const TMAT = {
  carbide: smat(0xa3aaaf, 0.26, 0.92, 0.9),           // kaplamasız karbür
  altin:   smat(0x46424e, 0.32, 0.85, 0.9),           // AlTiN kaplama: koyu mor-gri
  tin:     smat(0xc9a03a, 0.28, 0.9, 0.9),            // TiN kaplama: altın sarısı
  dlc:     smat(0x1f2024, 0.3, 0.8, 0.9),             // DLC kaplama: siyah
  hss:     smat(0xc3c8cc, 0.22, 0.92, 0.9),           // taşlanmış HSS
  holder:  smat(0x2b2e31, 0.38, 0.85, 0.7),           // siyah oksit tutucu
  bright:  smat(0x9aa2a7, 0.22, 0.95, 0.9),           // taşlanmış çelik yüzey
  insert:  smat(0x2c2c31, 0.4, 0.7, 0.8),             // karbür uç (koyu)
  broken:  smat(0x8c9095, 0.62, 0.6, 0.6, { flatShading:true, side:THREE.DoubleSide }),   // karbür kırık yüzeyi: mat gri, kristal
  ruby:    smat(0xa0101c, 0.12, 0.1, 0.9),            // taster bilyesi
  led:     new THREE.MeshStandardMaterial({ color:0x111a14, emissive:0x0b3a12, roughness:0.3 }),
  red:     smat(0xb8442e, 0.4, 0.5, 0.6),
};
/* Kaplama görünümü: ince film girişimi. Kaplama birkaç mikron kalınlığında; ışık üst ve alt yüzeyinden yansıyıp girişim
   yapar, renk bakış açısıyla kayar. Karşıdan bakınca a, yüzeye sıyırarak bakınca b rengine döner (doğrusal renk);
   str: etkinin şiddeti. AlTiN mor-gri → bronz, DLC siyah → mavi, TiN altın → bakır. Doku gerekmez. */
function coatFX(m, a, b, str) {
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, { fA:{ value:new THREE.Vector3(...a) }, fB:{ value:new THREE.Vector3(...b) }, fStr:{ value:str } });
    sh.fragmentShader = 'uniform vec3 fA, fB;\nuniform float fStr;\n' + sh.fragmentShader.replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
      float ndv = clamp(abs(dot(normal, normalize(vViewPosition))), 0.0, 1.0);
      diffuseColor.rgb = mix(diffuseColor.rgb, mix(fA, fB, pow(1.0 - ndv, 1.4)), fStr);`);
  };
  m.customProgramCacheKey = () => 'coat';
}
coatFX(TMAT.altin, [0.085, 0.06, 0.12], [0.36, 0.22, 0.12], 0.75);
coatFX(TMAT.dlc, [0.025, 0.026, 0.032], [0.07, 0.12, 0.3], 0.7);
coatFX(TMAT.tin, [0.6, 0.38, 0.08], [0.62, 0.24, 0.08], 0.45);
/* ---- Takım tutucular: parmak, küresel ve pah frezeleri için ----
   ro: salgı (mm) · slip: ağır yükte takımın kayma eğilimi · damp: tırlama çarpanı · rh: tutucu burnunun çarpışma yarıçapı.
   Salgıda bir ağız ötekilerden fazla keser: küçük diş başına ilerlemede yük, aşınma ve yüzey bundan çok etkilenir. */
const HOLDERS = {
  er:     { n:'ER pens',    ro:0.015, slip:1,   damp:1.05, rh:22, p:0,    t:'standart; ağır yükte takım kayabilir' },
  weldon: { n:'Weldon',     ro:0.008, slip:0,   damp:1,    rh:24, p:600,  t:'yan vidalı, kaymaz; kaba işe' },
  shrink: { n:'Shrink-fit', ro:0.003, slip:0,   damp:0.9,  rh:14, p:1800, t:'ısıyla sıkma, ince burun, salgı neredeyse yok' },
  hydro:  { n:'Hidrolik',   ro:0.003, slip:0.4, damp:0.72, rh:20, p:2400, t:'yağ basınçlı, titreşimi söndürür' },
};
const HKEY = 'freze-holders';
let HSEL = {};
HSEL = kayit.oku(HKEY, {}) || {};
const holds = T => T.type === 'end' || T.type === 'ball' || T.type === 'chamfer';
const holderOf = T => holds(T) ? (HOLDERS[HSEL[T.no]] ? HSEL[T.no] : 'er') : null;
const holderR = T => T.type === 'face' ? 25 : holds(T) ? HOLDERS[holderOf(T)].rh : 22;
// Takım tipine göre varsayılan geometri; T.geo ile tek tek değiştirilebilir
function geoOf(T) {
  const base = {
    end:   { helix:T.z >= 3 ? 38 : 30, core:0.58, land:0.07, tip:'flat', coat:T.d <= 6 ? 'carbide' : 'altin', corner:0.25 },
    ball:  { helix:30, core:0.58, land:0.07, tip:'ball', coat:'altin', corner:0 },
    drill: { helix:30, core:0.28, land:0.16, tip:'cone', tipAngle:118, coat:'tin', corner:0 },
    spot:  { helix:18, core:0.35, land:0.12, tip:'cone', tipAngle:90, coat:'hss', corner:0 },
    chamfer:{ helix:0, core:0.5, land:0.12, tip:'cone', tipAngle:90, coat:'altin', corner:0 },
    tap:   { helix:0, core:0.62, land:0.42, tip:'lead', coat:'hss', corner:0 },
    face:  { helix:0, core:0.72, land:0.55, tip:'flat', coat:'holder', corner:0 },
  }[T.type] || { helix:0, core:0.6, land:0.1, tip:'flat', coat:'hss', corner:0 };
  return Object.assign({}, base, T.geo || {});
}
// kesit profili: u ∈ [0,1) bir ağız aralığında konum → yarıçap oranı
function toothProfile(u, core, land) {
  if (u < land) return 1;                                          // fatura (silindirik pah)
  const face = land + 0.07;
  if (u < face) { const k = (u - land) / 0.07; return 1 - (1 - core) * (0.5 - 0.5 * Math.cos(Math.PI * k)); }   // kesme yüzü: dik iniş
  if (u < 0.62) { const k = (u - face) / (0.62 - face); return core + (1 - core) * 0.12 * Math.sin(Math.PI * k); }   // kanal dibi
  const k = (u - 0.62) / 0.38; return core + (1 - core) * (0.5 - 0.5 * Math.cos(Math.PI * k));   // sırt: yavaşça faturaya yükselir
}
// kanallı gövde: y = 0 uç, y = len kanal sonu; çap kanal boyunca sabit, uçta seçilen kapanış
function fluteGeo(r, z, len, g, opt = {}) {
  const seg = Math.max(48, z * 28), tanH = Math.tan(g.helix * Math.PI / 180);
  const rad = g.tip === 'flat' && g.corner > 0.3;
  const tipH = g.tip === 'ball' ? r : g.tip === 'cone' ? r / Math.tan(g.tipAngle / 2 * Math.PI / 180) : g.tip === 'lead' ? (opt.p || 1) * 2.5 : rad ? g.corner : 0;
  const ys = [];                                                  // uca yakın sık, gövdede seyrek satır
  const nTip = tipH > 0 ? 18 : 0;
  for (let k = 0; k < nTip; k++) ys.push(tipH * Math.pow(k / nTip, g.tip === 'ball' || rad ? 1.6 : 1));
  const rest = Math.max(4, Math.ceil((len - tipH) / (opt.p ? opt.p / 8 : Math.min(1.2, r * 0.25))));   // kılavuzda diş adımının 1/8'i
  for (let k = 0; k <= rest; k++) ys.push(tipH + (len - tipH) * k / rest);
  const pos = [], idx = [], uv = [];
  // kanal çıkışı: taşlama diski şafta doğru çıkarken kanal derinliği yumuşakça azalır (kılavuz ve alın frezesi gövdesi hariç)
  const runL = opt.p || opt.noRun ? 0 : Math.min(len * 0.3, r * 1.6);
  for (const y of ys) {
    let sc = 1;
    if (g.tip === 'ball' && y < r) sc = Math.sqrt(Math.max(0, 1 - Math.pow((r - y) / r, 2)));
    else if ((g.tip === 'cone') && y < tipH) sc = y / tipH;
    else if (g.tip === 'lead' && y < tipH) sc = 0.82 + 0.18 * y / tipH;
    else if (g.tip === 'flat' && g.corner > 0 && y < g.corner) { const R = g.corner; sc = (r - R + Math.sqrt(Math.max(0, R * R - (R - y) * (R - y)))) / r; }   // köşe radyüsü
    const tw = y * tanH / r;                                       // helis bükümü (radyan)
    for (let j = 0; j <= seg; j++) {
      const th = j / seg * TAU, u = ((th + tw) * z / TAU % 1 + 1) % 1;
      let rr = r * toothProfile(u, g.core, g.land) * sc;
      if (opt.p) {                                                 // kılavuz dişi: sağ helis, adım p
        const ph = ((y / opt.p - th / TAU) % 1 + 1) % 1;
        rr -= Math.min(rr * 0.12, opt.p * 0.55) * Math.abs(ph * 2 - 1) * (y > tipH * 0.4 ? 1 : 0.4);
      }
      if (runL && y > len - runL) { const b = (y - (len - runL)) / runL, s2 = b * b * (3 - 2 * b); rr += (r * sc - rr) * s2; }
      pos.push(Math.cos(th) * rr, y, Math.sin(th) * rr); uv.push(j / seg, y / len);
    }
  }
  const W = seg + 1;
  for (let k = 0; k < ys.length - 1; k++) for (let j = 0; j < seg; j++) {
    const a = k * W + j, b = a + 1, c = a + W, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  if ((g.tip === 'flat' || g.tip === 'lead') && !opt.noCap) {     // alt yüz: ortası hafif içbükey (alın dişlerinin çukurluk açısı)
    const c0 = pos.length / 3; pos.push(0, g.tip === 'flat' ? r * 0.04 : 0, 0); uv.push(0.5, 0);
    for (let j = 0; j < seg; j++) idx.push(c0, j, j + 1);
  }
  const top = pos.length / 3; pos.push(0, len, 0); uv.push(0.5, 1);   // üst kapak (şaftın altında kalır)
  for (let j = 0; j < seg; j++) idx.push(top, (ys.length - 1) * W + j + 1, (ys.length - 1) * W + j);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx); geo.computeVertexNormals();
  return geo;
}
// Satır satır döndürülmüş ızgara: rf(θ, y) her noktanın yarıçapı. Altta ve üstte kapak.
function gridLathe(ys, seg, rf) {
  const pos = [], idx = [], W = seg + 1;
  for (const y of ys) for (let j = 0; j <= seg; j++) { const th = j / seg * TAU, rr = rf(th, y); pos.push(Math.cos(th) * rr, y, Math.sin(th) * rr); }
  for (let k = 0; k < ys.length - 1; k++) for (let j = 0; j < seg; j++) { const a = k * W + j, b = a + 1, c = a + W, d = c + 1; idx.push(a, c, b, b, c, d); }
  const c0 = pos.length / 3; pos.push(0, ys[0], 0);
  for (let j = 0; j < seg; j++) idx.push(c0, j, j + 1);
  const c1 = pos.length / 3; pos.push(0, ys[ys.length - 1], 0);
  for (let j = 0; j < seg; j++) idx.push(c1, (ys.length - 1) * W + j + 1, (ys.length - 1) * W + j);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx); geo.computeVertexNormals();
  return geo;
}
// kabuk freze gövdesi: rb yarıçaplı, üstü daralan; her ağzın (θ = k·2π/z) önünde talaş cebi: uç tarafında dik duvar,
// karşı tarafta yumuşak çıkış, yukarı doğru sığlaşır
function shellBody(rb, z, H) {
  const pocketH = Math.min(21, H * 0.56), ys = [];
  for (let k = 0; k <= 40; k++) ys.push(H * k / 40);
  const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  return gridLathe(ys, z * 48, (th, y) => {
    let rr = y < 1 ? rb - 1 + y : rb;                                    // alt kenar pahı
    rr -= 5 * sm(H * 0.55, H * 0.75, y);                                  // üstte boyun
    const u = ((th * z / TAU) % 1 + 1) % 1;
    const fu = u < 0.03 ? u / 0.03 : u < 0.36 ? 1 - sm(0.12, 0.36, u) : 0;
    const fy = 1 - sm(pocketH - 12, pocketH + 2, y);                    // cep yukarı doğru kavisle sığlaşır
    return rr - 9 * fu * fy;
  });
}
// APKT 1604 karbür uç: 16 mm boy, 9.5 mm en, 85° paralelkenar, 4 mm kalınlık, pahlı kenarlar (yerel: x radyal, y eksen, z teğet)
let apktCache = null;
function apktGeo() {
  if (apktCache) return apktCache;
  const sh = new THREE.Shape(), W = 9.5, L = 16;
  sh.moveTo(0, 0); sh.lineTo(W, 0.9); sh.lineTo(W, L); sh.lineTo(0, L - 0.9); sh.closePath();
  const hole = new THREE.Path(); hole.absarc(W / 2, L / 2, 2.2, 0, TAU, true); sh.holes.push(hole);
  apktCache = new THREE.ExtrudeGeometry(sh, { depth:3.6, bevelEnabled:true, bevelSize:0.3, bevelThickness:0.3, bevelSegments:1, curveSegments:12 });
  return apktCache;
}
// tornalanmış tutucu: (yarıçap, yükseklik) profilinden döndürülür; 0 = alt uç
function latheMesh(pts, m, seg = 48) {
  const g = new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(Math.max(0.01, x), y)), seg);
  const o = new THREE.Mesh(g, m); o.castShadow = true; return o;
}
// pens takım tutucu (ER somunlu) ya da matkap aynası; hl: tutucu boyu, rs: şaft yarıçapı
const DARK = smat(0x0b0c0d, 0.7, 0.3, 0.3);                       // yuva, delik, altıgen soket içi
// radyal yönde duran küçük parça (vida başı, yuva): x ekseninde r uzaklıkta, a açısında
function radial(g, o, r, y, a) { o.rotation.z = Math.PI / 2; const w = new THREE.Group(); w.rotation.y = -a; o.position.set(r, y, 0); w.add(o); g.add(w); return o; }
// altıgen yuvalı (alyan) vida başı
function capScrew(g, r, y, a, rh) {
  radial(g, cyl(rh, rh, 2.6, TMAT.bright, 24), r + 1.3, y, a);
  radial(g, cyl(rh * 0.48, rh * 0.48, 0.5, DARK, 6), r + 2.65, y, a);
}
// BT40 flanşı: V kanalın taşlanmış bantları ve iki sürücü kanalı (her tutucuda aynı)
function flangeDetail(g, hl, fl) {
  g.add(latheMesh([[31.06, hl - fl + 1.2], [31.06, hl - fl + 4.8]], TMAT.bright, 64));
  g.add(latheMesh([[31.06, hl - fl + 11.2], [31.06, hl - 1.2]], TMAT.bright, 64));
  for (const a of [0, Math.PI]) radial(g, box(4.5, 8, 15, DARK), 29.6, hl - 4.6, a).rotation.z = 0;   // sürücü kanalı: 15 mm geniş, 8 mm derin
}
function holderMesh(T, hl) {
  const g = new THREE.Group(), rs = Math.min(T.d / 2, 8);
  const fl = 14;
  if (T.type === 'face') {                                        // kabuk freze malafası: kısa ve kalın
    g.add(latheMesh([[9, 0], [9, hl - fl - 4], [20, hl - fl - 1], [31, hl - fl + 1], [31, hl - fl + 5], [27, hl - fl + 7], [27, hl - fl + 9], [31, hl - fl + 11], [31, hl - 1], [27, hl]], TMAT.holder));
    flangeDetail(g, hl, fl);
    return g;
  }
  flangeDetail(g, hl, fl);
  if (isDrill(T) || T.type === 'tap') {
    // matkap aynası: üç çene, tırtıllı kovan, gövde
    const top = hl - fl, sl = Math.min(hl * 0.72, top - 4);
    const p = [[rs + 0.5, 0], [rs + 3, 2], [11, 8], [18, 14], [22, 18], [22, sl - 6], [24, sl - 4], [24, sl], [16, sl + 1.5], [16, top - 0.5], [31, top + 1], [31, hl - 1], [27, hl]];
    g.add(latheMesh(p, TMAT.holder));
    for (let k = 0; k < 3; k++) { const a = k * TAU / 3, j = box(3, 9, 3, TMAT.bright, Math.cos(a) * (rs + 1.6), 3, Math.sin(a) * (rs + 1.6), g); j.rotation.y = -a; }
    g.add(latheMesh([[22.05, 18.5], [22.05, sl - 6.5]], TMAT.bright, 64));                       // parlak kovan
    for (let k = 0; k < 30; k++) { const a = k / 30 * TAU, kh = sl - 6 - 22, kn = box(0.8, kh, 0.8, DARK, Math.cos(a) * 22.2, 21 + kh / 2, Math.sin(a) * 22.2, g); kn.rotation.y = -a; kn.castShadow = false; }   // tırtıl
    for (let k = 0; k < 3; k++) radial(g, cyl(1.8, 1.8, 2, DARK, 12), 15.6, 12.5, k * TAU / 3 + 0.5);   // anahtar delikleri
  } else if (holderOf(T) && holderOf(T) !== 'er') {
    // V kanallı flanş ortak; burun tutucuya göre
    const F = [[24, hl - fl], [31, hl - fl + 1], [31, hl - fl + 5], [27, hl - fl + 7], [27, hl - fl + 9], [31, hl - fl + 11], [31, hl - 1], [27, hl]];
    const k = holderOf(T);
    if (k === 'shrink') {                                         // ince, uzun konik burun (4.5°), çıplak çelik
      g.add(latheMesh([[rs + 0.3, 0], [rs + 2.6, 0.8], [rs + 2.6 + hl * 0.05, hl * 0.45], [13, hl * 0.62], [17, hl * 0.72], [22, hl - fl - 2], ...F], TMAT.bright));
      const tr = y => rs + 2.62 + hl * 0.05 * y / (hl * 0.45);      // burnun o yükseklikteki yarıçapı
      g.add(latheMesh([[tr(1), 1], [tr(3), 3]], smat(0xa0895e, 0.3, 0.9, 0.7), 40));   // saman sarısı tav rengi
      g.add(latheMesh([[tr(3), 3], [tr(5.5), 5.5]], smat(0x806458, 0.3, 0.9, 0.7), 40)); // bronz-mor
      g.add(latheMesh([[tr(5.5), 5.5], [tr(8), 8]], smat(0x5c6478, 0.3, 0.9, 0.7), 40));   // mavi-gri
    } else if (k === 'hydro') {                                   // silindirik gövde, sıkma vidası
      g.add(latheMesh([[rs + 0.4, 0], [rs + 4, 0.6], [15, 2], [16, 4], [16, hl * 0.6], [19, hl * 0.66], [20, hl - fl - 2], ...F], TMAT.holder));
      g.add(latheMesh([[16.05, 4], [16.05, 9]], TMAT.bright, 48));                            // taşlanmış burun bandı
      capScrew(g, 16, hl * 0.4, 0, 3.2);                                                        // sıkma vidası
    } else {                                                      // Weldon: kalın gövde, yan vida
      g.add(latheMesh([[rs + 0.4, 0], [rs + 6, 0.8], [19, 2.5], [19, hl * 0.62], [22, hl * 0.68], [22, hl - fl - 2], ...F], TMAT.holder));
      capScrew(g, 19, hl * 0.3, 0, 4);                                                          // yan bağlama vidası
    }
  } else {
    // ER pens tutucu: somun, konik gövde, V kanallı flanş
    const nutH = Math.min(14, hl * 0.3);
    const p = [[rs + 0.4, 0], [rs + 4, 0.6], [18.5, 2], [19.5, 3], [19.5, nutH - 1], [18, nutH], [16, nutH + 1], [17, hl * 0.55], [22, hl - fl - 2], [24, hl - fl], [31, hl - fl + 1], [31, hl - fl + 5], [27, hl - fl + 7], [27, hl - fl + 9], [31, hl - fl + 11], [31, hl - 1], [27, hl]];
    g.add(latheMesh(p, TMAT.holder));
    g.add(latheMesh([[18.6, 2.1], [19.6, 3], [19.6, nutH - 1], [18.1, nutH]], TMAT.bright, 64));   // parlak pens somunu
    for (let k = 0; k < 8; k++) { const a = k * TAU / 8 + 0.2, s = box(3.2, 4, 2.2, DARK, Math.cos(a) * 19.2, nutH * 0.55, Math.sin(a) * 19.2, g); s.rotation.y = -a; s.castShadow = false; }   // anahtar yuvaları
    g.add(latheMesh([[rs + 0.25, -0.5], [rs + 3.2, -0.5], [rs + 4.2, 0.5]], TMAT.bright, 40));      // pens ucu
    for (let k = 0; k < 8; k++) { const a = k * TAU / 8, sl2 = box(0.5, 1.2, 3.4, DARK, Math.cos(a) * (rs + 2), -0.2, Math.sin(a) * (rs + 2), g); sl2.rotation.y = -a + Math.PI / 2; sl2.castShadow = false; }   // pens yarıkları
  }
  return g;
}
let dialNeedle = null, dialTurns = null, dialTex = null;
// kadran yüzü: 100 bölmeli beyaz kadran, küçük tur kadranı
function dialTexture3B() {
  if (dialTex) return dialTex;
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
  g.fillStyle = '#f3f1ea'; g.beginPath(); g.arc(128, 128, 126, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#1b1d1f'; g.fillStyle = '#1b1d1f'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = '600 15px sans-serif';
  for (let k = 0; k < 100; k++) {
    const a = k / 100 * Math.PI * 2 - Math.PI / 2, r0 = k % 10 ? (k % 5 ? 108 : 102) : 96;
    g.lineWidth = k % 10 ? 1.4 : 2.4; g.beginPath(); g.moveTo(128 + Math.cos(a) * r0, 128 + Math.sin(a) * r0); g.lineTo(128 + Math.cos(a) * 118, 128 + Math.sin(a) * 118); g.stroke();
    if (!(k % 10)) g.fillText(String(k), 128 + Math.cos(a) * 82, 128 + Math.sin(a) * 82);
  }
  g.strokeStyle = '#c0271c'; g.lineWidth = 6; g.beginPath(); g.arc(128, 128, 121, Math.PI * 0.62, Math.PI * 0.88); g.stroke();
  g.font = '700 16px sans-serif'; g.fillText('3B-TASTER', 128, 104); g.font = '11px sans-serif'; g.fillText('0.01 mm', 128, 150);
  g.strokeStyle = '#1b1d1f'; g.lineWidth = 1.2; g.beginPath(); g.arc(128, 176, 18, 0, Math.PI * 2); g.stroke();
  for (const [t, k] of [['-1', -1], ['0', 0], ['1', 1], ['2', 2]]) { const a = k / 6 * Math.PI * 2 - Math.PI / 2; g.fillText(t, 128 + Math.cos(a) * 11, 176 + Math.sin(a) * 11); }
  dialTex = new THREE.CanvasTexture(c); dialTex.encoding = THREE.sRGBEncoding; return dialTex;
}
function buildToolVisual() {
  while (toolRot.children.length) toolRot.remove(toolRot.children[0]);
  buildToolInto(toolRot, tool(), S.broken);
}
function buildToolInto(grp, T, broken) {
  const r = T.d / 2, L = T.len, g = geoOf(T), coat = TMAT[g.coat] || TMAT.carbide;
  const place = (o, y0) => { o.position.y = -L + y0; grp.add(o); return o; };
  // tutucu: takım çıkıntısının üstünde
  const hl = L - T.stick;
  place(holderMesh(T, hl), T.stick);
  const kf = broken ? 0.28 + ([...String(T.no)].reduce((a, c) => a + c.charCodeAt(0), 0) % 17) / 17 * 0.3 : 1;   // kırılma yeri takıma göre
  const flute = broken ? Math.max(2, T.flute * kf) : T.flute, off = broken ? T.flute - flute : 0;
  if (T.type === 'face') {
    // kabuk alın frezesi (90° omuz): siyah oksitli gövde, her ağzın önünde talaş cebi, eksenel eğimle oturan vidalı
    // paralelkenar karbür uç (APKT 1604), üstte malafa bağlama cıvatası ve sürücü kamaları
    const H = T.stick - 2, rb = r - 2.5, z = T.z, pitch = TAU / z;
    const body = new THREE.Mesh(shellBody(rb, z, H), TMAT.holder); body.castShadow = true; place(body, 0);
    if (!broken) for (let k = 0; k < z; k++) {
      const ins = new THREE.Group(); ins.rotation.y = -k * pitch; place(ins, 0);
      const seat = new THREE.Group(); seat.rotation.x = -0.14; ins.add(seat);           // eksenel eğim ~8°
      const p = new THREE.Mesh(apktGeo(), TMAT.altin); p.castShadow = true;
      p.position.set(r - 9.5, -0.6, 0.35); seat.add(p);                                 // cebin arka duvarına dayalı; dış kenar r'de, alt kenar 0.6 aşağı
      const sc = cyl(2.5, 2.1, 1.2, TMAT.bright, 16); sc.rotation.x = Math.PI / 2; sc.position.set(r - 4.75, 7.4, 4.6); seat.add(sc);   // Torx vida başı
      const tx = cyl(1.1, 1.1, 0.4, smat(0x0c0d0e, 0.6, 0.4), 6); tx.rotation.x = Math.PI / 2; tx.position.set(r - 4.75, 7.4, 5.1); seat.add(tx);
    }
    // üst yüz: bağlama cıvatası (havşa yuvalı başlık) ve iki sürücü kaması
    place(latheMesh([[0, H], [10, H], [10, H + 6], [8.5, H + 7], [0, H + 7]], TMAT.holder, 32), 0);
    const hex = cyl(4, 4, 1.2, smat(0x0c0d0e, 0.6, 0.4), 6); place(hex, H + 6.6);
    for (const s of [-1, 1]) { const key = box(6, 6, 10, TMAT.bright, s * 13, 0, 0); place(key, H + 3); }
    return;
  }
  if (T.type === 'dial') {
    // mekanik 3B taster (kadran saati biçimi): yakut bilye, ince paslanmaz stylus ve stylus yuvası; ekseni operatöre bakan
    // yassı yuvarlak paslanmaz kasa, önde krom çerçeve ve kubbeli cam, yanlarda vida delikleri; üstte kademeli boyun ve şaft
    const Y = 54, R = 26, D = 11;                                  // kasa merkezi (uçtan), yarıçapı, yarı derinliği
    const b = new THREE.Mesh(new THREE.SphereGeometry(r, 32, 20), TMAT.ruby); b.castShadow = true; place(b, r);
    place(latheMesh([[0.9, r * 1.6], [1.0, 18], [1.6, 19], [1.6, 22]], TMAT.bright, 20), 0);                          // stylus
    place(latheMesh([[1.6, 22], [3.2, 22.5], [3.2, 26], [4.5, 26.5], [4.5, Y - R + 1.5]], TMAT.bright, 24), 0);       // stylus yuvası
    const cs = new THREE.Mesh(new THREE.CylinderGeometry(R, R, 2 * D, 72), TMAT.bright); cs.rotation.x = Math.PI / 2; cs.castShadow = true; place(cs, Y);
    const back = new THREE.Mesh(new THREE.CylinderGeometry(R - 1.6, R - 0.4, 1.2, 72), TMAT.bright); back.rotation.x = Math.PI / 2; place(back, Y).position.z = -D - 0.6;
    const bez = new THREE.Mesh(new THREE.TorusGeometry(R - 1.4, 2.4, 16, 72), TMAT.bright); bez.castShadow = true; place(bez, Y).position.z = D + 0.6;   // ön çerçeve
    const face = new THREE.Mesh(new THREE.CircleGeometry(R - 3.6, 64), new THREE.MeshStandardMaterial({ map:dialTexture3B(), roughness:0.5 }));
    place(face, Y).position.z = D + 0.2;
    const GR = 70, ga = Math.asin((R - 3) / GR), gh = GR - Math.sqrt(GR * GR - (R - 3) * (R - 3));
    const glass = new THREE.Mesh(new THREE.SphereGeometry(GR, 48, 6, 0, TAU, 0, ga), new THREE.MeshStandardMaterial({ color:0xffffff, roughness:0.04, metalness:0, transparent:true, opacity:0.12, depthWrite:false }));
    glass.material.envMapIntensity = 1.2; glass.rotation.x = Math.PI / 2; place(glass, Y).position.z = D + 1.6 + gh - GR;   // kubbeli cam
    for (const sx of [-1, 1]) for (const dy of [-9, 9]) {                                                             // yan vida delikleri
      const h = cyl(1.8, 1.8, 0.6, DARK, 14); h.rotation.z = Math.PI / 2; place(h, Y + dy).position.x = sx * (R + 0.02);
    }
    place(latheMesh([[5, Y + R - 1], [5, Y + R + 3], [7.5, Y + R + 3.5], [7.5, Y + R + 8], [6, Y + R + 8.5], [6, Y + R + 11], [8, Y + R + 11.5], [8, T.stick]], TMAT.bright, 40), 0);   // boyun ve şaft
    const nd = new THREE.Group(), tn = new THREE.Group();
    const n1 = box(0.9, 18, 0.4, TMAT.red, 0, 7.5, 0, nd); n1.castShadow = false;                                   // kırmızı ana ibre
    const hub = cyl(1.6, 1.6, 0.8, TMAT.holder, 16); hub.rotation.x = Math.PI / 2; nd.add(hub);
    const n2 = box(0.6, 2.6, 0.3, TMAT.holder, 0, 1.3, 0, tn); n2.castShadow = false;
    place(nd, Y).position.z = D + 0.9;
    place(tn, Y - 7.5).position.z = D + 0.6;                       // küçük tur ibresi
    if (grp === toolRot) { dialNeedle = nd; dialTurns = tn; }
    return;
  }
  if (T.type === 'probe') {
    // 3B taster: yakut bilye, karbür stylus ve paslanmaz stylus tutucu; altta lastik conta, paslanmaz gövde,
    // gövdeyi saran koyu LED penceresi ve içinde dört LED (temasta kırmızı yanar), üstte şaft
    const b = new THREE.Mesh(new THREE.SphereGeometry(r, 32, 20), TMAT.ruby); b.castShadow = true; place(b, r);
    place(latheMesh([[0.8, r * 1.7], [0.9, 22], [1.4, 25], [1.4, 27]], TMAT.carbide, 24), 0);              // stylus
    place(latheMesh([[1.4, 27], [3, 27.5], [3, 31], [2.4, 31.6]], TMAT.bright, 24), 0);                    // M4 stylus tutucu
    place(latheMesh([[2.4, 31.6], [7.5, 32], [9, 33.5], [9, 35]], TMAT.holder, 40), 0);                   // lastik conta
    place(latheMesh([[9, 35], [12, 35.5], [12.5, 37], [12.5, 45], [12.5, 51], [12.5, 54.5], [11, 56], [8, T.stick]], TMAT.bright, 48), 0);   // gövde
    place(latheMesh([[12.55, 45.4], [12.55, 50.6]], smat(0x0d1013, 0.15, 0.2, 0.9), 48), 0);               // LED penceresi
    for (let k = 0; k < 4; k++) {
      const a = k * TAU / 4 + Math.PI / 4, led = new THREE.Mesh(new THREE.SphereGeometry(0.9, 10, 8), TMAT.led);
      led.position.set(Math.cos(a) * 12.4, 0, Math.sin(a) * 12.4); place(led, 48);
    }
    markShank(Object.assign({}, T, { flute:35, stick:45 }), 12.5, { coat:'probe' }, place, 'SNOOP 3D');   // LED penceresinin altında
    return;
  }
  if (T.type === 'edge') {
    place(latheMesh([[5, 0], [5, 11], [3.5, 11.5], [3.5, 12.5], [5, 13], [5, T.stick]], TMAT.bright, 32), 0);
    place(latheMesh([[5.05, 4], [5.05, 7], [0, 7]], TMAT.red, 32), 0);
    return;
  }
  // şaft: kanalın üstünden tutucuya kadar, üstte pah
  place(latheMesh([[r * 0.97, 0], [r, 0.6], [r, T.stick - T.flute], [r * 0.9, T.stick - T.flute + 0.8]], coat === TMAT.tin ? TMAT.tin : T.type === 'tap' || T.tm === 'hss' ? TMAT.hss : TMAT.carbide, 40), T.flute);
  markShank(T, r, g, place);
  const fg = fluteGeo(r, T.z, flute, broken ? Object.assign({}, g, { tip:'flat', corner:0 }) : g, Object.assign(T.type === 'tap' ? { p:T.p } : {}, { noCap:broken }));
  const body = new THREE.Mesh(fg, coat); body.castShadow = true; place(body, off);
  if (broken) { const fr = new THREE.Mesh(fractureTool(fg, r, flute, Math.max(48, T.z * 28), T.no), TMAT.broken); fr.castShadow = true; place(fr, off); }
}
/* Kırık takım: karbür gevrek kırılır; kırık hattı eğik ve dalgalı, yüzeyi mat gri ve kristal (küçük düzlemler).
   Kanallı gövdenin alt satırları kırık hattına bükülür; alttaki boşluğa kırık yüzeyi örülür. Şekil takım numarasından
   gelir (her çizimde aynı). seg: kanallı gövdenin çevre bölümü (satır başına seg + 1 köşe). */
function fractureTool(geo, r, len, seg, no) {
  let sd = [...String(no)].reduce((a, c) => a * 31 + c.charCodeAt(0), 7) % 2147483647 || 1;
  const R = () => (sd = sd * 16807 % 2147483647) / 2147483647;
  const tilt = 0.25 + R() * 0.35, phi = R() * TAU, amp = r * 0.12;
  const harm = [1, 2, 3, 5, 8].map(k => ({ k, a:R() * TAU, m:amp / k }));
  const band = Math.min(len * 0.85, r * 2.4);
  const h = th => Math.min(band * 0.7, amp + r * tilt * (1 + Math.cos(th - phi)) + harm.reduce((s, q) => s + q.m * Math.sin(q.k * th + q.a), 0));
  const P = geo.attributes.position;
  for (let i = 0; i < P.count; i++) {
    const x = P.getX(i), y = P.getY(i), z = P.getZ(i);
    if (y >= band) continue;
    const hh = Math.max(0, h(Math.atan2(z, x)));
    P.setY(i, hh + y * (band - hh) / band);
  }
  P.needsUpdate = true; geo.computeVertexNormals();
  // kırık yüzeyi: dış halka kanallı gövdenin en alt satırı, merkeze doğru 5 halka, ufak pürüzlerle
  const W = seg + 1, NR = 5, pos = [], idx = [];
  let hc = 0; for (let j = 0; j < W; j++) hc += P.getY(j); hc = hc / W + (R() - 0.5) * r * 0.25;
  for (let k = 0; k < NR; k++) {
    const f = 1 - k / NR;
    for (let j = 0; j < W; j++) {
      const x = P.getX(j), y = P.getY(j), z = P.getZ(j);
      const jit = k ? (R() - 0.5) * r * 0.09 : 0;
      pos.push(x * f, y * f + hc * (1 - f) + jit, z * f);
    }
  }
  const c = pos.length / 3; pos.push(0, hc, 0);
  for (let k = 0; k < NR - 1; k++) for (let j = 0; j < seg; j++) { const a = k * W + j, b = a + 1, d = a + W, e = d + 1; idx.push(a, b, d, b, e, d); }
  for (let j = 0; j < seg; j++) idx.push((NR - 1) * W + j, (NR - 1) * W + j + 1, c);
  const fg = new THREE.BufferGeometry();
  fg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); fg.setIndex(idx); fg.computeVertexNormals();
  return fg;
}

// şaft üstündeki lazer yazısı: eksen boyunca, operatöre bakan yüzde; takımla birlikte döner
const COATNAME = { altin:'AlTiN', tin:'TiN', dlc:'DLC', carbide:'K20F', hss:'HSS-Co' };
const markCache = {};
function markShank(T, r, g, place, override) {
  const shank = T.stick - T.flute;
  if (shank < 6 || (T.type === 'face' && !override)) return;
  const txt = override ? override : T.type === 'tap' ? `SNOOP  M${T.d}×${T.p}  HSS-E` : `SNOOP  Ø${T.d}  ${isDrill(T) ? (T.tm === 'hss' || !T.tm ? 'HSS-Co' : 'VHM') : 'Z' + T.z}  ${COATNAME[g.coat] || ''}`;
  // yazı alanı: eksen boyunca h, çevre boyunca arc·r (mm); tuval bu orana göre, harf yüksekliği ~1.6 mm (küçük takımda çapın üçte biri)
  const h = Math.min(shank * 0.85, r * 9), arc = Math.min(1.4, 9 / r), wmm = arc * r;
  const key = `${txt}|${h.toFixed(1)}|${wmm.toFixed(1)}`;
  if (!markCache[key]) {
    const W = 96, Hp = Math.max(64, Math.round(W * h / wmm));
    const cv = document.createElement('canvas'); cv.width = W; cv.height = Hp;
    const c = cv.getContext('2d');
    c.translate(W / 2, Hp / 2); c.rotate(-Math.PI / 2);
    c.fillStyle = 'rgba(16,16,20,0.9)'; c.textAlign = 'center'; c.textBaseline = 'middle';
    let fs = W * Math.min(0.45, Math.min(1.6, r * 0.66) / wmm);
    c.font = `600 ${fs}px "Chakra Petch", "Segoe UI", sans-serif`;
    const tw = c.measureText(txt).width; if (tw > Hp * 0.94) { fs *= Hp * 0.94 / tw; c.font = `600 ${fs}px "Chakra Petch", "Segoe UI", sans-serif`; }
    c.fillText(txt, 0, 0);
    const tex = new THREE.CanvasTexture(cv); tex.encoding = THREE.sRGBEncoding; tex.anisotropy = 4;
    markCache[key] = new THREE.MeshStandardMaterial({ map:tex, transparent:true, depthWrite:false, roughness:0.7, metalness:0.2,
      polygonOffset:true, polygonOffsetFactor:-2, polygonOffsetUnits:-2 });
  }
  const sl = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.003, r * 1.003, h, 24, 1, true, -arc / 2, arc), markCache[key]);
  place(sl, T.flute + 1 + shank * 0.45);
}

/* ---------------- Kesme / çarpışma mantığı ---------------- */
function profile(T, d, tip) {
  const r = T.d / 2;
  switch (T.type) {
    case 'ball': case 'dial': return tip + r - Math.sqrt(Math.max(0, r * r - d * d));
    case 'end': { const R = T.cr || 0, q = d - (r - R); return R > 0 && q > 0 ? tip + R - Math.sqrt(Math.max(0, R * R - q * q)) : tip; }
    case 'chamfer': return tip + d / T.tanTip;
    case 'drill': return tip + d / (T.tanTip || TAN59);
    case 'spot': return tip + d;
    default: return tip;
  }
}
Object.assign(app, { TMAT, profile });   // önceki modüllerin geç başvuruları

export { HKEY, HOLDERS, HSEL, TMAT, buildToolInto, buildToolVisual, dialNeedle, dialTurns, geoOf, holderOf,
  holderR, holds, profile };
