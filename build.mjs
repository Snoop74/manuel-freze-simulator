// Freze derleyici: src/ altındaki sayfa şablonu, stil ve JS modüllerinden tek dosya freze.html üretir.
// Bağımlılık yok (yalnızca Node). Kullanım:
//   node build.mjs           bir kez derle
//   node build.mjs --watch   src/ değiştikçe yeniden derle
// Modüller dosya adındaki sıra numarasıyla (00-, 01-, ...) birleştirilir ve tek bir
// (() => { 'use strict'; ... })() kapsamında çalışır; bu yüzden üst düzey adlar modüller arasında ortaktır.
import { readFileSync, writeFileSync, readdirSync, watch } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const ROOT = dirname(fileURLToPath(import.meta.url));
const SRC = join(ROOT, 'src');
const OUT = join(ROOT, 'freze.html');
const rd = p => readFileSync(p, 'utf8');

export function modules() {
  return readdirSync(join(SRC, 'js')).filter(f => /^\d\d-.*\.js$/.test(f)).sort();
}

export function build() {
  const files = modules();
  const js = files.map(f => {
    const s = rd(join(SRC, 'js', f));
    return s.endsWith('\n') ? s : s + '\n';
  }).join('');
  const tpl = rd(join(SRC, 'sayfa.html'));
  for (const mark of ['/*@CSS@*/\n', '//@JS@\n'])
    if (tpl.split(mark).length !== 2) throw new Error(`sayfa.html içinde ${mark.trim()} işareti tam bir kez olmalı`);
  const html = tpl.replace('/*@CSS@*/\n', () => rd(join(SRC, 'stil.css'))).replace('//@JS@\n', () => js);
  // sözdizimi denetimi: hata varsa freze.html'e yazılmaz, hangi modülde olduğu söylenir
  const body = html.slice(html.lastIndexOf('<script>') + 8, html.lastIndexOf('</script>'));
  try { new vm.Script(body, { filename: 'freze.js' }); }
  catch (e) {
    for (const f of files) {
      // modül tek başına IIFE gövdesi olarak denenir (üst düzey return geçerli olsun)
      try { new vm.Script('(() => {\n' + rd(join(SRC, 'js', f)) + '\n})', { filename: f, lineOffset: -1 }); }
      catch (e2) { throw new Error(`${f}: ${e2.message}\n${(e2.stack || '').split('\n')[1] || ''}`); }
    }
    throw e;
  }
  writeFileSync(OUT, html);
  return { files: files.length, bytes: Buffer.byteLength(html) };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const once = () => {
    try { const r = build(); console.log(`freze.html: ${r.files} modül, ${(r.bytes / 1024).toFixed(0)} KB`); }
    catch (e) { console.error('DERLENMEDİ: ' + e.message); if (!process.argv.includes('--watch')) process.exitCode = 1; }
  };
  once();
  if (process.argv.includes('--watch')) {
    let t = null;
    watch(SRC, { recursive: true }, () => { clearTimeout(t); t = setTimeout(once, 80); });
    console.log('src/ izleniyor (Ctrl+C ile çık)');
  }
}
