// ── Ayarlar (tercihler): grafik, ses ve oyun ayarları tek yerde; kayıt katmanında saklanır, değişince dinleyenlere haber verilir.
//   AYAR.ad               güncel değer (okumak için)
//   ayarYaz(ad, deger)    değiştirir, kaydeder, dinleyenleri çağırır; 'kalite' bir hazır ayarsa grafik ayarlarını topluca kurar
//   ayarDinle(adlar, fn)  ad ya da ad dizisi değişince fn(AYAR) çağrılır; kayıt anında bir kez de hemen çağrılır
//   ayarSifirla()         varsayılanlara döner
// Yeni ayar: VARSAYILAN'a ekle, kullanan modülde ayarDinle ile uygula, menüde (20-menu.js) bir denetim ekle.
import { kayit } from './00-kayit.js';
import { setDil, varsayilanDil } from './00-dil.js';
import { TEST } from './00-temel.js';

const KEY = 'freze-ayarlar';
// grafik hazır ayarları: gölge 0 kapalı / 1 normal (1024) / 2 yüksek (2048); çözünürlük ekran piksel oranının katı; talaş üretim oranı;
// esya: atölyedeki ağır hazır modeller (kompresör, arabalar, kutular; düşükte gizli)
const KALITE = {
  dusuk:  { golge:0, cozunurluk:0.6, talas:0.4, esya:false },
  orta:   { golge:1, cozunurluk:0.85, talas:0.7, esya:true },
  yuksek: { golge:2, cozunurluk:1, talas:1, esya:true },
};
const GRAFIK = Object.keys(KALITE.yuksek);
const VARSAYILAN = Object.assign({ kalite:'yuksek' }, KALITE.yuksek, {
  sesAna:0.9, sesMakine:1, sesArayuz:0.8,      // 0..1
  acilisMenu:true,                               // açılışta ana menü
  kaliteOto:true,                                // kasarsa kaliteyi kendisi düşürür (oyuncu kaliteyi elle seçince kapanır; 12-dongu)
  gelistirici:false,                             // geliştirici paneli (Ctrl+Shift+D)
  dil:varsayilanDil(),                           // tr / en / de (00-dil); ilk açılışta tarayıcının dili
});

const AYAR = Object.assign({}, VARSAYILAN);
{ // kayıtlı değerler: yalnızca bilinen adlar ve aynı türdekiler alınır
  const k = kayit.oku(KEY, {});
  for (const a in VARSAYILAN) if (k[a] !== undefined && typeof k[a] === typeof VARSAYILAN[a]) AYAR[a] = k[a];
}
if (TEST) Object.assign(AYAR, KALITE.dusuk, { kaliteOto:false, acilisMenu:false, cozunurluk:0.5, dil:'tr' });   // test: en hafif, Türkçe (kaydedilmez)
const dinleyen = new Map();
function haber(adlar) {
  const fns = new Set();
  for (const a of adlar) for (const fn of dinleyen.get(a) || []) fns.add(fn);
  for (const fn of fns) { try { fn(AYAR); } catch (e) { console.error(e); } }
}
function ayarDinle(adlar, fn) {
  for (const a of [].concat(adlar)) { if (!dinleyen.has(a)) dinleyen.set(a, []); dinleyen.get(a).push(fn); }
  fn(AYAR);
}
function ayarYaz(ad, deger) {
  if (!(ad in VARSAYILAN) || AYAR[ad] === deger) return;
  const deg = [ad];
  AYAR[ad] = deger;
  if (ad === 'kalite' && KALITE[deger]) { Object.assign(AYAR, KALITE[deger]); deg.push(...GRAFIK); }
  else if (GRAFIK.includes(ad)) { AYAR.kalite = 'ozel'; deg.push('kalite'); }   // tek tek değişen grafik ayarı: özel
  kayit.yaz(KEY, AYAR);
  haber(deg);
}
function ayarSifirla() {
  Object.assign(AYAR, VARSAYILAN); kayit.yaz(KEY, AYAR);
  haber(Object.keys(VARSAYILAN));
}

ayarDinle('dil', a => setDil(a.dil));                  // dil: sayfa ve kayıtlı modüller o dilde yeniden yazılır

export { AYAR, KALITE, ayarDinle, ayarSifirla, ayarYaz };
