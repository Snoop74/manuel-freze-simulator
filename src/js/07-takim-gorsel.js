// ── Takım görselleri ve tutucular: helisli gövdeler, ER/Weldon/shrink/hidrolik, kadranlı taster, takım profili
const TMAT = {
  carbide: smat(0xa3aaaf, 0.26, 0.92, 0.9),           // kaplamasız karbür
  altin:   smat(0x46424e, 0.32, 0.85, 0.9),           // AlTiN kaplama: koyu mor-gri
  tin:     smat(0xc9a03a, 0.28, 0.9, 0.9),            // TiN kaplama: altın sarısı
  dlc:     smat(0x1f2024, 0.3, 0.8, 0.9),             // DLC kaplama: siyah
  hss:     smat(0xc3c8cc, 0.22, 0.92, 0.9),           // taşlanmış HSS
  holder:  smat(0x2b2e31, 0.38, 0.85, 0.7),           // siyah oksit tutucu
  bright:  smat(0x9aa2a7, 0.22, 0.95, 0.9),           // taşlanmış çelik yüzey
  insert:  smat(0x2c2c31, 0.4, 0.7, 0.8),             // karbür uç (koyu)
  broken:  smat(0x6b2a22, 0.8, 0.2, 0.3),
  ruby:    smat(0xa0101c, 0.12, 0.1, 0.9),            // taster bilyesi
  led:     new THREE.MeshStandardMaterial({ color:0x111a14, emissive:0x0b3a12, roughness:0.3 }),
  red:     smat(0xb8442e, 0.4, 0.5, 0.6),
};
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
try { HSEL = JSON.parse(localStorage.getItem(HKEY) || '{}') || {}; } catch (e) { HSEL = {}; }
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
  const pos = [], idx = [];
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
      pos.push(Math.cos(th) * rr, y, Math.sin(th) * rr);
    }
  }
  const W = seg + 1;
  for (let k = 0; k < ys.length - 1; k++) for (let j = 0; j < seg; j++) {
    const a = k * W + j, b = a + 1, c = a + W, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  if (g.tip === 'flat' || g.tip === 'lead') {                     // alt yüz
    const c0 = pos.length / 3; pos.push(0, 0, 0);
    for (let j = 0; j < seg; j++) idx.push(c0, j, j + 1);
  }
  const top = pos.length / 3; pos.push(0, len, 0);                 // üst kapak (şaftın altında kalır)
  for (let j = 0; j < seg; j++) idx.push(top, (ys.length - 1) * W + j + 1, (ys.length - 1) * W + j);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx); geo.computeVertexNormals();
  return geo;
}
// tornalanmış tutucu: (yarıçap, yükseklik) profilinden döndürülür; 0 = alt uç
function latheMesh(pts, m, seg = 48) {
  const g = new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(Math.max(0.01, x), y)), seg);
  const o = new THREE.Mesh(g, m); o.castShadow = true; return o;
}
// pens takım tutucu (ER somunlu) ya da matkap aynası; hl: tutucu boyu, rs: şaft yarıçapı
function holderMesh(T, hl) {
  const g = new THREE.Group(), rs = Math.min(T.d / 2, 8);
  const fl = 14;
  if (T.type === 'face') {                                        // kabuk freze malafası: kısa ve kalın
    g.add(latheMesh([[9, 0], [9, hl - fl - 4], [20, hl - fl - 1], [31, hl - fl + 1], [31, hl - fl + 5], [27, hl - fl + 7], [27, hl - fl + 9], [31, hl - fl + 11], [31, hl - 1], [27, hl]], TMAT.holder));
    return g;
  }
  if (isDrill(T) || T.type === 'tap') {
    // matkap aynası: üç çene, tırtıllı kovan, gövde
    const top = hl - fl, sl = Math.min(hl * 0.72, top - 4);
    const p = [[rs + 0.5, 0], [rs + 3, 2], [11, 8], [18, 14], [22, 18], [22, sl - 6], [24, sl - 4], [24, sl], [16, sl + 1.5], [16, top - 0.5], [31, top + 1], [31, hl - 1], [27, hl]];
    g.add(latheMesh(p, TMAT.holder));
    for (let k = 0; k < 3; k++) { const a = k * TAU / 3, j = box(3, 9, 3, TMAT.bright, Math.cos(a) * (rs + 1.6), 3, Math.sin(a) * (rs + 1.6), g); j.rotation.y = -a; }
    for (let k = 0; k < 22; k++) { const a = k / 22 * TAU, kh = sl - 6 - 20, kn = box(1.2, kh, 1.4, TMAT.bright, Math.cos(a) * 22.3, 20 + kh / 2, Math.sin(a) * 22.3, g); kn.rotation.y = -a; kn.castShadow = false; }   // tırtıllı kovan
  } else if (holderOf(T) && holderOf(T) !== 'er') {
    // V kanallı flanş ortak; burun tutucuya göre
    const F = [[24, hl - fl], [31, hl - fl + 1], [31, hl - fl + 5], [27, hl - fl + 7], [27, hl - fl + 9], [31, hl - fl + 11], [31, hl - 1], [27, hl]];
    const k = holderOf(T);
    if (k === 'shrink') {                                         // ince, uzun konik burun (4.5°), çıplak çelik
      g.add(latheMesh([[rs + 0.3, 0], [rs + 2.6, 0.8], [rs + 2.6 + hl * 0.05, hl * 0.45], [13, hl * 0.62], [17, hl * 0.72], [22, hl - fl - 2], ...F], TMAT.bright));
      g.add(latheMesh([[rs + 2.62, 2], [rs + 2.62, 4]], TMAT.holder, 40));   // ısı halkası izi
    } else if (k === 'hydro') {                                   // silindirik gövde, sıkma vidası
      g.add(latheMesh([[rs + 0.4, 0], [rs + 4, 0.6], [15, 2], [16, 4], [16, hl * 0.6], [19, hl * 0.66], [20, hl - fl - 2], ...F], TMAT.holder));
      const sc = cyl(2.6, 2.6, 4, TMAT.bright, 12); sc.rotation.z = Math.PI / 2; sc.position.set(16.5, hl * 0.4, 0); g.add(sc);
    } else {                                                      // Weldon: kalın gövde, yan vida
      g.add(latheMesh([[rs + 0.4, 0], [rs + 6, 0.8], [19, 2.5], [19, hl * 0.62], [22, hl * 0.68], [22, hl - fl - 2], ...F], TMAT.holder));
      const sc = cyl(3.4, 3.4, 5, TMAT.bright, 6); sc.rotation.z = Math.PI / 2; sc.position.set(19.5, hl * 0.3, 0); g.add(sc);
    }
  } else {
    // ER pens tutucu: somun, konik gövde, V kanallı flanş
    const nutH = Math.min(14, hl * 0.3);
    const p = [[rs + 0.4, 0], [rs + 4, 0.6], [18.5, 2], [19.5, 3], [19.5, nutH - 1], [18, nutH], [16, nutH + 1], [17, hl * 0.55], [22, hl - fl - 2], [24, hl - fl], [31, hl - fl + 1], [31, hl - fl + 5], [27, hl - fl + 7], [27, hl - fl + 9], [31, hl - fl + 11], [31, hl - 1], [27, hl]];
    g.add(latheMesh(p, TMAT.holder));
    for (let k = 0; k < 4; k++) { const a = k * TAU / 4 + 0.4, s = box(3, nutH * 0.7, 2.4, TMAT.bright, Math.cos(a) * 19.4, nutH * 0.5, Math.sin(a) * 19.4, g); s.rotation.y = -a; s.castShadow = false; }   // somun anahtar yuvaları
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
  const flute = broken ? Math.max(2, T.flute * 0.3) : T.flute, off = broken ? T.flute - flute : 0;
  if (T.type === 'face') {
    // alın frezesi: talaş cepli gövde, vidalı kare karbür uçlar, merkez bağlama cıvatası
    const body = new THREE.Mesh(fluteGeo(r - 3, T.z, T.stick - 2, g), TMAT.holder); body.castShadow = true; place(body, 2);
    place(latheMesh([[r - 3, 0], [r - 3, 1.5], [r - 6, 2]], TMAT.holder), 0);
    if (!broken) for (let k = 0; k < T.z; k++) {
      const a = k / T.z * TAU + 0.22, ins = new THREE.Group(); ins.rotation.y = -a; place(ins, 0);
      const plate = box(12, 12, 4.2, TMAT.insert, r - 6, 6, -1, ins); plate.rotation.z = -0.25; plate.rotation.x = 0.1;
      const edge = box(12.2, 1.1, 4.3, TMAT.tin, r - 6, 0.7, -1, ins); edge.castShadow = false;   // kaplamalı kesici kenar
      const sc = cyl(2.2, 2.2, 1.4, TMAT.bright, 8); sc.rotation.x = Math.PI / 2; sc.position.set(r - 6.5, 6.5, 1.3); ins.add(sc);   // uç vidası
    }
    place(latheMesh([[0, T.stick - 2], [9, T.stick - 2], [9, T.stick + 3], [0, T.stick + 3]], TMAT.bright, 6), 0);
    return;
  }
  if (T.type === 'dial') {
    // mekanik 3B taster: kırmızı stylus ve bilye, yassı oval gövde, önde kadran (operatöre dönük), üstte şaft
    const b = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 16), TMAT.ruby); b.castShadow = true; place(b, 0);
    place(latheMesh([[0.8, 1.6], [0.8, 20], [1.6, 21], [1.6, 26]], TMAT.red, 20), 0);
    place(latheMesh([[1.6, 26], [5, 28], [6, 31], [6, 33]], TMAT.bright, 24), 0);
    const body = latheMesh([[6, 33], [20, 35], [25, 40], [26, 50], [26, 66], [24, 72], [14, 78], [9, 80]], TMAT.holder, 48); body.scale.z = 0.72; place(body, 0);
    place(latheMesh([[8, 80], [8, T.stick]], TMAT.bright, 32), 0);
    const face = new THREE.Mesh(new THREE.CircleGeometry(20, 48), new THREE.MeshStandardMaterial({ map:dialTexture3B(), roughness:0.5 }));
    place(face, 54).position.z = 26 * 0.72 + 0.3;
    const rim = new THREE.Mesh(new THREE.TorusGeometry(20.6, 1.2, 8, 48), TMAT.holder); place(rim, 54).position.z = 26 * 0.72 + 0.3;
    const nd = new THREE.Group(), tn = new THREE.Group();
    const n1 = box(0.9, 17, 0.4, TMAT.holder, 0, 7, 0, nd); n1.castShadow = false;
    const n2 = box(0.6, 2.6, 0.3, TMAT.red, 0, 1.3, 0, tn); n2.castShadow = false;
    place(nd, 54).position.z = 26 * 0.72 + 0.9;
    place(tn, 54 - 7.5).position.z = 26 * 0.72 + 0.6;          // küçük tur ibresi
    if (grp === toolRot) { dialNeedle = nd; dialTurns = tn; }
    return;
  }
  if (T.type === 'probe') {
    // 3B taster: yakut bilye, karbür stylus, gövde ve temasla kırmızıya dönen LED halkası
    const b = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 16), TMAT.ruby); b.castShadow = true; place(b, r);
    place(latheMesh([[0.9, r * 1.6], [0.9, 30], [2.2, 31], [2.2, 33]], TMAT.carbide, 24), 0);
    place(latheMesh([[2.2, 33], [8, 36], [10, 39], [10, 44], [10.4, 44.5], [10.4, 48.5], [10, 49], [10, T.stick - 3], [7, T.stick]], TMAT.holder, 40), 0);
    place(latheMesh([[10.45, 44.8], [10.45, 48.2]], TMAT.led, 40), 0);
    return;
  }
  if (T.type === 'edge') {
    place(latheMesh([[5, 0], [5, 11], [3.5, 11.5], [3.5, 12.5], [5, 13], [5, T.stick]], TMAT.bright, 32), 0);
    place(latheMesh([[5.05, 4], [5.05, 7], [0, 7]], TMAT.red, 32), 0);
    return;
  }
  // şaft: kanalın üstünden tutucuya kadar, üstte pah
  place(latheMesh([[r * 0.97, 0], [r, 0.6], [r, T.stick - T.flute], [r * 0.9, T.stick - T.flute + 0.8]], coat === TMAT.tin ? TMAT.tin : T.type === 'tap' || T.tm === 'hss' ? TMAT.hss : TMAT.carbide, 40), T.flute);
  const fg = fluteGeo(r, T.z, flute, broken ? Object.assign({}, g, { tip:'flat', corner:0 }) : g, T.type === 'tap' ? { p:T.p } : {});
  const body = new THREE.Mesh(fg, coat); body.castShadow = true; place(body, off);
  if (broken) place(latheMesh([[0, -0.6], [r * 0.95, -0.6], [r * 0.9, 0.4], [0, 0.4]], TMAT.broken, 24), off);
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
