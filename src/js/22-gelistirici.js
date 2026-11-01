// ── Geliştirici modu (GL): Ayarlar → Oyun → Geliştirici modu ya da Ctrl+Shift+D. Sol altta katlanır panel:
//   sahneyi .glb aktar (Blender), eşya yerleşimini JSON indir/yükle, kamera konumunu kopyala, imlecin altındaki nesne, kare hızı, montaj deneme plakası
import { $, app, log } from './00-temel.js';
import { AYAR, ayarDinle, ayarYaz } from './00-tercihler.js';
import { camera, canvas, controls, scene } from './02-sahne-tezgah.js';
import { JOBS, selJob, selectJob } from './10-is-emri-muayene.js';
import { PROPS } from './19-atolye.js';

const GL = (() => {
  const el = document.createElement('div'); el.className = 'gl-panel'; el.hidden = true;
  el.innerHTML = `<button class="gl-head" id="glHead" aria-expanded="true"><b>GELİŞTİRİCİ</b><span id="glFps"></span><i>▾</i></button>
    <div class="gl-body" id="glBody">
      <div class="gl-row" id="glHit">imleç: —</div>
      <div class="gl-row" id="glCam"></div>
      <button class="btn" id="glGlb">Sahneyi .glb aktar (Blender)</button>
      <button class="btn" id="glLay">Yerleşimi indir (JSON)</button>
      <label class="btn gl-file">Yerleşimi yükle (JSON)<input type="file" id="glLayIn" accept=".json,application/json" hidden></label>
      <button class="btn" id="glCamCp">Kamera konumunu kopyala</button>
      <button class="btn" id="glDemo">Montaj: hazır plakayla dene</button>
      <div class="gl-note">Ctrl+Shift+D: aç/kapat · Blender: File → Import → glTF (birim metre, Z yukarı)</div>
    </div>`;
  document.body.append(el);
  const r1 = v => Math.round(v * 10) / 10;
  function indir(blob, ad) {
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = ad; document.body.append(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }

  /* -- .glb: sahne mm, glTF metre: kökler geçici olarak 0.001 ölçekli bir gruba alınır (düğümler eşzamanlı okunur, hemen geri konur) -- */
  function glb() {
    if (!THREE.GLTFExporter) { log('glTF aktarıcı yüklü değil.', 'warn'); return; }
    const kok = new THREE.Group(); kok.name = 'freze_atolye'; kok.scale.setScalar(0.001);
    const cocuk = scene.children.filter(o => !o.isLight && !o.isCamera);
    const yer = cocuk.map(o => scene.children.indexOf(o));
    kok.add(...cocuk);
    try {
      new THREE.GLTFExporter().parse(kok, res => indir(new Blob([res], { type:'model/gltf-binary' }), 'freze-sahne.glb'),
        { binary:true, onlyVisible:true, maxTextureSize:1024 });
      log('Sahne aktarılıyor: freze-sahne.glb indirilecek. Özel kaplamalar (boya pası, beton, tahta) Blender\'da düz renk görünür.', 'ok');
    } catch (e) { console.error(e); log('Sahne aktarılamadı: ' + e.message, 'warn'); }
    finally { cocuk.forEach((o, k) => { scene.add(o); scene.children.splice(scene.children.indexOf(o), 1); scene.children.splice(yer[k], 0, o); }); }
  }

  /* -- Yerleşim: hazır modellerin kök konumu (mm, Y yukarı) ve Y ekseni dönüşü -- */
  function yerlesim() {
    return PROPS.map(p => ({ ad:p.o.name, x:r1(p.o.position.x), y:r1(p.o.position.y), z:r1(p.o.position.z), ry:Math.round(p.o.rotation.y * 1000) / 1000 }));
  }
  function uygula(liste) {
    let n = 0;
    for (const q of liste) {
      const p = PROPS.find(p => p.o.name === q.ad); if (!p) continue;
      p.o.position.set(q.x, q.y, q.z); if (q.ry != null) p.o.rotation.y = q.ry; p.o.updateMatrixWorld(true); n++;
    }
    log(`Yerleşim uygulandı: ${n} eşya (yalnızca bu oturum; kalıcı olması için dosyayı Claude'a verin).`, n ? 'ok' : 'warn');
  }

  /* -- İmlecin altındaki nesne ve kare hızı -- */
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  let sonHit = 0, kare = 0, kareT = performance.now();
  function adOf(o) {                                               // en yakın adlı ata: hazır modelde kök, kodla çizilende mesh/grup adı
    for (let p = o; p && p !== scene; p = p.parent) if (PROPS.some(q => q.o === p)) return p.name;
    for (let p = o; p && p !== scene; p = p.parent) if (p.name) return p.name;
    return o.type;
  }
  function imlec(e) {
    if (!AYAR.gelistirici || e.target !== canvas || performance.now() - sonHit < 80) return;
    sonHit = performance.now();
    const rc = canvas.getBoundingClientRect();
    ndc.set((e.clientX - rc.left) / rc.width * 2 - 1, -(e.clientY - rc.top) / rc.height * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const h = ray.intersectObjects(scene.children, true).find(h => h.object.visible && h.object.isMesh);
    $('glHit').textContent = h ? `imleç: ${adOf(h.object)} · x ${r1(h.point.x)} y ${r1(h.point.y)} z ${r1(h.point.z)}` : 'imleç: —';
  }
  function tik() {
    if (AYAR.gelistirici) {
      kare++;
      const t = performance.now();
      if (t - kareT > 500) {
        $('glFps').textContent = Math.round(kare * 1000 / (t - kareT)) + ' fps'; kare = 0; kareT = t;
        const p = camera.position, q = controls.target;
        $('glCam').textContent = `kamera ${r1(p.x)}, ${r1(p.y)}, ${r1(p.z)} → ${r1(q.x)}, ${r1(q.y)}, ${r1(q.z)}`;
      }
    }
    requestAnimationFrame(tik);
  }
  requestAnimationFrame(tik);

  // montaj deneme plakası: serbest atölyede montajlı işi seçip hazır plakayla başlatır (iş kartındaki düğme de yalnızca bu modda görünür)
  function demo() {
    if (app.CR.on) { log('Deneme plakası serbest atölyede çalışır (kariyer kapalıyken).', 'warn'); return; }
    const i = JOBS.findIndex(j => j.montaj);
    if (selJob !== i) selectJob(i);
    $('jobDemo').click();
  }
  function demoGor() { $('jobDemo').hidden = !(AYAR.gelistirici && !app.CR.on && JOBS[selJob] && JOBS[selJob].montaj); }   // iş seçilince 10 da aynısını yapar

  $('glHead').addEventListener('click', () => { const ac = $('glBody').hidden; $('glBody').hidden = !ac; $('glHead').setAttribute('aria-expanded', String(ac)); });
  $('glGlb').addEventListener('click', glb);
  $('glLay').addEventListener('click', () => indir(new Blob([JSON.stringify(yerlesim(), null, 1)], { type:'application/json' }), 'freze-yerlesim.json'));
  $('glLayIn').addEventListener('change', async e => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    try { const d = JSON.parse(await f.text()); uygula(Array.isArray(d) ? d : d.esyalar || []); } catch (er) { log('Yerleşim dosyası okunamadı: ' + er.message, 'warn'); }
  });
  $('glCamCp').addEventListener('click', () => {
    const p = camera.position, q = controls.target, s = JSON.stringify({ p:[r1(p.x), r1(p.y), r1(p.z)], t:[r1(q.x), r1(q.y), r1(q.z)] });
    (navigator.clipboard ? navigator.clipboard.writeText(s) : Promise.reject()).then(() => log('Kamera konumu panoya kopyalandı: ' + s, 'ok'), () => log('Kamera: ' + s));
  });
  $('glDemo').addEventListener('click', demo);
  window.addEventListener('pointermove', imlec);
  window.addEventListener('keydown', e => {
    if (e.ctrlKey && e.shiftKey && e.code === 'KeyD') { e.preventDefault(); e.stopImmediatePropagation(); ayarYaz('gelistirici', !AYAR.gelistirici); }
  }, true);
  ayarDinle('gelistirici', A => {
    el.hidden = !A.gelistirici; demoGor();
    if (!A.gelistirici) $('glHit').textContent = 'imleç: —';
  });
  return { glb, yerlesim, uygula, demoGor };
})();

Object.assign(app, { GL });

export { GL };
