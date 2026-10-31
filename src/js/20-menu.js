// ── Menü altyapısı: tam ekran katman, ekran yığını (Geri ile bir öncekine), ekran tanımları ve hazır denetimler.
//   MENU.ekran(id, kur)   ekran tanımla: kur(kart, M) kartın içini M'nin yardımcılarıyla doldurur
//   MENU.ac(id)           ekranı yığına ekler ve gösterir; ilk açılışta simülasyon ve ses duraklar
//   MENU.geri()           bir önceki ekrana döner (yığın biterse kapanır) · MENU.kapat() hepsini kapatır
// Menü açıkken klavye tezgâha gitmez; Esc bir önceki ekrana döner (menü kapalıyken Esc yine ACİL STOP).
// Yeni ekran: MENU.ekran('ad', (k, M) => { M.baslik(...); M.dugme(...); }) ve bir düğmeden MENU.ac('ad').
import { S, app } from './00-temel.js';
import { AYAR, ayarSifirla, ayarYaz } from './00-tercihler.js';
import { ac, initAudio, thud } from './01-ses.js';

const MENU = (() => {
  const kat = document.createElement('div'); kat.className = 'menu-kat'; kat.hidden = true; document.body.append(kat);
  const ekranlar = {}, yigin = [];
  let sekme = {};                                                 // ekran başına açık sekme

  // yardımcılar: kartın içine öğe ekler, öğeyi döndürür
  function yardimci(kart, id) {
    const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; kart.append(e); return e; };
    const M = {
      el,
      baslik(metin, alt) { const h = el('div', 'menu-baslik'); h.innerHTML = `<b>${metin}</b>${alt ? `<small>${alt}</small>` : ''}`; return h; },
      dugme(metin, fn, o = {}) {
        const b = el('button', 'menu-dugme' + (o.ana ? ' ana' : '') + (o.secili ? ' secili' : ''));
        b.innerHTML = `<span>${metin}</span>${o.alt ? `<small>${o.alt}</small>` : ''}`;
        b.disabled = !!o.kapali; b.addEventListener('click', () => { initAudio(); thud(260, 0.06, 0.05); fn(); });
        return b;
      },
      sekmeler(liste) {                                           // [[ad, metin], ...] → seçili sekmenin adı
        if (!sekme[id] || !liste.some(([a]) => a === sekme[id])) sekme[id] = liste[0][0];
        const s = el('div', 'menu-sekmeler');
        for (const [a, metin] of liste) {
          const b = document.createElement('button'); b.textContent = metin; b.classList.toggle('on', a === sekme[id]);
          b.addEventListener('click', () => { sekme[id] = a; goster(); }); s.append(b);
        }
        return sekme[id];
      },
      satir(etiket, ipucu) { const r = el('div', 'menu-satir'); r.innerHTML = `<label>${etiket}${ipucu ? `<small>${ipucu}</small>` : ''}</label>`; return r; },
      secim(ad, etiket, secenekler, ipucu) {                    // [[değer, metin], ...]
        const r = M.satir(etiket, ipucu), s = document.createElement('div'); s.className = 'menu-secim';
        for (const [v, metin] of secenekler) {
          const b = document.createElement('button'); b.textContent = metin; b.classList.toggle('on', AYAR[ad] === v);
          b.addEventListener('click', () => { ayarYaz(ad, v); goster(); }); s.append(b);
        }
        r.append(s); return r;
      },
      kaydir(ad, etiket, min, max, adim, bicim = v => Math.round(v * 100) + '%', ipucu) {
        const r = M.satir(etiket, ipucu), w = document.createElement('div'); w.className = 'menu-kaydir';
        const i = document.createElement('input'); Object.assign(i, { type:'range', min, max, step:adim, value:AYAR[ad] });
        const o = document.createElement('output'); o.textContent = bicim(AYAR[ad]);
        i.addEventListener('input', () => { o.textContent = bicim(+i.value); ayarYaz(ad, +i.value); });
        i.addEventListener('change', () => goster());             // hazır ayar etiketi (özel) güncellensin
        w.append(i, o); r.append(w); return r;
      },
      onay(ad, etiket, ipucu) {
        const r = M.satir(etiket, ipucu), b = document.createElement('button'); b.className = 'menu-onay' + (AYAR[ad] ? ' on' : '');
        b.textContent = AYAR[ad] ? 'Açık' : 'Kapalı';
        b.addEventListener('click', () => { ayarYaz(ad, !AYAR[ad]); goster(); }); r.append(b); return r;
      },
      alt(...dugmeler) { const a = el('div', 'menu-alt'); a.append(...dugmeler); return a; },
    };
    return M;
  }
  function goster() {
    const id = yigin[yigin.length - 1]; if (!id) return;
    kat.innerHTML = '';
    const kart = document.createElement('div'); kart.className = 'menu-kart'; kart.dataset.ekran = id; kat.append(kart);
    ekranlar[id](kart, yardimci(kart, id));
    const ilk = kart.querySelector('.menu-dugme.ana, .menu-dugme'); if (ilk) ilk.focus({ preventScroll:true });
  }
  function duraklat(on) {
    S.duraklat = on;
    if (ac) { if (on) ac.suspend(); else ac.resume(); }
  }
  function ac_(id) {
    if (!ekranlar[id]) return;
    if (!yigin.length) duraklat(true);
    yigin.push(id); kat.hidden = false; goster();
  }
  function kapat() { yigin.length = 0; kat.hidden = true; kat.innerHTML = ''; duraklat(false); }
  function geri() { yigin.pop(); if (yigin.length) goster(); else kapat(); }
  // menü açıkken klavye tezgâha gitmesin; Esc geri
  window.addEventListener('keydown', e => {
    if (kat.hidden) return;
    if (e.code === 'Escape') geri();
    e.stopImmediatePropagation();
    if (e.code === 'Escape' || e.code === 'Space') e.preventDefault();
  }, true);
  kat.addEventListener('pointerdown', e => { if (e.target === kat) geri(); });   // kartın dışına tıklama: geri
  return { ekran:(id, kur) => { ekranlar[id] = kur; }, ac:ac_, geri, kapat, yenile:goster, get acik() { return !kat.hidden; } };
})();

/* ---- Ekranlar ---- */
const modTik = mod => { const b = document.querySelector(`#modeSw [data-mode="${mod}"]`); if (b) b.click(); };
MENU.ekran('ana', (k, M) => {
  M.baslik('SNOOP3000', 'Manuel freze tezgâhı');
  const kariyer = app.CR && app.CR.on;
  M.dugme('Devam et', () => MENU.kapat(), { ana:true, alt:kariyer ? 'kariyer' : 'serbest atölye' });
  M.dugme('Kariyer', () => { modTik('career'); MENU.kapat(); }, { alt:'siparişler, kasa, itibar, dükkân', secili:kariyer });
  M.dugme('Serbest atölye', () => { modTik('free'); MENU.kapat(); }, { alt:'her şey açık ve ücretsiz', secili:!kariyer });
  M.dugme('Ayarlar', () => MENU.ac('ayarlar'), { alt:'grafik, ses, oyun' });
  M.dugme('Nasıl oynanır', () => { MENU.kapat(); const h = document.querySelector('[data-menu="help"]'); if (h) h.click(); }, { alt:'ilk adımlar ve kısayollar' });
  M.el('div', 'menu-not', 'Menü: üst çubukta ☰ · tezgâhta Esc her zaman ACİL STOP');
});
MENU.ekran('ayarlar', (k, M) => {
  M.baslik('Ayarlar');
  const s = M.sekmeler([['grafik', 'Grafik'], ['ses', 'Ses'], ['oyun', 'Oyun']]);
  if (s === 'grafik') {
    M.secim('kalite', 'Kalite', [['dusuk', 'Düşük'], ['orta', 'Orta'], ['yuksek', 'Yüksek']].concat(AYAR.kalite === 'ozel' ? [['ozel', 'Özel']] : []),
      'Zayıf bilgisayarda Düşük seçin');
    M.secim('golge', 'Gölgeler', [[0, 'Kapalı'], [1, 'Normal'], [2, 'Yüksek']]);
    M.kaydir('cozunurluk', 'Çözünürlük', 0.5, 1, 0.05, undefined, 'Düşük değer daha akıcı, daha bulanık');
    M.kaydir('talas', 'Talaş miktarı', 0.2, 1, 0.05);
  } else if (s === 'ses') {
    M.kaydir('sesAna', 'Ana ses', 0, 1, 0.05);
    M.kaydir('sesMakine', 'Makine ve kesme', 0, 1, 0.05);
    M.kaydir('sesArayuz', 'Arayüz bildirimleri', 0, 1, 0.05);
  } else {
    M.onay('acilisMenu', 'Açılışta ana menü', 'Kapalıysa oyun doğrudan tezgâhta açılır');
  }
  M.alt(M.dugme('Varsayılanlara dön', () => { ayarSifirla(); MENU.yenile(); }), M.dugme('Geri', () => MENU.geri(), { ana:true }));
});

Object.assign(app, { MENU });
// açılışta ana menü (ayarlardan kapatılabilir)
if (AYAR.acilisMenu) MENU.ac('ana');

export { MENU };
