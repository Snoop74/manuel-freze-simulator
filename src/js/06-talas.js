// ── Talaşlar ve partiküller: şerit talaş, yığın, savrulma, duman, kıvılcım, talaş biçimi
import { C, H, NX, PD, PW, S, TAU, app, isDrill, mat, tool } from './00-temel.js';
import { AYAR } from './00-tercihler.js';
import { scene } from './02-sahne-tezgah.js';
import { LX, LY, ROT, table, toLv } from './03-tabla-parca.js';
import { DIVY, DIVZ, VX } from './04-voksel.js';
import { FIX, jawTop, straps } from './05-baglama.js';

const chipMat = new THREE.MeshStandardMaterial({ vertexColors:true, roughness:0.3, metalness:0.85, side:THREE.DoubleSide });
// Eğri boyunca dikdörtgen kesitli şerit. f(t) eğri; genişlik kıvrım ekseni (y) yönünde, kalınlık h(t) eğrinin iç-dış yönünde
function ribbonGeo(f, seg, w, h) {
  const P = [], pos = [], nor = [], col = [], idx = [], up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i <= seg; i++) P.push(f(i / seg, new THREE.Vector3()));
  const Tn = new THREE.Vector3(), B = new THREE.Vector3(), Nn = new THREE.Vector3();
  const frames = P.map((p, i) => {
    Tn.subVectors(P[Math.min(seg, i + 1)], P[Math.max(0, i - 1)]).normalize();
    B.copy(up).addScaledVector(Tn, -up.dot(Tn)); if (B.lengthSq() < 1e-6) B.set(1, 0, 0); B.normalize();
    Nn.crossVectors(Tn, B).normalize();
    return { b:B.clone(), n:Nn.clone() };
  });
  // dört yüz: dış (parlak), iç (mat), iki kenar; her yüz kendi köşeleri ve normaliyle keskin görünür
  const faces = [[1, 0, 1.0], [-1, 0, 0.62], [0, 1, 0.8], [0, -1, 0.8]];
  for (const [sn, sb, shade] of faces) {
    const base = pos.length / 3;
    for (let i = 0; i <= seg; i++) {
      const t = i / seg, hh = h(t) / 2, { b, n } = frames[i], p = P[i];
      for (const side of [-1, 1]) {
        // dış/iç yüzde köşeler genişlik boyunca, kenar yüzlerde kalınlık boyunca açılır
        const ob = sb ? sb * w / 2 : side * w / 2, on = sn ? sn * hh : side * hh;
        pos.push(p.x + b.x * ob + n.x * on, p.y + b.y * ob + n.y * on, p.z + b.z * ob + n.z * on);
        const nx = sn ? n.x * sn : b.x * sb, ny = sn ? n.y * sn : b.y * sb, nz = sn ? n.z * sn : b.z * sb;
        nor.push(nx, ny, nz); col.push(shade, shade, shade);
      }
    }
    // sarım yönünü yüz normaline göre seç: çift taraflı malzemede ters sarım gölgelemeyi karartır
    const q = k => new THREE.Vector3(pos[k * 3], pos[k * 3 + 1], pos[k * 3 + 2]);
    const cr = new THREE.Vector3().crossVectors(q(base + 1).sub(q(base)), q(base + 2).sub(q(base)));
    const flip = cr.dot(new THREE.Vector3(nor[base * 3], nor[base * 3 + 1], nor[base * 3 + 2])) < 0;
    for (let i = 0; i < seg; i++) { const a = base + i * 2; if (flip) idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); else idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx); return g;
}
const rnd = (a, b) => a + Math.random() * (b - a);
// biçim üreticileri: her çağrı farklı bir çeşit verir; rest: yatarken kıvrım ekseni dik ('flat') ya da yatay ('side')
const CHIP_SHAPES = {
  comma: () => { const R = rnd(1.6, 2.6), ph = rnd(1.1, 1.9) * Math.PI, pt = rnd(0.2, 0.7), k = rnd(0.2, 0.45), h0 = rnd(0.12, 0.2);
    return { g:ribbonGeo((t, o) => o.set(Math.cos(ph * t) * R * (1 - k * t), pt * t, Math.sin(ph * t) * R * (1 - k * t)), 26, rnd(0.9, 1.5), t => h0 * (0.25 + 0.75 * t)), rest:'flat' }; },
  thick: () => { const R = rnd(1.4, 2), ph = rnd(0.8, 1.3) * Math.PI, h0 = rnd(0.3, 0.45);
    return { g:ribbonGeo((t, o) => o.set(Math.cos(ph * t) * R, 0, Math.sin(ph * t) * R), 18, rnd(1.4, 2.0), t => h0 * (0.4 + 0.6 * t)), rest:'flat' }; },
  thin: () => { const R = rnd(1.4, 2.2), turns = rnd(2, 3.5), pt = rnd(0.7, 1.3);
    return { g:ribbonGeo((t, o) => o.set(Math.cos(TAU * turns * t) * R, (t - 0.5) * turns * pt, Math.sin(TAU * turns * t) * R), 90, rnd(0.6, 0.9), () => 0.06), rest:'side' }; },
  spring: () => { const R = rnd(1.6, 2.4), turns = rnd(3, 5.5), pt = rnd(1.6, 2.4);
    return { g:ribbonGeo((t, o) => o.set(Math.cos(TAU * turns * t) * R * (1 + 0.2 * t), (t - 0.5) * turns * pt, Math.sin(TAU * turns * t) * R * (1 + 0.2 * t)), 140, rnd(1.2, 1.7), () => 0.14), rest:'side' }; },
  six: () => { const R = rnd(1.6, 2.2), turns = rnd(0.8, 1.5), pt = rnd(1.2, 1.8);
    return { g:ribbonGeo((t, o) => o.set(Math.cos(TAU * turns * t) * R, (t - 0.5) * turns * pt, Math.sin(TAU * turns * t) * R), 40, rnd(1.1, 1.5), () => 0.16), rest:'flat' }; },
  flake: () => { const L = rnd(0.8, 1.8), bend = rnd(-0.6, 0.6);
    return { g:ribbonGeo((t, o) => o.set((t - 0.5) * L, 0, bend * (t - 0.5) * (t - 0.5) * L), 6, rnd(0.4, 0.8), () => rnd(0.1, 0.18)), rest:'flat' }; },
  torn: () => { const R = rnd(0.9, 1.4), ph = rnd(0.5, 1.0) * Math.PI, tw = rnd(-0.6, 0.6);
    return { g:ribbonGeo((t, o) => o.set(Math.cos(ph * t) * R, tw * t, Math.sin(ph * t) * R), 10, rnd(0.6, 1.1), t => 0.18 + 0.1 * Math.sin(t * 9)), rest:'flat' }; },
  ribbon: () => { const R = rnd(2.6, 3.4), turns = rnd(1.5, 2.5), pt = rnd(3, 4);
    return { g:ribbonGeo((t, o) => o.set(Math.cos(TAU * turns * t) * R, (t - 0.5) * turns * pt, Math.sin(TAU * turns * t) * R), 90, rnd(1.0, 1.4), () => 0.22), rest:'side' }; },
  gum: () => { const ph = Math.random() * 6;
    return { g:ribbonGeo((t, o) => { const a = TAU * t; return o.set(4.5 * Math.sin(a * 1.3 + ph) + 2 * Math.cos(a * 6.5), 3.5 * Math.cos(a * 0.9) + 2 * Math.sin(a * 7.1 + ph), 3.5 * Math.sin(a * 2.1) + 2 * Math.cos(a * 6.1 + 1)); }, 200, 0.45, () => 0.12), rest:'side' }; },
};
const VARIANTS = 4, CAP = { comma:110, thick:60, thin:45, spring:40, six:55, flake:90, torn:50, ribbon:30, gum:20 };
const chipPools = {};
const dummy = new THREE.Object3D(), _cc = new THREE.Color();
for (const k in CHIP_SHAPES) {
  chipPools[k] = [];
  for (let v = 0; v < VARIANTS; v++) {
    const sh = CHIP_SHAPES[k](), m = new THREE.InstancedMesh(sh.g, chipMat, CAP[k]);
    m.frustumCulled = false; m.castShadow = true; m.receiveShadow = true; table.add(m);
    dummy.scale.set(0, 0, 0); dummy.updateMatrix();
    for (let i = 0; i < CAP[k]; i++) { m.setMatrixAt(i, dummy.matrix); m.setColorAt(i, new THREE.Color(0xd5dbe0)); }
    chipPools[k].push({ m, rest:sh.rest, head:0, owner:new Array(CAP[k]).fill(null), dirty:false });
  }
}
let liveChips = [];
// yığın: tabla üstünde 3 mm'lik hücrelerde biriken talaş yüksekliği
const pile = new Map(), pileKey = (x, z) => Math.round(x / 3) + ',' + Math.round(z / 3);

/* ---- Parçacık sistemi (GPU noktaları): kıvılcım, duman, buğu, kırık parçalar, kutlama ---- */
const PS_VERT = `attribute vec4 rgba; attribute float size; varying vec4 vC; uniform float scale;
  void main(){ vC = rgba; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = size * scale / max(1.0, -mv.z); gl_Position = projectionMatrix * mv; }`;
const PS_FRAG = `varying vec4 vC; uniform float soft;
  void main(){ float d = length(gl_PointCoord - 0.5) * 2.0; if (d > 1.0) discard;
    float a = soft > 0.5 ? (1.0 - d) * (1.0 - d) : smoothstep(1.0, 0.35, d);
    gl_FragColor = vec4(vC.rgb, vC.a * a); }`;
function makePS(max, additive, soft) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(max * 3), col = new Float32Array(max * 4), size = new Float32Array(max);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('rgba', new THREE.BufferAttribute(col, 4));
  geo.setAttribute('size', new THREE.BufferAttribute(size, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms:{ scale:{ value:600 }, soft:{ value: soft ? 1 : 0 } },
    vertexShader:PS_VERT, fragmentShader:PS_FRAG, transparent:true, depthWrite:false,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
  });
  const pts = new THREE.Points(geo, mat); pts.frustumCulled = false; pts.renderOrder = 5; scene.add(pts);
  const P = [];
  for (let i = 0; i < max; i++) P.push({ alive:false, p:new THREE.Vector3(), v:new THREE.Vector3(), life:0, max:1, k:null });
  return { geo, pos, col, size, P, head:0, max, mat };
}
const PK = {
  spark:  { c0:[1, 0.85, 0.45, 1],   c1:[1, 0.22, 0.04, 0],   s0:1.7, s1:0.5, g:2600,  drag:0.6, bounce:0.35 },
  gold:   { c0:[1, 0.92, 0.55, 1],   c1:[1, 0.55, 0.1, 0],    s0:2.8, s1:0.8, g:700,   drag:0.9, bounce:0.4 },
  smoke:  { c0:[0.5, 0.5, 0.5, 0.32], c1:[0.72, 0.72, 0.74, 0], s0:4,   s1:26,  g:-70,   drag:1.6, bounce:0 },
  mist:   { c0:[0.86, 0.94, 1, 0.26], c1:[0.92, 0.96, 1, 0],    s0:3,   s1:15,  g:-25,   drag:2.6, bounce:0 },
  debris: { c0:[0.3, 0.32, 0.35, 1],  c1:[0.3, 0.32, 0.35, 0],  s0:2.4, s1:2.0, g:2600,  drag:0.3, bounce:0.3 },
  dust:   { c0:[0.22, 0.22, 0.23, 0.95], c1:[0.3, 0.3, 0.3, 0.4], s0:1.3, s1:1.1, g:2200, drag:1.0, bounce:0.05 },
};
const psAdd = makePS(1500, true, false);
const psAlpha = makePS(1200, false, true);
function emit(kind, x, y, z, vx, vy, vz, life) {
  const sys = kind === 'spark' || kind === 'gold' ? psAdd : psAlpha;
  const q = sys.P[sys.head]; sys.head = (sys.head + 1) % sys.max;
  q.alive = true; q.k = PK[kind]; q.p.set(x, y, z); q.v.set(vx, vy, vz); q.life = q.max = life;
}
function burst(kind, n, x, y, z, speed, up, life) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, s = speed * (0.35 + Math.random() * 0.65);
    emit(kind, x, y, z, Math.cos(a) * s, up * (0.4 + Math.random() * 0.8), Math.sin(a) * s, life * (0.5 + Math.random() * 0.7));
  }
}
function updatePS(sys, dt) {
  const { pos, col, size, P } = sys;
  for (let i = 0; i < sys.max; i++) {
    const q = P[i];
    if (!q.alive) { if (size[i] !== 0) { size[i] = 0; col[i * 4 + 3] = 0; } continue; }
    const k = q.k;
    q.life -= dt;
    if (q.life <= 0) { q.alive = false; size[i] = 0; col[i * 4 + 3] = 0; continue; }
    q.v.y -= k.g * dt;
    q.v.multiplyScalar(Math.max(0, 1 - k.drag * dt));
    q.p.addScaledVector(q.v, dt);
    if (k.bounce) {
      const gh = groundAt(q.p.x + S.px, S.py - q.p.z);
      if (q.p.y < gh) { if (gh < -9000) { q.life = 0; } else { q.p.y = gh; q.v.y = -q.v.y * k.bounce; q.v.x *= 0.6; q.v.z *= 0.6; } }
    }
    const t = 1 - q.life / q.max;
    pos[i * 3] = q.p.x; pos[i * 3 + 1] = q.p.y; pos[i * 3 + 2] = q.p.z;
    for (let c = 0; c < 4; c++) col[i * 4 + c] = k.c0[c] + (k.c1[c] - k.c0[c]) * t;
    size[i] = k.s0 + (k.s1 - k.s0) * t;
  }
  sys.geo.attributes.position.needsUpdate = true;
  sys.geo.attributes.rgba.needsUpdate = true;
  sys.geo.attributes.size.needsUpdate = true;
}
let smokeAcc = 0, mistAcc = 0;
function ambientParticles(dt, tip) {
  const T = tool(), r = T.d / 2, now = performance.now();
  const cutting = now - S.lastCut < 250;
  // Isınma dumanı: aşırı yük, sürtünme ya da birikmiş zorlanma; soğutma sıvısı büyük ölçüde bastırır
  const rub = now - (S.rubT || 0) < 600;
  let heat = (cutting ? Math.max(0, S.lastStress - 1.1) * 30 : 0) + S.damage * 50 + (rub && cutting ? 14 : 0);
  if (S.coolant) heat *= 0.2;
  smokeAcc += heat * dt;
  while (smokeAcc >= 1) {
    smokeAcc -= 1;
    const a = Math.random() * Math.PI * 2;
    emit('smoke', Math.cos(a) * r, Math.max(tip, 0) + 2 + Math.random() * 4, Math.sin(a) * r, (Math.random() - .5) * 30, 40 + Math.random() * 40, (Math.random() - .5) * 30, 1.6 + Math.random() * 1.2);
  }
  // Soğutma buğusu: dönen takım sıvıyı savurur
  if (S.coolant && S.spindle) {
    mistAcc += (cutting ? 45 : 14) * dt;
    while (mistAcc >= 1) {
      mistAcc -= 1;
      const a = Math.random() * Math.PI * 2, sp = 60 + Math.random() * 120;
      emit('mist', Math.cos(a) * (r + 1), tip + Math.random() * Math.min(T.flute, 12), Math.sin(a) * (r + 1), -Math.sin(a) * sp + Math.cos(a) * 40, 10 + Math.random() * 30, Math.cos(a) * sp + Math.sin(a) * 40, 0.6 + Math.random() * 0.6);
    }
  }
}
function groundAt(x, y) {
  if (FIX === 'div') {
    const rs = VX.radius, dy = y - DIVY;
    if (x >= 0 && x <= PW && Math.abs(dy) <= rs) return DIVZ + Math.sqrt(rs * rs - dy * dy);
    if (x >= -46 && x < 0 && Math.abs(dy) <= 50) return DIVZ + 50;
    if (x >= -152 && x < -46 && Math.abs(dy) <= 57) return DIVZ + 47;
    if (x >= -172 && x <= -38 && Math.abs(dy) <= 72) return -22;
    return x >= -400 && x <= 550 && y >= -60 && y <= 160 ? -60 : -9999;
  }
  if (ROT.on) {
    toLv(x, y); const lx = LX, ly = LY;
    for (const f of straps) if (lx >= f.b[0] && lx <= f.b[1] && ly >= f.b[2] && ly <= f.b[3]) return f.strapTop;
    if (lx >= 0 && lx <= PW && ly >= 0 && ly <= PD) return H[Math.round(ly / C) * NX + Math.round(lx / C)];
    if (Math.hypot(x - ROT.cx, y - ROT.cy) <= 112) return -4;
    if (Math.abs(x - ROT.cx) <= 125 && Math.abs(y - ROT.cy) <= 115) return -30;
    return x >= -400 && x <= 550 && y >= -60 && y <= 160 ? -60 : -9999;
  }
  for (const f of straps) if (x >= f.b[0] && x <= f.b[1] && y >= f.b[2] && y <= f.b[3]) return f.strapTop;
  if (x >= 0 && x <= PW && y >= 0 && y <= PD) return H[Math.round(y / C) * NX + Math.round(x / C)];
  if (FIX === 'vac') { if (x >= -26 && x <= 286 && y >= -21 && y <= 161) return 0; }
  else if (FIX === 'vise') {
    if (x >= -35 && x <= 185 && ((y >= -25 && y < 0) || (y > PD && y <= PD + 25))) return jawTop;
    if (x >= -35 && x <= 185 && ((y >= -60 && y < -25) || (y > PD + 25 && y <= PD + 50))) return Math.max(-30, jawTop - 3);
    if (x >= 25 && x <= 125 && y >= -95 && y < -75) return -18;
    if (x >= -40 && x <= 190 && y >= -95 && y <= 200) return -35;
  }
  if (x >= -400 && x <= 550 && y >= -60 && y <= 160) return -60;
  return -9999;
}
// fly: 1 kırık talaş takımdan savrulur; küçük değer uzun talaş takımdan yavaşça akar
const _q = new THREE.Quaternion(), _ax = new THREE.Vector3(), _e3 = new THREE.Euler();
function spawnChip(x, y, z, r, drill, kind, s, col, fly = 1) {
  const pool = chipPools[kind] || chipPools.comma, V = pool[Math.random() * pool.length | 0];
  const slot = V.head; V.head = (V.head + 1) % V.owner.length;
  const old = V.owner[slot]; if (old) old.alive = false;
  const lum = 0.9 + Math.random() * 0.2;
  if (col) { _cc.setRGB(col[0] * lum, col[1] * lum, col[2] * lum).convertSRGBToLinear(); V.m.setColorAt(slot, _cc); V.m.instanceColor.needsUpdate = true; }
  const a = Math.random() * TAU, c = { V, slot, s, alive:true, rest:false, p:new THREE.Vector3(), v:new THREE.Vector3(), q:new THREE.Quaternion(), w:new THREE.Vector3(), bounces:0 };
  if (drill) {
    // matkap talaşı: kanallardan yukarı sarmal çıkar, deliğin çevresine dökülür
    c.p.set(x + Math.cos(a) * r * 0.7, z, -(y + Math.sin(a) * r * 0.7));
    const sp = (80 + Math.random() * 140) * fly;
    c.v.set(Math.cos(a) * sp - Math.sin(a) * 120 * fly, (260 + Math.random() * 240) * (0.4 + 0.6 * fly), -(Math.sin(a) * sp + Math.cos(a) * 120 * fly));
  } else {
    // freze talaşı: ağzın kesişinden teğet yönde savrulur
    c.p.set(x + Math.cos(a) * r, z, -(y + Math.sin(a) * r));
    const sp = (250 + Math.random() * 450) * fly;
    c.v.set(-Math.sin(a) * sp, (120 + Math.random() * 260) * (0.5 + 0.5 * fly), -Math.cos(a) * sp);
  }
  c.q.setFromEuler(_e3.set(Math.random() * TAU, Math.random() * TAU, Math.random() * TAU));
  const ws = 22 * (0.3 + 0.7 * fly);
  c.w.set((Math.random() - .5) * ws, (Math.random() - .5) * ws, (Math.random() - .5) * ws);
  V.owner[slot] = c; liveChips.push(c);
}
function setChipMatrix(c) {
  dummy.position.copy(c.p); dummy.quaternion.copy(c.q); dummy.scale.setScalar(c.s); dummy.updateMatrix();
  c.V.m.setMatrixAt(c.slot, dummy.matrix); c.V.dirty = true;
}
// yere değince: hızlıysa seker ve döner, yavaşsa yatar; yattığı hücrenin yığın yüksekliği artar
function settle(c, g) {
  const yaw = Math.random() * TAU, tilt = (Math.random() - .5) * 0.35;
  if (c.V.rest === 'side') c.q.setFromEuler(_e3.set(Math.PI / 2 + tilt, yaw, (Math.random() - .5) * 0.3, 'YXZ'));
  else c.q.setFromEuler(_e3.set(tilt, yaw, (Math.random() - .5) * 0.35, 'YXZ'));
  const key = pileKey(c.p.x, c.p.z), hgt = chipH(c);
  const ph = pile.get(key) || 0;
  c.p.y = g + ph + hgt * 0.45; pile.set(key, ph + hgt * 0.35);
  c.rest = true; c.pileKey = key; c.v.set(0, 0, 0);
}
const chipH = c => c.s * (c.V.rest === 'side' ? 2.6 : 1.2);
// Yatan talaşları denetle: altındaki malzeme kesildiyse ya da altındaki talaş savrulduysa düşsün.
// Yığın yüksekliği her seferinde yalnızca gerçekten yatan talaşlardan yeniden kurulur, eski değer birikmez.
let restCheckT = 0;
function checkResting(dt) {
  if ((restCheckT += dt) < 0.2) return;
  restCheckT = 0;
  const np = new Map();
  for (const c of liveChips) {
    if (!c.alive || !c.rest) continue;
    const g = groundAt(c.p.x, -c.p.z), key = pileKey(c.p.x, c.p.z), hgt = chipH(c);
    const base = g < -9000 ? -1e9 : g + (np.get(key) || 0);
    if (c.p.y > base + hgt * 0.45 + 0.8) { c.rest = false; c.bounces = 2; c.v.set((Math.random() - .5) * 20, 0, (Math.random() - .5) * 20); continue; }   // havada kaldı: düşer
    np.set(key, (np.get(key) || 0) + hgt * 0.35);
  }
  pile.clear(); for (const [k, v] of np) pile.set(k, v);
}
function updateChips(dt) {
  checkResting(dt);
  let dead = 0;
  for (const c of liveChips) {
    if (!c.alive) { dead++; continue; }
    if (c.rest) continue;
    c.v.y -= 3000 * dt;
    const drag = Math.max(0, 1 - 1.4 * dt);                       // hafif ve yassı: havada çabuk yavaşlar
    c.v.x *= drag; c.v.z *= drag;
    c.p.addScaledVector(c.v, dt);
    const wl = c.w.length();
    if (wl > 1e-3) { _ax.copy(c.w).divideScalar(wl); _q.setFromAxisAngle(_ax, wl * dt); c.q.premultiply(_q); }
    const g = groundAt(c.p.x, -c.p.z);
    if (g < -9000) { if (c.p.y < -700) { c.alive = false; dummy.scale.set(0, 0, 0); dummy.updateMatrix(); c.V.m.setMatrixAt(c.slot, dummy.matrix); c.V.dirty = true; c.V.owner[c.slot] = null; dead++; continue; } }
    else {
      const top = g + (pile.get(pileKey(c.p.x, c.p.z)) || 0) + 0.3 * c.s;
      if (c.p.y <= top) {
        if (c.v.y < -160 && c.bounces < 2) {                      // sek
          c.p.y = top; c.v.y *= -0.28; c.v.x *= 0.55; c.v.z *= 0.55; c.bounces++;
          c.w.set((Math.random() - .5) * 18, (Math.random() - .5) * 18, (Math.random() - .5) * 18);
        } else settle(c, g);
      }
    }
    setChipMatrix(c);
  }
  if (dead > 200) liveChips = liveChips.filter(c => c.alive);
  for (const k in chipPools) for (const V of chipPools[k]) if (V.dirty) { V.m.instanceMatrix.needsUpdate = true; V.dirty = false; }
}
// takım yattığı talaşa değerse talaş savrulur (parçanın üstünde kalan talaş kesilen yerde havada kalmasın)
let kickT = 0;
function kickChips(x, y, r, tip) {
  if ((kickT = (kickT + 1) % 3)) return;
  const cx = x, cz = -y;
  for (const c of liveChips) {
    if (!c.alive || !c.rest) continue;
    const dx = c.p.x - cx, dz = c.p.z - cz, d = Math.hypot(dx, dz);
    if (d > r + 2.5 || c.p.y < tip - 3) continue;
    const a = Math.atan2(dz, dx), sp = 250 + Math.random() * 350;
    c.rest = false; c.bounces = 0;
    c.v.set(Math.cos(a) * sp - Math.sin(a) * 200, 150 + Math.random() * 200, Math.sin(a) * sp + Math.cos(a) * 200);
    c.w.set((Math.random() - .5) * 25, (Math.random() - .5) * 25, (Math.random() - .5) * 25);
  }
}
function clearChips() {
  dummy.scale.set(0, 0, 0); dummy.updateMatrix();
  for (const k in chipPools) for (const V of chipPools[k]) {
    for (let i = 0; i < V.owner.length; i++) { V.m.setMatrixAt(i, dummy.matrix); V.owner[i] = null; }
    V.m.instanceMatrix.needsUpdate = true;
  }
  liveChips = []; pile.clear();
}
// Talaş biçimi: frezede her ağız ayrı talaş keser (kesintili kesme), bu yüzden talaş genelde kısa virgüldür.
// Diş başına ilerleme çok küçükse ince ve uzun kıvrık (sürtme), çok büyükse kalın, sıcak kıvrık çıkar.
// Matkapta sürekli kesme olduğundan talaş tornadaki gibi devir başına ilerlemeye göre kırılır.
const CHIP_TXT = { comma:'kısa virgül ✓', thin:'ince uzun kıvrık ⚠', thick:'kalın sıcak kıvrık', spring:'uzun matkap spirali', six:'kırık matkap talaşı ✓',
  flake:'iğne ve pul ✓', dust:'toz ve kırıntı', ribbon:'sürekli şerit', gum:'uzun tel (naylon) ⚠', torn:'yırtık, düzensiz' };
function chipForm(T, chip, fRev, vr) {
  if (mat.chip === 'dust') return 'dust';
  if (mat.chip === 'flake') return 'flake';
  if (mat.chip === 'gum') return 'gum';
  if (isDrill(T)) {
    if (mat.chip === 'ribbon') return 'ribbon';
    return fRev < mat.breakF * (S.coolant && !mat.dry ? 0.9 : 1) ? 'spring' : 'six';
  }
  if (mat.chip === 'ribbon') return chip < 0.8 ? 'ribbon' : 'comma';
  if (mat.bue && vr < 0.3) return 'torn';                       // çok düşük hızda yığıntı ağız
  const lo = mat.chip === 'string' ? 0.6 : 0.45;               // paslanmaz ince talaşta daha kolay sürter
  if (chip < lo) return 'thin';
  if (chip > 1.8) return 'thick';
  return 'comma';
}
function chipsFor(nx, ny, z, T, vol, form, heat) {
  const r = T.d / 2, drill = isDrill(T), sz = 0.75 + Math.min(0.6, T.d * 0.025);
  if (form === 'dust') {
    const n = Math.min(5, vol / 1.2);
    for (let k = 0; k < n; k++) { const a = Math.random() * TAU; emit('dust', Math.cos(a) * r, z, Math.sin(a) * r, -Math.sin(a) * 160, 40 + Math.random() * 120, Math.cos(a) * 160, 1.4); }
    if (Math.random() < 0.3 * AYAR.talas) spawnChip(nx, ny, z, r, drill, 'flake', 0.6 + Math.random() * 0.3, mat.chipCol);
    return;
  }
  const tcol = () => heat < 0.9 ? mat.chipCol : heat < 1.2 ? [0.80, 0.62, 0.32] : heat < 1.5 ? [0.55, 0.36, 0.55] : [0.30, 0.40, 0.80];
  const long = form === 'thin' || form === 'spring' || form === 'ribbon' || form === 'gum';
  const n = Math.min(long ? 2 : 4, Math.floor(vol / (long ? 3 : 1.2) * AYAR.talas + Math.random()));   // talaş ayarı üretimi seyreltir
  const FLY = { gum:0.3, ribbon:0.35, spring:0.5, thin:0.5, thick:1.2, flake:1.25 };
  for (let k = 0; k < n; k++) {
    const kind = form === 'comma' || !chipPools[form] ? 'comma' : form;
    const s = kind === 'flake' ? 0.8 + Math.random() * 0.4 : kind === 'thick' ? sz * 1.15 : kind === 'spring' || kind === 'six' ? 0.7 + r * 0.06 : sz * (0.85 + Math.random() * 0.3);
    spawnChip(nx, ny, z, r, drill, kind, s, tcol(), FLY[form] || 1.1);
  }
}

/* ---- Takım görselleri: helis kanallı gerçek 3B gövdeler ----
   Kesit, açıya bağlı bir yarıçap profili r(θ): her ağız için fatura (land), kesme yüzü, kanal dibi (göbek) ve sırt.
   Bu kesit eksen boyunca helis açısına göre döndürülerek süpürülür; uçta düz, küresel ya da konik kapanış olur.
   Geometri tamamen parametrelerden üretilir (çap, ağız sayısı, helis açısı, kanal boyu, göbek, köşe), böylece takım ileride düzenlenebilir. */
Object.assign(app, { groundAt });   // önceki modüllerin geç başvuruları

export { CHIP_TXT, ambientParticles, burst, chipForm, chipMat, chipsFor, clearChips, emit, groundAt, kickChips,
  liveChips, psAdd, psAlpha, updateChips, updatePS };
