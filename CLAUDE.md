# Manuel Freze Simülatörü: geliştirme notları

## Yapı
- Kaynak `src/` altında. `freze.html` **üretilmiş dosyadır**, elle düzenlenmez; derleme her seferinde yeniden yazar. GitHub Pages bu dosyayı yayınlar, o yüzden derlenmiş hali de commit'lenir.
- İlk kurulum: `npm install` (esbuild, acorn, eslint-scope, three@0.128.0, @fontsource yazı tipleri; yalnızca geliştirme için).
- İnternetsiz: three.js npm'den paketlenir (`src/js/three-kur.js` global THREE'yi kurar, OrbitControls ve RoomEnvironment dahil); yazı tipleri (Chakra Petch, IBM Plex Sans, Share Tech Mono; latin + latin-ext) derlemede CSS'e gömülür. dev.html 'three'yi import haritasıyla node_modules'tan alır. Paket boşluk/sözdizimi sıkıştırmalı, adlar korunur.
- `npm run build`: önce `tools/analiz.mjs` denetler, sonra `build.mjs` esbuild ile paketleyip `freze.html` (tek dosya) ve `dev.html` üretir. `npm run watch` değiştikçe derler.
- `dev.html`: aynı sayfa, modüller paketlenmeden `src/js/main.js`'ten doğrudan yüklenir; tarayıcıda dosya dosya hata ayıklama için. Derlemeye gerek kalmadan kaynak düzenlenip sayfa yenilenebilir.
- `assets/`: oyunla birlikte dağıtılan dosyalar (paketlenmez, sayfa çalışırken yükler): `hdri/` ortam yansıması, `doku/` dokular. Kaynak ve lisanslar `assets/LISANS.md` (yalnızca CC0 ya da açıkça izinli dosyalar). Dosya yüklenemezse (örn. freze.html tek başına file:// ile açılırsa) oyun dokusuz çalışır.
- Dokular `02-sahne-tezgah.js` içinde `addSurface(malzeme, 'set_adı', {...})` ile üç düzlemli (triplanar) kaplanır; tezgâhın UV'si yok. `alb` 0 ise dokunun yalnızca açık-koyu detayı alınır, renk malzemeden gelir.
- `src/sayfa.html`: sayfa şablonu (paneller, düğmeler). `/*@CSS@*/` yerine `src/stil.css`, `//@JS@` yerine paket girer.
- **Geliştirici modu** (`22-gelistirici.js`): Ayarlar → Oyun → Geliştirici modu ya da Ctrl+Shift+D. Sahneyi .glb aktarır (mm → metre), hazır modellerin yerleşimini JSON indirir/yükler (adlar `kimlik#sıra`, 19-atolye PROPS), kamera konumu, imlecin altındaki nesne. Blender'dan yerleşim: `tools/blender-yerlesim.py`.
- `src/js/NN-ad.js`: gerçek ES modülleri (`import`/`export`). Her modülün ilk satırı ne içerdiğini söyler. `main.js` hepsini sırayla yükler.

## Modül kuralları (tools/analiz.mjs denetler)
- **Tek yön:** bir modül yalnızca kendinden ÖNCE gelen (numarası küçük) modülden import eder. Sonraki bir modüldeki adı `app.X` diye kullanır; X, kendi modülünün sonunda `Object.assign(app, { X })` ile kaydolur (`app` 00-temel'de). Yalnızca çalışma anında (fonksiyon içinden) kullanılabilir, modül yüklenirken değil.
- **Değişkenin sahibi yazar:** import edilen bir `let` başka modülde atanamaz (ES kuralı). Sahibi olan modül bir ayarlayıcı verir: `setMat`, `allocGrid`, `setFIX`, `markThrough`, `withSeed`, ... Nesne özelliklerini (S.x, PAR.w) değiştirmek serbesttir.
- **Tanımsız ad yok:** import edilmeyen ve tarayıcıda olmayan ad hata sayılır (eksik import). Yeni bir tarayıcı globali gerekirse analiz.mjs'deki GLOBALS listesine eklenir.
- Yeni modül: numaralı dosya ekle ve `main.js`'e sırasıyla yaz.
- **Ayarlar `00-tercihler.js` ile:** `AYAR.ad` okunur, `ayarYaz(ad, deger)` değiştirir ve kaydeder (freze-ayarlar), `ayarDinle(adlar, fn)` değişince (ve hemen bir kez) çağırır. Grafik hazır ayarları `KALITE` (dusuk/orta/yuksek); tek tek değişen grafik ayarı kaliteyi 'ozel' yapar. Yeni ayar: VARSAYILAN'a ekle, kullanan modülde ayarDinle ile uygula, menüye denetim ekle.
- **Menü `20-menu.js`:** `MENU.ekran(id, (kart, M) => {...})` ekran tanımlar (M.baslik, M.dugme, M.sekmeler, M.secim, M.kaydir, M.onay, M.alt), `MENU.ac/geri/kapat/yenile`. Menü açıkken `S.duraklat` (frame yalnızca çizer, ses askıda) ve klavye tezgâha gitmez; Esc geri. Menü kapalıyken Esc ACİL STOP'tur, değiştirilmez.
- **Dil `00-dil.js` ile** (Türkçe, İngilizce, Almanca; 2026-11-06): oyuncuya görünen metin koda gömülmez, `t('anahtar', { değişken })` ile alınır; sözlükler `00-dil-tr.js` (kaynak), `00-dil-en.js`, `00-dil-de.js`. Değer metin (`'{n} delik'`) ya da dilbilgisi için fonksiyon olabilir. Sayfa şablonunda `data-t="anahtar"` (öznitelik: `data-t-tip`, `data-t-title`, `data-t-aria`, `data-t-ph`); dil değişince `sayfa()` hepsini yeniden yazar, JS'in çizdiği yerler `dilDinle(fn)` ile tazelenir. Para `para(v)` (dolar; rakamlar aynı, biçim dile göre). Dil ayarı `AYAR.dil`. Denetleyici: her anahtar üç dilde var mı, kullanılan her anahtar sözlükte mi. Henüz taşınmamış metinler Türkçe görünür; yeni metin eklerken üç dile birden yazılır.
- **Kalıcı veri yalnızca `kayit` ile** (`00-kayit.js`): `kayit.oku(ad, varsayilan)`, `kayit.yaz(ad, deger)`, `kayit.sil(ad)`, `kayit.hepsi()`/`kayit.yukle(o)`. Arka uç tarayıcıda localStorage; masaüstü kabuğu `window.frezeMasaustu.kayit` (get/set/remove/keys, eşzamanlı) verirse dosya. Anahtarlar `freze-` ile başlar ve eski kayıtlar kaybolmasın diye adları değiştirilmez (freze-career-v1, freze-mode, freze-tools-v1, freze-holders, freze-progress, panel düzeni). Varsayılan nesne/dizi ise bozuk ya da yanlış türde kayıt varsayılana düşer. Başka yerde localStorage kullanmak denetleyicide hatadır.

## Test
- **Duman testi:** `npm test` derler ve `tools/duman.mjs`'i çalıştırır: kendi sunucusunu açar, Edge/Chrome'u başsız sürer (ek paket yok), freze.html'in hatasız açıldığına bakar, dev.html'de senaryoları kodla sürer (yükleme, mengene, yüzey alma, gagalama, kılavuz, eğitim, G-kod, motor, gerçek parça işleri, ölçüm masası, dil, dükkân, kariyer günü). Tek senaryo: `node tools/duman.mjs kilavuz`. Commit'ten önce çalıştır; yeni özelliğe senaryo ekle (SENARYO nesnesi).
- `file://` çalışmaz; `python -m http.server <port>` ile aç (her oturumda farklı port). Hem `freze.html` hem `dev.html` denenmeli.
- Önizleme paneli arka plandayken requestAnimationFrame durur; testte kareleri elle sür.

## Yol haritası (yapılandırma)
1. ✅ Dosyalara bölme, birebir aynı çıktı (2026-10-30)
2. ✅ Gerçek ES modülleri, esbuild paketi, dev.html, modül denetleyici (2026-10-30)
3. TypeScript (önce JSDoc + `checkJs`, sonra dosya dosya `.ts`); modül adlarını numarasız klasörlere taşımak (fizik/, arayuz/, kariyer/...)
4. Torna ile ortak kod (`ortak/`: ses, paneller, kasa), atölye birleştirmesi
5. Steam/masaüstü hazırlığı: ✅ three.js ve yazı tipleri pakette, internetsiz (2026-10-30); ✅ kayıt katmanı (2026-10-30) (localStorage → dosya / Steam Cloud); ✅ ayarlar ve menü altyapısı (2026-10-31); Electron ya da Tauri kabuğu
