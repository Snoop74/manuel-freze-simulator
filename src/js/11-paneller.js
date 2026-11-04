// ── Paneller (PM; 12-dongu'dan ayrıldı): taşınabilir/ölçeklenebilir paneller, düzen hazır ayarları, üst çubuk simgeleri ve menüleri, takım simgeleri
import { kayit } from './00-kayit.js';
import { $, S, app, clamp, log } from './00-temel.js';
import { initAudio } from './01-ses.js';

/* ---------------- Takım simgeleri (kalem kartları için) ---------------- */
function toolIcon(T) {
  const s = '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round">';
  switch (T.type) {
    case 'face': return s + '<path d="M12 3h8v9h-8z"/><path d="M5 12h22v6H5z" fill="currentColor" fill-opacity=".25"/><path d="M6 18l2 4M12 18l1 4M19 18l1 4M25 18l-1 4"/></svg>';
    case 'end': return s + '<path d="M11 3h10v11H11z"/><path d="M12 14h8v15h-8z" fill="currentColor" fill-opacity=".25"/><path d="M12 17l8 3M12 22l8 3"/></svg>';
    case 'ball': return s + '<path d="M11 3h10v11H11z"/><path d="M12 14h8v11a4 4 0 0 1-8 0z" fill="currentColor" fill-opacity=".25"/><path d="M12 17l8 3"/></svg>';
    case 'chamfer': return s + '<path d="M11 3h10v12H11z"/><path d="M9 15h14l-7 12z" fill="currentColor" fill-opacity=".25"/><path d="M12 18h8"/></svg>';
    case 'dial': return s + '<path d="M13 2h6v6h-6z"/><rect x="8" y="8" width="16" height="15" rx="6" fill="currentColor" fill-opacity=".25"/><circle cx="16" cy="15.5" r="4.5"/><path d="M16 15.5l2-3"/><path d="M16 23v5"/><circle cx="16" cy="29" r="1.6" fill="currentColor"/></svg>';
    case 'probe': return s + '<path d="M11 3h10v12H11z"/><path d="M12 15h8l-2 4h-4z" fill="currentColor" fill-opacity=".25"/><path d="M16 19v6"/><circle cx="16" cy="27" r="2.6" fill="currentColor"/></svg>';
    case 'spot': return s + '<path d="M11 3h10v13H11z"/><path d="M11 16h10l-5 11z" fill="currentColor" fill-opacity=".25"/></svg>';
    case 'drill': return s + '<path d="M12 3h8v7h-8z"/><path d="M13 10h6v16l-3 4-3-4z"/><path d="M13 13l6 3M13 18l6 3M13 23l5 2"/></svg>';
    case 'tap': return s + '<path d="M12 3h8v9h-8z"/><path d="M12 12h8v13l-4 4-4-4z"/><path d="M12 15l8 2M12 19l8 2M12 23l7 2"/></svg>';
    case 'edge': return s + '<path d="M12 3h8v12h-8z"/><path d="M14 15h4v7h-4z"/><circle cx="16" cy="25" r="3.5" fill="currentColor" fill-opacity=".25"/></svg>';
  }
  return s + '<circle cx="16" cy="16" r="10"/></svg>';
}

const TBICON = {
  logo:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M9 2h6v6H9z"/><path d="M10 8h4v10l-2 3-2-3z"/><path d="M10 11l4 2M10 15l4 2"/></svg>',
  console:'<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="10" r="2.3"/><circle cx="15.5" cy="10" r="2.3"/><path d="M7 16h10"/>',
  dro:'<rect x="2.5" y="5" width="19" height="14" rx="2"/><path d="M6.5 9.5v5M9.5 9.5h2.5v2.5h-2.5v2.5h2.5M15 9.5h2.5v5H15M15 12h2.5"/>',
  wheels:'<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="2"/><path d="M12 10V3.5M10.3 13l-5.6 3.3M13.7 13l5.6 3.3"/>',
  jog:'<path d="M12 3v18M3 12h18M9 6l3-3 3 3M9 18l3 3 3-3M6 9l-3 3 3 3M18 9l3 3-3 3"/>',
  spindle:'<path d="M4 17a8 8 0 1 1 16 0"/><path d="M12 17l4-5"/><circle cx="12" cy="17" r="1.3"/>',
  tools:'<path d="M9 2h6v7H9z"/><path d="M10 9h4v11l-2 2-2-2z"/><path d="M10 12l4 2M10 16l4 2"/>',
  part:'<path d="M4.5 8.5l7.5-4 7.5 4-7.5 4z"/><path d="M4.5 8.5v7l7.5 4 7.5-4v-7"/><path d="M12 12.5v7"/>',
  jobs:'<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V2.5h6V4M8.5 10h7M8.5 14h7M8.5 18h4"/>',
  drawing:'<rect x="3" y="4" width="18" height="16" rx="1.5"/><circle cx="12" cy="12" r="3.5"/><path d="M12 6.5v11M6.5 12h11" stroke-dasharray="2 1.6"/>',
  air:'<path d="M3 8.5h11v4H3z"/><path d="M14 10.5h6"/><path d="M5 12.5l-1.5 7.5h4.5L9.5 12.5"/><path d="M21 7.5c1.2 1 1.2 5 0 6"/>',
  fd:'<path d="M4 20l1-5L16 4l4 4L9 19z"/><path d="M14 6l4 4"/>',
  bench:'<path d="M3 5h18v4H3z"/><path d="M5 9v10l3-4V9M15 9v6l3 4V9"/><path d="M8 5v2M11 5v2M14 5v2M17 5v2"/>',
  editor:'<path d="M7 2h6v6H7z"/><path d="M8 8h4v9l-2 2-2-2z"/><path d="M15 21l6-6-2-2-6 6v2z"/>',
  shop:'<path d="M3 4h2l2.5 11h11L21 7H6.2"/><circle cx="9" cy="19" r="1.5"/><circle cx="17" cy="19" r="1.5"/>',
  hud:'<path d="M3 12h4l2-5 4 10 2-5h6"/>',
  log:'<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1"/><circle cx="4.5" cy="12" r="1"/><circle cx="4.5" cy="18" r="1"/>',
  layout:'<rect x="3" y="3" width="8" height="10" rx="1.5"/><rect x="13" y="3" width="8" height="6" rx="1.5"/><rect x="13" y="11" width="8" height="10" rx="1.5"/><rect x="3" y="15" width="8" height="6" rx="1.5"/>',
  camera:'<path d="M3 8h3.5l2-3h7l2 3H21v11H3z"/><circle cx="12" cy="13" r="3.5"/>',
  sound:'<path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/>',
  mute:'<path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M17 9.5l5 5M22 9.5l-5 5"/>',
  blank:'<path d="M4 8.5l8-4.5 8 4.5v7.5l-8 4.5-8-4.5z"/><path d="M4 8.5l8 4.5 8-4.5M12 13v7.5"/><path d="M8 6.3l8 4.5"/>',
  menu:'<path d="M4 7h16M4 12h16M4 17h16"/>',
  gkod:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 9l3 3-3 3M12 15h5"/>',
  help:'<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .9-1 1.7v.5"/><circle cx="12" cy="17" r=".7"/>'
};
/* ---------------- Paneller: taşınabilir, ölçeklenebilir kumanda pencereleri ---------------- */
const PM = (() => {
  const TOP = 46, BAR = 58, KEY = 'freze-panels-v2';
  const CFG = [
    { id:'console', title:'Kumanda paneli',   col:'B', w:540, sizes:[420, 540, 760] },   // içerik genişlikle ölçeklenir (cqw); başlıkta boyut düğmesi
    { id:'hud',     title:'Durum',            col:'L', w:290 },
    { id:'jobs',    title:'İş emirleri',      col:'L', w:340 },
    { id:'part',    title:'Parça',            col:'L', w:320 },
    { id:'log',     title:'Olay kaydı',       col:'L', w:340 },
    { id:'spindle', title:'İş mili',          col:'R', w:330 , gizli:true },
    { id:'tools',   title:'Takımlar',         col:'R', w:340 },
    { id:'dro',     title:'DRO',              col:'R', w:360 , gizli:true },
    { id:'wheels',  title:'El çarkları',      col:'B', w:440 , gizli:true },
    { id:'jog',     title:'Hareket',          col:'BL', w:330 , gizli:true },
    { id:'drawing', title:'Teknik resim',     col:'C', w:340 },
    { id:'keys',    title:'Kısayollar',       col:'C', w:300 },
    { id:'gkod',    title:'Program (G-kod)',  col:'C', w:640 },
  ];
  const PRESETS = {
    kumanda: ['console'],                                           // tek düzen: kumanda sağ altta; takımlar alttaki takım çubuğunda (23-takim-cubugu)
    kariyer: ['console', 'jobs'],
  };
  const P = {};
  let z = 30, store = {}, leftEdge = 310;
  store = kayit.oku(KEY, {}) || {};
  const save = () => {
    const o = {};
    for (const id in P) { const p = P[id]; o[id] = { x:p.x, y:p.y, w:p.w, h:p.h, vis:p.vis, col:p.collapsed }; }
    kayit.yaz(KEY, o);
  };
  const narrow = () => window.innerWidth <= 900;
  const vh = () => window.innerHeight - TOP - BAR;                  // alttaki takım çubuğunun yeri boş kalır

  function place(p) {
    if (narrow()) return;
    const W = window.innerWidth, H = vh();
    p.w = clamp(p.w, 210, W - 8);
    p.x = clamp(p.x, 0, Math.max(0, W - 60));
    p.y = clamp(p.y, 0, Math.max(0, H - 34));
    Object.assign(p.el.style, { left:p.x + 'px', top:p.y + 'px', width:p.w + 'px', height:p.h ? p.h + 'px' : '', maxHeight:(H - p.y - 6) + 'px' });
  }
  function front(p) { p.el.style.zIndex = ++z; }
  function setVis(id, v, noSave) {
    const p = P[id]; if (!p) return;
    p.vis = v; p.el.hidden = !v;
    document.querySelectorAll(`#topbar [data-p="${id}"]`).forEach(c => c.classList.toggle('on', v));
    if (v) { front(p); place(p); }
    if (!noSave) save();
  }
  // gizli: eski paneller (DRO, el çarkları, hareket, iş mili): kumanda paneli hepsinin işini görüyor. İçerikleri sayfada kalır
  // (kod onların düğmelerine ve göstergelerine dokunur) ama görünmez bir kapta durur, panel olarak açılmaz.
  const gizliKap = document.createElement('div'); gizliKap.id = 'gizliPaneller'; gizliKap.hidden = true;
  function build(cfg) {
    let body = document.querySelector(`[data-panel="${cfg.id}"]`);
    if (!body) return;
    if (cfg.gizli) { if (!gizliKap.isConnected) document.body.append(gizliKap); gizliKap.append(body); return; }
    const el = document.createElement('section'); el.className = 'panel'; el.hidden = true;
    el.innerHTML = `<div class="ph"><span class="lamp"></span><b>${cfg.title}</b><span class="pstat"></span>${cfg.sizes ? '<button class="psize" title="Boyut: küçük / orta / büyük" aria-label="Panel boyutu">⤡</button>' : ''}<button class="pcol" title="Küçült" aria-label="Paneli küçült">–</button><button class="pclose" title="Kapat" aria-label="Paneli kapat">×</button></div><div class="pb"></div><div class="grip" title="Boyutlandır"></div>`;
    el.querySelector('.pb').append(body);
    $('panelLayer').append(el);
    // başlıktaki durum yazısı: bölümün başlığındaki ikinci alanı (ör. mil durumu) başlığa taşı
    const h2s = body.querySelector && body.querySelector(':scope > h2 > span:last-child');
    if (h2s && h2s.id) el.querySelector('.pstat').append(h2s);
    const p = P[cfg.id] = { cfg, el, lamp:el.querySelector('.lamp'), x:0, y:0, w:cfg.w, h:0, vis:false, collapsed:false };
    const ph = el.querySelector('.ph');
    el.addEventListener('pointerdown', () => front(p));
    // sürükle
    ph.addEventListener('pointerdown', e => {
      if (e.target.closest('button') || narrow()) return;
      e.preventDefault(); ph.setPointerCapture(e.pointerId);
      const sx = e.clientX - p.x, sy = e.clientY - p.y;
      const mv = ev => { p.x = ev.clientX - sx; p.y = ev.clientY - sy; place(p); };
      const up = () => { ph.removeEventListener('pointermove', mv); ph.removeEventListener('pointerup', up); ph.removeEventListener('pointercancel', up); save(); };
      ph.addEventListener('pointermove', mv); ph.addEventListener('pointerup', up); ph.addEventListener('pointercancel', up);
    });
    ph.addEventListener('dblclick', e => { if (!e.target.closest('button')) toggleCollapse(p); });
    // boyutlandır: içerik pencere genişliğiyle ölçeklenir
    const grip = el.querySelector('.grip');
    grip.addEventListener('pointerdown', e => {
      e.preventDefault(); e.stopPropagation(); grip.setPointerCapture(e.pointerId);
      const sx = e.clientX, sy = e.clientY, w0 = p.w, h0 = el.offsetHeight;
      const mv = ev => { p.w = Math.max(210, w0 + ev.clientX - sx); p.h = Math.max(80, h0 + ev.clientY - sy); place(p); };
      const up = () => { grip.removeEventListener('pointermove', mv); grip.removeEventListener('pointerup', up); grip.removeEventListener('pointercancel', up); save(); };
      grip.addEventListener('pointermove', mv); grip.addEventListener('pointerup', up); grip.addEventListener('pointercancel', up);
    });
    el.querySelector('.pcol').addEventListener('click', () => toggleCollapse(p));
    // boyut düğmesi: sıradaki boy; sağ alt köşe sabit kalır (panel köşeye yaslıysa orada kalsın)
    const ps = el.querySelector('.psize');
    if (ps) ps.addEventListener('click', () => {
      const sz = cfg.sizes, k = sz.findIndex(w => w > p.w + 1), w = k < 0 ? sz[0] : sz[k];
      const r = p.x + p.w, b = p.y + el.offsetHeight;
      p.w = Math.min(w, window.innerWidth - 20); p.h = 0; p.y = 0; place(p);   // önce tepeye: yükseklik sınırı ölçümü kısmasın
      p.x = r - p.w; p.y = b - el.offsetHeight; place(p); save();
    });
    el.querySelector('.pclose').addEventListener('click', () => { if (cfg.id === 'drawing') $('drawing').hidden = true; else setVis(cfg.id, false); });
  }
  function toggleCollapse(p) { p.collapsed = !p.collapsed; p.el.classList.toggle('collapsed', p.collapsed); p.el.querySelector('.pcol').textContent = p.collapsed ? '+' : '–'; save(); }
  // (ölçmeden önce panel tepeye alınır: place eski konuma göre yükseklik sınırı koyar, doğal yükseklik kısılmasın)
  // Görünür panelleri sütunlara diz: sağda mil/DRO/takımlar, solda durum/iş, altta çarklar ve hareket
  function autoLayout() {
    const W = window.innerWidth, H = vh();
    // önce alttaki çark ve hareket panelleri; sütunlar onların üstünde biter
    const wh = P.wheels, jg = P.jog, cs = P.console, low = [];
    let wx = W / 2;
    if (cs && cs.vis) { cs.w = Math.min(cs.cfg.w, W - 40); cs.h = 0; cs.y = 0; place(cs); cs.x = W - cs.w - 10; cs.y = Math.max(10, H - cs.el.offsetHeight - 10); place(cs); wx = cs.x; low.push(cs); }   // sağ alt köşe: tezgâhın ortası açık kalır
    if (wh && wh.vis) { wh.w = Math.min(wh.cfg.w, W - 40); wh.h = 0; wh.y = 0; place(wh); wh.x = cs && cs.vis ? Math.max(10, wx - wh.w - 10) : (W - wh.w) / 2; wh.y = H - wh.el.offsetHeight - 10; place(wh); wx = wh.x; low.push(wh); }
    if (jg && jg.vis) { jg.w = jg.cfg.w; jg.h = 0; jg.y = 0; place(jg); jg.x = Math.max(10, wx - jg.w - 10); jg.y = H - jg.el.offsetHeight - 10; place(jg); low.push(jg); }
    const floor = (x0, x1) => low.reduce((f, q) => (x1 > q.x && x0 < q.x + q.w) ? Math.min(f, q.y - 10) : f, H - 10);
    const cols = { L:{ x:10, y:10, dir:1, wm:0 }, R:{ x:W - 10, y:10, dir:-1, wm:0 } };
    for (const cfg of CFG) {
      const p = P[cfg.id]; if (!p || !p.vis || !['L', 'R'].includes(cfg.col)) continue;
      p.h = 0; p.w = cfg.w; place(p);
      const c = cols[cfg.col], nat = p.el.offsetHeight;
      let x = cfg.col === 'L' ? c.x : c.x - cfg.w, fl = floor(x, x + cfg.w);
      if (c.y + Math.min(nat, 220) > fl && c.y > 10) {
        c.x += c.dir * (c.wm + 10); c.y = 10; c.wm = 0;
        x = cfg.col === 'L' ? c.x : c.x - cfg.w; fl = floor(x, x + cfg.w);
      }
      p.x = x; p.y = c.y; c.wm = Math.max(c.wm, cfg.w);
      if (c.y + nat > fl) p.h = Math.max(120, fl - c.y);
      place(p);
      c.y += p.el.offsetHeight + 10;
    }
    leftEdge = cols.L.x + cols.L.wm + 10;
    for (const id of ['drawing', 'keys']) { const p = P[id]; if (p && p.vis) { p.w = p.cfg.w; p.h = 0; place(p); p.x = id === 'drawing' ? leftEdge : (W - p.w) / 2; p.y = 10; place(p); } }
    save();
  }
  function preset(name) {
    const set = PRESETS[name] || PRESETS.temel;
    for (const id in P) if (id !== 'drawing') setVis(id, set.includes(id), true);
    for (const id in P) { P[id].collapsed = false; P[id].el.classList.remove('collapsed'); P[id].el.querySelector('.pcol').textContent = '–'; }
    autoLayout();
  }
  function init() {
    CFG.forEach(build);
    // üst çubuk: marka, panel düğmeleri, düzenler, kamera, acil stop
    const tb = $('topbar');
    // simgeler, panel düğmeleri, aletler ve açılır menüler
    tb.querySelectorAll('[data-ic]').forEach(el => { const k = el.dataset.ic; el.innerHTML = k === 'logo' ? TBICON.logo : `<svg viewBox="0 0 24 24">${TBICON[k]}</svg>`; });
    const views = document.querySelector('.views'); if (views) views.hidden = true;     // kamera düğmeleri menüden tetiklenir
    const menus = { alet:$('mnAlet'), camera:$('mnCamera'), help:$('mnHelp') };
    const closeMenus = () => { for (const k in menus) menus[k].hidden = true; tb.querySelectorAll('.tbi.open').forEach(q => q.classList.remove('open')); document.body.classList.remove('tbm-acik'); };
    tb.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.menu) {
        const m = menus[b.dataset.menu], was = !m.hidden; closeMenus(); if (was) return;
        m.hidden = false; b.classList.add('open'); document.body.classList.add('tbm-acik');   // açık menünün üstüne bildirim binmesin
        const r = b.getBoundingClientRect(); m.style.left = Math.max(6, Math.min(window.innerWidth - m.offsetWidth - 6, r.left + r.width / 2 - m.offsetWidth / 2)) + 'px';
        return;
      }
      if (b.dataset.p) { if (b.closest('.tb-menu')) closeMenus(); if (P[b.dataset.p]) setVis(b.dataset.p, !P[b.dataset.p].vis); return; }
      if (b.dataset.v) { closeMenus(); const v = $(b.dataset.v); if (v) v.click(); return; }
      const a = b.dataset.act; if (!a) return;
      initAudio(); closeMenus();
      if (a === 'drawing') $('drawing').hidden = !$('drawing').hidden;
      else if (a === 'air') app.AG.setOn(!app.AG.on);
      else if (a === 'fd') app.FD.setOn(!app.FD.on);
      else if (a === 'bench') $('benchOpen').click();
      else if (a === 'editor') app.TE.show(S.tool);
      else if (a === 'shop') app.CR.openShop();
      else if (a === 'egitim') app.EG.baslat();
      else if (a === 'keys') setVis('keys', true);
      else if (a === 'menu') app.MENU.ac('ana');
      else if (a === 'sound') { $('mute').click(); b.innerHTML = `<svg viewBox="0 0 24 24">${TBICON[S.muted ? 'mute' : 'sound']}</svg>`; b.classList.toggle('on', S.muted); }
    });
    document.addEventListener('pointerdown', e => { if (!e.target.closest('.tb-menu') && !e.target.closest('[data-menu]')) closeMenus(); });
    window.addEventListener('keydown', e => { if (e.code === 'Escape') closeMenus(); });
    // kaydedilmiş düzen ya da varsayılan
    const has = Object.keys(store).length > 0;
    for (const id in P) {
      const s = store[id], p = P[id];
      if (s) { Object.assign(p, { x:s.x, y:s.y, w:s.w || p.w, h:s.h || 0, collapsed:!!s.col }); p.el.classList.toggle('collapsed', p.collapsed); p.el.querySelector('.pcol').textContent = p.collapsed ? '+' : '–'; }
      if (id !== 'drawing') setVis(id, has ? !!(s && s.vis) : PRESETS.kumanda.includes(id), true);
    }
    if (!has) requestAnimationFrame(() => autoLayout()); else for (const id in P) if (P[id].vis) place(P[id]);
    // teknik resim paneli, resmin kendi görünürlüğünü izler
    const dw = $('drawing');
    if (dw && P.drawing) {
      const sync = () => { const v = !dw.hidden; P.drawing.vis = v; P.drawing.el.hidden = !v; $('tbDraw').classList.toggle('on', v); if (v) { if (!P.drawing.x && !P.drawing.y) { P.drawing.x = leftEdge; P.drawing.y = 10; } front(P.drawing); place(P.drawing); } };
      new MutationObserver(sync).observe(dw, { attributes:true, attributeFilter:['hidden'] }); sync();
    }
    window.addEventListener('resize', () => { for (const id in P) if (P[id].vis) place(P[id]); });
  }
  function flash(id) { const p = P[id]; if (!p) return; if (!p.vis) setVis(id, true); front(p); p.el.classList.remove('flash'); void p.el.offsetWidth; p.el.classList.add('flash'); }
  function lamp(id, state) { const p = P[id]; if (!p) return; p.lamp.className = 'lamp' + (state ? ' ' + state : ''); }
  function sifirla() { kayit.sil(KEY); preset('kumanda'); }   // Ayarlar → Oyun → Panelleri sıfırla
  return { init, preset, flash, lamp, setVis, sifirla, P };
})();

Object.assign(app, { PM, toolIcon });   // önceki modüllerin geç başvuruları

export { PM, TBICON, toolIcon };
