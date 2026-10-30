// ── Kayıt katmanı: oyunun kalıcı verileri (kariyer, takımlar, tutucular, panel düzeni, iş ilerlemesi) yalnızca buradan okunur ve yazılır.
// Arka uç tarayıcıda localStorage; masaüstü kabuğu (Electron) window.frezeMasaustu.kayit verirse dosyalar (Steam Auto-Cloud o klasörü yedekler).
// Değerler JSON saklanır; eski sürümün düz metin kayıtları (örn. 'career') da okunur. Anahtar adları eski kayıtlar kaybolmasın diye aynen korunur.
//   kayit.oku(ad, varsayilan)   kayıt yoksa ya da bozuksa varsayilan döner (hata fırlatmaz)
//   kayit.yaz(ad, deger)        başarısız olursa false döner (dolu disk, gizli pencere...)
//   kayit.sil(ad)
//   kayit.hepsi() / kayit.yukle(o)   tüm freze kayıtlarını dışa ve içe aktarma (yedek, taşıma)

const ONEK = 'freze-';

const tarayici = {
  ad: 'tarayıcı',
  get: k => localStorage.getItem(k),
  set: (k, v) => localStorage.setItem(k, v),
  remove: k => localStorage.removeItem(k),
  keys: () => Object.keys(localStorage),
};
// masaüstü kabuğu aynı dört işlevi eşzamanlı verir (preload betiği, dosya başına bir anahtar)
const arka = (typeof window !== 'undefined' && window.frezeMasaustu && window.frezeMasaustu.kayit) || tarayici;

// varsayılan bir nesne ya da diziyse dönen değer de aynı türde olur (bozuk ya da başka türde kayıt varsayılana düşer)
const ayniTur = (v, ornek) => ornek == null || (Array.isArray(ornek) ? Array.isArray(v)
  : typeof ornek === 'object' ? v !== null && typeof v === 'object' && !Array.isArray(v) : typeof v === typeof ornek);
function oku(ad, varsayilan = null) {
  let ham;
  try { ham = arka.get(ad); } catch (e) { return varsayilan; }
  if (ham == null) return varsayilan;
  let v;
  try { v = JSON.parse(ham); } catch (e) { v = ham; }   // eski sürümün düz metin kaydı (örn. freze-mode)
  return ayniTur(v, varsayilan) ? v : varsayilan;
}
function yaz(ad, deger) {
  try { arka.set(ad, JSON.stringify(deger)); return true; } catch (e) { return false; }
}
function sil(ad) {
  try { arka.remove(ad); } catch (e) {}
}
function hepsi() {
  const o = {};
  try { for (const k of arka.keys()) if (k.startsWith(ONEK)) o[k] = oku(k); } catch (e) {}
  return o;
}
function yukle(o) {
  for (const k in o) if (k.startsWith(ONEK)) yaz(k, o[k]);
}

const kayit = { oku, yaz, sil, hepsi, yukle, get arkaUc() { return arka.ad || 'masaüstü'; } };

export { kayit };
