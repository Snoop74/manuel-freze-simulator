// Duman testi: sayfayı başsız (headless) Edge/Chrome'da açar ve oyunun temel akışlarını kodla sürer.
// Ek paket yok: statik sunucu node:http, tarayıcı Chrome DevTools protokolüyle (Node'un yerleşik WebSocket'i) sürülür.
// Kullanım: npm test (önce derler) ya da node tools/duman.mjs [senaryo adı...]. Bir senaryo düşerse çıkış kodu 1.
import { execSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { extname, join, normalize, resolve } from 'node:path';

const KOK = resolve(import.meta.dirname, '..');
const TUR = { '.html':'text/html; charset=utf-8', '.js':'text/javascript', '.mjs':'text/javascript', '.css':'text/css', '.json':'application/json',
  '.png':'image/png', '.jpg':'image/jpeg', '.webp':'image/webp', '.hdr':'application/octet-stream', '.exr':'application/octet-stream',
  '.glb':'model/gltf-binary', '.woff2':'font/woff2', '.svg':'image/svg+xml' };
const TARAYICI = [process.env.DUMAN_TARAYICI, 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome', '/usr/bin/chromium', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].filter(Boolean);
const bekle = ms => new Promise(r => setTimeout(r, ms));

// ---- statik sunucu (file:// modüllerde çalışmaz) ----
function sunucu() {
  const s = createServer((q, r) => {
    const yol = normalize(join(KOK, decodeURIComponent(q.url.split('?')[0])));
    if (!yol.startsWith(KOK) || !existsSync(yol)) { r.writeHead(404); r.end(); return; }
    try { r.writeHead(200, { 'Content-Type':TUR[extname(yol)] || 'application/octet-stream', 'Cache-Control':'no-store' }); r.end(readFileSync(yol)); }
    catch { r.writeHead(404); r.end(); }
  });
  return new Promise(ok => s.listen(0, '127.0.0.1', () => ok(s)));
}

// ---- aynı anda tek tarayıcı: kilit, artık süreç temizliği ----
// 2026-11-05: üç ekonomi ajanı paralel çalışınca bilgisayar dondu. Sebep: her çalıştırma sahneyi işlemciyle (SwiftShader) 60 kare çizen
// bir Edge açıyordu, zaman aşımında Node ölünce Edge kapanmayıp arkada çizmeye devam ediyordu, sahipsiz tarayıcılar birikti.
// Artık: makine çapında kilit (sırayla), açılışta artık freze-duman tarayıcıları öldürülür, çıkışta süreç ağacı kapatılır, çizim kısılır.
const KILIT = join(tmpdir(), 'freze-duman.kilit');
const yasiyor = pid => { try { process.kill(pid, 0); return true; } catch { return false; } };
async function kilitAl() {
  for (let i = 0; ; i++) {
    try { mkdirSync(KILIT); writeFileSync(join(KILIT, 'pid'), String(process.pid)); break; }
    catch {
      let pid = 0; try { pid = +readFileSync(join(KILIT, 'pid'), 'utf8'); } catch {}
      if (!pid || !yasiyor(pid)) { try { rmSync(KILIT, { recursive:true, force:true }); } catch {} continue; }   // sahibi ölmüş kilit
      if (i === 0) console.log(`Başka bir duman/ekonomi çalıştırması sürüyor (pid ${pid}); sıra bekleniyor…`);
      await bekle(2000);
    }
  }
  process.on('exit', () => { try { if (+readFileSync(join(KILIT, 'pid'), 'utf8') === process.pid) rmSync(KILIT, { recursive:true, force:true }); } catch {} });
}
function artiklariTemizle() {                                     // önceki çalıştırmalardan kalmış freze-duman tarayıcıları (kilit bizdeyken başka sahibi olamaz)
  if (process.platform !== 'win32') { try { execSync("pkill -f freze-duman-", { stdio:'ignore' }); } catch {} return; }
  try { execSync(`powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*freze-duman-*' -and $_.ProcessId -ne ${process.pid} } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"`, { stdio:'ignore' }); } catch {}
}
const agacKapat = pid => {
  try { if (process.platform === 'win32') execSync(`taskkill /PID ${pid} /T /F`, { stdio:'ignore' }); else process.kill(-pid, 'SIGKILL'); } catch {}
};
for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(sig, () => process.exit(130));   // zaman aşımında da 'exit' çalışsın

// ---- tarayıcı ve en küçük CDP istemcisi ----
// fps: sayfanın çizim döngüsü (requestAnimationFrame) bu hıza kısılır; yazılım çizimi işlemciyi doldurmasın
async function tarayici({ fps = 10 } = {}) {
  const exe = TARAYICI.find(p => existsSync(p));
  if (!exe) throw new Error('Edge ya da Chrome bulunamadı (DUMAN_TARAYICI ile yol verilebilir).');
  await kilitAl(); artiklariTemizle();
  const prof = mkdtempSync(join(tmpdir(), 'freze-duman-'));
  // CDP boru hattından (fd 3 yaz, fd 4 oku, iletiler \0 ile ayrılır): Node nasıl ölürse ölsün boru kopar, tarayıcı kendisi kapanır
  const p = spawn(exe, ['--headless=new', '--remote-debugging-pipe', `--user-data-dir=${prof}`, '--no-first-run', '--no-default-browser-check',
    '--window-size=1280,800', '--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--mute-audio', '--autoplay-policy=no-user-gesture-required',
    '--disable-extensions', '--disable-background-networking', '--renderer-process-limit=2', '--js-flags=--max-old-space-size=1024', 'about:blank'],
    { stdio:['ignore', 'ignore', 'ignore', 'pipe', 'pipe'], detached:process.platform !== 'win32' });
  process.on('exit', () => agacKapat(p.pid));
  const yaz = p.stdio[3], oku = p.stdio[4];
  let sira = 0, artik = '', oturum = null; const bekleyen = new Map(), dinle = [];
  oku.on('data', b => {
    artik += b.toString('utf8');
    let i; while ((i = artik.indexOf('\0')) >= 0) {
      const m = JSON.parse(artik.slice(0, i)); artik = artik.slice(i + 1);
      if (m.id && bekleyen.has(m.id)) { const [ok, no] = bekleyen.get(m.id); bekleyen.delete(m.id); m.error ? no(new Error(m.error.message)) : ok(m.result); }
      else if (m.method && (!oturum || m.sessionId === oturum)) dinle.forEach(f => f(m.method, m.params));
    }
  });
  const ham = (method, params = {}, sessionId) => new Promise((ok, no) => {
    const id = ++sira; bekleyen.set(id, [ok, no]);
    yaz.write(JSON.stringify(sessionId ? { id, method, params, sessionId } : { id, method, params }) + '\0');
  });
  // sayfa hedefine bağlan (tarayıcı düzeyindeki boruda komutlar oturumla gider)
  let hedef = null;
  for (let i = 0; i < 100 && !hedef; i++) { try { hedef = (await ham('Target.getTargets')).targetInfos.find(t => t.type === 'page'); } catch {} if (!hedef) await bekle(100); }
  if (!hedef) { agacKapat(p.pid); throw new Error('Tarayıcı sayfası açılmadı.'); }
  oturum = (await ham('Target.attachToTarget', { targetId:hedef.targetId, flatten:true })).sessionId;
  const gonder = (method, params = {}) => ham(method, params, oturum);
  await gonder('Page.addScriptToEvaluateOnNewDocument', { source:`(() => { const r = window.requestAnimationFrame.bind(window), ms = 1000 / ${fps};
    window.requestAnimationFrame = cb => setTimeout(() => r(cb), ms); })();` });
  const kapat = async () => { try { yaz.end(); } catch {} agacKapat(p.pid); await bekle(300); try { rmSync(prof, { recursive:true, force:true }); } catch {} };
  return { gonder, dinle, kapat };
}

// ---- sayfa içinde ortak yardımcılar: modüller, hareket sürme, takım değiştirme ----
const YARDIMCI = async () => {
  const T = await import('/src/js/00-temel.js'), K = await import('/src/js/08-kesme.js'), U = await import('/src/js/09-kumanda.js'), B = await import('/src/js/05-baglama.js');
  const { S, TOOLS, PW, PD, PH, app } = T, dt = 1 / 60;
  const tip = () => S.nose - TOOLS[S.tool].len;
  const sur = n => { for (let i = 0; i < n; i++) { K.motion(dt); app.MG.update(dt); } };
  // bir ekseni d mm sür (ilerleme hızıyla); kalan yol döner (0 değilse hareket engellendi)
  const git = (ax, d, sinir = 60000) => {
    S.pend[ax] = d;
    for (let i = 0; i < sinir && Math.abs(S.pend[ax]) > 1e-6 && !S.alarm; i++) K.motion(dt);
    const k = S.pend[ax]; S.pend[ax] = 0; return k;
  };
  const ucGit = z => git('z', z - tip());                           // takım ucunu parça Z'sine indir/kaldır
  const konum = (x, y) => { ucGit(PH + 5); git('x', x - S.px); git('y', y - S.py); };
  const takim = f => {
    const i = TOOLS.findIndex(f); if (i < 0) throw new Error('takım yok');
    U.spindle(false); if (S.alarm) document.getElementById('alarmReset').click();
    if (i !== S.tool || S.broken) U.requestToolChange(i);
    for (let k = 0; k < 3000 && S.changing; k++) K.motion(dt);
    return TOOLS[i];
  };
  const yeni = () => { U.spindle(false); if (S.alarm) document.getElementById('alarmReset').click(); U.resetPart(); B.setKay(0); };
  const son = () => [...document.querySelectorAll('#log > *')].slice(0, 3).map(e => e.textContent.replace(/^\d\d:\d\d:\d\d/, '')).join(' | ');
  const minH = () => { let m = Infinity; for (const v of T.H) if (v < m) m = v; return m; };
  const { camera } = await import('/src/js/02-sahne-tezgah.js');
  window.__d = { T, K, U, B, S, TOOLS, PW, PD, PH, app, tip, sur, git, ucGit, konum, takim, yeni, son, minH, camera };
};

// ---- senaryolar: her biri sayfada çalışır; hata fırlatırsa düşer, dönen metin rapora yazılır ----
const SENARYO = {
  async yukleme() {
    const { app } = window.__d;
    for (const k of ['MG', 'CR', 'MENU', 'TC', 'IA']) if (!app[k]) throw new Error(`app.${k} yok`);
    app.MENU.kapat();
    // performans: talaşsız sahnede çizilen üçgen (boş talaş havuzu eskiden ~800 bin üçgen çiziyordu)
    const { renderer, scene, camera } = await import('/src/js/02-sahne-tezgah.js');
    renderer.render(scene, camera);
    const tri = renderer.info.render.triangles;
    if (tri > 700000) throw new Error(`sahne çok ağır: ${tri} üçgen (sınır 700 bin)`);
    return `modüller yüklendi, sahne ${Math.round(tri / 1000)} bin üçgen`;
  },
  async mengene() {
    const { S, B, U, app, yeni, sur, son } = window.__d;
    yeni();
    app.MG.git(99); sur(60);
    if (S.mAcik < 10) throw new Error(`mengene açılmadı (${S.mAcik}): ${son()}`);
    if (app.FIXTURES[0].b[3] > -10) throw new Error('ön çene çarpışma kutusu kaymadı');
    U.spindle(true); if (S.spindle) throw new Error('açık mengenede mil çalıştı');
    const px = S.px; B.setKay(20);
    if (Math.abs(S.px - (px - 20)) > 1e-6) throw new Error('KAY makine konumunu tutmadı');
    app.MG.git(0); sur(60);
    if (S.mAcik !== 0 || app.FIXTURES[0].b[3] !== 0) throw new Error(`mengene sıkılmadı (${S.mAcik}, ön çene ${app.FIXTURES[0].b[3]})`);
    if (app.FIXTURES[0].b[0] !== -55) throw new Error(`çene kutusu KAY ile kaymadı (${app.FIXTURES[0].b[0]})`);
    U.spindle(true); if (!S.spindle) throw new Error(`sıkılı mengenede mil çalışmadı: ${son()}`);
    app.MG.git(99); sur(5); if (S.mAcik > 0) throw new Error('mil dönerken mengene açıldı');
    U.spindle(false); app.MG.git(99); sur(60); yeni();
    if (S.mAcik !== 0) throw new Error('yeni parça açık mengeneyle geldi');
    return 'aç, kaydır, sık; mil kilidi';
  },
  async yuzey() {
    const { S, U, PW, PH, takim, yeni, konum, ucGit, git, minH, son } = window.__d;
    yeni(); const T = takim(t => t.type === 'end' && t.d === 10);
    U.setRpm(4000); U.setFeed(400); konum(-10, 20); U.spindle(true);
    ucGit(PH - 0.5); git('x', PW + 20);
    U.spindle(false);
    if (S.broken || S.alarm) throw new Error(`yüzey almada kırıldı: ${son()}`);
    if (minH() > PH - 0.4) throw new Error(`talaş kalkmadı (en düşük ${minH().toFixed(2)})`);
    { const { scene } = await import('/src/js/02-sahne-tezgah.js'); let n = 0; scene.traverse(o => { if (o.isInstancedMesh && o.visible) n += o.count; }); if (!n) throw new Error('kesince talaş görünmüyor'); }
    return `${T.no} Ø10, 0.5 mm paso, zorlanma %${Math.round(S.damage * 100)}`;
  },
  async gagalama() {
    const { S, U, PH, takim, yeni, konum, ucGit, son } = window.__d;
    yeni(); takim(t => t.type === 'drill' && t.d === 5);
    U.setRpm(1800); U.setFeed(120); konum(40, 40); U.spindle(true);
    ucGit(PH - 30);
    if (!S.broken) throw new Error(`tek dalışta 30 mm delen Ø5 kırılmadı: ${son()}`);
    yeni(); takim(t => t.type === 'drill' && t.d === 5);
    U.setRpm(1800); U.setFeed(120); konum(40, 40); U.spindle(true);
    for (const z of [PH - 15, PH - 30, -4]) { ucGit(z); if (S.broken) break; ucGit(PH + 3); }
    U.spindle(false);
    if (S.broken) throw new Error(`gagalayarak delen matkap kırıldı: ${son()}`);
    return 'tek dalış kırılır, gagalama boydan boya deler';
  },
  async kilavuz() {
    const { S, B, U, PH, takim, konum, ucGit, git, sur, son } = window.__d;   // gagalama senaryosunun deliğine (40, 40)
    const T = takim(t => t.type === 'tap' && t.d === 6);
    U.setRpm(T.rpm); konum(40, 40); S.dir = 1; U.spindle(true);
    ucGit(PH + 0.5);
    for (let i = 0; i < 400 && !S.tap && !S.alarm; i++) { S.pend.z = -0.2; sur(1); }
    if (!S.tap) {
      const { H, C, NX } = window.__d.T, j = Math.round(40 / C), sat = [];
      for (let i = Math.round(35 / C); i <= Math.round(45 / C); i++) sat.push(H[j * NX + i].toFixed(1));
      throw new Error(`kılavuz kavramadı: ${son()} · C=${C} satır ${sat.join(' ')} · px ${S.px.toFixed(2)} py ${S.py.toFixed(2)}`);
    }
    for (let i = 0; i < 20000 && S.tap && !S.alarm && window.__d.tip() > -3; i++) sur(1);
    S.dir = -1;
    for (let i = 0; i < 20000 && S.tap && !S.alarm; i++) sur(1);
    U.spindle(false); S.dir = 1;
    if (S.broken || S.alarm) throw new Error(`kılavuz kırıldı: ${son()}`);
    if (!B.threads.length) throw new Error('diş oluşmadı');
    if (Math.abs(git('x', 5)) > 1e-6) throw new Error('kılavuzdan sonra tabla hareket etmiyor');
    return `M6 boydan boya, ${B.threads.length} diş yüzeyi`;
  },
  async egitim() {
    // adımlar ada göre sürülür (sıra değişse de test bozulmaz); her ad için oyuncunun yapacağı iş
    const { S, U, K, T, app, takim, git, ucGit, sur, son, camera } = window.__d;
    const bekle = ms => new Promise(r => setTimeout(r, ms)), EG = app.EG, d = () => U.droVals();
    const { controls } = await import('/src/js/02-sahne-tezgah.js');
    const tik = q => document.querySelector(q).click();
    const tuslar = k => k.forEach(t => tik(`#cpKeys [data-k="${t}"]`));
    const PH = () => T.PH, kare = n => { for (let k = 0; k < n; k++) { app.EG.kare(); K.motion(1 / 60); app.MG.update(1 / 60); } };
    const kadar = (sart, n = 60000) => { for (let k = 0; k < n && !sart(); k++) K.motion(1 / 60); };
    const merkez = () => T.H[Math.round(45 / T.C) * T.NX + Math.round(75 / T.C)];
    const IS = {
      merhaba:() => tik('#egIleri'), acil:() => tik('#egIleri'), ekran:() => tik('#egIleri'),
      don:() => { const v = camera.position.clone().sub(controls.target); v.applyAxisAngle(new THREE.Vector3(0, 1, 0), 0.8); camera.position.copy(controls.target).add(v); },
      yaklas:() => { const v = camera.position.clone().sub(controls.target).multiplyScalar(0.6); camera.position.copy(controls.target).add(v); },
      kaydir:() => { controls.target.x += 120; camera.position.x += 120; },
      mengeneAc:() => { app.MG.git(99); kare(60); }, mengeneSik:() => { app.MG.git(0); kare(60); },
      tepsi:() => app.TC.ac(), t1:() => takim(t => t.no === 'T1'),
      start:() => U.spindle(true), start2:() => U.spindle(true), start3:() => U.spindle(true), start4:() => U.spindle(true),
      cark:() => { U.wheelTicks('x', 15); kare(120); },
      tusX:() => tuslar(['x']), tus30:() => tuslar(['3', '0']), tusY:() => tuslar(['y', '2', '0']),
      git:() => { tuslar(['git']); kadar(() => Math.abs(d().x - 30) < 0.01 && Math.abs(d().y - 20) < 0.01); },
      hizliAc:() => tik('#cpRapid'), zin:() => ucGit(PH() + 15), hizliKapa:() => tik('#cpRapid'),
      deg:() => ucGit(PH()), z0:() => tik('#cpSoft [data-sk="2"]'),
      sola:() => { tuslar(['x', '4', '0', '±', 'git']); kadar(() => d().x < -39.99); },
      paso:() => { tuslar(['z', '1', '±', 'git']); kadar(() => Math.abs(d().z + 1) < 0.01); },
      sag:() => { U.setAuto(1); kadar(() => d().x > T.PW + 26); },
      y75:() => { tuslar(['y', '6', '5', 'git']); kadar(() => Math.abs(d().y - 65) < 0.01); },
      solaGel:() => { U.setAuto(-1); kadar(() => d().x < -26); },
      stop1:() => U.spindle(false), stop2:() => U.spindle(false), stop3:() => U.spindle(false),
      t6:() => takim(t => t.no === 'T6'), t7:() => takim(t => t.no === 'T7'), t11:() => takim(t => t.no === 'T11'),
      merkez:() => { tuslar(['x', '7', '5', 'y', '4', '5', 'git']); kadar(() => Math.abs(d().x - 75) < 0.01 && Math.abs(d().y - 45) < 0.01); },
      punta:async () => { await bekle(300); kare(400); ucGit(PH() - 1 - 2); ucGit(PH() + 3); },
      del:async () => { await bekle(300); kare(400); ucGit(-3); ucGit(PH() + 3); },
      kavra:async () => { await bekle(300); kare(400); for (let k = 0; k < 600 && !S.tap && !S.alarm; k++) { S.pend.z = -0.2; sur(1); } },
      geri:() => { kadar(() => !S.tap || S.alarm || window.__d.tip() < -3, 20000); for (let k = 0; k < 20000 && S.tap && !S.alarm && window.__d.tip() > -3; k++) sur(1); tik('#cpDir'); for (let k = 0; k < 20000 && S.tap && !S.alarm; k++) sur(1); },
      bitir:() => { U.spindle(false); if (S.dir < 0) tik('#cpDir'); },
      teslim:() => tik('#jobSubmit'),
    };
    EG.baslat(); if (EG.adim !== 0) throw new Error('eğitim başlamadı');
    for (let g = 0; g < 80 && EG.id !== 'son'; g++) {
      const id = EG.id, n = EG.adim, is = IS[id];
      if (!is) throw new Error(`testte "${id}" adımı için iş yok`);
      await is();
      for (let k = 0; k < 40 && EG.adim === n; k++) await bekle(100);   // yavaş makinede 4 s
      if (EG.adim === n) throw new Error(`"${id}" adımında takıldı (${EG.ADIM[n].s.slice(0, 50)}…): ${son()} · uç ${window.__d.tip().toFixed(2)} PH ${PH()} X${d().x.toFixed(2)} Y${d().y.toFixed(2)} Z${d().z.toFixed(2)}`);
      if (S.broken) throw new Error(`"${id}" adımında takım kırıldı: ${son()}`);
    }
    let set = 0; for (let y = 35; y <= 55; y += 0.5) for (let x = 10; x <= 140; x += 2) set = Math.max(set, T.H[Math.round(y / T.C) * T.NX + Math.round(x / T.C)]);
    if (set > PH() - 1 + 0.05) throw new Error(`yüzeyde iki paso arasında set kaldı: ${(set - (PH() - 1)).toFixed(2)} mm`);
    const ozet = document.getElementById('rpTitle').textContent;
    document.getElementById('egKariyer').click();
    if (!app.CR.on || !EG.bitti) throw new Error('eğitim bitince kariyere geçilmedi');
    return `${EG.ADIM.length - 1} adım, teslim: ${ozet}`;
  },
  async gkod() {
    const { S, U, K, T, app, takim, yeni, son } = window.__d;
    const G = await import('/src/js/27-gkod.js'), c = G.cozumle, GK = app.GK;
    // ayrıştırıcı: yaygın yazım hataları anlaşılır iletiyle yakalanır
    const tek = (m, beklenen) => { const r = c(m); const h = r.hatalar.map(q => q.msg).join(' '); if (!h.includes(beklenen)) throw new Error(`"${m}" için "${beklenen}" beklenirdi, gelen: ${h || 'hata yok'}`); };
    tek('G0 X20 Y8O', 'Y8O'); tek('GO X10', 'G0'); tek('G0 X=10', 'eşittir'); tek('G1 X10', 'F'); tek('G83 X1 Y1 Z-5 R2 F100', 'Q'); tek('G2 X1', 'G2');
    if (c('G0 X=10, Y=20'.replace(/=/g, '')).hatalar.length) throw new Error('virgüllü satır okunmadı');
    const r = c(GK.ORNEK.delik[1]);
    if (r.hatalar.length || r.uyari.length) throw new Error('örnek programda hata/uyarı: ' + [...r.hatalar, ...r.uyari].map(q => q.msg).join(' '));
    // yürütme: standart parça, T7 Ø5, Z sıfırı üst yüzeyde; 4 delik boydan boya
    // kariyerde kit yoksa çalışmaz; serbest atölyede açık
    document.querySelector('#modeSw [data-mode="career"]').click();
    if (!app.CR.hasEq('cnc')) { GK.baslat(false); if (GK.calisiyor) throw new Error('kariyerde kitsiz program çalıştı'); document.getElementById('shop').hidden = true; }
    document.querySelector('#modeSw [data-mode="free"]').click();
    app.setStock(150, 100, 40, true); yeni(); takim(t => t.no === 'T7');
    S.zx = 0; S.zy = 0; S.zn = S.nose - (S.nose - T.TOOLS[S.tool].len - T.PH);   // Z0 = parça üstü (bu takımla)
    GK.yukle(GK.ORNEK.delik[1]); GK.baslat(false);
    if (!GK.calisiyor) throw new Error(`program başlamadı: ${son()}`);
    for (let k = 0; k < 200000 && GK.calisiyor; k++) { GK.update(1 / 60); K.motion(1 / 60); }
    if (GK.calisiyor) throw new Error(`program bitmedi: ${GK.ys && GK.ys.op && GK.ys.op.not}`);
    if (S.broken || S.alarm) throw new Error(`programda takım kırıldı: ${son()}`);
    const { H, C, NX } = T, dip = [[20, 20], [130, 20], [130, 80], [20, 80]].map(([x, y]) => H[Math.round(y / C) * NX + Math.round(x / C)]);
    if (dip.some(v => v > 0.05)) throw new Error(`delikler boydan boya değil: ${dip.map(v => v.toFixed(1)).join(', ')}`);
    if (S.spindle) throw new Error('M30 sonrası mil dönüyor');
    // cep örneği: T3 Ø10, iki pasoda 5 mm
    yeni(); takim(t => t.no === 'T3');
    S.zx = 0; S.zy = 0; S.zn = T.TOOLS[S.tool].len + T.PH;
    GK.yukle(GK.ORNEK.cep[1]); GK.baslat(false);
    for (let k = 0; k < 400000 && GK.calisiyor; k++) { GK.update(1 / 60); K.motion(1 / 60); }
    if (GK.calisiyor || S.broken || S.alarm) throw new Error(`cep programı bitmedi ya da kırıldı: ${son()}`);
    const cep = [[62, 42], [75, 50], [88, 58]].map(([x, y]) => T.PH - H[Math.round(y / C) * NX + Math.round(x / C)]);
    if (cep.some(v => Math.abs(v - 5) > 0.15)) throw new Error(`cep derinliği 5 değil: ${cep.map(v => v.toFixed(2)).join(', ')}`);
    return `ayrıştırıcı 7 denetim, G83 ile 4 delik boydan boya, cep 5 mm (${r.ops.length} adım)`;
  },
  async dukkan() {
    const { app, S, U, son } = window.__d, CR = app.CR;
    document.querySelector('#modeSw [data-mode="career"]').click();
    if (!CR.on) throw new Error('kariyere geçilmedi');
    const st = CR.st; st.money = 60000; st.rep = 0;
    const gor = () => CR.dukkan();
    if (gor().sv !== 0) throw new Error('yeni kariyer garajda başlamadı');
    // kilitler: atölye yükseltmesi garajda alınmaz, itibarsız taşınılmaz, motorsuz Y ilerlemesi çalışmaz
    if (CR.dukkanAl('motor')) throw new Error('garajda atölye yükseltmesi alındı');
    if (CR.tasin()) throw new Error('itibarsız taşınıldı');
    U.setAutoY(1); if (S.autoY) throw new Error('motorsuz Y ilerlemesi çalıştı');
    const k0 = CR.kira();
    for (const id of ['olcu', 'pompa', 'raf', 'yIlerleme']) if (!CR.dukkanAl(id)) throw new Error(`${id} alınamadı: ${son()}`);
    U.setAutoY(1); if (S.autoY !== 1) throw new Error('Y ilerleme motoru alınınca Y ilerlemesi çalışmadı'); U.setAutoY(0);
    st.rep = 12; if (!CR.tasin() || gor().sv !== 1) throw new Error(`atölyeye taşınılmadı: ${son()}`);
    if (!(CR.kira() > k0)) throw new Error('atölyede kira artmadı');
    if (Math.abs(S.motorK - 1) > 1e-9) throw new Error('motor alınmadan mil gücü arttı');
    for (const id of ['motor', 'cirak', 'web']) if (!CR.dukkanAl(id)) throw new Error(`${id} alınamadı: ${son()}`);
    if (S.motorK !== 1.5) throw new Error('güçlü motor mil gücünü artırmadı');
    // çırak: gün sonunda kırıkları biler ve maaşını alır; web sitesi: gelen kutusunda 3 sipariş
    st.kirik = { T3:1 }; const m0 = st.money; S.spindle = false;
    CR.gunuBitir(); CR.ertesiGun();
    if (Object.keys(st.kirik).length) throw new Error('çırak kırık takımı bilemedi');
    if (!(m0 - st.money >= CR.kira() + 250 - 1)) throw new Error(`çırak maaşı ve kira düşmedi (${m0} → ${st.money})`);
    const bek = st.orders.filter(o => !o.kabul).length;
    if (bek < 3) throw new Error(`web sitesiyle gelen kutusunda ${bek} sipariş var (en az 3)`);
    // görünüm: yükseltmeler atölyede görünür
    const { scene } = await import('/src/js/02-sahne-tezgah.js');
    if (!app.ATL) throw new Error('atölye görünümü kurulmadı');
    return `garaj → atölye, 7 yükseltme, kira ${k0} → ${CR.kira()} ₺, çırak ve web çalışıyor`;
  },
  async kariyer() {
    const { app, S, son } = window.__d;
    document.querySelector('#modeSw [data-mode=career]').click();
    if (!app.CR.on) throw new Error(`kariyere geçilmedi: ${son()}`);
    const st = app.CR.st, gun = st.gun;
    if (!st.orders.length) throw new Error('siparişler gelmedi');
    if (!st.mail.length) throw new Error('mail kutusu boş');
    const o = st.orders.find(q => !app.CR.bekler(q));
    if (o && !app.CR.kabul(o.id)) throw new Error(`sipariş kabul edilmedi: ${son()}`);
    const para = st.money;                                          // kabulde ham parça parası düşebilir
    S.spindle = false; app.CR.gunuBitir();
    if (!app.CR.raporBekliyor) throw new Error('gün sonu raporu açılmadı');
    const gider = app.CR.kira() + (st.dukkan && st.dukkan.yuk.cirak ? 250 : 0);   // kira, varsa çırak maaşı
    if (st.money !== para - gider) throw new Error(`kira düşmedi (${para} → ${st.money}, beklenen −${gider})`);
    app.CR.ertesiGun();
    if (st.gun !== gun + 1) throw new Error('ertesi güne geçilmedi');
    // sipariş üretici (16-siparis): her seviyede 100'er sipariş, bozuk alan yok
    const { genOrder } = await import('/src/js/16-siparis.js');
    let n = 0;
    for (let lv = 0; lv < 4; lv++) for (let k = 0; k < 100; k++) {
      const q = genOrder(k % 3 === 0, lv, () => ++n);
      if (!q.J || !q.J.title || !(q.pay > 0 || q.ayni) || !isFinite(q.J.target) || !q.cust) throw new Error(`bozuk sipariş (seviye ${lv}): ${JSON.stringify(q).slice(0, 160)}`);
    }
    return `gün ${gun} → ${st.gun}, kira ${app.CR.kira()} ₺${o ? ', iş kabul' : ''}, ${n} sipariş üretildi`;
  },
};

async function calistir() {
  const sec = process.argv.slice(2), adlar = sec.length ? sec : Object.keys(SENARYO);
  const srv = await sunucu(), url = `http://127.0.0.1:${srv.address().port}`;
  const br = await tarayici(), hatalar = [];
  br.dinle.push((m, p) => {
    if (m === 'Runtime.exceptionThrown') hatalar.push(p.exceptionDetails.exception?.description || p.exceptionDetails.text);
    if (m === 'Runtime.consoleAPICalled' && p.type === 'error') hatalar.push(p.args.map(a => a.value ?? a.description).join(' '));
  });
  await br.gonder('Runtime.enable');
  const deger = async (ifade, ad) => {
    const r = await br.gonder('Runtime.evaluate', { expression:ifade, awaitPromise:true, returnByValue:true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description?.split('\n')[0] || r.exceptionDetails.text || ad);
    return r.result.value;
  };
  const ac = async (sayfa, hazir) => {
    await br.gonder('Page.navigate', { url:`${url}/${sayfa}` });
    for (let i = 0; i < 200; i++) { await bekle(100); try { if (await deger(hazir)) return; } catch {} }
    throw new Error(`${sayfa} açılmadı`);
  };
  let dus = 0;
  const yaz = (ok, ad, msg) => { if (!ok) dus++; console.log(`${ok ? '  ✓' : '  ✗'} ${ad.padEnd(10)} ${msg}`); };
  try {
    // paketlenmiş sayfa: açılıyor mu, hata var mı
    await ac('freze.html', `!!document.querySelector('canvas') && !!document.querySelector('#log > *')`);
    await bekle(1500);
    yaz(!hatalar.length, 'freze.html', hatalar.length ? hatalar.splice(0).join(' / ') : 'açıldı, konsolda hata yok');
    // senaryolar dev.html'de: modüllere doğrudan erişilir
    await ac('dev.html?test', `!!document.querySelector('#log > *')`);
    await deger(`(${YARDIMCI})()`, 'yardımcı');
    for (const ad of adlar) {
      if (!SENARYO[ad]) { yaz(false, ad, 'böyle bir senaryo yok'); continue; }
      const t0 = Date.now();
      try {
        const kod = String(SENARYO[ad]), msg = await deger(`(async function${kod.slice(kod.indexOf('('))})()`, ad);   // yöntem kısaltması ifade değil
        if (hatalar.length) throw new Error('konsol: ' + hatalar.splice(0).join(' / '));
        yaz(true, ad, `${msg} (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
      } catch (e) { hatalar.length = 0; yaz(false, ad, e.message); }
    }
  } catch (e) { yaz(false, 'kurulum', e.message); }
  finally { await br.kapat(); srv.close(); }
  console.log(dus ? `\n${dus} senaryo düştü.` : '\nDuman testi temiz.');
  process.exit(dus ? 1 : 0);
}
// başka betik (ekonomi.mjs) sunucuyu ve tarayıcıyı ödünç alabilir; doğrudan çalıştırılınca testler koşar
export { sunucu, tarayici };
if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.dirname, 'duman.mjs')) calistir();
