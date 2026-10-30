// ── Ses motoru: motor, dişli, kesme, tırlama ve tek seferlik sesler (kayıt dosyası yok, gürültüden üretilir)
let ac = null, master, bus, SN = null, lastSnd = 0;
// Malzemeye göre kesme sesi: bant merkezi, keskinlik, gövde gürültüsü, çıtırtı
const SND = {
  al:    { f:2300, q:0.9, body:0.5, crackle:0,    gain:0.8 },
  c45:   { f:3400, q:1.6, body:0.8, crackle:0,    gain:1.0 },
  ss304: { f:4300, q:2.4, body:0.7, crackle:0,    gain:1.0 },
  brass: { f:2900, q:1.1, body:0.5, crackle:0.35, gain:0.8 },
  gg25:  { f:1900, q:0.8, body:0.9, crackle:1.0,  gain:0.9 },
  pom:   { f:1100, q:0.7, body:0.3, crackle:0,    gain:0.55 },
  s235:  { f:3100, q:1.4, body:0.8, crackle:0,    gain:0.95 },
  pa6:   { f:950,  q:0.6, body:0.25, crackle:0,   gain:0.5 },
};
function noiseBuffer(brown) {
  const b = ac.createBuffer(1, ac.sampleRate * 3, ac.sampleRate), d = b.getChannelData(0);
  let last = 0;
  for (let i = 0; i < d.length; i++) {
    const w = Math.random() * 2 - 1;
    if (brown) { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w;
  }
  return b;
}
function initAudio() {
  if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
  try {
    ac = new (window.AudioContext || window.webkitAudioContext)();
    const comp = ac.createDynamicsCompressor(); comp.threshold.value = -18; comp.ratio.value = 4;
    master = ac.createGain(); master.gain.value = S.muted ? 0 : 0.9;
    master.connect(comp); comp.connect(ac.destination);
    // atölye yankısı: üstel sönen gürültüden üretilmiş dürtü yanıtı
    const ir = ac.createBuffer(2, ac.sampleRate * 1.4, ac.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3.2) * (i < 200 ? i / 200 : 1); }
    const rev = ac.createConvolver(); rev.buffer = ir;
    const wet = ac.createGain(); wet.gain.value = 0.22;
    bus = ac.createGain(); bus.connect(master); bus.connect(wet); wet.connect(rev); rev.connect(master);
    const white = noiseBuffer(false), brown = noiseBuffer(true);
    const src = (buf, rate = 1) => { const s = ac.createBufferSource(); s.buffer = buf; s.loop = true; s.playbackRate.value = rate; s.loopStart = Math.random(); s.start(0, Math.random() * 2); return s; };
    const filt = (type, f, q = 0.7) => { const b = ac.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; return b; };
    const gain = (v = 0) => { const g = ac.createGain(); g.gain.value = v; return g; };
    const chain = (...n) => { for (let i = 0; i < n.length - 1; i++) n[i].connect(n[i + 1]); return n[n.length - 1]; };
    SN = {};
    // motor: şebeke uğultusu (100 Hz manyetik), dönen kütlenin gürlemesi, dişli vınlaması, fan hışırtısı
    SN.humG = gain(); SN.hum = ac.createOscillator(); SN.hum.frequency.value = 100; SN.hum2 = ac.createOscillator(); SN.hum2.frequency.value = 200;
    const h2g = gain(0.35); SN.hum.connect(SN.humG); chain(SN.hum2, h2g, SN.humG); SN.humG.connect(bus); SN.hum.start(); SN.hum2.start();
    SN.rumbleF = filt('lowpass', 80, 1.2); SN.rumbleG = gain(); chain(src(brown), SN.rumbleF, SN.rumbleG, bus);
    SN.gear1 = filt('bandpass', 400, 14); SN.gear2 = filt('bandpass', 700, 18); SN.gearG = gain();
    const wg = src(white); wg.connect(SN.gear1); wg.connect(SN.gear2); SN.gear1.connect(SN.gearG); SN.gear2.connect(SN.gearG); SN.gearG.connect(bus);
    SN.fanF = filt('lowpass', 900, 0.5); SN.fanG = gain(); chain(src(white, 0.7), filt('highpass', 180), SN.fanF, SN.fanG, bus);
    // dönme titreşimi: kesme sesini mil devriyle hafifçe dalgalandırır
    SN.rot = ac.createOscillator(); SN.rot.frequency.value = 10; SN.rotDepth = gain(0.0); SN.rot.connect(SN.rotDepth); SN.rot.start();
    // kesme: bant geçiren hışırtı + kalın paso gövde gürültüsü
    SN.cutF = filt('bandpass', 2500, 1); SN.cutF2 = filt('peaking', 5000, 2); SN.cutF2.gain.value = 4;
    SN.cutMod = gain(1); SN.rotDepth.connect(SN.cutMod.gain);
    SN.cutG = gain(); chain(src(white), SN.cutF, SN.cutF2, SN.cutMod, SN.cutG, bus);
    SN.bodyF = filt('lowpass', 350, 0.9); SN.bodyG = gain(); chain(src(brown, 1.3), SN.bodyF, SN.bodyG, bus);
    // tırlama: dar bantta ötme, 20-40 Hz'lik vızıltıyla
    SN.chatF = filt('bandpass', 900, 35); SN.chatF2 = filt('bandpass', 1800, 30); SN.chatG = gain();
    SN.buzz = ac.createOscillator(); SN.buzz.type = 'triangle'; SN.buzz.frequency.value = 28; SN.buzzD = gain(0); SN.chatMod = gain(0.5);
    SN.buzz.connect(SN.buzzD); SN.buzzD.connect(SN.chatMod.gain); SN.buzz.start();
    const wc = src(white, 1.1); wc.connect(SN.chatF); wc.connect(SN.chatF2); SN.chatF.connect(SN.chatMod); SN.chatF2.connect(SN.chatMod); chain(SN.chatMod, SN.chatG, bus);
    // soğutma sıvısı: yumuşak şırıltı
    SN.polF = filt('bandpass', 2600, 0.8); SN.polG = gain(); chain(src(white, 0.9), SN.polF, filt('highshelf', 5000), SN.polG, bus);
    SN.coolG = gain(); chain(src(brown, 2.5), filt('bandpass', 1300, 0.5), filt('lowpass', 2400), SN.coolG, bus);   // tiz tıslama yerine boğuk akış
    SN.spd = 0;
  } catch (e) { ac = null; }
}
// Tek seferlik sesler ---------------------------------------------------------
function noiseHit(t, type, f, q, vol, len, dest = bus) {
  const s = ac.createBufferSource(); s.buffer = SN.white || (SN.white = noiseBuffer(false));
  const b = ac.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q;
  const g = ac.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.002); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
  s.connect(b); b.connect(g); g.connect(dest); s.start(t, Math.random() * 2); s.stop(t + len + 0.02);
}
// metal çınlaması: çubuk/plaka titreşiminin uyumsuz kısmi tonları (1, 2.76, 5.40, 8.93)
function metalRing(base, vol, len) {
  if (!ac || S.muted) return;
  const t = ac.currentTime;
  [[1, 1], [2.76, 0.55], [5.40, 0.3], [8.93, 0.16]].forEach(([k, a], i) => {
    const o = ac.createOscillator(), g = ac.createGain();
    o.frequency.value = base * k * (1 + (Math.random() - 0.5) * 0.02);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol * a, t + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len / (1 + i * 0.8));
    o.connect(g); g.connect(bus); o.start(t); o.stop(t + len + 0.05);
  });
  noiseHit(t, 'bandpass', base * 3, 1.2, vol * 0.8, 0.03);
}
// mekanik tok ses: kavrama, durdurucu, kol
function thud(f = 90, vol = 0.2, len = 0.18) {
  if (!ac || S.muted) return;
  const t = ac.currentTime, o = ac.createOscillator(), g = ac.createGain();
  o.frequency.setValueAtTime(f * 1.6, t); o.frequency.exponentialRampToValueAtTime(f * 0.7, t + len);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
  o.connect(g); g.connect(bus); o.start(t); o.stop(t + len + 0.02);
  noiseHit(t, 'lowpass', f * 8, 0.7, vol * 0.7, len * 0.4);
}
function crashSound() {
  if (!ac) return;
  const t = ac.currentTime;
  noiseHit(t, 'bandpass', 2600, 0.9, 0.5, 0.09);      // uç kırılma çatırtısı
  noiseHit(t + 0.01, 'lowpass', 500, 0.8, 0.45, 0.35); // tezgâha vuran darbe
  thud(70, 0.35, 0.3);
  metalRing(1150, 0.07, 0.9);
}
// arayüz bildirimi: yumuşak, kısa, yankılı bir çan (oyun içi makine sesleri bunu kullanmaz)
function beep(f = 1600, len = 0.15, vol = 0.08) {
  if (!ac || S.muted) return;
  const t = ac.currentTime, o = ac.createOscillator(), g = ac.createGain(), fr = Math.min(f, 1400);
  o.frequency.value = fr;
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol * 0.45, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + len * 2.5);
  o.connect(g); g.connect(bus); o.start(t); o.stop(t + len * 2.5 + 0.05);
}
function updateAudio() {
  if (!ac || !SN) return;
  const t = ac.currentTime, dt = Math.min(0.1, t - lastSnd); lastSnd = t;
  // mil sesi kalkışta ~1.2 sn'de hızlanır, durunca ~2.5 sn'de serbest yavaşlar
  const target = S.spindle ? (S.rpmEff || S.rpm) : 0;
  SN.spd += (target - SN.spd) * Math.min(1, dt * (target > SN.spd ? 2.2 : 0.9));
  const sp = SN.spd, n = clamp(sp / 4200, 0, 1), run = sp > 5 ? 1 : 0, load = clamp(S.power || 0, 0, 1.6);
  const fr = sp / 60, sm = 0.08;
  SN.humG.gain.setTargetAtTime(S.spindle ? 0.010 + load * 0.008 : 0, t, 0.15);
  SN.rumbleF.frequency.setTargetAtTime(40 + fr * 2.2, t, sm);
  SN.rumbleG.gain.setTargetAtTime(run * (0.035 + n * 0.06 + load * 0.08), t, sm);   // freze motoru tornadan küçük
  SN.gear1.frequency.setTargetAtTime(Math.max(60, fr * 31), t, sm); SN.gear2.frequency.setTargetAtTime(Math.max(90, fr * 47 * 1.3), t, sm);
  SN.gearG.gain.setTargetAtTime(run * (0.03 + n * 0.11), t, sm);
  SN.fanF.frequency.setTargetAtTime(500 + n * 2200, t, sm);
  SN.fanG.gain.setTargetAtTime(run * n * 0.03, t, sm);
  // kesme
  const m = SND[S.mat] || SND.al, c = clamp(S.cutting / 0.3, 0, 1), chip = clamp(S.lastChip || 0, 0, 3);
  const cut = c > 0.02 && S.spindle ? Math.sqrt(c) : 0;
  SN.cutF.frequency.setTargetAtTime(m.f * (0.8 + n * 0.5) / (0.85 + chip * 0.2), t, 0.05); SN.cutF.Q.value = m.q;
  SN.cutF2.frequency.setTargetAtTime(m.f * 1.9, t, 0.1);
  SN.cutG.gain.setTargetAtTime(cut * 0.16 * m.gain * (0.7 + chip * 0.25), t, 0.04);
  SN.bodyG.gain.setTargetAtTime(cut * m.body * (0.05 + chip * 0.07), t, 0.05);
  SN.rot.frequency.setTargetAtTime(Math.max(0.5, fr * (tool().z || 2)), t, 0.1); SN.rotDepth.gain.setTargetAtTime(cut * 0.5, t, 0.1);   // ağız vuruşu
  // döküm ve pirinçte kırık talaş çıtırtısı
  if (cut && m.crackle && Math.random() < m.crackle * c * dt * 60 * 0.6) noiseHit(t + Math.random() * 0.02, 'bandpass', 2500 + Math.random() * 3000, 2, 0.05 * cut, 0.012);
  // tırlama
  const ch = cut ? S.chatNow || 0 : 0;
  SN.chatF.frequency.setTargetAtTime(650 + n * 900, t, 0.2); SN.chatF2.frequency.setTargetAtTime((650 + n * 900) * 2.03, t, 0.2);
  SN.buzzD.gain.setTargetAtTime(ch * 0.5, t, 0.1); SN.buzz.frequency.setTargetAtTime(18 + fr * 0.6, t, 0.2);
  SN.chatG.gain.setTargetAtTime(ch * 0.9, t, 0.06);
  SN.coolG.gain.setTargetAtTime(S.coolant ? 0.03 : 0, t, 0.3);
  SN.polG.gain.setTargetAtTime((S.polishNow || 0) * 0.05, t, 0.05); SN.polF.frequency.setTargetAtTime(1800 + (S.polishNow || 0) * 1200, t, 0.1);
}

/* ---------------- Three.js sahnesi ---------------- */
