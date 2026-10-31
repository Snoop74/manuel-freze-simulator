// ── Kariyer (CR): kasa, itibar, sipariş üretimi, koşullar, dükkân, ekipman, teslimde ödeme
import { kayit } from './00-kayit.js';
import { $, MATS, PD, PH, PW, S, TOOLS, app, isProbe, isTaster, log } from './00-temel.js';
import { beep, initAudio } from './01-ses.js';
import { FIXLIM } from './03-tabla-parca.js';
import { FIX, PAR, warnParallels } from './05-baglama.js';
import { HOLDERS } from './07-takim-gorsel.js';
import { renderRack, resetPart, setRackTag, updateToolUI } from './09-kumanda.js';
import { buildScribe, drawingSVG, drawingTable, inRect, mmss, selectJob, setSelJob } from './10-is-emri-muayene.js';
import { PM, toolIcon } from './12-dongu-ust-cubuk.js';
import { chipsOnPart, setFix } from './13-aletler.js';
import { setStock } from './14-parca-masasi.js';
import { TE, toolPrice } from './15-takim-editoru.js';
import { BLANKS, SF, genBlank, loadBlank, r05, rp, rr, withSeed } from './16-hazir-parca.js';

const CR = (() => {
  const KEY = 'freze-career-v1', MKEY = 'freze-mode';
  const PRICE_KG = { al:180, s235:60, c45:80, ss304:220, brass:350, gg25:70, pom:250 };
  const MATF = { al:1, pom:1, brass:1.1, s235:1.3, gg25:1.3, c45:1.5, ss304:1.9 };
  const LEVELS = [[0, 'Mahalle atölyesi'], [12, 'Güvenilir atölye'], [35, 'Fabrika tedarikçisi'], [70, 'Hassas iş ustası']];
  const CUSTOMERS = [
    ['Kemal Usta', 'tamirhane'], ['Bisikletçi Hasan', 'dükkân'], ['Robotik Kulübü', 'okul'], ['Mahalle Kaportacısı', 'tamirhane'],
    ['Demir Tarım Aletleri', 'atölye'], ['Usta Kahveci Ekipman', 'atölye'], ['Yıldız Makina', 'fabrika'], ['Öz Kalıp', 'kalıphane'],
    ['Akın Otomasyon', 'fabrika'], ['Marmara Tekne', 'tersane'], ['Kaya Hidrolik', 'fabrika'], ['Gökçe Havacılık', 'havacılık'],
  ];
  const BUILTIN_PRICE = { T1:2400, T10:450, T11:380, T12:520, '3B':2500, '3M':1400 };
  const START = ['T3', 'T6', 'T8'];                               // ilk dolap: Ø10 parmak, punta, Ø8.5 matkap
  // ready: tezgâhta kullanılabilir; diğerleri dükkânda "yakında" görünür
  const EQUIP = [
    { id:'air', n:'Hava tabancası', t:'Talaşı üfleyerek temizle (B). Talaşsız teslim %5 prim', p:350, ready:true },
    { id:'dial', n:'Mekanik 3B taster', t:'Kadranlı, elle: ibre 0\'da mil ekseni kenarda. Kopan stylus 180 ₺', p:1400, ready:true },
    { id:'probe', n:'3B taster', t:'Kenar, köşe ve delik merkezini bul, sıfırı yaz. Dönerken çarparsa kırılır!', p:2500, ready:true },
    { id:'h_weldon', n:'Weldon tutucu', t:HOLDERS.weldon.t, p:HOLDERS.weldon.p, ready:true },
    { id:'h_shrink', n:'Shrink-fit tutucu', t:HOLDERS.shrink.t, p:HOLDERS.shrink.p, ready:true },
    { id:'h_hydro', n:'Hidrolik tutucu', t:HOLDERS.hydro.t, p:HOLDERS.hydro.p, ready:true },
    { id:'clamp', n:'Pabuç takımı', t:'Mengeneye sığmayan plakaları tablaya bağla (Y 140 mm’ye kadar)', p:900, ready:true },
    { id:'vac', n:'Vakum tabla', t:'Parçanın her yeri açık; ince ve büyük plakalar. Ağır pasoda parça kopar', p:6500, ready:true },
    { id:'rot', n:'Döner tabla', t:'Q/E ile çevir: cıvata daireleri, yay kanallar', p:8000, ready:true },
    { id:'div', n:'Divizör', t:'Yuvarlak parçaya altıgen, kare, kama kanalı', p:12000 },
  ];
  let st = null, on = false, sel = null, arm = { i:-1, t:0 };
  const fresh = () => ({ money:1500, rep:0, done:0, earned:0, owned:Object.fromEntries(START.map(n => [n, 1])), eq:{}, orders:[], seq:1 });
  function load() {
    st = kayit.oku(KEY, null);
    if (!st || typeof st.money !== 'number' || !Number.isFinite(st.money)) st = fresh();
    if (!st.owned || typeof st.owned !== 'object') st.owned = {};
    if (!st.eq || typeof st.eq !== 'object') st.eq = {};
    st.orders = Array.isArray(st.orders) ? st.orders.filter(o => o && o.J && MATS[o.mat]) : [];
    st.orders.forEach(o => (o.J.pockets || []).forEach(p => { if (p.r == null) p.r = 5; }));
    on = kayit.oku(MKEY) === 'career';
  }
  const save = () => { kayit.yaz(KEY, st); kayit.yaz(MKEY, on ? 'career' : 'free'); };
  const tl = v => Math.round(v).toLocaleString('tr-TR') + ' ₺';
  const level = () => { let l = 0; LEVELS.forEach(([r], i) => { if (st.rep >= r) l = i; }); return l; };
  const priceOf = T => T.price || BUILTIN_PRICE[T.no] || toolPrice(TE.specOf(T));
  const stockCost = (w, d, h, m) => Math.round(w * d * h / 1e6 * MATS[m].rho * PRICE_KG[m] + 20);   // kg × ₺/kg + kesim
  const owns = i => !on || (isTaster(TOOLS[i]) ? !!st.eq[TOOLS[i].type] : !!st.owned[TOOLS[i].no]);
  const hasEq = id => !on || !!st.eq[id];
  function buyEq(id) {
    const E = EQUIP.find(q => q.id === id);
    if (!E || !on || st.eq[id]) return;
    if (st.money < E.p) { log(`${E.n} için kasada yeterli para yok: ${tl(E.p)} gerekli.`, 'warn'); return; }
    st.money -= E.p; st.eq[id] = 1; save(); cash(-E.p);
    log(`${E.n} atölyeye geldi: −${tl(E.p)}.`, 'ok'); render();
  }

  /* -- Sipariş üretici: seviyeye göre malzeme, ham parça ölçüsü ve özellikler -- */
  const rnd = (a, b) => a + Math.random() * (b - a), pick = a => a[Math.floor(Math.random() * a.length)], r5 = v => Math.round(v / 5) * 5;
  // hazır parça siparişi: müşteri parçasını getirir (ham parça parası yok), hurdada parça bedeli atölyeden
  const BLANK_JOBS = {
    repair:{ lv:0, cust:[['Kemal Usta', 'tamirhane'], ['Sanayi Oto Servis', 'tamirhane'], ['Bisikletçi Hasan', 'dükkân']], title:'Tamir: kaymış delikler', value:700, make(P) {
      const n = P.nominal.length;
      return { holes:P.nominal.map(([x, y]) => ({ x, y, d:12 })), brief:`${n} delik 1–2 mm kaymış açılmış. Resimdeki doğru yerlerde Ø12'ye büyütün; kaymış eski delik yeni deliğin içinde kalmalı.`, val:200 + n * 70, target:90 + n * 45 }; } },
    weld:{ lv:0, cust:[['Usta Kaynakçı Rıza', 'kaynak atölyesi'], ['Çelik Konstrüksiyon Ltd.', 'fabrika'], ['Mahalle Demircisi', 'atölye']], title:'Kaynak dikişi sıfırlama', value:600, make(P) {
      const n = Math.min(P.spots.length, rp([0, 2, 3, 4])), holes = P.spots.slice(0, n).map(([x, y]) => ({ x, y, d:8.5 }));
      return { flush:{ top:P.geo.plate, tol:0.1 }, holes, brief:`Plakanın üstündeki kaynak dikişlerini plaka yüzeyiyle sıfırlayın (plakaya 0.2 mm'den fazla dalmayın)${n ? `, ${n}×Ø8.5 delik açın` : ''}.`, val:280 + P.w * 1.4 + n * 60, target:160 + n * 60 }; } },
    mold:{ lv:0, cust:[['Öz Kalıp', 'kalıphane'], ['Yıldız Kalıp', 'kalıphane'], ['Ege Plastik Enjeksiyon', 'fabrika']], title:'Kalıp plakası: kalıp boşluğu', value:2400, make(P) {
      const inn = P.geo.m + P.geo.Rcb + 6, cy = P.d / 2, dep = rp([3, 4, 5]), rad = rp([5, 5, 8]), pockets = [], holes = [];
      const pd = r5(rr(0.4, 0.6) * (P.d - 2 * inn)) + 15;
      const mk = (cx, pw) => { const pk = { x0:cx - pw / 2, x1:cx + pw / 2, y0:cy - pd / 2, y1:cy + pd / 2, depth:dep, r:rad }; pockets.push(pk); holes.push({ x:r05(pk.x0 + 9), y:r05(cy), d:5 }, { x:r05(pk.x1 - 9), y:r05(cy), d:5 }); };
      if (P.geo.twin) { const pw = r5((P.w - 2 * inn - 12) / 2 * rr(0.7, 0.9)); mk(P.w / 2 - pw / 2 - 6, pw); mk(P.w / 2 + pw / 2 + 6, pw); }
      else mk(P.w / 2, r5(rr(0.35, 0.5) * (P.w - 2 * inn)) + 20);
      const vol = pockets.reduce((a, p) => a + (p.x1 - p.x0) * pd * dep, 0);
      return { pockets, holes, brief:`Taşlanmış kalıp plakasına ${pockets.length === 2 ? 'çift gözlü' : 'tek gözlü'} kalıp boşluğu (${pockets.map(p => `${p.x1 - p.x0}×${pd}`).join(' ve ')}, ${dep} derin, köşeler R${rad}) ve tabanlarına ${holes.length}×Ø5 itici pim deliği. Kılavuz kolon deliklerine dokunmayın.`, val:300 + vol / 80 + holes.length * 60, target:150 + vol / 22 + holes.length * 50 }; } },
    head:{ lv:1, cust:[['Mahalle Kaportacısı', 'oto tamiri'], ['Usta Motor Rektifiye', 'rektifiye'], ['Sanayi Oto Servis', 'tamirhane']], title:'Silindir kapağı traşlama', value:3500, make(P) {
      return deckJob(P, 0.05, 0.5, `Motor ısınınca kapağın conta yüzü çarpılmış. Yüzeyi tamamen düzleyin (düzlemsellik ≤ 0.05) ama en yüksek noktadan en çok 0.5 mm alın. Önce en yüksek ve en alçak noktayı bulun: taster ya da Z'yi dokundurarak.`, 700 + P.w * P.d / 25, 150 + P.w * P.d / 60); } },
    exhaust:{ lv:1, cust:[['Usta Motor Rektifiye', 'rektifiye'], ['Sanayi Oto Servis', 'tamirhane'], ['Kamyon Garajı Metin', 'oto tamiri']], title:'Egzoz flanşı düzleme', value:1100, make(P) {
      return deckJob(P, 0.1, 1.2, `Manifold ısıdan çarpılmış, conta kaçırıyor. Döküm conta yüzünü tamamen düzleyin (düzlemsellik ≤ 0.10), en yüksek noktadan en çok 1.2 mm alın.`, 420 + P.w * P.d / 30, 120 + P.w * P.d / 70); } },
    hyd:{ lv:1, cust:[['Kaya Hidrolik', 'fabrika'], ['Akın Otomasyon', 'fabrika'], ['İş Makinası Servisi', 'servis']], title:'Hidrolik blok: yeni portlar', value:2000, make(P) {
      const holes = P.newPorts.slice(0, 2).map(([x, y]) => ({ x, y, d:8.5 }));
      return { face:{ depth:0.3, tol:0.05 }, holes, brief:`Üst yüzeyden 0.30 mm alın (±0.05), ${holes.length} yeni Ø8.5 boydan boya port açın (${P.h} mm derin: gagalayarak). Mevcut portlara dokunmayın.`, val:300 + P.w * P.d / 60 + holes.length * 110, target:160 + P.w * P.d / 100 + holes.length * 80 }; } },
    flange:{ lv:1, cust:[['Demir Tarım Aletleri', 'atölye'], ['Anadolu Pompa', 'fabrika'], ['Tarım Kooperatifi Atölyesi', 'atölye']], title:'Döküm flanş işleme', value:900, make(P) {
      const g = P.geo, n = rp([4, 6]), R = r05((g.Rh + 4 + g.R - 3) / 2);
      const holes = Array.from({ length:n }, (_, k) => { const a = (k * 360 / n + 45) * Math.PI / 180; return { x:+(g.c + R * Math.cos(a)).toFixed(3), y:+(g.c + R * Math.sin(a)).toFixed(3), d:12 }; });
      return { levels:[{ name:'Göbek üstü', rmax:g.Rh - 1.5, z:g.hubN, tol:0.1 }, { name:'Flanş alnı', rmin:g.Rh + 5, rmax:g.R - 2.5, z:g.flN, tol:0.1 }], holes,
        brief:`Döküm flanşın göbek üstünü ${g.hubN.toFixed(2)}, flanş alnını ${g.flN.toFixed(2)} yüksekliğe işleyin (tablaya göre, ±0.1), R${R} dairesine ${n}×Ø12 delik açın.`, val:350 + n * 60 + g.R * g.R / 15, target:200 + n * 55 + g.R * 2 }; } },
    pillow:{ lv:1, cust:[['Anadolu Pompa', 'fabrika'], ['Konveyör Sistemleri', 'fabrika'], ['Değirmen Ustası', 'atölye']], title:'Yatak gövdesi: ayak pedleri', value:1300, make(P) {
      const g = P.geo, pads = g.pads.map(q => ({ ...q, z:g.padZ, tol:0.1 })), holes = pads.map(q => ({ x:r05((q.x0 + q.x1) / 2), y:r05((q.y0 + q.y1) / 2), d:12 }));
      return { pads, holes, brief:`Ters bağlı döküm yatak gövdesinin iki ayak pedini ${g.padZ.toFixed(2)} yüksekliğe işleyin (tablaya göre, ±0.1, ikisi aynı seviyede) ve her pedin ortasına Ø12 bağlantı deliği açın. Rulman göbeğine dokunmayın.`, val:380 + P.w * 2.2, target:170 + P.w * 0.9 }; } },
    jant:{ lv:1, cust:[['Drift Garajı Emre', 'oto tuning'], ['Klasik Oto Restorasyon', 'atölye'], ['Jantçı Selim', 'dükkân']], title:'Jant göbeği: alın ve bijon delikleri', value:1800, make(P) {
      const g = P.geo, n = rp([4, 5]), a0 = rp([0, 45, 90]);
      const holes = Array.from({ length:n }, (_, k) => { const a = (k * 360 / n + a0) * Math.PI / 180; return { x:+(g.c + g.lugR * Math.cos(a)).toFixed(3), y:+(g.c + g.lugR * Math.sin(a)).toFixed(3), d:12 }; });
      return { levels:[{ name:'Göbek alnı', rmax:g.Rh - 1.5, z:g.hubN, tol:0.1 }, { name:'Jant alnı', rmin:g.Rh + 5, rmax:g.R - 2.5, z:g.flN, tol:0.1 }], holes,
        brief:`Döküm jant göbeğinin göbek alnını ${g.hubN.toFixed(2)}, kol ve jant alnını ${g.flN.toFixed(2)} yüksekliğe işleyin (tablaya göre, ±0.1). Göbeğe PCD ${g.lugR * 2} dairesinde ${n}×Ø12 bijon deliği açın.`, val:420 + n * 70 + g.R * g.R / 14, target:220 + n * 55 + g.R * 2 }; } },
    buhar:{ lv:0, cust:[['Öz Kalıp', 'kalıphane'], ['Köpük Ambalaj San.', 'EPS fabrikası'], ['Termo Kutu Ltd.', 'EPP fabrikası']], title:'Kalıp arka plakası: buhar memeleri', value:1600, make(P) {
      const holes = P.vents.map(([x, y]) => ({ x, y, d:8.5 })), face = rr(0, 1) < 0.5 ? { depth:0.3, tol:0.05 } : null;
      return { face, holes, brief:`${face ? 'Arka plakanın yüzeyinden 0.30 mm alın (±0.05), ' : ''}${holes.length} buhar memesi yuvasını (Ø8.5, boydan boya) ızgara düzeninde delin. Buhar giriş ve bağlantı deliklerine dokunmayın.`, val:220 + holes.length * 45 + (face ? P.w * P.d / 90 : 0), target:110 + holes.length * 32 + (face ? P.w * P.d / 110 : 0) }; } },
    drone:{ lv:1, cust:[['Hobi Drone Kulübü', 'kulüp'], ['Üniversite Robot Takımı', 'öğrenci takımı'], ['FPV Yarışçısı Can', 'hobi']], title:'Drone gövdesi: hafifletme', value:900, make(P) {
      const { cx, cy } = P.geo, dep = rp([3, 4, 5]), pockets = [], holes = [];
      for (const s of [-1, 1]) pockets.push({ x0:cx + (s < 0 ? -22 : 4), x1:cx + (s < 0 ? -4 : 22), y0:cy - 16, y1:cy + 16, depth:dep, r:4 });
      for (const [x, y] of P.motors) holes.push({ x, y, d:8.5 });
      for (const sx of [-1, 1]) for (const sy of [-1, 1]) holes.push({ x:cx + sx * 22, y:cy + sy * 22, d:5 });
      return { pockets, holes, brief:`İnce X gövdenin ortasına iki hafifletme cebi (18×32, ${dep} derin, R4), kol uçlarına 4×Ø8.5 motor deliği, gövdeye 4×Ø5 uçuş kartı deliği açın. Parça ince: bağlarken dikkat.`, val:320 + dep * 40 + 8 * 40, target:200 + dep * 25 + 8 * 30 }; } },
    gitar:{ lv:0, cust:[['Luthier Deniz', 'enstrüman atölyesi'], ['Rock Barı Sahibi', 'müşteri'], ['Müzik Okulu', 'okul']], title:'Gitar köprüsü: tel delikleri ve eşik', value:500, make(P) {
      const cx = P.w / 2, ys = r05(P.d * 0.32), yp = r05(P.d * 0.68), pl = P.w >= 96 ? 64 : 60, dep = rp([2, 3]), holes = [];
      for (let k = 0; k < 6; k++) holes.push({ x:+(cx + (k - 2.5) * 10.5).toFixed(2), y:ys, d:5 });
      for (const s of [-1, 1]) holes.push({ x:cx + s * 38, y:r05(P.d / 2), d:5 });
      return { pockets:[{ x0:cx - pl / 2, x1:cx + pl / 2, y0:yp - 4, y1:yp + 4, depth:dep, r:3 }], holes,
        brief:`Taşlanmış pirinç köprüye 6×Ø5 tel deliği (10.5 aralık), ${pl}×8 eşik kanalı (${dep} derin, R3) ve iki uca Ø5 bağlantı deliği açın. Üst yüz taşlanmış kalmalı.`, val:260 + 8 * 35 + pl * 2, target:150 + 8 * 28 + pl }; } },
    kebap:{ lv:0, cust:[['Ocakbaşı Mehmet Usta', 'restoran'], ['Adana Kebap Salonu', 'restoran'], ['Mangal İmalatçısı', 'atölye']], title:'Şiş tutucu: tufal ve şiş delikleri', value:400, make(P) {
      const n = rp([8, 9, 10]), x0 = 16, sp = (P.w - 2 * x0) / (n - 1), y = r05(P.d / 2), face = { depth:+(P.stockH - P.geo.plate).toFixed(2), tol:0.1 };
      const holes = Array.from({ length:n }, (_, k) => ({ x:r05(x0 + k * sp), y, d:8.5 }));
      return { face, holes, brief:`Lamanın üstündeki tufalı alın: yüzey ${P.geo.plate.toFixed(2)} yüksekliğe (±0.1). Ortadan ${n}×Ø8.5 şiş deliği açın (boydan boya, ~${r05(sp)} aralık).`, val:200 + n * 40 + P.w, target:120 + n * 30 + P.w * 0.6 }; } },
    cene:{ lv:0, cust:[['Kendi atölyeniz', 'iç iş'], ['Komşu Tornacı Ali', 'atölye'], ['Meslek Lisesi Atölyesi', 'okul']], title:'Yumuşak çene: parça yuvası', value:300, make(P) {
      const cx = P.w / 2, cy = r05(P.d / 2), L = rp([60, 70, 80, 90]), Wd = rp([12, 14, 16]), dep = rp([4, 5, 6]);
      return { pockets:[{ x0:cx - L / 2, x1:cx + L / 2, y0:cy - Wd / 2, y1:cy + Wd / 2, depth:dep, r:5 }], holes:[{ x:15, y:cy, d:8.5 }, { x:P.w - 15, y:cy, d:8.5 }],
        brief:`Alüminyum çeneye parçanın oturacağı ${L}×${Wd} yuvayı (${dep} derin, R5) ve iki uca Ø8.5 bağlantı deliğini açın.`, val:180 + L * Wd * dep / 60, target:110 + L * Wd * dep / 90 }; } },
    tarim:{ lv:1, cust:[['Konya Tarım Makinaları', 'fabrika'], ['Biçerdöver Servisi Hüseyin', 'servis'], ['Tarım Kooperatifi Atölyesi', 'atölye']], title:'Bıçak tutucusu: ayar kanalı', value:700, make(P) {
      const cx = P.w / 2, cy = r05(P.d / 2), sl = rp([40, 50]), dep = rp([3, 4]);
      return { face:{ depth:+(P.stockH - 12).toFixed(2), tol:0.1 }, pockets:[{ x0:cx - sl / 2, x1:cx + sl / 2, y0:cy - 5, y1:cy + 5, depth:dep, r:5 }],
        holes:[{ x:14, y:cy, d:12 }, { x:P.w - 14, y:cy, d:12 }, { x:cx - sl / 2 - 15, y:cy, d:8.5 }, { x:cx + sl / 2 + 15, y:cy, d:8.5 }],
        brief:`Tufallı lamanın üstünü 12.00 yüksekliğe işleyin (±0.1), ortaya ${sl}×10 ayar kanalı (${dep} derin, R5), uçlara 2×Ø12 ve kanalın iki yanına 2×Ø8.5 delik açın.`, val:320 + P.w * 1.2 + sl * 3, target:180 + P.w * 0.8 + sl * 2 }; } },
    tekstil:{ lv:1, cust:[['Bursa Dokuma A.Ş.', 'fabrika'], ['Tekstil Makine Servisi', 'servis'], ['Örme Fabrikası Bakım', 'bakım']], title:'Dişli kutusu kapağı: conta yüzü ve delikler', value:1500, make(P) {
      const holes = P.bolts.map(([x, y]) => ({ x, y, d:8.5 }));
      return Object.assign(deckJob(P, 0.1, 1.0, `Yağ kaçıran dişli kutusu kapağının conta yüzünü tamamen düzleyin (düzlemsellik ≤ 0.10, en yüksek noktadan en çok 1.0 mm), sonra conta yüzüne ${holes.length}×Ø8.5 cıvata deliği açın.`, 400 + P.w * P.d / 35 + holes.length * 40, 160 + P.w * P.d / 80 + holes.length * 35), { holes }); } },
  };
  // conta yüzü traşlama işi (silindir kapağı, egzoz flanşı): en yüksek nokta, izin verilen en alçak seviye
  function deckJob(P, flat, maxCut, brief, val, target) {
    const sf = P.deckSf ?? SF.old;
    let top0 = -1; for (let y = 0; y <= P.d; y += 1) for (let x = 0; x <= P.w; x += 1) if (P.Sf(x, y) === sf && P.H(x, y) >= P.deckBase) top0 = Math.max(top0, P.H(x, y));
    return { deck:{ flat, maxCut, top0, floor:top0 - maxCut, base:P.deckBase - 0.02, sf }, brief, val, target };
  }
  // iş koşulları: acil (süre kısa, ödeme ×1.6), seri (3 adet, son adette +%10), hassas (toleranslar yarıya, ödeme ×1.5)
  const COND = {
    acil:{ tag:'ACİL', txt:'ACİL İŞ: hedef süre kısa, ödeme ×1.6; geç kalırsanız ödemeden %20 kesilir.' },
    seri:{ tag:'SERİ ×3', txt:'SERİ İŞ: 3 adet. Her adet ayrı ödenir ve ham parçası ayrı alınır; üçü de kabul edilirse son adette +%10 seri primi.' },
    hassas:{ tag:'HASSAS', txt:'HASSAS İŞ: bütün toleranslar yarıya iner, ödeme ×1.5.' },
  };
  function addCond(o, lv) {
    const u = Math.random();
    if (lv >= 2 && u < 0.15) {
      o.cond = 'hassas'; o.J.tolK = 0.5; o.pay = Math.round(o.pay * 1.5 / 10) * 10;
      for (const L of [...(o.J.levels || []), ...(o.J.pads || [])]) L.tol = +(L.tol / 2).toFixed(3);   // seviye ve ped toleransları da yarıya
      if (o.J.deck) o.J.deck.flat = +(o.J.deck.flat / 2).toFixed(3);
      if (o.J.face) o.J.face.tol = +(o.J.face.tol / 2).toFixed(3);
    }
    else if (u < 0.3) { o.cond = 'acil'; o.J.target = Math.round(o.J.target * 0.55 / 10) * 10; o.pay = Math.round(o.pay * 1.6 / 10) * 10; }
    else if (!o.own && lv >= 1 && u < 0.45) { o.cond = 'seri'; o.qty = 3; o.doneQty = 0; }
    if (o.cond) o.J.brief += ' ' + COND[o.cond].txt;
    return o;
  }
  function genBlankOrder(lv) {
    const ids = Object.keys(BLANK_JOBS).filter(k => BLANK_JOBS[k].lv <= lv), id = pick(ids), B = BLANK_JOBS[id], seed = Math.random() * 1e9 | 0;
    const P = genBlank(id, seed);
    const F = withSeed(seed ^ 0x5bd1e995, () => B.make(P));
    const mf = MATF[P.mat] || 1;
    const J = Object.assign({ pockets:[], holes:[], arcs:[], face:null, w:P.w, d:P.d, h:P.stockH, mat:P.mat, title:B.title, exist:P.exist || [], round:P.round || null, blank:{ id, seed } }, F);
    J.target = Math.round(F.target * (mf > 1.2 ? 1.3 : 1) / 10) * 10;
    const [cn, ck] = pick(B.cust);
    J.brief = `${cn} (${ck}) kendi parçasını getirdi: ${BLANKS.find(q => q.id === id).name}, ${MATS[P.mat].short} ${P.w}×${P.d}. ${F.brief} Hurdaya çıkarsa parça bedeli ${tl(B.value)} sizden.`;
    delete J.val; delete J.brief0;
    return addCond({ id:st.seq++, cust:cn, mat:P.mat, J, pay:Math.round(F.val * mf * (1 + lv * 0.15) / 10) * 10, cost:0, free:true, own:true, value:B.value, lv }, lv);
  }
  function genOrder(free) {
    const lv = level();
    if (!free && Math.random() < 0.5) return genBlankOrder(lv);
    const m = pick([['al', 'pom', 'brass', 'al'], ['al', 'brass', 's235', 'pom'], ['s235', 'c45', 'al', 'gg25', 'brass'], ['c45', 'ss304', 's235', 'brass']][lv]);
    const big = lv >= 1 && Math.random() < 0.25;                   // büyük plaka: mengene en fazla 135 mm açılır
    const arc = !big && lv >= 1 && Math.random() < 0.25;           // yay kanallı flanş: döner tabla ister
    const pcd = !big && !arc && lv >= 1 && Math.random() < 0.2;    // cıvata dairesi: döner tablayla kolay, DRO hesabıyla da olur
    const [w, d, h] = arc ? pick([[120, 80, 25], [150, 100, 30]]) : big ? pick([[200, 140, 15], [220, 140, 12], [180, 140, 10], [240, 140, 20]]) : pick([[100, 60, 20], [120, 80, 25], [150, 100, 30], [150, 100, 40], [180, 120, 30]].slice(0, 2 + lv));
    const J = { pockets:[], holes:[], w, d, h, mat:m, big };
    if (Math.random() < 0.3 + lv * 0.1) J.face = { depth:pick([0.5, 1]), tol:0.1 };
    if (arc) {
      const a0 = pick([0, 30, 45, 90, 180]);
      J.arcs = [{ cx:w / 2, cy:d / 2, r:20, w:pick([10, 6]), a0, a1:a0 + pick([60, 90, 120, 180]), depth:pick([2, 3, 4]) }];
    } else if (Math.random() < 0.3 + lv * 0.15) {
      const pw = r5(rnd(0.25, 0.45) * w), pd = r5(rnd(0.3, 0.5) * d), cx = r5(w / 2 + rnd(-0.1, 0.1) * w), cy = r5(d / 2 + rnd(-0.08, 0.08) * d);
      J.pockets.push({ x0:cx - pw / 2, x1:cx + pw / 2, y0:cy - pd / 2, y1:cy + pd / 2, depth:pick([2, 3, 4, 5].filter(v => v < h - 10)), r:lv ? pick([5, 5, 8]) : 5 });
    }
    const hd = pick(arc ? [5, 8.5] : lv ? [5, 8.5, 12] : [8.5, 8.5, 5]), mg = Math.max(10, hd + 6), u = Math.random();
    let pts = [];
    if (arc || pcd) {                                              // daire üstünde eşit bölüntülü delikler (90°/270° pabuçların altına düşmesin)
      const n = pick([4, 6]), off = n === 4 ? 45 : 0, R = r5(Math.min(w, d) * 0.38);
      pts = Array.from({ length:n }, (_, k) => { const a = (off + k * 360 / n) * Math.PI / 180; return [+(w / 2 + R * Math.cos(a)).toFixed(3), +(d / 2 + R * Math.sin(a)).toFixed(3)]; });
      J.pcd = { r:R, n };
    } else if (!J.pockets.length || Math.random() < 0.7) {
      if (u < 0.3) pts = [[w / 2, d / 2]];
      else if (u < 0.55) pts = [[mg + 2, d / 2], [w - mg - 2, d / 2]];
      else if (u < 0.85) { const mx = r5(rnd(mg, mg + 10)), my = r5(rnd(mg, Math.min(mg + 10, d / 2 - 8))); pts = [[mx, my], [w - mx, my], [w - mx, d - my], [mx, d - my]]; }
      else { const y = r5(d * rnd(0.3, 0.7)); pts = [0.2, 0.4, 0.6, 0.8].map(f => [r5(w * f), y]); }
    }
    for (const [x, y] of pts) {                                    // delik ya cebin içinde ya da kenarından uzak
      const p = J.pockets[0];
      if (p && !inRect(x, y, p, -(hd / 2 + 3)) && inRect(x, y, p, hd / 2 + 3)) continue;
      J.holes.push({ x, y, d:hd });
    }
    if (!J.face && !J.pockets.length && !J.holes.length) J.holes.push({ x:w / 2, y:d / 2, d:8.5 });
    const area = w * d, mf = MATF[m], vol = p => (p.x1 - p.x0) * (p.y1 - p.y0) * p.depth;
    const cost = free ? 0 : stockCost(w, d, h, m);
    const avol = A => (A.a1 - A.a0) * Math.PI / 180 * A.r * A.w * A.depth;
    J.arcs = J.arcs || [];
    const val = (120 + (J.face ? area / 60 : 0) + J.holes.reduce((s, q) => s + 50 + q.d * 6 + h * 1.2, 0) + J.pockets.reduce((s, p) => s + 60 + vol(p) / 120, 0) + J.arcs.reduce((s, A) => s + 150 + avol(A) / 60, 0)) * mf * (1 + lv * 0.15);
    J.target = Math.round((60 + (J.face ? area / 100 : 0) + J.holes.length * (25 + h * 1.2) + J.pockets.reduce((s, p) => s + 40 + vol(p) / 25, 0) + J.arcs.reduce((s, A) => s + 90 + avol(A) / 20, 0)) * (mf > 1.2 ? 1.3 : 1) / 10) * 10;
    const [cn, ck] = pick(CUSTOMERS.slice(0, 6 + lv * 2));
    J.title = arc ? pick(['Ayar flanşı', 'Yaylı kapak', 'Döner mesnet']) : pcd ? pick(['Bağlantı flanşı', 'Delikli disk plakası']) : J.pockets.length && J.holes.length ? pick(['Flanş', 'Kapak plakası', 'Adaptör']) : J.pockets.length ? pick(['Yuva bloğu', 'Cepli taban'])
      : J.holes.length >= 4 ? pick(['Bağlantı plakası', 'Montaj plakası']) : J.holes.length ? pick(['Taşıyıcı', 'Burç plakası', 'Mesnet']) : 'Yüzey işleme';
    const f = [];
    if (J.face) f.push(`üstten ${J.face.depth.toFixed(1)} mm alın`);
    J.pockets.forEach(p => f.push(`${p.x1 - p.x0}×${p.y1 - p.y0}×${p.depth} cep (köşeler R${p.r}, en çok Ø${p.r * 2} freze)`));
    J.arcs.forEach(A => f.push(`R${A.r} × ${A.w} genişlikte, ${A.depth} derin yay kanal (${A.a0}°–${A.a1}°, merkez parçanın ortası)`));
    if (J.holes.length) f.push(`${J.holes.length > 1 ? J.holes.length + '×' : ''}Ø${hd} boydan boya delik${J.pcd ? ` (R${J.pcd.r} dairesinde, ${360 / J.pcd.n}°'de bir)` : ''}`);
    J.brief = `${cn} (${ck}) ${J.title.toLocaleLowerCase('tr')} istiyor: ${MATS[m].short} ${w}×${d}×${h}, ${f.join(', ')}. ` +
      (big ? 'Mengeneye sığmaz: pabuç ya da vakum tabla gerekir. ' : '') + (arc ? 'Yay kanal için döner tabla gerekir. ' : '') + (free ? 'Malzemeyi müşteri getirdi.' : `Ham parça ${tl(cost)}, iş başlayınca kasadan çıkar.`);
    return addCond({ id:st.seq++, cust:cn, mat:m, J, pay:Math.round((val * (big ? 1.25 : 1) + cost * 1.25) / 10) * 10, cost, free, lv }, lv);
  }
  function fillBoard() {
    while (st.orders.length < 3) st.orders.push(genOrder(false));
    // kasada ham parçaya bile para yoksa müşteri malzemesini getirir: oyun kilitlenmez
    if (!st.orders.some(o => o.cost <= st.money)) st.orders[0] = genOrder(true);
  }

  /* -- Arayüz -- */
  function render() {
    $('career').hidden = !on; $('jobList').hidden = on;
    [...$('modeSw').children].forEach(b => b.classList.toggle('on', (b.dataset.mode === 'career') === on));
    $('tbMoney').hidden = !on; $('tbShop').hidden = !on;
    $('shMoney').textContent = on ? tl(st.money) : 'serbest';
    if (on) {
      const lv = level(), nx = LEVELS[lv + 1];
      $('tbMoney').textContent = $('crMoney').textContent = tl(st.money);
      $('crRep').textContent = st.rep; $('crLevel').textContent = LEVELS[lv][1] + (nx ? ` · sonraki ${nx[0]}` : '');
      $('crDone').textContent = st.done;
      $('starTotal').textContent = `${st.done} teslim`;
      const L = $('orderList'); L.innerHTML = '';
      st.orders.forEach(o => {
        const b = document.createElement('button');
        const act = S.job && S.job.order && S.job.order.id === o.id && !S.job.done;
        b.classList.toggle('active', !!(sel && sel.id === o.id));
        const ct = o.cond ? ` <b class="cond ${o.cond}">${COND[o.cond].tag}${o.qty ? ' ' + (o.doneQty || 0) + '/' + o.qty : ''}</b>` : '';
        b.innerHTML = `<span class="jn">#${o.id}</span><span class="jt">${o.J.title} · ${o.cust}${ct}${act ? ' <em>işleniyor</em>' : ''}</span><span class="js">${tl(o.pay)}<i> · ${MATS[o.mat].short} · ${o.free ? 'malzeme müşteriden' : 'ham ' + tl(o.cost)}</i></span>`;
        b.addEventListener('click', () => select(o));
        L.append(b);
      });
    }
    renderShop(); renderRack(); updateToolUI();
  }
  function renderShop() {
    $('shNote').textContent = on ? 'Dolapta olmayan takımı satın al; kırılan takım hurdaya gider, köreleni bilet (fiyatın %30\'u).'
      : 'Serbest atölyede her şey ücretsiz ve açık. Kariyer modunda alışveriş burada yapılır.';
    const T0 = $('shopTools'); T0.innerHTML = '';
    TOOLS.forEach((T, i) => {
      if (T.gone || isTaster(T)) return;
      const own = owns(i), p = priceOf(T), d = document.createElement('div'); d.className = 'sh-item' + (own ? ' own' : '');
      d.innerHTML = `<span class="ico">${toolIcon(T)}</span><span class="nm"><b>${T.no}</b> ${T.name} Ø${T.d}<small>${T.mat}</small></span>`;
      const b = document.createElement('button'); b.className = 'btn' + (own ? '' : ' start');
      b.textContent = own ? 'dolapta' : tl(p); b.disabled = own || !on || st.money < p;
      b.addEventListener('click', () => buy(i));
      d.append(b); T0.append(d);
    });
    const E0 = $('shopEq'); E0.innerHTML = '';
    EQUIP.forEach(E => {
      const own = E.ready && hasEq(E.id), d = document.createElement('div'); d.className = 'sh-item' + (own ? ' own' : E.ready ? '' : ' soon');
      d.innerHTML = `<span class="ico">◇</span><span class="nm"><b>${E.n}</b><small>${E.t}</small></span>`;
      const b = document.createElement('button'); b.className = 'btn' + (own || !E.ready ? '' : ' start');
      b.textContent = !E.ready ? tl(E.p) + ' · yakında' : own ? 'atölyede' : tl(E.p);
      b.disabled = !E.ready || own || st.money < E.p;
      b.addEventListener('click', () => buyEq(E.id));
      d.append(b); E0.append(d);
    });
  }
  function select(o) {
    sel = o; setSelJob(-2);
    if (o.J.blank && !o.J._P) Object.defineProperty(o.J, '_P', { value:genBlank(o.J.blank.id, o.J.blank.seed), enumerable:false, writable:true, configurable:true });                                         // iş emri listesindeki seçim kalkar
    $('jcNo').textContent = 'SİPARİŞ #' + o.id; $('jcTitle').textContent = `${o.J.title} · ${o.cust}`; $('jcBrief').textContent = o.J.brief;
    $('jcMeta').innerHTML = `<span>Ödeme <b>${tl(o.pay)}</b></span><span>Hedef süre <b>${mmss(o.J.target)}</b></span><span>Ham parça <b>${o.free ? 'müşteriden' : tl(o.cost)}</b></span>${o.J.big ? '<span>Bağlama <b>pabuç / vakum</b></span>' : o.J.arcs && o.J.arcs.length ? '<span>Bağlama <b>döner tabla</b></span>' : ''}${o.cond ? `<span>Koşul <b>${COND[o.cond].tag}${o.qty ? ` · ${o.doneQty || 0}/${o.qty} teslim` : ''}</b></span>` : ''}`;
    $('jcBtns').hidden = false; $('vDraw').hidden = false;
    $('dwTitle').textContent = `TEKNİK RESİM · SİPARİŞ #${o.id} · ${o.J.title.toLocaleUpperCase('tr')}`;
    $('dwSvg').innerHTML = drawingSVG(o.J); $('dwTable').innerHTML = drawingTable(o.J);
    $('drawing').hidden = window.innerWidth < 900;
    const act = S.job && S.job.order && S.job.order.id === o.id && !S.job.done;
    buildScribe(act ? o.J : null);
    $('jobStart').textContent = act ? 'Yeniden başla (yeni ham parça)' : o.free ? 'İşe başla' : `İşe başla (ham parça ${tl(o.cost)})`;
    render();
  }
  function start() {
    if (!sel) { log('Önce panodan bir sipariş seçin.', 'warn'); return; }
    const o = sel;
    if (o.cost > st.money) { log(`Kasada ham parça için yeterli para yok (${tl(o.cost)}). Malzemesi müşteriden gelen bir iş seçin ya da panoyu yenileyin.`, 'warn'); return; }
    // bağlama: büyük plaka mengeneye sığmaz; kurulu bağlama parçayı almıyorsa uygun olana geçilir
    if (o.J.arcs && o.J.arcs.length) {                              // yay kanal: döner tabla şart
      if (!hasEq('rot')) { log('Bu işteki yay kanal döner tabla ister: dükkândan alabilirsiniz.', 'warn'); openShop(); return; }
      if (FIX !== 'rot') setFix('rot', true);
    }
    const fits = k => o.J.w >= FIXLIM[k].x[0] && o.J.w <= FIXLIM[k].x[1] && o.J.d >= FIXLIM[k].y[0] && o.J.d <= FIXLIM[k].y[1] && o.J.h >= FIXLIM[k].z[0] && o.J.h <= FIXLIM[k].z[1];
    if (FIX === 'div' || !fits(FIX)) {
      const k = ['vise', 'clamp', 'vac'].find(q => fits(q) && (q === 'vise' || hasEq(q)));
      if (!k) { log('Bu parça mengeneye sığmaz: pabuç takımı ya da vakum tabla gerekir (dükkân).', 'warn'); openShop(); return; }
      setFix(k, true);
    }
    const sac = PAR.sac && ['vise', 'clamp', 'rot'].includes(FIX) ? 40 : 0;   // kurban plaka sarf malzemesi
    if (o.cost + sac > st.money) { log(`Kasada ham parça ve kurban plaka için yeterli para yok (${tl(o.cost + sac)}).`, 'warn'); return; }
    st.money -= o.cost + sac; save();
    if (sac) log(`Kurban plaka: −${tl(sac)}.`);
    if (o.J.blank) {                                                 // müşterinin parçası: aynı tohumla aynı parça
      const P = loadBlank(o.J.blank.id, o.J.blank.seed, true);
      Object.defineProperty(o.J, '_P', { value:P, enumerable:false, writable:true, configurable:true });
    } else {
      if (PW !== o.J.w || PD !== o.J.d || PH !== o.J.h) setStock(o.J.w, o.J.d, o.J.h, true);
      resetPart(o.mat);
    }
    S.job = { idx:-1, order:o, J:o.J, time:0, done:false, stats:{ breaks:0, load:0, spot:0, peck:0, rub:0 } };
    $('report').hidden = true;
    buildScribe(o.J); select(o);
    if (o.cost) cash(-o.cost);
    setTimeout(() => warnParallels(o.J), 300);
    log(`Sipariş #${o.id} başladı: ${o.J.title}, ${MATS[o.mat].short} ${o.J.w}×${o.J.d}×${o.J.h}${o.cost ? `, ham parça −${tl(o.cost)}` : ''}. Sıfır noktası sol-ön-üst köşede.`, 'ok');
  }
  // teslim: tam kabulde yıldıza göre ödeme ve süre primi; şartlı kabulde %40; hurdada para yok, sipariş panoda kalır
  function settle(run, r) {
    const o = run.order;
    let pay = 0, rep = 0, txt;
    const tags = [];
    if (r.allOk) {
      const onTime = run.time <= o.J.target;
      pay = Math.round(o.pay * ({ 3:1.15, 2:1 }[r.stars] || 0.85) * (onTime ? 1.1 : 1) * (o.cond === 'acil' && !onTime ? 0.8 : 1) / 10) * 10; rep = Math.max(1, r.stars) + o.lv;
      if (o.cond === 'acil') tags.push(onTime ? ['Acil iş zamanında: ×1.6', 'ok'] : ['Acil iş gecikti: −%20', 'warn']);
      if (o.cond === 'hassas') tags.push(['Hassas iş: ×1.5', 'ok']);
      if (o.qty && (o.doneQty || 0) + 1 >= o.qty) { pay = Math.round(pay * 1.1 / 10) * 10; tags.push(['Seri tamamlandı +%10', 'ok']); }
      const clean = chipsOnPart() === 0;
      if (clean) pay = Math.round(pay * 1.05 / 10) * 10;
      if (r.stars === 3) tags.push(['Kusursuz parça +%15', 'ok']);
      tags.push(onTime ? ['Zamanında teslim +%10', 'ok'] : ['Gecikti: zaman primi yok', 'warn']);
      tags.push(clean ? ['Temiz teslim +%5', 'ok'] : ['Talaşlı teslim: hava tabancası +%5 kazandırırdı', 'warn']);
      txt = `Müşteri memnun: +${tl(pay)}${run.time <= o.J.target ? ' (zamanında teslim primi dahil)' : ''}${clean ? ' · temiz teslim +%5' : ' · parça talaşlı geldi, temizleseydiniz +%5'} · itibar +${rep}`;
    } else if (r.stars >= 1) { pay = Math.round(o.pay * 0.04) * 10; txt = `Şartlı kabul, indirimli ödeme: +${tl(pay)} · itibar değişmedi`; tags.push(['Şartlı kabul: ödemenin %40\'ı', 'warn']); }
    else if (o.own) {
      rep = -3; const v = Math.min(st.money, o.value); pay = -v;
      txt = `Müşterinin parçası hurdaya çıktı: parça bedeli −${tl(v)} · itibar −3.`; tags.push([`Müşteri parçası hurda: parça bedeli −${tl(v)}`, 'warn']);
    }
    else { rep = -2; txt = `Parça hurda: ödeme yok · itibar −2. Sipariş panoda duruyor, yeni ham parçayla tekrar deneyebilirsiniz.`; tags.push(['Hurda: sipariş panoda, tekrar deneyebilirsiniz', 'warn']); }
    const lv0 = level();
    st.money += pay; st.earned += pay; st.rep = Math.max(0, st.rep + rep);
    if (pay > 0 && o.qty && (o.doneQty = (o.doneQty || 0) + 1) < o.qty) { st.done++; tags.push([`Seri: ${o.doneQty}/${o.qty} teslim edildi, sıradaki adet için "Sıradaki adet"`, 'ok']); }   // seri: sipariş panoda kalır
    else if (pay > 0 || o.own) { if (pay > 0) st.done++; st.orders = st.orders.filter(q => q.id !== o.id); sel = null; fillBoard(); }   // müşteri parçası tek: hurdada da sipariş gider
    save();
    if (pay) cash(pay);
    if (level() > lv0) { txt += ` · YENİ SEVİYE: ${LEVELS[level()][1]}!`; tags.unshift([`Yeni seviye: ${LEVELS[level()][1]}`, 'gold']); log(`Atölye büyüdü: ${LEVELS[level()][1]}. Daha büyük ve daha iyi ödeyen işler gelecek.`, 'ok'); }
    render();
    return { txt, pay, rep, repTotal:st.rep, money:st.money, tags };
  }
  function cash(v) {                                              // kasa sesi ve üst çubukta yanıp sönen tutar
    if (v > 0) { beep(1300, 0.08); setTimeout(() => beep(1750, 0.12), 110); }
    $('tbMoney').classList.remove('flash-up', 'flash-dn'); void $('tbMoney').offsetWidth;
    $('tbMoney').classList.add(v > 0 ? 'flash-up' : 'flash-dn');
  }
  function buy(i) {
    const T = TOOLS[i], p = priceOf(T);
    if (!on || st.owned[T.no]) return true;
    if (st.money < p) { log(`${T.no} için kasada yeterli para yok: ${tl(p)} gerekli.`, 'warn'); return false; }
    st.money -= p; st.owned[T.no] = 1; save(); cash(-p);
    log(`${T.no} ${T.name} Ø${T.d} satın alındı: −${tl(p)}.`, 'ok');
    render(); return true;
  }
  // dolapta olmayan takım: ilk tık fiyatı söyler, 4 s içinde ikinci tık satın alır
  function allowTool(i) {
    if (owns(i)) return true;
    if (isTaster(TOOLS[i])) { log(`${TOOLS[i].name} atölyede yok: dükkândan alabilirsiniz.`, 'warn'); openShop(); return false; }
    const T = TOOLS[i], p = priceOf(T);
    if (st.money < p) { log(`${T.no} ${T.name} dolapta yok ve kasada ${tl(p)} yok.`, 'warn'); return false; }
    if (arm.i === i && performance.now() - arm.t < 4000) { arm.i = -1; return buy(i); }
    arm = { i, t:performance.now() };
    log(`${T.no} ${T.name} dolapta yok. Satın alıp takmak için tekrar tıklayın: ${tl(p)}.`, 'warn');
    return false;
  }
  function lost(i) {
    if (on && TOOLS[i].type === 'dial') { if (st.money >= 180) { st.money -= 180; save(); cash(-180); } log('Yedek stylus takıldı: −180 ₺. Taster sağlam.', 'warn'); render(); return; }
    if (on && isProbe(TOOLS[i]) && st.eq.probe) { delete st.eq.probe; save(); log('3B taster kırıldı. Yenisi dükkânda (2.500 ₺).', 'warn'); render(); return; }
    if (!on || !st.owned[TOOLS[i].no]) return;
    delete st.owned[TOOLS[i].no]; save();
    log(`${TOOLS[i].no} kırıldı ve hurdaya gitti. Yenisi ${tl(priceOf(TOOLS[i]))}; takım kartına iki kez tıklayın.`, 'warn');
    render();
  }
  function charge(v, what) {
    if (!on) return true;
    if (st.money < v) { log(`${what} için kasada yeterli para yok (${tl(v)}).`, 'warn'); return false; }
    st.money -= v; save(); cash(-v); log(`${what}: −${tl(v)}.`); render(); return true;
  }
  function forget(no) { if (st.owned[no]) { delete st.owned[no]; save(); } }
  function setMode(c) {
    if (c === on) return;
    if (S.job && !S.job.done) log('Süren iş bırakıldı.', 'warn');
    on = c; S.job = null; sel = null; save();
    selectJob(-1);
    if (on) { fillBoard(); save(); PM.preset('kariyer'); log(`Kariyer modu: kasada ${tl(st.money)}, itibar ${st.rep}. Panodan bir sipariş seçin.`, 'ok'); }
    else log('Serbest atölye: her şey açık ve ücretsiz.', 'ok');
    render();
  }
  function openShop() { initAudio(); renderShop(); $('shop').hidden = false; }
  $('crShop').addEventListener('click', openShop); $('tbMoney').addEventListener('click', openShop);
  $('shClose').addEventListener('click', () => { $('shop').hidden = true; });
  window.addEventListener('keydown', e => { if (!$('shop').hidden && e.code === 'Escape') { e.stopImmediatePropagation(); $('shop').hidden = true; } }, true);
  load();
  setRackTag(i => on ? { own:owns(i), price:tl(priceOf(TOOLS[i])) } : null);
  $('modeSw').addEventListener('click', e => { const b = e.target.closest('[data-mode]'); if (b) setMode(b.dataset.mode === 'career'); });
  $('crRefresh').addEventListener('click', () => {
    if (S.job && S.job.order && !S.job.done) { log('İş sürerken pano yenilenmez.', 'warn'); return; }
    st.orders = []; sel = null; fillBoard(); save(); selectJob(-1); render(); log('Sipariş panosu yenilendi.');
  });
  let resetArm = 0;
  $('crReset').addEventListener('click', () => {
    if (performance.now() - resetArm > 3000) { resetArm = performance.now(); $('crReset').textContent = 'Emin misiniz? Tekrar tıklayın'; setTimeout(() => $('crReset').textContent = 'Kariyeri sıfırla', 3000); return; }
    st = fresh(); S.job = null; sel = null; fillBoard(); save(); selectJob(-1); render(); log('Kariyer sıfırlandı: 1.500 ₺ ve üç takımla yeniden başlıyorsunuz.', 'ok');
  });
  if (on) fillBoard();
  return { get on() { return on; }, hasEq, openShop, render, start, settle, allowTool, lost, charge, forget, priceOf, get sel() { return sel; } };
})();


Object.assign(app, { CR });   // önceki modüllerin geç başvuruları

export { CR };
