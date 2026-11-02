// ── Eğitim (EG): Otto Usta ilk parçayı adım adım yaptırır. 7 bölüm, her adımda tek iş: kamera, mengene, takım, el çarkı,
//   kumandaya yazıp GİT, Z sıfırı, yüzey, punta, delik, M6 kılavuz, teslim; sonunda kariyere geçilir.
//   Her adım: ustanın sözü (tuşlar [X], fare {sol} {sag} {teker} simgeli), sarı ok (arayüz öğesi ya da 3B tezgâh parçası),
//   gerekirse kamera oraya gider; oyuncu işi yapınca adım kendiliğinden geçer, bilgi adımlarında "Anladım".
//   İlk oyun denemesi (arkadaş, 2026-11-02): "maymuna anlatır gibi" olsun, çarkı fare tekerleğiyle çevirmeyi öğret, oklar görsel olsun.
//   Ceza yok: serbest atölyede çalışır, kırılan takım bedava. Bitti bilgisi kayit'ta (freze-egitim). Metinler ileride çeviri için tek yerde.
import { kayit } from './00-kayit.js';
import { $, C, H, NX, PH, PW, S, TOOLS, app, log } from './00-temel.js';
import { beep, initAudio } from './01-ses.js';
import { camera, canvas, controls, spindleG, zFine } from './02-sahne-tezgah.js';
import { viseKol, wheels } from './03-tabla-parca.js';
import { setKay } from './05-baglama.js';
import { stopMotion } from './08-kesme.js';
import { droVals, resetPart, setAuto, setFeed, setRpm } from './09-kumanda.js';
import { buildScribe, drawingSVG, drawingTable, threadAt } from './10-is-emri-muayene.js';
import { PM } from './11-paneller.js';

const EG = (() => {
  const KEY = 'freze-egitim';
  const J = { title:'Eğitim: ilk parça', target:900,
    brief:'Otto Usta\'nın ilk işi: üst yüzeyden 1 mm alın, ortaya Ø5 boydan boya delik açıp M6 diş çekin.',
    face:{ depth:1, tol:0.2 }, holes:[{ x:75, y:50, d:5, tap:'M6', tapLen:8.5 }], pockets:[], arcs:[] };
  const ti = no => TOOLS.findIndex(t => t.no === no);
  const takili = no => S.tool === ti(no) && !S.changing && !S.broken;
  const d = () => droVals();
  const yakin = (a, b, t = 0.5) => Math.abs(a - b) < t;
  const tip = () => S.nose - TOOLS[S.tool].len;
  const ust = () => PH - 1;                                        // yüzey alındıktan sonraki üst
  const merkez = () => H[Math.round(50 / C) * NX + Math.round(75 / C)];   // deliğin yerindeki yüzey yüksekliği
  const kart = no => `#tcList .tc-card[data-i="${ti(no)}"]`;
  let ref = null, tus = [], ileri = false;                         // ref: adıma girerken alınan değer · tus: kumandada basılan tuşlar · ileri: "Anladım"
  const yazildi = s => tus.join('').includes(s);
  // takımı parçanın biraz üstüne hızlıca indir (takım değişince mil en tepeye çıkar; oyuncu 10 cm beklemesin)
  let yk = null;
  const yaklas = z => { yk = { z }; };

  /* Adımlar · b bölüm · s söz · h parlayan öğeler · o 3B hedef (ok onu gösterir) · bak kamerayı oraya götür · p açılacak panel ·
     kur adıma girince · ok geçiş denetimi · tamam "Anladım" ile geçer · git GİT ipucu için hedef */
  const B = ['Bakmak', 'Mengene', 'Takım ve mil', 'Tezgâhı sürmek', 'Sıfır noktası', 'Yüzey alma', 'Delik ve diş'];
  const ADIM = [
    { b:0, id:'merhaba', tamam:true, s:'Merhaba, ben Otto Usta! Dükkânı sana bırakıyorum ama önce birlikte bir parça yapalım. Her adımda tek bir şey söyleyeceğim; sarı ok neye tıklayacağını gösterir.' },
    { b:0, id:'don', s:'Önce bakmayı öğren. {sol} Farenin SOL tuşuna basılı tut ve fareyi sağa sola sürükle: tezgâhın etrafında dönersin.',
      kur:() => { ref = camera.position.clone().sub(controls.target).normalize(); }, ok:() => camera.position.clone().sub(controls.target).normalize().angleTo(ref) > 0.4 },
    { b:0, id:'yaklas', s:'Güzel. {teker} Şimdi farenin TEKERLEĞİNİ çevir: yaklaşırsın, uzaklaşırsın.',
      kur:() => { ref = camera.position.distanceTo(controls.target); }, ok:() => Math.abs(camera.position.distanceTo(controls.target) / ref - 1) > 0.2 },
    { b:0, id:'kaydir', s:'{sag} Son olarak farenin SAĞ tuşuna basılı tut ve sürükle: görüntü yana kayar.',
      kur:() => { ref = controls.target.clone(); }, ok:() => controls.target.distanceTo(ref) > 50 },
    { b:0, id:'acil', tamam:true, h:['#estopBtn'], s:'En önemlisi: bir şey ters giderse klavyede Esc\'ye bas ya da sağ üstteki kırmızı ACİL STOP\'a tıkla. Her şey anında durur.' },

    { b:1, id:'mengeneAc', o:() => viseKol.children[1], bak:() => viseKol.children[1], s:'Parça bu mengenede sıkılı duruyor. Sarı okun gösterdiği mengene KOLUNA {sol} bir kez tıkla: mengene açılır.',
      ok:() => S.mAcik > 5 },
    { b:1, id:'mengeneSik', o:() => viseKol.children[1], s:'Açıldı, parça artık boşta. Kola bir kez daha tıkla: mengene sıkılır.', ok:() => S.mAcik === 0 },

    { b:2, id:'tepsi', h:['#tcCur'], s:'Takım takalım. Ekranın altındaki takım düğmesine {sol} tıkla: elindeki takımlar açılır.', ok:() => !$('tcTray').hidden || takili('T1') },
    { b:2, id:'t1', h:[kart('T1')], s:'Listeden T1 Alın frezesi kartına tıkla. Tezgâh takımı kendisi değiştirir; birkaç saniye bekle.', ok:() => takili('T1') },
    { b:2, id:'start', h:['#cpStart'], p:['console'], s:'Takım takıldı. Mili çalıştır: kumanda panelindeki yeşil START düğmesine tıkla. Devri ben ayarladım.',
      kur:() => { setRpm(1500); setFeed(400); }, ok:() => S.spindle },

    { b:3, id:'cark', o:() => wheels[0].children[0], yuz:true, s:'Tablayı elle oynatalım. Fareyi sarı okun gösterdiği tabla ÇARKININ üstüne getir ve {teker} TEKERLEĞİ çevir. Sürükleme yok, sadece tekerlek. Her çentik 1 mm.',
      kur:() => { S.wheelMul = 1; ref = S.px; }, ok:() => Math.abs(S.px - ref) > 8 },
    { b:3, id:'ekran', tamam:true, h:['#cpScreen'], p:['console'], s:'Gördün mü? Kumanda ekranındaki X sayısı değişti. Bu sayılar takımın yeri: X sağ-sol, Y ileri-geri, Z yukarı-aşağı.' },
    { b:3, id:'tusX', h:['#cpKeys [data-k="x"]'], p:['console'], s:'Elle uzun sürer; gideceğin yeri kumandaya yazabilirsin. Kumandadaki [X] tuşuna tıkla.',
      kur:() => { tus = []; }, ok:() => yazildi('x') },
    { b:3, id:'tus30', h:['#cpKeys [data-k="3"]', '#cpKeys [data-k="0"]'], p:['console'], s:'Şimdi sırayla [3] ve [0] tuşlarına tıkla: 30 yazdın. Ekranın altında görünür.',
      ok:() => yazildi('x30') },
    { b:3, id:'tusY', h:['#cpKeys [data-k="y"]', '#cpKeys [data-k="2"]', '#cpKeys [data-k="5"]'], p:['console'], s:'Aynısını Y için yap: [Y] tuşuna, sonra [2] ve [5]\'e tıkla.',
      ok:() => yazildi('x30y25') },
    { b:3, id:'git', h:['#cpKeys [data-k="git"]'], p:['console'], git:{ x:30, y:25 }, s:'Şimdi yeşil [GİT] tuşuna tıkla: tabla kendi gider. Takım parçanın üstüne gelecek.',
      ok:() => yakin(d().x, 30) && yakin(d().y, 25) },

    { b:4, id:'hizliAc', h:['#cpRapid'], p:['console'], s:'Takım parçadan çok yukarıda. Hızlı inelim: kumandadaki [HIZLI] tuşuna bir kez tıkla, sarı yanar.', ok:() => S.rapidBtn },
    { b:4, id:'zin', h:['#cpJog [data-j="z-1"]'], p:['console'], s:'Şimdi [Z−] tuşuna basılı tut. Takım parçaya iki parmak (1–2 cm) kalınca bırak.',
      ok:() => tip() < PH + 22 },
    { b:4, id:'hizliKapa', h:['#cpRapid'], p:['console'], yavas:true, s:'[HIZLI]\'ya tekrar tıkla, sönsün. Bundan sonrası yavaş ve dikkatli.', ok:() => !S.rapidBtn },
    { b:4, id:'deg', o:() => zFine, yuz:true, ara:true, yavas:true, s:'Sarı okun gösterdiği kovan ÇARKININ üstüne gel ve {teker} tekerleği çevir: takım iner. Yaklaşınca çarkı inceltirim; takım parçaya değdiği an tezgâhı ben durdururum.',
      kur:() => { S.wheelMul = 1; }, ok:() => { if (tip() < PH + 3) S.wheelMul = 0.1; if (tip() > PH + 0.05) return false; stopMotion(); S.wheel.z = 0; return true; } },
    { b:4, id:'z0', h:['#cpSoft [data-sk="2"]'], p:['console'], s:'Değdi! Burası parçanın üstü. Ekranın altındaki Z0 düğmesine tıkla: Z artık 0.',
      kur:() => { ref = S.zn; }, ok:() => S.zn !== ref && yakin(d().z, 0, 0.05) },

    { b:5, id:'sola', h:['#cpKeys'], p:['console'], git:{ x:-40 }, s:'Takımı parçanın soluna çıkaralım: [X] [4] [0] [±] [GİT]. ± tuşu sayıyı eksi yapar.',
      ok:() => d().x < -30 },
    { b:5, id:'paso', h:['#cpKeys'], p:['console'], git:{ x:-40, z:-1 }, s:'Şimdi 1 mm aşağı in: [Z] [1] [±] [GİT]. Bu 1 mm\'yi parçanın üstünden alacağız.',
      ok:() => d().x < -30 && yakin(d().z, -1, 0.05) },
    { b:5, id:'sag', h:['#autoBtns [data-af="1"]'], p:['spindle'], s:'Otomatik ilerlemeyi aç: İş mili panelinde "Sağa →" düğmesine tıkla. Tabla kendi gider, sen izle. Parça bitince ben durdururum.',
      ok:() => { if (d().x < PW + 25) return false; setAuto(0); return true; } },
    { b:5, id:'y75', h:['#cpKeys'], p:['console'], git:{ y:75 }, s:'Yarısı bitti. Z\'ye dokunma, sadece Y: [Y] [7] [5] [GİT].', ok:() => yakin(d().y, 75) },
    { b:5, id:'solaGel', h:['#autoBtns [data-af="-1"]'], p:['spindle'], s:'Şimdi "← Sola" düğmesine tıkla, tabla geri gelsin.',
      ok:() => { if (!(yakin(d().y, 75) && d().x < -25)) return false; setAuto(0); return true; } },

    { b:6, id:'stop1', h:['#cpStop'], p:['console'], s:'Yüzey cilalı gibi! Sırada delik var, önce takım değişecek. Kırmızı STOP\'a tıkla, mil dursun.', ok:() => !S.spindle },
    { b:6, id:'t6', h:['#tcCur', kart('T6')], s:'Alttaki takım düğmesinden T6 Punta matkabını tak. Punta, matkabın kaymaması için küçük bir çukur açar.', ok:() => takili('T6') },
    { b:6, id:'start2', h:['#cpStart'], p:['console'], s:'START\'a tıkla.', kur:() => { setRpm(1500); setFeed(100); }, ok:() => S.spindle },
    { b:6, id:'merkez', h:['#cpKeys'], p:['console'], git:{ x:75, y:50 }, s:'Deliğin yeri parçanın ortası: [X] [7] [5] [Y] [5] [0] [GİT].',
      ok:() => yakin(d().x, 75) && yakin(d().y, 50) },
    { b:6, id:'punta', h:['#cpJog [data-j="z-1"]'], p:['console'], s:'Takımı parçanın biraz üstüne ben indirdim. [Z−] tuşuna basılı tut; uç parçaya 2 mm kadar girince bırak.',
      kur:() => yaklas(ust() + 6), ok:() => merkez() < ust() - 1.2 },
    { b:6, id:'stop2', h:['#cpStop'], p:['console'], s:'Güzel bir punta. STOP\'a tıkla.', ok:() => !S.spindle },
    { b:6, id:'t7', h:['#tcCur', kart('T7')], s:'Şimdi T7 Ø5 matkabı tak. M6 dişin deliği Ø5 olur.', ok:() => takili('T7') },
    { b:6, id:'start3', h:['#cpStart'], p:['console'], s:'START\'a tıkla.', kur:() => { setRpm(2500); setFeed(150); }, ok:() => S.spindle },
    { b:6, id:'del', h:['#cpJog [data-j="z-1"]'], p:['console'], s:'[Z−] tuşuna basılı tut: matkap parçayı delip altından çıkana kadar in. 20 mm, biraz sürer.',
      kur:() => yaklas(ust() + 3), ok:() => merkez() <= 0.05 },
    { b:6, id:'stop3', h:['#cpStop'], p:['console'], s:'Delik açıldı! STOP\'a tıkla.', ok:() => !S.spindle },
    { b:6, id:'t11', h:['#tcCur', kart('T11')], s:'Şimdi T11 M6 kılavuzu tak. Kılavuz deliğin içine diş açar.', ok:() => takili('T11') },
    { b:6, id:'start4', h:['#cpStart'], p:['console'], s:'START\'a tıkla. Devri 250\'ye aldım; kılavuz yavaş döner.',
      kur:() => { setRpm(250); if (S.dir < 0) $('spDir').click(); }, ok:() => S.spindle },
    { b:6, id:'kavra', h:['#cpJog [data-j="z-1"]'], p:['console'], s:'[Z−] tuşuna kısa kısa bas: kılavuz deliğe girince kendi kendini çeker. O an bırak, izle.',
      kur:() => yaklas(ust() + 2), ok:() => !!S.tap },
    { b:6, id:'geri', h:['#cpDir', '#spDir'], p:['console'], kilavuz:true, s:'Kılavuz iniyor. Parçanın ALTINDAN çıkınca mil yönü düğmesine (İLERİ yazan) tıkla: GERİ döner ve kendini çıkarır.',
      ok:() => { const t = threadAt(75, 50, 1); return !S.tap && !!t && t.ok; } },
    { b:6, id:'bitir', h:['#cpStop', '#cpDir'], p:['console'], s:'Diş tamam! STOP\'a tıkla ve mil yönünü yeniden İLERİ\'ye al.', ok:() => !S.spindle && S.dir > 0 },
    { b:6, id:'teslim', h:['#jobSubmit'], p:['jobs'], s:'Son iş: İş emirleri panelindeki "Parçayı teslim et" düğmesine tıkla; ölçüleri bakalım.', ok:() => !$('report').hidden },
    { b:6, id:'son', son:true, s:'Fena değil, hiç fena değil! Benden bu kadar: dükkân senin. Müşteriler mail atar, üstteki saatten bilgisayara bak. Kolay gelsin!' },
  ];

  /* ---- balon, sarı ok ---- */
  const el = document.createElement('div'); el.className = 'eg'; el.id = 'egBalon'; el.hidden = true;
  el.innerHTML = `<div class="eg-av" aria-hidden="true">O</div>
    <div class="eg-govde"><div class="eg-bas"><b>Otto Usta</b><span id="egSay"></span></div><div class="eg-ilerleme"><i id="egBar"></i></div><p id="egSoz"></p><p class="eg-ip" id="egIp" hidden></p>
    <div class="eg-alt"><button class="btn sm" id="egAtla">Eğitimi bitir</button><button class="btn sm start" id="egIleri" hidden>Anladım ▶</button><button class="btn sm start" id="egKariyer" hidden>Kariyere başla</button></div></div>`;
  document.body.append(el);
  const ok3 = document.createElement('div'); ok3.className = 'eg-ok'; ok3.hidden = true;
  ok3.innerHTML = '<svg viewBox="0 0 40 54" aria-hidden="true"><path d="M20 52 L3 31 H13 V2 H27 V31 H37 Z"/></svg>';
  document.body.append(ok3);
  let i = -1, timer = 0, kirikDedi = false, isikli = [];
  const isikSil = () => { isikli.forEach(e => e.classList.remove('eg-isik')); isikli = []; };
  // fare simgesi: hangi tuş/tekerlek kullanılacak
  const FARE = { sol:['sol tuş', '<path d="M8 1A7 7 0 0 0 1 8v1h7z" class="on"/>'], sag:['sağ tuş', '<path d="M8 1a7 7 0 0 1 7 7v1H8z" class="on"/>'],
    teker:['tekerlek', '<rect x="6.3" y="3" width="3.4" height="5.5" rx="1.7" class="on"/>'] };
  const fare = k => `<span class="eg-fare"><svg viewBox="0 0 16 22"><rect x="1" y="1" width="14" height="20" rx="7"/><path d="M8 1v8M1 9h14"/>${FARE[k][1]}</svg>${FARE[k][0]}</span>`;
  // [X] tuş kutusu, {sol} fare simgesi (metinler bizim, HTML güvenli)
  const soz = t => { $('egSoz').innerHTML = t.replace(/\[([^\]]+)\]/g, '<kbd>$1</kbd>').replace(/\{(sol|sag|teker)\}/g, (m, k) => fare(k)); };
  function goster() {
    const A = ADIM[i];
    isikSil(); ileri = false;
    if (A.o) ['hud', 'spindle', 'jobs'].forEach(id => { if (PM.P[id] && PM.P[id].vis) PM.setVis(id, false); });   // 3B hedef sol paneller arkasında kalmasın (kumanda sağda kalır; kamera hedefi sola alır)
    if (A.o && !A.bak) A.bak = A.o;                                   // 3B hedefli her adımda kamera oraya gider
    if (A.p) A.p.forEach(id => { if (PM.P[id] && !PM.P[id].vis) PM.setVis(id, true); });
    if (A.kur) A.kur();
    if (A.bak) odak(A.bak(), A.yuz, A.ara);
    if (A.h && A.h.some(q => q.startsWith('#tcList'))) app.TC.ac();          // takım kartı parlayacaksa şerit açık olsun
    (A.h || []).forEach(q => document.querySelectorAll(q).forEach(e => { e.classList.add('eg-isik'); isikli.push(e); }));
    soz(A.s); $('egIp').hidden = true; bosT = 0;
    const toplam = ADIM.length - 1;
    $('egSay').textContent = A.son ? 'bitti' : `${B[A.b]} · ${A.b + 1}/${B.length} bölüm · adım ${i + 1}/${toplam}`;
    $('egBar').style.width = (i / toplam * 100) + '%';
    $('egAtla').hidden = !!A.son; $('egKariyer').hidden = !A.son; $('egIleri').hidden = !A.tamam;
    el.classList.remove('yeni'); void el.offsetWidth; el.classList.add('yeni');
  }
  function denetle() {
    if (i < 0 || S.duraklat) return;
    const A = ADIM[i];
    if (S.broken && !kirikDedi) { kirikDedi = true; yk = null; S.gHizli = false; $('egSoz').textContent = 'Kırıldı mı? Olur öyle, benim ilk gün iki tane gitmişti. Takımı [Z+] ile yukarı çek, alttaki takım düğmesinden aynısını yeniden tak; burada para yok.'; return; }
    if (!S.broken && kirikDedi) { kirikDedi = false; soz(A.s); }
    if (A.son) return;
    let ok = false;
    try { ok = A.tamam ? ileri : A.ok(); } catch (e) { console.error('eğitim adımı', i + 1, e); return; }
    if (!ok) { ipucu(A); return; }
    beep(880, 0.05, 0.05); setTimeout(() => beep(1320, 0.06, 0.05), 90);
    i++; goster();
  }
  // takılınca: usta neyin eksik olduğunu söyler (HIZLI açık kaldı, alarm, GİT hedefi, kılavuzu geri alma anı)
  let bosT = 0;
  function ipucu(A) {
    const bos = !S.changing && !S.autoX && !S.tap && !['x', 'y', 'z'].some(a => Math.abs(S.pend[a]) > 1e-6 || Math.abs(S.wheel[a]) > 1e-6);
    bosT = bos ? bosT + 0.2 : 0;
    let t = '';
    if (S.rapidBtn && (A.yavas || tip() < PH + 12)) t = 'HIZLI hâlâ açık! Kapat, yoksa takım parçaya hızla dalar ve kırılır.';
    else if (S.alarm) t = 'Alarm yanıyor; ACİL STOP\'a mı bastın? Kumandadaki alarmı sıfırla, sonra devam et.';
    else if (A.kilavuz && tip() < -1) t = 'ŞİMDİ! Kılavuz parçanın altına çıktı: mil yönü düğmesine tıkla.';
    else if (A.id === 'zin' && tip() < PH + 12) t = 'Yeterince yaklaştın, Z−\'yi bırak.';
    else if (A.git && bosT > 1.5) {
      const v = d(), f = n => (n >= 0 ? '+' : '−') + Math.abs(n).toFixed(2), ax = Object.keys(A.git);
      const yanlis = ax.filter(a => Math.abs(v[a] - A.git[a]) > 0.5);
      if (yanlis.length) t = `Ekranda ${yanlis.map(a => a.toUpperCase() + ' ' + f(v[a])).join(', ')} görüyorum; ${yanlis.map(a => a.toUpperCase() + ' ' + f(A.git[a])).join(', ')} olmalı. Eksen tuşuna bas, sayıyı yaz (eksi için ±), sonra GİT. Ondalık nokta gerekmez: 30 yaz, 3.0 değil. ENT konumu değiştirmez, ekrandaki değeri değiştirir.`;
    }
    $('egIp').textContent = t; $('egIp').hidden = !t;
  }

  /* ---- sarı ok ve kamera: her karede (eğitim sürerken) ---- */
  const v3 = new THREE.Vector3();
  let anim = null;
  function odak(o, yuz, ara) {                                     // ara: hedefle mil ucunun ortasına, daha uzaktan (ikisi birden görünsün)                                           // kamera hedefe yumuşakça döner ve yaklaşır (bakış yönü korunur, biraz yukarıdan)
    o.getWorldPosition(v3);
    let yon = camera.position.clone().sub(controls.target).normalize();
    if (yuz) {                                                      // çark: yüzüne bakan yönden (ekseni, tezgâhın dışına doğru)
      o.updateMatrixWorld();
      const n = new THREE.Vector3(0, 0, 1).transformDirection(o.matrixWorld), mil = new THREE.Vector3();
      spindleG.getWorldPosition(mil); mil.y = v3.y;
      if (n.dot(v3.clone().sub(mil)) < 0) n.negate();
      yon = n.multiplyScalar(0.8).add(yon.multiplyScalar(0.2));
    }
    yon.y = Math.max(yon.y, 0.45); yon.normalize();
    // hedef ekranın solunda (yatayda %32) dursun: sağ alttaki kumanda paneli onu örtmesin
    let uz = 560;
    if (ara) { const m = new THREE.Vector3(); spindleG.getWorldPosition(m); v3.add(m).multiplyScalar(0.5); uz = 900; }
    const sag = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), yon).normalize();   // kameranın sağı
    const kay = sag.multiplyScalar(uz * Math.tan(camera.fov * Math.PI / 360) * camera.aspect * 0.36);
    const t1 = v3.clone().add(kay);
    anim = { t:0, c0:camera.position.clone(), t0:controls.target.clone(), c1:t1.clone().add(yon.multiplyScalar(uz)), t1 };
    disari = 0;
  }
  let disari = 0;                                                   // hedef ekran dışında geçen süre (kare)
  function okYeri() {
    const A = ADIM[i]; if (!A) { ok3.hidden = true; return; }
    let x = null, y = null, ust = false;
    if (A.o) {
      A.o().getWorldPosition(v3); v3.project(camera);
      const r = canvas.getBoundingClientRect();
      if (v3.z < 1 && Math.abs(v3.x) < 0.95 && Math.abs(v3.y) < 0.9) { x = r.left + (v3.x + 1) / 2 * r.width; y = r.top + (1 - v3.y) / 2 * r.height - 14; disari = 0; }
      else if (!anim && ++disari > 60) odak(A.o(), A.yuz, A.ara);                  // oyuncu kamerayı çevirip hedefi kaybettiyse ~1 s sonra geri döner
    } else {
      const e = isikli.find(q => q.offsetParent && q.getBoundingClientRect().width);
      if (e) { const r = e.getBoundingClientRect(); x = r.left + r.width / 2; y = r.top - 4; if (r.top < 120) { ust = true; y = r.bottom + 4; } }
    }
    ok3.hidden = x === null;
    if (x !== null) { ok3.style.left = (x - 20) + 'px'; ok3.style.top = (ust ? y : y - 58) + 'px'; ok3.classList.toggle('yukari', ust); }
  }
  function dongu(now) {
    if (i < 0) { ok3.hidden = true; return; }
    if (anim) {
      if (anim.s == null) anim.s = now;                               // süreye göre (kare hızından bağımsız) ~1.2 s
      anim.t = Math.min(1, (now - anim.s) / 1200); const k = anim.t * anim.t * (3 - 2 * anim.t);
      camera.position.lerpVectors(anim.c0, anim.c1, k); controls.target.lerpVectors(anim.t0, anim.t1, k); controls.update();
      if (anim.t >= 1) anim = null;
    }
    okYeri();
    requestAnimationFrame(dongu);
  }

  // ustanın hızlı yaklaştırması: her karede (12'deki döngü, motion'dan önce); hedefe varınca hızlı hemen kapanır ki oyuncunun Z−'si yavaş olsun
  function kare() {
    if (!yk) return;
    if (Math.abs(tip() - yk.z) < 0.3 || S.alarm || S.broken || i < 0) { yk = null; S.gHizli = false; S.pend.z = 0; return; }
    if (!S.changing) { S.gHizli = true; S.pend.z = yk.z - tip(); }
  }
  function baslat() {
    initAudio(); app.MENU.kapat();
    if (app.CR.on) document.querySelector('#modeSw [data-mode="free"]').click();
    PM.preset('kumanda'); if (PM.P.hud && PM.P.hud.vis) PM.setVis('hud', false);   // eğitimde ekran sade
    app.setStock(150, 100, 20, true); resetPart('al'); app.MG.kapat(true); setKay(0);
    S.zx = 0; S.zy = 0; S.zn = PH + TOOLS[S.tool].len;                 // sıfır parçanın sol-ön-üst köşesinde
    S.job = { idx:-1, J, time:0, done:false, stats:{ breaks:0, load:0, spot:0, peck:0, rub:0 } };
    $('jcNo').textContent = 'EĞİTİM'; $('jcTitle').textContent = J.title; $('jcBrief').textContent = J.brief; $('jcBtns').hidden = false;
    $('dwTitle').textContent = 'TEKNİK RESİM · EĞİTİM · İLK PARÇA'; $('dwSvg').innerHTML = drawingSVG(J); $('dwTable').innerHTML = drawingTable(J);
    buildScribe(J);
    $('report').hidden = true; el.hidden = false; i = 0; yk = null; goster();
    clearInterval(timer); timer = setInterval(denetle, 200);
    requestAnimationFrame(dongu);
    log('Eğitim başladı: Otto Usta\'yı dinle. İstediğin an "Eğitimi bitir" ile çıkabilirsin.', 'ok');
  }
  function bitir(kariyer) {
    clearInterval(timer); isikSil(); el.hidden = true; ok3.hidden = true; i = -1; yk = null; S.gHizli = false; S.wheelMul = 0.01;
    kayit.yaz(KEY, { bitti:true });
    $('rpNext').hidden = true;
    if (kariyer) { $('report').hidden = true; app.FW.stop(); document.querySelector('#modeSw [data-mode="career"]').click(); }
  }
  $('egAtla').addEventListener('click', () => bitir(false));
  $('egKariyer').addEventListener('click', () => bitir(true));
  $('egIleri').addEventListener('click', () => { ileri = true; denetle(); });
  $('cpKeys').addEventListener('click', e => { const b = e.target.closest('[data-k]'); if (b && i >= 0) tus.push(b.dataset.k); });
  // teslim raporunda "sonraki iş" eğitimde yok
  $('jobSubmit').addEventListener('click', () => { if (i >= 0) setTimeout(() => { $('rpNext').hidden = true; $('rpRetry').hidden = true; }, 0); });

  return { baslat, bitir, kare, get bitti() { return !!kayit.oku(KEY, {}).bitti; }, get adim() { return i; }, get id() { return ADIM[i] && ADIM[i].id; }, ADIM, okYeri };
})();

Object.assign(app, { EG });

export { EG };
