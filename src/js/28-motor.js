// ── Otto'nun motoru (MO): çalışma tezgâhındaki sehpada tek silindirli 250 cc motor; tekme marş, jikle, benzin musluğu, kontak, gaz, kesit görünümü
import { $, S, app, clamp, log } from './00-temel.js';
import { ac, bus, initAudio, noiseBuffer } from './01-ses.js';
import { FLOOR_Y, camera, canvas, controls, renderer, scene } from './02-sahne-tezgah.js';

/* "His testi" (2026-11-06): büyük proje (motosiklet) için önce motorun çalışma hissi denenir. İşlenen parça yok; kalite bağlantısı
   ileride: silindir kapağı yüzeyi → kompresyon kaybı (kayip), supap kapağı → yağ sızıntısı.
   Fizik: krank açısı th (4π'lik çevrim: emme 0–π, sıkıştırma π–2π, iş 2π–3π, egzoz 3π–4π), açısal hız w (rad/s).
   Sıkıştırma bir gaz yayıdır: ÜÖN'den önce direnir, sonra kayıplı geri iter; ateşleme ÜÖN'ü geçerken karar verilir.
   Rölantideki dalgalanma, soğukta stop etme, tekmede kompresyona takılma bu denklemden kendiliğinden çıkar (araç: scratchpad motor-fizik.mjs). */
const MO = (() => {
  const EX = 2150, EY = FLOOR_Y + 880, EZ = -1400;               // sehpa: çalışma tezgâhının ortası (solda montaj yeri, sağda mengene)
  const P = { I:0.6, Kc:2600, wc:0.55, Kp:4200, ap:0.55, f0:14, f1:0.07, f2:0.00062, kayip:0.82, hava:0.1, tekme:2500, bacak:60, oran:9 };
  const TILT = 0.21, CR = 31, CL = 110, KY = 250;                // silindir öne eğik (12°), strok 62 (krank yarıçapı 31), biyel 110; krank ekseni sehpadan 250 yukarıda
  const grp = new THREE.Group(); grp.position.set(EX, EY, EZ); scene.add(grp);
  const eng = new THREE.Group(); eng.position.y = KY; grp.add(eng);   // titreşen kısım (sehpa durur)
  const kes = new THREE.Plane(new THREE.Vector3(0, 0, -1), EZ);  // kesit: motorun orta düzlemi, öndeki yarı kesilir
  const std = (hex, r, m, o = {}) => new THREE.MeshStandardMaterial(Object.assign({ color:new THREE.Color(hex).convertSRGBToLinear(), roughness:r, metalness:m }, o));
  const mt = {
    alu:std(0xc4c8c9, 0.32, 0.85), aluMat:std(0x9ea3a4, 0.55, 0.7), fin:std(0x1c1d1f, 0.55, 0.35), finE:std(0xb8bcbd, 0.3, 0.85),
    chrome:std(0xe6eaec, 0.08, 1), shield:std(0x161718, 0.5, 0.4), rubber:std(0x111112, 0.85, 0), steel:std(0x8e969a, 0.35, 0.8),
    frame:std(0x2c3a33, 0.6, 0.3), red:std(0xa3221c, 0.5, 0.1), brass:std(0xb08d3c, 0.35, 0.9), tank:std(0x6b7a3a, 0.5, 0.25),
    piston:std(0xd6d8d6, 0.4, 0.8), rod:std(0x7d858a, 0.35, 0.85), glow:new THREE.MeshBasicMaterial({ color:0xff9a3c, transparent:true, opacity:0, depthWrite:false }),
    hit:new THREE.MeshBasicMaterial({ transparent:true, opacity:0, depthWrite:false }),
  };
  const KESILEN = [mt.alu, mt.aluMat, mt.fin, mt.finE, mt.chrome, mt.shield, mt.rubber];   // kesitte yarısı kesilen dış gövde
  const add = (g, geo, mat, x = 0, y = 0, z = 0, gol = true) => { const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); o.castShadow = gol; o.receiveShadow = true; g.add(o); return o; };
  const kutu = (w, h, d, r = 2) => {                               // yuvarlatılmış kutu (köşe pahlı ekstrüzyon)
    const s = new THREE.Shape(), a = w / 2 - r, b = h / 2 - r;
    s.moveTo(-a, -h / 2); s.lineTo(a, -h / 2); s.absarc(a, -b, r, -Math.PI / 2, 0); s.lineTo(w / 2, b); s.absarc(a, b, r, 0, Math.PI / 2);
    s.lineTo(-a, h / 2); s.absarc(-a, b, r, Math.PI / 2, Math.PI); s.lineTo(-w / 2, -b); s.absarc(-a, -b, r, Math.PI, Math.PI * 1.5);
    const g = new THREE.ExtrudeGeometry(s, { depth:d - r, bevelEnabled:true, bevelThickness:r / 2, bevelSize:r / 2, bevelSegments:2, curveSegments:4 });
    g.translate(0, 0, -(d - r) / 2); return g;
  };
  const silindir = (r, h, seg = 28) => new THREE.CylinderGeometry(r, r, h, seg);

  /* -- Sehpa: tezgâha cıvatalı kare profil çerçeve, iki motor bağlantı kulağı, kontak kutusu -- */
  {
    add(grp, kutu(440, 10, 220, 3), mt.frame, 20, 5, 0);
    for (const x of [-150, 170]) {
      add(grp, kutu(40, 150, 40, 3), mt.frame, x, 80, -60); add(grp, kutu(40, 150, 40, 3), mt.frame, x, 80, 60);
      add(grp, kutu(40, 14, 160, 3), mt.frame, x, 160, 0);
      for (const z of [-90, 90]) add(grp, silindir(9, 6, 6), mt.steel, x, 13, z, false);   // tezgâha cıvatalar
    }
    add(grp, kutu(80, 50, 40, 4), mt.shield, 230, 40, 95);          // kontak kutusu
  }
  const anahtar = new THREE.Group(); anahtar.position.set(230, 40, 116); grp.add(anahtar);
  add(anahtar, silindir(9, 6, 20), mt.chrome, 0, 0, 0, false).rotation.x = Math.PI / 2;
  add(anahtar, kutu(8, 26, 3, 1), mt.brass, 0, 0, 8, false);
  add(anahtar, kutu(22, 16, 3, 3), mt.shield, 0, 18, 8, false);

  /* -- Karter: yan profil ekstrüzyonu (krank yuvarlağı + arkada şanzıman), sağda debriyaj kapağı, solda manyeto kapağı -- */
  {
    const s = new THREE.Shape();
    s.absarc(0, 0, 112, Math.PI * 0.55, Math.PI * 1.62, false);
    s.absarc(150, -30, 92, Math.PI * 1.45, Math.PI * 0.35, false);
    s.lineTo(30, 95); s.lineTo(-35, 108);
    const g = new THREE.ExtrudeGeometry(s, { depth:180, bevelEnabled:true, bevelThickness:6, bevelSize:6, bevelSegments:3, curveSegments:24 });
    g.translate(0, 0, -90); add(eng, g, mt.alu);
    const k = new THREE.Shape(); k.absarc(20, -10, 95, 0, Math.PI * 2, false);   // sağ (oyuncuya bakan) yan kapak
    const kg = new THREE.ExtrudeGeometry(k, { depth:16, bevelEnabled:true, bevelThickness:5, bevelSize:5, bevelSegments:3, curveSegments:32 });
    kg.translate(0, 0, 96); add(eng, kg, mt.alu);
    add(eng, silindir(52, 18, 36), mt.alu, 40, -5, 128).rotation.x = Math.PI / 2;   // debriyaj kubbesi
    for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2; add(eng, silindir(4.5, 6, 6), mt.steel, 20 + Math.cos(a) * 86, -10 + Math.sin(a) * 86, 120, false).rotation.x = Math.PI / 2; }
    add(eng, silindir(70, 22, 36), mt.aluMat, -10, 0, -104).rotation.x = Math.PI / 2;   // manyeto kapağı
    add(eng, kutu(18, 18, 30, 3), mt.steel, 215, -60, -100);       // vites mili
  }
  /* -- Silindir (siyah kanatçıklı, kenarları parlak) ve silindir kapağı; eksen öne 12° eğik -- */
  const cyl = new THREE.Group(); cyl.rotation.z = TILT; eng.add(cyl);
  {
    add(cyl, silindir(46, 110, 32), mt.fin, 0, 125, 0);
    for (let i = 0; i < 8; i++) { const y = 78 + i * 13; add(cyl, kutu(150 - i * 2, 4, 140 - i * 2, 6), i % 2 ? mt.fin : mt.finE, 0, y, 0); }
    const kap = new THREE.Group(); kap.position.y = 182; cyl.add(kap);   // silindir kapağı: işlenecek ilk parça (ileride)
    add(kap, kutu(160, 26, 146, 6), mt.alu, 0, 13, 0);
    for (let i = 0; i < 4; i++) add(kap, kutu(168 - i * 6, 4, 154 - i * 6, 6), mt.finE, 0, 30 + i * 11, 0);
    add(kap, kutu(120, 40, 100, 8), mt.alu, 0, 52, 0);
    const sk = add(kap, kutu(124, 18, 106, 9), mt.aluMat, 0, 80, 0);   // supap kapağı
    sk.name = 'supapKapagi';
    for (const [x, z] of [[-50, -40], [50, -40], [-50, 40], [50, 40]]) add(kap, silindir(5, 8, 6), mt.steel, x, 92, z, false);
    for (const [x, z] of [[-62, -58], [62, -58], [-62, 58], [62, 58]]) add(kap, silindir(6, 10, 6), mt.steel, x, -2, z, false);   // kapak saplamaları
    const buji = new THREE.Group(); buji.position.set(-10, 45, 60); buji.rotation.x = 0.9; kap.add(buji);
    add(buji, silindir(8, 30, 6), mt.steel, 0, 15, 0, false); add(buji, silindir(9, 34, 16), mt.rubber, 0, 45, 0);
    const kablo = new THREE.CatmullRomCurve3([new THREE.Vector3(-10, 75, 95), new THREE.Vector3(-60, 120, 110), new THREE.Vector3(-150, 60, 120), new THREE.Vector3(-170, -60, 80)]);
    add(kap, new THREE.TubeGeometry(kablo, 20, 3.5, 6), mt.rubber, 0, 0, 0, false);
  }
  /* -- İç parçalar (kesitte görünür): piston, biyel, krank volanları, supaplar, yanma alevi -- */
  const ic = new THREE.Group(); cyl.add(ic);
  const piston = new THREE.Group(); ic.add(piston);
  add(piston, silindir(35.5, 46, 32), mt.piston, 0, -8, 0);
  for (const y of [8, 1]) add(piston, new THREE.TorusGeometry(35.6, 0.9, 6, 32), mt.rod, 0, y, 0, false).rotation.x = Math.PI / 2;
  add(piston, silindir(9, 64, 16), mt.steel, 0, 0, 0, false).rotation.x = Math.PI / 2;   // piston pimi
  const biyel = add(ic, new THREE.BoxGeometry(18, 1, 12), mt.rod);               // boyu her karede ayarlanır (ölçek)
  const krank = new THREE.Group(); ic.add(krank);
  for (const z of [-24, 24]) add(krank, silindir(68, 14, 40), mt.rod, 0, 0, z).rotation.x = Math.PI / 2;
  add(krank, silindir(13, 34, 16), mt.steel, 0, CR, 0).rotation.x = Math.PI / 2;
  add(krank, kutu(30, 40, 40, 6), mt.rod, 0, -50, 0);              // karşı ağırlık izi
  const supap = [];
  for (const [sx, ad] of [[-1, 'egz'], [1, 'emme']]) {
    const v = new THREE.Group(); v.position.set(sx * 20, 200, 0); v.rotation.z = -sx * 0.35; ic.add(v);
    add(v, silindir(3.5, 70, 8), mt.steel, 0, 35, 0, false); add(v, new THREE.CylinderGeometry(16, 4, 5, 20), mt.steel, 0, 0, 0, false);
    add(v, new THREE.TorusGeometry(9, 2, 6, 14), mt.steel, 0, 50, 0, false).rotation.x = Math.PI / 2;
    supap.push({ v, ad, y0:200 });
  }
  const alev = add(ic, new THREE.SphereGeometry(30, 16, 10), mt.glow, 0, 182, 0, false); alev.scale.set(1.1, 0.35, 1.1);

  /* -- Egzoz: kapağın önünden çıkan krom manifold, yanda yukarıda susturucu (scrambler), ısı kalkanı -- */
  const egzUc = new THREE.Vector3();
  {
    const c = new THREE.CatmullRomCurve3([[-70, 210, 30], [-125, 180, 70], [-140, 120, 110], [-70, 100, 142], [80, 108, 146], [200, 132, 136], [262, 142, 125]].map(p => new THREE.Vector3(...p)));
    add(eng, new THREE.TubeGeometry(c, 60, 19, 14), mt.chrome);
    add(eng, silindir(30, 210, 24), mt.shield, 300, 145, 125).rotation.z = -(Math.PI / 2 - 0.35);   // arkaya doğru yükselir
    add(eng, silindir(13, 30, 16), mt.steel, 405, 180, 125).rotation.z = -(Math.PI / 2 - 0.35);
    egzUc.set(425, 187, 125);
  }
  /* -- Emme: kauçuk boğaz, karbüratör (jikle kolu), hava filtresi; üstte deneme deposu, hortum ve benzin musluğu -- */
  const jikleK = new THREE.Group(), muslukK = new THREE.Group();
  {
    const w = new THREE.Group(); w.position.set(80, 215, 0); w.rotation.z = -0.35 + TILT; eng.add(w);
    add(w, silindir(24, 40, 20), mt.rubber, 22, 0, 0).rotation.z = Math.PI / 2;   // kauçuk emme boğazı
    add(w, kutu(56, 60, 64, 6), mt.aluMat, 70, 0, 0); add(w, silindir(20, 36, 18), mt.aluMat, 70, -46, 0);   // gövde ve şamandıra odası
    const fil = add(w, new THREE.CylinderGeometry(58, 40, 90, 24), mt.red, 150, 10, 0); fil.rotation.z = Math.PI / 2;
    add(w, new THREE.CylinderGeometry(60, 60, 8, 24), mt.chrome, 196, 10, 0).rotation.z = Math.PI / 2;
    jikleK.position.set(70, 30, 34); w.add(jikleK);
    add(jikleK, kutu(10, 44, 6, 2), mt.steel, 0, 20, 0, false); add(jikleK, silindir(7, 8, 12), mt.rubber, 0, 44, 0, false).rotation.x = Math.PI / 2;
  }
  {
    const d = new THREE.Group(); d.position.set(250, 300, -40); grp.add(d);   // sehpaya bağlı askıda deneme deposu
    add(grp, kutu(16, 300, 16, 2), mt.frame, 250, 150, -95);
    add(d, silindir(55, 150, 24), mt.tank, 0, 70, 0); add(d, silindir(18, 14, 14), mt.brass, 0, 152, 0);
    add(d, silindir(8, 30, 8), mt.brass, 0, -10, 0);
    muslukK.position.set(0, -14, 10); d.add(muslukK);
    add(muslukK, kutu(34, 8, 6, 2), mt.red, 12, 0, 0, false);
    const h = new THREE.CatmullRomCurve3([new THREE.Vector3(250, 270, -40), new THREE.Vector3(240, 200, 0), new THREE.Vector3(200, 230, 20), new THREE.Vector3(170, 240, 20)]);
    add(grp, new THREE.TubeGeometry(h, 20, 4, 6), std(0x9c6a2a, 0.5, 0, { transparent:true, opacity:0.75 }), 0, 0, 0, false);
  }
  /* -- Tekme kolu: sağ arkada mil, yukarıda dinlenir, aşağı basılır -- */
  const kol = new THREE.Group(); kol.position.set(150, -55, 150); eng.add(kol);
  {
    add(kol, silindir(14, 28, 16), mt.steel, 0, 0, -6).rotation.x = Math.PI / 2;
    const k = add(kol, kutu(170, 16, 12, 4), mt.steel, 85, 0, 0); k.rotation.z = 0;
    const ayak = new THREE.Group(); ayak.position.set(170, 0, 12); kol.add(ayak);
    add(ayak, silindir(9, 60, 12), mt.rubber, 0, 0, 24).rotation.x = Math.PI / 2;
  }
  const KOL0 = 0.55, KOL1 = -0.85;                               // dinlenme ve dip açısı (yukarı arkaya bakar, aşağı iner)
  kol.rotation.z = KOL0;
  // tıklama hedefleri (görünmez, büyük): tekme kolu, jikle, musluk, kontak
  const hedef = (par, w, h, d, x, y, z, ad) => { const o = add(par, new THREE.BoxGeometry(w, h, d), mt.hit, x, y, z, false); o.userData.ad = ad; return o; };
  const HEDEF = [hedef(kol, 220, 60, 70, 100, 0, 15, 'kol'), hedef(jikleK, 40, 70, 40, 0, 25, 0, 'jikle'), hedef(muslukK, 60, 40, 40, 10, 0, 0, 'musluk'), hedef(anahtar, 50, 60, 30, 0, 5, 5, 'kontak')];
  grp.traverse(o => { if (o.isMesh && o.material === mt.hit) o.castShadow = false; });

  /* -- Duman: egzoz ucundan yükselen yumuşak kümeler (her ateşlemede, karışıma göre renk) -- */
  const dumanTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
    const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(0.5, 'rgba(255,255,255,0.35)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c);
  })();
  const DUMAN = [];
  for (let i = 0; i < 48; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map:dumanTex, transparent:true, opacity:0, depthWrite:false, color:0xdddddd }));
    s.visible = false; scene.add(s); DUMAN.push({ s, t:1, v:new THREE.Vector3() });
  }
  let dumanI = 0;
  function puf(renk, yog, hiz) {
    const d = DUMAN[dumanI++ % DUMAN.length];
    eng.localToWorld(d.s.position.copy(egzUc)); d.t = 0; d.yog = yog; d.s.visible = true;
    d.s.material.color.setHex(renk); d.v.set(hiz * (0.8 + Math.random() * 0.4), 40 + Math.random() * 30, (Math.random() - 0.5) * 40);
  }
  function dumanAdim(dt) {
    for (const d of DUMAN) if (d.s.visible) {
      d.t += dt / 2.4; if (d.t >= 1) { d.s.visible = false; continue; }
      d.s.position.addScaledVector(d.v, dt); d.v.multiplyScalar(Math.exp(-dt * 1.6)); d.v.y += 60 * dt;
      const r = 30 + d.t * 220; d.s.scale.set(r, r, 1); d.s.material.opacity = d.yog * (1 - d.t) * Math.min(1, d.t * 8);
    }
  }

  /* -- Durum ve fizik -- */
  const st = { th:Math.PI * 0.5, w:0, sicak:0, gaz:0, gazTus:false, gazHedef:0, kontak:false, musluk:false, jikle:false, sam:0, atesli:false, sarj:0, cevrim:-1,
    kolA:KOL0, kolHedef:KOL0, kolBas:false, kolTut:false, calisiyor:false, kesit:false, kacirma:0, tekmeSay:0, bogma:0, sarsinti:0, sonAtes:0, ipucu:0 };
  let acik = false, raf = 0, son = 0, cam = null, geri = null, hover = null;
  const rpm = () => st.w * 60 / (2 * Math.PI);
  function karisim() {                                            // 1: ideal; jikle soğukta doğru, sıcakta boğar; jiklesiz soğuk motor fakir
    if (st.jikle) return st.sicak < 0.5 ? 1 : 0.55;
    return st.sicak < 0.5 ? 0.25 + st.sicak : 1;
  }
  function ateslemeKarari() {
    const z = karisim(), yakit = st.sam > 0.05;
    const p = st.kontak && yakit && st.w > 15 ? Math.min(1, z * 1.4) : 0;
    st.atesli = Math.random() < p;
    const hava = P.hava + st.gaz * (1 - P.hava);
    st.sarj = st.atesli ? hava * Math.min(1, z) * (1 - (st.w / 1100) ** 2 * 0.35) : 0;
    if (st.atesli) {
      st.sam = Math.max(0, st.sam - 0.0009 * (0.4 + hava));          // şamandıra odası: musluk kapalıyken birkaç saniye yeter
      patla(hava, z); st.sonAtes = performance.now(); st.sarsinti = Math.min(1, st.sarsinti + 0.25 + hava * 0.5); st.kacirma = 0;
    } else if (st.w > 15) {
      st.kacirma++;
      if (st.kontak && yakit && st.sicak > 0.5 && st.jikle && Math.random() < 0.15) geriTepme();
      pof();
    }
  }
  function fizik(dt) {
    const sub = Math.max(8, Math.min(120, Math.ceil(Math.abs(st.w) * dt / 0.05))), h = dt / sub;
    for (let k = 0; k < sub; k++) {
      const ph = ((st.th % (4 * Math.PI)) + 4 * Math.PI) % (4 * Math.PI), x = ph - 2 * Math.PI;
      let tq = P.Kc * (x / P.wc) * Math.exp(-((x / P.wc) ** 2));
      if (x > 0) tq *= P.kayip;
      const c = Math.floor(st.th / (4 * Math.PI));
      if (c !== st.cevrim && x > 0) { st.cevrim = c; ateslemeKarari(); }
      if (st.atesli && x > 0 && x < 3) tq += P.Kp * st.sarj * (x / P.ap) * Math.exp(1 - x / P.ap);
      tq -= Math.sign(st.w) * (P.f0 + P.f1 * Math.abs(st.w) + P.f2 * st.w * st.w);
      // tekme: kol, fareyle sürüklenen hedef açıya bacak gücüyle gider; kol öndeyse krankı çevirir (cırcır: yalnızca ileri)
      if (st.kolBas) {
        const ileri = clamp((st.kolA - st.kolHedef) / 0.25, 0, 1);
        tq += P.tekme * ileri * Math.max(0, 1 - st.w / P.bacak);
      }
      st.w += tq / P.I * h;
      if (Math.abs(st.w) < 4 && !st.kolBas && Math.abs(tq) < P.f0 * 1.2) st.w *= 0.9;
      if (st.w < -6) st.w = -6;                                     // geri tepme sınırı
      st.th += st.w * h;
      if (st.kolBas) { st.kolA = Math.max(KOL1, st.kolA - Math.max(0, st.w) * h / P.oran); if (st.kolA <= KOL1 + 1e-3) kolBirak(true); }
    }
    if (!st.kolBas) st.kolA += (KOL0 - st.kolA) * Math.min(1, dt * 9);   // yay kolu yukarı çeker
    if (st.musluk) st.sam = Math.min(1, st.sam + dt / 2.5);
    const calisti = st.w > 70 && performance.now() - st.sonAtes < 400;
    if (calisti && !st.calisiyor) { st.calisiyor = true; ilkCalisma(); }
    if (!calisti && st.calisiyor && st.w < 40) { st.calisiyor = false; durdu(); }
    if (st.calisiyor) st.sicak = Math.min(1, st.sicak + dt / (55 - st.gaz * 25));
    else st.sicak = Math.max(0, st.sicak - dt / 600);
    // gaz: tuş/düğme basılıyken açılır, bırakınca yay kapatır
    st.gaz += ((st.gazTus ? 1 : 0) - st.gaz) * Math.min(1, dt * (st.gazTus ? 2.2 : 6));
  }
  function kolBirak(dip) {
    if (!st.kolBas) return;
    st.kolBas = false; st.kolTut = false;
    if (dip) { tik(0.12, 220, 0.05); }
    st.tekmeSay++;
    setTimeout(() => { if (!st.calisiyor && acik) koc(); }, 900);
  }

  /* -- Ses: her ateşlemede egzoz darbesi (gürültü + alçalan gümleme), ateşlemesiz sıkıştırmada pof, supap tıkırtısı, emme hışırtısı -- */
  let SNm = null;
  function sesKur() {
    initAudio(); if (!ac || SNm) return;
    const g = v => { const n = ac.createGain(); n.gain.value = v; return n; };
    const src = (rate) => { const s = ac.createBufferSource(); s.buffer = SNm.beyaz; s.loop = true; s.playbackRate.value = rate; s.start(0, Math.random() * 2); return s; };
    SNm = { beyaz:noiseBuffer(false) };
    SNm.out = g(1.4); SNm.out.connect(bus);
    SNm.emmeF = ac.createBiquadFilter(); SNm.emmeF.type = 'bandpass'; SNm.emmeF.frequency.value = 600; SNm.emmeF.Q.value = 0.8;
    SNm.emmeG = g(0); src(0.9).connect(SNm.emmeF); SNm.emmeF.connect(SNm.emmeG); SNm.emmeG.connect(SNm.out);
    SNm.mekF = ac.createBiquadFilter(); SNm.mekF.type = 'bandpass'; SNm.mekF.Q.value = 6;
    SNm.mekG = g(0); src(1.1).connect(SNm.mekF); SNm.mekF.connect(SNm.mekG); SNm.mekG.connect(SNm.out);
  }
  function darbe(t, f, q, vol, len, tip = 'lowpass') {
    const s = ac.createBufferSource(); s.buffer = SNm.beyaz;
    const b = ac.createBiquadFilter(); b.type = tip; b.frequency.value = f; b.Q.value = q;
    const gn = ac.createGain(); gn.gain.setValueAtTime(0, t); gn.gain.linearRampToValueAtTime(vol, t + 0.003); gn.gain.exponentialRampToValueAtTime(0.0001, t + len);
    s.connect(b); b.connect(gn); gn.connect(SNm.out); s.start(t, Math.random() * 2); s.stop(t + len + 0.02);
  }
  function gum(t, f0, f1, vol, len) {
    const o = ac.createOscillator(); o.type = 'triangle'; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + len);
    const gn = ac.createGain(); gn.gain.setValueAtTime(0, t); gn.gain.linearRampToValueAtTime(vol, t + 0.004); gn.gain.exponentialRampToValueAtTime(0.0001, t + len);
    o.connect(gn); gn.connect(SNm.out); o.start(t); o.stop(t + len + 0.02);
  }
  function patla(hava, z) {
    const n = rpm(), siklik = Math.max(4, n / 120);               // tek silindir: iki devirde bir ateşleme
    const len = clamp(1.4 / siklik, 0.025, 0.16), v = 0.18 + hava * 0.35;
    if (SNm && ac) { const t = ac.currentTime + 0.01; darbe(t, 260 + n * 0.12 + hava * 500, 1.2, v, len); gum(t, 95 + n * 0.006, 42, v * 0.9, len * 1.3); }
    const zengin = st.jikle && st.sicak > 0.5, soguk = st.sicak < 0.35;
    if (Math.random() < (zengin ? 0.9 : soguk ? 0.7 : 0.25 + hava * 0.5)) puf(zengin ? 0x4a4a48 : soguk ? 0xe4e6e8 : 0xbfc3c6, zengin ? 0.5 : soguk ? 0.4 : 0.12 + hava * 0.15, -60 - n * 0.02);
  }
  function pof() { if (SNm && ac) darbe(ac.currentTime + 0.01, 180, 0.7, 0.05, 0.12); }
  function geriTepme() {                                          // karbüratörden patlama: boğulmuş sıcak motor
    if (SNm && ac) { const t = ac.currentTime + 0.01; darbe(t, 1400, 0.6, 0.6, 0.18, 'bandpass'); gum(t, 160, 50, 0.5, 0.2); }
    puf(0x2e2e2c, 0.7, -120);
  }
  function tik(vol, f, len) { if (SNm && ac) darbe(ac.currentTime + 0.005, f * 10, 3, vol, len, 'highpass'); }
  function sesAdim() {
    if (!SNm || !ac) return;
    const t = ac.currentTime, n = Math.max(0, rpm()), d = n > 30 ? 1 : 0;
    SNm.emmeG.gain.setTargetAtTime(d * (0.006 + st.gaz * 0.05) * Math.min(1, n / 1500), t, 0.05);
    SNm.emmeF.frequency.setTargetAtTime(400 + n * 0.15, t, 0.05);
    SNm.mekF.frequency.setTargetAtTime(900 + n * 0.5, t, 0.05);
    SNm.mekG.gain.setTargetAtTime(d * Math.min(0.05, n / 70000), t, 0.05);
    if (n > 200 && n < 3500 && Math.random() < n / 120 / 60 * 0.8) darbe(t + 0.01, 5200, 4, 0.012, 0.012, 'highpass');   // supap tıkırtısı
  }

  /* -- Otto'nun ipuçları: başarısız tekmelerden sonra doğru yere bakar -- */
  function koc() {
    if (st.calisiyor) return;
    if (!st.kontak) return ipucu('Otto: "Kontak kapalıyken bütün gün tekmelersin. Anahtarı çevir."');
    if (!st.musluk && st.sam < 0.05) return ipucu('Otto: "Karbüratöre benzin gelmiyor. Depodaki kırmızı musluk açık mı?"');
    if (st.sicak < 0.5 && !st.jikle && st.tekmeSay >= 2) return ipucu('Otto: "Motor soğuk, fakir karışımla tutmaz. Jikleyi çek."');
    if (st.sicak >= 0.5 && st.jikle && st.tekmeSay >= 2) return ipucu('Otto: "Sıcak motora jikle boğar. Jikleyi kapat, gazı hafif aç."');
    if (st.tekmeSay >= 2) ipucu('Otto: "Yavaş basarsan kompresyonda takılır. Kolu tut ve hızla, sonuna kadar it."');
  }
  function ilkCalisma() {
    ipucu(st.sicak < 0.35 ? 'Çalıştı! Soğuk motor beyaz dumanla homurdanıyor. Biraz ısınınca jikleyi kapatın.' : 'Çalıştı.');
    st.tekmeSay = 0;
  }
  function durdu() { if (acik) ipucu(st.sam < 0.05 ? 'Motor stop etti: şamandıra odası boşaldı (benzin musluğu kapalı).' : st.kontak ? 'Motor stop etti.' : 'Kontak kapandı, motor durdu.'); }
  function ipucu(t) { const h = $('moHint'); h.textContent = t; h.hidden = !t; st.ipucu = 6; }

  /* -- Görüntü: krank, piston, biyel, supaplar, kollar, titreşim -- */
  function goruntu(dt) {
    const th = st.th, sn = Math.sin(th), cs = Math.cos(th);
    krank.rotation.z = -th;
    const px = CR * Math.sin(th), py = CR * Math.cos(th), s = py + Math.sqrt(CL * CL - px * px);
    piston.position.set(0, s, 0);
    biyel.position.set(px / 2, (py + s) / 2, 0); biyel.rotation.z = Math.atan2(px, s - py); biyel.scale.y = CL;
    const ph = ((th % (4 * Math.PI)) + 4 * Math.PI) % (4 * Math.PI);
    for (const v of supap) {
      const a = v.ad === 'emme' ? ph : ph - 3 * Math.PI, lift = a > 0 && a < Math.PI ? Math.sin(a) * 9 : 0;
      v.v.position.y = v.y0 - lift * Math.cos(v.v.rotation.z); v.v.position.x = Math.sign(v.v.position.x) * 20 + lift * Math.sin(-v.v.rotation.z);
    }
    const sonra = (performance.now() - st.sonAtes) / 1000;
    mt.glow.opacity = st.kesit && sonra < 0.05 ? 0.9 * (1 - sonra / 0.05) : 0;
    // titreşim: tek silindirin birincil dengesizliği (devrin karesiyle) + her ateşlemede kısa sarsıntı
    st.sarsinti *= Math.exp(-dt * 9);
    const n = Math.min(1, (st.w / 140) ** 2) * 0.8;
    eng.position.set(sn * n * 0.6, KY + cs * n * 1.2, 0); eng.rotation.z = st.sarsinti * 0.006 * Math.sin(th * 0.5);
    kol.rotation.z = st.kolA;
    jikleK.rotation.z = st.jikle ? -0.9 : 0; muslukK.rotation.z = st.musluk ? -Math.PI / 2 : 0; anahtar.rotation.z = st.kontak ? -Math.PI / 2 : 0;
  }
  function kesit(on) {
    st.kesit = on;
    for (const m of KESILEN) { m.clippingPlanes = on ? [kes] : null; m.side = on ? THREE.DoubleSide : THREE.FrontSide; m.needsUpdate = true; }
    $('moKesit').classList.toggle('on', on);
  }
  renderer.localClippingEnabled = true;

  /* -- Panel -- */
  function panel() {
    const n = Math.max(0, rpm());
    $('moRpm').textContent = String(Math.round(n / 10) * 10);
    $('moRpmBar').style.width = clamp(n / 8000 * 100, 0, 100) + '%';
    $('moRpmBar').className = n > 7000 ? 'bad' : n > 5500 ? 'warn' : '';
    $('moSicak').style.width = (st.sicak * 100) + '%';
    $('moSicakT').textContent = st.sicak < 0.35 ? 'soğuk' : st.sicak < 0.5 ? 'ılık' : 'çalışma sıcaklığında';
    $('moSam').style.width = (st.sam * 100) + '%';
    for (const [id, on, a, b] of [['moMusluk', st.musluk, 'Açık', 'Kapalı'], ['moJikle', st.jikle, 'Çekili', 'Kapalı'], ['moKontak', st.kontak, 'Açık', 'Kapalı']]) {
      const e = $(id); e.classList.toggle('on', on); e.querySelector('i').textContent = on ? a : b;
    }
    $('moGaz').classList.toggle('on', st.gazTus);
  }
  const tog = ad => {
    sesKur();
    if (ad === 'musluk') { st.musluk = !st.musluk; tik(0.05, 300, 0.03); }
    else if (ad === 'jikle') { st.jikle = !st.jikle; tik(0.05, 400, 0.03); }
    else if (ad === 'kontak') { st.kontak = !st.kontak; tik(0.08, 260, 0.04); }
    if (ad !== 'kontak' || st.kontak) $('moHint').hidden = true;
  };

  /* -- Fare: tekme kolunu tut ve aşağı sürükle; jikle, musluk, kontak tıklanır -- */
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  function vur(e) {
    const r = canvas.getBoundingClientRect(); ndc.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1);
    ray.setFromCamera(ndc, camera); const h = ray.intersectObjects(HEDEF, false)[0]; return h ? h.object.userData.ad : null;
  }
  let surY = 0, surA = 0;
  function down(e) {
    if (!acik || cam || e.button !== 0 || e.target !== canvas) return;
    const a = vur(e); if (!a) return;
    e.preventDefault(); e.stopImmediatePropagation();
    if (a !== 'kol') return tog(a);
    sesKur(); controls.enabled = false;
    st.kolBas = true; st.kolTut = true; st.kolHedef = st.kolA; surY = e.clientY; surA = st.kolA;
  }
  function move(e) {
    if (!acik) return;
    if (st.kolTut) { st.kolHedef = clamp(surA - (e.clientY - surY) / 140, KOL1, KOL0); return; }
    if (cam || e.target !== canvas) return;
    hover = vur(e); canvas.style.cursor = hover ? (hover === 'kol' ? 'ns-resize' : 'pointer') : '';
  }
  function up() { if (st.kolTut) { controls.enabled = true; kolBirak(false); } }
  canvas.addEventListener('pointerdown', down, true);
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
  window.addEventListener('keydown', e => {
    if (!acik) return;
    e.stopImmediatePropagation();
    if (e.code === 'Escape') kapat();
    else if (e.code === 'KeyK' && !e.repeat) kesit(!st.kesit);
    else if ((e.code === 'KeyW' || e.code === 'ArrowUp')) { e.preventDefault(); st.gazTus = true; }
    else if (e.code === 'KeyJ' && !e.repeat) tog('jikle');
  }, true);
  window.addEventListener('keyup', e => { if (acik && (e.code === 'KeyW' || e.code === 'ArrowUp')) st.gazTus = false; }, true);
  $('moMusluk').addEventListener('click', () => tog('musluk'));
  $('moJikle').addEventListener('click', () => tog('jikle'));
  $('moKontak').addEventListener('click', () => tog('kontak'));
  $('moKesit').addEventListener('click', () => kesit(!st.kesit));
  $('moGeri').addEventListener('click', () => kapat());
  const gz = $('moGaz');
  gz.addEventListener('pointerdown', e => { e.preventDefault(); sesKur(); st.gazTus = true; gz.setPointerCapture(e.pointerId); });
  for (const ev of ['pointerup', 'pointercancel']) gz.addEventListener(ev, () => { st.gazTus = false; });

  /* -- Döngü, kamera geçişi, aç/kapat -- */
  function adim(dt) {
    fizik(dt); goruntu(dt); dumanAdim(dt); sesAdim();
    if (st.ipucu > 0 && (st.ipucu -= dt) <= 0) $('moHint').hidden = true;
  }
  function loop(t) {
    if (!acik) return;
    const dt = Math.min(0.05, son ? (t - son) / 1000 : 0.016); son = t;
    S.duraklat = true;
    if (cam) {
      cam.t = Math.min(1, cam.t + dt / 1.3);
      const e = cam.t < 0.5 ? 4 * cam.t ** 3 : 1 - (-2 * cam.t + 2) ** 3 / 2, u = 1 - e;
      camera.position.set(0, 0, 0).addScaledVector(cam.p0, u * u).addScaledVector(cam.pc, 2 * u * e).addScaledVector(cam.p1, e * e);
      controls.target.lerpVectors(cam.t0, cam.t1, e);
      if (cam.t >= 1) { const f = cam.f; cam = null; controls.enabled = true; if (f) f(); }
    }
    adim(dt); panel();
    raf = requestAnimationFrame(loop);
  }
  function fly(p1, t1, f) {
    const p0 = camera.position.clone(), pc = p0.clone().lerp(p1, 0.5);
    pc.y = Math.max(p0.y, p1.y) + 500; pc.z = Math.max(p0.z, p1.z) + 500;
    cam = { t:0, p0, pc, t0:controls.target.clone(), p1, t1, f }; controls.enabled = false;
  }
  function ac_() {
    if (acik || S.montaj) return;
    if (S.spindle) { log('Önce tezgâhın milini durdurun.', 'warn'); return; }
    if (app.FD && app.FD.on) app.FD.setOn(false); if (app.AG && app.AG.on) app.AG.setOn(false);
    acik = true; S.duraklat = true; S.montaj = true; sesKur();
    document.body.classList.add('montaj-on'); $('motor').hidden = false;
    geri = { p:camera.position.clone(), t:controls.target.clone(), min:controls.minDistance, max:controls.maxDistance, pan:controls.enablePan, pol:controls.maxPolarAngle };
    fly(new THREE.Vector3(EX + 420, EY + 560, EZ + 1150), new THREE.Vector3(EX + 230, EY + 230, EZ),   // hedef sağa kayık: motor paneli altında kalmasın
      () => {
      controls.minDistance = 260; controls.maxDistance = 1400; controls.enablePan = false; controls.maxPolarAngle = Math.PI * 0.55;
    });
    ipucu('Otto: "Gençken topladığım motor. Bakalım hâlâ çalışıyor mu? Musluk, jikle, kontak; sonra kolu tut ve hızla aşağı it."');
    son = 0; cancelAnimationFrame(raf); raf = requestAnimationFrame(loop);
  }
  function kapat() {
    if (!acik || cam) return;
    st.kontak = false; st.gazTus = false; if (st.kolTut) up();
    const B = geri;
    Object.assign(controls, { minDistance:B.min, maxDistance:B.max, enablePan:B.pan, maxPolarAngle:B.pol });
    document.body.classList.remove('montaj-on'); $('motor').hidden = true; $('moHint').hidden = true; canvas.style.cursor = '';
    if (st.kesit) kesit(false);
    fly(B.p, B.t, () => { acik = false; S.montaj = false; S.duraklat = false; cancelAnimationFrame(raf); if (SNm) { SNm.emmeG.gain.value = 0; SNm.mekG.gain.value = 0; } });
  }
  // test: tekmeyi koddan sür (duman testi)
  function tekme() { st.kolBas = true; st.kolTut = false; st.kolHedef = KOL1; }
  return { ac:ac_, kapat, adim, tekme, tog, kesit, st, rpm, get acik() { return acik; } };
})();

Object.assign(app, { MO });

export { MO };
