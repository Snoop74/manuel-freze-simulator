# Manuel Freze Simülatörü

Tarayıcıda çalışan, 3B bir manuel freze tezgâhı simülasyonu ve oyunu. Tek bir HTML dosyası; kurulum gerektirmez.

## Çalıştırma

`freze.html` dosyasını bir tarayıcıda açın (internet bağlantısı gerekir: three.js ve yazı tipleri CDN'den yüklenir).

## Özellikler

- **Talaş kaldırma:** 150×100×40 mm alüminyum blok, mengene ve paralel altlıklar üzerinde. 0.5 mm çözünürlüklü yükseklik haritasıyla kesme.
- **Kumanda paneli (konsol):** endüstriyel kumanda konsolu görünümünde tek panel. Yeşil DRO ekranı (X/Y/Z, devir, ilerleme, takım; ikinci sayfada yük, güç, sıcaklık, aşınma, Ra, talaş), yazılım tuşları (X0, Y0, Z0, 1/2 orta bulma, sayfa), DRO tuş takımı (eksen seç, değer yaz, ENT), ışıklı mil ve soğutma düğmeleri, yön anahtarı, devir ve ilerleme topuzları, eksen ve adım seçicili el çarkı (MPG), hareket tuşları, durum ışıkları ve acil stop mantarı. Üst çubuktaki "Kumanda" düzeni.
- **Kumanda panelleri:** her bölüm ayrı bir pencere; başlığından sürüklenir, köşesinden büyütülür (içerik pencereyle birlikte büyür), küçültülür ya da kapatılır, düzen hatırlanır. Üst çubukta panel düğmeleri, hazır düzenler (Temel, Tam, İş emri), kamera ve ACİL STOP. Mil panelinde devir göstergesi, takım kartlarında simgeler; takım kırılınca alarmdan tek tuşla yeni takım takılır.
- **Makine üstünde kumanda:** tabla (X), kızak (Y) çarkları, kovan kolu ve ince ilerleme çarkı (Z) fareyle sürüklenerek ya da tekerlekle çevrilir; motor şalterine, START'a, acil stop mantarına ve soğutma vanasına tıklanır.
- **Eksen kontrolü:** klavye, ekrandaki kol düğmeleri ve sürüklenebilir el çarkları (×1 / ×10 / ×100). Dijital okuma (DRO) ile sıfırlama ve değer atama.
- **Takım dolabı:** alın frezesi, parmak frezeler, küresel freze, punta matkabı, matkaplar ve kenar bulucu. Takım boyları farklı; değişimden sonra Z yeniden sıfırlanır.
- **Kesme fiziği:** radyal talaş incelmesi ve kavrama alanıyla hesaplanan talaş kalınlığı ve takım yükü; aşırı yükte birikerek dolan zorlanma göstergesi; matkapta gagalama ve punta kontrolü; mengene/altlık/tutucu çarpışmaları.
- **Tezgâh ve atölye:** konsollu dik freze (Bridgeport tarzı): kolon, taret ve koç, kayış muhafazası ve motorlu kafa, kapstan kovan kolu, krom el çarkları, T kanallı tabla, otomatik ilerleme ünitesi, mengene. Döküm boya dokusu, mat renkler, ortam yansıması; atölyede güvenlik çizgileri, paspas, takım dolabı, tezgâh, çalışma lambası. Mil lambası, start düğmesi ve acil stop mantarı durumla oynar.
- **Ses:** kayıt dosyası yok, fizikten üretiliyor: devirle değişen motor uğultusu ve dişli vınlaması, kesmede ağız vuruşu (devir × ağız sayısı), kavrama sesleri, metal çınlamalı kırılma, atölye yankısı.
- **Malzemeler:** Al 6061, S235, C45, 304 paslanmaz, pirinç, GG25 döküm, Delrin ve PA6 naylon. Önerilen hız ve ilerleme, kesme kuvveti, aşınma, talaş ve renk malzemeye göre değişir (Parça panelinden seçilir; iş emirleri kendi malzemesini kullanır).
- **Gerçekçi kesme davranışı:** Taylor modeline göre takım aşınması (Takımlar panelinden takım yenilenir), parçanın ısınması ve soğuması, 2.2 kW mil gücü (ağır pasoda devir düşer, mil boğulur), uzun ve ince takımda devre bağlı tırlama, plastikte erime.
- **İşleme izleri:** alın ve parmak frezenin tabanında devir başına ilerleme aralığıyla arka kenar yayları ("balık pulu"); Ra'ya göre belirginlik, tırlamada dalga, çelikte ısı rengi.
- **3B takımlar:** parametrelerden üretilen gerçek gövdeler: helisli kanallar ve ağızlar (parmak, küresel), konik uçlu matkap ve punta, dişli kılavuz, vidalı karbür uçlu alın frezesi; kaplama renkleri (AlTiN, TiN, karbür, HSS); ER pens tutucu ve matkap aynası.
- **Talaşlar:** yassı kesitli kıvrık şeritler (virgül biçiminde, bir ucu ince öbürü kalın, bir yüzü parlak); her biçimin rastgele çeşitleri var. Havada döner, seker, düştüğü yerde yatar ve yığılır; takım üstünden geçerse savrulur.
- **Talaş biçimi:** frezede kısa virgül; diş başına ilerleme çok düşükse ince uzun kıvrık (sürtme), çok yüksekse kalın sıcak kıvrık. Matkapta devir başına ilerlemeye göre uzun spiral ya da kırık talaş; dökümde toz, pirinçte pul, plastikte şerit. Durum panelinde canlı gösterilir.
- **Fareyle sürme (G):** parçanın üstünde sol tuşu basılı tutup sürükleyince takım farenin peşinden gider; kalemle yazar gibi gravür, cep ya da serbest şekil işlenir. Hız ilerleme ayarıyla sınırlı.
- **Otomatik tabla ilerlemesi:** X ekseninde sağa/sola, ayarlı ilerlemeyle; tabladaki kol ya da Hareket panelinden. Eksen sonunda durur.
- **Kılavuz (M6, M10):** mil İLERİ dönerken deliğe girer ve kovanı kendi adımıyla çeker; çıkarmak için mil GERİ (R) çalıştırılır. Deliksiz yüzey, küçük delik, kör delik dibi, yüksek devir, yanal hareket ve paslanmazda yağsız çekme kılavuzu kırar. Diş açılan yerler koyu görünür.
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
| R | Mil yönü İLERİ / GERİ |
| G | Fareyle sürme |
| Esc | Acil stop: mil ve tüm hareketler |
