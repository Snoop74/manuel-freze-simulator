// ── Atölye bilgisayarı (PC): kariyerde üst çubukta gün/saat ve mail rozeti; monitör görünümünde Posta (siparişler, teklif,
//   müşteri cevapları, gün raporları), Banka, Tedarik (dükkân), Dolap (takım şeridi), Günü bitir; gün sonu raporu.
//   Mantık ve kayıt 17-kariyer'de (CR); burası yalnızca ekran.
import { $, S, app, log } from './00-temel.js';
import { beep, initAudio } from './01-ses.js';

const PC = (() => {
  // üst çubuk: saat + mail rozeti (kasanın solunda)
  const tb = document.createElement('button'); tb.className = 'tb-saat'; tb.id = 'tbSaat'; tb.title = 'Atölye bilgisayarı: mailler, banka, tedarik';
  tb.innerHTML = '<span id="tsGun"></span><b id="tsSaat">08:00</b><span class="ts-mail" id="tsMail" hidden></span>';
  $('tbMoney').before(tb);

  const el = document.createElement('div'); el.className = 'pc'; el.id = 'pc'; el.hidden = true;
  el.innerHTML = `<div class="pc-mon" role="dialog" aria-label="Atölye bilgisayarı">
    <div class="pc-ekran">
      <div class="pc-ust"><b id="pcBaslik">Posta</b><span id="pcSaat"></span><button class="pc-x" id="pcKapat" aria-label="Kapat">×</button></div>
      <div class="pc-govde" id="pcGovde"></div>
      <div class="pc-alt">
        <button data-uyg="posta">✉ Posta <i id="pcRozet"></i></button><button data-uyg="banka">₺ Banka</button><button data-uyg="tedarik">🛒 Tedarik</button><button data-uyg="dolap">🔧 Dolap</button>
        <span></span><button class="pc-bitir" id="pcBitir">Günü bitir →</button>
      </div>
    </div>
    <div class="pc-ayak"></div>
  </div>`;
  document.body.append(el);
  const rp = document.createElement('div'); rp.className = 'pc pc-rapor'; rp.id = 'pcRapor'; rp.hidden = true; document.body.append(rp);

  let acik = false, uyg = 'posta', secili = null;
  const CR = () => app.CR;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));
  const zaman = m => { const s = CR().st; return m.gun === s.gun ? `${String(8 + Math.floor(m.dk / 60)).padStart(2, '0')}:${String(m.dk % 60).padStart(2, '0')}` : m.gun === s.gun - 1 ? 'dün' : `${m.gun}. gün`; };

  function ustCubuk() {
    const on = CR().on; tb.hidden = !on; if (!on) return;
    const z = CR().saat(), n = CR().okunmamis();
    $('tsGun').textContent = `${z.gun}. gün · ${z.gunAd}`;
    $('tsSaat').textContent = z.txt; tb.classList.toggle('gec', z.dk >= z.mesai - 60);
    $('tsMail').hidden = !n; $('tsMail').textContent = `✉ ${n}`;
    if (acik) { $('pcSaat').textContent = `${z.gunAd} ${z.txt}`; $('pcRozet').textContent = n ? n : ''; }
  }

  /* -- Posta -- */
  function posta() {
    const s = CR().st, G = $('pcGovde');
    G.innerHTML = '<div class="pc-kutu" id="pcKutu"></div><div class="pc-oku" id="pcOku"></div>';
    const K = $('pcKutu');
    if (!s.mail.length) K.innerHTML = '<div class="pc-bos">Gelen kutusu boş.</div>';
    for (const m of s.mail) {
      const o = m.tip === 'siparis' ? CR().siparis(m.orderId) : null;
      const durum = m.durum || (o && o.kabul ? 'aktif iş' : o && o.cond === 'acil' ? 'ACİL · ' + CR().anTxt(o.son) + "'e kadar" : o && CR().bekler(o) ? 'teklif bekliyor' : '');
      const b = document.createElement('button'); b.className = 'pc-m' + (m.okundu ? '' : ' yeni') + (secili === m.id ? ' on' : '') + (o && o.cond === 'acil' && !o.kabul ? ' acil' : '');
      b.innerHTML = `<span class="k">${esc(m.kimden)}</span><span class="t">${zaman(m)}</span><span class="s">${esc(m.konu)}</span>${durum ? `<span class="d">${esc(durum)}</span>` : ''}`;
      b.addEventListener('click', () => { secili = m.id; posta(); });
      K.append(b);
    }
    if (secili == null && s.mail.length) secili = s.mail[0].id;
    oku(secili);
  }
  function oku(id) {
    const O = $('pcOku'), m = id != null && CR().mailOku(id);
    if (!m) { O.innerHTML = '<div class="pc-bos">Bir mail seçin.</div>'; return; }
    const tl = CR().tl;
    let h = `<div class="pc-mbas"><b>${esc(m.konu)}</b><span>${esc(m.kimden)}${m.kind ? ` (${esc(m.kind)})` : ''} · ${zaman(m)}</span></div>`;
    if (m.tip === 'rapor') { O.innerHTML = h + raporHTML(m.rapor, false); ustCubuk(); return; }
    if (m.tip === 'bilgi') { O.innerHTML = h + `<div class="pc-metin">${esc(m.metin).replace(/\n/g, '<br>')}</div>`; ustCubuk(); return; }
    const o = CR().siparis(m.orderId);
    if (!o) { O.innerHTML = h + `<div class="pc-metin">Bu sipariş artık geçerli değil (${esc(m.durum || 'kapandı')}).</div>`; ustCubuk(); return; }
    const acilMi = o.cond === 'acil';
    h += `<div class="pc-metin">Merhaba usta,<br><br>${esc(o.J.brief)}<br><br>${o.kabul ? `Termin: <b>${CR().anTxt(o.termin)}</b>` : `${acilMi ? 'ACİL: 1 saat içinde cevap bekliyoruz.' : 'Yarın akşama kadar dönüş yaparsanız seviniriz.'}`}</div>`;
    h += `<div class="pc-etiket"><span>📎 teknik resim</span><span>${o.free ? 'malzeme müşteriden' : 'ham parça ' + tl(o.cost)}</span><span>${CR().bekler(o) ? 'fiyat sizden' : 'ödeme ' + CR().payTxt(o)}</span>${o.cond ? `<span class="c">${o.cond.toUpperCase()}</span>` : ''}</div>`;
    h += '<div class="pc-islem" id="pcIslem"></div>';
    O.innerHTML = h;
    const I = $('pcIslem'), btn = (t, cls, fn) => { const b = document.createElement('button'); b.className = 'btn' + (cls ? ' ' + cls : ''); b.innerHTML = t; b.addEventListener('click', () => { initAudio(); fn(); }); I.append(b); return b; };
    btn('Resmi gör', '', () => { CR().onizle(o.id); kapat(); });
    if (o.kabul) { I.insertAdjacentHTML('beforeend', '<span class="pc-not">Aktif iş: tezgâhta. Bitince "Parçayı teslim et".</span>'); return; }
    if (o.teklif === 'karsi') {
      I.insertAdjacentHTML('beforeend', `<span class="pc-not">Karşı teklif: <b>${tl(o.karsi)}</b></span>`);
      btn('Kabul et', 'start', () => { CR().karsiKabul(o.id); posta(); });
      btn('Vazgeç', '', () => { CR().reddet(o.id); secili = null; posta(); });
      return;
    }
    if (CR().bekler(o)) {
      I.insertAdjacentHTML('beforeend', `<span class="pc-not">Teklifiniz (piyasa tahmini ~${tl(o.est)}):</span>`);
      for (const [k, ad] of CR().TEKLIF) { const f = Math.round(o.est * k / 10) * 10; btn(`${ad} ${tl(f)}`, k === 1 ? 'start' : '', () => { CR().teklif(o.id, f); kapatmadan(); }); }
      btn('Reddet', '', () => { CR().reddet(o.id); secili = null; posta(); });
      return;
    }
    btn('İşi kabul et ve başla', 'start', () => { if (CR().kabul(o.id)) kapat(); else posta(); });
    btn('Reddet', '', () => { CR().reddet(o.id); secili = null; posta(); });
  }
  function kapatmadan() { if (!$('pc').hidden) posta(); }       // teklif sonrası (select resmi açar) bilgisayar açık kalır

  /* -- Banka -- */
  function banka() {
    const s = CR().st, tl = CR().tl, b = s.bugun;
    $('pcGovde').innerHTML = `<div class="pc-banka">
      <div class="pc-kart"><span>Kasa</span><b class="${s.money < 0 ? 'neg' : ''}">${tl(s.money)}</b><small>kredi limiti ${tl(CR().kredi())}${s.money < 0 ? ` · eksi ${s.eksi}/${CR().KREDI_SURE} teslim faizsiz` : ''}</small></div>
      <div class="pc-kart"><span>İtibar</span><b>${s.rep}</b><small>${esc(CR().level())}</small></div>
      <div class="pc-kart"><span>Bugün gelir</span><b>${tl(b.gelir)}</b><small>${b.teslim} teslim</small></div>
      <div class="pc-kart"><span>Bugün gider</span><b>${tl(b.gider)}</b><small>kira ve elektrik akşam: ${tl(CR().kira())}</small></div>
      <div class="pc-kart gen"><span>Toplam kazanç</span><b>${tl(s.earned)}</b><small>${s.done} iş teslim edildi</small></div>
    </div>`;
  }

  /* -- Gün sonu raporu (mailde de görünür) -- */
  function raporHTML(r, buyuk) {
    const tl = CR().tl;
    return `<div class="pc-rkart${buyuk ? ' buyuk' : ''}">
      <div class="pc-rsat"><div><span>Gelir</span><b>+${tl(r.gelir)}</b></div><div><span>Gider</span><b>−${tl(r.gider)}</b><small>kira ${tl(r.kira)} dahil</small></div>
      <div><span>Kâr</span><b class="${r.kar < 0 ? 'neg' : 'pos'}">${r.kar >= 0 ? '+' : ''}${tl(r.kar)}</b></div><div><span>İtibar</span><b>${r.rep >= 0 ? '+' : ''}${r.rep}</b></div></div>
      <div class="pc-metin">${r.teslim} iş teslim edildi${r.olay.length ? ' · ' + r.olay.map(esc).join(' · ') : ''}<br>Kasa: <b class="${r.kasa < 0 ? 'neg' : ''}">${tl(r.kasa)}</b>${r.eksi ? ` (eksi hesap: ${r.eksi})` : ''}<br>
      ${r.yarin.length ? 'Yarın termin: ' + r.yarin.map(esc).join(' · ') : 'Yarın terminli iş yok.'}${r.bekleyen ? ` · ${r.bekleyen} sipariş maili bekliyor` : ''}</div></div>`;
  }
  function rapor(r) {
    S.duraklat = true;
    rp.innerHTML = `<div class="pc-mon dar" role="dialog" aria-label="Gün sonu raporu"><div class="pc-ekran">
      <div class="pc-ust"><b>${r.gun}. gün bitti · ${esc(r.gunAd)}</b><span>Muhasebe</span></div>
      <div class="pc-govde tek">${raporHTML(r, true)}<div class="pc-islem"><span></span><button class="btn start" id="pcErtesi">Ertesi gün →</button></div></div>
    </div><div class="pc-ayak"></div></div>`;
    rp.hidden = false; beep(900, 0.1);
    $('pcErtesi').addEventListener('click', () => { rp.hidden = true; if (!acik) S.duraklat = false; CR().ertesiGun(); ustCubuk(); if (acik) goster(); });
  }

  function goster() {
    $('pcBaslik').textContent = { posta:'Posta', banka:'Banka' }[uyg] || 'Posta';
    el.querySelectorAll('[data-uyg]').forEach(b => b.classList.toggle('on', b.dataset.uyg === uyg));
    if (uyg === 'banka') banka(); else posta();
    ustCubuk();
  }
  function ac(u) {
    if (!CR().on) { log('Bilgisayar kariyer modunda: maillerle sipariş gelir.', 'warn'); return; }
    if (S.spindle) { log('Bilgisayara geçmeden önce mili durdurun.', 'warn'); return; }
    initAudio(); acik = true; el.hidden = false; S.duraklat = true; uyg = u || 'posta'; goster();
  }
  function kapat() { acik = false; el.hidden = true; if (rp.hidden) S.duraklat = false; }
  tb.addEventListener('click', () => ac('posta'));
  $('pcKapat').addEventListener('click', kapat);
  $('pcBitir').addEventListener('click', () => { CR().gunuBitir(); });
  el.querySelectorAll('[data-uyg]').forEach(b => b.addEventListener('click', () => {
    const u = b.dataset.uyg;
    if (u === 'tedarik') { kapat(); app.CR.openShop(); return; }
    if (u === 'dolap') { kapat(); app.TC && app.TC.ac(); return; }
    uyg = u; goster();
  }));
  window.addEventListener('keydown', e => {                       // bilgisayar açıkken tuşlar tezgâha gitmez; Esc kapatır
    if (!acik && rp.hidden) return;
    if (e.target instanceof Element && e.target.matches('input, select, textarea')) return;
    e.stopImmediatePropagation();
    if (e.code === 'Escape' && acik && rp.hidden) kapat();
  }, true);
  setInterval(() => { if (CR().on) CR().kontrol(); ustCubuk(); }, 500);
  ustCubuk();
  return { ac, kapat, rapor, yeniMail() { ustCubuk(); tb.classList.remove('yeni'); void tb.offsetWidth; tb.classList.add('yeni'); if (acik && uyg === 'posta') posta(); } };
})();

Object.assign(app, { PC });

export { PC };
