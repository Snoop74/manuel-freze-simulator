// Ekonomi simülatörü: oyunun GERÇEK kariyer kodunu (siparişler, teklif, kira, kredi, faiz, dükkân, çırak) başsız tarayıcıda
// çalıştırır; yalnızca tezgâhta parçayı işleme adımı bir "oyuncu becerisi" varsayımıyla özetlenir (süre, yıldız, takım kırma).
// Bir strateji dosyası (sayfada çalışan async fonksiyon gövdesi) kariyeri gün gün oynar; sonunda gün gün özet basılır.
//
// Kullanım:  node tools/ekonomi.mjs <strateji.js> [gun=30] [beceri=acemi|orta|usta] [json=cikti.json]
// Strateji dosyası: `eko` nesnesiyle çalışan bir async fonksiyon GÖVDESİ (return ile ne döndürürse rapora girer). Örnek:
//   while (eko.gun() <= eko.hedefGun) {
//     for (const s of eko.siparisler()) { if (s.teklifBekliyor) eko.teklif(s.id, 1.0); else if (eko.yapabilir(s.id)) { eko.kabul(s.id); eko.isYap(s.id); } }
//     eko.gunuBitir();
//   }
// eko API (hepsi eşzamanlı):
//   gun(), durum()                    gün, saat (dk, 0 = 08:00, 600 = 18:00), kasa, itibar, seviye, dükkân, kira, kredi limiti...
//   siparisler()                      bekleyen ve aktif siparişler (ödeme, ham parça, hedef süre, koşul, gereken ekipman...)
//   teklif(id, carpan)                fiyat isteyen müşteriye piyasa tahmini × carpan teklif (0.85 ucuz … 1.5 fahiş); sonucu döner
//   karsiKabul(id), reddet(id)        karşı teklifi kabul et / siparişi reddet
//   yapabilir(id)                     ekipman var mı, kasa ham parçaya yetiyor mu ({ok, neden})
//   kabul(id)                         işi kabul et (termin başlar; aynı anda tek aktif iş)
//   isYap(id)                         tezgâhta işle: ham parça parası, mesai süresi, beceriye göre sonuç, ödeme (CR.settle)
//   bekle(dk)                         mesaide boş bekle (yeni mail gelebilir)
//   gunuBitir()                       günü bitir: kira, (varsa) çırak, rapor; ertesi güne geç
//   dukkan(), dukkanAl(id), tasin()   dükkân aşaması ve yükseltmeler (17-kariyer DUKKAN, YUK)
//   ekipmanAl(id), ekipman()          hava tabancası, pabuç, vakum, döner tabla... (EQUIP)
//   not(metin)                        strateji günlüğüne not
import { readFileSync, writeFileSync } from 'node:fs';
import { sunucu, tarayici } from './duman.mjs';

const arg = Object.fromEntries(process.argv.slice(3).map(a => a.split('=')));
const dosya = process.argv[2];
if (!dosya) { console.log('Kullanım: node tools/ekonomi.mjs <strateji.js> [gun=30] [beceri=orta] [json=cikti.json]'); process.exit(1); }
const GUN = +(arg.gun || 30), BECERI = arg.beceri || 'orta';

// sayfada kurulur: eko API'si
const KUR = (hedefGun, beceri) => {
  const T = window.__T, { S, app } = T, CR = app.CR;
  // beceri: süre katsayısı (hedef süreye göre), kabul edilen parça olasılığı, yıldız dağılımı, iş başına takım kırma olasılığı
  const BEC = {
    acemi:{ sure:[1.6, 2.4], ok:0.62, yildiz:[0.35, 0.45, 0.20], kirma:0.22 },
    orta: { sure:[1.1, 1.6], ok:0.82, yildiz:[0.15, 0.50, 0.35], kirma:0.10 },
    usta: { sure:[0.8, 1.15], ok:0.95, yildiz:[0.05, 0.35, 0.60], kirma:0.03 },
  }[beceri];
  const rnd = (a, b) => a + Math.random() * (b - a);
  const gunluk = [], notlar = [], olay = [];
  const st = () => CR.st;
  const gerek = o => { const J = o.J, g = []; if (J.arcs && J.arcs.length) g.push('rot'); if (J.big) g.push('clamp|vac'); if (J.round) g.push('div'); return g; };
  const ekipVar = g => g.split('|').some(e => CR.hasEq(e));
  const ozet = o => ({ id:o.id, musteri:o.cust, tur:o.kind, is:o.J.title, malzeme:o.mat, olcu:`${o.J.w}×${o.J.d}×${o.J.h}`, odeme:o.pay, hamParca:o.cost,
    musteriParcasi:!!o.own, parcaBedeli:o.value || 0, hedefMesaiDk:Math.round(o.J.target), kosul:o.cond || null, adet:o.qty || 1, yapilan:o.doneQty || 0,
    teklifBekliyor:CR.bekler(o), piyasaTahmini:o.est || null, karsiTeklif:o.teklif === 'karsi' ? o.karsi : null, kabul:!!o.kabul, seviye:o.lv,
    gerekenEkipman:gerek(o), delik:(o.J.holes || []).length, cep:(o.J.pockets || []).length, yay:(o.J.arcs || []).length, yuzey:!!o.J.face });
  const kapatRapor = () => { if (CR.raporBekliyor) { const r = document.getElementById('pcRapor'); if (r) r.hidden = true; S.duraklat = false; kaydet(); CR.ertesiGun(); } };   // iş 18:00'i geçince gün kendiliğinden biter
  const kaydet = () => { const s = st(), D = CR.dukkan(); gunluk.push({ gun:s.gun, kasa:s.money, itibar:s.rep, seviye:CR.level(), dukkan:D.DUKKAN[D.sv].ad, yukseltme:Object.keys(D.yuk).length, teslim:s.done, kazanc:s.earned }); };
  const eko = {
    hedefGun, beceri,
    gun:() => st().gun,
    durum:() => { const s = st(), D = CR.dukkan(); return { gun:s.gun, dk:s.dk, kasa:s.money, itibar:s.rep, seviye:CR.level(), kredi:CR.kredi(), eksiTeslim:s.eksi, kira:CR.kira(),
      dukkan:D.DUKKAN[D.sv].ad, dukkanSv:D.sv, yukseltmeler:Object.keys(D.yuk), ekipman:Object.keys(s.eq), teslim:s.done, toplamKazanc:s.earned, kirikTakim:Object.keys(s.kirik).length }; },
    siparisler:() => st().orders.map(ozet),
    teklif:(id, c) => { const o = CR.siparis(id); if (!o || !CR.bekler(o)) return 'teklif yok'; CR.teklif(id, Math.round(o.est * c / 10) * 10); const q = CR.siparis(id); return q ? (q.teklif || 'kabul') : 'müşteri vazgeçti'; },
    karsiKabul:id => { CR.karsiKabul(id); return 'kabul'; },
    reddet:id => { CR.reddet(id); return 'reddedildi'; },
    yapabilir:id => { const o = CR.siparis(id); if (!o) return { ok:false, neden:'sipariş yok' };
      const eks = gerek(o).filter(g => !ekipVar(g)); if (eks.length) return { ok:false, neden:'ekipman yok: ' + eks.join(', ') };
      if (CR.bekler(o)) return { ok:false, neden:'önce teklif' };
      if (!o.free && st().money - o.cost < -CR.kredi()) return { ok:false, neden:'kasa/kredi ham parçaya yetmiyor' };
      return { ok:true }; },
    kabul:id => { const o = CR.siparis(id); if (!o) return false; if (o.kabul) return true; return !!CR.kabul(id); },
    isYap:id => {
      const o = CR.siparis(id); if (!o) return { hata:'sipariş yok' };
      const y = eko.yapabilir(id); if (!y.ok) return { hata:y.neden };
      if (!o.kabul && !CR.kabul(id)) return { hata:'kabul edilemedi (başka aktif iş?)' };
      if (o.cost && !CR.charge(o.cost, 'ham parça')) return { hata:'ham parça alınamadı' };
      const sure = o.J.target * rnd(...BEC.sure), dk = Math.round(sure + rnd(10, 25));   // tezgâh süresi (oyunda 1 s tezgâh = 1 dk mesai) + bağlama/sıfır
      CR.ilerle(dk); if (CR.raporBekliyor) kapatRapor();
      let tak = 0; if (Math.random() < BEC.kirma) { tak = 150 + Math.round(Math.random() * 250); CR.charge(tak, 'kırık takım bileme'); }
      const zor = o.cond === 'hassas' ? 0.15 : 0, ok = Math.random() < BEC.ok - zor;
      const u = Math.random(), stars = ok ? (u < BEC.yildiz[0] ? 1 : u < BEC.yildiz[0] + BEC.yildiz[1] ? 2 : 3) : (Math.random() < 0.5 ? 1 : 0);
      const run = { order:o, J:o.J, time:sure, done:false, stats:{ breaks:tak ? 1 : 0, load:0, spot:0, peck:0, rub:0 } };
      const r = CR.settle(run, { allOk:ok, stars, total:0 });
      const sonuc = { id, is:o.J.title, sureDk:dk, kabulEdildi:ok, yildiz:stars, odeme:r.pay, takimGideri:tak, hamParca:o.cost, kasa:st().money, itibar:st().rep };
      olay.push(sonuc); return sonuc;
    },
    bekle:dk => { CR.ilerle(dk); if (CR.raporBekliyor) kapatRapor(); },
    gunuBitir:() => { S.spindle = false; if (!CR.raporBekliyor) CR.gunuBitir(); kapatRapor(); },
    dukkan:() => { const D = CR.dukkan(); return { asama:D.DUKKAN[D.sv].ad, sv:D.sv, sonraki:D.DUKKAN[D.sv + 1] || null, yukseltmeler:D.YUK.map(u => ({ ...u, alindi:!!D.yuk[u.id], kilitli:u.sv > D.sv })), kira:D.kira }; },
    dukkanAl:id => CR.dukkanAl(id), tasin:() => CR.tasin(),
    ekipman:() => CR.EQUIP.filter(e => e.ready).map(e => ({ id:e.id, ad:e.n, fiyat:e.p, var:CR.hasEq(e.id) })),
    ekipmanAl:id => CR.ekipmanAl(id),
    not:t => notlar.push(`gün ${st().gun}: ${t}`),
    _sonuc:() => ({ gunluk, notlar, isler:olay }),
  };
  return eko;
};

const srv = await sunucu(), url = `http://127.0.0.1:${srv.address().port}`;
const br = await tarayici();
const deger = async ifade => {
  const r = await br.gonder('Runtime.evaluate', { expression:ifade, awaitPromise:true, returnByValue:true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
  return r.result.value;
};
try {
  await br.gonder('Runtime.enable');
  await br.gonder('Page.navigate', { url:`${url}/dev.html` });
  for (let i = 0; i < 200; i++) { await new Promise(r => setTimeout(r, 100)); try { if (await deger(`!!document.querySelector('#log > *')`)) break; } catch {} }
  // temiz kariyer: kayıtsız başla, kariyere geç
  await deger(`(async () => { window.__T = await import('/src/js/00-temel.js'); const { kayit } = await import('/src/js/00-kayit.js'); kayit.sil('freze-career-v1');
    window.__T.app.MENU.kapat(); document.querySelector('#modeSw [data-mode="career"]').click(); return window.__T.app.CR.on; })()`);
  await deger(`location.reload(), 1`).catch(() => {});
  for (let i = 0; i < 200; i++) { await new Promise(r => setTimeout(r, 100)); try { if (await deger(`!!document.querySelector('#log > *')`)) break; } catch {} }
  await deger(`(async () => { window.__T = await import('/src/js/00-temel.js'); window.__T.app.MENU.kapat(); if (!window.__T.app.CR.on) document.querySelector('#modeSw [data-mode="career"]').click();
    window.eko = (${KUR})(${GUN}, ${JSON.stringify(BECERI)}); return true; })()`);
  const govde = readFileSync(dosya, 'utf8');
  const donus = await deger(`(async (eko) => { ${govde}\n })(window.eko).then(d => ({ d, s:window.eko._sonuc() }))`);
  const { gunluk, notlar, isler } = donus.s;
  console.log(`\nBeceri: ${BECERI} · ${gunluk.length} gün · ${isler.length} iş\n`);
  console.log('gün  kasa       itibar  seviye  dükkân  yükseltme  teslim');
  for (const g of gunluk) console.log(`${String(g.gun).padStart(3)}  ${String(Math.round(g.kasa)).padStart(9)}  ${String(g.itibar).padStart(6)}  ${String(g.seviye).padStart(6)}  ${g.dukkan.padEnd(7)} ${String(g.yukseltme).padStart(9)}  ${String(g.teslim).padStart(6)}`);
  const ok = isler.filter(i => i.kabulEdildi).length;
  console.log(`\nİşler: ${isler.length}, kabul ${ok}, ortalama ödeme ${Math.round(isler.reduce((s, i) => s + i.odeme, 0) / Math.max(1, isler.length))} ₺, ortalama süre ${Math.round(isler.reduce((s, i) => s + i.sureDk, 0) / Math.max(1, isler.length))} dk`);
  if (notlar.length) console.log('\nNotlar:\n' + notlar.join('\n'));
  if (donus.d !== undefined) console.log('\nStrateji dönüşü: ' + JSON.stringify(donus.d));
  if (arg.json) writeFileSync(arg.json, JSON.stringify({ beceri:BECERI, gun:GUN, ...donus.s, donus:donus.d }, null, 1));
} catch (e) { console.error('HATA:', e.message); process.exitCode = 1; }
finally { await br.kapat(); srv.close(); }
