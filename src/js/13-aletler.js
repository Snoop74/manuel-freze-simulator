// ── Aletler: makine üstü etkileşim (IA), fareyle sürme (FD), hava tabancası (AG), mekanik taster (DT), 3B taster (PR), vakum (VAC), bağlama ve paralel seçimi
import { $, C, H, PD, PH, PW, S, TAU, app, log, tipZ, tool, warnOnce } from './00-temel.js';
import { SN, ac, beep, bus, initAudio, metalRing, noiseBuffer, noiseHit, thud } from './01-ses.js';
import { HOSE, bStart, box, camera, canvas, controls, coolHandle, coolValve, cyl, hoseGrp, motorSwitch, mush, scene, setHose, smat,
  stage, zFine, zLever } from './02-sahne-tezgah.js';
import { FIXLIM, FIXNAME, ROT, pfLever, wheels, yWheel } from './03-tabla-parca.js';
import { FIX, PAR, buildVise, clampLay, nV, parAxis, parConflicts, setClampLay, setFIX, stockBase, topMesh,
  walls, warnParallels } from './05-baglama.js';
import { burst, emit, groundAt, liveChips } from './06-talas.js';
import { TMAT, dialNeedle, dialTurns } from './07-takim-gorsel.js';
import { crash, interfere, stopMotion } from './08-kesme.js';
import { TICK, fmt, setAuto, spindle, wheelTicks } from './09-kumanda.js';
import { JOBS, drawingSVG, selJob } from './10-is-emri-muayene.js';

const IA = (() => {
  const T = [
    { o:wheels[0].children[0], wheel:'x', tip:'Tabla çarkı (X) · sürükle ya da tekerlekle çevir' },
    { o:wheels[1].children[0], wheel:'x', tip:'Tabla çarkı (X) · sürükle ya da tekerlekle çevir' },
    { o:yWheel, wheel:'y', tip:'Kızak çarkı (Y) · sürükle ya da tekerlekle çevir' },
    { o:zLever, wheel:'z', nrm:[1, 0, 0], tip:'Kovan kolu (Z) · sürükle ya da tekerlekle çevir' },
    { o:zFine, wheel:'z', tip:'Kovan ince ilerleme çarkı (Z) · sürükle ya da tekerlekle çevir' },
    { o:motorSwitch, tip:() => 'Motor şalteri · ' + (S.spindle ? 'tıkla: MİLİ DURDUR' : 'tıkla: MİLİ ÇALIŞTIR'), act:() => $(S.spindle ? 'spStop' : 'spStart').click() },
    { o:bStart, tip:'MİL START', act:() => $('spStart').click() },
    { o:mush, tip:'ACİL STOP', act:() => $('estopBtn').click() },
    { o:pfLever.parent, tip:() => 'Otomatik tabla ilerleme kolu · ' + (S.autoX ? 'tıkla: dur' : `tıkla: ${S.lastAuto > 0 ? 'sağa' : 'sola'} başlat`), act:() => setAuto(S.autoX ? 0 : S.lastAuto) },
    { o:coolValve, tip:() => 'Soğutma vanası · ' + (S.coolant ? 'tıkla: kapat' : 'tıkla: aç'), act:() => $('coolant').click() },
    { o:hoseGrp, hose:true, noScale:true, tip:'Soğutma hortumu · sürükle: memeyi takımın çevresinde döndür, yukarı-aşağı eğ' },
  ];
  T.forEach(t => t.o.traverse(m => { m.userData.ia = t; }));
  const objs = T.map(t => t.o), ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  const tip = document.createElement('div'); tip.className = 'ia-tip'; tip.hidden = true; stage.append(tip);
  let hover = null, drag = null;
  function pick(e) {
    const r = canvas.getBoundingClientRect();
    ndc.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const h = ray.intersectObjects(objs, true)[0];
    return h ? h.object.userData.ia : null;
  }
  function setHover(t, e) {
    if (hover && hover !== t && !hover.noScale) hover.o.scale.setScalar(1);
    hover = t;
    canvas.style.cursor = t ? (t.wheel || t.hose ? (drag ? 'grabbing' : 'grab') : 'pointer') : '';
    if (!t) { tip.hidden = true; return; }
    if (!t.noScale) t.o.scale.setScalar(1.06);
    const r = stage.getBoundingClientRect();
    tip.textContent = typeof t.tip === 'function' ? t.tip() : t.tip; tip.hidden = false;
    tip.style.left = (e.clientX - r.left + 16) + 'px'; tip.style.top = (e.clientY - r.top + 14) + 'px';
  }
  // çarkın ekrandaki merkezi ve operatöre bakıp bakmadığı (arkadan bakınca yön ters)
  const cv = new THREE.Vector3(), nv = new THREE.Vector3();
  function wheelFrame(t) {
    t.o.getWorldPosition(cv);
    nv.set(...(t.nrm || [0, 0, 1])).transformDirection(t.o.matrixWorld);
    const facing = nv.dot(camera.position.clone().sub(cv)) >= 0 ? 1 : -1;
    cv.project(camera);
    const r = canvas.getBoundingClientRect();
    return { x:r.left + (cv.x + 1) / 2 * r.width, y:r.top + (1 - cv.y) / 2 * r.height, facing };
  }
  canvas.addEventListener('pointerdown', e => {
    const t = pick(e); if (!t) return;
    e.preventDefault(); e.stopImmediatePropagation(); controls.enabled = false; initAudio();
    if (t.hose) {                                                // hortum: yatay sürükleme döndürür, dikey eğer
      try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
      drag = { t, hose:true, x:e.clientX, y:e.clientY, az:HOSE.az, el:HOSE.el };
      setHover(t, e);
    } else if (t.wheel) {
      try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
      const f = wheelFrame(t);
      drag = { t, f, last:Math.atan2(e.clientY - f.y, e.clientX - f.x), acc:0 };
      setHover(t, e);
    } else { t.act(); thud(200, 0.08, 0.06); setHover(t, e); }
  }, true);
  canvas.addEventListener('pointermove', e => {
    if (drag && drag.hose) { setHose(drag.az - (e.clientX - drag.x) * 0.012, drag.el + (e.clientY - drag.y) * 0.008); return; }
    if (drag) {
      const a = Math.atan2(e.clientY - drag.f.y, e.clientX - drag.f.x);
      let d = a - drag.last; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU;
      drag.last = a; drag.acc += d * drag.f.facing;
      const n = Math.trunc(drag.acc / TICK);
      if (n) { drag.acc -= n * TICK; wheelTicks(drag.t.wheel, n); }
      return;
    }
    if (e.buttons) return;          // kamera döndürülürken üstünden geçilen kumandayı vurgulama
    setHover(pick(e), e);
  });
  const end = () => { if (drag) { if (drag.hose) setHose(HOSE.az, HOSE.el, true); drag = null; canvas.style.cursor = hover ? 'grab' : ''; } controls.enabled = true; };
  canvas.addEventListener('pointerup', end); canvas.addEventListener('pointercancel', end);
  canvas.addEventListener('pointerleave', () => { if (!drag) setHover(null); });
  canvas.addEventListener('wheel', e => {
    const t = pick(e); if (!t || !t.wheel) return;   // hortumun üstünde tekerlek kamerayı yakınlaştırır
    e.preventDefault(); e.stopImmediatePropagation(); initAudio();
    const f = wheelFrame(t);
    wheelTicks(t.wheel, (e.deltaY < 0 ? 1 : -1) * f.facing);
  }, { capture:true, passive:false });
  function update(dt) {
    coolHandle.rotation.y += ((S.coolant ? 0 : Math.PI / 2) - coolHandle.rotation.y) * Math.min(1, dt * 10);
    if (hover && !tip.hidden && typeof hover.tip === 'function') tip.textContent = hover.tip();
  }
  return { update };
})();

/* ---------------- Fareyle sürme: parçanın üstünde basılı tutup sürükleyince takım farenin peşinden gider ----------------
   Kalemle yazar gibi: fare sağa giderse takım parçaya göre sağa gider (tabla sola kayar). Hız ilerleme ayarıyla sınırlı. */
const FD = (() => {
  let on = false, drag = false;
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), pl = new THREE.Plane(new THREE.Vector3(0, 1, 0), -PH), hp = new THREE.Vector3(), last = new THREE.Vector3();
  function hit(e) {
    const r = canvas.getBoundingClientRect();
    ndc.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1);
    ray.setFromCamera(ndc, camera);
    return ray.ray.intersectPlane(pl, hp) ? hp : null;
  }
  const overPart = p => { const x = p.x + S.px, y = S.py - p.z; return x > -30 && x < PW + 30 && y > -30 && y < PD + 30; };
  function setOn(v) {
    on = v; drag = false; canvas.style.cursor = '';
    if (on && AG.on) AG.setOn(false);
    $('drawMode').textContent = 'Fareyle sür: ' + (on ? 'AÇIK' : 'KAPALI'); $('drawMode').classList.toggle('start', on); $('tbFd').classList.toggle('on', on);
    if (on) log('Fareyle sürme açık: parçanın üstünde sol tuşu basılı tutup sürükleyin, takım farenin peşinden gider. Önce Z ile derinliği verin, mili çalıştırın.', 'ok');
  }
  $('drawMode').addEventListener('click', () => setOn(!on));
  canvas.addEventListener('pointerdown', e => {
    if (!on || e.button !== 0 || S.tap) return;
    const p = hit(e); if (!p || !overPart(p)) return;
    e.preventDefault(); e.stopImmediatePropagation(); controls.enabled = false; initAudio();
    try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
    drag = true; last.copy(p); canvas.style.cursor = 'grabbing';
  }, true);
  canvas.addEventListener('pointermove', e => {
    if (!on) return;
    const p = hit(e);
    if (!drag) { canvas.style.cursor = p && overPart(p) ? 'crosshair' : ''; return; }
    if (!p || S.alarm || S.changing) return;
    S.pend.x += p.x - last.x; S.pend.y += -(p.z - last.z); last.copy(p);
  });
  const end = () => { if (drag) { drag = false; controls.enabled = true; canvas.style.cursor = on ? 'crosshair' : ''; } };
  canvas.addEventListener('pointerup', end); canvas.addEventListener('pointercancel', end);
  return { setOn, get on() { return on; } };
})();
/* ---------------- Hava tabancası: talaşı üfle ----------------
   Açıkken parçanın, mengenenin ya da tablanın üstünde sol tuşu basılı tut: tabanca imlecin olduğu yere üfler.
   Yatan talaş havalanıp nozülden uzağa savrulur, uçan talaş itilir; hava parçayı da biraz soğutur. */
const AG = (() => {
  let on = false, blowing = false, aim = null, hiss = null, puff = 0;
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), P = new THREE.Vector3(), tipW = new THREE.Vector3(), dh = new THREE.Vector3();
  const gun = new THREE.Group(); gun.visible = false; scene.add(gun);
  {
    const blue = smat(0x2d68b0, 0.42, 0.25), metal = smat(0xb9bfc3, 0.25, 0.9), blk = smat(0x1c1e20, 0.65, 0.1);
    box(10, 13, 36, blue, 0, 0, -4, gun);                                          // gövde
    const h = box(9, 28, 13, blk, 0, -16, -14, gun); h.rotation.x = 0.28;          // sap
    box(2.4, 9, 3, metal, 0, -9, 4, gun);                                          // tetik
    const nz = cyl(1.4, 2.4, 30, metal, 16); nz.rotation.x = Math.PI / 2; nz.position.z = 28; gun.add(nz);   // nozül
    const hs = cyl(3.2, 3.2, 45, blk, 12); hs.position.set(0, -42, -34); hs.rotation.x = -0.55; gun.add(hs);   // hortum: saptan aşağı ve geriye
    box(13, 6, 6, metal, 0, -30, -20, gun);                                        // hortum rakoru
    gun.scale.setScalar(1.35);
    gun.traverse(o => { o.castShadow = false; });
  }
  // imlecin gösterdiği yüzey: önce parça üstü düzlemi, sonra o noktadaki zeminin yüksekliğiyle yeniden kesiştirilir
  function pick(e) {
    const r = canvas.getBoundingClientRect();
    ndc.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1);
    ray.setFromCamera(ndc, camera);
    let y = PH, best = null;                                       // kenarda yeniden kesişim boşa düşerse ilk geçerli nokta kalır
    for (let k = 0; k < 3; k++) {
      if (!ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -y), P)) break;
      const g = groundAt(P.x + S.px, S.py - P.z);
      if (g < -9000) break;
      best = P.clone(); best.y = g;
      if (Math.abs(g - y) < 0.5) break;
      y = g;
    }
    return best;
  }
  function place() {
    if (!aim) { gun.visible = false; return; }
    dh.set(aim.x - camera.position.x, 0, aim.z - camera.position.z);
    if (dh.lengthSq() < 1) dh.set(0, 0, -1);
    dh.normalize();
    // kameranın sağ yanından tutulur: tabanca profilden görünür, imleci kapatmaz
    gun.position.copy(aim).addScaledVector(dh, -40); gun.position.x += -dh.z * 42; gun.position.z += dh.x * 42; gun.position.y += 42;
    gun.lookAt(aim); gun.visible = true;
  }
  function sound(v) {
    if (!ac || !SN) return;
    if (!hiss) {
      const s = ac.createBufferSource(); s.buffer = noiseBuffer(false); s.loop = true;
      const hp = ac.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1500;
      const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 4200; bp.Q.value = 0.5;
      hiss = ac.createGain(); hiss.gain.value = 0;
      s.connect(hp); hp.connect(bp); bp.connect(hiss); hiss.connect(bus); s.start();
    }
    hiss.gain.setTargetAtTime(v ? 0.16 : 0, ac.currentTime, v ? 0.03 : 0.08);
    if (v) noiseHit(ac.currentTime, 'highpass', 2500, 0.7, 0.12, 0.08);           // tetiğin ilk "pışşt"ı
  }
  function setOn(v) {
    if (v && !app.CR.hasEq('air')) { log('Hava tabancası atölyede yok: dükkândan alabilirsiniz.', 'warn'); app.CR.openShop(); return; }
    on = v; if (!on) { if (blowing) sound(false); blowing = false; aim = null; place(); controls.enabled = true; }
    if (on && FD.on) FD.setOn(false);
    canvas.style.cursor = '';
    $('airBtn').textContent = 'Hava tabancası: ' + (on ? 'AÇIK' : 'KAPALI'); $('airBtn').classList.toggle('start', on); $('tbAir').classList.toggle('on', on);
    if (on) log('Hava tabancası elinizde: talaşın üstünde sol tuşu basılı tutun. Talaşsız teslim kariyerde prim getirir.', 'ok');
  }
  window.addEventListener('pointerdown', e => {                 // pencere düzeyinde: tezgâh kollarından önce yakalar
    if (!on || e.button !== 0 || e.target !== canvas) return;
    e.preventDefault(); e.stopImmediatePropagation(); controls.enabled = false; initAudio();
    try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
    aim = pick(e) || aim; blowing = true; place(); sound(true);
  }, true);
  canvas.addEventListener('pointermove', e => {
    if (!on) return;
    const p = pick(e);
    if (p) aim = p; else if (!blowing) aim = null;
    canvas.style.cursor = aim ? 'none' : '';
    place();
  });
  const end = () => { if (blowing) { blowing = false; sound(false); controls.enabled = true; } };
  canvas.addEventListener('pointerup', end); canvas.addEventListener('pointercancel', end);
  canvas.addEventListener('pointerleave', () => { if (!blowing) { aim = null; place(); canvas.style.cursor = ''; } });
  $('airBtn').addEventListener('click', () => setOn(!on));
  function update(dt) {
    if (!on || !blowing || !aim) return;
    place();
    const tx = aim.x + S.px, tz = aim.z - S.py, R = 24;                 // hedef, tabla koordinatında
    for (const c of liveChips) {
      if (!c.alive) continue;
      const dx = c.p.x - tx, dz = c.p.z - tz, d = Math.hypot(dx, dz);
      if (d > R || c.p.y > aim.y + 30) continue;
      // itme yönü: nozülün baktığı yön, biraz da merkezden dışa
      const ox = d > 0.01 ? dx / d : 0, oz = d > 0.01 ? dz / d : 0;
      const k = 1 - d / R, vx = dh.x * 0.75 + ox * 0.45, vz = dh.z * 0.75 + oz * 0.45;
      if (c.rest) {
        const sp = 380 + 520 * k * (0.6 + Math.random() * 0.4);
        c.rest = false; c.bounces = 0;
        c.v.set(vx * sp, 90 + Math.random() * 160 * k, vz * sp);
        c.w.set((Math.random() - .5) * 30, (Math.random() - .5) * 30, (Math.random() - .5) * 30);
      } else { c.v.x += vx * 4200 * k * dt; c.v.z += vz * 4200 * k * dt; }
    }
    S.temp = Math.max(0, S.temp - S.temp * 0.25 * dt);
    // hava: nozülden çıkan buğu, yüzeyde dağılan toz
    tipW.set(0, 0, 43); gun.updateMatrixWorld(); gun.localToWorld(tipW);
    puff += 60 * dt;
    while (puff >= 1) {
      puff -= 1;
      const s = 350 + Math.random() * 250;
      emit('mist', tipW.x, tipW.y, tipW.z, (aim.x - tipW.x) / 30 * s / 2 + (Math.random() - .5) * 60, (aim.y - tipW.y) / 30 * s / 2, (aim.z - tipW.z) / 30 * s / 2 + (Math.random() - .5) * 60, 0.25 + Math.random() * 0.25);
      if (Math.random() < 0.35) emit('mist', aim.x + (Math.random() - .5) * 10, aim.y + 1, aim.z + (Math.random() - .5) * 10, dh.x * 200 + (Math.random() - .5) * 150, 30 + Math.random() * 40, dh.z * 200 + (Math.random() - .5) * 150, 0.4 + Math.random() * 0.3);
    }
  }
  return { setOn, update, get on() { return on; } };
})();
/* ---------------- 3B taster: temasla kenar, köşe, delik merkezi ve yüzey bulma ----------------
   Taster mil DURURKEN çalışır. Elle sürünce temas noktası kaydedilir (LED yanar, bip). Döngüler tasteri kendisi sürer:
   temas eder, 2 mm geri çekilir, sonraki adıma geçer ve bulunan noktayı DRO'ya sıfır olarak yazar.
   Temas noktası adım içinde ikiye bölme ile ızgara çözünürlüğünde kesinleştirilir. */
/* ---------------- Mekanik 3B taster: kadranlı, elle ----------------
   Bilye kenara değince stylus itilir; itilme kadranda okunur (1 tur = 1 mm, küçük kırmızı ibre turları sayar).
   Kadran bilye yarıçapı kadar (2 mm) itilmede 0'ı gösterir: o anda mil ekseni tam kenarın üstündedir (X/Y),
   Z'de ise takım boyu kadranın sıfırına göre verildiği için Z0 doğrudan yüzeydir. 4.5 mm'yi aşan itilmede
   stylus kırılma noktasından kopar. İtilme, bilyeyi serbest bırakan en kısa geri çekilme (±X, ±Y, +Z) olarak bulunur. */
const DT = (() => {
  const LIMIT = 4.5, DIRS = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1]];
  let defl = 0, ax = null, shown = -99, was = false;
  const freeAt = (x, y, n, T) => !interfere(x, y, n - T.len - 2, T).any;
  function deflection(x, y, n, T) {
    if (freeAt(x, y, n, T)) return { d:0, ax:null };
    let best = { d:99, ax:null };
    for (const [dx, dy, dz] of DIRS) {
      let lo = 0, hi = -1;
      for (let s = 0.25; s <= 6; s += 0.25) if (freeAt(x - dx * s, y - dy * s, n + dz * s, T)) { hi = s; lo = s - 0.25; break; }
      if (hi < 0) continue;
      for (let k = 0; k < 10; k++) { const m = (lo + hi) / 2; if (freeAt(x - dx * m, y - dy * m, n + dz * m, T)) hi = m; else lo = m; }
      if (hi < best.d) best = { d:hi, ax:dz ? 'z' : dx ? 'x' : 'y' };
    }
    return best;
  }
  function step(nx, ny, nn, T) {
    const r = deflection(nx, ny, nn, T);
    if (r.d > 0) {
      if (S.spindle) { crash('Mekanik taster dönerken parçaya değdi: stylus koptu. Taster yalnızca mil DURURKEN kullanılır.'); return false; }
      if (S.feedNow > 1500) { crash('Mekanik taster hızlı harekette çarptı: stylus kırılma noktasından koptu. El çarkıyla yavaş yaklaşın.'); return false; }
      if (r.d > LIMIT) { crash(`Stylus ${LIMIT} mm'den fazla itildi ve kırılma noktasından koptu (taster korundu). Yedek stylus takın.`); return false; }
      if (!was) { metalRing(3200, 0.02, 0.15); was = true; }
    } else was = false;
    defl = r.d; ax = r.ax;
    return true;
  }
  // kadran: 3B modeldeki ibreler ve paneldeki gösterge
  function update() {
    const T = tool();
    if (T.type !== 'dial') return;
    const rd = defl > 0 ? defl - 2 : -2.5;                          // serbestken ibre sıfırın gerisinde bekler
    if (dialNeedle) { dialNeedle.rotation.z = -rd * Math.PI * 2; dialTurns.rotation.z = -rd * Math.PI / 3; }
    if (Math.abs(rd - shown) < 0.0005) return;
    shown = rd;
    $('dtNeedle').setAttribute('transform', `rotate(${rd * 360})`); $('dtTurns').setAttribute('transform', `rotate(${rd * 60})`);
    const near = defl > 0 && Math.abs(rd) < 0.005;
    $('dtRead').textContent = defl > 0 ? (rd < 0 ? '−' : '+') + Math.abs(rd).toFixed(3) + ' mm' : 'temas yok';
    $('dtRead').style.color = near ? 'var(--ok)' : defl > 0 ? 'var(--fg)' : 'var(--muted)';
    $('dtHint').textContent = !defl ? 'Parçaya el çarkıyla yavaşça yaklaşın; bilye değince ibre döner.'
      : near ? `İbre 0'da: mil ekseni tam ${ax === 'z' ? 'yüzeyde' : 'kenarın üstünde'}. DRO'da ${ax.toUpperCase()}0 basın.`
      : `${ax.toUpperCase()} ekseninde ${defl.toFixed(3)} mm itildi. İbreyi 0'a getirin (${rd < 0 ? 'biraz daha ilerleyin' : 'biraz geri gelin'}).`;
  }
  return { step, update };
})();
// panel kadranının çentikleri
{ let t = ''; for (let k = 0; k < 100; k++) { const a = k / 100 * Math.PI * 2, r0 = k % 10 ? 41 : 37; t += `<line x1="${Math.sin(a) * r0}" y1="${-Math.cos(a) * r0}" x2="${Math.sin(a) * 45}" y2="${-Math.cos(a) * 45}" stroke="#1b1d1f" stroke-width="${k % 10 ? 0.6 : 1.4}"/>`; } $('dtTicks').innerHTML = t; }
const PR = (() => {
  const FEED = 400;
  let seq = null, hit = null, led = 0;
  const R = () => tool().d / 2;
  const droOf = (ax, m) => ax === 'x' ? m - S.zx : ax === 'y' ? m - S.zy : m - S.zn;
  const setZero = (ax, m) => { if (ax === 'x') S.zx = m; else if (ax === 'y') S.zy = m; else S.zn = m; };
  function touch(nx, ny, nn) {
    const T = tool(), dx = nx - S.px, dy = ny - S.py, dz = nn - S.nose;
    const ax = Math.abs(dz) > Math.max(Math.abs(dx), Math.abs(dy)) ? 'z' : Math.abs(dx) >= Math.abs(dy) ? 'x' : 'y';
    const dir = Math.sign(ax === 'x' ? dx : ax === 'y' ? dy : dz) || 1;
    let lo = 0, hi = 1;                                             // ilk temas anı: serbest konum ile adım sonu arasında
    for (let k = 0; k < 12; k++) {
      const u = (lo + hi) / 2;
      if (interfere(S.px + dx * u, S.py + dy * u, S.nose + dz * u - T.len, T).any) hi = u; else lo = u;
    }
    const cx = S.px + dx * hi, cy = S.py + dy * hi, cn = S.nose + dz * hi;
    // kenar = bilye merkezi + yarıçap; Z'de kovan konumu saklanır (Z sıfırı bilyenin alt ucunu yüzeye oturtur)
    const m = ax === 'x' ? cx + R() * dir : ax === 'y' ? cy + R() * dir : cn;
    hit = { ax, dir, m };
    stopMotion(); beep(2100, 0.06); led = 0.45;
    if (!seq) log(`Taster temas etti: ${ax.toUpperCase()} = ${fmt(droOf(ax, m))}${ax === 'z' ? ' (yüzey)' : ' (kenar)'}.`, 'ok');
  }
  function out(t, lvl = '') { $('prOut').textContent = t; if (lvl) log(t, lvl); }
  function run(name, steps, done) {
    if (tool().type !== 'probe') return;
    if (S.spindle) { out('Taster yalnızca mil DURURKEN kullanılır.', 'warn'); return; }
    if (S.alarm || S.changing) return;
    if (seq) abort();
    seq = { name, steps, i:0, run:false, r:{}, done, feed:S.feed };
    S.feed = FEED; stopMotion();
    out(`${name}: döngü çalışıyor…`);
  }
  function abort(msg) {
    if (!seq) return;
    S.feed = seq.feed; seq = null; stopMotion();
    if (msg) out(msg, 'warn');
  }
  function update(dt) {
    if (led > 0) { led -= dt; TMAT.led.emissive.setHex(led > 0 ? 0xff2a1a : 0x0b3a12); }
    if (!seq) return;
    if (S.alarm || S.changing || tool().type !== 'probe') { abort('Taster döngüsü durdu.'); return; }
    const st = seq.steps[seq.i];
    if (!st) {
      const r = seq.r, done = seq.done, name = seq.name;
      S.feed = seq.feed; seq = null;
      out(`${name}: ${done(r)}`, 'ok'); metalRing(2400, 0.03, 0.4);
      return;
    }
    const idle = !S.pend.x && !S.pend.y && !S.pend.z;
    if (!seq.run) {
      seq.run = true; hit = null;
      if (st.t === 'mv') S.pend[st.ax] += st.d;
      else if (st.t === 'pr') S.pend[st.ax] += st.dir * st.max;
      else if (st.t === 'fn') { st.f(seq.r); seq.i++; seq.run = false; }
      return;
    }
    if (st.t === 'pr' && hit) {                                     // temas: kaydet, geri çekil
      seq.r[st.key] = hit.m;
      seq.steps.splice(seq.i + 1, 0, { t:'mv', ax:st.ax, d:-st.dir * 2 });
      seq.i++; seq.run = false; return;
    }
    if (idle) {
      if (st.t === 'pr') { abort(`${seq.name}: ${st.max} mm içinde temas olmadı. Tasteri parçaya daha yakın ve üst yüzeyin altına getirin.`); return; }
      seq.i++; seq.run = false;
    }
  }
  const zero = () => $('prZero').checked;
  const edge = (ax, dir) => run(`${ax.toUpperCase()}${dir > 0 ? '+' : '−'} kenar`, [{ t:'pr', ax, dir, max:30, key:'e' }], r => {
    const v = droOf(ax, r.e);
    if (zero()) setZero(ax, r.e);
    return `kenar ${ax.toUpperCase()} = ${fmt(v)}${zero() ? ', bu kenar artık ' + ax.toUpperCase() + '0' : ''}.`;
  });
  const go = (ax, key) => ({ t:'fn', f:r => { S.pend[ax] += r[key] - (ax === 'x' ? S.px : S.py); } });
  const wait = ax => ({ t:'mv', ax, d:0 });
  const ACTS = {
    'x+': () => edge('x', 1), 'x-': () => edge('x', -1), 'y+': () => edge('y', 1), 'y-': () => edge('y', -1),
    // sol-ön köşe: taster köşenin 5–15 mm solunda ve önünde, üst yüzeyin 2–4 mm altında başlar
    corner: () => run('Sol-ön köşe', [
      { t:'mv', ax:'y', d:14 }, { t:'pr', ax:'x', dir:1, max:25, key:'x' },
      { t:'mv', ax:'y', d:-14 }, { t:'mv', ax:'x', d:14 }, { t:'pr', ax:'y', dir:1, max:25, key:'y' }, { t:'mv', ax:'x', d:-14 },
    ], r => {
      const vx = droOf('x', r.x), vy = droOf('y', r.y);
      if (zero()) { setZero('x', r.x); setZero('y', r.y); }
      return `köşe X ${fmt(vx)}, Y ${fmt(vy)}${zero() ? '; sıfır noktası bu köşe' : ''}.`;
    }),
    // delik merkezi: taster deliğin içinde, ağzın altında başlar; X'te iki, Y'de iki temas
    hole: () => run('Delik merkezi', [
      { t:'pr', ax:'x', dir:1, max:40, key:'xp' }, { t:'pr', ax:'x', dir:-1, max:80, key:'xm' },
      { t:'fn', f:r => { r.cx = (r.xp + r.xm) / 2; } }, go('x', 'cx'), wait('x'),
      { t:'pr', ax:'y', dir:1, max:40, key:'yp' }, { t:'pr', ax:'y', dir:-1, max:80, key:'ym' },
      { t:'fn', f:r => { r.cy = (r.yp + r.ym) / 2; } }, go('y', 'cy'), wait('y'),
    ], r => {
      const dx = r.xp - r.xm, dy = r.yp - r.ym, vx = droOf('x', r.cx), vy = droOf('y', r.cy);
      if (zero()) { setZero('x', r.cx); setZero('y', r.cy); }
      return `merkez X ${fmt(vx)}, Y ${fmt(vy)} · çap X ${dx.toFixed(3)}, Y ${dy.toFixed(3)}${zero() ? '; sıfır noktası delik merkezi' : ''}.`;
    }),
    z: () => run('Z yüzey', [{ t:'pr', ax:'z', dir:-1, max:40, key:'z' }], r => {
      const v = droOf('z', r.z);
      if (zero()) setZero('z', r.z);
      return `yüzey Z = ${fmt(v)}${zero() ? ', yüzey artık Z0 (taster boyuna göre; takım değişince yeniden sıfırlayın)' : ''}.`;
    }),
    stop: () => abort('Taster döngüsü durduruldu.'),
  };
  document.querySelectorAll('[data-pr]').forEach(b => b.addEventListener('click', () => { initAudio(); ACTS[b.dataset.pr](); }));
  return { touch, update, get busy() { return !!seq; } };
})();
/* ---------------- Vakum tabla: tutma kuvveti ve kopma ----------------
   Tutma = vakum basıncı × parçanın oturduğu alan. Boydan boya açılan her delik hava kaçırır, basınç düşer.
   Yanal tutma sürtünmeyle sınırlı (μ ≈ 0.35); kesme kuvveti ≈ kesme gücü / kesme hızı. Aşılırsa parça kopup fırlar. */
function partMeshes() { return [topMesh, stockBase, ...walls.map(w => w.w.m)].filter(Boolean); }
const VAC = (() => {
  let p = 0.8, lat = 0, force = 0, t = 1;
  function measure() {
    let n = 0;
    for (let k = 0; k < nV; k++) if (H[k] > 0.02) n++;
    const A = n * C * C, leak = (nV - n) * C * C;
    p = 0.8 / (1 + leak / 250);                                    // 1 bar = 0.1 N/mm²
    lat = p * 0.1 * A * 0.35;
  }
  function ui() {
    $('vgP').textContent = '−' + p.toFixed(2) + ' bar'; $('vgH').textContent = Math.round(lat) + ' N'; $('vgF').textContent = Math.round(force) + ' N';
    const u = force / Math.max(1, lat);
    $('vgM').style.width = Math.min(100, u * 100) + '%';
    $('vgM').style.background = u > 0.8 ? 'var(--bad)' : u > 0.55 ? 'var(--warn)' : 'var(--ok)';
  }
  function update(dt) {
    if (S.loose && S.loose.t < 1) {                                // kopan parça: kalkar ve yana devrilir
      S.loose.t = Math.min(1, S.loose.t + dt * 2.5);
      const k = 1 - Math.pow(1 - S.loose.t, 3);
      for (const m of partMeshes()) { m.position.set(14 * k, 9 * k, 0); m.rotation.set(0.2 * k, 0, -0.06 * k); }
    }
    if (FIX !== 'vac') return;
    force *= Math.max(0, 1 - dt * 2);
    if ((t += dt) > 0.3) { t = 0; measure(); ui(); }
  }
  function check(Pc, vc) {
    force = Math.max(force, Pc * 1000 / Math.max(0.3, vc / 60));
    if (force > lat) {
      S.loose = { t:0 };
      burst('debris', 30, 0, tipZ() + 2, 0, 300, 500, 2); thud(60, 0.4, 0.4);
      crash(`Parça vakum tablasından koptu ve fırladı! Kesme kuvveti ${Math.round(force)} N, vakumun yanal tutması ${Math.round(lat)} N idi. Küçük ve çok delikli parçada tutma azalır; hafif paso alın.`);
      return true;
    }
    if (force > lat * 0.75) warnOnce('vac', `Vakum zorlanıyor: kesme kuvveti ${Math.round(force)} N, tutma ${Math.round(lat)} N. Paso derinliğini ya da ilerlemeyi azaltın.`, 'warn', 5000);
    return false;
  }
  return { update, check, measure, ui };
})();
const FIXNOTE = {
  div:'Divizör (deneme): yuvarlak çubuk üç ayaklı aynada, ekseni X boyunca. X = çubuğun boyu (20–150), Y = çapı (10–70). X0 ayna yüzü, Y0 eksen, Z0 çubuğun üstü. A ekseni kilidi açıp Q/E ya da düğmelerle döner; takım çubuğa her açıdan dalabilir.',
  rot:'Döner tabla: X 20–150, Y 20–120 mm. Parçanın ortası tabla merkezinde; parça X yanlarındaki iki ince paralel üstünde, iki pabuçla bağlı. Döndürmek için kilidi açın (Q/E basılı tut ya da adım düğmeleri). Takım parçadayken tablayı çevirmek yay kesmesidir; öteleme kesmesinden önce kilitleyin.',
  vise:'Mengene: X 20–220, Y 20–135 mm parça. Çeneler üst yüzeyin 5 mm altında biter; altta iki paralel altlık var (Paraleller ayarından kaydırın, inceltin ya da kurban plaka koyun).',
  clamp:'Pabuç: X 40–260, Y 40–140 mm. Parça iki altlık üstünde; dört pabuç kenarın 12 mm\'sini kapatır, takım ya da tutucu çarparsa kırılır. Delerken altlıkların üstüne dikkat.',
  vac:'Vakum tabla: X 30–260, Y 30–150, Z 3–40 mm. Parçanın her yeri açık; kurban plakasına 5 mm kadar inilebilir. Tutma alanla orantılı, delikler hava kaçırır: ağır pasoda parça kopar.',
};
function setFix(k, quiet) {
  if (!FIXLIM[k]) return false;
  if (k !== 'vise' && !app.CR.hasEq(k)) { log(`${FIXNAME[k]} atölyede yok: dükkândan alabilirsiniz.`, 'warn'); app.CR.openShop(); return false; }
  if (!quiet && S.job && !S.job.done) { log('İş sürerken bağlama değiştirilmez.', 'warn'); return false; }
  if (S.spindle) spindle(false);
  setFIX(k);
  [...$('fixSeg').children].forEach(b => b.classList.toggle('on', b.dataset.fx === k));
  $('clampLay').hidden = k !== 'clamp'; $('vacG').hidden = k !== 'vac'; $('rotBox').hidden = k !== 'rot' && k !== 'div';
  $('rotLab').textContent = k === 'div' ? 'A ekseni' : 'C ekseni';
  $('parBox').hidden = k === 'vac' || k === 'div';
  ROT.lock = true; $('rotLock').textContent = 'KİLİTLİ'; $('rotLock').classList.remove('open');
  const L = FIXLIM[k];
  for (const [id, r] of [['stW', L.x], ['stD', L.y], ['stH', L.z]]) { $(id).min = r[0]; $(id).max = r[1]; }
  $('fixNote').textContent = FIXNOTE[k];
  app.setStock(PW, PD, PH, true);
  if (k === 'vac') { VAC.measure(); VAC.ui(); }
  if (!quiet) log(`Bağlama: ${FIXNAME[k]}. ${PW}×${PD}×${PH} mm ham parça bağlandı.`, 'ok');
  return true;
}
$('fixSeg').addEventListener('click', e => { const b = e.target.closest('[data-fx]'); if (b && b.dataset.fx !== FIX) { initAudio(); setFix(b.dataset.fx); } });
// döner tabla kumandaları: adım, açıya git, sıfır, kilit
const rotGoTo = deg => { if (!ROT.on && FIX !== 'div') return; if (ROT.lock) { log('Döner tabla kilitli: önce kilidi açın.', 'warn'); return; } ROT.pend += deg; };
$('rotSteps').addEventListener('click', e => { const b = e.target.closest('[data-ra]'); if (b) { initAudio(); rotGoTo(+b.dataset.ra); } });
$('rotGo').addEventListener('click', () => {
  const v = parseFloat(String($('rotTgt').value).replace(',', '.')); if (!Number.isFinite(v)) return;
  const cur = ROT.a - ROT.z0 + ROT.pend; rotGoTo(((v - cur) % 360 + 540) % 360 - 180);
});
$('rotZero').addEventListener('click', () => { ROT.z0 = ROT.a; ROT.shown = null; log('Döner tabla açısı sıfırlandı: C = 0°.', 'ok'); });
$('rotLock').addEventListener('click', () => {
  initAudio(); ROT.lock = !ROT.lock; ROT.pend = ROT.hold = 0; thud(ROT.lock ? 140 : 210, 0.12, 0.1);
  $('rotLock').textContent = ROT.lock ? 'KİLİTLİ' : 'AÇIK'; $('rotLock').classList.toggle('open', !ROT.lock);
});
// paraleller: kaydırınca ya da genişlik değişince bağlama yeniden kurulur (parça yerinde kalır)
function syncParUI() {
  const n = parAxis() === 'x' ? PW : PD, mx = Math.max(0, Math.floor(n / 2 - PAR.w - 2));
  if (PAR.off > mx) PAR.off = mx;
  $('parOff').max = mx; $('parOff').value = PAR.off; $('parOffV').textContent = `kenardan ${PAR.off} mm`;
  [...$('parW').children].forEach(b => b.classList.toggle('on', b.dataset.pw === 'sac' ? PAR.sac : +b.dataset.pw === PAR.w));
}
function setPar(ch) {
  if (S.spindle) { log('Paralelleri değiştirmek için önce mili durdurun.', 'warn'); syncParUI(); return; }
  Object.assign(PAR, ch); syncParUI(); buildVise();
  if (S.job && !S.job.done) { const c = parConflicts(S.job.J); if (!c.length && S.job.J.holes.length) log('Paraleller deliklerin altından çekildi.', 'ok'); else warnParallels(S.job.J); }
  const J = S.job && !S.job.done ? S.job.J : selJob >= 0 ? JOBS[selJob] : selJob === -2 && app.CR.sel ? app.CR.sel.J : null;
  if (J) $('dwSvg').innerHTML = drawingSVG(J);
}
$('parOff').addEventListener('input', e => { PAR.off = +e.target.value; $('parOffV').textContent = `kenardan ${PAR.off} mm`; });
$('parOff').addEventListener('change', e => { initAudio(); thud(180, 0.08, 0.06); setPar({ off:+e.target.value }); });
$('parW').addEventListener('click', e => {
  const b = e.target.closest('[data-pw]'); if (!b) return; initAudio();
  if (b.dataset.pw === 'sac') setPar({ sac:!PAR.sac }); else setPar({ w:+b.dataset.pw });
});
$('clampLay').addEventListener('click', e => {
  const b = e.target.closest('[data-cl]'); if (!b || b.dataset.cl === clampLay) return;
  if (S.spindle) { log('Pabuçları sökmek için önce mili durdurun.', 'warn'); return; }
  setClampLay(b.dataset.cl); [...$('clampLay').children].forEach(q => q.classList.toggle('on', q === b));
  buildVise(); thud(150, 0.15, 0.12);
  log(`Pabuçlar ${clampLay === 'fb' ? 'ön ve arka' : 'sol ve sağ'} kenarlara bağlandı.`, 'ok');
});
// parçanın üstünde yatan talaş sayısı (temiz teslim primi için)
function chipsOnPart() {
  let n = 0;
  for (const c of liveChips) if (c.alive && c.rest && c.p.x >= 0 && c.p.x <= PW && -c.p.z >= 0 && -c.p.z <= PD && c.p.y > 0.5) n++;
  return n;
}

/* ---------------- Kumanda paneli: DRO ekranı, tuş takımı, topuzlar, el çarkı (MPG) ----------------
   Paneldeki tüm kumandalar mevcut işlevleri çağırır; böylece eski paneller ve makine üstü kumandalarla hep tutarlı kalır. */
Object.assign(app, { AG, DT, FD, IA, PR, VAC, partMeshes, setFix, syncParUI });   // önceki modüllerin geç başvuruları

export { chipsOnPart, setFix };
