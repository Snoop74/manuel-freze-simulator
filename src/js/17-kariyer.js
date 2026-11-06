// ── Kariyer (CR): kasa, itibar, kredi, gün ve posta, teklif, dükkân, ekipman, teslimde ödeme (sipariş üretimi 16-siparis'te)
import { kayit } from './00-kayit.js';
import { $, MATS, PD, PH, PW, S, TOOLS, app, clamp, isTaster, log } from './00-temel.js';
import { beep, initAudio } from './01-ses.js';
import { FIXLIM } from './03-tabla-parca.js';
import { FIX, PAR, warnParallels } from './05-baglama.js';
import { clearChips } from './06-talas.js';
import { HOLDERS } from './07-takim-gorsel.js';
import { renderRack, resetPart, setRackTag, updateToolUI } from './09-kumanda.js';
import { buildScribe, drawingSVG, drawingTable, mmss, selectJob, setSelJob } from './10-is-emri-muayene.js';
import { PM, toolIcon } from './11-paneller.js';
import { chipsOnPart, setFix } from './13-aletler.js';
import { setStock } from './14-parca-masasi.js';
import { TE, toolPrice } from './15-takim-editoru.js';
import { genBlank, loadBlank } from './16-hazir-parca.js';
import { COND, genOrder as uret, pick, rnd, tl } from './16-siparis.js';

const CR = (() => {
  const KEY = 'freze-career-v1', MKEY = 'freze-mode';
  const LEVELS = [[0, 'Mahalle atölyesi'], [15, 'Güvenilir atölye'], [45, 'Fabrika tedarikçisi'], [90, 'Hassas iş ustası']];   // 2026-11-05 ekonomi dengesi (eski 12/35/70)
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
    { id:'cnc', n:'CNC dönüşüm kiti', t:'Step motor ve kumanda: tezgâh G-kod programıyla çalışır (G0/G1, G81/G83 delme). Seri işler hızlanır', p:30000, ready:true },
    { id:'div', n:'Divizör', t:'Yuvarlak parçaya altıgen, kare, kama kanalı', p:12000 },
  ];
  let st = null, on = false, sel = null, arm = { i:-1, t:0 };
  const fresh = () => ({ money:1500, rep:0, done:0, earned:0, owned:Object.fromEntries(START.map(n => [n, 1])), eq:{}, orders:[], seq:1, kirik:{}, eksi:0,
    gun:1, dk:0, mail:[], mailSeq:1, sonrakiMail:40, bugun:{ gelir:0, gider:0, rep:0, teslim:0, olay:[] }, dukkan:{ sv:0, yuk:{} } });
  function load() {
    st = kayit.oku(KEY, null);
    if (!st || typeof st.money !== 'number' || !Number.isFinite(st.money)) st = fresh();
    if (!st.owned || typeof st.owned !== 'object') st.owned = {};
    if (!st.eq || typeof st.eq !== 'object') st.eq = {};
    if (!st.kirik || typeof st.kirik !== 'object') st.kirik = {};
    if (typeof st.eksi !== 'number') st.eksi = 0;
    if (!Array.isArray(st.mail)) Object.assign(st, { gun:1, dk:0, mail:[], mailSeq:1, sonrakiMail:40 });   // gün ve posta öncesi kayıt
    if (!st.bugun || typeof st.bugun !== 'object') st.bugun = { gelir:0, gider:0, rep:0, teslim:0, olay:[] };
    if (!st.dukkan || typeof st.dukkan !== 'object' || !st.dukkan.yuk) st.dukkan = { sv:0, yuk:{} };   // dükkân öncesi kayıt: garaj
    st.orders = Array.isArray(st.orders) ? st.orders.filter(o => o && o.J && MATS[o.mat]) : [];
    st.orders.forEach(o => (o.J.pockets || []).forEach(p => { if (p.r == null) p.r = 5; }));
    on = kayit.oku(MKEY) === 'career';
  }
  const save = () => { kayit.yaz(KEY, st); kayit.yaz(MKEY, on ? 'career' : 'free'); };
  const level = () => { let l = 0; LEVELS.forEach(([r], i) => { if (st.rep >= r) l = i; }); return l; };
  const priceOf = T => T.price || BUILTIN_PRICE[T.no] || toolPrice(TE.specOf(T));
  const owns = i => !on || (isTaster(TOOLS[i]) ? !!st.eq[TOOLS[i].type] : !!st.owned[TOOLS[i].no] && !st.kirik[TOOLS[i].no]);
  /* -- Kasa eksiye düşebilir (kredili hesap): limit seviyeyle büyür. 5 teslim içinde artıya dönmezse her teslimde borcun %8'i faiz.
     Kırılan takım hurdaya gitmez, dolapta kırık durur: biletmek (ya da alın frezesinde uç değiştirmek) fiyatın %30'u. Böylece oyun kilitlenmez. -- */
  const KREDI_SURE = 5, FAIZ = 0.05;                              // 2026-11-05: acemi borç sarmalından çıkabilsin (eski %8)
  const kredi = () => 2500 + level() * 1500;
  const yeter = v => st.money - v >= -kredi();                    // bu harcama kredi limitini aşmıyor mu
  const bileme = T => Math.max(60, Math.round(priceOf(T) * 0.3 / 10) * 10);
  function harca(v) {                                             // kasadan düş; ilk kez eksiye düşünce haber ver
    const once = st.money; st.money -= v; if (st.bugun) st.bugun.gider += v;
    if (once >= 0 && st.money < 0) log(`Kasa eksiye düştü (${tl(st.money)}): kredi limiti ${tl(kredi())}. ${KREDI_SURE} teslim içinde artıya dönmezseniz faiz işler.`, 'warn');
  }
  const hasEq = id => !on || !!st.eq[id];
  function buyEq(id) {
    const E = EQUIP.find(q => q.id === id);
    if (!E || !on || st.eq[id]) return;
    if (!yeter(E.p)) { log(`${E.n} için kredi limiti yetmiyor: ${tl(E.p)} gerekli.`, 'warn'); return; }
    harca(E.p); st.eq[id] = 1; save(); cash(-E.p);
    log(`${E.n} atölyeye geldi: −${tl(E.p)}.`, 'ok'); render();
  }

  const genOrder = free => { const o = uret(free, level(), () => st.seq++); if (o.cost && st.dukkan.yuk.raf) o.cost = Math.round(o.cost * 0.8 / 10) * 10; return o; };
  const bekler = o => o.teklif === 'bekliyor' || o.teklif === 'karsi';
  const payTxt = o => bekler(o) ? 'teklif bekleniyor' : tl(o.pay) + (o.ayni ? ' + ' + o.ayni : '');

  /* -- Teklif: bazı müşteriler fiyatı sizden ister. Gerçek bütçe (o.pay) gizli; atölyenin piyasa tahmini (o.est) ±%15 şaşar.
     Ucuz teklif hep tutar ama kâr az; pahalı teklifte müşteri ya karşı teklif yapar ya başka atölyeye gider.
     Hızlı termin: hedef süre ×0.7, müşteri daha kolay kabul eder ama geç teslimde ödemeden %30 kesilir. -- */
  const TEKLIF = [[0.85, 'Ucuz'], [1, 'Piyasa'], [1.15, 'Kârlı'], [1.3, 'Pahalı'], [1.5, 'Fahiş']];
  const PAZARLIK = { fabrika:-0.12, kalıphane:-0.06, rektifiye:-0.04, servis:-0.04, havacılık:0.05, enerji:0.1, kurum:0.1, 'sosyal medya':0.2, reklam:0.12, 'oto tuning':0.06, komşu:0.15 };
  let hizliSec = false;                                           // kartta seçili termin
  const hizliOn = o => hizliSec && o.cond !== 'acil';              // acil iş zaten hızlı: termin seçilmez
  function teklifIste(o) {
    if (!o.ayni && Math.random() < 0.4) { o.teklif = 'bekliyor'; o.est = Math.round(o.pay * rnd(0.85, 1.15) / 10) * 10; }
    return o;
  }
  // kabul olasılığı: teklif/bütçe oranına, müşterinin pazarlıkçılığına, itibar seviyesine ve termine göre
  const kabulP = (o, fiyat, hizli) => clamp(0.92 - 2.2 * (fiyat / o.pay - 1) + (PAZARLIK[o.kind] || 0) + level() * 0.03 + (hizli ? 0.12 : 0), 0.03, 0.97);
  function teklifKabul(o, fiyat, hizli) {
    o.pay = fiyat; o.teklif = 'kabul';
    if (hizli) { o.hizli = true; o.J.target = Math.round(o.J.target * 0.7 / 10) * 10; o.J.brief += ' HIZLI TERMİN: hedef süreyi kaçırırsanız ödemeden %30 kesilir.'; }
  }
  function teklifVer(o, fiyat) {
    initAudio();
    const hizliSec = hizliOn(o);
    if (Math.random() < kabulP(o, fiyat, hizliSec)) {
      teklifKabul(o, fiyat, hizliSec); beep(1300, 0.08);
      log(`${o.cust} teklifi kabul etti: ${tl(fiyat)}${hizliSec ? ', hızlı termin' : ''}. İşe başlayabilirsiniz.`, 'ok');
    } else if (fiyat / o.pay < 1.45 && Math.random() < 0.6) {
      o.teklif = 'karsi'; o.karsi = Math.round(o.pay * rnd(0.85, 1.0) / 10) * 10; o.hizliT = hizliSec;
      log(`${o.cust}: "${tl(fiyat)} çok, ${tl(o.karsi)} olur mu?"`, 'warn');
    } else { vazgec(o, `${o.cust} teklifinizi pahalı buldu, başka atölyeye gitti.`); return; }
    save(); select(o);
  }
  function vazgec(o, msg) {
    st.orders = st.orders.filter(q => q.id !== o.id); sel = null; save();   // yerine yenisi posta zamanlayıcısıyla gelir (anında doldurma reddet-yenile sömürüsüydü)
    selectJob(-1); render(); log(msg, 'warn');
  }
  function teklifKart(o) {
    const el = $('jcTeklif'); el.hidden = !bekler(o); el.innerHTML = ''; el.classList.toggle('karsi', o.teklif === 'karsi');
    if (!bekler(o)) return;
    const btn = (metin, cls, fn) => { const b = document.createElement('button'); b.className = 'btn' + (cls ? ' ' + cls : ''); b.innerHTML = metin; b.addEventListener('click', fn); el.append(b); return b; };
    if (o.teklif === 'karsi') {
      el.insertAdjacentHTML('beforeend', `<div class="tk-not">${o.cust} karşı teklif yaptı: <b>${tl(o.karsi)}</b>${o.hizliT ? ' (hızlı termin)' : ''}</div>`);
      btn('Kabul et', 'start', () => { teklifKabul(o, o.karsi, o.hizliT); save(); log(`Anlaştınız: ${tl(o.karsi)}.`, 'ok'); select(o); });
      btn('Vazgeç', '', () => vazgec(o, `${o.cust} ile anlaşamadınız; sipariş panodan kalktı.`));
      return;
    }
    el.insertAdjacentHTML('beforeend', `<div class="tk-not">Müşteri fiyat istiyor. Atölyenin piyasa tahmini <b>~${tl(o.est)}</b> (tahmin şaşabilir). Pahalı teklif reddedilebilir.</div>`);
    for (const [k, ad] of TEKLIF) { const f = Math.round(o.est * k / 10) * 10; btn(`${ad}<small>${tl(f)}</small>`, k === 1 ? 'start' : '', () => teklifVer(o, f)); }
    if (o.cond === 'acil') return;
    const t = btn(hizliSec ? 'Termin: HIZLI (süre ×0.7)' : 'Termin: normal', 'tk-termin' + (hizliSec ? ' on' : ''), () => { hizliSec = !hizliSec; teklifKart(o); });
    t.title = 'Hızlı termin müşterinin kabulünü kolaylaştırır; geç kalırsanız ödemeden %30 kesilir';
  }

  /* -- Gün ve posta: siparişler mail olarak gelir; saat makine çalışırken ilerler (1 s kesme ≈ 1 dk mesai, 08:00–18:00).
     Normal sipariş ertesi gün akşamına kadar cevap bekler, ACİL olan 1 saat; kabul edilen işin termini var (ACİL: bugün akşam).
     Aynı anda tek iş kabul edilir. 18:00'de (mil dururken) gün biter: kira ve elektrik düşülür, muhasebeden gün sonu raporu gelir. -- */
  const MESAI = 600, ACIL_CEVAP = 60;
  /* -- Dükkânı büyütme: aşama (garaj → atölye) ve yükseltmeler. Taşınmak için itibar ve para; kira aşamayla büyür.
     Her yükseltme oyunda bir şeyi değiştirir ve atölyede görünür (19-atolye). Serbest atölyede hepsi açık (yukVar). -- */
  const DUKKAN = [
    { ad:'Garaj', t:'Tek tezgâh, mahalle işleri', kira:120 },
    { ad:'Atölye', t:'Daha büyük salon, fabrika işleri gelmeye başlar', kira:400, rep:20, para:13000 },   // nakit: kredi kullanılmaz (tasin)
  ];
  const YUK = [
    { id:'olcu', sv:0, ad:'Ölçü masası', p:600, t:'İş penceresinde "Ön kontrol": teslimden önce ölçüleri gör' },
    { id:'pompa', sv:0, ad:'Soğutma pompası', p:1000, t:'Takım aşınması %30 az' },
    { id:'raf', sv:0, ad:'Malzeme rafı', p:1800, t:'Ham parça %20 ucuz (toplu alım)' },
    { id:'yIlerleme', sv:0, ad:'Y ilerleme motoru', p:1200, t:'Kumandada Y ekseni için de otomatik ilerleme' },
    { id:'motor', sv:1, ad:'Güçlü mil motoru', p:6000, t:'Mil gücü 2.2 → 3.3 kW: derin paso, çelikte hızlı iş' },
    { id:'cirak', sv:1, ad:'Çırak', p:1000, gunluk:250, t:'Gün sonunda kırık takımları biler, talaşı süpürür. Günlük 250 ₺' },
    { id:'web', sv:1, ad:'Web sitesi', p:2000, t:'Gelen kutusunda her zaman bir sipariş daha' },
  ];
  const yukVar = id => !on || !!(st && st.dukkan.yuk[id]);
  const kira = () => Math.round((DUKKAN[st.dukkan.sv].kira + (st.dukkan.sv ? level() * 40 : 0))   // garajda sabit 120 (acemi ezilmesin)
    * (st.dukkan.sv && st.gun - (st.dukkan.tasinmaGun || 0) < 7 ? 0.5 : 1));                       // taşındıktan sonra ilk hafta kira yarım
  function dukkanUygula() {                                       // yükseltmelerin tezgâha etkisi ve atölyedeki görünüşü
    S.motorK = yukVar('motor') ? 1.5 : 1;
    if (app.ATL) app.ATL.dukkanGor({ sv:on ? st.dukkan.sv : 1, yuk:Object.fromEntries(YUK.map(u => [u.id, yukVar(u.id)])) });
  }
  function dukkanAl(id) {
    const u = YUK.find(q => q.id === id); if (!u || st.dukkan.yuk[id]) return false;
    if (u.sv > st.dukkan.sv) { log(`${u.ad} için önce ${DUKKAN[u.sv].ad}'ye taşının.`, 'warn'); return false; }
    if (!yeter(u.p)) { log(`${u.ad} için kasa ve kredi yetmiyor (${tl(u.p)}).`, 'warn'); return false; }
    harca(u.p); cash(-u.p); st.dukkan.yuk[id] = true; save(); dukkanUygula(); render();
    log(`${u.ad} alındı: ${u.t}.`, 'ok'); return true;
  }
  function tasin() {
    const D = DUKKAN[st.dukkan.sv + 1]; if (!D) return false;
    if (st.rep < D.rep) { log(`${D.ad}'ye taşınmak için ${D.rep} itibar gerekli (şu an ${st.rep}).`, 'warn'); return false; }
    if (st.money < D.para) { log(`${D.ad}'ye taşınmak için kasada ${tl(D.para)} nakit gerekli (kredi kullanılamaz; şu an ${tl(st.money)}).`, 'warn'); return false; }   // usta krediyle 5. günde taşınıp kilitleniyordu
    harca(D.para); cash(-D.para); st.dukkan.sv++; st.dukkan.tasinmaGun = st.gun; save(); dukkanUygula(); render();
    mailEkle({ tip:'bilgi', kimden:'Otto Usta', kind:'eski usta', konu:`Hayırlı olsun: ${D.ad}!`, metin:`Duydum ki ${D.ad.toLocaleLowerCase('tr')}ya taşınmışsın. İlk hafta ev sahibi kiranın yarısını istiyor (${tl(kira())}/gün), sonra iki katı; dikkat et; ama büyük işler de büyük yerde yapılır. Yolun açık olsun.` });
    log(`${D.ad}'ye taşındınız. Yeni yükseltmeler açıldı; kira ${tl(kira())}/gün.`, 'ok'); return true;
  }
  const simdi = () => st.gun * 1440 + st.dk;                      // karşılaştırma için mutlak dakika
  const GUNLER = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];
  const saatTxt = dk => `${String(8 + Math.floor(dk / 60)).padStart(2, '0')}:${String(Math.floor(dk % 60)).padStart(2, '0')}`;
  const anTxt = t => { const g = Math.floor(t / 1440), dk = t - g * 1440; return `${g === st.gun ? 'bugün' : g === st.gun + 1 ? 'yarın' : GUNLER[(g - 1) % 7]} ${saatTxt(dk)}`; };
  const bosGun = () => ({ gelir:0, gider:0, rep:0, teslim:0, olay:[] });
  let raporBekliyor = false, sonKayit = 0;
  function mailEkle(m) {
    Object.assign(m, { id:st.mailSeq++, gun:st.gun, dk:Math.round(st.dk), okundu:false });
    st.mail.unshift(m); if (st.mail.length > 40) st.mail.length = 40;
    return m;
  }
  function siparisMaili(o) {                                      // siparişin cevap süresi ve maili
    o.son = o.cond === 'acil' ? simdi() + ACIL_CEVAP : (st.gun + 1) * 1440 + MESAI;
    o.mailId = mailEkle({ tip:'siparis', orderId:o.id, kimden:o.cust, kind:o.kind, konu:o.J.title }).id;
  }
  const bekleyen = () => st.orders.filter(o => !o.kabul);
  function yeniSiparis(bildir) {
    if (bekleyen().length >= 5) return;
    const o = teklifIste(genOrder(false)); st.orders.push(o); siparisMaili(o);
    if (bildir) { beep(1100, 0.06); setTimeout(() => beep(1500, 0.08), 120); log(`Yeni mail: ${o.cust} · ${o.J.title}`, 'ok'); if (app.PC) app.PC.yeniMail(); }
  }
  function suresiDolanlar() {                                     // cevap verilmeyen siparişler başka atölyeye gider
    for (const o of bekleyen()) if (o.son && simdi() > o.son && !(sel && sel.id === o.id && S.job && S.job.order === o)) {
      st.orders = st.orders.filter(q => q !== o);
      const m = st.mail.find(q => q.id === o.mailId); if (m) m.durum = 'süresi doldu';
      log(`${o.cust} cevap alamadı, başka atölyeye gitti.`, 'warn');
      if (sel === o) { sel = null; selectJob(-1); }
    }
  }
  function ilerle(d) {                                            // 12'deki döngü çağırır: makine çalışırken d dakika
    if (!on || raporBekliyor || !st) return;
    st.dk += d;
    if (st.dk >= st.sonrakiMail && st.dk < MESAI) { yeniSiparis(true); st.sonrakiMail = st.dk + rnd(70, 160); }
    suresiDolanlar();
    if (st.dk - sonKayit > 5) { sonKayit = st.dk; save(); }
    kontrol();
  }
  function kontrol() { if (on && st.dk >= MESAI && !S.spindle && !raporBekliyor) gunSonu(); }
  function gunuBitir() {
    if (S.spindle) { log('Günü bitirmek için önce mili durdurun.', 'warn'); return; }
    st.dk = Math.max(st.dk, MESAI); gunSonu();
  }
  function gunSonu() {
    raporBekliyor = true;
    st.devir = Math.max(0, Math.round(st.dk - MESAI));   // 18:00'i aşan süre ertesi sabaha devreder (fazla mesai bedava değil); bir günü aşarsa ertesi gün de kirasıyla kapanır
    const k = kira(); harca(k); cash(-k);
    if (st.dukkan.yuk.cirak) {                                    // çırak: maaşını alır, kırıkları biler, talaşı süpürür
      const n = Object.keys(st.kirik).length, ucret = YUK.find(u => u.id === 'cirak').gunluk;
      harca(ucret); st.kirik = {}; clearChips(); renderRack();
      st.bugun.olay.push(`Çırak: ${n ? n + ' kırık takımı biledi, ' : ''}talaşı süpürdü (−${tl(ucret)}).`);
    }
    const b = st.bugun, yarin = st.orders.filter(o => o.kabul && o.termin && o.termin <= (st.gun + 1) * 1440 + MESAI).map(o => `${o.J.title} (${o.cust}): ${anTxt(o.termin)}`);
    const r = { gun:st.gun, gunAd:GUNLER[(st.gun - 1) % 7], gelir:b.gelir, gider:b.gider, kira:k, kar:b.gelir - b.gider, rep:b.rep, teslim:b.teslim, olay:b.olay.slice(),
      kasa:st.money, eksi:st.money < 0 ? `${st.eksi}/${KREDI_SURE} teslim` : '', yarin, bekleyen:bekleyen().length };
    mailEkle({ tip:'rapor', kimden:'Muhasebe', kind:'atölye', konu:`${r.gun}. gün raporu (${r.gunAd})`, rapor:r });
    save(); render();
    if (app.PC) app.PC.rapor(r); else ertesiGun();
  }
  function ertesiGun() {
    raporBekliyor = false;
    st.gun++; st.dk = st.devir || 0; st.devir = 0; sonKayit = 0;
    if (st.dk >= MESAI) log(`Dünkü iş bugünün mesaisini de yedi (${st.dk} dakika taştı): bu gün de kapanıyor.`, 'warn');
    else if (st.dk) log(`Dünkü işin ${st.dk} dakikası bugüne taştı: güne ${saatTxt(st.dk)}'de başlıyorsunuz.`); st.sonrakiMail = rnd(25, 80); st.bugun = bosGun();
    suresiDolanlar(); fillBoard(); yeniSiparis(false);
    save(); render(); log(`${st.gun}. gün (${GUNLER[(st.gun - 1) % 7]}) başladı: 08:00. Maillere bakın.`, 'ok');
  }
  function kabul(o) {                                             // iş kabul edilir: termin konur, iş başlar
    const akt = st.orders.find(q => q.kabul && q !== o);
    if (akt) { log(`Önce aktif işi bitirin: ${akt.J.title} (${akt.cust}).`, 'warn'); return false; }
    if (bekler(o)) { log('Önce fiyat teklifi verin.', 'warn'); return false; }
    // ekonomi ajanı (Opus) buldu: kasa yetmeyince iş kabul edilmiş halde takılı kalıyor, başka iş alınamıyordu
    if (!o.free && !yeter(o.cost)) { log(`Ham parça için kasa ve kredi yetmiyor (${tl(o.cost)}). Malzemesi müşteriden gelen bir iş seçin.`, 'warn'); return false; }
    if (o.J.arcs && o.J.arcs.length && !hasEq('rot')) { log('Bu iş döner tabla ister: önce dükkândan alın.', 'warn'); openShop(); return false; }
    o.kabul = true;
    o.termin = o.cond === 'acil' ? (st.dk < 420 ? st.gun * 1440 + MESAI : (st.gun + 1) * 1440 + 240) : (st.gun + (o.qty ? 2 : 1)) * 1440 + MESAI;
    const m = st.mail.find(q => q.id === o.mailId); if (m) m.durum = 'kabul edildi';
    save(); select(o); start();
    return true;
  }
  function birak(o) {                                             // kabul edilmiş işi bırak: itibar −1, ham parça parası geri gelmez
    if (!o || !o.kabul) return false;
    if (S.spindle) { log('İşi bırakmadan önce mili durdurun.', 'warn'); return false; }
    st.rep = Math.max(0, st.rep - 1); st.bugun.rep -= 1;
    if (S.job && S.job.order === o) S.job = null;
    const m = st.mail.find(q => q.id === o.mailId); if (m) m.durum = 'bırakıldı';
    vazgec(o, `${o.cust} işini bıraktınız: itibar −1.`);
    return true;
  }
  function reddet(o) {
    const m = st.mail.find(q => q.id === o.mailId); if (m) m.durum = 'reddedildi';
    vazgec(o, `${o.cust} işini geri çevirdiniz.`);
  }
  // teslimden sonra müşterinin cevabı (kurgu: parçanın sonrası)
  const SONUC = {
    reaktor:['Reaktör... stabil. Şimdilik. Bu yazışma hiç olmadı.', 'Ölçüm odası "sıradan" dedi. Bizim için en büyük iltifat budur.'],
    lahmacun:['Fırın yandı, ilk lahmacun sizin! Akşam uğrayın usta.', 'Taş yerine oturdu, müşteri kuyruğu kapıya kadar.'],
    teyze:['Makine tıkır tıkır evladım, börek yolda. Annene selam söyle.', 'Komşulara da söyledim, sizi soran olursa bilin.'],
    robot:['KAZANDIK HOCAM! Kupada atölyenin adı yazacak.', 'Rakip robot ilk turda arenadan uçtu. Zırh sağlam!'],
    altin:['Story 2 milyon izlenme aldı, sizi etiketledim ✨', 'Takipçiler "bu parlaklık nasıl" diye soruyor, sizi gönderdim.'],
    rende:['Kars\'ta kaşar rendeleniyor, eksik olmayın.', 'Rende o kadar iyi ki komşu köyden de sipariş var.'],
    kule:['Fotosel yandı, hat çalışıyor. Teşekkürler usta.', 'Kule sallanmıyor bile, montaj tertemiz.'],
  };
  const GENEL = ['Parça elimize ulaştı, tam oturdu. Eline sağlık usta.', 'Ölçüler tıkır tıkır. Bir dahaki işi de size getiriyoruz.', 'Hızlı ve temiz iş, sağ olun.', 'Montajda hiç uğraşmadık, teşekkürler.'];
  const KOTU = ['Parça ölçü dışı geldi, açıkçası hayal kırıklığı.', 'Biraz uğraştırdı ama idare ettik. Bir dahakine daha dikkatli olalım.'];
  const HURDA = ['Parçamız hurda olmuş... bedelini kestik, üzgünüz.', 'Bu parça kullanılamaz. Başka atölyeye gideceğiz sanırım.'];
  function sonucMaili(o, r, pay) {
    const id = o.J.blank && o.J.blank.id, k = r.allOk ? (SONUC[id] || GENEL) : r.stars >= 1 ? KOTU : HURDA;
    mailEkle({ tip:'bilgi', kimden:o.cust, kind:o.kind, konu:`Re: ${o.J.title}`, metin:pick(k) + (pay > 0 ? `\n\nÖdeme: ${tl(pay)}${o.ayni ? ' + ' + o.ayni : ''}` : '') });
    if (app.PC) app.PC.yeniMail();
  }
  function fillBoard() {                                          // gelen kutusunda en az 2 bekleyen sipariş (gün içinde yenileri gelir)
    while (bekleyen().length < 2 + (st.dukkan.yuk.web ? 1 : 0)) { const o = teklifIste(genOrder(false)); st.orders.push(o); siparisMaili(o); }
    // kasada ham parçaya bile para yoksa müşteri malzemesini getirir: oyun kilitlenmez
    if (!bekleyen().some(o => yeter(o.cost))) { const o = genOrder(true); st.orders.push(o); siparisMaili(o); }
    for (const o of st.orders) if (!o.mailId) siparisMaili(o);  // eski kayıttan kalan siparişler
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
      $('tbMoney').classList.toggle('neg', st.money < 0); $('crMoney').classList.toggle('neg', st.money < 0);
      $('crMoney').title = st.money < 0 ? `Eksi hesap: limit ${tl(kredi())}, ${Math.max(0, KREDI_SURE - st.eksi)} teslim daha faizsiz` : `Kredi limiti ${tl(kredi())}`;
      $('crRep').textContent = st.rep; $('crLevel').textContent = LEVELS[lv][1] + (nx ? ` · sonraki ${nx[0]}` : '');
      $('crDone').textContent = st.done;
      $('starTotal').textContent = `${st.done} teslim`;
      const L = $('orderList'); L.innerHTML = '';
      const akt = st.orders.filter(o => o.kabul);
      if (!akt.length) L.innerHTML = `<div class="dro-note">Aktif iş yok. Yeni işler bilgisayardaki maillerde (${bekleyen().length} bekliyor).</div>`;
      akt.forEach(o => {
        const b = document.createElement('button');
        const act = S.job && S.job.order && S.job.order.id === o.id && !S.job.done;
        b.classList.toggle('active', !!(sel && sel.id === o.id));
        const ct = o.cond ? ` <b class="cond ${o.cond}">${COND[o.cond].tag}${o.qty ? ' ' + (o.doneQty || 0) + '/' + o.qty : ''}</b>` : '';
        b.innerHTML = `<span class="jn">#${o.id}</span><span class="jt">${o.J.title} · ${o.cust}${ct}${act ? ' <em>işleniyor</em>' : ''}</span><span class="js">${payTxt(o)}<i> · termin ${o.termin ? anTxt(o.termin) : '—'}</i></span>`;
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
      b.textContent = own ? 'dolapta' : st.kirik[T.no] ? 'kırık · bilet ' + tl(bileme(T)) : tl(p); b.disabled = own || !on || !yeter(st.kirik[T.no] ? bileme(T) : p);
      b.addEventListener('click', () => buy(i));
      d.append(b); T0.append(d);
    });
    const E0 = $('shopEq'); E0.innerHTML = '';
    EQUIP.forEach(E => {
      const own = E.ready && hasEq(E.id), d = document.createElement('div'); d.className = 'sh-item' + (own ? ' own' : E.ready ? '' : ' soon');
      d.innerHTML = `<span class="ico">◇</span><span class="nm"><b>${E.n}</b><small>${E.t}</small></span>`;
      const b = document.createElement('button'); b.className = 'btn' + (own || !E.ready ? '' : ' start');
      b.textContent = !E.ready ? tl(E.p) + ' · yakında' : own ? 'atölyede' : tl(E.p);
      b.disabled = !E.ready || own || !yeter(E.p);
      b.addEventListener('click', () => buyEq(E.id));
      d.append(b); E0.append(d);
    });
  }
  function select(o) {
    sel = o; setSelJob(-2);
    if (o.J.blank && !o.J._P) Object.defineProperty(o.J, '_P', { value:genBlank(o.J.blank.id, o.J.blank.seed), enumerable:false, writable:true, configurable:true });                                         // iş emri listesindeki seçim kalkar
    $('jcNo').textContent = 'SİPARİŞ #' + o.id; $('jcTitle').textContent = `${o.J.title} · ${o.cust}`; $('jcBrief').textContent = o.J.brief;
    $('jcMeta').innerHTML = `<span>Ödeme <b>${payTxt(o)}</b></span><span>Hedef süre <b>${mmss(o.J.target)}</b></span><span>Ham parça <b>${o.free ? 'müşteriden' : tl(o.cost)}</b></span>${o.J.big ? '<span>Bağlama <b>pabuç / vakum</b></span>' : o.J.arcs && o.J.arcs.length ? '<span>Bağlama <b>döner tabla</b></span>' : ''}${o.cond ? `<span>Koşul <b>${COND[o.cond].tag}${o.qty ? ` · ${o.doneQty || 0}/${o.qty} teslim` : ''}</b></span>` : ''}${o.termin ? `<span>Termin <b>${anTxt(o.termin)}</b></span>` : o.son ? `<span>Cevap <b>${anTxt(o.son)}</b>'e kadar</span>` : ''}`;
    $('jcBtns').hidden = false; $('vDraw').hidden = false; $('jobDemo').hidden = true; teklifKart(o);
    $('dwTitle').textContent = `TEKNİK RESİM · SİPARİŞ #${o.id} · ${o.J.title.toLocaleUpperCase('tr')}`;
    $('dwSvg').innerHTML = drawingSVG(o.J); $('dwTable').innerHTML = drawingTable(o.J);
    $('drawing').hidden = window.innerWidth < 900;
    const act = S.job && S.job.order && S.job.order.id === o.id && !S.job.done;
    buildScribe(act ? o.J : null);
    $('jobStart').textContent = act ? 'Yeniden başla (yeni ham parça)' : bekler(o) ? 'Önce teklif verin' : o.free ? 'İşe başla' : `İşe başla (ham parça ${tl(o.cost)})`;
    render();
  }
  function start() {
    if (!sel) { log('Önce panodan bir sipariş seçin.', 'warn'); return; }
    const o = sel;
    if (o.teklif === 'bekliyor' || o.teklif === 'karsi') { log('Bu müşteri önce fiyat teklifi bekliyor: maildeki teklif düğmelerini kullanın.', 'warn'); return; }
    if (!o.kabul) { if (!kabul(o)) return; return; }   // işe başlamak işi kabul etmek demek (termin başlar)
    if (!yeter(o.cost)) { log(`Kasada ham parça için yeterli para yok (${tl(o.cost)}). Malzemesi müşteriden gelen bir iş seçin ya da panoyu yenileyin.`, 'warn'); return; }
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
    if (!yeter(o.cost + sac)) { log(`Ham parça ve kurban plaka için kredi limiti yetmiyor (${tl(o.cost + sac)}).`, 'warn'); return; }
    harca(o.cost + sac); save();
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
      pay = Math.round(o.pay * ({ 3:1.15, 2:1 }[r.stars] || 0.85) * (onTime ? 1.1 : 1) * (o.cond === 'acil' && !onTime ? 0.65 : 1) / 10) * 10; rep = Math.max(1, r.stars) + o.lv;
      if (o.cond === 'acil') tags.push(onTime ? ['Acil iş zamanında: ×1.35', 'ok'] : ['Acil iş gecikti: −%35', 'warn']);
      if (o.cond === 'hassas') tags.push(['Hassas iş: ×1.5', 'ok']);
      if (o.hizli && !onTime) { pay = Math.round(pay * 0.7 / 10) * 10; tags.push(['Hızlı termin kaçtı: −%30', 'warn']); }
      if (o.teklif === 'kabul') tags.push(['Teklifinizle çalışıldı', 'ok']);
      if (o.termin && simdi() > o.termin) { pay = Math.round(pay * 0.8 / 10) * 10; rep = Math.max(0, rep - 1); tags.push([`Termin kaçtı (${anTxt(o.termin)}): −%20`, 'warn']); }
      if (o.ayni) { rep += o.ayniRep; tags.push([`${o.ayni[0].toLocaleUpperCase('tr')}${o.ayni.slice(1)} geldi: itibar +${o.ayniRep}`, 'gold']); }
      if (o.qty && (o.doneQty || 0) + 1 >= o.qty) { pay = Math.round(pay * 1.1 / 10) * 10; tags.push(['Seri tamamlandı +%10', 'ok']); }
      const clean = chipsOnPart() === 0;
      if (clean) pay = Math.round(pay * 1.05 / 10) * 10;
      if (r.stars === 3) tags.push(['Kusursuz parça +%15', 'ok']);
      tags.push(onTime ? ['Zamanında teslim +%10', 'ok'] : ['Gecikti: zaman primi yok', 'warn']);
      tags.push(clean ? ['Temiz teslim +%5', 'ok'] : ['Talaşlı teslim: hava tabancası +%5 kazandırırdı', 'warn']);
      txt = `Müşteri memnun: +${tl(pay)}${run.time <= o.J.target ? ' (zamanında teslim primi dahil)' : ''}${clean ? ' · temiz teslim +%5' : ' · parça talaşlı geldi, temizleseydiniz +%5'} · itibar +${rep}`;
    } else if (r.stars >= 1) { pay = Math.round(o.pay * 0.04) * 10; txt = `Şartlı kabul, indirimli ödeme: +${tl(pay)} · itibar değişmedi`; tags.push(['Şartlı kabul: ödemenin %40\'ı', 'warn']); }
    else if (o.own) {
      rep = -3; const v = Math.max(0, Math.min(o.value, st.money + kredi())); pay = -v;
      txt = `Müşterinin parçası hurdaya çıktı: parça bedeli −${tl(v)} · itibar −3.`; tags.push([`Müşteri parçası hurda: parça bedeli −${tl(v)}`, 'warn']);
    }
    else {
      rep = -1; const geri = Math.round((o.cost || 0) * 0.5 / 10) * 10;   // hurda metal satışı: acemi her hurdada ham parçanın tamamını yakmasın
      if (geri) { st.money += geri; st.bugun.gelir += geri; tags.push([`Hurda metal satışı: +${tl(geri)}`, 'ok']); }
      txt = `Parça hurda: ödeme yok${geri ? `, hurda metal +${tl(geri)}` : ''} · itibar −1. Sipariş panoda duruyor, yeni ham parçayla tekrar deneyebilirsiniz.`; tags.push(['Hurda: sipariş panoda, tekrar deneyebilirsiniz', 'warn']);
    }
    if (run.montaj && run.montaj.cost) { pay -= run.montaj.cost; tags.push([`Yay diş (Heli-Coil) ×${run.montaj.coil}: −${tl(run.montaj.cost)}`, 'warn']); }
    if (run.montaj && r.allOk) tags.unshift(['Kule bağlandı, sensör yandı', 'gold']);
    const lv0 = level();
    st.money += pay; st.earned += pay; st.rep = Math.max(0, st.rep + rep);
    if (pay > 0) st.bugun.gelir += pay; else st.bugun.gider -= pay;
    st.bugun.rep += rep; st.bugun.teslim++;
    if (st.money < 0) {                                            // eksi hesap: süre dolunca her teslimde faiz
      st.eksi = (st.eksi || 0) + 1;
      if (st.eksi > KREDI_SURE) { const f = Math.round(-st.money * FAIZ / 10) * 10; st.money -= f; tags.push([`Eksi hesap faizi: −${tl(f)}`, 'warn']); }
      else tags.push([`Kasa eksi: ${st.eksi}/${KREDI_SURE} teslim faizsiz`, 'warn']);
    } else { if (st.eksi) tags.push(['Kasa artıya döndü', 'ok']); st.eksi = 0; }
    if (pay > 0 && o.qty && (o.doneQty = (o.doneQty || 0) + 1) < o.qty) { st.done++; tags.push([`Seri: ${o.doneQty}/${o.qty} teslim edildi, sıradaki adet için "Sıradaki adet"`, 'ok']); }   // seri: sipariş panoda kalır
    else if (pay > 0 || o.own) { if (pay > 0) st.done++; st.orders = st.orders.filter(q => q.id !== o.id); sel = null; fillBoard(); }   // müşteri parçası tek: hurdada da sipariş gider
    if (!o.qty || (o.doneQty || 0) >= o.qty || pay <= 0) sonucMaili(o, r, pay);
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
    if (st.kirik[T.no]) return bilet(i);
    if (!yeter(p)) { log(`${T.no} için kredi limiti yetmiyor: ${tl(p)} gerekli.`, 'warn'); return false; }
    harca(p); st.owned[T.no] = 1; save(); cash(-p);
    log(`${T.no} ${T.name} Ø${T.d} satın alındı: −${tl(p)}.`, 'ok');
    render(); return true;
  }
  function bilet(i) {                                             // kırık takımı biletme / alın frezesinde uç değişimi
    const T = TOOLS[i], c = bileme(T);
    if (st.money - c < -kredi() - 1500) { log(`${T.no} biletmek için kredi limiti yetmiyor (${tl(c)}).`, 'warn'); return false; }   // bileme veresiye: limitin 1.500 ₺ ötesine kadar (takımsız kalıp kilitlenmesin)
    harca(c); delete st.kirik[T.no]; S.wear[i] = 0; st.bugun.olay.push(`${T.no} biletildi`); save(); cash(-c);
    log(`${T.no} ${T.type === 'face' ? 'uçları değiştirildi' : 'biletildi'}: −${tl(c)}. Takım kullanıma hazır.`, 'ok');
    render(); return true;
  }
  // dolapta olmayan ya da kırık takım: ilk tık fiyatı söyler, 4 s içinde ikinci tık satın alır / biletir
  function allowTool(i) {
    if (owns(i)) return true;
    if (on && st.kirik[TOOLS[i].no] && st.owned[TOOLS[i].no]) {
      const T = TOOLS[i], c = bileme(T);
      if (arm.i === i && performance.now() - arm.t < 4000) { arm.i = -1; return bilet(i); }
      arm = { i, t:performance.now() };
      log(`${T.no} kırık. ${T.type === 'face' ? 'Uçlarını değiştirmek' : 'Biletmek'} için tekrar tıklayın: ${tl(c)} (yenisi ${tl(priceOf(T))}).`, 'warn');
      return false;
    }
    if (isTaster(TOOLS[i])) { log(`${TOOLS[i].name} atölyede yok: dükkândan alabilirsiniz.`, 'warn'); openShop(); return false; }
    const T = TOOLS[i], p = priceOf(T);
    if (!yeter(p)) { log(`${T.no} ${T.name} dolapta yok ve kredi limiti ${tl(p)} için yetmiyor.`, 'warn'); return false; }
    if (arm.i === i && performance.now() - arm.t < 4000) { arm.i = -1; return buy(i); }
    arm = { i, t:performance.now() };
    log(`${T.no} ${T.name} dolapta yok. Satın alıp takmak için tekrar tıklayın: ${tl(p)}.`, 'warn');
    return false;
  }
  function lost(i) {
    if (on && isTaster(TOOLS[i])) {                               // taster: kırılan stylus, gövde sağlam
      const c = TOOLS[i].type === 'dial' ? 180 : 250; harca(c); save(); cash(-c);
      log(`Yedek stylus takıldı: −${tl(c)}. Taster sağlam.`, 'warn'); render(); return;
    }
    if (!on || !st.owned[TOOLS[i].no]) return;
    st.kirik[TOOLS[i].no] = 1; st.bugun.olay.push(`${TOOLS[i].no} kırıldı`); save();
    log(`${TOOLS[i].no} kırıldı, dolapta duruyor. ${TOOLS[i].type === 'face' ? 'Uç değişimi' : 'Biletme'} ${tl(bileme(TOOLS[i]))} (yenisi ${tl(priceOf(TOOLS[i]))}): takım kartına iki kez tıklayın.`, 'warn');
    render();
  }
  function charge(v, what) {
    if (!on) return true;
    if (!yeter(v)) { log(`${what} için kredi limiti yetmiyor (${tl(v)}).`, 'warn'); return false; }
    harca(v); save(); cash(-v); log(`${what}: −${tl(v)}.`); render(); return true;
  }
  function forget(no) { if (st.owned[no]) { delete st.owned[no]; save(); } }
  function setMode(c) {
    if (c === on) return;
    if (S.job && !S.job.done) log('Süren iş bırakıldı.', 'warn');
    on = c; S.job = null; sel = null; save();
    selectJob(-1);
    if (on) { fillBoard(); save(); PM.preset('kariyer'); log(`Kariyer modu: kasada ${tl(st.money)}, itibar ${st.rep}. Siparişler bilgisayara mail olarak gelir (üst çubuktaki saat).`, 'ok'); }
    else log('Serbest atölye: her şey açık ve ücretsiz.', 'ok');
    dukkanUygula(); render();
  }
  function openShop() { initAudio(); renderShop(); $('shop').hidden = false; }
  $('crShop').addEventListener('click', openShop); $('tbMoney').addEventListener('click', openShop);
  $('shClose').addEventListener('click', () => { $('shop').hidden = true; });
  window.addEventListener('keydown', e => { if (!$('shop').hidden && e.code === 'Escape') { e.stopImmediatePropagation(); $('shop').hidden = true; } }, true);
  load();
  setRackTag(i => on ? { own:owns(i), price:st.kirik[TOOLS[i].no] && st.owned[TOOLS[i].no] ? tl(bileme(TOOLS[i])) : tl(priceOf(TOOLS[i])), kirik:!!(st.kirik[TOOLS[i].no] && st.owned[TOOLS[i].no]) } : null);
  $('modeSw').addEventListener('click', e => { const b = e.target.closest('[data-mode]'); if (b) setMode(b.dataset.mode === 'career'); });
  $('crPc').addEventListener('click', () => app.PC && app.PC.ac('posta'));
  let resetArm = 0;
  $('crReset').addEventListener('click', () => {
    if (performance.now() - resetArm > 3000) { resetArm = performance.now(); $('crReset').textContent = 'Emin misiniz? Tekrar tıklayın'; setTimeout(() => $('crReset').textContent = 'Kariyeri sıfırla', 3000); return; }
    st = fresh(); S.job = null; sel = null; fillBoard(); save(); selectJob(-1); render(); log('Kariyer sıfırlandı: 1.500 ₺ ve üç takımla yeniden başlıyorsunuz.', 'ok');
  });
  if (on) fillBoard();
  return { get on() { return on; }, hasEq, openShop, render, start, settle, allowTool, lost, charge, forget, priceOf, get sel() { return sel; },
    // bilgisayar (24-bilgisayar) için
    get st() { return st; }, saat:() => ({ gun:st.gun, gunAd:GUNLER[(st.gun - 1) % 7], dk:st.dk, txt:saatTxt(Math.min(st.dk, MESAI + 359)), mesai:MESAI }),
    siparis:id => st.orders.find(o => o.id === id), mailOku:id => { const m = st.mail.find(q => q.id === id); if (m && !m.okundu) { m.okundu = true; save(); } return m; },
    okunmamis:() => st.mail.filter(m => !m.okundu).length, kabul:id => kabul(st.orders.find(o => o.id === id)), reddet:id => reddet(st.orders.find(o => o.id === id)), birak:id => birak(st.orders.find(o => o.id === id)),
    teklif:(id, f) => teklifVer(st.orders.find(o => o.id === id), f), karsiKabul:id => { const o = st.orders.find(q => q.id === id); teklifKabul(o, o.karsi, o.hizliT); save(); log(`Anlaştınız: ${tl(o.karsi)}.`, 'ok'); },
    onizle:id => select(st.orders.find(o => o.id === id)),
    resim:id => { const o = st.orders.find(q => q.id === id); if (!o) return null;                 // mailde teknik resim (hazır parçada parça modeli gerekir)
      if (o.J.blank && !o.J._P) Object.defineProperty(o.J, '_P', { value:genBlank(o.J.blank.id, o.J.blank.seed), enumerable:false, writable:true, configurable:true });
      return { svg:drawingSVG(o.J), tablo:drawingTable(o.J) }; }, TEKLIF, bekler, payTxt, tl, anTxt, kira, kredi, level:() => LEVELS[level()][1], KREDI_SURE,
    ilerle, kontrol, gunuBitir, ertesiGun, get raporBekliyor() { return raporBekliyor; },
    // dükkânı büyütme (24-bilgisayar Dükkân sekmesi, 19-atolye görünüm)
    yukVar, dukkanAl, tasin, dukkanUygula, ekipmanAl:id => { buyEq(id); return !!st.eq[id]; }, EQUIP, dukkan:() => ({ sv:st.dukkan.sv, yuk:{ ...st.dukkan.yuk }, DUKKAN, YUK, kira:kira(), rep:st.rep, money:st.money }) };
})();

Object.assign(app, { CR });   // önceki modüllerin geç başvuruları

export { CR };
