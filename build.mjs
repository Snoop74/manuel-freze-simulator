// Freze derleyici: src/js/main.js'ten başlayan ES modüllerini esbuild ile paketler, src/sayfa.html şablonuna
// stil ve betikle birlikte gömer ve tek dosya freze.html üretir (GitHub Pages ve tek dosya paylaşımı için).
// Kullanım:
//   node build.mjs           bir kez derle
//   node build.mjs --watch   src/ değiştikçe yeniden derle
// Geliştirirken derlemesiz de çalışılabilir: dev.html modülleri tarayıcıda doğrudan yükler (http sunucusu gerekir).
import { readFileSync, writeFileSync, watch } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSync } from 'esbuild';

const ROOT = dirname(fileURLToPath(import.meta.url));
const SRC = join(ROOT, 'src');
const rd = p => readFileSync(p, 'utf8');

// Yazı tipleri @fontsource paketlerinden; yalnızca latin ve latin-ext (Türkçe harfler) woff2 dosyaları CSS'e gömülür
const FONTS = [['chakra-petch', [500, 600, 700]], ['ibm-plex-sans', [400, 500, 600]], ['share-tech-mono', [400]]];
function fontCss() {
  let out = '';
  for (const [pkg, weights] of FONTS) for (const w of weights) {
    const dir = join(ROOT, 'node_modules', '@fontsource', pkg);
    for (const blk of rd(join(dir, `${w}.css`)).split('@font-face').slice(1)) {
      const sub = blk.match(/files\/[a-z-]+?-(latin|latin-ext)-\d+-normal\.woff2/);
      if (!sub) continue;
      const data = readFileSync(join(dir, sub[0])).toString('base64');
      out += '@font-face' + blk.replace(/src:[^;]+;/, `src: url(data:font/woff2;base64,${data}) format('woff2');`).replace(/\/\*[^*]*\*\/\s*$/, '').trim() + '\n';
    }
  }
  return out;
}

export function build() {
  const tpl = rd(join(SRC, 'sayfa.html'));
  for (const mark of ['/*@CSS@*/\n', '//@JS@\n'])
    if (tpl.split(mark).length !== 2) throw new Error(`sayfa.html içinde ${mark.trim()} işareti tam bir kez olmalı`);
  const r = buildSync({
    entryPoints: [join(SRC, 'js', 'main.js')], bundle: true, write: false, format: 'iife',
    target: 'es2020', charset: 'utf8', legalComments: 'none', logLevel: 'silent',
    minifyWhitespace: true, minifySyntax: true,   // adlar korunur: hata iletileri okunur kalsın
    banner: { js: "'use strict';" },
  });
  const js = r.outputFiles[0].text;
  const page = tpl.replace('/*@CSS@*/\n', () => fontCss() + rd(join(SRC, 'stil.css')));
  writeFileSync(join(ROOT, 'freze.html'), page.replace('//@JS@\n', () => js));
  // dev.html: aynı sayfa, modüller paketlenmeden yüklenir (tarayıcıda dosya dosya hata ayıklama);
  // 'three' adı import haritasıyla node_modules'a yönlenir
  const importMap = '<script type="importmap">{ "imports": { "three": "./node_modules/three/build/three.module.js", "three/": "./node_modules/three/" } }</script>\n';
  writeFileSync(join(ROOT, 'dev.html'), page
    .replace('<script>\n//@JS@\n</script>', importMap + '<script type="module" src="src/js/main.js"></script>')
    .replace(/<!-- Üretilmiş dosya:[^\n]*-->/, '<!-- Geliştirme sayfası: modüller src/js altından doğrudan yüklenir (node build.mjs üretir). -->'));
  return { bytes: Buffer.byteLength(js) };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const once = () => {
    try { const r = build(); console.log(`freze.html: ${(r.bytes / 1024).toFixed(0)} KB betik`); }
    catch (e) {
      const msg = e.errors ? e.errors.map(x => `${x.location ? `${x.location.file}:${x.location.line}: ` : ''}${x.text}`).join('\n') : e.message;
      console.error('DERLENMEDİ:\n' + msg); if (!process.argv.includes('--watch')) process.exitCode = 1;
    }
  };
  once();
  if (process.argv.includes('--watch')) {
    let t = null;
    watch(SRC, { recursive: true }, () => { clearTimeout(t); t = setTimeout(once, 80); });
    console.log('src/ izleniyor (Ctrl+C ile çık)');
  }
}
