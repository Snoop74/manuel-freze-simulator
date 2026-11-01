// ── Eğitim (EG): Otto Usta ilk parçayı yaptırır. Yüzey alma, punta, delik, M6 kılavuz, teslim; sonunda kariyere geçilir.
//   Her adım: ustanın tek cümlelik sözü, parlatılan arayüz hedefi ve oyuncu işi yapınca kendiliğinden geçen bir denetim.
//   Ceza yok: serbest atölyede çalışır, kırılan takım bedava. Bitti bilgisi kayit'ta (freze-egitim). Metinler ileride çeviri için tek yerde.
import { kayit } from './00-kayit.js';
import { $, C, H, NX, PH, PW, S, TOOLS, app, log } from './00-temel.js';
import { beep, initAudio } from './01-ses.js';
import { camera } from './02-sahne-tezgah.js';
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
  const merkez = () => H[Math.round(50 / C) * NX + Math.round(75 / C)];   // deliğin yerindeki yüzey yüksekliği
  let ref = null;                                                   // adıma girerken alınan karşılaştırma değeri

  /* Adımlar: s ustanın sözü, h parlatılacak öğeler, p açılacak paneller, kur adıma girince, ok geçiş denetimi */
  const ADIM = [
    { s:'Hoş geldin! Dükkân artık senin, ben de seni bir parçayla uğurlayayım. Önce etrafına bak: fareyle sürükle, tekerlekle yaklaş.',
      kur:() => { ref = camera.position.clone(); }, ok:() => camera.position.distanceTo(ref) > 150 },
    { s:'Unutma: bir şey ters giderse Esc ACİL STOP\'tur. Şimdi mengene kolunu tıkla, açılsın; sonra bir daha tıkla, sıkılsın.',
      kur:() => { ref = false; }, ok:() => { if (S.mAcik > 5) ref = true; return ref && S.mAcik === 0; } },
    { s:'Sıkı. Yüzey için geniş takım lazım: alttaki şeritten T1 alın frezesini tak.', h:['#tcCur'],
      ok:() => takili('T1') },
    { s:'Devri ve ilerlemeyi ben ayarladım. Mili çalıştır: START.', h:['#cpStart', '#spStart'],
      kur:() => { setRpm(1500); setFeed(400); }, ok:() => S.spindle },
    { s:'Takımı parçanın üstüne götürelim. Kumandada sırayla bas: [X] 30 [Y] 25 [GİT].', h:['#cpKeys'], p:['console'],
      git:{ x:30, y:25 }, ok:() => yakin(d().x, 30) && yakin(d().y, 25) },
    { s:'Takım çok yukarıda. [HIZLI]\'yı aç, [Z−]\'yi basılı tutup parçaya bir parmak (10–15 mm) kalana kadar in, sonra [HIZLI]\'yı kapat.', h:['#cpRapid', '#cpJog'], p:['console'],
      ok:() => tip() < PH + 16 && !S.rapidBtn },
    { s:'Şimdi yavaş: [Z−]\'ye kısa kısa bas, yaklaşınca el çarkıyla in; takım parçaya değdiği an dur.', h:['#cpJog'], p:['console'], yavas:true,
      ok:() => { if (tip() > PH + 0.05) return false; stopMotion(); return true; } },
    { s:'Değdi! Burası parçanın üstü: Z0 tuşuyla Z\'yi sıfırla.', h:['#cpSoft [data-sk="2"]'], p:['console'],
      kur:() => { ref = S.zn; }, ok:() => S.zn !== ref && yakin(d().z, 0, 0.05) },
    { s:'Takımı parçanın soluna çıkar: [X] 40 [±] [GİT]. Sonra [Z] 1 [±] [GİT]; bu 1 mm\'lik paso.', h:['#cpKeys'], p:['console'],
      git:{ x:-40, z:-1 }, ok:() => d().x < -30 && yakin(d().z, -1, 0.05) },
    { s:'Otomatik ilerlemeyi SAĞA aç; tabla kendi gider. Parçanın öbür tarafına çıkınca ben durdururum.', h:['#autoBtns'], p:['spindle'],
      ok:() => { if (d().x < PW + 25) return false; setAuto(0); return true; } },
    { s:'Yarısı bitti. Z\'ye dokunma: [Y] 75 [GİT], sonra otomatik ilerlemeyi SOLA aç.', h:['#cpKeys', '#autoBtns'], p:['console', 'spindle'],
      git:{ y:75 }, ok:() => { if (!(yakin(d().y, 75) && d().x < -25)) return false; setAuto(0); return true; } },
    { s:'Yüzey tamam, cilalı gibi. Delik için önce punta vurulur: mili durdur, T6 punta matkabını tak.', h:['#tcCur'],
      ok:() => takili('T6') },
    { s:'Mili çalıştır, [X] 75 [Y] 50 [GİT]. Takım değişince boyu da değişir, Z\'ye güvenme: parçaya bakarak 2 mm kadar dal.', h:['#cpKeys', '#cpJog'], p:['console'],
      git:{ x:75, y:50 }, kur:() => { setRpm(1500); setFeed(100); }, ok:() => yakin(d().x, 75) && yakin(d().y, 50) && merkez() < PH - 1 - 1.2 },
    { s:'Güzel bir punta. Şimdi mili durdur, T7 Ø5 matkabı tak. M6 kılavuzun deliği Ø5\'tir.', h:['#tcCur'],
      ok:() => takili('T7') },
    { s:'Mili çalıştır ve boydan boya del: matkap parçanın altına çıkana kadar in. 20 mm, gagalamaya gerek yok.', h:['#cpStart', '#cpJog'], p:['console'],
      kur:() => { setRpm(2500); setFeed(150); }, ok:() => merkez() <= 0.05 },
    { s:'Delik açıldı. Mili durdur, T11 M6 kılavuzu tak; devri 250\'ye ben alırım.', h:['#tcCur'],
      ok:() => takili('T11') },
    { s:'Mili İLERİ çalıştır ve kılavuzu deliğe indir; deliğe girince kendini çeker. Parçanın altına çıkınca mil yönünü GERİ al, kendini çıkarır.', h:['#spDir', '#cpStart'], p:['spindle', 'console'],
      kur:() => { setRpm(250); if (S.dir < 0) $('spDir').click(); }, ok:() => { const t = threadAt(75, 50, 1); return !S.tap && !!t && t.ok; } },
    { s:'Diş tamam. Mili İLERİ\'ye al, durdur ve parçayı teslim et; bakalım ölçüler ne diyor.', h:['#jobSubmit'], p:['jobs'],
      ok:() => !$('report').hidden },
    { s:'Fena değil, hiç fena değil! Benden bu kadar: dükkân senin. Müşteriler mail atar, bilgisayara bak. Kolay gelsin!', son:true },
  ];

  /* ---- balon ---- */
  const el = document.createElement('div'); el.className = 'eg'; el.id = 'egBalon'; el.hidden = true;
  el.innerHTML = `<div class="eg-av" aria-hidden="true">O</div>
    <div class="eg-govde"><div class="eg-bas"><b>Otto Usta</b><span id="egSay"></span></div><p id="egSoz"></p><p class="eg-ip" id="egIp" hidden></p>
    <div class="eg-alt"><button class="btn sm" id="egAtla">Eğitimi bitir</button><button class="btn sm start" id="egKariyer" hidden>Kariyere başla</button></div></div>`;
  document.body.append(el);
  let i = -1, timer = 0, kirikDedi = false, isikli = [];
  const isikSil = () => { isikli.forEach(e => e.classList.remove('eg-isik')); isikli = []; };
  // [X] gibi tuş adları kumandadaki tuş gibi kutu içinde gösterilir (metinler bizim, HTML güvenli)
  const soz = t => { $('egSoz').innerHTML = t.replace(/\[([^\]]+)\]/g, '<kbd>$1</kbd>'); };
  function goster() {
    const A = ADIM[i];
    isikSil();
    if (A.p) A.p.forEach(id => { if (PM.P[id] && !PM.P[id].vis) PM.setVis(id, true); });
    if (A.kur) A.kur();
    (A.h || []).forEach(q => document.querySelectorAll(q).forEach(e => { e.classList.add('eg-isik'); isikli.push(e); }));
    soz(A.s); $('egIp').hidden = true; bosT = 0; $('egSay').textContent = A.son ? '' : `${i + 1} / ${ADIM.length - 1}`;
    $('egAtla').hidden = !!A.son; $('egKariyer').hidden = !A.son;
    el.classList.remove('yeni'); void el.offsetWidth; el.classList.add('yeni');
  }
  function denetle() {
    if (i < 0 || S.duraklat) return;
    const A = ADIM[i];
    if (S.broken && !kirikDedi) { kirikDedi = true; $('egSoz').textContent = 'Kırıldı mı? Olur öyle, benim ilk gün iki tane gitmişti. Takımı yukarı çek, alttaki şeritten aynısını yeniden tak; burada para yok.'; return; }
    if (!S.broken && kirikDedi) { kirikDedi = false; soz(A.s); }
    if (A.son) return;
    let ok = false;
    try { ok = A.ok(); } catch (e) { console.error('eğitim adımı', i + 1, e); return; }
    if (!ok) { ipucu(A); return; }
    beep(880, 0.05, 0.05); setTimeout(() => beep(1320, 0.06, 0.05), 90);
    i++; goster();
  }
  // takılınca: makine bir süredir boşta ve adım geçmediyse usta neyin eksik olduğunu söyler (alarm, GİT hedefi)
  let bosT = 0;
  function ipucu(A) {
    const bos = !S.changing && !S.autoX && !S.tap && !['x', 'y', 'z'].some(a => Math.abs(S.pend[a]) > 1e-6 || Math.abs(S.wheel[a]) > 1e-6);
    bosT = bos ? bosT + 0.2 : 0;
    if (S.rapidBtn && A.yavas) bosT = 9;                             // hızlı açıkken beklemeden uyar
    let t = '';
    if (S.rapidBtn && (A.yavas || tip() < PH + 16)) t = 'HIZLI hâlâ açık! Kapat, yoksa takım parçaya hızla dalar ve kırılır.';
    else if (S.alarm) t = 'Alarm yanıyor; ACİL STOP\'a mı bastın? Kumandadaki alarmı sıfırla, sonra devam et.';
    else if (A.git && bosT > 1.5) {
      const v = d(), f = n => (n >= 0 ? '+' : '−') + Math.abs(n).toFixed(2), ax = Object.keys(A.git);
      const yanlis = ax.filter(a => Math.abs(v[a] - A.git[a]) > 0.5);
      if (yanlis.length) t = `Ekranda ${yanlis.map(a => a.toUpperCase() + ' ' + f(v[a])).join(', ')} görüyorum; ${yanlis.map(a => a.toUpperCase() + ' ' + f(A.git[a])).join(', ')} olmalı. Eksen tuşuna bas, sayıyı yaz (eksi için ±), sonra GİT. Ondalık nokta gerekmez: 30 yaz, 3.0 değil. ENT konumu değiştirmez, ekrandaki değeri değiştirir.`;
    }
    $('egIp').textContent = t; $('egIp').hidden = !t;
  }
  function baslat() {
    initAudio(); app.MENU.kapat();
    if (app.CR.on) document.querySelector('#modeSw [data-mode="free"]').click();
    PM.preset('kumanda');
    app.setStock(150, 100, 20, true); resetPart('al'); app.MG.kapat(true); setKay(0);
    S.zx = 0; S.zy = 0; S.zn = PH + TOOLS[S.tool].len;                 // sıfır parçanın sol-ön-üst köşesinde
    S.job = { idx:-1, J, time:0, done:false, stats:{ breaks:0, load:0, spot:0, peck:0, rub:0 } };
    $('jcNo').textContent = 'EĞİTİM'; $('jcTitle').textContent = J.title; $('jcBrief').textContent = J.brief; $('jcBtns').hidden = false;
    $('dwTitle').textContent = 'TEKNİK RESİM · EĞİTİM · İLK PARÇA'; $('dwSvg').innerHTML = drawingSVG(J); $('dwTable').innerHTML = drawingTable(J);
    buildScribe(J);
    $('report').hidden = true; el.hidden = false; i = 0; goster();
    clearInterval(timer); timer = setInterval(denetle, 200);
    log('Eğitim başladı: Otto Usta\'yı dinle. İstediğin an "Eğitimi bitir" ile çıkabilirsin.', 'ok');
  }
  function bitir(kariyer) {
    clearInterval(timer); isikSil(); el.hidden = true; i = -1;
    kayit.yaz(KEY, { bitti:true });
    $('rpNext').hidden = true;
    if (kariyer) { $('report').hidden = true; app.FW.stop(); document.querySelector('#modeSw [data-mode="career"]').click(); }
  }
  $('egAtla').addEventListener('click', () => bitir(false));
  $('egKariyer').addEventListener('click', () => bitir(true));
  // teslim raporunda "sonraki iş" eğitimde yok
  $('jobSubmit').addEventListener('click', () => { if (i >= 0) setTimeout(() => { $('rpNext').hidden = true; $('rpRetry').hidden = true; }, 0); });

  return { baslat, bitir, get bitti() { return !!kayit.oku(KEY, {}).bitti; }, get adim() { return i; }, ADIM };
})();

Object.assign(app, { EG });

export { EG };
