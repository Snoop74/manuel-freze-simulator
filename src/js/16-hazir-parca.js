// ── Hazır parçalar: yüzey türleri, tohumlu rastgele, BLANKS şablonları, loadBlank; GEÇİCİ galeri (BG)
const SF = { raw:0, cast:1, ground:2, old:3, weld:4, scale:5 };
const SFNAME = ['ham', 'döküm', 'taşlanmış', 'eski işleme', 'kaynak dikişi', 'hadde tufalı'];
// pürüzsüz rastgele dalgalanma (döküm yüzeyi): birkaç sinüsün toplamı, sivri üçgen yapmaz
// tohumlu rastgele: sipariş panoda beklerken, iş başlarken ve muayenede aynı parça yeniden kurulur
let RNG = Math.random;
function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function castNoise() {
  const w = Array.from({ length:5 }, (_, k) => ({ a:RNG() * 6.28, b:RNG() * 6.28, f:0.08 + k * 0.07 + RNG() * 0.05, g:0.06 + RNG() * 0.2 }));
  return (x, y) => w.reduce((s, q) => s + Math.sin(x * q.f + q.a) * Math.cos(y * q.f * 0.8 + q.b) * q.g, 0) / 2.2;
}
const rr = (a, b) => a + RNG() * (b - a), rp = a => a[Math.floor(RNG() * a.length)], r05 = v => Math.round(v * 2) / 2;
const BLANKS = [
  { id:'head', name:'Silindir kapağı', cat:'Motor', desc:'Conta yüzü çarpılmış alüminyum kapak: yanma odaları, supap ve cıvata delikleri hazır. Çarpılma şekli (bombe, çukur, burulma, uç kalkık) ve supap sayısı değişir. Yüzey traşlanacak.',
    gen() {
      const n = rp([2, 3, 4]), w = n === 4 ? 200 : n === 3 ? 160 : 120, d = 96, h = 42, warp = +rr(0.12, 0.4).toFixed(2), p = w / n, Rc = rp([17, 19, 20]), v4 = RNG() < 0.5;
      const mode = rp(['bombe', 'çukur', 'burulma', 'uç kalkık']);
      const bolts = [], valves = [], plugs = [], jackets = [];
      for (let i = 0; i <= n; i++) for (const y of [11, d - 11]) bolts.push([i === 0 ? 10 : i === n ? w - 10 : i * p, y, 5.5]);
      for (let i = 0; i < n; i++) {
        const cx = p * (i + 0.5);
        if (v4) valves.push([cx - 7, d / 2 - 7, 4], [cx + 7, d / 2 - 7, 4], [cx - 7, d / 2 + 7, 3.6], [cx + 7, d / 2 + 7, 3.6]);
        else valves.push([cx - 7, d / 2 - 8, 5.5], [cx + 7, d / 2 + 8, 5]);
        plugs.push([cx, d / 2, 3]);
        for (const y of [24, d - 24]) jackets.push([cx - p / 2 + 4, y, 6, 2.5]);
      }
      const hole = (x, y, L) => L.some(([a, b, r]) => (x - a) ** 2 + (y - b) ** 2 <= r * r);
      const slot = (x, y) => jackets.some(([a, b, l, r]) => Math.abs(y - b) <= r && x >= a - l / 2 && x <= a + l / 2);
      const u = x => (x - w / 2) / (w / 2), vv = y => (y - d / 2) / (d / 2);
      const shape = { 'bombe':(x, y) => 1 - u(x) ** 2, 'çukur':(x, y) => u(x) ** 2, 'burulma':(x, y) => 0.5 + 0.5 * u(x) * vv(y), 'uç kalkık':(x) => (x / w) ** 1.5 }[mode];
      const exist = [...bolts, ...valves, ...plugs, ...Array.from({ length:n }, (_, i) => [p * (i + 0.5), d / 2, Rc])];
      return { w, d, h:h + warp + 0.3, mat:'al', warp, n, exist, deckBase:h, deckSf:SF.old, info:`${n} silindirli, ${v4 ? '16' : '8'} supaplı düzen, çarpılma ${warp.toFixed(2)} mm (${mode})`,
        H:(x, y) => {
          if (hole(x, y, bolts) || hole(x, y, valves) || hole(x, y, plugs) || slot(x, y)) return 0;
          const top = h + warp * clamp(shape(x, y), 0, 1);
          for (let i = 0; i < n; i++) { const rc = Math.hypot(x - p * (i + 0.5), y - d / 2); if (rc < Rc) return top - 6 * Math.pow(1 - (rc / Rc) ** 2, 0.6); }
          return top;
        },
        Sf:(x, y) => { for (let i = 0; i < n; i++) if (Math.hypot(x - p * (i + 0.5), y - d / 2) < Rc - 0.3) return SF.cast; return SF.old; } };
    } },
  { id:'flange', name:'Döküm flanş', cat:'Makine', desc:'Yuvarlak ya da kare döküm flanş: pürüzlü alın, ortada göbek ve döküm deliği, 1–2 mm işleme payı. Alın ve göbek işlenecek, cıvata dairesi delinecek.',
    gen() {
      const sq = RNG() < 0.35, D = rp([110, 120, 130]), R = D / 2, Rh = rp([24, 26, 30]), t = rp([10, 12, 14]), hub = rp([24, 28, 32]), a = +rr(1, 2).toFixed(1), bore = rp([10, 11, 13]), nz = castNoise();
      const c = R;
      return { w:D, d:D, h:hub + a + 0.6, mat:rp(['gg25', 'gg25', 's235']), geo:{ c, R, Rh, flN:t, hubN:hub, bore }, round:sq ? null : { c, R }, exist:[[c, c, bore], [c, c, Rh]],
        info:`${sq ? 'kare' : 'yuvarlak'} ${D} flanş, göbek Ø${Rh * 2} × ${hub}, alın ${t}, işleme payı ${a} mm`,
        H:(x, y) => {
          const r = Math.hypot(x - c, y - c), e = sq ? Math.max(Math.abs(x - c), Math.abs(y - c)) : r;
          if (e > R || r < bore) return 0;
          if (sq && Math.abs(x - c) + Math.abs(y - c) > R * 1.75) return 0;                   // kare flanşın köşe pahı
          const f = t + a + nz(x, y) * 0.5, hb = hub + a + nz(x * 1.3, y * 1.3) * 0.4;
          if (r <= Rh) return hb;
          if (r <= Rh + 4) return f + (hb - f) * (1 - (r - Rh) / 4) ** 2;
          if (e > R - 1.5) return f - (e - (R - 1.5)) * 1.2;
          return f;
        },
        Sf:() => SF.cast };
    } },
  { id:'mold', name:'Kalıp plakası', cat:'Kalıphane', desc:'Taşlanmış çelik plaka: köşelerde havşalı kılavuz kolon delikleri, kenarlarda bağlama delikleri hazır. Tek ya da çift gözlü kalıp boşluğu ve itici pim delikleri açılacak.',
    gen() {
      const w = rp([150, 156, 170]), d = rp([110, 116, 120]), h = rp([26, 30]), m = 15, Rg = rp([8, 10]), Rcb = Rg + 4;
      const guides = [[m, m], [w - m, m], [w - m, d - m], [m, d - m]], screws = [[w / 2, 9], [w / 2, d - 9], [9, d / 2], [w - 9, d / 2]];
      return { w, d, h, mat:rp(['c45', 'c45', 'ss304']), geo:{ m, Rcb, twin:RNG() < 0.4 }, exist:[...guides.map(([a, b]) => [a, b, Rcb]), ...screws.map(([a, b]) => [a, b, 4.5])], info:`${w}×${d}×${h}, 4 kılavuz kolon deliği Ø${Rg * 2}`,
        H:(x, y) => {
          for (const [a, b] of guides) { const r = Math.hypot(x - a, y - b); if (r <= Rg) return 0; if (r <= Rcb) return h - 6; }
          for (const [a, b] of screws) if (Math.hypot(x - a, y - b) <= 4.5) return 0;
          return h;
        },
        Sf:(x, y) => guides.some(([a, b]) => Math.hypot(x - a, y - b) <= Rcb + 0.3) ? SF.old : SF.ground };
    } },
  { id:'weld', name:'Kaynaklı plaka', cat:'Kaynak', desc:'Hadde tufalı çelik plaka, üstünde kabarık kaynak dikişleri: T, L, artı, çift çizgi ya da çerçeve. Dikişler yüzeyle sıfırlanacak, plakaya dalınmayacak.',
    gen() {
      const w = rp([180, 200]), d = rp([100, 110]), h = rp([16, 20]), bh = +rr(2, 3).toFixed(1), bw = rp([8, 10]);
      const kind = rp(['T', 'L', 'artı', 'çift', 'çerçeve']), xa = r05(w * rr(0.32, 0.45)), yb = r05(d * rr(0.45, 0.65)), m = 22;
      const segs = { 'T':[[xa, 0, xa, d], [xa, yb, w * 0.88, yb]], 'L':[[xa, 0, xa, yb], [xa, yb, w - 10, yb]], 'artı':[[xa, 0, xa, d], [0, yb, w, yb]],
        'çift':[[w * 0.3, 0, w * 0.3, d], [w * 0.7, 0, w * 0.7, d]], 'çerçeve':[[m, m, w - m, m], [w - m, m, w - m, d - m], [w - m, d - m, m, d - m], [m, d - m, m, m]] }[kind];
      const B = (x, y) => {                                          // en yakın dikiş çizgisine uzaklık ve dikiş boyunca konum (dalga)
        let best = 0;
        for (const [x0, y0, x1, y1] of segs) {
          const vx = x1 - x0, vy = y1 - y0, L = Math.hypot(vx, vy), t = clamp(((x - x0) * vx + (y - y0) * vy) / (L * L), 0, 1);
          const dist = Math.hypot(x - x0 - vx * t, y - y0 - vy * t);
          if (dist < bw / 2) best = Math.max(best, bh * Math.sqrt(1 - (dist / (bw / 2)) ** 2) * (0.85 + 0.15 * Math.sin(t * L * 1.9)));
        }
        return best;
      };
      // delik için dikişten uzak, kenardan içeride noktalar
      const spots = []; for (let k = 0; k < 40 && spots.length < 6; k++) { const x = r05(rr(14, w - 14)), y = r05(rr(14, d - 14)); if (B(x, y) === 0 && segs.every(([x0, y0, x1, y1]) => { const vx = x1 - x0, vy = y1 - y0, L2 = vx * vx + vy * vy, t = clamp(((x - x0) * vx + (y - y0) * vy) / L2, 0, 1); return Math.hypot(x - x0 - vx * t, y - y0 - vy * t) > bw + 8; }) && spots.every(([a, b]) => Math.hypot(a - x, b - y) > 25)) spots.push([x, y]); }
      return { w, d, h:h + bh + 0.4, mat:'s235', geo:{ plate:h, bw }, spots, exist:[], info:`${kind} dikiş, ${bh} mm kabarık, ${bw} mm geniş`,
        H:(x, y) => h + B(x, y), Sf:(x, y) => B(x, y) > 0.05 ? SF.weld : SF.scale };
    } },
  { id:'hyd', name:'Hidrolik blok', cat:'Hidrolik', desc:'İşlenmiş çelik blok: alın yüzü taşlanmış, iki ya da üç port deliği ve bağlantı delikleri hazır. Yeni portlar açılacak, üst yüzey 0.3 mm alınacak.',
    gen() {
      const w = rp([100, 110, 120]), d = rp([70, 80]), h = rp([50, 60]), np = rp([2, 2, 3]);
      const ports = Array.from({ length:np }, (_, k) => [r05(w * (k + 1) / (np + 1)), r05(d / 2 + rr(-6, 6)), 8]), spot = 12, mounts = [[8, 8], [w - 8, 8], [w - 8, d - 8], [8, d - 8]];
      const newPorts = [];                                           // eski portlardan uzak yeni port yerleri
      for (const y of [14, d - 14]) for (let k = 1; k <= 3; k++) { const x = r05(w * k / 4); if (ports.every(([a, b]) => Math.hypot(a - x, b - y) > 22) && mounts.every(([a, b]) => Math.hypot(a - x, b - y) > 14)) newPorts.push([x, y]); }
      return { w, d, h, mat:'c45', newPorts, exist:[...ports.map(([a, b]) => [a, b, spot]), ...mounts.map(([a, b]) => [a, b, 3.3])], info:`${w}×${d}×${h}, ${np} port Ø16 (25 derin), 4 bağlantı deliği`,
        H:(x, y) => {
          for (const [a, b, r] of ports) { const q = Math.hypot(x - a, y - b); if (q <= r) return h - 25 + q * 0.6; if (q <= spot) return h - 1.5; }
          for (const [a, b] of mounts) if (Math.hypot(x - a, y - b) <= 3.3) return 0;
          return h;
        },
        Sf:(x, y) => ports.some(([a, b]) => Math.hypot(x - a, y - b) <= spot + 0.3) || mounts.some(([a, b]) => Math.hypot(x - a, y - b) <= 3.6) ? SF.old : SF.ground };
    } },
  { id:'repair', name:'Tamir işi', cat:'Tamir', desc:'Yanlış delinmiş alüminyum ya da çelik plaka: 2–6 delik resimdeki yerlerinden 1–2 mm kaymış. Delikler doğru yerde Ø12\'ye büyütülecek.',
    gen() {
      const w = 150, d = 100, h = rp([20, 25]), pat = rp(['köşeler', 'çizgi', 'ikili', 'altılı']);
      const nom = { 'köşeler':[[25, 20], [125, 20], [125, 80], [25, 80]], 'çizgi':[[30, 50], [60, 50], [90, 50], [120, 50]], 'ikili':[[40, 50], [110, 50]], 'altılı':[[30, 30], [75, 30], [120, 30], [30, 70], [75, 70], [120, 70]] }[pat];
      const off = nom.map(([x, y]) => { const a = rr(0, 6.28), m = rr(1, 1.8); return [x + Math.cos(a) * m, y + Math.sin(a) * m]; });
      const exist = off.map(([x, y]) => [x, y, 4.25]);
      return { w, d, h, mat:rp(['al', 'al', 's235']), nominal:nom, exist, info:`${nom.length} delik Ø8.5 (${pat}), ${Math.max(...off.map(([x, y], i) => Math.hypot(x - nom[i][0], y - nom[i][1]))).toFixed(1)} mm'ye kadar kaymış`,
        H:(x, y) => off.some(([a, b]) => Math.hypot(x - a, y - b) <= 4.25) ? 0 : h,
        Sf:() => SF.old };
    } },
  { id:'exhaust', name:'Egzoz flanşı', cat:'Motor', desc:'Isıdan çarpılmış döküm egzoz manifoldu flanşı: oval egzoz kanalları ve saplama delikleri açık. Conta yüzü düzlenecek.',
    gen() {
      const np = rp([2, 3, 4]), w = np * 40 + 20, d = rp([70, 76]), h = rp([12, 14]), warp = +rr(0.2, 0.6).toFixed(2), a = rr(0.5, 1), nz = castNoise();
      const ports = Array.from({ length:np }, (_, k) => [20 + 20 + k * 40, d / 2]), studs = [];
      for (let k = 0; k <= np; k++) for (const y of [10, d - 10]) studs.push([20 + k * 40, y]);
      const inOval = (x, y) => ports.some(([cx, cy]) => { const dx = Math.max(0, Math.abs(x - cx) - 4); return (dx / 12) ** 2 + ((y - cy) / 15) ** 2 <= 1; });
      const tilt = (x, y) => warp * (0.5 + 0.5 * Math.sin(x / w * Math.PI * 1.2 + y / d));
      return { w, d, h:h + a + warp + 0.4, mat:'gg25', warp, deckBase:h, deckSf:SF.cast, exist:[...studs.map(([x, y]) => [x, y, 4.25])], info:`${np} kanallı, çarpılma ${warp.toFixed(2)} mm, döküm payı ${a.toFixed(1)} mm`,
        H:(x, y) => {
          if (inOval(x, y) || studs.some(([sx, sy]) => Math.hypot(x - sx, y - sy) <= 4.25)) return 0;
          if (Math.min(x, w - x) < 3 && Math.min(y, d - y) < 3) return 0;                  // köşe yuvarlatma
          return h + a + tilt(x, y) + nz(x, y) * 0.15;
        },
        Sf:() => SF.cast };
    } },
  { id:'pillow', name:'Yatak gövdesi', cat:'Makine', desc:'Döküm yatak gövdesi (ters bağlı): iki uçta bağlantı ayağı, ortada rulman göbeği. Ayakların üstü aynı yüksekliğe işlenecek ve delinecek.',
    gen() {
      const w = rp([160, 180]), d = rp([56, 60, 64]), foot = rp([12, 14]), pad = 4, boss = rp([34, 38]), Rb = rp([24, 27]), bore = rp([14, 16]), a = +rr(0.8, 1.6).toFixed(1), nz = castNoise();
      const pw = 34, pads = [[6, 6 + pw], [w - 6 - pw, w - 6]];
      return { w, d, h:boss + a + 0.5, mat:rp(['gg25', 'gg25', 's235']), geo:{ pads:pads.map(([x0, x1]) => ({ x0, x1, y0:6, y1:d - 6 })), padZ:foot + pad, Rb, bore, cx:w / 2, cy:d / 2 },
        exist:[[w / 2, d / 2, bore], [w / 2, d / 2, Rb]], info:`${w}×${d}, ayak pedi ${pw}×${d - 12}, göbek Ø${Rb * 2}, işleme payı ${a} mm`,
        H:(x, y) => {
          const r = Math.hypot(x - w / 2, y - d / 2);
          if (r <= bore) return 0;
          if (r <= Rb) return boss + a + nz(x, y) * 0.3;
          if (r <= Rb + 5) return foot + (boss - foot) * (1 - (r - Rb) / 5) ** 2;
          if (pads.some(([x0, x1]) => x >= x0 && x <= x1 && y >= 6 && y <= d - 6)) return foot + pad + a + nz(x * 1.2, y) * 0.4;
          return foot + nz(x, y) * 0.3;
        },
        Sf:() => SF.cast };
    } },
];
// şablonu mengeneye bağla: ölçü, malzeme, yükseklik ve yüzey haritası
function genBlank(id, seed) {
  const B = BLANKS.find(q => q.id === id); if (!B) return null;
  RNG = mulberry(seed); const P = B.gen(); RNG = Math.random;
  P.stockH = Math.ceil(P.h * 2) / 2; P.seed = seed;
  return P;
}
function loadBlank(id, seed = Math.random() * 1e9 | 0, force = false) {
  const B = BLANKS.find(q => q.id === id); if (!B) return null;
  if (!force && S.job && !S.job.done) { log('İş sürerken parça değiştirilmez.', 'warn'); return null; }
  const P = genBlank(id, seed);
  if (!['vise', 'clamp', 'vac'].includes(FIX)) setFix('vise', true);
  setStock(P.w, P.d, P.stockH, true);
  resetPart(P.mat);
  for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
    const k = j * NX + i, x = i * C, y = j * C;
    H[k] = clamp(P.H(x, y), 0, PH); SURF[k] = P.Sf(x, y);
  }
  throughDirty = true; markDirty(0, NX - 1, 0, NY - 1);
  // çeneler parçanın ön ve arka kenarına basar: kenar yüksekliğinin 3 mm altında biter
  let fr = 0, bk = 0;
  for (let i = 0; i < NX; i++) { fr = Math.max(fr, H[2 * NX + i]); bk = Math.max(bk, H[(NY - 3) * NX + i]); }
  jawOverride = clamp(Math.min(fr, bk) - 3, 4, 22); buildVise();
  S.blank = { id, name:B.name, ...P };
  log(`Hazır parça bağlandı: ${B.name} (${P.info}). ${MATS[P.mat].short}.`, 'ok');
  return P;
}
// GEÇİCİ: şablonları hızlıca görmek için galeri penceresi (üst çubukta "Hazır parça galerisi")
const BG = (() => {
  const el = document.createElement('div'); el.className = 'blank-gal'; el.hidden = true;
  el.innerHTML = '<div class="bg-head"><b>HAZIR PARÇA GALERİSİ</b><small>geçici</small><button class="btn" id="bgClose">Kapat</button></div><div class="bg-list"></div><div class="dro-note" id="bgInfo">Bir parçaya tıklayın: mengeneye bağlanır. "Yeni çeşit" aynı tipten başka bir parça üretir.</div>';
  document.body.append(el);
  const L = el.querySelector('.bg-list');
  for (const B of BLANKS) {
    const c = document.createElement('div'); c.className = 'bg-card';
    c.innerHTML = `<div class="bg-t"><b>${B.name}</b><span>${B.cat}</span></div><p>${B.desc}</p><div class="bg-b"><button class="btn start" data-b="${B.id}">Bağla</button><button class="btn" data-r="${B.id}">Yeni çeşit</button><button class="btn" data-m="${B.id}">Masada incele</button></div>`;
    L.append(c);
  }
  el.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return; initAudio();
    if (b.id === 'bgClose') { el.hidden = true; return; }
    const id = b.dataset.b || b.dataset.r || b.dataset.m; if (!id) return;
    if (S.spindle) spindle(false);
    const P = loadBlank(id); if (!P) return;
    $('bgInfo').textContent = `${BLANKS.find(q => q.id === id).name}: ${P.info} · ${MATS[P.mat].short} · ${P.w}×${P.d}×${(Math.ceil(P.h * 2) / 2)}`;
    if (b.dataset.m) $('benchOpen').click();
  });
  return { show:() => { el.hidden = false; }, toggle:() => { el.hidden = !el.hidden; } };
})();

/* ---------------- Kariyer: siparişler, kasa, itibar, dükkân ----------------
   Serbest atölyede her şey açık ve ücretsiz. Kariyerde müşteriler sipariş verir: ham parça kasadan alınır,
   teslimde parça ölçülür (iş emirleriyle aynı muayene) ve ödeme yapılır. Takımlar satın alınır; kırılan takım gider,
   köreleni bilemek ücretlidir. İtibar arttıkça daha büyük, daha zor ve daha iyi ödeyen işler gelir. */
