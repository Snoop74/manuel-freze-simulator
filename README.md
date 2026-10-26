# Manuel Freze Simülatörü

Tarayıcıda çalışan, 3B bir manuel freze tezgâhı simülasyonu ve oyunu. Tek bir HTML dosyası; kurulum gerektirmez.

## Çalıştırma

`freze.html` dosyasını bir tarayıcıda açın (internet bağlantısı gerekir: three.js ve yazı tipleri CDN'den yüklenir).

## Özellikler

- **Talaş kaldırma:** 150×100×40 mm alüminyum blok, mengene ve paralel altlıklar üzerinde. 0.5 mm çözünürlüklü yükseklik haritasıyla kesme.
- **Kumanda panelleri:** her bölüm ayrı bir pencere; başlığından sürüklenir, köşesinden büyütülür (içerik pencereyle birlikte büyür), küçültülür ya da kapatılır, düzen hatırlanır. Üst çubukta panel düğmeleri, hazır düzenler (Temel, Tam, İş emri), kamera ve ACİL STOP. Mil panelinde devir göstergesi, takım kartlarında simgeler; takım kırılınca alarmdan tek tuşla yeni takım takılır.
- **Makine üstünde kumanda:** tabla (X), kızak (Y) çarkları, kovan kolu ve ince ilerleme çarkı (Z) fareyle sürüklenerek ya da tekerlekle çevrilir; motor şalterine, START'a, acil stop mantarına ve soğutma vanasına tıklanır.
- **Eksen kontrolü:** klavye, ekrandaki kol düğmeleri ve sürüklenebilir el çarkları (×1 / ×10 / ×100). Dijital okuma (DRO) ile sıfırlama ve değer atama.
- **Takım dolabı:** alın frezesi, parmak frezeler, küresel freze, punta matkabı, matkaplar ve kenar bulucu. Takım boyları farklı; değişimden sonra Z yeniden sıfırlanır.
- **Kesme fiziği:** radyal talaş incelmesi ve kavrama alanıyla hesaplanan talaş kalınlığı ve takım yükü; aşırı yükte birikerek dolan zorlanma göstergesi; matkapta gagalama ve punta kontrolü; mengene/altlık/tutucu çarpışmaları.
- **Tezgâh ve atölye:** konsollu dik freze (Bridgeport tarzı): kolon, taret ve koç, kayış muhafazası ve motorlu kafa, kapstan kovan kolu, krom el çarkları, T kanallı tabla, otomatik ilerleme ünitesi, mengene. Döküm boya dokusu, mat renkler, ortam yansıması; atölyede güvenlik çizgileri, paspas, takım dolabı, tezgâh, çalışma lambası. Mil lambası, start düğmesi ve acil stop mantarı durumla oynar.
- **Ses:** kayıt dosyası yok, fizikten üretiliyor: devirle değişen motor uğultusu ve dişli vınlaması, kesmede ağız vuruşu (devir × ağız sayısı), kavrama sesleri, metal çınlamalı kırılma, atölye yankısı.
- **Soğutma sıvısı:** eklemli hortum, damlacık jeti, sıçrama ve buğu.
- **Partiküller:** kıvrık ve sarmal talaşlar, kırılma kıvılcımları, ısınma dumanı, kutlama efektleri.
- **İş emirleri:** teknik resim ve delik tablosu, parça üstünde markalama çizgileri, teslimde ölçüm (muayene) ve 1–3 yıldızla puanlama. Beş görevlik kampanya.

## Kısayollar

| Tuş | İşlev |
|---|---|
| ← → | X ekseni |
| ↑ ↓ | Y ekseni |
| PgUp / PgDn (W / S) | Z ekseni |
| Shift | Hızlı hareket |
| Boşluk | Mil start / stop |
| 1–4 | Kol adımı 0.01 / 0.1 / 1 / 10 mm |
| C | Soğutma sıvısı |
| Esc | Acil stop: mil ve tüm hareketler |
