// ── Takım çubuğu (TC): ekranın altında takılı takım; tıklayınca yatay takım şeridi açılır (seç, kırığı bilet, dolapta yoksa satın al),
//   sağda dükkân (sepet) ve ayrıntılar (tutucu, bileme, taster döngüleri: Takımlar paneli). İlk oyun denemesinde Onat'ın çizimi.
import { $, S, TOOLS, app, isTaster, tool } from './00-temel.js';
import { initAudio } from './01-ses.js';
import { rackTagOf, requestToolChange } from './09-kumanda.js';
import { PM, toolIcon } from './12-dongu-ust-cubuk.js';

const TC = (() => {
  const el = document.createElement('div'); el.className = 'tc'; el.id = 'tcBar';
  el.innerHTML = `<div class="tc-tray" id="tcTray" hidden><div class="tc-list" id="tcList"></div></div>
    <div class="tc-bar">
      <button class="tc-cur" id="tcCur" aria-expanded="false" title="Takımları göster (T)"><span class="ico" id="tcIco"></span><span class="tc-txt"><b id="tcNo">T3</b><span id="tcName"></span></span><span class="tc-st" id="tcSt"></span><i>▴</i></button>
      <button class="tc-btn" id="tcShop" title="Dükkân: takım ve ekipman al"><svg viewBox="0 0 24 24"><path d="M3 4h2l2.4 11h10.2L20 7H6.3"/><circle cx="9" cy="19" r="1.6"/><circle cx="17" cy="19" r="1.6"/></svg></button>
      <button class="tc-btn" id="tcMore" title="Ayrıntılar: tutucu, bileme, taster döngüleri"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/></svg></button>
    </div>`;
  document.body.append(el);
  let open = false, sonImza = '';

  // takımın durumu: kırık, körelmiş, dolapta yok (fiyat), takılı
  function durum(T, i) {
    const tg = rackTagOf(i);
    if (i === S.tool && S.broken) return ['KIRIK', 'bad'];
    if (tg && !tg.own) return tg.kirik ? ['kırık · bilet ' + tg.price, 'bad'] : ['satın al ' + tg.price, 'buy'];
    if (S.wear[i] > 0.3) return ['körelmiş', 'warn'];
    return null;
  }
  function kart(T, i) {
    const b = document.createElement('button'); b.className = 'tc-card'; b.dataset.i = i;
    const d = durum(T, i);
    if (i === S.tool) b.classList.add('on');
    if (d) b.classList.add(d[1]);
    b.innerHTML = `<span class="ico">${toolIcon(T)}</span><b>${T.no}</b><span class="nm">${T.name}</span><span class="dm">Ø${T.d}</span>${d ? `<em>${d[0]}</em>` : ''}`;
    b.title = `${T.no} ${T.name} Ø${T.d} · ${T.mat}`;
    b.addEventListener('click', () => {
      initAudio();
      const once = S.tool;
      requestToolChange(i);
      ciz(true);
      if (S.changing && S.changing.to === i) { kapat(); if (isTaster(T) && PM.P.tools && !PM.P.tools.vis) PM.setVis('tools', true); }   // taster döngüleri Takımlar panelinde
      else if (once === S.tool) ciz(true);
    });
    return b;
  }
  function ciz(zorla) {
    const imza = TOOLS.map((T, i) => T.gone ? '' : T.no + (durum(T, i) || [''])[0] + (i === S.tool)).join('|') + S.broken;
    if (!zorla && imza === sonImza) return;
    sonImza = imza;
    const L = $('tcList'); L.innerHTML = '';
    TOOLS.forEach((T, i) => { if (!T.gone) L.append(kart(T, i)); });
    const nb = document.createElement('button'); nb.className = 'tc-card add';
    nb.innerHTML = '<span class="ico">+</span><b>Yeni</b><span class="nm">Takım tasarla</span>';
    nb.addEventListener('click', () => { kapat(); app.TE.show(null); });
    L.append(nb);
    const on = L.querySelector('.tc-card.on'); if (on && zorla) on.scrollIntoView({ block:'nearest', inline:'center' });
  }
  function guncelle() {                                             // takılı takım: simge, ad, durum
    const T = tool(), i = S.tool, d = durum(T, i);
    $('tcIco').innerHTML = toolIcon(T);
    $('tcNo').textContent = T.no; $('tcName').textContent = `${T.name} Ø${T.d}`;
    $('tcSt').textContent = S.changing ? 'değişiyor…' : d ? d[0] : '';
    $('tcSt').className = 'tc-st ' + (S.changing ? 'warn' : d ? d[1] : '');
    $('tcShop').hidden = !app.CR.on;
    if (open) ciz(false);
  }
  function ac() { open = true; $('tcTray').hidden = false; $('tcCur').setAttribute('aria-expanded', 'true'); el.classList.add('acik'); ciz(true); }
  function kapat() { open = false; $('tcTray').hidden = true; $('tcCur').setAttribute('aria-expanded', 'false'); el.classList.remove('acik'); }
  $('tcCur').addEventListener('click', () => { initAudio(); open ? kapat() : ac(); });
  $('tcShop').addEventListener('click', () => { kapat(); app.CR.openShop(); });
  $('tcMore').addEventListener('click', () => { const p = PM.P.tools; if (p) PM.setVis('tools', !p.vis); });
  // dışına tıklayınca kapanır; T tuşu açar/kapatır (Esc her zaman ACİL STOP, burada kullanılmaz)
  document.addEventListener('pointerdown', e => { if (open && !el.contains(e.target)) kapat(); });
  window.addEventListener('keydown', e => {
    if (e.target instanceof Element && e.target.matches('input, select, textarea')) return;
    if (e.code === 'KeyT' && !e.ctrlKey && !e.altKey && !e.metaKey && !S.duraklat) { open ? kapat() : ac(); }
  }, true);
  setInterval(guncelle, 250); guncelle();
  return { ac, kapat, guncelle };
})();

Object.assign(app, { TC });

export { TC };
