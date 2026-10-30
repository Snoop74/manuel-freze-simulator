# Manuel Freze Simülatörü: geliştirme notları

## Yapı
- Kaynak `src/` altında. `freze.html` **üretilmiş dosyadır**, elle düzenlenmez; derleme her seferinde yeniden yazar. GitHub Pages bu dosyayı yayınlar, o yüzden derlenmiş hali de commit'lenir.
- İlk kurulum: `npm install` (esbuild, acorn, eslint-scope, three@0.128.0, @fontsource yazı tipleri; yalnızca geliştirme için).
- İnternetsiz: three.js npm'den paketlenir (`src/js/three-kur.js` global THREE'yi kurar, OrbitControls ve RoomEnvironment dahil); yazı tipleri (Chakra Petch, IBM Plex Sans, Share Tech Mono; latin + latin-ext) derlemede CSS'e gömülür. dev.html 'three'yi import haritasıyla node_modules'tan alır. Paket boşluk/sözdizimi sıkıştırmalı, adlar korunur.
- `npm run build`: önce `tools/analiz.mjs` denetler, sonra `build.mjs` esbuild ile paketleyip `freze.html` (tek dosya) ve `dev.html` üretir. `npm run watch` değiştikçe derler.
- `dev.html`: aynı sayfa, modüller paketlenmeden `src/js/main.js`'ten doğrudan yüklenir; tarayıcıda dosya dosya hata ayıklama için. Derlemeye gerek kalmadan kaynak düzenlenip sayfa yenilenebilir.
- `src/sayfa.html`: sayfa şablonu (paneller, düğmeler). `/*@CSS@*/` yerine `src/stil.css`, `//@JS@` yerine paket girer.
- `src/js/NN-ad.js`: gerçek ES modülleri (`import`/`export`). Her modülün ilk satırı ne içerdiğini söyler. `main.js` hepsini sırayla yükler.

## Modül kuralları (tools/analiz.mjs denetler)
- **Tek yön:** bir modül yalnızca kendinden ÖNCE gelen (numarası küçük) modülden import eder. Sonraki bir modüldeki adı `app.X` diye kullanır; X, kendi modülünün sonunda `Object.assign(app, { X })` ile kaydolur (`app` 00-temel'de). Yalnızca çalışma anında (fonksiyon içinden) kullanılabilir, modül yüklenirken değil.
- **Değişkenin sahibi yazar:** import edilen bir `let` başka modülde atanamaz (ES kuralı). Sahibi olan modül bir ayarlayıcı verir: `setMat`, `allocGrid`, `setFIX`, `markThrough`, `withSeed`, ... Nesne özelliklerini (S.x, PAR.w) değiştirmek serbesttir.
- **Tanımsız ad yok:** import edilmeyen ve tarayıcıda olmayan ad hata sayılır (eksik import). Yeni bir tarayıcı globali gerekirse analiz.mjs'deki GLOBALS listesine eklenir.
- Yeni modül: numaralı dosya ekle ve `main.js`'e sırasıyla yaz.

## Test
- `file://` çalışmaz; `python -m http.server <port>` ile aç (her oturumda farklı port). Hem `freze.html` hem `dev.html` denenmeli.
- Önizleme paneli arka plandayken requestAnimationFrame durur; testte kareleri elle sür.

## Yol haritası (yapılandırma)
1. ✅ Dosyalara bölme, birebir aynı çıktı (2026-10-30)
2. ✅ Gerçek ES modülleri, esbuild paketi, dev.html, modül denetleyici (2026-10-30)
3. TypeScript (önce JSDoc + `checkJs`, sonra dosya dosya `.ts`); modül adlarını numarasız klasörlere taşımak (fizik/, arayuz/, kariyer/...)
4. Torna ile ortak kod (`ortak/`: ses, paneller, kasa), atölye birleştirmesi
5. Steam/masaüstü hazırlığı: ✅ three.js ve yazı tipleri pakette, internetsiz (2026-10-30); kayıt katmanı (localStorage → dosya / Steam Cloud), ayarlar (çözünürlük, grafik kalitesi), Electron ya da Tauri kabuğu
