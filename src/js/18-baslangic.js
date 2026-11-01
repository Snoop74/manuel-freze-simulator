// ── Başlangıç: ilk kurulum ve döngünün başlatılması
import { $, log } from './00-temel.js';
import { buildToolVisual } from './07-takim-gorsel.js';
import { setFeed, setMaterial, setRpm, updateRec, updateSpindleUI, updateToolUI } from './09-kumanda.js';
import { renderJobs, selectJob } from './10-is-emri-muayene.js';
import { PM, frame } from './12-dongu-ust-cubuk.js';
import { CR } from './17-kariyer.js';

// Başlangıç
buildToolVisual(); updateToolUI(); updateRec(); updateSpindleUI();
setRpm(4200); setFeed(500);
renderJobs(); selectJob(-1); CR.render();
log('Tezgâh hazır. T3 Ø10 parmak freze takılı. Sıfır noktası parçanın sol-ön-üst köşesinde.', 'ok');
// dosyaya çift tıklayınca (file://) tarayıcı dokuları, ortam yansımasını ve modelleri yüklemez: oyun düz renkle açılır
if (location.protocol === 'file:') log('Oyun dosyadan açıldı: dokular ve atölye modelleri yüklenemiyor, sahne düz görünür. Tam grafik için baslat.bat ile açın.', 'warn');
for (const id of ['alarm', 'report', 'toast', 'bench', 'montaj', 'mtHint', 'mtTip', 'yukHud', 'tedit', 'shop']) document.body.append($(id));
setMaterial('al');
PM.init();
requestAnimationFrame(frame);
