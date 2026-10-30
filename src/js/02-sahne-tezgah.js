// ── Sahne ve tezgâh: renderer, ışık, malzemeler, atölye, gövde, kafa, kovan, kollar, soğutma hortumu
import { $, S, TAU, app, clamp, tool } from './00-temel.js';

const canvas = $('c'), stage = $('stage');
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
} catch (e) {
  stage.innerHTML = '<p style="padding:24px">Bu tarayıcı WebGL desteklemiyor; simülasyon çalışamıyor.</p>';
  throw new Error('WebGL yok');
}
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputEncoding = THREE.sRGBEncoding;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x151b1d);
scene.fog = new THREE.Fog(0x151b1d, 2600, 8000);
const camera = new THREE.PerspectiveCamera(40, 1, 2, 9000);
const controls = new THREE.OrbitControls(camera, canvas);
controls.enableDamping = true; controls.dampingFactor = 0.12;
controls.maxPolarAngle = Math.PI * 0.95;

scene.add(new THREE.HemisphereLight(0xdfe9ff, 0x2a2622, 0.25));
const sun = new THREE.DirectionalLight(0xffffff, 0.75);
sun.position.set(260, 700, 380); sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left:-750, right:850, top:800, bottom:-900, near:100, far:2600 });
sun.shadow.bias = -0.0008;
scene.add(sun);
const fill = new THREE.DirectionalLight(0x9fc4ff, 0.18); fill.position.set(-400, 200, -200); scene.add(fill);

const M = {
  paint: new THREE.MeshStandardMaterial({ color:0x56766f, roughness:0.62, metalness:0.15 }),
  paintDark: new THREE.MeshStandardMaterial({ color:0x3e5651, roughness:0.7, metalness:0.1 }),
  steel: new THREE.MeshStandardMaterial({ color:0x9aa3a8, roughness:0.38, metalness:0.75 }),
  ground: new THREE.MeshStandardMaterial({ color:0x6f777b, roughness:0.32, metalness:0.8 }),
  dark: new THREE.MeshStandardMaterial({ color:0x24292c, roughness:0.5, metalness:0.6 }),
  black: new THREE.MeshStandardMaterial({ color:0x111416, roughness:0.6, metalness:0.3 }),
  yellow: new THREE.MeshStandardMaterial({ color:0xf0b429, roughness:0.5, metalness:0.1 }),
  floor: new THREE.MeshStandardMaterial({ color:0x2a2f30, roughness:0.95, metalness:0 }),
  raw: new THREE.MeshStandardMaterial({ color:0x8d9396, roughness:0.55, metalness:0.55, side:THREE.DoubleSide }),
};
function box(w, h, d, mat, x, y, z, parent, shadow = true) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z); m.castShadow = shadow; m.receiveShadow = true;
  (parent || scene).add(m); return m;
}
function cyl(rt, rb, h, mat, seg = 32) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);
  m.castShadow = true; m.receiveShadow = true; return m;
}

function boxR(x0, x1, y0, y1, z0, z1, mat, parent) { return box(x1 - x0, y1 - y0, z1 - z0, mat, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, parent); }

/* ---- Ortam yansıması, ton eşleme, mat boya ---- */
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.85;
if (THREE.RoomEnvironment) {
  const pm = new THREE.PMREMGenerator(renderer);
  scene.environment = pm.fromScene(new THREE.RoomEnvironment(), 0.04).texture;
  pm.dispose();
  for (const k of ['paint', 'paintDark', 'dark', 'black', 'yellow', 'floor']) M[k].envMapIntensity = 0.25;
  M.steel.envMapIntensity = 0.45; M.ground.envMapIntensity = 0.5;   // makine mat; parlak kalan tek şey işlenen parça
}
// gerçek atölye ortamı (assets/hdri, CC0): metaller tavan vincini, pencereleri ve tezgâhları yansıtır; yüklenemezse yapay oda kalır
new THREE.RGBELoader().setDataType(THREE.UnsignedByteType).load('assets/hdri/machine_shop_02_1k.hdr', hdr => {
  const pm = new THREE.PMREMGenerator(renderer);
  const old = scene.environment;
  scene.environment = pm.fromEquirectangular(hdr).texture;
  pm.dispose(); hdr.dispose(); if (old) old.dispose();
}, undefined, () => {});
// gövde renkleri sRGB olarak verildi; doğrusal uzaya çevrilmezse soluk, beyazımsı görünür
M.paint = new THREE.MeshStandardMaterial({ color:0x5f7d72, roughness:0.86, metalness:0.04 });
M.paintDark = new THREE.MeshStandardMaterial({ color:0x44574f, roughness:0.88, metalness:0.04 });
M.steel = new THREE.MeshStandardMaterial({ color:0x8a9196, roughness:0.58, metalness:0.55 });
M.ground = new THREE.MeshStandardMaterial({ color:0x7a8286, roughness:0.48, metalness:0.6 });
for (const k of ['paint', 'paintDark', 'steel', 'ground']) M[k].color.convertSRGBToLinear();
M.paint.envMapIntensity = M.paintDark.envMapIntensity = 0.25; M.steel.envMapIntensity = 0.45; M.ground.envMapIntensity = 0.5;

/* ---- Tezgâh ve atölye görünümü ---- */
const NOISE_GLSL = `
float h3(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float vnoise(vec3 x) {
  vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(h3(i), h3(i + vec3(1,0,0)), f.x), mix(h3(i + vec3(0,1,0)), h3(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(h3(i + vec3(0,0,1)), h3(i + vec3(1,0,1)), f.x), mix(h3(i + vec3(0,1,1)), h3(i + vec3(1,1,1)), f.x), f.y), f.z);
}`;
function addMottle(m, sc, amt) {
  m.onBeforeCompile = sh => {
    sh.uniforms.mSc = { value:sc }; sh.uniforms.mAmt = { value:amt };
    sh.vertexShader = 'varying vec3 vWp;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  vWp = (modelMatrix * vec4(position, 1.0)).xyz;');
    sh.fragmentShader = 'uniform float mSc;\nuniform float mAmt;\nvarying vec3 vWp;\n' + NOISE_GLSL + '\n' + sh.fragmentShader
      .replace('#include <color_fragment>', `#include <color_fragment>
        float nz = vnoise(vWp * mSc) * 0.55 + vnoise(vWp * mSc * 4.3) * 0.3 + vnoise(vWp * mSc * 17.0) * 0.15;
        diffuseColor.rgb *= 1.0 - mAmt + 2.0 * mAmt * nz;`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = clamp(roughnessFactor + (nz - 0.5) * mAmt * 1.6, 0.05, 1.0);`);
  };
  m.customProgramCacheKey = () => 'mottle';
}
const lin = h => new THREE.Color(h).convertSRGBToLinear();
function smat(hex, rough, metal, env = 0.3, extra) {
  const m = new THREE.MeshStandardMaterial(Object.assign({ color:lin(hex), roughness:rough, metalness:metal }, extra || {}));
  m.envMapIntensity = env; return m;
}
/* ---- Dokular (assets/doku, CC0): üç düzlemli kaplama ----
   Tezgâh kodla kurulan kutu/silindirlerden oluşuyor, düzgün UV yok; doku dünya konumundan üç eksende yansıtılıp
   yüzey normaline göre karıştırılır (whiteout normal karışımı). Doku yüklenene kadar ve yüklenemezse (file://)
   yalnızca gürültü dalgalanması kalır. alb: dokunun rengi ne kadar kullanılsın (0: yalnızca açık-koyu detay, rengi
   malzemeden; 1: dokunun kendi rengi), sc: 1 / doku boyu (mm), nStr: normal haritası şiddeti, det: açık-koyu detayın şiddeti. */
const TEX_DIR = 'assets/doku/';
const texLoader = new THREE.TextureLoader();
const blankTex = new THREE.DataTexture(new Uint8Array([128, 128, 255, 255]), 1, 1, THREE.RGBAFormat);
const texCache = {};
function loadTex(name) {
  if (!texCache[name]) {
    texCache[name] = new Promise(res => texLoader.load(TEX_DIR + name, t => {
      t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = renderer.capabilities.getMaxAnisotropy();
      res(t);
    }, undefined, () => res(null)));
  }
  return texCache[name];
}
/* Doku parçaya yapışık kalsın: her mesh ilk çizildiğinde köşelerinin o anki dünya konumu ve normali (duruş konumu)
   restPos/restNor özniteliği olarak kaydedilir; doku hep bu konumdan yansıtılır. Tabla, kızak ya da çark hareket edince
   doku parçayla birlikte gider. Aynı geometriyi paylaşan ikinci mesh kendi kopyasını alır. */
const _nm = new THREE.Matrix3(), _v = new THREE.Vector3();
function bakeRest(obj, g) {
  if (g.userData.restOwner != null && g.userData.restOwner !== obj.id) { obj.geometry = g = g.clone(); }
  const P = g.attributes.position, N = g.attributes.normal, n = P.count;
  const rp = new Float32Array(n * 3), rn = new Float32Array(n * 3);
  _nm.getNormalMatrix(obj.matrixWorld);
  for (let i = 0; i < n; i++) {
    _v.fromBufferAttribute(P, i).applyMatrix4(obj.matrixWorld); rp[i*3] = _v.x; rp[i*3+1] = _v.y; rp[i*3+2] = _v.z;
    if (N) { _v.fromBufferAttribute(N, i).applyMatrix3(_nm).normalize(); rn[i*3] = _v.x; rn[i*3+1] = _v.y; rn[i*3+2] = _v.z; }
  }
  g.setAttribute('restPos', new THREE.BufferAttribute(rp, 3));
  g.setAttribute('restNor', new THREE.BufferAttribute(rn, 3));
  g.userData.restOwner = obj.id;
}
// Sahne çizimine başlamadan (dünya matrisleri güncel, nesneler GPU'ya yüklenmeden) yeni mesh'ler kaydedilir.
// Mesh.onBeforeRender'da eklenen öznitelik o karede yüklenmiyor ve three.js bağlantıyı öyle önbelleğe alıyor (yüzey kararır).
const surfMesh = o => o.isMesh && o.material && (Array.isArray(o.material) ? o.material.some(m => m.userData.restSurface) : o.material.userData.restSurface);
scene.onBeforeRender = () => {
  scene.traverseVisible(o => { if (surfMesh(o) && (!o.geometry.attributes.restPos || o.geometry.userData.restOwner !== o.id)) bakeRest(o, o.geometry); });
};
function addSurface(m, set, o) {
  m.userData.restSurface = true;
  const u = {
    mSc: { value:o.mSc }, mAmt: { value:o.mAmt },
    tDiff: { value:blankTex }, tNor: { value:blankTex }, tRough: { value:blankTex },
    tOn: { value:0 }, tSc: { value:o.sc }, tAlb: { value:o.alb || 0 }, tMean: { value:o.mean || 0.5 },
    tRgh: { value:o.rough == null ? 1 : o.rough }, tNStr: { value:o.nStr == null ? 1 : o.nStr }, tDet: { value:o.det == null ? 1 : o.det },
  };
  Promise.all(['diff', 'nor_gl', 'rough'].map(k => loadTex(`${set}_${k}_1k.jpg`))).then(([d, n, r]) => {
    if (!d || !n || !r) return;
    u.tDiff.value = d; u.tNor.value = n; u.tRough.value = r; u.tOn.value = 1;
  });
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = 'attribute vec3 restPos;\nattribute vec3 restNor;\nvarying vec3 vWp;\nvarying vec3 vWn;\nvarying vec3 vCn;\n' + sh.vertexShader.replace('#include <begin_vertex>',
      '#include <begin_vertex>\n  vWp = restPos;\n  vWn = restNor;\n  vCn = normalize(mat3(modelMatrix) * objectNormal);');
    sh.fragmentShader = `uniform float mSc, mAmt, tOn, tSc, tAlb, tMean, tRgh, tNStr, tDet;
uniform sampler2D tDiff, tNor, tRough;
varying vec3 vWp;
varying vec3 vWn;
varying vec3 vCn;
${NOISE_GLSL}
// a yönünü b yönüne getiren dönüşü v'ye uygula (duruştaki normal haritasını parçanın şimdiki yönüne çevirir)
vec3 rotTo(vec3 v, vec3 a, vec3 b) { vec3 c = cross(a, b); float d = dot(a, b); return d < -0.999 ? -v : v * d + cross(c, v) + c * dot(c, v) / (1.0 + d); }
vec3 triW(vec3 n) { vec3 b = pow(abs(n), vec3(4.0)); return b / (b.x + b.y + b.z); }
vec4 tri(sampler2D t, vec3 p, vec3 w) { return texture2D(t, p.zy) * w.x + texture2D(t, p.xz) * w.y + texture2D(t, p.xy) * w.z; }
` + sh.fragmentShader
      .replace('#include <color_fragment>', `#include <color_fragment>
        vec3 tn0 = normalize(vWn), tw = triW(tn0), tp = vWp * tSc;
        float nz = vnoise(vWp * mSc) * 0.55 + vnoise(vWp * mSc * 4.3) * 0.3 + vnoise(vWp * mSc * 17.0) * 0.15;
        diffuseColor.rgb *= 1.0 - mAmt + 2.0 * mAmt * nz;
        if (tOn > 0.5) {
          vec3 tc = pow(tri(tDiff, tp, tw).rgb, vec3(2.2));
          float lum = dot(tc, vec3(0.2126, 0.7152, 0.0722));
          diffuseColor.rgb = mix(diffuseColor.rgb * mix(1.0, clamp(lum / tMean, 0.25, 1.8), tDet), tc * diffuseColor.rgb * 2.0, tAlb);
        }`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = clamp(roughnessFactor + (nz - 0.5) * mAmt * 1.6, 0.05, 1.0);
        if (tOn > 0.5) roughnessFactor = clamp(mix(roughnessFactor, tri(tRough, tp, tw).g, tRgh), 0.05, 1.0);`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        if (tOn > 0.5 && tNStr > 0.0) {
          vec3 nx = texture2D(tNor, tp.zy).xyz * 2.0 - 1.0, ny = texture2D(tNor, tp.xz).xyz * 2.0 - 1.0, nzz = texture2D(tNor, tp.xy).xyz * 2.0 - 1.0;
          nx = vec3(nx.xy + tn0.zy, abs(nx.z) * tn0.x); ny = vec3(ny.xy + tn0.xz, abs(ny.z) * tn0.y); nzz = vec3(nzz.xy + tn0.xy, abs(nzz.z) * tn0.z);
          vec3 wn = rotTo(normalize(nx.zyx * tw.x + ny.xzy * tw.y + nzz.xyz * tw.z), tn0, normalize(vCn));
          normal = normalize(mix(normal, normalize((viewMatrix * vec4(wn, 0.0)).xyz), tNStr));
        }`);
  };
  m.customProgramCacheKey = () => 'surface';
}
// tezgâh boyası: yeşil rengimiz kalır, dokudan çizik/aşınma detayı, pürüzlülük ve normal gelir (doku ~700 mm)
addSurface(M.paint, 'green_metal_rust', { mSc:0.08, mAmt:0.05, sc:1 / 700, alb:0, mean:0.063, rough:0.7, nStr:0.6, det:0.55 });
addSurface(M.paintDark, 'green_metal_rust', { mSc:0.08, mAmt:0.05, sc:1 / 700, alb:0, mean:0.063, rough:0.7, nStr:0.6, det:0.55 });
// zemin: lekeli beton, dokunun kendi rengi (doku ~2 m)
M.floor = smat(0x8a8a86, 0.92, 0, 0.15);
addSurface(M.floor, 'garage_floor', { mSc:0.004, mAmt:0.08, sc:1 / 2000, alb:1, rough:1, nStr:1 });
// çelik ve taşlanmış tabla: boya dokusunun çizik ve leke detayı, hafif (metal parlak kalır, kullanılmış görünür)
addSurface(M.steel, 'green_metal_rust', { mSc:0.05, mAmt:0.04, sc:1 / 450, alb:0, mean:0.063, rough:0.35, nStr:0.25 });
addSurface(M.ground, 'green_metal_rust', { mSc:0.05, mAmt:0.03, sc:1 / 600, alb:0, mean:0.063, rough:0.3, nStr:0.2 });
const MX = {
  cream: smat(0xc9c6b6, 0.8, 0.02, 0.2),
  wallLow: smat(0x3f5a51, 0.9, 0, 0.12), wallHigh: smat(0x9fa39a, 0.95, 0, 0.1),
  rubber: smat(0x1b1d1e, 0.95, 0, 0.05),
  tray: smat(0x6a7176, 0.55, 0.6, 0.35),
  red: smat(0xb3261e, 0.45, 0.05, 0.3), green: smat(0x2f8f4e, 0.45, 0.05, 0.3),
  stripe: smat(0xe0a92a, 0.7, 0, 0.15),
  cabinet: smat(0x9b2b24, 0.6, 0.15, 0.3), cabinetDark: smat(0x2b2f33, 0.6, 0.3, 0.3),
  wood: smat(0x7a5a3a, 0.85, 0, 0.1), chrome: smat(0xd8dde0, 0.18, 1, 0.8),
  glow: new THREE.MeshBasicMaterial({ color:0xf4f1e6 }),
};
// duvarlar: boyalı beton (beton dokusunun detayı, rengi duvar boyasından)
addSurface(MX.wallLow, 'garage_floor', { mSc:0.006, mAmt:0.06, sc:1 / 1800, alb:0, mean:0.161, rough:0.6, nStr:0.7 });
addSurface(MX.wallHigh, 'garage_floor', { mSc:0.006, mAmt:0.06, sc:1 / 1800, alb:0, mean:0.161, rough:0.6, nStr:0.7 });
addMottle(MX.cabinet, 0.05, 0.05);
// Yuvarlatılmış kenarlı kutu (döküm ve sac parçalar için)
function rbox(x0, x1, y0, y1, z0, z1, r, mat, parent, shadow = true) {
  const w = x1 - x0, h = y1 - y0, d = z1 - z0;
  r = Math.min(r, w / 2 - 0.01, h / 2 - 0.01, d / 2 - 0.01);
  const sh = new THREE.Shape(), hw = w / 2 - r, hh = h / 2 - r;
  sh.moveTo(-hw, -hh); sh.lineTo(hw, -hh); sh.lineTo(hw, hh); sh.lineTo(-hw, hh); sh.lineTo(-hw, -hh);
  const g = new THREE.ExtrudeGeometry(sh, { depth:Math.max(0.01, d - 2 * r), bevelEnabled:r > 0.05, bevelSize:r, bevelThickness:r, bevelSegments:3, curveSegments:1 });
  g.translate(0, 0, -(d - 2 * r) / 2);
  const m = new THREE.Mesh(g, mat);
  m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  m.castShadow = shadow; m.receiveShadow = true; (parent || scene).add(m); return m;
}
// Kol: göbek, eğik çubuk ve siyah topuz
function lever(parent, x, y, z, len, tilt, knob = 11, mat = M.steel) {
  const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g);
  const boss = cyl(9, 11, 12, M.paintDark, 16); boss.rotation.x = Math.PI / 2; g.add(boss);
  const arm = new THREE.Group(); arm.rotation.x = tilt; g.add(arm);
  const rod = cyl(3.2, 3.2, len, mat, 10); rod.position.y = len / 2; arm.add(rod);
  const kn = new THREE.Mesh(new THREE.SphereGeometry(knob, 16, 12), M.black); kn.position.y = len; kn.castShadow = true; arm.add(kn);
  const hit = new THREE.Mesh(new THREE.SphereGeometry(knob * 2.2, 8, 6), M.black); hit.visible = false; hit.position.y = len * 0.8; arm.add(hit);   // fareyle tutması kolay olsun
  return arm;
}
function dialTexture(label, n, big) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 256;
  const g = cv.getContext('2d');
  g.fillStyle = '#d7d8d0'; g.beginPath(); g.arc(128, 128, 126, 0, TAU); g.fill();
  g.strokeStyle = '#1c2224'; g.fillStyle = '#1c2224'; g.lineWidth = 3; g.textAlign = 'center'; g.textBaseline = 'middle';
  for (let k = 0; k < n; k++) {
    const a = k / n * TAU - Math.PI / 2, major = k % (n / 10) === 0;
    g.beginPath(); g.moveTo(128 + Math.cos(a) * 124, 128 + Math.sin(a) * 124); g.lineTo(128 + Math.cos(a) * (major ? 100 : 112), 128 + Math.sin(a) * (major ? 100 : 112)); g.stroke();
    if (big && major) { g.font = 'bold 20px sans-serif'; g.fillText(String(k / (n / 10) * (big)), 128 + Math.cos(a) * 82, 128 + Math.sin(a) * 82); }
  }
  g.font = 'bold 22px sans-serif'; if (label) g.fillText(label, 128, 128);
  const t = new THREE.CanvasTexture(cv); t.encoding = THREE.sRGBEncoding; t.anisotropy = 4; return t;
}

/* -- atölye: zemin, güvenlik çizgileri, duvarlar, tavan lambaları, dolap ve tezgâh -- */
const FLOOR_Y = -760;
const floor = new THREE.Mesh(new THREE.PlaneGeometry(9000, 9000), M.floor);
floor.rotation.x = -Math.PI / 2; floor.position.y = FLOOR_Y; floor.receiveShadow = true; scene.add(floor);
{
  const y = FLOOR_Y + 0.6, W = 46;
  const lines = [[-900, 1000, 600, 600 + W], [-900, 1000, -800 - W, -800], [-900 - W, -900, -800 - W, 600 + W], [1000, 1000 + W, -800 - W, 600 + W]];
  for (const [x0, x1, z0, z1] of lines) boxR(x0, x1, y - 0.5, y + 0.5, z0, z1, MX.stripe).castShadow = false;
  // operatörün durduğu kauçuk paspas
  rbox(-420, 620, FLOOR_Y, FLOOR_Y + 14, 300, 880, 6, MX.rubber).castShadow = false;
  for (let x = -390; x < 600; x += 40) boxR(x, x + 14, FLOOR_Y + 14, FLOOR_Y + 17, 310, 870, MX.rubber).castShadow = false;
  // duvarlar: altı boyalı lambri, üstü açık renk
  const wall = (x0, x1, z0, z1) => { boxR(x0, x1, FLOOR_Y, FLOOR_Y + 1300, z0, z1, MX.wallLow).castShadow = false; boxR(x0, x1, FLOOR_Y + 1300, FLOOR_Y + 3600, z0, z1, MX.wallHigh).castShadow = false; boxR(x0 - 4, x1 + 4, FLOOR_Y + 1290, FLOOR_Y + 1320, z0 - 4, z1 + 4, MX.stripe).castShadow = false; };
  wall(-3400, 3600, -1640, -1600); wall(-3400, -3360, -1600, 3000);
  // tavan floresanları
  for (const x of [-1200, 300, 1800]) for (const z of [-700, 700]) {
    boxR(x - 600, x + 600, 2450, 2480, z - 60, z + 60, MX.cabinetDark).castShadow = false;
    boxR(x - 580, x + 580, 2440, 2452, z - 40, z + 40, MX.glow).castShadow = false;
  }
  // takım dolabı (sol arka)
  const cx = -2300, cz = -1480;
  rbox(cx - 380, cx + 380, FLOOR_Y, FLOOR_Y + 1050, cz - 120, cz + 120, 8, MX.cabinet);
  for (let k = 0; k < 6; k++) {
    const y0 = FLOOR_Y + 70 + k * 160;
    rbox(cx - 360, cx + 360, y0, y0 + 140, cz + 120, cz + 128, 3, MX.cabinet);
    rbox(cx - 120, cx + 120, y0 + 100, y0 + 112, cz + 128, cz + 142, 4, MX.chrome);
  }
  rbox(cx - 400, cx + 400, FLOOR_Y + 1050, FLOOR_Y + 1080, cz - 140, cz + 140, 5, MX.wood);
  // dolabın üstünde kumpas kutusu ve yağdanlık
  rbox(cx - 250, cx - 30, FLOOR_Y + 1080, FLOOR_Y + 1130, cz - 60, cz + 40, 4, MX.cabinetDark);
  const can = cyl(55, 70, 150, MX.stripe, 24); can.position.set(cx + 200, FLOOR_Y + 1155, cz); scene.add(can);
  const spout = cyl(6, 9, 180, MX.chrome, 10); spout.position.set(cx + 270, FLOOR_Y + 1280, cz); spout.rotation.z = -0.9; scene.add(spout);
  // delikli pano ve anahtarlar
  rbox(cx - 380, cx + 380, FLOOR_Y + 1250, FLOOR_Y + 1900, -1600, -1585, 3, MX.cream);
  for (let k = 0; k < 7; k++) { const w = rbox(cx - 320 + k * 100, cx - 300 + k * 100, FLOOR_Y + 1380, FLOOR_Y + 1620 - k * 18, -1585, -1575, 6, MX.chrome); w.castShadow = false; }
  // sağ arkada çalışma tezgâhı ve mengene
  const bx = 2000, bz = -1350;
  rbox(bx - 700, bx + 700, FLOOR_Y + 820, FLOOR_Y + 880, bz - 300, bz + 300, 6, MX.wood);
  for (const sx of [-650, 650]) for (const sz of [-250, 250]) rbox(bx + sx - 30, bx + sx + 30, FLOOR_Y, FLOOR_Y + 820, bz + sz - 30, bz + sz + 30, 4, MX.cabinetDark);
  rbox(bx - 680, bx + 680, FLOOR_Y + 120, FLOOR_Y + 150, bz - 280, bz + 280, 4, MX.cabinetDark);
  rbox(bx + 300, bx + 520, FLOOR_Y + 880, FLOOR_Y + 1010, bz + 150, bz + 290, 8, M.paint);
  rbox(bx + 280, bx + 540, FLOOR_Y + 1000, FLOOR_Y + 1060, bz + 170, bz + 270, 6, M.ground);
  // talaş varili
  const drum = cyl(280, 280, 880, smat(0x2f4f7a, 0.55, 0.3), 32); drum.position.set(2500, FLOOR_Y + 440, -700); scene.add(drum);
  for (const y of [180, 700]) { const r = new THREE.Mesh(new THREE.TorusGeometry(282, 7, 8, 48), MX.tray); r.rotation.x = Math.PI / 2; r.position.set(2500, FLOOR_Y + y, -700); scene.add(r); }
}

/* -- konsollu dik freze gövdesi (Bridgeport tarzı) --
   Ölçüler eski kutu gövdenin zarfında; çarpışma ve talaş zeminleri (groundAt, fikstür listesi) değişmedi. */
// el çarkı: krom jant, çanak kollar, bölüntülü bilezik, döner kol (çark düzlemi XY, ekseni Z)
const collarMat = new THREE.MeshStandardMaterial({ map:dialTexture('', 100, 0), roughness:0.45, metalness:0.5 });
function hwheel(parent, R = 48) {
  const rim = new THREE.Mesh(new THREE.TorusGeometry(R, 5, 14, 48), MX.chrome); rim.castShadow = true; parent.add(rim);
  const hub = cyl(12, 14, 26, MX.chrome, 24); hub.rotation.x = Math.PI / 2; parent.add(hub);
  for (let k = 0; k < 3; k++) {
    const a = k * Math.PI * 2 / 3, sp = cyl(3, 4.4, R * 0.75, MX.chrome, 10);
    sp.position.set(-Math.sin(a) * R * 0.55, Math.cos(a) * R * 0.55, -3); sp.rotation.z = a; sp.castShadow = true; parent.add(sp);
  }
  const col = new THREE.Mesh(new THREE.CylinderGeometry(26, 26, 12, 48), [M.ground, collarMat, M.ground]);
  col.rotation.x = Math.PI / 2; col.position.z = -18; parent.add(col);
  const h = cyl(7, 7, 38, M.black, 12); h.rotation.x = Math.PI / 2; h.position.set(0, R * 0.82, 22); parent.add(h);
}
// taban ve kolon
rbox(-280, 280, -736, -300, -530, 90, 14, M.paint);
rbox(-296, 296, FLOOR_Y, -730, -546, 106, 6, M.paintDark);
rbox(-180, 180, -660, -380, 88, 96, 6, M.paintDark);                          // soğutma deposu kapağı
rbox(120, 136, -560, -480, 94, 108, 5, MX.chrome);
rbox(-150, 150, -300, 420, -600, -340, 18, M.paint);                            // kolon
for (const x of [-128, 98]) rbox(x, x + 30, -300, 300, -346, -334, 2, M.ground); // konsol kızak yolları
for (let k = 0; k < 5; k++) boxR(-90, 90, 250 + k * 22, 258 + k * 22, -600 - 3, -598, M.black).castShadow = false;   // arka havalandırma
// taret, koç ve kafa adaptörü
{ const t = cyl(135, 140, 32, M.paintDark, 48); t.position.set(0, 436, -470); scene.add(t);
  const r = new THREE.Mesh(new THREE.CylinderGeometry(141, 141, 6, 48, 1, true), new THREE.MeshStandardMaterial({ map:dialTexture('', 72, 0), roughness:0.5, metalness:0.4 }));
  r.position.set(0, 436, -470); scene.add(r); }
rbox(-110, 110, 452, 536, -640, -70, 16, M.paint);                               // koç (ram)
for (const x of [-112, 102]) rbox(x, x + 10, 470, 520, -620, -90, 3, M.ground);
{ const ad = cyl(105, 105, 18, M.paintDark, 48); ad.rotation.x = Math.PI / 2; ad.position.set(0, 470, -72); scene.add(ad); }
// kafa: kovan gövdesi, kayış muhafazası, motor
rbox(-92, 92, 330, 470, -132, 62, 26, M.paint);
rbox(-112, 112, 470, 560, -165, 72, 34, M.paint);
rbox(-60, 60, 556, 566, -110, 40, 6, M.paintDark);
const motor = cyl(74, 74, 160, M.paintDark, 40); motor.position.set(0, 646, -60); scene.add(motor);
for (let k = 0; k < 7; k++) { const f = new THREE.Mesh(new THREE.TorusGeometry(75, 2.2, 6, 40), M.paintDark); f.rotation.x = Math.PI / 2; f.position.set(0, 585 + k * 18, -60); scene.add(f); }
{ const cap = cyl(60, 74, 18, M.paint, 40); cap.position.set(0, 735, -60); scene.add(cap);
  rbox(68, 104, 610, 668, -90, -30, 6, M.paint); }                              // motor klemens kutusu
const quillHousing = cyl(62, 66, 40, M.paint, 40); quillHousing.position.set(0, 330, 0); scene.add(quillHousing);
// derinlik durdurucu mili ve somunları
{ const r = cyl(5, 5, 170, MX.chrome, 12); r.position.set(-66, 420, 62); scene.add(r);
  for (const y of [370, 382]) { const n = cyl(10, 10, 9, M.black, 6); n.position.set(-66, y, 62); scene.add(n); } }
// kovan ilerleme kolu (üç kollu kapstan, kafanın sağında; x ekseninde döner)
const zLever = new THREE.Group(); zLever.position.set(100, 410, -20); scene.add(zLever);
{ const hub = cyl(16, 16, 26, MX.chrome, 20); hub.rotation.z = Math.PI / 2; hub.position.x = 6; zLever.add(hub);
  for (let k = 0; k < 3; k++) {
    const a = k * Math.PI * 2 / 3, arm = new THREE.Group(); arm.rotation.x = a; arm.position.x = 12; zLever.add(arm);
    const rod = cyl(4, 4, 110, MX.chrome, 10); rod.position.y = 55; arm.add(rod);
    const kn = new THREE.Mesh(new THREE.SphereGeometry(12, 16, 12), M.black); kn.position.y = 112; kn.castShadow = true; arm.add(kn);
  } }
// ince ilerleme el çarkı (solda) ve kovan kilidi
const zFineG = new THREE.Group(); zFineG.position.set(-100, 405, -10); zFineG.rotation.y = -Math.PI / 2; scene.add(zFineG);
const zFine = new THREE.Group(); zFineG.add(zFine); hwheel(zFine, 32);
const quillLock = lever(scene, 60, 360, 64, 34, 1.2, 7);
// motor şalteri: İLERİ / DUR / GERİ (kafanın solunda)
rbox(-150, -110, 470, 540, -50, 10, 6, MX.cream);
const motorSwitch = new THREE.Group(); motorSwitch.position.set(-152, 505, -20); scene.add(motorSwitch);
{ const b = cyl(13, 13, 8, M.black, 24); b.rotation.z = Math.PI / 2; motorSwitch.add(b);
  const k = box(4, 26, 7, MX.red, -5, 0, 0, motorSwitch); k.castShadow = true; }
// kolonda kumanda kutusu: start, acil stop mantarı, mil lambası
const ctrlG = new THREE.Group(); ctrlG.position.set(150, 120, -420); ctrlG.rotation.y = Math.PI / 2; scene.add(ctrlG);
rbox(-40, 40, -60, 60, 0, 28, 6, MX.cream, ctrlG);
const spLampMat = new THREE.MeshStandardMaterial({ color:0x4a3a12, emissive:0xffb020, emissiveIntensity:0, roughness:0.3 });
const spLamp = new THREE.Mesh(new THREE.SphereGeometry(9, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), spLampMat); spLamp.rotation.x = Math.PI / 2; spLamp.position.set(0, 38, 28); ctrlG.add(spLamp);
const startBtnMat = new THREE.MeshStandardMaterial({ color:lin(0x2f8f4e), emissive:0x2fd060, emissiveIntensity:0, roughness:0.4 });
const bStart = cyl(9, 9, 8, startBtnMat, 20); bStart.rotation.x = Math.PI / 2; bStart.position.set(0, 12, 32); ctrlG.add(bStart);
{ const r = cyl(18, 18, 3, MX.stripe, 24); r.rotation.x = Math.PI / 2; r.position.set(0, -26, 29); ctrlG.add(r); }
const mush = new THREE.Mesh(new THREE.SphereGeometry(15, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), MX.red); mush.rotation.x = Math.PI / 2; mush.position.set(0, -26, 34); mush.castShadow = true; ctrlG.add(mush);
{ const s = cyl(6, 6, 6, MX.red, 12); s.rotation.x = Math.PI / 2; s.position.set(0, -26, 31); ctrlG.add(s); }
// kolon yanında eklemli çalışma lambası
{
  const g = new THREE.Group(); g.position.set(-150, 300, -420); scene.add(g);
  rbox(-18, 0, -30, 30, -30, 30, 4, M.black, g);
  const a1 = cyl(4, 4, 260, M.black, 10); a1.rotation.z = 0.6; a1.position.set(-80, 105, 0); g.add(a1);
  const a2 = cyl(4, 4, 300, M.black, 10); a2.rotation.z = -1.05; a2.rotation.y = -0.6; a2.position.set(-30, 300, 110); g.add(a2);
  const shade = new THREE.Mesh(new THREE.ConeGeometry(30, 44, 24, 1, true), smat(0x2e5a52, 0.5, 0.3, 0.3, { side:THREE.DoubleSide }));
  shade.position.set(90, 340, 230); shade.rotation.z = 0.5; g.add(shade);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(10, 12, 8), MX.glow); bulb.position.set(90, 330, 230); g.add(bulb);
  const spot = new THREE.SpotLight(0xffe6c0, 0.9, 1400, 0.55, 0.6, 1.2);
  spot.position.set(-150 + 90, 300 + 330, -420 + 230); spot.target.position.set(0, 0, -30);
  scene.add(spot); scene.add(spot.target);
}
// Kovan (quill) – birim boylu silindir, boyu değişir
const quill = cyl(42, 42, 1, M.ground); scene.add(quill);
const spindleG = new THREE.Group(); scene.add(spindleG);   // y = mil burnu
const noseCap = cyl(38, 40, 18, M.dark); noseCap.position.y = 9; spindleG.add(noseCap);
const toolRot = new THREE.Group(); spindleG.add(toolRot);

// Soğutma: eklemli (loc-line) hortum + damlacık jeti
const UP = new THREE.Vector3(0, 1, 0);
const hdum = new THREE.Object3D();
const HOSE_MAX = 80;
const hoseMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(5.4, 14, 10),
  new THREE.MeshStandardMaterial({ color:0x2f6c9e, roughness:0.35, metalness:0.1 }), HOSE_MAX);
hoseMesh.castShadow = true; hoseMesh.frustumCulled = false; scene.add(hoseMesh);
const nozzle = cyl(2.2, 5, 16, new THREE.MeshStandardMaterial({ color:0xd9822b, roughness:0.4 }), 16); scene.add(nozzle);
const HOSE_BASE = new THREE.Vector3(104, 326, 50);
const coolValve = new THREE.Group(); coolValve.position.set(104, 342, 50); scene.add(coolValve);   // soğutma vanası
{ const b = cyl(11, 11, 22, smat(0xb8913a, 0.35, 0.85, 0.5), 6); coolValve.add(b);
  const st = cyl(3, 3, 10, M.steel, 8); st.position.y = 15; coolValve.add(st); }
const coolHandle = new THREE.Group(); coolHandle.position.y = 20; coolValve.add(coolHandle);
rbox(-4, 44, -3, 3, -5, 5, 2.5, MX.red, coolHandle);
const coolTarget = new THREE.Vector3(), nozzleEnd = new THREE.Vector3(), nozzleDir = new THREE.Vector3();
let hoseKey = '';
function updateHose(tip) {
  const T = tool();
  coolTarget.set(0, tip + Math.min(T.flute, 10) * 0.45, 0);
  nozzleEnd.set(0.62, 0.42, 0.66).normalize().multiplyScalar(T.d / 2 + 60).add(coolTarget);
  if (nozzleEnd.y > 312) nozzleEnd.y = 312;
  const key = nozzleEnd.y.toFixed(1) + T.no;
  if (key === hoseKey) return;
  hoseKey = key;
  nozzleDir.subVectors(coolTarget, nozzleEnd).normalize();
  const nzBase = nozzleEnd.clone().addScaledVector(nozzleDir, -16);
  const back = nozzleEnd.clone().addScaledVector(nozzleDir, -55);
  const curve = new THREE.CatmullRomCurve3([HOSE_BASE.clone(), new THREE.Vector3(125, (HOSE_BASE.y + back.y) / 2 + 25, 100), back, nzBase]);
  const n = clamp(Math.round(curve.getLength() / 7.5), 4, HOSE_MAX);
  for (let i = 0; i < n; i++) {
    const u = i / (n - 1);
    hdum.position.copy(curve.getPointAt(u));
    hdum.quaternion.setFromUnitVectors(UP, curve.getTangentAt(u));
    hdum.scale.set(1, 0.85, 1);
    hdum.updateMatrix(); hoseMesh.setMatrixAt(i, hdum.matrix);
  }
  hoseMesh.count = n; hoseMesh.instanceMatrix.needsUpdate = true;
  nozzle.position.copy(nozzleEnd).addScaledVector(nozzleDir, -8);
  nozzle.quaternion.setFromUnitVectors(UP, nozzleDir);
}
const MAXDROP = 1100, G_COOL = 3400;
const dropMesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.55, 0.55, 1, 6),
  new THREE.MeshStandardMaterial({ color:0x8fd0ff, emissive:0x0c3a5a, roughness:0.05, metalness:0.2, transparent:true, opacity:0.62 }), MAXDROP);
dropMesh.frustumCulled = false; scene.add(dropMesh);
const drops = [];
for (let i = 0; i < MAXDROP; i++) {
  drops.push({ p:new THREE.Vector3(), v:new THREE.Vector3(), life:0, alive:false, splash:false, hit:false, s:1 });
  hdum.scale.set(0, 0, 0); hdum.updateMatrix(); dropMesh.setMatrixAt(i, hdum.matrix);
}
let dropHead = 0, dropAcc = 0, dropsVisible = false;
function addDrop(p, v, life, splash, s) {
  const d = drops[dropHead]; dropHead = (dropHead + 1) % MAXDROP;
  d.p.copy(p); d.v.copy(v); d.life = life; d.alive = true; d.splash = splash; d.hit = false; d.s = s;
}
const tmpP = new THREE.Vector3(), tmpV = new THREE.Vector3();
function updateCoolant(dt, tip) {
  updateHose(tip);
  const T = tool();
  if (S.coolant) {
    dropAcc += dt * 560;
    while (dropAcc >= 1) {
      dropAcc -= 1;
      const speed = 620 + Math.random() * 140;
      tmpP.copy(nozzleEnd).addScaledVector(nozzleDir, Math.random() * speed * dt);
      const tt = tmpP.distanceTo(coolTarget) / speed;
      tmpV.copy(nozzleDir).multiplyScalar(speed);
      tmpV.x += (Math.random() - 0.5) * 34; tmpV.z += (Math.random() - 0.5) * 34;
      tmpV.y += (Math.random() - 0.5) * 34 + 0.5 * G_COOL * tt;   // yerçekimini dengeleyerek hedefe nişan al
      addDrop(tmpP, tmpV, 1.6, false, 0.75 + Math.random() * 0.55);
    }
  }
  const r = T.d / 2, top = tip + T.stick;
  const surf = Math.min(2400, S.rpm * Math.PI * T.d / 60) * 0.45;
  let any = false;
  for (let i = 0; i < MAXDROP; i++) {
    const d = drops[i];
    if (!d.alive) continue;
    d.v.y -= G_COOL * dt;
    d.p.addScaledVector(d.v, dt);
    d.life -= dt;
    // dönen takıma çarpma: mil dönüyorsa teğet yönde savrulur
    const rr = Math.hypot(d.p.x, d.p.z);
    if (!d.hit && rr < r + 0.8 && d.p.y > tip - 0.5 && d.p.y < top) {
      d.hit = true;
      const nx = d.p.x / (rr || 1), nz = d.p.z / (rr || 1);
      d.p.x = nx * (r + 1); d.p.z = nz * (r + 1);
      if (S.spindle) d.v.set(nz * surf + nx * (120 + Math.random() * 220), 40 + Math.random() * 160, -nx * surf + nz * (120 + Math.random() * 220));
      else d.v.set(nx * 60, -40, nz * 60);
    }
    const gh = app.groundAt(d.p.x + S.px, S.py - d.p.z);
    if (d.p.y <= gh) {
      if (!d.splash && gh > -9000 && Math.random() < 0.75) {
        for (let k = 0; k < 2; k++) {
          const a = Math.random() * Math.PI * 2, sp = 110 + Math.random() * 260;
          tmpP.set(d.p.x, gh + 0.4, d.p.z);
          tmpV.set(Math.cos(a) * sp, 120 + Math.random() * 230, Math.sin(a) * sp);
          addDrop(tmpP, tmpV, 0.5, true, 0.45 + Math.random() * 0.3);
        }
      }
      d.alive = false;
    }
    if (d.life <= 0 || d.p.y < -720) d.alive = false;
    if (d.alive) {
      any = true;
      const sp = d.v.length();
      hdum.position.copy(d.p);
      hdum.quaternion.setFromUnitVectors(UP, tmpV.copy(d.v).divideScalar(sp || 1));
      hdum.scale.set(d.s, clamp(sp * 0.014, 1.2, 9) * d.s, d.s);
    } else hdum.scale.set(0, 0, 0);
    hdum.updateMatrix(); dropMesh.setMatrixAt(i, hdum.matrix);
  }
  if (any || dropsVisible) dropMesh.instanceMatrix.needsUpdate = true;
  dropsVisible = any;
}


export { M, MX, bStart, box, boxR, camera, canvas, controls, coolHandle, coolValve, cyl, hwheel, lever,
  motorSwitch, mush, quill, rbox, renderer, scene, smat, spLampMat, spindleG, stage, startBtnMat, toolRot,
  updateCoolant, zFine, zLever };
