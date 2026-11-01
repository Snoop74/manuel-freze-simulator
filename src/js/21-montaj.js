// ── Montaj (MT): işlenmiş plaka atölyedeki çalışma tezgâhına alınır, müşterinin parçası vidalanır; alyan ve tork anahtarı fare tekerleğiyle
import { $, C, H, NX, NY, PD, PH, PW, S, app, clamp, log } from './00-temel.js';
import { ac, beep, initAudio, metalRing, noiseHit, thud } from './01-ses.js';
import { FLOOR_Y, M, camera, canvas, controls, scene } from './02-sahne-tezgah.js';
import { flushMesh, stockBase, threads, topGeo, topMat, topMesh, walls } from './05-baglama.js';
import { DIS, localTop, threadAt } from './10-is-emri-muayene.js';

/* Akış: Teslim et → kamera çalışma tezgâhına süzülür, parça tezgâhta → kuleyi yerleştir → deliğe tıkla, cıvata ağza oturur →
   üstünde tekerlek (ya da basılı tut): alyanla elle vidala; diş yoksa boşa döner, kaçık delikte girmez, kısa dişte dayanır →
   oturunca tork anahtarı: tekerleği yavaş çevir, ibre yeşilde dur (hızlı çevirmek taşırır, fazlası alüminyumda dişi sıyırır) → bitir.
   Çapraz sıra: ilk iki ve son iki sıkılan cıvata karşılıklı olmalı; cıvatalar takılmadan sıkmaya başlamak flanşı eğer.
   Tezgâh bu sırada durur (S.duraklat), tezgâh kollarına ve aletlere tıklanmaz (S.montaj); kamera dönüşte eski yerine gelir. */
const MT = (() => {
  const BX = 1680, BY = FLOOR_Y + 880, BZ = -1330;                // çalışma tezgâhının sol yarısı (sağda tezgâh mengenesi)
  const COIL = 80;                                                // yay diş (Heli-Coil) bedeli
  const STRIP = 1.35;                                             // üst torkun bu katında diş sıyırır
  const grp = new THREE.Group(); grp.visible = false; scene.add(grp);
  const mats = {
    paint:new THREE.MeshStandardMaterial({ color:new THREE.Color(0xd9661f).convertSRGBToLinear(), roughness:0.5, metalness:0.08 }),   // elektrostatik boya
    black:new THREE.MeshStandardMaterial({ color:new THREE.Color(0x1d1f22).convertSRGBToLinear(), roughness:0.42, metalness:0.65 }),  // siyah oksit cıvata
    sock:new THREE.MeshStandardMaterial({ color:0x050506, roughness:0.9 }),
    plast:new THREE.MeshStandardMaterial({ color:new THREE.Color(0x232628).convertSRGBToLinear(), roughness:0.6 }),
    glass:new THREE.MeshStandardMaterial({ color:0x3a5f88, roughness:0.1, metalness:0.3, emissive:0x081420 }),
    led:new THREE.MeshStandardMaterial({ color:0x1b3320, roughness:0.3, emissive:0x000000 }),
    steel:new THREE.MeshStandardMaterial({ color:new THREE.Color(0xb9bec2).convertSRGBToLinear(), roughness:0.3, metalness:0.9 }),
    hit:new THREE.MeshBasicMaterial({ transparent:true, opacity:0, depthWrite:false }),
  };
  let open = false, raf = 0, last = 0, run = null, items0 = null, done = null, J = null, D = null, m = null, st = null, cam = null, hover = null;
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
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
    const fl = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth:m.tf - 1.2, bevelEnabled:true, bevelThickness:0.6, bevelSize:0.6, bevelSegments:2, curveSegments:24 }), mats.paint);
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
  function allen() {                                              // L alyan anahtarı: kısa kol lokmada, uzun kol yatay
    const g = new THREE.Group(), s = D.d * 0.42, Ls = D.d * 3.2, Ll = D.d * 9;
    const a = new THREE.Mesh(new THREE.CylinderGeometry(s, s, Ls, 6), mats.black); a.position.y = D.d * 0.6 + Ls / 2; g.add(a);
    const b = new THREE.Mesh(new THREE.CylinderGeometry(s, s, Ll, 6), mats.black); b.rotation.z = Math.PI / 2; b.position.set(Ll / 2 + s, D.d * 0.6 + Ls, 0); g.add(b);
    const k = new THREE.Mesh(new THREE.SphereGeometry(s * 1.05, 8, 6), mats.black); k.position.set(0, D.d * 0.6 + Ls, 0); g.add(k);
    g.traverse(o => { if (o.isMesh) o.castShadow = true; });
    g.visible = false; return g;
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

  /* -- Durum --
     b.st: bos (cıvata yok), agiz (cıvata delikte, elle vidalanıyor ya da takıldı kaldı), el (oturdu; tork b.tq), siyrik (diş gitti).
     b.goal: cıvata başının flanş üstünden en alçak yüksekliği (0 = oturur); b.why: neden oturamadığı */
  const need = () => m.L - m.tf;
  const tq0 = () => D.tq[0], tq1 = () => D.tq[1], strip = () => D.tq[1] * STRIP;
  function hint(t) { $('mtHint').textContent = t; $('mtHint').hidden = !t; }
  function build() {
    while (grp.children.length) grp.remove(grp.children[0]);
    const add = (g, mt) => { const o = new THREE.Mesh(g, mt); o.castShadow = o.receiveShadow = true; grp.add(o); return o; };
    flushMesh();
    add(topGeo, topMat); for (const w of walls) add(w.w.g, M.raw); add(stockBase.geometry, M.raw);
    for (const th of threads) if (th.mesh) { const o = new THREE.Mesh(th.mesh.geometry, th.mat); o.position.set(th.cx, 0, -th.cy); grp.add(o); }   // kılavuz dişleri
    grp.position.set(BX - PW / 2, BY + 0.2, BZ + PD / 2);
    // kule gerçek deliklere en iyi oturduğu yere kayar (ortalama kayıklık); her deliğin kalan kaçıklığı cıvatanın girip girmeyeceğini belirler
    const meas = measure(), found = meas.filter(q => !q.none);
    const ox = found.length ? found.reduce((s, q) => s + q.x - J.holes[meas.indexOf(q)].x, 0) / found.length : 0;
    const oy = found.length ? found.reduce((s, q) => s + q.y - J.holes[meas.indexOf(q)].y, 0) / found.length : 0;
    const clr = (D.clr - D.d) / 2;
    st = { placed:false, drop:0, ox, oy, order:[], early:0, cost:0, coil:0, hold:null, finish:0, toolT:0, lastWheel:0,
      bolts:J.holes.map((h, i) => {
        const q = meas[i], res = q.none ? 99 : Math.hypot(q.x - (h.x + ox), q.y - (h.y + oy));
        return { i, q, res, zor:res > clr && res <= clr + 0.25, st:'bos', tq:0, z:0, ang:0, coil:false, mesh:null, hit:null, lb:null };
      }) };
    st.tw = tower(); st.tw.position.copy(P3(m.cx + ox, m.cy + oy, PH + 70)); grp.add(st.tw);
    st.al = allen(); grp.add(st.al); st.wr = wrench(); grp.add(st.wr);
    for (const b of st.bolts) {
      const h = J.holes[b.i];
      b.hit = new THREE.Mesh(new THREE.CylinderGeometry(D.head / 2 + 2, D.head / 2 + 2, 34, 12), mats.hit);
      b.hit.position.copy(P3(h.x + ox, h.y + oy, PH + m.tf + 12)); b.hit.userData.b = b; grp.add(b.hit);
      b.lb = document.createElement('div'); b.lb.className = 'mt-num'; b.lb.textContent = b.i + 1; document.body.append(b.lb);
    }
    panel();
  }
  function place() {
    if (st.placed) return;
    st.placed = true; st.drop = 1; thud(120, 0.15, 0.2);
    hint('Kule yerinde. Cıvata takmak için deliğe tıklayın.');
    panel();
  }
  // cıvata deliğin ağzına konur; elle ne kadar inebileceği diş ve kaçıklığa bağlı (goal)
  function insert(b) {
    const clr = (D.clr - D.d) / 2, q = b.q, th = b.coil ? { ok:true, L:need() + 2 } : q.th, n = b.i + 1;
    let goal, why = '';
    if (q.none) { goal = need(); why = `Delik ${n}: plakada delik yok, cıvata plakanın üstünde duruyor.`; }
    else if (b.res > clr + 0.25) { goal = need(); why = `Delik ${n}: delik ${b.res.toFixed(2)} mm kaçık; cıvata flanşın deliğinden plakadaki dişe ulaşamıyor.`; }
    else if (!th) { goal = need(); why = `Delik ${n}: delikte diş yok, cıvata boşa dönüyor. Kılavuz çekmeyi unuttunuz.`; }
    else if (!th.ok) { goal = need() - 1; why = `Delik ${n}: diş adımı tutmuyor (${th.th.p} mm), ${m.bolt} cıvata bir turda kasıldı.`; }
    else if (th.L < need() - 0.3) { goal = need() - th.L; why = `Delik ${n}: diş ${th.L.toFixed(1)} mm, cıvata ${need()} mm ister. Cıvata dişin sonuna dayandı, başı ${goal.toFixed(1)} mm havada.`; }
    else goal = 0;
    b.mesh = bolt(); grp.add(b.mesh);
    Object.assign(b, { st:'agiz', z:need() + 14, fall:true, goal, why, told:false, ang:0, tick:0, tq:0, half:false });
    hint(`Cıvata ${n} delikte. Üstünde tekerleği çevirin (ya da basılı tutun): alyanla vidalanır.`);
    thud(380, 0.05, 0.05); panel();
  }
  function remove(b) {
    if (b.mesh) grp.remove(b.mesh);
    Object.assign(b, { mesh:null, st:'bos', z:0, ang:0, tq:0, half:false });
    st.order = st.order.filter(i => i !== b.i);
  }
  // elle çevirme (alyan): da > 0 sıkar. Oturunca 'el', geri çevirince çıkar
  function turn(b, da) {
    if (b.st !== 'agiz' || b.fall) return;
    const z0 = b.z;
    b.z = clamp(b.z - da / (Math.PI * 2) * D.p, b.goal, need() + 6);
    b.ang += da;
    if ((b.tick += Math.abs(da)) > Math.PI / 2) { b.tick = 0; if (ac) noiseHit(ac.currentTime, 'bandpass', 4200, 4, 0.05, 0.012); }   // cırcır
    if (da > 0 && b.z <= b.goal + 1e-6) {
      if (b.goal === 0) { b.st = 'el'; b.elT = performance.now(); thud(260, 0.06, 0.05); hint(b.zor ? `Cıvata ${b.i + 1} zorlanarak oturdu (delik ${b.res.toFixed(2)} mm kaçık); flanş hafif gerildi. Şimdi tork anahtarı.` : `Cıvata ${b.i + 1} oturdu. Şimdi tork anahtarı: tekerleği yavaşça çevirin, ibre yeşilde durun.`); panel(); }
      else if (!b.told) { b.told = true; if (z0 > b.goal + 1e-6) thud(420, 0.08, 0.06); hint(b.why); panel(); }
    }
    if (da < 0 && b.z >= need() + 6) { remove(b); hint(`Cıvata ${b.i + 1} çıkarıldı.`); panel(); }
  }
  // tork: n tekerlek çentiği; hızlı çevirince çentik başına artış büyür (taşırma kolay)
  function torque(b, add) {
    if (b.st !== 'el') return;
    b.tq += add; b.ang += add * 0.012;
    if (b.tq >= tq0() * 0.5 && !b.half) { b.half = true; if (st.bolts.some(o => o !== b && o.st !== 'el' && o.st !== 'siyrik')) st.early++; }   // diğer cıvatalar oturmadan sıkmak
    if (b.tq >= tq0() && !st.order.includes(b.i)) st.order.push(b.i);
    if (b.tq > strip()) {
      b.st = 'siyrik'; st.hold = null; controls.enabled = true;
      noiseHit(ac ? ac.currentTime : 0, 'lowpass', 900, 0.8, 0.4, 0.3); metalRing(700, 0.05, 0.5);
      hint(`Cıvata ${b.i + 1}: alüminyumda diş sıyırdı! Cıvata boşa dönüyor. Yay diş (Heli-Coil) takıp yeniden deneyin.`);
      log(`Montaj: cıvata ${b.i + 1} dişi sıyırdı (${b.tq.toFixed(1)} Nm).`, 'warn');
      panel();
    }
    gauge(b.tq);
  }
  function step(dt) {
    if (!st) return;
    if (cam) {                                                     // kamera geçişi: yumuşak başlayıp yumuşak durur
      cam.t = Math.min(1, cam.t + dt / 1.3);
      const e = cam.t < 0.5 ? 4 * cam.t ** 3 : 1 - (-2 * cam.t + 2) ** 3 / 2;
      const u = 1 - e;                                             // ikinci derece Bézier: tezgâhın üstünden ve önünden yay çizer
      camera.position.set(0, 0, 0).addScaledVector(cam.p0, u * u).addScaledVector(cam.pc, 2 * u * e).addScaledVector(cam.p1, e * e);
      controls.target.lerpVectors(cam.t0, cam.t1, e);
      if (cam.t >= 1) { const f = cam.done; cam = null; controls.enabled = true; if (f) f(); }
    }
    if (st.drop > 0) { st.drop = Math.max(0, st.drop - dt * 2.2); st.tw.position.y = PH + 70 * st.drop * st.drop; if (!st.drop) thud(90, 0.25, 0.25); }
    for (const b of st.bolts) if (b.fall) { b.z = Math.max(need(), b.z - 90 * dt); if (b.z <= need()) b.fall = false; }
    const H0 = st.hold;
    if (H0) {                                                      // basılı tutma: elle vidalama ya da çektikçe hızlanan tork
      const b = H0.b, t = (performance.now() - H0.t0) / 1000;
      if (b.st === 'agiz') turn(b, Math.PI * 5 * dt);
      else if (b.st === 'el') torque(b, tq1() * (0.12 + 0.9 * t) * dt);
    }
    for (const b of st.bolts) if (b.mesh) {
      const h = J.holes[b.i];
      b.mesh.position.copy(P3(h.x + st.ox, h.y + st.oy, PH + m.tf + b.z)); b.mesh.rotation.y = -b.ang;
    }
    // alet: imlecin altındaki (ya da tutulan) cıvatada; oturmamışsa alyan, oturmuşsa tork anahtarı
    const tb = (st.hold && st.hold.b) || (performance.now() - st.toolT < 900 ? st.toolB : null) || hover;
    const showA = tb && tb.st === 'agiz' && !tb.fall, showW = tb && tb.st === 'el';
    st.al.visible = !!showA; st.wr.visible = !!showW;
    if (tb && (showA || showW)) {
      const h = J.holes[tb.i], p = P3(h.x + st.ox, h.y + st.oy, PH + m.tf + tb.z);
      st.al.position.copy(p); st.al.rotation.y = -tb.ang;
      st.wr.position.copy(p); st.wr.rotation.y = -tb.ang * 0.6 + st.wrA;
      if (showW) gauge(tb.tq);
    }
    if (st.finish) {                                               // sensör ışığı yandı: kısa bekleyip rapora geç
      st.finish -= dt;
      mats.led.emissive.setRGB(0.1, 1.6 + Math.sin(performance.now() / 90) * 0.4, 0.3);
      if (st.finish <= 0) { st.finish = 0; close(true); }
    }
  }
  function gauge(v) {                                             // ibre: 0 … sıyırma eşiğinin biraz üstü
    const max = strip() * 1.1, a = -120 + 240 * clamp(v / max, 0, 1);
    $('mtNeedle').setAttribute('transform', `rotate(${a})`);
    $('mtTq').textContent = v.toFixed(1) + ' Nm';
  }
  function gaugeSVG() {
    const max = strip() * 1.1, A = v => (-120 + 240 * v / max) * Math.PI / 180;
    const arc = (v0, v1, col, w) => { const a0 = A(v0), a1 = A(v1), R = 44; return `<path d="M${Math.sin(a0) * R} ${-Math.cos(a0) * R} A${R} ${R} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${Math.sin(a1) * R} ${-Math.cos(a1) * R}" stroke="${col}" stroke-width="${w}" fill="none"/>`; };
    let s = `<svg viewBox="-60 -56 120 92" aria-label="Tork göstergesi"><circle r="52" fill="#0f1214" stroke="#3a4044" stroke-width="2"/>`;
    s += arc(0, max, '#3a4044', 3) + arc(tq0(), tq1(), '#3fd47a', 7) + arc(strip(), max, '#e5484d', 7);
    for (let v = 0; v <= max; v += max > 40 ? 10 : 2) { const a = A(v); s += `<line x1="${Math.sin(a) * 36}" y1="${-Math.cos(a) * 36}" x2="${Math.sin(a) * 40}" y2="${-Math.cos(a) * 40}" stroke="#cfd5d1" stroke-width="1.2"/><text x="${Math.sin(a) * 28}" y="${-Math.cos(a) * 28 + 3}" font-size="7.5" fill="#cfd5d1" text-anchor="middle">${v}</text>`; }
    s += `<g id="mtNeedle"><line x1="0" y1="6" x2="0" y2="-46" stroke="#ff5a4a" stroke-width="2.4" stroke-linecap="round"/></g><circle r="4" fill="#cfd5d1"/><text y="24" font-size="8" fill="#9aa3a6" text-anchor="middle">Nm</text></svg>`;
    return s;
  }
  const stTxt = b => b.st === 'bos' ? 'boş' : b.st === 'siyrik' ? 'DİŞ SIYIRDI'
    : b.st === 'el' ? 'oturdu' : b.fall ? 'deliğe kondu' : b.z <= b.goal + 1e-6 && b.goal > 0 ? { [need()]:'girmiyor', [need() - 1]:'diş uymuyor' }[b.goal] || 'dibe dayandı' : 'vidalanıyor';
  // cıvata listesi, adımlar ve düğmeler
  function panel() {
    const B = st.bolts, all = B.every(b => b.st === 'el' && b.tq >= tq0());
    $('mtSteps').innerHTML = [
      [st.placed, 'Kuleyi plakaya yerleştirin'],
      [B.every(b => b.st === 'el'), 'Cıvatayı deliğe koyun (tıklayın), alyanla vidalayın: üstünde tekerlek ya da basılı tut'],
      [all, `Tork anahtarıyla çapraz sırayla (1-3-2-4) ${tq0()}–${tq1()} Nm: tekerleği yavaş çevirin`],
    ].map(([ok, t]) => `<li class="${ok ? 'ok' : ''}">${t}</li>`).join('');
    $('mtList').innerHTML = B.map(b => `<li class="${b.st === 'el' ? (b.tq >= tq0() && b.tq <= tq1() ? 'ok' : b.tq > tq1() ? 'warn' : '') : b.st === 'siyrik' || (b.st === 'agiz' && b.goal > 0 && b.z <= b.goal + 1e-6) ? 'bad' : ''}"><b>${b.i + 1}</b> ${stTxt(b)}${b.tq ? ` · ${b.tq.toFixed(1)} Nm` : ''}${b.coil ? ' · yay diş' : ''}${b.zor && b.st === 'el' ? ' · zorlandı' : ''}</li>`).join('');
    $('mtPlace').hidden = st.placed;
    const bad = B.filter(b => b.st === 'siyrik');
    $('mtCoil').hidden = !bad.length; $('mtCoil').textContent = `Yay diş tak (${bad.length} delik, ${bad.length * COIL} ₺)`;
    $('mtOrder').textContent = st.order.length ? 'Sıkma sırası: ' + st.order.map(i => i + 1).join('-') : '';
  }

  /* -- Fare: ana tuvalde, montaj açıkken. Pencere düzeyinde yakalanır: cıvatanın üstündeyse kamera ve tezgâh aletleri olayı almaz -- */
  function pickBolt(e) {
    const rc = canvas.getBoundingClientRect();
    ndc.set((e.clientX - rc.left) / rc.width * 2 - 1, -(e.clientY - rc.top) / rc.height * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hits = ray.intersectObjects(st.bolts.map(b => b.hit), false);
    return hits.length ? hits[0].object.userData.b : null;
  }
  const active = e => open && st && !cam && e.target === canvas;
  function down(e) {
    if (!active(e) || e.button !== 0 || st.finish) return;
    initAudio();
    const b = pickBolt(e);
    if (!b) return;                                                // boşluk: kamera döner
    e.preventDefault(); e.stopImmediatePropagation(); controls.enabled = false;
    if (!st.placed) { hint('Önce kuleyi plakaya yerleştirin.'); return; }
    if (b.st === 'bos') { insert(b); return; }
    if (b.st === 'agiz' || b.st === 'el') {
      st.hold = { b, t0:performance.now() };
      st.wrA = Math.atan2(camera.position.z - (BZ), camera.position.x - BX) - Math.PI / 2;
      if (b.st === 'el') $('mtGauge').classList.add('on');
    }
  }
  function up() {
    if (!st || !st.hold) return;
    const b = st.hold.b, short = performance.now() - st.hold.t0 < 220;
    st.hold = null; controls.enabled = true; $('mtGauge').classList.remove('on');
    if (b.st === 'agiz' && short && b.goal > 0 && b.z <= b.goal + 1e-6) { remove(b); hint(`Cıvata ${b.i + 1} çıkarıldı.`); panel(); return; }   // takılan cıvatayı tıklayınca çıkar
    if (b.st === 'el' && b.tq > 0) tqHint(b);
    panel();
  }
  function tqHint(b) {
    if (b.tq >= tq0() && b.tq <= tq1()) hint(`Cıvata ${b.i + 1}: ${b.tq.toFixed(1)} Nm, tamam.`);
    else if (b.tq > tq1()) hint(`Cıvata ${b.i + 1}: ${b.tq.toFixed(1)} Nm, fazla sıkıldı (dişi zorladınız).`);
    else hint(`Cıvata ${b.i + 1}: ${b.tq.toFixed(1)} Nm, henüz az.`);
  }
  function move(e) {
    if (!active(e) || e.buttons) return;
    hover = pickBolt(e); canvas.style.cursor = hover ? 'pointer' : '';
    if (hover && hover.st === 'el') gauge(hover.tq);
  }
  // tekerlek: aşağı sıkar, yukarı gevşetir. Bir çentik alyanda yarım tur; torkta üst torkun %6'sı, hızlı çevirince 3 katına kadar
  function wheel(e) {
    if (!active(e) || st.finish) return;
    const b = pickBolt(e);
    if (!b || b.st === 'bos' || b.st === 'siyrik') return;         // boşlukta tekerlek: yakınlaştırma
    e.preventDefault(); e.stopImmediatePropagation(); initAudio();
    const n = e.deltaY * (e.deltaMode === 1 ? 33 : e.deltaMode === 2 ? 400 : 1) / 100;
    const now = performance.now(), dtW = now - st.lastWheel; st.lastWheel = now; st.toolB = b; st.toolT = now;
    if (b.st === 'agiz') { turn(b, n * Math.PI); panel(); return; }
    if (n < 0) {                                                   // gevşet: tork sıfırlanır, sonra cıvata yeniden elle çevrilebilir
      if (b.tq > 0) { b.tq = 0; b.half = false; st.order = st.order.filter(i => i !== b.i); hint(`Cıvata ${b.i + 1} gevşetildi.`); gauge(0); }
      else { b.st = 'agiz'; turn(b, n * Math.PI); }
      panel(); return;
    }
    if (now - (b.elT || 0) < 450) return;                         // alyandan tork anahtarına geçerken aynı çevirmenin artığı sıkmaz
    const k = dtW < 40 ? 3 : dtW < 90 ? 2 : dtW < 160 ? 1.4 : 1;  // tekerleği hızlı çevirmek ibreyi zıplatır
    st.wrA = Math.atan2(camera.position.z - BZ, camera.position.x - BX) - Math.PI / 2;
    torque(b, tq1() * 0.06 * n * k);
    if (b.st === 'el') { if (ac) noiseHit(ac.currentTime, 'bandpass', 2600, 3, 0.03, 0.01); tqHint(b); }
    panel();
  }
  window.addEventListener('pointerdown', down, true);
  window.addEventListener('pointerup', up);
  window.addEventListener('pointermove', move);
  window.addEventListener('wheel', wheel, { capture:true, passive:false });

  function coil() {
    const bad = st.bolts.filter(b => b.st === 'siyrik');
    for (const b of bad) { remove(b); b.coil = true; }
    st.cost += bad.length * COIL; st.coil += bad.length;
    beep(900, 0.08); hint(`Yay diş takıldı: ${bad.length} delik, −${bad.length * COIL} ₺. Cıvatayı yeniden takın.`);
    panel();
  }
  function unscrew() {
    for (const b of st.bolts) if (b.st !== 'siyrik') remove(b);
    st.early = 0;
    hint('Cıvatalar söküldü.'); panel();
  }
  // montaj ölçüleri: her cıvatanın torku ve flanşın oturması (sıra hatası, erken sıkma ve zorlanan delik eğiklik yapar)
  function result() {
    const out = [], add = (grp, label, nom, meas, ok, sc, w = 1) => out.push({ grp, label, nom, meas, ok, sc:clamp(sc, 0, 1), w });
    for (const b of st.bolts) {
      const ok = b.st === 'el' && b.tq >= tq0() && b.tq <= tq1();
      const meas = b.st === 'el' ? b.tq.toFixed(1) + ' Nm' + (b.tq < tq0() ? ' (gevşek)' : b.tq > tq1() ? ' (fazla)' : '') : stTxt(b);
      add('V' + (b.i + 1), 'Cıvata torku', `${tq0()}–${tq1()} Nm`, meas, ok, ok ? 1 : b.st === 'el' ? (b.tq < tq0() ? b.tq / tq0() * 0.6 : 0.5) : 0, 2);
    }
    const o = st.order, opp = (a, c) => a != null && c != null && Math.abs(a - c) === 2;
    const cross = (o.length >= 2 && !opp(o[0], o[1]) ? 1 : 0) + (o.length >= 4 && !opp(o[2], o[3]) ? 1 : 0);
    const gap = cross * 0.03 + st.early * 0.04 + st.bolts.filter(b => b.zor && b.st === 'el').length * 0.02;
    add('Montaj', 'Flanş oturması', '≤ 0.05', gap.toFixed(2) + (o.length ? ` (sıra ${o.map(i => i + 1).join('-')})` : ''), gap <= 0.05 && o.length === 4, gap <= 0.05 ? 1 : Math.max(0, 1 - (gap - 0.05) / 0.1), 2);
    return out;
  }
  function finish() {
    if (st.hold || st.finish || cam) return;
    const extra = result(), ok = extra.every(i => i.ok) && items0.every(i => i.ok);
    st.extra = extra;
    if (ok) { st.finish = 1.6; beep(1200, 0.1); setTimeout(() => beep(1600, 0.14), 140); hint('Sensör yandı: konveyör çalışıyor!'); }
    else close(true);
  }

  /* -- Aç / kapat: kamera tezgâha süzülür, dönüşte eski yerine; tezgâhtaki parça montaj boyunca gizlenir -- */
  const _v = new THREE.Vector3();
  function loop(t) {
    if (!open) return;
    const dt = Math.min(0.05, last ? (t - last) / 1000 : 0.016); last = t;
    S.duraklat = true;                                             // menü kapanınca tezgâh kendiliğinden yürümesin
    step(dt);
    const rc = canvas.getBoundingClientRect();
    for (const b of st.bolts) {
      b.hit.getWorldPosition(_v); _v.y += D.d + 6 - 12; _v.project(camera);   // cıvata başının hemen üstü
      b.lb.style.left = (rc.left + (_v.x + 1) / 2 * rc.width) + 'px'; b.lb.style.top = (rc.top + (1 - _v.y) / 2 * rc.height) + 'px';
      b.lb.style.display = _v.z < 1 && st.placed && !cam ? '' : 'none';
      b.lb.className = 'mt-num ' + (b.st === 'el' && b.tq >= tq0() && b.tq <= tq1() ? 'ok' : b.st === 'siyrik' || (b.st === 'agiz' && b.goal > 0 && b.z <= b.goal + 1e-6) ? 'bad' : '');
    }
    raf = requestAnimationFrame(loop);
  }
  function partOnMachine(v) {
    if (topMesh) topMesh.visible = v; if (stockBase) stockBase.visible = v;
    for (const w of walls) w.w.m.visible = v;
    for (const th of threads) if (th.mesh) th.mesh.visible = v;
  }
  function fly(p1, t1, cb) {
    const p0 = camera.position.clone(), pc = p0.clone().lerp(p1, 0.5);
    pc.y = Math.max(p0.y, p1.y) + 700; pc.z = Math.max(p0.z, p1.z) + 700;   // kontrol noktası yukarıda ve odanın ortasına doğru
    cam = { t:0, p0, pc, t0:controls.target.clone(), p1, t1, done:cb }; controls.enabled = false;
  }
  function show(run0, items, cb) {
    run = run0; items0 = items; done = cb; J = run.J; m = J.montaj; D = DIS[m.bolt];
    if (app.FD && app.FD.on) app.FD.setOn(false); if (app.AG && app.AG.on) app.AG.setOn(false);
    open = true; S.duraklat = true; S.montaj = true;
    document.body.classList.add('montaj-on'); $('montaj').hidden = false;
    mats.led.emissive.setRGB(0, 0, 0);
    build(); grp.visible = true; partOnMachine(false);
    $('mtInfo').textContent = `Sensör kulesi · 4×${m.bolt}×${m.L} imbus · ${D.tq[0]}–${D.tq[1]} Nm`;
    $('mtGauge').innerHTML = gaugeSVG(); gauge(0);
    st.back = { p:camera.position.clone(), t:controls.target.clone(), min:controls.minDistance, max:controls.maxDistance, pan:controls.enablePan, pol:controls.maxPolarAngle };
    const c = P3(m.cx - PW / 2, m.cy - PD / 2, 0);              // kulenin tezgâhtaki yeri (grp merkezine göre)
    const tx = BX + c.x, tz = BZ + c.z;
    fly(new THREE.Vector3(tx + 95, BY + 175, tz + 225), new THREE.Vector3(tx, BY + 45, tz), () => {
      controls.minDistance = 90; controls.maxDistance = 700; controls.enablePan = false; controls.maxPolarAngle = Math.PI * 0.47;
    });
    hint('Parça çalışma tezgâhında, müşterinin sensör kulesi yanında. "Kuleyi yerleştir" ile plakaya koyun.');
    last = 0; cancelAnimationFrame(raf); raf = requestAnimationFrame(loop);
  }
  // deliver: true montaj sonucunu teslim eder; false tezgâha döner (iş sürer, delik/diş düzeltilebilir)
  function close(deliver) {
    if (!open) return;
    const B = st.back;
    Object.assign(controls, { minDistance:B.min, maxDistance:B.max, enablePan:B.pan, maxPolarAngle:B.pol });
    document.body.classList.remove('montaj-on'); $('montaj').hidden = true; hint('');
    for (const b of st.bolts) b.lb.remove();
    st.hold = null; hover = null; canvas.style.cursor = '';
    fly(B.p, B.t, () => {
      open = false; S.montaj = false; S.duraklat = false; cancelAnimationFrame(raf);
      grp.visible = false; partOnMachine(true);
      if (!deliver) { log('Montaj bırakıldı: parça tezgâhta. Delikleri düzeltip yeniden teslim edebilirsiniz.', 'warn'); return; }
      run.montaj = { cost:st.cost, coil:st.coil };
      const f = done; done = null; f(st.extra || result());
    });
  }
  $('mtPlace').addEventListener('click', () => { initAudio(); place(); });
  $('mtCoil').addEventListener('click', coil);
  $('mtUndo').addEventListener('click', unscrew);
  $('mtDone').addEventListener('click', finish);
  $('mtBack').addEventListener('click', () => close(false));
  window.addEventListener('keydown', e => { if (!open) return; e.stopImmediatePropagation(); if (e.code === 'Escape') close(false); }, true);   // tezgâh tuşları montajda çalışmaz
  return { open:show, close, get st() { return st; }, step };
})();

Object.assign(app, { MT });

export { MT };
