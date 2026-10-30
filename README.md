# Manuel Freze Simülatörü

Tarayıcıda çalışan, 3B bir manuel freze tezgâhı simülasyonu ve oyunu. Oynamak için tek bir HTML dosyası yeterli; kurulum gerektirmez.

## Çalıştırma

`freze.html` dosyasını bir tarayıcıda açın (internet bağlantısı gerekir: three.js ve yazı tipleri CDN'den yüklenir).

## Geliştirme

Kaynak kod `src/` altında modüllere bölünmüştür (`src/js/00-temel.js` … `18-baslangic.js`, `src/stil.css`, `src/sayfa.html`). `freze.html` bunlardan üretilir:

```bash
node build.mjs           # bir kez derle
node build.mjs --watch   # src/ değiştikçe derle
```

Node dışında bağımlılık yok. Ayrıntılar `CLAUDE.md` içinde.

## Özellikler

- **Talaş kaldırma:** ölçüsü ayarlanabilen blok (X 20–220, Y 20–135, Z 10–80 mm; varsayılan 150×100×40), mengene ve paralel altlıklar üzerinde. Mengene çeneleri parçaya göre ayarlanır. 0.5 mm çözünürlüklü yükseklik haritasıyla kesme. İş emirleri standart 150×100×40 parçayla başlar.
- **Parça masası:** işlenen parça ayrı bir sahnede granit pleyt üstünde döndürülerek incelenir. Kumpas (iki nokta arası mesafe, ΔX ΔY ΔZ), yükseklik ölçer (tabandan yükseklik, üstten derinlik), delik/cep ölçümü (delik çapı ve merkezi, cep ölçüsü ve derinliği) ve X/Y kesit düzlemleri.
- **Kumanda paneli (konsol):** endüstriyel kumanda konsolu görünümünde tek panel (SNOOP3000). Yeşil DRO ekranı (X/Y/Z, devir, ilerleme, takım; ikinci sayfada yük, güç, sıcaklık, aşınma, Ra, talaş), yazılım tuşları (X0, Y0, Z0, 1/2 orta bulma, sayfa), DRO tuş takımı (eksen seç, değer yaz, ENT ile ata; birden fazla eksene değer yazıp GİT ile o noktaya git), ışıklı mil ve soğutma düğmeleri, yön anahtarı, devir ve ilerleme topuzları, eksen ve adım seçicili el çarkı (MPG), hareket tuşları, durum ışıkları ve acil stop mantarı. Üst çubuktaki "Kumanda" düzeni.
- **Kumanda panelleri:** her bölüm ayrı bir pencere; başlığından sürüklenir, köşesinden büyütülür (içerik pencereyle birlikte büyür), küçültülür ya da kapatılır, düzen hatırlanır. Üst çubukta panel düğmeleri, hazır düzenler (Temel, Tam, İş emri), kamera ve ACİL STOP. Mil panelinde devir göstergesi, takım kartlarında simgeler; takım kırılınca alarmdan tek tuşla yeni takım takılır.
- **Üst çubuk:** simgeli ve gruplu: Makine (kumanda paneli, DRO, el çarkları, hareket, iş mili), İş (takımlar, parça ve bağlama, iş emirleri, teknik resim), Aletler (hava tabancası, fareyle sür, parça masası, takım editörü, kariyerde dükkân), Bilgi (durum, olay kaydı); açık panelin simgesinin altında sarı çizgi, üstüne gelince adı ve kısayolu. Panel düzeni ve kamera açılır menüde; sağda kasa, ses, yardım (nasıl başlarım, kısayollar) ve ACİL STOP. Paneller sadeleşti: üst çubukta olan düğmeler panellerden kalktı; Parça paneli Ham parça / Bağlama / Bu parça bölümlerine ayrıldı, Takımlar panelinde dolap mevcut takımın hemen altında.
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
- **Takım editörü:** kendi takımını tasarla: parmak (köşe radyüslü), küresel, pah (60/90/120°) ya da matkap (118/135/140°); çap, ağız sayısı, ağız boyu, çıkıntı, helis açısı, HSS/karbür ve TiN/AlTiN/DLC kaplama. Döndürülebilir 3B önizleme, fiyat ve etkiler (önerilen devir/ilerleme, tırlama riski, takım ömrü, kırılma direnci, yüzey). Takımlar T13'ten itibaren dolaba eklenir ve tarayıcıda saklanır. Kesmede gerçekten etkili: radyüs ve pah parçaya şeklini verir, kaplama aşınmayı, HSS kırılma direncini, düşük helis tırlamayı değiştirir; çok ağızlı takım alüminyumda tam kanalda talaşla tıkanır.
- **Kariyer modu:** İş emirleri panelinde Serbest atölye / Kariyer anahtarı. Kariyerde 1.500 ₺ ve üç takımla (Ø10 parmak, punta, Ø8.5 matkap) başlarsınız. Sipariş panosundaki işler rastgele üretilir: müşteri, malzeme, ham parça ölçüsü, yüzey/cep/delik, ödeme ve hedef süre; teknik resim siparişin ölçüsüne göre çizilir. İşe başlayınca ham parça kasadan alınır (kg × malzeme fiyatı), teslimde parça ölçülür: tam kabulde yıldıza göre ödeme ve zamanında teslim primi, şartlı kabulde %40, hurdada ödeme yok. İtibar arttıkça atölye büyür (Mahalle atölyesi → Güvenilir atölye → Fabrika tedarikçisi → Hassas iş ustası); daha büyük parçalar, çelik ve paslanmaz, daha iyi ödeyen müşteriler gelir. Dükkândan takım alınır; dolapta olmayan takım kartına iki kez tıklayınca satın alınıp takılır, kırılan takım hurdaya gider, körelen takımı bilemek fiyatının %30'u. Kasada para kalmazsa malzemesini getiren müşteri çıkar, oyun kilitlenmez. Serbest atölyede her şey ücretsiz ve açık kalır. Ceplerin köşeleri radyüslüdür (resimde R5/R8; daha küçük takımla açılan keskin köşe fazla kesim sayılmaz). Cep genişliği ızgaradan bağımsız ölçülür: takım kenarının duvara ne kadar yaklaştığı kesim sırasında kaydedilir. Teslim penceresi sade: kazanç, itibar ve kasa büyük kartlarda, primler etiket (kusursuz, zamanında, temiz teslim, yeni seviye), tolerans dışı ölçüler tek cümlede; puan, çubuklar ve ölçü tablosu "Detayları gör"de. Kabul edilen parçada havai fişek patlar (yıldız sayısı gösteriyi büyütür).
- **Hazır parçalar (kariyer):** siparişlerin yarısında müşteri kendi parçasını getirir (ham parça parası yok, hurdaya çıkarsa parça bedeli atölyeden ve itibar −3): silindir kapağı traşlama (çarpık conta yüzü: tamamen düzle, düzlemsellik ≤0.05, en çok 0.5 mm al), döküm flanş (göbek ve alın seviyeleri, cıvata dairesi), kalıp plakası (kalıp boşluğu ve itici pim delikleri), kaynaklı plaka (T dikişi yüzeyle sıfırla, plakaya 0.2 mm'den fazla dalma), hidrolik blok (üstten 0.3 al, yeni portlar), tamir (kaymış delikleri doğru yerde Ø12'ye büyüt). Parçalar tohumla üretilir; yüzeyler döküm, taşlanmış, eski işleme, kaynak ve tufal olarak görünür; teknik resimde mevcut detaylar kesik çizgiyle. Sekiz parça tipi ve çeşitleri: silindir kapağı (2/3/4 silindir, 8/16 supap, bombe/çukur/burulma/uç kalkık çarpılma), egzoz flanşı (2–4 oval kanal, ısı çarpılması), döküm flanş (yuvarlak ya da kare), kalıp plakası (tek ya da çift göz), kaynaklı plaka (T, L, artı, çift, çerçeve dikiş), hidrolik blok (2–3 port), yatak gövdesi (iki ayak pedi aynı seviyeye), tamir (2–6 delik). Her işin birkaç müşterisi var. İş koşulları: ACİL (süre kısa, ×1.6, geç kalınca −%20), SERİ ×3 (her adet ayrı, son adette +%10), HASSAS (toleranslar yarıya, ×1.5). Mengene çeneleri hazır parçanın kenar yüksekliğine göre ayarlanır.
- **Hava tabancası (B):** açıkken parçanın ya da tablanın üstünde sol tuşu basılı tutunca tabanca imlecin olduğu yere üfler (tıslama sesi, hava buğusu); yatan talaş havalanıp savrulur, parça biraz soğur. Kariyerde dükkândan alınır (350 ₺); talaşsız teslim edilen parçaya %5 prim.
- **3B taster:** dolapta "3B" takımı (Ø4 yakut bilye, LED halkası). Mil dururken parçaya değince LED kırmızı yanar, bip çalar, temas noktası kaydedilir. Döngüler tasteri kendisi sürer, temas eder, geri çekilir ve sıfırı yazar: X±/Y± kenar, sol-ön köşe, delik merkezi (çapıyla), Z yüzey. Mil dönerken ya da hızlı harekette çarparsa stylus kırılır. Kariyerde 2.500 ₺.
- **Mekanik 3B taster:** dolapta "3M": kadranlı, elle kullanılır. Bilye kenara değince stylus itilir, ibre döner (1 tur = 1 mm, küçük kırmızı ibre turları sayar); ibre 0'da mil ekseni tam kenarın üstündedir, DRO'da X0/Y0 basılır. Z'de de ibre 0'da Z0 yüzeydir. Takımlar panelinde kadran ve okuma. 4.5 mm'den fazla itilirse stylus kırılma noktasından kopar (kariyerde yedek stylus 180 ₺).
- **Takım tutucular:** parmak, küresel ve pah frezeleri için ER pens (salgı 15 µm; ağır yükte takım pensten kayar, uç DRO'dan derine iner ve parça fazla kesilir), Weldon (8 µm, kaymaz), shrink-fit (3 µm, ince burun: derin ceplerde tutucu çarpmaz) ve hidrolik (3 µm, titreşimi söndürür). Salgı bir ağzın fazla kesmesi demek: küçük takımlarda yük, aşınma ve yüzey belirgin değişir. Seçim takım başına hatırlanır; kariyerde tutucular dükkândan alınır.
- **Bağlama:** Parça panelinde Mengene / Pabuç / Vakum. Pabuçta parça iki altlık üstünde tablaya bağlanır (X 260, Y 140 mm'ye kadar); dört pabuç ön-arka ya da sol-sağ kenarın 12 mm'sini kapatır, takım ya da tutucu çarparsa kırılır, altlıkların üstünde delik delinmez. Vakum tablada (kurban plakalı) parçanın her yeri açık; göstergede vakum, yanal tutma ve anlık kesme kuvveti görünür. Tutma alanla orantılı, açılan delikler hava kaçırır; kesme kuvveti tutmayı aşarsa parça kopup fırlar. Kariyerde büyük plaka siparişleri mengeneye sığmaz, pabuç ya da vakum tabla ister.
- **Paraleller:** mengene, pabuç ve döner tablada parçanın altındaki paralellerin kenardan uzaklığı (kaydırıcı) ve genişliği (10/6/3 mm) ayarlanır; istenirse parça kurban plakasına (MDF) oturtulur, matkap plakaya girebilir (kariyerde 40 ₺). İş ya da sipariş başlarken paralelin üstüne denk gelen delikler uyarılır; teknik resimde paraleller kesik çizgiyle görünür.
- **Döner tabla:** Bağlama: Döner. Parçanın ortası tabla merkezinde, iki ince paralel ve iki pabuçla bağlı; plaka 5°'lik derece çizgili, önde gösterge ve krank. C açısı panelde (adım düğmeleri ±¼/1/15/90°, açıya git, C0) ya da Q/E basılı tutarak; dönmek için kilit açılır. Takım parçadayken tablayı çevirmek yay kesmesidir (çevresel hız = ilerleme); kilit açıkken öteleme kesmesi yaparsanız tabla yük altında kayar; dönen pabuçlar da takıma çarpabilir. Yeni iş emri: cıvata dairesi (6×Ø8.5, R35) ve R20 yay kanal; muayene yay kanalın derinliğini, tabanını, genişliğini ve yarıçapını ölçer. Kariyerde yay kanallı ve cıvata daireli siparişler (döner tabla 8.000 ₺).
- **Divizör (deneme):** Bağlama: Divizör. Yuvarlak çubuk (X boy 20–150, Y çap 10–70) üç ayaklı aynada, ekseni X boyunca; A ekseni kilit açılıp Q/E ya da düğmelerle döner, kolu 40:1 oranla döner. Divizördeki parça 3B hacim (voksel, 0.5 mm) modeliyle tutulur: takım her açıdan keser, yüzey surface nets ile pürüzsüz çizilir, yalnızca kesilen bloklar yeniden kurulur. Altıgen, kare, düzlük ve kanallar işlenebilir; bölüntü diski, gezer punta ve trunnion plakası sonraki adımda.
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
