// ── Mengene (MG): kola tıklayınca açılır/kapanır, kolun üstünde tekerlek adım adım çevirir; açıkken parça X'te sürüklenip kaydırılır
//   (KAY). Açık mengenede mil çalışmaz ve takım parçaya girmez (09, 08). Yeni parça sıkılı gelir.
import { PH, PW, S, TAU, app, clamp, log, tipZ } from './00-temel.js';
import { initAudio, metalRing, thud } from './01-ses.js';
import { camera, canvas, controls, stage } from './02-sahne-tezgah.js';
import { viseKol } from './03-tabla-parca.js';
import { FIX, KAY, onCene, setKay, syncFixtures } from './05-baglama.js';

const MG = (() => {
  const ACIK = 14, ADIM = 2, HIZ = 40, HATVE = 6;                   // tam açıklık (ön ağız gövdesi vida yatağına değmesin), tekerlek adımı (mm), açılma hızı (mm/s), vida hatvesi
  S.mAcik = 0;
  let hedef = 0, hover = null, drag = null;
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  const tip = document.createElement('div'); tip.className = 'ia-tip'; tip.hidden = true; stage.append(tip);
  const acik = () => S.mAcik > 0.05;

  // açmak serbest değil: mil dönerken ya da kılavuz delikteyken olmaz
  function engel() {
    if (FIX !== 'vise') return 'Mengene yalnızca mengene bağlamasında kullanılır.';
    if (S.spindle) return 'Mil dönerken mengene açılmaz: önce mili durdurun.';
    if (S.tap) return 'Kılavuz delikteyken mengene açılmaz: önce kılavuzu çıkarın.';
    return null;
  }
  function git(v) {
    v = clamp(v, 0, ACIK);
    if (v > S.mAcik && v > 0.05) { const e = engel(); if (e) { log(e, 'warn'); return; } }
    if (v > 0.05 && !acik() && hedef <= 0.05) log('Mengene açılıyor: parçayı fareyle sağa-sola sürükleyip kaydırabilirsiniz. Kaydırınca eski X sıfırı tutmaz.');
    hedef = v;
  }
  function kapat(hemen) {
    hedef = 0;
    if (hemen) { S.mAcik = 0; onCene.position.z = 0; viseKol.rotation.z = 0; if (FIX === 'vise') syncFixtures(); }
  }
  function update(dt) {
    if (S.mAcik === hedef) return;
    const once = S.mAcik, d = hedef - once, s = HIZ * dt;
    S.mAcik = Math.abs(d) <= s ? hedef : once + Math.sign(d) * s;
    if (hedef === 0 && S.mAcik <= 0.05) S.mAcik = 0;
    onCene.position.z = S.mAcik;
    viseKol.rotation.z = -S.mAcik / HATVE * TAU;
    syncFixtures();
    if (once > 0 && S.mAcik === 0) { thud(140, 0.18, 0.12); metalRing(900, 0.04, 0.3); log('Mengene sıkıldı: parça bağlı.', 'ok'); }
  }

  // tıklama hedefi: kol her zaman, parça yalnızca mengene açıkken
  function pick(e) {
    if (S.montaj || S.duraklat || FIX !== 'vise') return null;
    const r = canvas.getBoundingClientRect();
    ndc.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const parca = acik() ? app.partMeshes() : [];
    const h = ray.intersectObjects([viseKol, ...parca], true)[0];
    if (!h) return null;
    let o = h.object; while (o && o !== viseKol) o = o.parent;
    return o ? { kol:true } : { parca:true, p:h.point.clone() };
  }
  function goster(t, e) {
    if (hover && hover.kol && !(t && t.kol)) viseKol.scale.setScalar(1);
    hover = t;
    if (!t) { tip.hidden = true; if (!drag) canvas.style.cursor = ''; return; }
    if (t.kol) viseKol.scale.setScalar(1.06);
    canvas.style.cursor = t.kol ? 'pointer' : drag ? 'grabbing' : 'grab';
    tip.textContent = t.kol ? (acik() ? 'Mengene kolu · tıkla: SIK · tekerlek: adım adım' : 'Mengene kolu · tıkla: AÇ · tekerlek: adım adım')
                            : 'Parça (mengene açık) · sürükle: X\'te kaydır';
    const r = stage.getBoundingClientRect();
    tip.hidden = false; tip.style.left = (e.clientX - r.left + 16) + 'px'; tip.style.top = (e.clientY - r.top + 14) + 'px';
  }
  // parçayı sürükleme: imlecin parça üst yüzeyi düzlemindeki X'i KAY'ı değiştirir (makine yerinde, DRO okuması aynı kalır)
  const pl = new THREE.Plane(), hp = new THREE.Vector3();
  function xAt(e) {
    const r = canvas.getBoundingClientRect();
    ndc.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1);
    ray.setFromCamera(ndc, camera);
    return ray.ray.intersectPlane(pl, hp) ? hp.x : null;
  }
  const kayLim = () => [-(35 + 0.4 * PW), 185 - 0.6 * PW];             // parçanın en az %60'ı çeneler arasında kalsın

  canvas.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    const t = pick(e); if (!t) return;
    e.preventDefault(); e.stopImmediatePropagation(); initAudio();
    if (t.kol) { git(acik() || hedef > 0.05 ? 0 : ACIK); thud(200, 0.08, 0.06); goster(t, e); return; }
    if (tipZ() < PH + 0.5) { log('Parçayı kaydırmadan önce takımı parçanın üstüne kaldırın.', 'warn'); return; }
    pl.setFromNormalAndCoplanarPoint(new THREE.Vector3(0, 1, 0), t.p);
    const x = xAt(e); if (x === null) return;
    controls.enabled = false;
    try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
    drag = { x, kay:KAY }; goster(t, e);
  }, true);
  canvas.addEventListener('pointermove', e => {
    if (drag) {
      const x = xAt(e); if (x === null) return;
      if (!acik()) { drag = null; controls.enabled = true; return; }
      const [lo, hi] = kayLim();
      setKay(Math.round(clamp(drag.kay + x - drag.x, lo, hi) * 100) / 100);
      return;
    }
    if (e.buttons) return;
    goster(pick(e), e);
  });
  const bitir = () => { if (drag) { drag = null; controls.enabled = true; thud(110, 0.06, 0.05); canvas.style.cursor = hover ? 'grab' : ''; } };
  canvas.addEventListener('pointerup', bitir); canvas.addEventListener('pointercancel', bitir);
  canvas.addEventListener('pointerleave', () => { if (!drag) goster(null); });
  // tekerlek: aşağı sıkar, yukarı açar (montajdaki alyan gibi); kolun üstünde kamera yakınlaşmaz
  canvas.addEventListener('wheel', e => {
    const t = pick(e); if (!t || !t.kol) return;
    e.preventDefault(); e.stopImmediatePropagation(); initAudio();
    git((hedef) + (e.deltaY > 0 ? -ADIM : ADIM));
    thud(160, 0.04, 0.04); goster(t, e);
  }, { capture:true, passive:false });

  return { update, kapat, git, acik };
})();

Object.assign(app, { MG });

export { MG };
