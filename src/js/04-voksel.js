// ── Voksel modeli (VX): divizör parçası, yumuşak doluluk, blok blok surface nets
const DIVY = 0, DIVZ = 40;
const VX = (() => {
  const R = 0.5, CH = 16, ISO = 128;
  let nx = 0, ny = 0, nz = 0, cy = 0, cz = 0, F = null, CV = null, RS = 20, L = 100;
  let ncx = 0, ncy = 0, ncz = 0, chunks = new Map(), dirty = new Set();
  const grp = new THREE.Group();                                  // dönen grup: ayna, çeneler ve parça
  const mat = new THREE.MeshStandardMaterial({ vertexColors:true, roughness:0.38, metalness:0.6 });
  mat.envMapIntensity = 0.45;
  const EDGES = [];
  for (let c = 0; c < 8; c++) for (const b of [1, 2, 4]) if (!(c & b)) EDGES.push([c, c | b]);
  const id = (i, j, k) => i + nx * (j + ny * k);
  function build(len, dia) {
    L = len; RS = dia / 2;
    nx = Math.round(L / R) + 5; ny = nz = Math.round(dia / R) + 5; cy = cz = (ny - 1) / 2;
    F = new Uint8Array(nx * ny * nz); CV = new Uint8Array(nx * ny * nz);
    for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) {
      const rho = Math.hypot((j - cy) * R, (k - cz) * R), fr = Math.min(1, Math.max(0, 0.5 + (RS - rho) / R));
      if (!fr) continue;
      for (let i = 0; i < nx; i++) {
        const xx = (i - 2) * R, fx = Math.min(1, Math.max(0, 0.5 + Math.min(xx, L - xx) / R));
        F[id(i, j, k)] = Math.round(255 * Math.min(fr, fx));
      }
    }
    for (const m of chunks.values()) { grp.remove(m); m.geometry.dispose(); }
    chunks.clear(); dirty.clear();
    ncx = Math.ceil((nx - 1) / CH); ncy = Math.ceil((ny - 1) / CH); ncz = Math.ceil((nz - 1) / CH);
    for (let a = 0; a < ncx; a++) for (let b = 0; b < ncy; b++) for (let c = 0; c < ncz; c++) dirty.add(a + ncx * (b + ncy * c));
    flush(1e9);
  }
  // blok ağı: blok hücreleri ve bir hücrelik bindirme için köşe başına bir tepe (kenar kesişimlerinin ortalaması)
  function meshChunk(key) {
    const a = key % ncx, b = Math.floor(key / ncx) % ncy, c = Math.floor(key / (ncx * ncy));
    const i0 = a * CH, j0 = b * CH, k0 = c * CH, i1 = Math.min(i0 + CH, nx - 1), j1 = Math.min(j0 + CH, ny - 1), k1 = Math.min(k0 + CH, nz - 1);
    const ex = i1 - i0 + 1, ey = j1 - j0 + 1, ez = k1 - k0 + 1;
    const vid = new Int32Array(ex * ey * ez).fill(-1), vi = (i, j, k) => (i - i0 + 1) + ex * ((j - j0 + 1) + ey * (k - k0 + 1));
    const pos = [], nor = [], col = [], idx = [], v = new Float32Array(8);
    const raw = mat.userData.raw, cut = mat.userData.cut;
    for (let k = Math.max(0, k0 - 1); k < k1; k++) for (let j = Math.max(0, j0 - 1); j < j1; j++) for (let i = Math.max(0, i0 - 1); i < i1; i++) {
      let mask = 0, anyCut = 0;
      for (let q = 0; q < 8; q++) {
        const n = id(i + (q & 1), j + ((q >> 1) & 1), k + (q >> 2));
        v[q] = F[n]; if (v[q] >= ISO) mask |= 1 << q; anyCut |= CV[n];
      }
      if (mask === 0 || mask === 255) continue;
      let px = 0, py = 0, pz = 0, ne = 0;
      for (const [p, q] of EDGES) {
        if ((v[p] >= ISO) === (v[q] >= ISO)) continue;
        const t = (ISO - v[p]) / (v[q] - v[p]);
        px += (p & 1) + t * ((q & 1) - (p & 1)); py += ((p >> 1) & 1) + t * (((q >> 1) & 1) - ((p >> 1) & 1)); pz += (p >> 2) + t * ((q >> 2) - (p >> 2)); ne++;
      }
      const x = (i - 2 + px / ne) * R, y = (j + py / ne - cy) * R, z = (k + pz / ne - cz) * R;
      // normal: doluluğun azaldığı yön (hücre köşelerinden fark)
      const gx = v[1] + v[3] + v[5] + v[7] - v[0] - v[2] - v[4] - v[6], gy = v[2] + v[3] + v[6] + v[7] - v[0] - v[1] - v[4] - v[5], gz = v[4] + v[5] + v[6] + v[7] - v[0] - v[1] - v[2] - v[3];
      const gl = Math.hypot(gx, gy, gz) || 1;
      vid[vi(i, j, k)] = pos.length / 3;
      pos.push(x, z, -y); nor.push(-gx / gl, -gz / gl, gy / gl);  // three: (x, yukarı = z, -y)
      const cc = anyCut ? cut : raw; col.push(cc[0], cc[1], cc[2]);
    }
    // dörtgenler: bloğa ait köşe noktalarından çıkan, işaret değiştiren her kenar için çevresindeki dört hücrenin tepeleri
    for (let k = k0; k < k1; k++) for (let j = j0; j < j1; j++) for (let i = i0; i < i1; i++) {
      const f0 = F[id(i, j, k)] >= ISO;
      for (let d = 0; d < 3; d++) {
        const i2 = i + (d === 0), j2 = j + (d === 1), k2 = k + (d === 2);
        if (i2 >= nx || j2 >= ny || k2 >= nz) continue;
        if ((F[id(i2, j2, k2)] >= ISO) === f0) continue;
        // u, v: diğer iki eksen
        const du = d === 0 ? [0, 1, 0] : d === 1 ? [0, 0, 1] : [1, 0, 0], dv = d === 0 ? [0, 0, 1] : d === 1 ? [1, 0, 0] : [0, 1, 0];
        if (i - du[0] - dv[0] < 0 || j - du[1] - dv[1] < 0 || k - du[2] - dv[2] < 0) continue;
        const A = vid[vi(i, j, k)], B = vid[vi(i - du[0], j - du[1], k - du[2])], Cc = vid[vi(i - du[0] - dv[0], j - du[1] - dv[1], k - du[2] - dv[2])], D = vid[vi(i - dv[0], j - dv[1], k - dv[2])];
        if (A < 0 || B < 0 || Cc < 0 || D < 0) continue;
        if (f0) idx.push(A, B, Cc, A, Cc, D); else idx.push(A, Cc, B, A, D, Cc);
      }
    }
    const old = chunks.get(key);
    if (old) { grp.remove(old); old.geometry.dispose(); chunks.delete(key); }
    if (!idx.length) return;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(idx);
    const m = new THREE.Mesh(g, mat); m.castShadow = m.receiveShadow = true; grp.add(m); chunks.set(key, m);
  }
  function flush(budget = 8) {
    let n = 0;
    for (const key of dirty) { meshChunk(key); dirty.delete(key); if (++n >= budget) break; }
  }
  function markRange(ia, ib, ja, jb, ka, kb) {
    for (let c = Math.max(0, Math.floor((ka - 1) / CH)); c <= Math.min(ncz - 1, Math.floor(kb / CH)); c++)
      for (let b = Math.max(0, Math.floor((ja - 1) / CH)); b <= Math.min(ncy - 1, Math.floor(jb / CH)); b++)
        for (let a = Math.max(0, Math.floor((ia - 1) / CH)); a <= Math.min(ncx - 1, Math.floor(ib / CH)); a++) dirty.add(a + ncx * (b + ncy * c));
  }
  // parça (tezgâh) koordinatı ile yerel koordinat arası
  function local(px, py, pz, aDeg) {
    const t = aDeg * Math.PI / 180, c = Math.cos(t), s = Math.sin(t), yr = py - DIVY, zr = pz - DIVZ;
    return [px, c * yr + s * zr, -s * yr + c * zr];
  }
  // takım cismiyle kesişim: test=true ise yalnızca ölçer (temas, dikey bindirme, en üst malzeme), değilse keser
  function work(xm, ym, tip, T, test) {
    const r = T.d / 2, top = tip + (test ? T.stick : T.flute), zTop = Math.min(top, DIVZ + RS + R);
    const out = { over:0, maxH:-1, shank:false, holder:false, any:false, vol:0 };
    if (!F || tip > DIVZ + RS + R || xm + r < -R || xm - r > L + R || Math.abs(ym - DIVY) - r > RS + R) return out;
    const t = ROT.a * Math.PI / 180, c = Math.cos(t), s = Math.sin(t);
    // yerel sınır kutusu: takım kutusunun 8 köşesi
    let ylo = 1e9, yhi = -1e9, zlo = 1e9, zhi = -1e9;
    for (const yy of [ym - r, ym + r]) for (const zz of [tip, zTop]) {
      const yr = yy - DIVY, zr = zz - DIVZ, ly = c * yr + s * zr, lz = -s * yr + c * zr;
      ylo = Math.min(ylo, ly); yhi = Math.max(yhi, ly); zlo = Math.min(zlo, lz); zhi = Math.max(zhi, lz);
    }
    const ia = Math.max(0, Math.floor((xm - r) / R) + 1), ib = Math.min(nx - 1, Math.ceil((xm + r) / R) + 3);
    const ja = Math.max(0, Math.floor(ylo / R + cy) - 1), jb = Math.min(ny - 1, Math.ceil(yhi / R + cy) + 1);
    const ka = Math.max(0, Math.floor(zlo / R + cz) - 1), kb = Math.min(nz - 1, Math.ceil(zhi / R + cz) + 1);
    if (ia > ib || ja > jb || ka > kb) return out;
    const rr = (r + R) * (r + R);
    let vol = 0, ci0 = 1e9, ci1 = -1, cj0 = 1e9, cj1 = -1, ck0 = 1e9, ck1 = -1;
    for (let k = ka; k <= kb; k++) {
      const z = (k - cz) * R;
      for (let j = ja; j <= jb; j++) {
        const y = (j - cy) * R, pyp = DIVY + c * y - s * z, pzp = DIVZ + s * y + c * z;
        if (pzp < tip - R || pzp > zTop + R) continue;
        const qy = pyp - ym;
        if (qy * qy > rr) continue;
        let n = id(ia, j, k);
        for (let i = ia; i <= ib; i++, n++) {
          const f = F[n]; if (!f) continue;
          const qx = (i - 2) * R - xm, d2 = qx * qx + qy * qy;
          if (d2 > rr) continue;
          const rho = Math.sqrt(d2), zb = profile(T, Math.min(rho, r), tip);
          if (test) {
            if (f >= ISO && rho < r) { if (pzp > out.maxH) out.maxH = pzp; if (pzp >= zb && pzp - zb > out.over) out.over = pzp - zb; }
            continue;
          }
          const d = Math.max(rho - r, zb - pzp, pzp - top);
          const nv = Math.max(0, Math.min(255, Math.round((0.5 + d / R) * 255)));
          if (nv < f) {
            vol += f - nv; F[n] = nv; CV[n] = 1;
            if (i < ci0) ci0 = i; if (i > ci1) ci1 = i; if (j < cj0) cj0 = j; if (j > cj1) cj1 = j; if (k < ck0) ck0 = k; if (k > ck1) ck1 = k;
          }
        }
      }
    }
    if (test) { out.any = out.over > 0.002; if (out.any && out.maxH - tip > T.flute + 0.3) out.shank = true; return out; }
    if (ci1 >= 0) markRange(ci0, ci1, cj0, cj1, ck0, ck1);
    out.vol = vol / 255 * R * R * R;
    return out;
  }
  function setMat(m) {
    mat.userData.raw = m.rawL.slice(); mat.userData.cut = m.cutL.slice();
    mat.metalness = m.nonMetal ? 0 : 0.6; mat.roughness = m.nonMetal ? 0.55 : 0.36;
  }
  return { grp, build, flush, work, local, setMat, get radius() { return RS; }, get length() { return L; }, get ready() { return !!F; }, stats:() => ({ voxels:nx * ny * nz, chunks:chunks.size, dirty:dirty.size }) };
})();
