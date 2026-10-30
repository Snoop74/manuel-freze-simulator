# Manuel Freze Simülatörü: geliştirme notları

## Yapı
- Kaynak `src/` altında. `freze.html` **üretilmiş dosyadır**, elle düzenlenmez; `node build.mjs` her seferinde yeniden yazar. GitHub Pages bu dosyayı yayınlar, o yüzden derlenmiş hali de commit'lenir.
- `src/sayfa.html`: sayfa şablonu (paneller, düğmeler). `/*@CSS@*/` yerine `src/stil.css`, `//@JS@` yerine modüller girer.
- `src/js/NN-ad.js`: modüller, sıra numarasıyla birleştirilir ve tek bir `(() => { 'use strict'; ... })()` kapsamında çalışır. Üst düzey adlar (S, H, VX, CR, ...) bütün modüllerde ortak; `import`/`export` yok. Her modülün ilk satırı ne içerdiğini söyler.
- Sıra önemli: bir modül, kendisinden sonra gelen modülün `const`/`let` adını yalnızca fonksiyon içinden (çalışma anında) kullanabilir; üst düzeyde hemen kullanırsa TDZ hatası verir. `function` bildirimleri tüm kapsama yükselir.
- Derleyici bağımlılıksız (yalnızca Node). Sözdizimi hatasında `freze.html` yazılmaz, hatalı modül adı söylenir. `node build.mjs --watch` değişince yeniden derler.

## Test
- `file://` çalışmaz; `python -m http.server <port>` ile aç (her oturumda farklı port).
- Hızlı sözdizimi denetimi zaten derlemenin içinde.

## Yol haritası (yapılandırma)
1. ✅ Dosyalara bölme, birebir aynı çıktı (2026-10-30)
2. Gerçek modüller: ortak durumu (H, NX, S, ...) tek bir durum nesnesine toplayıp `import`/`export`
3. TypeScript (önce JSDoc + `checkJs`, sonra dosya dosya `.ts`), Vite
4. Steam/masaüstü hazırlığı: three.js'i yerel paketle (CDN yok), kayıt katmanı (localStorage → dosya / Steam Cloud), ayarlar (çözünürlük, grafik kalitesi), Electron ya da Tauri kabuğu
