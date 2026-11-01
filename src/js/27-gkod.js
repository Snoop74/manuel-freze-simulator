// ── G-kod (GK): CNC dönüşüm kiti. Program penceresi (renkli yazım, satır ipucu, üstten önizleme), ayrıştırıcı ve yürütücü.
//   Basit alt küme: G0 G1 G90 G91 G81 G83 G80, M3 M5 M8 M9 M0 M30, F S; açıklama ( ) ya da ;. Koordinatlar iş sıfırına göre (DRO).
//   Yürütücü aynı tezgâhı sürer (S.pend, 08-kesme): yanlış program takımı yine kırar. Kariyerde dükkândan alınır, serbestte açık.
import { kayit } from './00-kayit.js';
import { $, PD, PW, RAPID, S, app, log, tool } from './00-temel.js';
import { initAudio, thud } from './01-ses.js';
import { droVals, setFeed, setRpm, spindle, toggleCoolant } from './09-kumanda.js';
import { PM } from './11-paneller.js';

/* ---- Kodlar: satır ipucu ve izin verilenler ---- */
const KOD = {
  G0:'G0 hızlı git, kesmeden: X Y Z', G1:'G1 ilerlemeyle git, keser: X Y Z F (mm/dk)',
  G90:'G90 mutlak: koordinatlar iş sıfırına göre', G91:'G91 artışlı: koordinatlar bulunduğun yere göre',
  G81:'G81 delme döngüsü: X Y delik yeri, Z dip, R yaklaşma yüksekliği, F ilerleme',
  G83:'G83 gagalayarak delme: X Y delik yeri, Z dip, R yaklaşma, Q dalış adımı, F ilerleme',
  G80:'G80 delme döngüsünü bitir', M3:'M3 mili çalıştır: S devir', M5:'M5 mili durdur', M8:'M8 soğutma aç', M9:'M9 soğutma kapat',
  M0:'M0 dur: Devam\'a basınca sürer (takım değiştir, ölç)', M30:'M30 program sonu: mil ve soğutma durur',
};
const SAYI = /^[-+]?(\d+\.?\d*|\.\d+)$/;

/* ---- Ayrıştırıcı: metin → hareket listesi (iş koordinatında, mutlak) ve hatalar. Saf fonksiyon; bas: başlangıç konumu ----
   işlem: { t:'git', x, y, z, hizli, f } · { t:'mil', on, s } · { t:'sogutma', on } · { t:'dur', not } · { t:'son' }; hepsinde satır (0'dan) ve not */
function cozumle(metin, bas = { x:0, y:0, z:50 }) {
  const ops = [], hatalar = [], satirlar = metin.split('\n');
  let mod = 0, mutlak = true, F = 0, Sd = 0, cyc = null, bitti = false;
  const p = { ...bas };
  const hata = (i, m) => hatalar.push({ satir:i, msg:`Satır ${i + 1}: ${m}` });
  const git = (i, x, y, z, hizli, not) => { ops.push({ t:'git', x, y, z, hizli, f:F, satir:i, not }); p.x = x; p.y = y; p.z = z; };
  satirlar.forEach((ham, i) => {
    let s = ham.replace(/\([^)]*\)?/g, ' ').replace(/;.*$/, '').toUpperCase().replace(/[\s,]+/g, '');   // virgül ayırıcı sayılır
    if (!s) return;
    if (bitti) { hata(i, 'M30\'dan sonra satır var; program M30\'da biter.'); return; }
    const w = { G:[], M:[] }, bozuk = [];
    const re = /([A-Z])([^A-Z]*)/g; let m, son = 0;
    while ((m = re.exec(s))) {
      if (m.index !== son) bozuk.push(s.slice(son, m.index));
      son = re.lastIndex;
      const [, L, v] = m;
      if (L === 'O' && /\d$/.test(s.slice(0, m.index))) { const k = s.slice(0, m.index).match(/[A-Z][^A-Z]*$/)[0]; hata(i, `"${k}O" içinde O harfi var: sıfır olmalı (${k}0).`); return; }
      if (!'GMXYZRQFSN'.includes(L)) { hata(i, `"${L}" bu tezgâhta yok. Kullanılabilen harfler: G M X Y Z R Q F S.`); return; }
      if (v === '' && s[re.lastIndex] === 'O') { hata(i, `"${L}O" yazılmış: O harfi değil sıfır olmalı (${L}0).`); return; }
      if (v.startsWith('=')) { hata(i, `"${L}${v}": eşittir gerekmez, ${L}${v.slice(1)} yazın.`); return; }
      if (!SAYI.test(v)) { hata(i, `${L} harfinden sonra sayı gerekli${v ? ` ("${v}" sayı değil)` : ''}.`); return; }
      const n = parseFloat(v);
      if (L === 'G' || L === 'M') w[L].push(n); else if (L !== 'N') { if (L in w) { hata(i, `${L} bir satırda iki kez yazılmış.`); return; } w[L] = n; }
    }
    if (son !== s.length || bozuk.length) { hata(i, `"${s.slice(0, Math.min(6, s.length))}…" anlaşılamadı; satır G, M ya da eksen harfiyle başlamalı.`); return; }
    if (hatalar.length && hatalar[hatalar.length - 1].satir === i) return;
    for (const g of w.G) if (!KOD['G' + g]) { hata(i, `G${g} bu tezgâhta yok. Kullanılabilen: G0 G1 G90 G91 G81 G83 G80.`); return; }
    for (const c of w.M) if (!KOD['M' + c]) { hata(i, `M${c} bu tezgâhta yok. Kullanılabilen: M3 M5 M8 M9 M0 M30.`); return; }
    if ('F' in w) { if (w.F <= 0) { hata(i, 'F (ilerleme) sıfırdan büyük olmalı.'); return; } F = w.F; }
    if ('S' in w) { if (w.S <= 0 || w.S > 6000) { hata(i, 'S (devir) 1 ile 6000 arasında olmalı.'); return; } Sd = w.S; }
    for (const g of w.G) {
      if (g === 90) mutlak = true; else if (g === 91) mutlak = false;
      else if (g === 0 || g === 1) { mod = g; cyc = null; }
      else if (g === 80) { cyc = null; mod = 0; }
      else if (g === 81 || g === 83) { mod = g; cyc = { g, ilk:p.z, z:cyc && cyc.z, r:cyc && cyc.r, q:cyc && cyc.q }; }
    }
    // mil ve soğutma hareketten önce açılır, sonra kapanır
    for (const c of w.M) {
      if (c === 3) ops.push({ t:'mil', on:true, s:Sd, satir:i, not:`mil ${Sd || ''} dev/dk` });
      if (c === 8) ops.push({ t:'sogutma', on:true, satir:i, not:'soğutma açık' });
    }
    const eks = 'X' in w || 'Y' in w || 'Z' in w;
    if (cyc) {
      if ('Z' in w) cyc.z = w.Z; if ('R' in w) cyc.r = w.R; if ('Q' in w) cyc.q = w.Q;
      if ('X' in w || 'Y' in w) {
        if (!mutlak) { hata(i, 'Delme döngüsünde G90 (mutlak) kullanın.'); return; }
        const ad = 'G' + cyc.g;
        if (cyc.z == null || cyc.r == null) { hata(i, `${ad} için Z (dip) ve R (yaklaşma) gerekli.`); return; }
        if (cyc.g === 83 && !(cyc.q > 0)) { hata(i, 'G83 için Q (dalış adımı, mm) gerekli.'); return; }
        if (!(F > 0)) { hata(i, `${ad} için F (ilerleme) gerekli.`); return; }
        if (cyc.z >= cyc.r) { hata(i, `Z (dip ${cyc.z}) R'den (${cyc.r}) aşağıda olmalı.`); return; }
        const x = 'X' in w ? w.X : p.x, y = 'Y' in w ? w.Y : p.y, ust = Math.max(cyc.ilk, cyc.r);
        git(i, x, y, ust, true, 'delik yerine');
        ops[ops.length - 1].delik = true;
        git(i, x, y, cyc.r, true, 'yaklaşma');
        if (cyc.g === 81) git(i, x, y, cyc.z, false, 'deliniyor');
        else {
          const n = Math.ceil((cyc.r - cyc.z) / cyc.q - 1e-9);
          let d = cyc.r;
          for (let k = 1; k <= n; k++) {
            if (k > 1) { git(i, x, y, Math.min(cyc.r, d + 0.5), true, `dalış ${k} / ${n}`); ops[ops.length - 1].dongu = true; }   // açılmış deliğe geri iniş: uyarı yok
            d = Math.max(cyc.z, cyc.r - k * cyc.q);
            git(i, x, y, d, false, `dalış ${k} / ${n}`);
            if (k < n) git(i, x, y, cyc.r, true, `talaş boşaltılıyor (${k} / ${n})`);
          }
        }
        git(i, x, y, ust, true, 'delikten çıkış');
      }
    } else if (eks) {
      const h = a => a in w ? (mutlak ? w[a] : p[a.toLowerCase()] + w[a]) : p[a.toLowerCase()];
      if (mod === 1 && !(F > 0)) { hata(i, 'G1 için F (ilerleme, mm/dk) gerekli: ör. G1 X50 F300.'); return; }
      if (mod !== 0 && mod !== 1) { hata(i, 'Önce hareket kodu yazın: G0 ya da G1.'); return; }
      git(i, h('X'), h('Y'), h('Z'), mod === 0, mod === 0 ? 'hızlı' : `kesme F${F}`);
    }
    for (const c of w.M) {
      if (c === 5) ops.push({ t:'mil', on:false, satir:i, not:'mil durdu' });
      if (c === 9) ops.push({ t:'sogutma', on:false, satir:i, not:'soğutma kapalı' });
      if (c === 0) ops.push({ t:'dur', satir:i, not:(ham.match(/\(([^)]*)\)/) || [])[1] || 'program durdu' });
      if (c === 30) { ops.push({ t:'son', satir:i, not:'program sonu' }); bitti = true; }
    }
  });
  // uyarı: G0 ile malzemeye (Z < 0) dalış; takım hızlıda kesmez, çarpar
  const uyari = [];
  let q = { ...bas };
  for (const o of ops) if (o.t === 'git') { if (o.hizli && !o.dongu && o.z < -0.01 && o.z < q.z && !uyari.some(u => u.satir === o.satir)) uyari.push({ satir:o.satir, msg:`Satır ${o.satir + 1}: G0 (hızlı) ile Z ${o.z}'e iniliyor; parçanın içindeyse takım çarpar. Kesmek için G1 kullanın.` }); q = o; }
  return { ops, hatalar, uyari, satirSayisi:satirlar.length };
}

/* ---- Örnek programlar (standart 150×100×40 ham parça, sıfır sol-ön-üst köşe) ---- */
const ORNEK = {
  delik:['4 delik gagalayarak', `(4 köşe delik, gagalayarak: T7 Ø5 takılı, Z sıfırı üst yüzeyde)
G90 G0 Z20
M3 S2500 M8
G83 X20 Y20 Z-42 R2 Q8 F120
X130 Y20
X130 Y80
X20 Y80
G80
G0 Z50
M5 M9
M30`],
  yuzey:['Yüzey alma', `(Yüzey alma: T1 Ø50, Z sıfırı üst yüzeyde, 1 mm)
G90 G0 Z5
M3 S1500
G0 X-40 Y25
G0 Z-1
G1 X190 F400
G0 Y75
G1 X-40
G0 Z20
M5
M30`],
  cep:['Cep 40×30×5', `(Cep 40x30x5: T3 Ø10, Z sıfırı üst yüzeyde, iki pasoda)
G90 G0 Z5
M3 S4000 M8
G0 X60 Y40
G1 Z-2.5 F80
G1 X90 F300
Y45
X60
Y50
X90
Y55
X60
Y60
X90
G1 Z-5 F80
X60 F300
Y55
X90
Y50
X60
Y45
X90
Y40
X60
G0 Z20
M5 M9
M30`],
  dis:['M6 diş deliği', `(Ortaya M6 diş: T7 Ø5 ile gagalayarak del, sonra kılavuzu elle çek)
G90 G0 Z20
M3 S2500 M8
G83 X75 Y50 Z-42 R2 Q8 F120
G80
G0 Z60
M5 M9
M0 (T11 M6 kılavuzu takın ve elle çekin)
M30`],
};

const GK = (() => {
  const KEY = 'freze-gkod';
  const izin = () => !app.CR.on || app.CR.hasEq('cnc');
  let plan = null, ys = null;                                       // ys: yürütme durumu
  const ed = $('gkMetin'), renk = $('gkRenk');
  ed.value = kayit.oku(KEY, { metin:ORNEK.delik[1] }).metin || '';

  /* -- yazım rengi ve satır işaretleri -- */
  const kac = t => t.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  function boya() {
    const hs = new Set((plan ? plan.hatalar : []).map(h => h.satir)), us = new Set((plan ? plan.uyari : []).map(h => h.satir));
    const akt = ys && ys.op ? ys.op.satir : -1;
    renk.innerHTML = ed.value.split('\n').map((l, i) => {
      const k = kac(l).replace(/(\([^)]*\)?|;.*$)|(?<![A-Z])([GM]\d+(?:\.\d+)?)|([XYZRQFS])(?=[-+.\d])/gi, (m, c, gm, ax) =>
        c ? `<span class="c">${c}</span>` : gm ? `<span class="${gm[0].toUpperCase() === 'G' ? 'g' : 'm'}">${gm}</span>` : `<span class="a">${ax}</span>`);
      return `<span class="gk-l${i === akt ? ' on' : hs.has(i) ? ' er' : us.has(i) ? ' uy' : ''}"><i>${i + 1}</i>${k}</span>`;
    }).join('\n') + '\n';
    renk.scrollTop = ed.scrollTop; renk.scrollLeft = ed.scrollLeft;
  }
  function ipucu() {
    const i = ed.value.slice(0, ed.selectionStart).split('\n').length - 1;
    const h = plan && (plan.hatalar.find(q => q.satir === i) || plan.uyari.find(q => q.satir === i));
    const kod = (ed.value.split('\n')[i] || '').replace(/\([^)]*\)?|;.*$/g, '').toUpperCase().match(/[GM]\d+/g) || [];
    const ac = kod.map(c => KOD[c.replace(/^([GM])0+(\d)/, '$1$2')]).filter(Boolean);
    const ilkHata = plan && (plan.hatalar[0] || plan.uyari[0]);
    $('gkIpucu').innerHTML = (h ? `<span class="er">⚠ ${kac(h.msg)}</span>` : ilkHata ? `<span class="er">⚠ ${kac(ilkHata.msg)}</span>` : '') +
      (ac.length ? `<span>💡 ${kac(ac.join(' · '))}</span>` : '');
  }
  function yenile() {
    const d = droVals();
    plan = cozumle(ed.value, { x:d.x, y:d.y, z:d.z });
    boya(); ipucu(); ciz(); durum();
  }
  let kt = 0;
  ed.addEventListener('input', () => { if (ys) return; clearTimeout(kt); kt = setTimeout(() => kayit.yaz(KEY, { metin:ed.value }), 600); yenile(); });
  ed.addEventListener('scroll', () => { renk.scrollTop = ed.scrollTop; renk.scrollLeft = ed.scrollLeft; });
  ['click', 'keyup'].forEach(ev => ed.addEventListener(ev, ipucu));
  ed.addEventListener('keydown', e => {
    if (e.code === 'Escape') { e.preventDefault(); $('estopBtn').click(); return; }   // yazarken de Esc ACİL STOP
    if (e.key === 'Tab') { e.preventDefault(); document.execCommand('insertText', false, '  '); }
  });
  const sec = $('gkOrnek');
  for (const k in ORNEK) sec.insertAdjacentHTML('beforeend', `<option value="${k}">${ORNEK[k][0]}</option>`);
  sec.addEventListener('change', () => {
    const o = ORNEK[sec.value]; sec.value = ''; if (!o || ys) return;
    if (ed.value.trim() && ed.value !== o[1] && !confirm('Yazdığınız programın yerine örnek yüklensin mi?')) return;
    ed.value = o[1]; kayit.yaz(KEY, { metin:ed.value }); yenile();
  });

  /* -- önizleme: parçanın üstten görünüşü; iş sıfırı (S.zx, S.zy) parçaya göre -- */
  function ciz() {
    const sv = $('gkOniz'), m = 14, W = PW + 2 * m, Hh = PD + 2 * m;
    sv.setAttribute('viewBox', `${-m} ${-m} ${W} ${Hh}`);
    const zx = S.zx, zy = S.zy, X = x => (x + zx).toFixed(2), Y = y => (PD - (y + zy)).toFixed(2);
    const hs = new Set((plan ? plan.hatalar : []).map(h => h.satir)), us = new Set((plan ? plan.uyari : []).map(h => h.satir));
    let s = `<rect x="0" y="0" width="${PW}" height="${PD}" class="gk-parca"/>`;
    s += `<circle cx="${X(0)}" cy="${Y(0)}" r="1.8" class="gk-sifir"/><text x="${(+X(0) + 2.5).toFixed(1)}" y="${(+Y(0) - 2.5).toFixed(1)}" class="gk-sifir-t">0</text>`;
    if (plan) {
      const d = droVals(); let q = { x:d.x, y:d.y, z:d.z }, k = 0;
      const sonOp = ys ? ys.i : -1, r = Math.max(1.2, tool().d / 2);
      for (const o of plan.ops) {
        if (o.t !== 'git') { k++; continue; }
        const c = hs.has(o.satir) || us.has(o.satir) ? 'er' : k < sonOp ? 'ok' : k === sonOp ? 'on' : '';
        if (Math.abs(o.x - q.x) > 1e-6 || Math.abs(o.y - q.y) > 1e-6)
          s += `<line x1="${X(q.x)}" y1="${Y(q.y)}" x2="${X(o.x)}" y2="${Y(o.y)}" class="${o.hizli ? 'gk-hiz' : 'gk-kes'} ${c}"/>`;
        if (o.delik) s += `<circle cx="${X(o.x)}" cy="${Y(o.y)}" r="${r}" class="gk-delik ${c}"/>`;
        q = o; k++;
      }
    }
    sv.innerHTML = s;
  }
  function sure() {                                                 // tahmini süre (dk): yol / hız
    if (!plan) return 0;
    const d = droVals(); let q = { x:d.x, y:d.y, z:d.z }, t = 0;
    for (const o of plan.ops) if (o.t === 'git') { t += Math.hypot(o.x - q.x, o.y - q.y, o.z - q.z) / (o.hizli ? RAPID : o.f || 100); q = o; }
    return t;
  }
  function durum(msg) {
    const mm = t => `${Math.floor(t)}:${String(Math.round((t % 1) * 60)).padStart(2, '0')}`;
    $('gkDurum').textContent = msg || (!izin() ? 'CNC dönüşüm kiti yok: dükkândan alınca program tezgâhta çalışır. Yazıp önizleyebilirsiniz.'
      : plan && plan.hatalar.length ? `${plan.hatalar.length} hata var: düzeltmeden çalışmaz.`
      : plan ? `Hazır · ${plan.ops.filter(o => o.t === 'git').length} hareket · tahmini ${mm(sure())} dk` : '');
    $('gkCalis').textContent = ys && ys.dur === 'bekle' ? '▶ Devam' : ys && ys.dur === 'durdu' ? '▶ Sürdür' : '▶ Çalıştır';
    ed.readOnly = !!ys;
  }

  /* -- yürütücü: her karede (12'deki döngü, motion'dan önce) çağrılır -- */
  function baslat(tek) {
    initAudio();
    if (ys) { if (ys.dur === 'calisiyor') return; ys.tek = tek; ys.dur = 'calisiyor'; ys.bos = 0; durum(`Satır ${ys.op ? ys.op.satir + 1 : 1} sürüyor`); return; }
    if (!izin()) { log('CNC dönüşüm kiti yok: dükkândan alın. Programı yine de yazıp önizleyebilirsiniz.', 'warn'); app.CR.openShop(); return; }
    yenile();
    if (plan.hatalar.length) { log(plan.hatalar[0].msg, 'warn'); return; }
    if (!plan.ops.length) { log('Program boş.', 'warn'); return; }
    if (S.alarm) { log('Önce alarmı sıfırlayın.', 'warn'); return; }
    if (S.changing) return;
    ys = { i:0, op:null, tek, dur:'calisiyor', f0:S.feed, bos:0 };
    log(`Program başladı: ${plan.ops.length} adım. Durdur ya da ACİL STOP her an.`, 'ok');
    thud(160, 0.08, 0.05); durum('Çalışıyor');
  }
  function bitir(msg, tur) {
    if (!ys) return;
    S.gHizli = false; S.pend.x = S.pend.y = S.pend.z = 0;
    setFeed(ys.f0); ys = null;
    if (msg) log(msg, tur || 'ok');
    boya(); ciz(); durum(msg && tur === 'bad' ? msg : null);
  }
  function durdur() { if (ys && ys.dur === 'calisiyor') { ys.dur = 'durdu'; S.gHizli = false; S.pend.x = S.pend.y = S.pend.z = 0; durum(`Durdu: satır ${ys.op ? ys.op.satir + 1 : ''}. Sürdür ya da Sıfırla.`); boya(); } }
  function ilerle() {                                                // sıradaki işleme geç; tek satırda satır bitince durur
    const once = plan.ops[ys.i];
    ys.i++; ys.op = null; ys.bos = 0;
    const sonra = plan.ops[ys.i];
    if (!sonra) { bitir('Program bitti (M30 yok).'); return; }
    if (ys.tek && once && sonra.satir !== once.satir) { ys.dur = 'durdu'; S.gHizli = false; durum(`Satır ${once.satir + 1} bitti · sıradaki satır ${sonra.satir + 1}`); boya(); ciz(); }
  }
  let cizT = 0;
  function update(dt) {
    if (!ys || ys.dur !== 'calisiyor') return;
    if (S.alarm) { bitir(`Program durdu: alarm (satır ${ys.op ? ys.op.satir + 1 : '?'}).`, 'bad'); return; }
    if (S.changing) return;
    const o = plan.ops[ys.i];
    if (!o) { bitir('Program bitti.'); return; }
    if (ys.op !== o) { ys.op = o; boya(); durum(`Satır ${o.satir + 1}: ${o.not}`); }
    if (o.t === 'mil') {
      if (o.on) { if (o.s) setRpm(o.s); spindle(true); if (!S.spindle) { bitir(`Satır ${o.satir + 1}: mil çalışmadı (olay kaydına bakın), program durdu.`, 'bad'); return; } }
      else spindle(false);
      ilerle(); return;
    }
    if (o.t === 'sogutma') { if (S.coolant !== o.on) toggleCoolant(); ilerle(); return; }
    if (o.t === 'dur') { ys.dur = 'bekle'; ilerle(); if (ys) { ys.dur = 'bekle'; durum(`M0: ${o.not}. Hazır olunca Devam.`); } log(`Program bekliyor: ${o.not}.`, 'warn'); return; }
    if (o.t === 'son') { if (S.spindle) spindle(false); if (S.coolant) toggleCoolant(); bitir('Program bitti.'); return; }
    // hareket: düz çizgide, karede hız × dt kadar (eksenler birlikte)
    const d = droVals(), rx = o.x - d.x, ry = o.y - d.y, rz = o.z - d.z, L = Math.hypot(rx, ry, rz);
    if (L < 0.002) { S.gHizli = false; ilerle(); return; }
    S.gHizli = o.hizli;
    const f = o.hizli ? RAPID : Math.max(1, Math.round(o.f * (+$('gkOran').value / 100)));
    if (!o.hizli && S.feed !== f) setFeed(f);
    if (!o.hizli && !S.spindle) { bitir(`Satır ${o.satir + 1}: mil durmuşken kesme hareketi (G1). Önce M3.`, 'bad'); return; }
    const adim = Math.min(L, f / 60 * S.sim * dt * 1.02);
    if (ys.son && Math.hypot(ys.son.x - d.x, ys.son.y - d.y, ys.son.z - d.z) < 1e-4 && (ys.bos += dt) > 0.6) {
      bitir(`Satır ${o.satir + 1}: takım ilerleyemiyor (çarpma, sınır ya da sıkışma); program durdu.`, 'bad'); return;
    }
    if (!ys.son || Math.hypot(ys.son.x - d.x, ys.son.y - d.y, ys.son.z - d.z) >= 1e-4) ys.bos = 0;
    ys.son = d;
    S.pend.x = rx / L * adim; S.pend.y = ry / L * adim; S.pend.z = rz / L * adim;
    if ((cizT += dt) > 0.25) { cizT = 0; ciz(); }
  }

  $('gkCalis').addEventListener('click', () => baslat(false));
  $('gkTek').addEventListener('click', () => baslat(true));
  $('gkDur').addEventListener('click', () => durdur());
  $('gkSifirla').addEventListener('click', () => { if (ys) bitir('Program sıfırlandı.', 'warn'); else yenile(); });
  $('gkOran').addEventListener('input', e => { $('gkOranV').textContent = e.target.value + '%'; });
  // pencere açılınca ve iş sıfırı değişince önizleme tazelenir; kit yoksa üst çubuk simgesi gizli (kariyer)
  let sonImza = '';
  setInterval(() => {
    const b = document.querySelector('[data-p="gkod"]'); if (b) b.hidden = !izin();
    if (!PM.P.gkod || !PM.P.gkod.vis || ys) return;
    const imza = [S.zx, S.zy, S.zn, PW, PD, S.tool, izin()].join();
    if (imza !== sonImza) { sonImza = imza; yenile(); }
  }, 400);
  yenile();
  return { update, baslat, durdur, bitir, cozumle, ORNEK, get calisiyor() { return !!ys; }, get ys() { return ys; }, get plan() { return plan; },
    yukle:t => { if (!ys) { ed.value = t; yenile(); } } };
})();

Object.assign(app, { GK });

export { GK, cozumle };
