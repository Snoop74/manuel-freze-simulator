// ── Temel: yardımcılar, takım ve malzeme tabloları, önerilen devir/ilerleme, makine durumu S, olay kaydı
const $ = id => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const TAU = Math.PI * 2;

/* ---------------- Ham parça (yükseklik haritası) ---------------- */
const C = 0.5;
let PW = 150, PD = 100, PH = 40;       // ham parça ölçüsü (X genişlik, Y derinlik, Z yükseklik); buildStock ile değişir
let NX, NY, H, CUT, INSP, EDGE, SURF;  // SURF: hazır parçanın yüzey türü (0 ham, 1 döküm, 2 taşlanmış, 3 eski işleme, 4 kaynak, 5 tufal)
        // yükseklik haritası, hücreyi kesen takım (indeks + 1), muayene (1 = fazla kesilmiş),
                                        // EDGE: kesilmeyen hücreden takım kenarına en kısa uzaklık (ızgaradan ince duvar ölçüsü için)
// ham parça ölçüsünü değiştirir, yükseklik haritası dizilerini sıfırdan kurar (buildStock çağırır); hücre sayısını döndürür
function allocGrid(w, d, h) {
  PW = w; PD = d; PH = h;
  NX = Math.round(PW / C) + 1; NY = Math.round(PD / C) + 1; const n = NX * NY;
  H = new Float32Array(n).fill(PH); CUT = new Uint8Array(n); INSP = new Uint8Array(n); EDGE = new Float32Array(n).fill(9); SURF = new Uint8Array(n);
  return n;
}
// geç bağlanan başvurular: bir modül, kendisinden SONRA gelen modülün adını app.X diye çağırır; X kendi modülünde kaydolur
const app = {};

/* ---------------- Takım dolabı ---------------- */
// len: mil burnundan uca boy, stick: tutucudan çıkan boy, flute: kesici ağız boyu
const TOOLS = [
  { no:'T1',  name:'Alın frezesi',     d:50,  type:'face',  z:5, flute:6,   stick:40,  len:75,  vc:400, fz:0.12, mat:'Karbür uçlu, 5 ağız' },
  { no:'T2',  name:'Parmak freze',     d:16,  type:'end',   z:3, flute:32,  stick:50,  len:100, vc:250, fz:0.07, mat:'Karbür, 3 ağız' },
  { no:'T3',  name:'Parmak freze',     d:10,  type:'end',   z:3, flute:22,  stick:40,  len:90,  vc:250, fz:0.05, mat:'Karbür, 3 ağız' },
  { no:'T4',  name:'Parmak freze',     d:6,   type:'end',   z:2, flute:13,  stick:30,  len:80,  vc:220, fz:0.035,mat:'Karbür, 2 ağız' },
  { no:'T5',  name:'Küresel freze',    d:8,   type:'ball',  z:2, flute:16,  stick:35,  len:85,  vc:220, fz:0.04, mat:'Karbür, 2 ağız' },
  { no:'T6',  name:'Punta matkabı 90°',d:10,  type:'spot',  z:2, flute:8,   stick:30,  len:80,  vc:60,  fr:0.05, mat:'HSS' },
  { no:'T7',  name:'Matkap',           d:5,   type:'drill', z:2, flute:52,  stick:60,  len:115, vc:70,  fr:0.08, mat:'HSS, 118°' },
  { no:'T8',  name:'Matkap',           d:8.5, type:'drill', z:2, flute:75,  stick:85,  len:135, vc:70,  fr:0.13, mat:'HSS, 118°' },
  { no:'T9',  name:'Matkap',           d:12,  type:'drill', z:2, flute:100, stick:110, len:160, vc:70,  fr:0.18, mat:'HSS, 118°' },
  { no:'T10', name:'Kenar bulucu',     d:10,  type:'edge',  z:1, flute:10,  stick:50,  len:95,  rpm:1000, mat:'Ø10 uç' },
  { no:'T11', name:'Kılavuz M6',      d:6,   type:'tap',   z:3, flute:14,  stick:45,  len:105, vc:10,  rpm:250, p:1.0, drill:5,   mat:'HSS, makine kılavuzu' },
  { no:'T12', name:'Kılavuz M10',     d:10,  type:'tap',   z:3, flute:20,  stick:55,  len:120, vc:12,  rpm:180, p:1.5, drill:8.5, mat:'HSS, makine kılavuzu' },
  { no:'3M',  name:'Mekanik 3B taster', d:4,   type:'dial',  z:1, flute:26,  stick:104, len:150, vc:0, fz:0, fr:0, mat:'Kadranlı, Ø4 bilye' },
  { no:'3B',  name:'3B taster',        d:4,   type:'probe', z:1, flute:30,  stick:58,  len:108, vc:0, fz:0, fr:0, mat:'Ø4 yakut bilye, LED' },
];
const isDrill = T => T.type === 'drill' || T.type === 'spot';
const isProbe = T => T.type === 'probe';
const isTaster = T => T.type === 'probe' || T.type === 'dial';
const TAN59 = Math.tan(59 * Math.PI / 180);
/* ---- Malzemeler (tornayla aynı tablo) ----
   kc N/mm² · vcf: önerilen hız çarpanı · ff: önerilen ilerleme çarpanı · rho g/cm³ · c J/gK
   breakF: talaşın kırılmaya başladığı devir başına ilerleme (matkapta) · chip: talaş karakteri */
const MATS = {
  al:    { name:'Al 6061 alüminyum', short:'Al 6061', kc:700, vcf:1.00, ff:1.0, rho:2.70, c:0.90, chip:'curl', breakF:0.12, bue:true, wearK:0.6,
           raw:[0.50,0.52,0.54], cut:[0.80,0.82,0.85], chipCol:[0.85,0.87,0.90] },
  s235:  { name:'S235 yapı çeliği (St37)', short:'S235 çelik', kc:1500, vcf:0.75, ff:0.9, rho:7.85, c:0.47, chip:'curl', breakF:0.18, bue:true, wearK:1.2, tint:true,
           raw:[0.22,0.23,0.25], cut:[0.74,0.75,0.78], chipCol:[0.58,0.58,0.62] },
  c45:   { name:'C45 ıslah çeliği', short:'C45 çelik', kc:1900, vcf:0.60, ff:0.8, rho:7.85, c:0.47, chip:'curl', breakF:0.15, bue:true, wearK:1.6, tint:true,
           raw:[0.30,0.31,0.33], cut:[0.74,0.76,0.79], chipCol:[0.55,0.56,0.60] },
  ss304: { name:'304 paslanmaz çelik', short:'304 paslanmaz', kc:2400, vcf:0.45, ff:0.7, rho:8.0, c:0.50, chip:'string', breakF:0.22, bue:true, wearK:2.4, tint:true,
           raw:[0.55,0.56,0.57], cut:[0.78,0.79,0.81], chipCol:[0.76,0.77,0.79] },
  brass: { name:'CuZn39Pb3 pirinç', short:'Pirinç', kc:780, vcf:0.90, ff:1.1, rho:8.5, c:0.38, chip:'flake', breakF:0, bue:false, wearK:0.5,
           raw:[0.62,0.48,0.24], cut:[0.90,0.76,0.44], chipCol:[0.92,0.76,0.40] },
  gg25:  { name:'GG25 gri döküm', short:'GG25 döküm', kc:1100, vcf:0.55, ff:1.0, rho:7.2, c:0.46, chip:'dust', breakF:0, bue:false, wearK:1.4, dry:true,
           raw:[0.26,0.26,0.27], cut:[0.54,0.55,0.56], chipCol:[0.35,0.35,0.36] },
  pom:   { name:'Delrin (POM) plastik', short:'Delrin', kc:150, vcf:1.00, ff:1.2, rho:1.41, c:1.47, chip:'ribbon', breakF:1, bue:false, wearK:0.2, melt:true, nonMetal:true,
           raw:[0.90,0.89,0.85], cut:[0.95,0.94,0.91], chipCol:[0.97,0.96,0.93] },
  pa6:   { name:'PA6 polyamid (naylon)', short:'PA6 naylon', kc:120, vcf:0.90, ff:1.1, rho:1.14, c:1.70, chip:'gum', breakF:9, bue:false, wearK:0.15, melt:true, nonMetal:true,
           raw:[0.92,0.90,0.82], cut:[0.95,0.94,0.88], chipCol:[0.95,0.93,0.85] },
};
let mat = MATS.al;
const setMat = m => { mat = m; };
// köşe renkleri doğrusal uzayda okunur; tablodaki sRGB değerleri çevrilir
const toLin = c => c.map(v => v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
for (const k in MATS) { MATS[k].rawL = toLin(MATS[k].raw); MATS[k].cutL = toLin(MATS[k].cut); }
const P_MAX = 2.2;                       // mil motoru (kW), 1000 dev/dk altında sabit tork
function recRpm(T) {
  if (T.rpm) return T.rpm;
  return Math.min(4200, Math.round(T.vc * mat.vcf * 1000 / (Math.PI * T.d) / 10) * 10);
}
function recFeed(T) {
  const n = recRpm(T);
  if (T.type === 'edge') return 100;
  if (T.type === 'tap') return Math.round(T.p * n);
  if (isDrill(T)) return Math.round(T.fr * mat.ff * n / 5) * 5;
  return Math.min(1600, Math.round(T.fz * mat.ff * T.z * n / 5) * 5);
}

/* ---------------- Durum ---------------- */
const RAPID = 3000;
const LIM = { x0:-140, x1:290, y0:-70, y1:170, n0:-30, n1:330 };
const S = {
  px:-40, py:50, nose:0, tool:2, spindle:false, rpm:2000, feed:300, step:1, sim:1,
  coolant:false, alarm:false, broken:false, rapidKey:false, rapidBtn:false,
  zx:0, zy:0, zn:0, pend:{x:0,y:0,z:0}, removed:0, cutTime:0, changing:null,
  peck:{active:false, top:0}, cutting:0, muted:false, spotHint:false,
  wheel:{x:0,y:0,z:0}, wheelMul:0.01, feedNow:0, curFeed:0,
  win:{vol:0,h:0,v:0,ap:0,idle:0}, lastChip:0, lastStress:0, lastCut:0, lastMove:0, damage:0,
  mat:'al', dir:1, autoX:0, lastAuto:1, tap:null, wear:TOOLS.map(() => 0), temp:0, heatCap:600, power:0, rpmEff:2000, chatNow:0, lastRa:null, lastVc:0, chipForm:null, chipT:0
};
S.nose = 70 + TOOLS[S.tool].len;
S.zn = PH + TOOLS[S.tool].len;
const tool = () => TOOLS[S.tool];
const tipZ = () => S.nose - tool().len;
function unslip(T) { if (T.slipped) { T.len -= T.slipped; T.stick -= T.slipped; T.slipped = 0; } }
const rapid = () => S.rapidKey || S.rapidBtn;

/* ---------------- Mesaj / kayıt ---------------- */
const logEl = $('log'), toastEl = $('toast');
let toastTimer = 0;
const lastWarn = {};
function log(msg, lvl = '') {
  const li = document.createElement('li');
  if (lvl) li.className = lvl;
  const t = new Date();
  li.innerHTML = `<time>${String(t.getHours()).padStart(2,'0')}:${String(t.getMinutes()).padStart(2,'0')}:${String(t.getSeconds()).padStart(2,'0')}</time>`;
  li.append(document.createTextNode(msg));
  logEl.prepend(li);
  while (logEl.children.length > 7) logEl.lastChild.remove();
  toastEl.textContent = msg;
  toastEl.className = 'toast show ' + lvl;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.className = 'toast ' + lvl, 3200);
}
function warnOnce(key, msg, lvl = 'warn', gap = 3000) {
  const now = performance.now();
  if (lastWarn[key] && now - lastWarn[key] < gap) return;
  lastWarn[key] = now;
  log(msg, lvl);
  if (S.job && !S.job.done && key in S.job.stats) S.job.stats[key]++;
}

/* ---------------- Ses ----------------
   Saf ton yerine süzülmüş gürültü: motor uğultusu, dişli vınlaması, kesme hışırtısı, tırlama ötmesi.
   Tek seferlik sesler (kırılma, kavrama) metalin uyumsuz kısmi tonlarıyla çalınır;
   hepsi küçük bir atölye yankısından geçer. */

export { $, C, CUT, EDGE, H, INSP, LIM, MATS, NX, NY, PD, PH, PW, P_MAX, RAPID, S, SURF, TAN59, TAU, TOOLS,
  allocGrid, app, clamp, isDrill, isProbe, isTaster, lastWarn, log, mat, rapid, recFeed, recRpm, setMat, tipZ,
  tool, unslip, warnOnce };
