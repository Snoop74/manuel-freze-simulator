// ── Havai fişek (FW): kabul edilen parçada 2B tuvalde gösteri
const FW = (() => {
  let cv = null, g = null, parts = [], rockets = [], raf = 0, left = 0, nextT = 0, last = 0;
  const COLS = [[255, 200, 70], [255, 120, 60], [120, 220, 255], [150, 255, 160], [255, 255, 230], [255, 110, 190]];
  function ensure() {
    if (cv) return;
    cv = document.createElement('canvas'); cv.className = 'fw'; document.body.append(cv); g = cv.getContext('2d');
  }
  function size() { const d = Math.min(2, window.devicePixelRatio || 1); cv.width = innerWidth * d; cv.height = innerHeight * d; g.setTransform(d, 0, 0, d, 0, 0); }
  function launch() {
    const u = Math.random(), x = innerWidth * (u < 0.5 ? 0.04 + u * 0.56 : 0.68 + (u - 0.5) * 0.56);   // pencerenin iki yanında, kazanç okunsun
    rockets.push({ x, y:innerHeight + 10, vx:(Math.random() - 0.5) * 60, vy:-(innerHeight * (0.9 + Math.random() * 0.35)), ty:innerHeight * (0.12 + Math.random() * 0.33), c:COLS[Math.random() * COLS.length | 0] });
    if (ac && !S.muted) noiseHit(ac.currentTime, 'highpass', 3000, 0.6, 0.03, 0.25);   // fişek yükselişi
  }
  function explode(R) {
    const n = 70 + (Math.random() * 50 | 0), sp = 120 + Math.random() * 140, c2 = Math.random() < 0.4 ? COLS[Math.random() * COLS.length | 0] : R.c;
    for (let k = 0; k < n; k++) {
      const a = Math.random() * Math.PI * 2, v = sp * (0.35 + Math.random() * 0.65);
      parts.push({ x:R.x, y:R.y, vx:Math.cos(a) * v, vy:Math.sin(a) * v, life:1.2 + Math.random() * 0.8, max:2, c:k % 3 ? R.c : c2, tw:Math.random() < 0.3 });
    }
    if (ac && !S.muted) { const t = ac.currentTime; noiseHit(t, 'lowpass', 600, 0.7, 0.35, 0.5); noiseHit(t + 0.02, 'bandpass', 2400, 1.2, 0.08, 0.9); }
  }
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000 || 0.016); last = now;
    if (left > 0 && now > nextT) { launch(); left--; nextT = now + 260 + Math.random() * 380; }
    g.globalCompositeOperation = 'destination-out'; g.fillStyle = 'rgba(0,0,0,0.22)'; g.fillRect(0, 0, innerWidth, innerHeight);
    g.globalCompositeOperation = 'lighter';
    for (const R of rockets) {
      R.vy += 420 * dt; R.x += R.vx * dt; R.y += R.vy * dt;
      g.fillStyle = 'rgba(255,220,150,0.9)'; g.fillRect(R.x - 1.5, R.y - 1.5, 3, 3);
      if (R.y <= R.ty || R.vy > -40) { R.done = true; explode(R); }
    }
    rockets = rockets.filter(R => !R.done);
    for (const p of parts) {
      p.vx *= 1 - 1.4 * dt; p.vy = p.vy * (1 - 1.4 * dt) + 90 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt;
      const a = Math.max(0, Math.min(1, p.life)) * (p.tw && Math.random() < 0.4 ? 0.3 : 1);
      g.fillStyle = `rgba(${p.c[0]},${p.c[1]},${p.c[2]},${a})`; g.beginPath(); g.arc(p.x, p.y, 1.8, 0, Math.PI * 2); g.fill();
    }
    parts = parts.filter(p => p.life > 0);
    if (left > 0 || rockets.length || parts.length) raf = requestAnimationFrame(frame);
    else { g.clearRect(0, 0, innerWidth, innerHeight); cv.hidden = true; raf = 0; }
  }
  function show(stars) {
    if (!stars) return;
    ensure(); size(); cv.hidden = false;
    left += [0, 3, 6, 12][stars] || 3; nextT = 0;
    if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); }
  }
  function stop() { left = 0; }
  window.addEventListener('resize', () => { if (cv && !cv.hidden) size(); });
  return { show, stop };
})();
$('jobStart').addEventListener('click', startJob);
$('jobSubmit').addEventListener('click', submitJob);
$('rpInspect').addEventListener('click', () => { $('report').hidden = true; log('Kırmızı bölgeler resim dışında fazla kesilmiş yerleri gösterir.'); });
$('rpRetry').addEventListener('click', () => { $('report').hidden = true; startJob(); });
$('rpNext').addEventListener('click', () => { $('report').hidden = true; selectJob(S.job.idx + 1); $('drawing').hidden = false; });
$('vDraw').addEventListener('click', () => { $('drawing').hidden = !$('drawing').hidden; });
$('dwClose').addEventListener('click', () => { $('drawing').hidden = true; });

Object.assign(app, { FW });   // önceki modüllerin geç başvuruları
