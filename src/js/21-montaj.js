// ── Montaj masası (MT): işlenmiş plakaya müşterinin parçası vidalanır; elle takma, tork anahtarı, çapraz sıra, diş sıyırma, yay diş
import { $, C, H, NX, NY, PD, PH, PW, S, app, clamp, log } from './00-temel.js';
import { ac, beep, initAudio, metalRing, noiseHit, thud } from './01-ses.js';
import { M } from './02-sahne-tezgah.js';
import { flushMesh, stockBase, topGeo, topMat, walls } from './05-baglama.js';
import { DIS, localTop, threadAt } from './10-is-emri-muayene.js';

/* Akış: kuleyi yerleştir → deliğe tıkla, cıvata elle girer (diş yoksa, delik kaçıksa, diş kısaysa takılır) →
   cıvatanın üstünde basılı tut: tork anahtarı, ibre yeşilde bırakılır (fazlası alüminyum dişi sıyırır) → montajı bitir.
   Çapraz sıra: ilk iki ve son iki sıkılan cıvata karşılıklı olmalı; vidalar takılmadan sıkmaya başlamak flanşı eğer. */
const MT = (() => {
  let r = null, sc, cam, ctl, grp, raf = 0, open = false, last = 0;
  let run = null, items0 = null, done = null, J = null, D = null, m = null, st = null;
  const mats = {};
  const COIL = 80;                                                // yay diş (Heli-Coil) bedeli
  const STRIP = 1.35;                                             // üst torkun bu katında diş sıyırır
  function init() {
    const cv = $('mtC');
    r = new THREE.WebGLRenderer({ canvas:cv, antialias:true });
    r.setPixelRatio(Math.min(2, window.devicePixelRatio || 1)); r.outputEncoding = THREE.sRGBEncoding;
    r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 0.9; r.shadowMap.enabled = true;
    sc = new THREE.Scene(); sc.background = new THREE.Color(0x1a1f22);
    if (THREE.RoomEnvironment) { const pm = new THREE.PMREMGenerator(r); sc.environment = pm.fromScene(new THREE.RoomEnvironment(), 0.04).texture; pm.dispose(); }
    sc.add(new THREE.HemisphereLight(0xe8eef5, 0x2a2622, 0.35));
    const l1 = new THREE.DirectionalLight(0xffffff, 0.8); l1.position.set(120, 300, 180); l1.castShadow = true; l1.shadow.mapSize.set(2048, 2048);
    Object.assign(l1.shadow.camera, { left:-200, right:200, top:200, bottom:-200, near:10, far:900 }); sc.add(l1);
    const l2 = new THREE.DirectionalLight(0x9fc4ff, 0.3); l2.position.set(-200, 80, -120); sc.add(l2);
    const bench = new THREE.Mesh(new THREE.BoxGeometry(520, 30, 380), new THREE.MeshStandardMaterial({ color:new THREE.Color(0x2c3235).convertSRGBToLinear(), roughness:0.85 }));
    bench.position.y = -15.2; bench.receiveShadow = true; bench.material.envMapIntensity = 0.25; sc.add(bench);
    cam = new THREE.PerspectiveCamera(38, 1, 2, 4000);
    ctl = new THREE.OrbitControls(cam, cv); ctl.enableDamping = true; ctl.maxPolarAngle = Math.PI * 0.49;
    grp = new THREE.Group(); sc.add(grp);
    mats.top = topMat.clone(); mats.top.onBeforeCompile = topMat.onBeforeCompile; mats.top.customProgramCacheKey = () => 'montajTop';
    mats.raw = M.raw.clone();
    mats.paint = new THREE.MeshStandardMaterial({ color:new THREE.Color(0xd9661f).convertSRGBToLinear(), roughness:0.5, metalness:0.08 });   // elektrostatik boya
    mats.black = new THREE.MeshStandardMaterial({ color:new THREE.Color(0x1d1f22).convertSRGBToLinear(), roughness:0.42, metalness:0.65 });   // siyah oksit cıvata
    mats.sock = new THREE.MeshStandardMaterial({ color:0x050506, roughness:0.9 });
    mats.plast = new THREE.MeshStandardMaterial({ color:new THREE.Color(0x232628).convertSRGBToLinear(), roughness:0.6 });
    mats.glass = new THREE.MeshStandardMaterial({ color:0x3a5f88, roughness:0.1, metalness:0.3, emissive:0x081420 });
    mats.led = new THREE.MeshStandardMaterial({ color:0x1b3320, roughness:0.3, emissive:0x000000 });
    mats.steel = new THREE.MeshStandardMaterial({ color:new THREE.Color(0xb9bec2).convertSRGBToLinear(), roughness:0.3, metalness:0.9 });
    mats.hit = new THREE.MeshBasicMaterial({ transparent:true, opacity:0, depthWrite:false });
    // basılı tutma: OrbitControls'tan önce yakalanır (cıvatanın üstündeyse kamera dönmez)
    $('mtView').addEventListener('pointerdown', down, true);
    window.addEventListener('pointerup', up);
    new ResizeObserver(resize).observe(cv.parentElement);
  }
  function resize() {
    if (!r) return;
    const el = $('mtC').parentElement, w = el.clientWidth, h = el.clientHeight;
    r.setSize(w, h, false); cam.aspect = w / Math.max(1, h); cam.updateProjectionMatrix();
  }
  // parça koordinatı (x, y, yükseklik) → grp içi konum
  const P3 = (x, y, z) => new THREE.Vector3(x, z, -y);

  /* -- Modeller -- */
  function tower() {                                              // kare flanşlı boru kule, üstte fotosel
    const g = new THREE.Group(), a = m.s / 2, F = m.F, rc = 6;
    const sh = new THREE.Shape();
    sh.moveTo(-F / 2 + rc, -F / 2); sh.lineTo(F / 2 - rc, -F / 2); sh.absarc(F / 2 - rc, -F / 2 + rc, rc, -Math.PI / 2, 0);
    sh.lineTo(F / 2, F / 2 - rc); sh.absarc(F / 2 - rc, F / 2 - rc, rc, 0, Math.PI / 2);
    sh.lineTo(-F / 2 + rc, F / 2); sh.absarc(-F / 2 + rc, F / 2 - rc, rc, Math.PI / 2, Math.PI);
    sh.lineTo(-F / 2, -F / 2 + rc); sh.absarc(-F / 2 + rc, -F / 2 + rc, rc, Math.PI, Math.PI * 1.5);
    for (const [u, v] of [[-a, -a], [a, -a], [a, a], [-a, a]]) { const ph = new THREE.Path(); ph.absarc(u, v, D.clr / 2, 0, Math.PI * 2, true); sh.holes.push(ph); }
    const fl = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth:m.tf, bevelEnabled:true, bevelThickness:0.6, bevelSize:0.6, bevelSegments:2, curveSegments:24 }), mats.paint);
    fl.geometry.translate(0, 0, 0.6); fl.rotation.x = -Math.PI / 2; g.add(fl);
    const Rt = F * 0.24, Ht = 95;
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(Rt, Rt, Ht, 40), mats.paint); tube.position.y = m.tf + Ht / 2; g.add(tube);
    const fil = new THREE.Mesh(new THREE.TorusGeometry(Rt, 1.6, 8, 40), mats.paint); fil.rotation.x = Math.PI / 2; fil.position.y = m.tf + 0.6; g.add(fil);
    const gs = new THREE.Shape(); gs.moveTo(0, 0); gs.lineTo(F / 2 - Rt - 3, 0); gs.lineTo(0, 24); gs.lineTo(0, 0);   // köşebent (cıvatalar arasında)
    for (let k = 0; k < 4; k++) {
      const q = new THREE.Mesh(new THREE.ExtrudeGeometry(gs, { depth:4, bevelEnabled:false }), mats.paint);
      q.geometry.translate(Rt - 1, 0, -2); const p = new THREE.Group(); p.add(q); p.rotation.y = k * Math.PI / 2; p.position.y = m.tf; g.add(p);
    }
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(Rt + 2, Rt + 2, 4, 40), mats.paint); cap.position.y = m.tf + Ht + 2; g.add(cap);
    const yT = m.tf + Ht + 4;
    const box = new THREE.Mesh(new THREE.BoxGeometry(34, 24, 22), mats.plast); box.position.set(0, yT + 12, 0); g.add(box);
    const lens = new THREE.Mesh(new THREE.CylinderGeometry(6.5, 6.5, 2, 32), mats.glass); lens.rotation.z = Math.PI / 2; lens.position.set(17.5, yT + 12, 0); g.add(lens);
    const led = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 1.6, 20), mats.led); led.position.set(-9, yT + 24.6, 0); g.add(led);
    const gl = new THREE.Mesh(new THREE.CylinderGeometry(3.5, 3.5, 7, 6), mats.plast); gl.rotation.z = Math.PI / 2; gl.position.set(-20, yT + 8, 0); g.add(gl);   // kablo rakoru
    const cab = new THREE.Mesh(new THREE.TorusGeometry(26, 2.2, 8, 30, Math.PI * 0.55), mats.plast); cab.position.set(-23, yT - 18, 0); cab.rotation.z = Math.PI * 0.45; g.add(cab);
    g.traverse(o => { if (o.isMesh) o.castShadow = o.receiveShadow = true; });
    return g;
  }
  function bolt() {                                               // DIN 912 imbus: baş Ø1.6d × d, altıgen lokma yuvası
    const g = new THREE.Group(), d = D.d, hd = D.head;
    const head = new THREE.Mesh(new THREE.CylinderGeometry(hd / 2 - 0.3, hd / 2, d, 32), mats.black); head.position.y = d / 2; g.add(head);
    const so = new THREE.Mesh(new THREE.CylinderGeometry(d * 0.42, d * 0.42, d * 0.5, 6), mats.sock); so.position.y = d - d * 0.25 + 0.02; g.add(so);
    const sk = new THREE.Mesh(new THREE.CylinderGeometry(d / 2 * 0.94, d / 2 * 0.94, m.L, 20), mats.black); sk.position.y = -m.L / 2; g.add(sk);
    g.traverse(o => { if (o.isMesh) o.castShadow = true; });
    return g;
  }
  function wrench() {                                             // ibreli tork anahtarı: lokma, kol ve sap
    const g = new THREE.Group();
    const sock = new THREE.Mesh(new THREE.CylinderGeometry(D.head / 2 * 0.55, D.head / 2 * 0.55, 14, 24), mats.steel); sock.position.y = 7 + D.d; g.add(sock);
    const hd = new THREE.Mesh(new THREE.CylinderGeometry(8, 8, 9, 24), mats.steel); hd.position.y = D.d + 18; g.add(hd);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(150, 5, 11), mats.steel); arm.position.set(78, D.d + 18, 0); g.add(arm);
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(7, 7, 55, 20), mats.plast); grip.rotation.z = Math.PI / 2; grip.position.set(150, D.d + 18, 0); g.add(grip);
    g.traverse(o => { if (o.isMesh) o.castShadow = true; });
    g.visible = false; return g;
  }

  /* -- Ölçüm: delik merkezleri ve dişler -- */
  function measure() {
    return J.holes.map(h => {
      const lt = localTop(J, h.x, h.y), R = h.d / 2 + 3;
      let n = 0, sx = 0, sy = 0;
      for (let j = Math.max(0, Math.floor((h.y - R) / C)); j <= Math.min(NY - 1, Math.ceil((h.y + R) / C)); j++)
        for (let i = Math.max(0, Math.floor((h.x - R) / C)); i <= Math.min(NX - 1, Math.ceil((h.x + R) / C)); i++) {
          if (Math.hypot(i * C - h.x, j * C - h.y) > R || H[j * NX + i] >= lt - 0.5) continue;
          n++; sx += i * C; sy += j * C;
        }
      if (n < 4) return { x:h.x, y:h.y, none:true };
      const x = sx / n, y = sy / n;
      return { x, y, th:threadAt(x, y, D.p) };
    });
  }

  /* -- Durum -- */
  const ST_TXT = { bos:'boş', iniyor:'giriyor…', el:'elle takıldı', yok:'diş yok, tutmuyor', uymuyor:'diş uymuyor', kacik:'delik kaçık, girmiyor', dip:'dibe dayandı', siyrik:'DİŞ SIYIRDI' };
  function build() {
    while (grp.children.length) grp.remove(grp.children[0]);
    mats.raw.color.copy(M.raw.color); mats.raw.metalness = M.raw.metalness; mats.raw.roughness = M.raw.roughness;
    mats.top.metalness = topMat.metalness; mats.top.roughness = topMat.roughness;
    const add = (g, mt) => { const o = new THREE.Mesh(g, mt); o.castShadow = o.receiveShadow = true; grp.add(o); return o; };
    flushMesh();
    add(topGeo, mats.top); for (const w of walls) add(w.w.g, mats.raw); add(stockBase.geometry, mats.raw);
    grp.position.set(-PW / 2, 0, PD / 2);
    // kule gerçek deliklere en iyi oturduğu yere kayar (ortalama kayıklık); her deliğin kalan kaçıklığı cıvatanın girip girmeyeceğini belirler
    const meas = measure(), found = meas.filter(q => !q.none);
    const ox = found.length ? found.reduce((s, q, k) => s + q.x - J.holes[meas.indexOf(q)].x, 0) / found.length : 0;
    const oy = found.length ? found.reduce((s, q) => s + q.y - J.holes[meas.indexOf(q)].y, 0) / found.length : 0;
    const clr = (D.clr - D.d) / 2;
    st = { placed:false, drop:0, ox, oy, order:[], early:0, cost:0, coil:0, hold:null, finish:0,
      bolts:J.holes.map((h, i) => {
        const q = meas[i], res = q.none ? 99 : Math.hypot(q.x - (h.x + ox), q.y - (h.y + oy));
        return { i, q, res, zor:res > clr && res <= clr + 0.25, st:'bos', tq:0, z:0, ang:0, coil:false, mesh:null, hit:null, lb:null };
      }) };
    st.tw = tower(); st.tw.position.copy(P3(m.cx + ox, m.cy + oy, PH + 70)); grp.add(st.tw);
    st.wr = wrench(); grp.add(st.wr);
    for (const b of st.bolts) {
      const h = J.holes[b.i];
      b.hit = new THREE.Mesh(new THREE.CylinderGeometry(D.head / 2 + 1.5, D.head / 2 + 1.5, 30, 12), mats.hit);
      b.hit.position.copy(P3(h.x + ox, h.y + oy, PH + m.tf + 12)); b.hit.userData.b = b; grp.add(b.hit);
      b.lb = document.createElement('div'); b.lb.className = 'mt-num'; b.lb.textContent = b.i + 1; $('mtView').append(b.lb);
    }
    panel();
  }
  const tq0 = () => D.tq[0], tq1 = () => D.tq[1], strip = b => D.tq[1] * STRIP;
  function hint(t) { $('mtHint').textContent = t; }
  function place() {
    if (st.placed) return;
    st.placed = true; st.drop = 1; thud(120, 0.15, 0.2);
    hint('Kule yerinde. Cıvataları takmak için deliklere tıklayın.');
    panel();
  }
  // elle takma: cıvata yukarıdan dönerek iner; nereye kadar inebileceği diş ve kaçıklığa bağlı
  function runIn(b) {
    if (b.st !== 'bos') return;
    const need = m.L - m.tf, clr = (D.clr - D.d) / 2;
    const q = b.q, th = b.coil ? { ok:true, L:need + 2 } : q.th;
    let res, stop, msg;                                           // stop: cıvata başının flanş üstünden yüksekliği
    if (q.none) { res = 'yok'; stop = need; msg = `Delik ${b.i + 1}: plakada delik yok. Cıvata plakanın üstünde duruyor.`; }
    else if (b.res > clr + 0.25) { res = 'kacik'; stop = need; msg = `Delik ${b.i + 1}: delik ${b.res.toFixed(2)} mm kaçık; cıvata flanşın deliğinden plakadaki dişe ulaşamıyor.`; }
    else if (!th) { res = 'yok'; stop = need; msg = `Delik ${b.i + 1}: delikte diş yok, cıvata boşta dönüyor. Kılavuz çekmeyi unuttunuz.`; }
    else if (!th.ok) { res = 'uymuyor'; stop = need - 1; msg = `Delik ${b.i + 1}: diş adımı tutmuyor (${th.th.p} mm), ${m.bolt} cıvata girmiyor.`; }
    else if (th.L < need - 0.3) { res = 'dip'; stop = need - th.L; msg = `Delik ${b.i + 1}: diş ${th.L.toFixed(1)} mm, cıvata ${need} mm ister. Cıvata dişin sonuna dayandı, başı ${stop.toFixed(1)} mm havada.`; }
    else { res = 'el'; stop = 0; msg = (b.zor ? `Delik ${b.i + 1}: cıvata zorlanarak girdi (delik ${b.res.toFixed(2)} mm kaçık). Flanş hafif gerildi.` : `Delik ${b.i + 1}: cıvata elle takıldı. Tork anahtarı için üstünde basılı tutun.`); }
    b.mesh = bolt(); grp.add(b.mesh);
    const h = J.holes[b.i];
    b.mesh.position.copy(P3(h.x + st.ox, h.y + st.oy, PH + m.tf + 22));
    b.z = 22 + m.L; b.goal = stop; b.res2 = res; b.msg = msg; b.st = 'iniyor'; b.tick = 0;
    if (res === 'kacik') b.mesh.rotation.z = 0.06;
    panel();
  }
  function step(dt) {
    if (!st) return;
    if (st.drop > 0) { st.drop = Math.max(0, st.drop - dt * 2.2); st.tw.position.y = PH + 70 * st.drop * st.drop; if (!st.drop) thud(90, 0.25, 0.25); }
    for (const b of st.bolts) {
      if (b.st !== 'iniyor') continue;
      const v = (b.z > m.L - m.tf + 2 ? 60 : 9) * dt;              // serbest düşüş gibi hızlı, dişe girince her tur bir adım
      b.z = Math.max(b.goal, b.z - v);
      b.ang += v / D.p * Math.PI * 2;
      if ((b.tick += v) > D.p / 2 && b.z < m.L - m.tf + 2) { b.tick = 0; if (ac) noiseHit(ac.currentTime, 'bandpass', 4200, 4, 0.05, 0.012); }   // cırcır
      if (b.z <= b.goal + 1e-6) { b.st = b.res2; hint(b.msg); if (b.st === 'el') thud(260, 0.06, 0.05); else thud(420, 0.08, 0.06); panel(); }
    }
    const H0 = st.hold;
    if (H0) {
      const b = H0.b, t = (performance.now() - H0.t0) / 1000;
      const rate = tq1() * (0.12 + 0.9 * t);                       // çektikçe hızlanır: kısa çekişlerle ince ayar
      b.tq += rate * dt; b.ang += rate * dt * 0.012;
      if (b.tq >= tq0() * 0.5 && !b.half) { b.half = true; if (st.bolts.some(o => o !== b && o.st !== 'el' && o.st !== 'siyrik')) st.early++; }   // diğer cıvatalar takılmadan sıkmak
      if (b.tq >= tq0() && !st.order.includes(b.i)) st.order.push(b.i);
      if (b.tq > strip(b)) {
        b.st = 'siyrik'; st.hold = null; st.wr.visible = false; ctl.enabled = true;
        noiseHit(ac ? ac.currentTime : 0, 'lowpass', 900, 0.8, 0.4, 0.3); metalRing(700, 0.05, 0.5);
        hint(`Cıvata ${b.i + 1}: alüminyumda diş sıyırdı! Cıvata boşa dönüyor. Yay diş (Heli-Coil) takıp yeniden deneyin.`);
        log(`Montaj: cıvata ${b.i + 1} dişi sıyırdı (${b.tq.toFixed(1)} Nm).`, 'warn');
        panel();
      }
      gauge(b.tq);
    }
    for (const b of st.bolts) if (b.mesh) {
      const h = J.holes[b.i];
      b.mesh.position.copy(P3(h.x + st.ox, h.y + st.oy, PH + m.tf + b.z)); b.mesh.rotation.y = -b.ang;
    }
    if (st.hold) { const b = st.hold.b, h = J.holes[b.i]; st.wr.position.copy(P3(h.x + st.ox, h.y + st.oy, PH + m.tf)); st.wr.rotation.y = -b.ang * 0.6 + st.hold.a0; }
    if (st.finish) {                                               // sensör ışığı yandı: kısa bekleyip rapora geç
      st.finish -= dt;
      mats.led.emissive.setRGB(0.1, 1.6 + Math.sin(performance.now() / 90) * 0.4, 0.3);
      if (st.finish <= 0) { st.finish = 0; close(true); }
    }
  }
  function gauge(v) {                                             // ibre: 0 … sıyırma eşiğinin biraz üstü
    const max = tq1() * STRIP * 1.1, a = -120 + 240 * clamp(v / max, 0, 1);
    $('mtNeedle').setAttribute('transform', `rotate(${a})`);
    $('mtTq').textContent = v.toFixed(1) + ' Nm';
  }
  function gaugeSVG() {
    const max = tq1() * STRIP * 1.1, A = v => (-120 + 240 * v / max) * Math.PI / 180;
    const arc = (v0, v1, col, w) => { const a0 = A(v0), a1 = A(v1), R = 44; return `<path d="M${Math.sin(a0) * R} ${-Math.cos(a0) * R} A${R} ${R} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${Math.sin(a1) * R} ${-Math.cos(a1) * R}" stroke="${col}" stroke-width="${w}" fill="none"/>`; };
    let s = `<svg viewBox="-60 -56 120 92" aria-label="Tork göstergesi"><circle r="52" fill="#0f1214" stroke="#3a4044" stroke-width="2"/>`;
    s += arc(0, max, '#3a4044', 3) + arc(tq0(), tq1(), '#3fd47a', 7) + arc(strip(), max, '#e5484d', 7);
    for (let v = 0; v <= max; v += max > 40 ? 10 : 2) { const a = A(v); s += `<line x1="${Math.sin(a) * 36}" y1="${-Math.cos(a) * 36}" x2="${Math.sin(a) * 40}" y2="${-Math.cos(a) * 40}" stroke="#cfd5d1" stroke-width="1.2"/><text x="${Math.sin(a) * 28}" y="${-Math.cos(a) * 28 + 3}" font-size="7.5" fill="#cfd5d1" text-anchor="middle">${v}</text>`; }
    s += `<g id="mtNeedle"><line x1="0" y1="6" x2="0" y2="-46" stroke="#ff5a4a" stroke-width="2.4" stroke-linecap="round"/></g><circle r="4" fill="#cfd5d1"/><text y="24" font-size="8" fill="#9aa3a6" text-anchor="middle">Nm</text></svg>`;
    return s;
  }
  // cıvata listesi, adımlar ve düğmeler
  function panel() {
    const B = st.bolts, all = B.every(b => b.st === 'el' && b.tq >= tq0());
    $('mtSteps').innerHTML = [
      [st.placed, 'Kuleyi plakaya yerleştirin'],
      [B.every(b => b.st === 'el'), 'Cıvataları elle takın: deliğe tıklayın'],
      [all, `Çapraz sırayla sıkın (1-3-2-4): cıvatanın üstünde basılı tutun, ibre yeşilde (${tq0()}–${tq1()} Nm) bırakın`],
    ].map(([ok, t]) => `<li class="${ok ? 'ok' : ''}">${t}</li>`).join('');
    $('mtList').innerHTML = B.map(b => `<li class="${b.st === 'el' ? (b.tq >= tq0() && b.tq <= tq1() ? 'ok' : b.tq > tq1() ? 'warn' : '') : b.st === 'bos' || b.st === 'iniyor' ? '' : 'bad'}"><b>${b.i + 1}</b> ${ST_TXT[b.st]}${b.tq ? ` · ${b.tq.toFixed(1)} Nm` : ''}${b.coil ? ' · yay diş' : ''}${b.zor && b.st === 'el' ? ' · zorlandı' : ''}</li>`).join('');
    $('mtPlace').hidden = st.placed;
    const bad = B.filter(b => b.st === 'siyrik');
    $('mtCoil').hidden = !bad.length; $('mtCoil').textContent = `Yay diş tak (${bad.length} delik, ${bad.length * COIL} ₺)`;
    $('mtOrder').textContent = st.order.length ? 'Sıkma sırası: ' + st.order.map(i => i + 1).join('-') : '';
  }
  function pickBolt(e) {
    const rc = $('mtC').getBoundingClientRect(), ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2((e.clientX - rc.left) / rc.width * 2 - 1, -(e.clientY - rc.top) / rc.height * 2 + 1), cam);
    const hits = ray.intersectObjects(st.bolts.map(b => b.hit), false);
    return hits.length ? hits[0].object.userData.b : null;
  }
  function down(e) {
    if (e.button !== 0 || !st || st.finish) return;
    initAudio();
    const b = pickBolt(e);
    if (!b) return;                                                // boşluk: kamera döner
    e.stopPropagation(); ctl.enabled = false;
    if (!st.placed) { hint('Önce kuleyi plakaya yerleştirin.'); return; }
    if (b.st === 'bos') { runIn(b); return; }
    if (['yok', 'uymuyor', 'kacik', 'dip'].includes(b.st)) {       // takılan cıvata geri sökülür
      grp.remove(b.mesh); b.mesh = null; b.st = 'bos'; b.ang = 0; b.tq = 0; b.half = false;
      hint(`Cıvata ${b.i + 1} söküldü.`); panel(); return;
    }
    if (b.st !== 'el') return;
    st.hold = { b, t0:performance.now(), a0:Math.atan2(cam.position.z - st.wr.position.z, cam.position.x) - Math.PI / 2 };
    st.wr.visible = true; $('mtGauge').classList.add('on');
    hint(`Cıvata ${b.i + 1}: tork anahtarı. İbre yeşil bölgedeyken bırakın.`);
  }
  function up() {
    if (ctl) ctl.enabled = true;
    if (!st || !st.hold) return;
    const b = st.hold.b; st.hold = null; st.wr.visible = false; $('mtGauge').classList.remove('on');
    if (b.tq >= tq0() && b.tq <= tq1()) { thud(600, 0.05, 0.04); hint(`Cıvata ${b.i + 1}: ${b.tq.toFixed(1)} Nm, tamam.`); }
    else if (b.tq > tq1()) hint(`Cıvata ${b.i + 1}: ${b.tq.toFixed(1)} Nm, fazla sıkıldı (dişi zorladınız).`);
    else hint(`Cıvata ${b.i + 1}: ${b.tq.toFixed(1)} Nm, henüz az. Biraz daha çekin.`);
    panel();
  }
  function coil() {
    const bad = st.bolts.filter(b => b.st === 'siyrik');
    for (const b of bad) { grp.remove(b.mesh); b.mesh = null; b.st = 'bos'; b.tq = 0; b.ang = 0; b.half = false; b.coil = true; st.order = st.order.filter(i => i !== b.i); }
    st.cost += bad.length * COIL; st.coil += bad.length;
    beep(900, 0.08); hint(`Yay diş takıldı: ${bad.length} delik, −${bad.length * COIL} ₺. Cıvatayı yeniden takın.`);
    panel();
  }
  function unscrew() {
    for (const b of st.bolts) { if (b.mesh) grp.remove(b.mesh); b.mesh = null; if (b.st !== 'siyrik') { b.st = 'bos'; b.tq = 0; b.ang = 0; b.half = false; } }
    st.order = []; st.early = 0;
    hint('Cıvatalar söküldü.'); panel();
  }
  // montaj ölçüleri: her cıvatanın torku ve flanşın oturması (sıra hatası, erken sıkma ve zorlanan delik eğiklik yapar)
  function result() {
    const out = [], add = (grp, label, nom, meas, ok, sc, w = 1) => out.push({ grp, label, nom, meas, ok, sc:clamp(sc, 0, 1), w });
    for (const b of st.bolts) {
      const ok = b.st === 'el' && b.tq >= tq0() && b.tq <= tq1();
      const meas = b.st === 'el' ? b.tq.toFixed(1) + ' Nm' + (b.tq < tq0() ? ' (gevşek)' : b.tq > tq1() ? ' (fazla)' : '') : ST_TXT[b.st];
      add('V' + (b.i + 1), 'Cıvata torku', `${tq0()}–${tq1()} Nm`, meas, ok, ok ? 1 : b.st === 'el' ? (b.tq < tq0() ? b.tq / tq0() * 0.6 : 0.5) : 0, 2);
    }
    const o = st.order, opp = (a, c) => a != null && c != null && Math.abs(a - c) === 2;
    const cross = (o.length >= 2 && !opp(o[0], o[1]) ? 1 : 0) + (o.length >= 4 && !opp(o[2], o[3]) ? 1 : 0);
    const gap = cross * 0.03 + st.early * 0.04 + st.bolts.filter(b => b.zor && b.st === 'el').length * 0.02;
    add('Montaj', 'Flanş oturması', '≤ 0.05', gap.toFixed(2) + (o.length ? ` (sıra ${o.map(i => i + 1).join('-')})` : ''), gap <= 0.05 && o.length === 4, gap <= 0.05 ? 1 : Math.max(0, 1 - (gap - 0.05) / 0.1), 2);
    return out;
  }
  function finish() {
    if (st.hold || st.finish) return;
    const extra = result(), ok = extra.every(i => i.ok) && items0.every(i => i.ok);
    st.extra = extra;
    if (ok) { st.finish = 1.6; beep(1200, 0.1); setTimeout(() => beep(1600, 0.14), 140); hint('Sensör yandı: konveyör çalışıyor!'); }
    else close(true);
  }

  /* -- Aç / kapat -- */
  const _v = new THREE.Vector3();
  function loop(t) {
    if (!open) return;
    const dt = Math.min(0.05, last ? (t - last) / 1000 : 0.016); last = t;
    step(dt); ctl.update(); r.render(sc, cam);
    const rc = $('mtC').getBoundingClientRect();
    for (const b of st.bolts) {
      b.hit.getWorldPosition(_v); _v.y += D.d + 6 - 12; _v.project(cam);   // cıvata başının hemen üstü
      b.lb.style.left = ((_v.x + 1) / 2 * rc.width) + 'px'; b.lb.style.top = ((1 - _v.y) / 2 * rc.height) + 'px';
      b.lb.style.display = _v.z < 1 && st.placed ? '' : 'none';
      b.lb.className = 'mt-num ' + (b.st === 'el' && b.tq >= tq0() && b.tq <= tq1() ? 'ok' : ['yok', 'uymuyor', 'kacik', 'dip', 'siyrik'].includes(b.st) ? 'bad' : '');
    }
    raf = requestAnimationFrame(loop);
  }
  function show(runIn0, items, cb) {
    if (!r) init();
    run = runIn0; items0 = items; done = cb; J = run.J; m = J.montaj; D = DIS[m.bolt];
    open = true; $('montaj').hidden = false; S.duraklat = true;
    document.querySelectorAll('.mt-num').forEach(e => e.remove());
    mats.led.emissive.setRGB(0, 0, 0);
    build(); resize();
    $('mtInfo').textContent = `Sensör kulesi · 4×${m.bolt}×${m.L} imbus · ${D.tq[0]}–${D.tq[1]} Nm`;
    $('mtGauge').innerHTML = gaugeSVG(); gauge(0);
    const c = P3(m.cx - PW / 2, m.cy - PD / 2, 0);
    cam.position.set(c.x + 110, 230, c.z + 190); ctl.target.set(c.x, PH + 35, c.z); ctl.update();
    hint('Müşterinin sensör kulesi masada. "Kuleyi yerleştir" ile plakaya koyun.');
    last = 0; cancelAnimationFrame(raf); raf = requestAnimationFrame(loop);
  }
  // deliver: true montaj sonucunu teslim eder; false tezgâha döner (iş sürer, delik/diş düzeltilebilir)
  function close(deliver) {
    open = false; $('montaj').hidden = true; S.duraklat = false; cancelAnimationFrame(raf);
    document.querySelectorAll('.mt-num').forEach(e => e.remove());
    if (!deliver) { log('Montaj bırakıldı: parça tezgâhta. Delikleri düzeltip yeniden teslim edebilirsiniz.', 'warn'); return; }
    run.montaj = { cost:st.cost, coil:st.coil };
    const cb = done; done = null; cb(st.extra || result());
  }
  init0();
  function init0() {
    $('mtPlace').addEventListener('click', () => { initAudio(); place(); });
    $('mtCoil').addEventListener('click', coil);
    $('mtUndo').addEventListener('click', unscrew);
    $('mtDone').addEventListener('click', finish);
    $('mtBack').addEventListener('click', () => close(false));
    window.addEventListener('keydown', e => { if (!open) return; e.stopImmediatePropagation(); if (e.code === 'Escape') close(false); }, true);   // tezgâh tuşları montajda çalışmaz
  }
  return { open:show, close, get st() { return st; }, step, _down:down, _up:up };
})();

Object.assign(app, { MT });

export { MT };
