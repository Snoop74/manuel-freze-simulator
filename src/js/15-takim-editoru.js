// ── Takım editörü (TE): tip, ölçüler, kaplama, fiyat, kesmeye etkiler, kayıt
import { $, S, TOOLS, app, clamp, isDrill, log, mat, recFeed, recRpm } from './00-temel.js';
import { initAudio } from './01-ses.js';
import { HOLDERS, buildToolInto, buildToolVisual, geoOf, holderOf } from './07-takim-gorsel.js';
import { renderRack, requestToolChange, updateRec, updateToolUI } from './09-kumanda.js';

const TKEY = 'freze-tools-v1';
const KIND = {
  end:     { name:'Parmak freze', d:[1, 25], z:[1, 6] },
  ball:    { name:'Küresel freze', d:[1, 20], z:[1, 4] },
  chamfer: { name:'Pah frezesi', d:[4, 20], z:[1, 6], ang:[60, 90, 120] },
  drill:   { name:'Matkap', d:[1, 20], z:[2, 2], ang:[118, 135, 140] },
};
const COATS = { none:'Kaplamasız', tin:'TiN', altin:'AlTiN', dlc:'DLC' };
const num = (v, a, b, def) => Number.isFinite(+v) ? clamp(+v, a, b) : def;
const tipHOf = sp => sp.kind === 'chamfer' ? sp.d / 2 / Math.tan(sp.ang / 2 * Math.PI / 180) : sp.kind === 'ball' ? sp.d / 2 : sp.kind === 'drill' ? sp.d / 2 / Math.tan(sp.ang / 2 * Math.PI / 180) : 0;
// kurallar: çap tipe göre, ağız boyu uç yüksekliğinden kısa olamaz, çıkıntı ağız boyundan en az 5 mm uzun
function fixSpec(sp) {
  if (!KIND[sp.kind]) sp.kind = 'end';
  const K = KIND[sp.kind];
  sp.d = Math.round(num(sp.d, K.d[0], K.d[1], 10) * 10) / 10;
  sp.z = Math.round(num(sp.z, K.z[0], K.z[1], 2));
  if (K.ang) { if (!K.ang.includes(+sp.ang)) sp.ang = K.ang[sp.kind === 'drill' ? 0 : 1]; } else sp.ang = 0;
  sp.flute = Math.round(num(sp.flute, Math.ceil(tipHOf(sp) + 1), sp.kind === 'drill' ? 160 : 80, sp.d * 2));
  sp.stick = Math.round(num(sp.stick, sp.flute + 5, 170, sp.flute + 15));
  sp.corner = sp.kind === 'end' ? Math.round(num(sp.corner, 0, sp.d * 0.3, 0) * 10) / 10 : 0;
  sp.helix = Math.round(sp.kind === 'drill' ? num(sp.helix, 15, 40, 30) : num(sp.helix, 0, 55, 35));
  if (sp.tm !== 'hss') sp.tm = 'carbide';
  if (!COATS[sp.coat]) sp.coat = 'none';
  sp.name = String(sp.name || '').slice(0, 24);
  return sp;
}
function toolPrice(sp) {
  const hss = sp.tm === 'hss';
  let p = sp.kind === 'drill' ? (hss ? 6 + sp.d * 1.6 : 25 + sp.d * 6)
    : (hss ? 0.4 : 1) * (18 + sp.d * 5 + sp.z * 4 + sp.flute * 0.4) * (sp.kind === 'ball' ? 1.2 : sp.kind === 'chamfer' ? 1.1 : 1);
  p *= { none:1, tin:1.15, altin:1.3, dlc:1.45 }[sp.coat];
  if (sp.corner > 0) p *= 1.12;
  if (sp.stick > 4 * sp.d) p *= 1.1;                                // uzun boylu özel takım
  return Math.max(30, Math.round(p * 2) * 5);                       // oyun içi ₺
}
// parametrelerden TOOLS kaydı: önerilen kesme hızı malzeme ve kaplamaya, diş başına ilerleme çapa göre
function toolDef(sp) {
  const hss = sp.tm === 'hss', cf = { none:0.85, tin:0.95, altin:1, dlc:1 }[sp.coat];   // yerleşik takımlar kaplamalı değerlerle
  const T = { no:sp.no, name:sp.name || KIND[sp.kind].name, d:sp.d, type:sp.kind, z:sp.z, flute:sp.flute, stick:sp.stick, len:sp.stick + 50,
    tm:sp.tm, cr:sp.corner, spec:sp, custom:true };
  T.geo = { helix:sp.helix, tip:{ end:'flat', ball:'ball', chamfer:'cone', drill:'cone' }[sp.kind], corner:sp.corner,
    coat:sp.coat === 'none' ? (hss ? 'hss' : 'carbide') : sp.coat };
  if (sp.ang) { T.geo.tipAngle = sp.ang; T.tanTip = Math.tan(sp.ang / 2 * Math.PI / 180); }
  if (sp.kind === 'drill') { T.vc = Math.round((hss ? 74 : 150) * cf); T.fr = +(0.015 * sp.d * (hss ? 1 : 1.2)).toFixed(3); }
  else {
    T.vc = Math.round((hss ? 90 : sp.d <= 6 ? 220 : 250) * cf * (sp.kind === 'chamfer' ? 0.75 : 1));
    T.fz = +((sp.kind === 'ball' ? 0.005 * sp.d : sp.kind === 'chamfer' ? 0.003 * sp.d + 0.01 : 0.004 * sp.d + 0.01) * (hss ? 0.8 : 1)).toFixed(3);
  }
  T.mat = `${hss ? 'HSS' : 'Karbür'}${sp.coat !== 'none' ? ' ' + COATS[sp.coat] : ''}, ${T.z} ağız${T.cr ? `, R${T.cr}` : ''}${sp.ang ? `, ${sp.ang}°` : ''}`;
  T.price = toolPrice(sp);
  return T;
}
// takım parametrelerinin kesmeye etkisi (çarpanlar): aşınma, kırılma direnci, tırlama eğilimi, yüzey pürüzlülüğü
function toolMods(T) {
  const g = geoOf(T), hss = T.tm === 'hss', r = T.d / 2, cr = T.cr || 0;
  const nonFe = !!(mat.nonMetal || S.mat === 'al' || S.mat === 'brass');
  const coatW = { tin:0.8, altin:nonFe ? 0.85 : 0.65, dlc:nonFe ? 0.55 : 1.1 }[g.coat] || 1;
  const H0 = HOLDERS[holderOf(T) || 'er'], hr = k => (1 + H0.ro / 0.01 * k) / (1 + HOLDERS.er.ro / 0.01 * k);
  return {
    wear: coatW * (1 - Math.min(0.35, cr / r)) * hr(0.25),                     // köşe radyüsü kesici köşeyi korur
    tough: (hss ? 1.25 : 1) * (1 + 0.15 * Math.min(1, cr / (0.1 * T.d))),   // HSS kırılmaz, bükülür; karbür gevrek
    chat: T.type === 'face' || isDrill(T) ? 1 : (hss ? 1.25 : 1) * (T.type === 'chamfer' ? 1 : clamp(1 + (35 - g.helix) / 70, 0.75, 1.4)) * H0.damp / HOLDERS.er.damp,   // düşük helis vuruntulu, HSS daha esnek
    ra: (T.type === 'end' ? 1 - Math.min(0.4, cr / r * 0.8) : 1) * hr(0.3),
    load: T.fz ? (1 + H0.ro / T.fz * 0.5) / (1 + HOLDERS.er.ro / T.fz * 0.5) : 1,   // salgı: bir ağız fazla keser
  };
}
TOOLS.forEach(T => { T.tm = /HSS/.test(T.mat) ? 'hss' : 'carbide'; });
const nextToolNo = () => 'T' + (Math.max(...TOOLS.filter(T => !T.gone).map(T => parseInt(String(T.no).slice(1)) || 0)) + 1);
try {
  for (const sp of JSON.parse(localStorage.getItem(TKEY) || '[]')) {
    if (!sp || typeof sp !== 'object') continue;
    if (!/^T\d+$/.test(sp.no) || TOOLS.some(T => T.no === sp.no)) sp.no = nextToolNo();
    TOOLS.push(toolDef(fixSpec(sp))); S.wear.push(0);
  }
} catch (e) {}
function saveTools() {
  try { localStorage.setItem(TKEY, JSON.stringify(TOOLS.filter(T => T.custom && !T.gone).map(T => T.spec))); } catch (e) {}
}
renderRack();

const TE = (() => {
  let r = null, sc, cam, ctl, grp, raf = 0, open = false, sp = null, editIdx = -1, baseNo = '';
  const DEF = { kind:'end', d:10, z:3, flute:22, stick:40, helix:38, corner:0, ang:0, tm:'carbide', coat:'altin', name:'' };
  // yerleşik takımdan editör parametreleri (alın frezesi, kılavuz ve kenar bulucu parmak freze olarak açılır)
  function specOf(T) {
    if (T.spec) return Object.assign({}, T.spec);
    const g = geoOf(T), kind = KIND[T.type] ? T.type : T.type === 'spot' ? 'chamfer' : 'end';
    return fixSpec({ kind, d:T.d, z:T.z, flute:T.flute, stick:T.stick, helix:g.helix, corner:0, ang:T.type === 'spot' ? 90 : 0,
      tm:T.tm, coat:{ tin:'tin', altin:'altin' }[g.coat] || 'none', name:'' });
  }
  function init() {
    const cv = $('teC');
    r = new THREE.WebGLRenderer({ canvas:cv, antialias:true });
    r.setPixelRatio(Math.min(2, window.devicePixelRatio || 1)); r.outputEncoding = THREE.sRGBEncoding;
    r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 0.95;
    sc = new THREE.Scene(); sc.background = new THREE.Color(0x1a1f22);
    if (THREE.RoomEnvironment) { const pm = new THREE.PMREMGenerator(r); sc.environment = pm.fromScene(new THREE.RoomEnvironment(), 0.04).texture; pm.dispose(); }
    sc.add(new THREE.HemisphereLight(0xe8eef5, 0x2a2622, 0.4));
    const l1 = new THREE.DirectionalLight(0xffffff, 0.9); l1.position.set(150, 220, 160); sc.add(l1);
    const l2 = new THREE.DirectionalLight(0x9fc4ff, 0.35); l2.position.set(-200, 60, -120); sc.add(l2);
    cam = new THREE.PerspectiveCamera(30, 1, 1, 3000);
    ctl = new THREE.OrbitControls(cam, cv); ctl.enableDamping = true; ctl.autoRotate = true; ctl.autoRotateSpeed = 1.6;
    cv.addEventListener('pointerdown', () => { ctl.autoRotate = false; });
    grp = new THREE.Group(); sc.add(grp);
    new ResizeObserver(resize).observe(cv.parentElement);
    cam.position.set(1, 0.35, 1);
  }
  function resize() {
    if (!r) return;
    const el = $('teC').parentElement, w = el.clientWidth, h = el.clientHeight;
    if (!w || !h) return;
    r.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix();
  }
  function preview(T) {
    grp.traverse(o => { if (o.geometry) o.geometry.dispose(); });
    while (grp.children.length) grp.remove(grp.children[0]);
    buildToolInto(grp, T, false);
    grp.position.y = T.len / 2;                                     // takım -boy..0 arasında; ortası merkeze
    const dir = cam.position.clone().sub(ctl.target).normalize();
    ctl.target.set(0, -T.len * 0.18, 0); cam.position.copy(dir.multiplyScalar(Math.max(70, T.len) * 2.5)).add(ctl.target);
  }
  function loop() {
    if (!open) return;
    ctl.update(); r.render(sc, cam);
    raf = requestAnimationFrame(loop);
  }
  const rows = { d:'teD', z:'teZ', flute:'teFl', stick:'teSt', helix:'teHx', corner:'teCr' };
  function sync() {
    fixSpec(sp);
    const K = KIND[sp.kind];
    const lim = { d:[K.d[0], K.d[1], sp.kind === 'drill' ? 0.1 : 0.5], z:[K.z[0], K.z[1], 1], flute:[Math.ceil(tipHOf(sp) + 1), sp.kind === 'drill' ? 160 : 80, 1],
      stick:[sp.flute + 5, 170, 1], helix:sp.kind === 'drill' ? [15, 40, 1] : [0, 55, 1], corner:[0, Math.max(0.1, Math.floor(sp.d * 3) / 10), 0.1] };
    for (const k in rows) {
      const el = $(rows[k]); [el.min, el.max, el.step] = lim[k]; el.value = sp[k];
      $(rows[k] + 'v').textContent = k === 'z' ? sp.z : k === 'helix' ? sp.helix + '°' : k === 'corner' ? 'R' + sp.corner.toFixed(1) : sp[k] + ' mm';
    }
    $('teZ').closest('.sec-row').classList.toggle('off', sp.kind === 'drill');
    $('teCr').closest('.sec-row').classList.toggle('off', sp.kind !== 'end');
    $('teAngRow').classList.toggle('off', !K.ang);
    $('teAng').innerHTML = (K.ang || [0]).map(a => `<button class="btn${a === sp.ang ? ' on' : ''}" data-ta="${a}">${a ? a + '°' : '—'}</button>`).join('');
    for (const [box, key] of [['teKind', 'tk'], ['teTm', 'tm'], ['teCoat', 'tc']])
      [...$(box).children].forEach(b => b.classList.toggle('on', b.dataset[key] === { tk:sp.kind, tm:sp.tm, tc:sp.coat }[key]));
    $('teName').placeholder = K.name;
    const T = toolDef(Object.assign({}, sp, { no:editIdx >= 0 ? TOOLS[editIdx].no : nextToolNo() }));
    preview(T); stats(T);
    $('teHint').textContent = `${T.no} · ${T.name} Ø${T.d} · ağız ${T.flute} mm · çıkıntı ${T.stick} mm · takım boyu ${T.len} mm`;
    $('teMode').textContent = editIdx >= 0 ? `${T.no} düzenleniyor` : baseNo ? `${baseNo} temel alındı, yeni takım ${T.no} olacak` : `Yeni takım ${T.no}`;
    $('teDel').hidden = editIdx < 0;
    $('teSave').textContent = editIdx >= 0 ? 'Değişiklikleri kaydet' : 'Dolaba ekle';
  }
  function stats(T) {
    const md = toolMods(T), LD = T.stick / T.d, ch = LD * md.chat;
    const lv = (v, a, b, w) => v < a ? [w[0], ''] : v < b ? [w[1], 'warn'] : [w[2], 'bad'];
    const li = [];
    const add = (k, v, cls = '', note = '') => li.push(`<li class="${cls}"><span>${k}</span> <b>${v}</b>${note ? `<br><span>${note}</span>` : ''}</li>`);
    add(`Önerilen (${mat.short})`, `${recRpm(T)} dev/dk · ${recFeed(T)} mm/dk`, '', T.fr ? `devir başına ${T.fr} mm, kesme hızı ${T.vc} m/dk` : `diş başına ${T.fz} mm, kesme hızı ${T.vc} m/dk`);
    const [cw, cc] = lv(ch, 3.2, 4.6, ['düşük', 'orta', 'yüksek']);
    if (!isDrill(T)) add('Tırlama riski', cw, cc, `çıkıntı/çap ${LD.toFixed(1)}×${md.chat > 1.05 ? ', düşük helis ya da HSS esnekliği artırıyor' : md.chat < 0.95 ? ', yüksek helis yumuşatıyor' : ''}`);
    add('Takım ömrü', `×${(1 / md.wear).toFixed(2)}`, md.wear > 1.02 ? 'warn' : '', md.wear > 1.02 ? 'DLC kaplama çelikte uygun değil' : T.cr ? 'köşe radyüsü kesici köşeyi korur' : '');
    add('Kırılma direnci', `×${md.tough.toFixed(2)}`, '', T.tm === 'hss' ? 'HSS esnek, aşırı yükte daha geç kırılır' : 'karbür sert ama gevrek');
    if (T.type === 'end') add('Yüzey kalitesi', md.ra < 0.99 ? `Ra ×${md.ra.toFixed(2)}` : 'standart', '', md.ra < 0.99 ? 'radyüs taban izini yumuşatır' : '');
    if (!isDrill(T) && T.z >= 4) add('Talaş cebi', 'dar', 'warn', 'alüminyum ve plastikte tam kanalda talaş sıkışır');
    if (isDrill(T) && T.flute < T.stick - 30) add('Delik derinliği', `en çok ${T.flute} mm`, '', 'ağız boyu delme derinliğini sınırlar');
    add('Fiyat', `${T.price.toLocaleString('tr-TR')} ₺`);
    $('teStats').innerHTML = li.join('');
  }
  function fillBase() {
    $('teBase').innerHTML = '<option value="-1">Varsayılan parmak freze</option>' +
      TOOLS.map((T, i) => T.gone ? '' : `<option value="${i}">${T.no} · ${T.name} Ø${T.d}${T.custom ? ' (sizin)' : ''}</option>`).join('');
  }
  function load(i) {
    if (i < 0 || !TOOLS[i]) { sp = Object.assign({}, DEF); editIdx = -1; baseNo = ''; }
    else { sp = specOf(TOOLS[i]); editIdx = TOOLS[i].custom ? i : -1; baseNo = TOOLS[i].custom ? '' : TOOLS[i].no; }
    $('teBase').value = i < 0 || !TOOLS[i] ? -1 : i;
    $('teName').value = sp.name || '';
    sync();
  }
  function show(i) {
    initAudio();
    if (!r) init();
    open = true; $('tedit').hidden = false; resize();
    fillBase(); load(i == null ? -1 : i);
    ctl.autoRotate = true; cancelAnimationFrame(raf); loop();
  }
  function hide() { open = false; $('tedit').hidden = true; cancelAnimationFrame(raf); }
  function commit(mount) {
    let i = editIdx;
    if (i >= 0 && i === S.tool && (S.spindle || S.changing)) { log('Takılı takımı değiştirmek için önce mili durdurun.', 'warn'); return; }
    sp.name = $('teName').value.trim(); fixSpec(sp);
    if (i >= 0) { sp.no = TOOLS[i].no; TOOLS[i] = toolDef(Object.assign({}, sp)); S.wear[i] = 0; app.CR.forget(sp.no); }   // değişen takım yeniden alınır
    else { sp.no = nextToolNo(); TOOLS.push(toolDef(Object.assign({}, sp))); S.wear.push(0); i = TOOLS.length - 1; }
    const T = TOOLS[i];
    saveTools(); renderRack(); updateToolUI();
    if (i === S.tool) { buildToolVisual(); updateRec(); }
    log(`${T.no} ${T.name} Ø${T.d} (${T.mat}) dolaba kaydedildi. Fiyatı ${T.price.toLocaleString('tr-TR')} ₺.`, 'ok');
    fillBase(); load(i);
    if (mount) { hide(); requestToolChange(i); }
  }
  function remove() {
    if (editIdx < 0) return;
    if (editIdx === S.tool) { log('Takılı takım silinemez; önce başka bir takım takın.', 'warn'); return; }
    const T = TOOLS[editIdx]; T.gone = true; app.CR.forget(T.no);                       // dizin yerinde kalır (parçadaki iz kayıtları takım sırasına bağlı)
    saveTools(); renderRack(); updateToolUI();
    log(`${T.no} ${T.name} dolaptan çıkarıldı.`);
    fillBase(); load(-1);
  }
  for (const k in rows) $(rows[k]).addEventListener('input', e => { sp[k] = +e.target.value; sync(); });
  $('teKind').addEventListener('click', e => {
    const b = e.target.closest('[data-tk]'); if (!b || b.dataset.tk === sp.kind) return;
    sp.kind = b.dataset.tk; sp.ang = 0;
    if (sp.kind === 'drill') { sp.coat = sp.tm === 'hss' ? 'tin' : sp.coat; sp.helix = 30; sp.flute = Math.max(sp.flute, Math.round(sp.d * 6)); sp.stick = Math.max(sp.stick, sp.flute + 10); }
    if (sp.kind === 'chamfer') { sp.helix = 0; sp.z = Math.min(sp.z, 4); }
    sync();
  });
  $('teAng').addEventListener('click', e => { const b = e.target.closest('[data-ta]'); if (b) { sp.ang = +b.dataset.ta; sync(); } });
  $('teTm').addEventListener('click', e => { const b = e.target.closest('[data-tm]'); if (b) { sp.tm = b.dataset.tm; sync(); } });
  $('teCoat').addEventListener('click', e => { const b = e.target.closest('[data-tc]'); if (b) { sp.coat = b.dataset.tc; sync(); } });
  $('teName').addEventListener('change', () => { sp.name = $('teName').value.trim(); sync(); });
  $('teBase').addEventListener('change', e => load(+e.target.value));
  $('teSave').addEventListener('click', () => commit(false));
  $('teMount').addEventListener('click', () => commit(true));
  $('teDel').addEventListener('click', remove);
  $('teClose').addEventListener('click', hide);
  $('teOpen').addEventListener('click', () => show(S.tool));
  window.addEventListener('keydown', e => {                       // editör açıkken tezgâh kısayolları çalışmaz
    if (!open) return;
    if (e.code === 'Escape') { e.stopImmediatePropagation(); hide(); }
    else if (!(e.target instanceof Element && e.target.matches('input, select, textarea'))) e.stopImmediatePropagation();
  }, true);
  return { show, hide, specOf };
})();
/* ---------------- Hazır parçalar: şekilli ham parça şablonları ----------------
   Müşteri boş blok yerine şekli olan bir parça getirir: döküm flanş, çarpılmış silindir kapağı, kaynaklı plaka...
   Her şablon rastgele bir çeşit üretir: ölçüler, yükseklik işlevi H(x, y) ve yüzey türü Sf(x, y).
   Yüzey türü (SURF) yalnızca görünüm içindir; işlenen hücre işlenmiş rengine geçer. Parça yükseklik haritası olduğundan
   yukarıdan görülebilen her şekil olur (kademe, göbek, çukur, delik, kabarık dikiş, eğik yüzey); dış hat dışı boştur (H = 0). */
Object.assign(app, { TE, toolMods });   // önceki modüllerin geç başvuruları

export { TE, toolPrice };
