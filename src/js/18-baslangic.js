// ── Başlangıç: ilk kurulum ve döngünün başlatılması
// Başlangıç
buildToolVisual(); updateToolUI(); updateRec(); updateSpindleUI();
setRpm(4200); setFeed(500);
renderJobs(); selectJob(-1); CR.render();
log('Tezgâh hazır. T3 Ø10 parmak freze takılı. Sıfır noktası parçanın sol-ön-üst köşesinde.', 'ok');
for (const id of ['alarm', 'report', 'toast', 'bench', 'tedit', 'shop']) document.body.append($(id));
setMaterial('al');
PM.init();
requestAnimationFrame(frame);
