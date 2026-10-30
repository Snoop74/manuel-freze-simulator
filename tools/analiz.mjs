// Modül denetimi: her modül neyi nereden alıyor, kural dışı bağımlılık ve tanımsız ad var mı.
// Kurallar: bir modül yalnızca kendinden ÖNCE gelen modülden import eder (sonrakine app.X ile ulaşır);
// import edilmeyen ve tarayıcıda da olmayan bir ad kullanılmaz (eksik import, çalışınca ReferenceError olurdu).
// Kullanım: node tools/analiz.mjs
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as acorn from 'acorn';
import * as eslintScope from 'eslint-scope';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIR = join(ROOT, 'src', 'js');
const files = readdirSync(DIR).filter(f => /^\d\d-.*\.js$/.test(f)).sort();
// tarayıcı ve dil globalleri (yeni bir tane gerekirse buraya eklenir)
const GLOBALS = new Set(`THREE window document performance navigator location localStorage console Math JSON Object Array
  Number String Boolean Symbol Map Set WeakMap Promise Date Error TypeError RangeError RegExp Infinity NaN undefined
  isFinite isNaN parseFloat parseInt setTimeout clearTimeout setInterval clearInterval requestAnimationFrame
  cancelAnimationFrame Float32Array Float64Array Uint8Array Uint16Array Uint32Array Int8Array Int16Array Int32Array
  Uint8ClampedArray ArrayBuffer DataView Blob URL Image ImageData AudioContext webkitAudioContext OfflineAudioContext
  Element HTMLElement HTMLCanvasElement KeyboardEvent PointerEvent MouseEvent Event CustomEvent ResizeObserver
  getComputedStyle matchMedia devicePixelRatio innerWidth innerHeight alert confirm structuredClone queueMicrotask
  MutationObserver IntersectionObserver globalThis encodeURIComponent decodeURIComponent btoa atob Reflect Proxy BigInt`.split(/\s+/).filter(Boolean));

let bad = 0;
const order = new Map(files.map((f, i) => [f, i]));
const unknown = new Map();
for (const [i, f] of files.entries()) {
  const ast = acorn.parse(readFileSync(join(DIR, f), 'utf8'), { ecmaVersion: 2022, sourceType: 'module', ranges: true, locations: true });
  const sm = eslintScope.analyze(ast, { ecmaVersion: 2022, sourceType: 'module' });
  const mod = sm.scopes.find(s => s.type === 'module');
  let nImp = 0; const from = new Set();
  for (const n of ast.body) if (n.type === 'ImportDeclaration') {
    const src = n.source.value.replace('./', '');
    nImp += n.specifiers.length; if (n.specifiers.length) from.add(src);
    if (n.specifiers.length && !(order.get(src) < i)) { console.log(`✗ ${f}: sonraki ya da bilinmeyen modülden import (${src})`); bad++; }
  }
  for (const r of mod.through) {
    const n = r.identifier.name;
    if (GLOBALS.has(n)) continue;
    if (!unknown.has(n)) unknown.set(n, []);
    unknown.get(n).push(`${f}:${r.identifier.loc.start.line}`);
  }
  const nExp = ast.body.filter(n => n.type === 'ExportNamedDeclaration').reduce((s, n) => s + (n.specifiers?.length || 0), 0);
  console.log(`${f.padEnd(26)} içe ${String(nImp).padStart(3)} (${from.size} modülden), dışa ${String(nExp).padStart(3)}`);
}
for (const [n, at] of unknown) { console.log(`✗ tanımsız ad ${n}: ${at.slice(0, 3).join(', ')}${at.length > 3 ? ' …' : ''}`); bad++; }
console.log(bad ? `\n${bad} sorun` : '\nSorun yok: bağımlılıklar tek yönlü, tanımsız ad yok.');
process.exitCode = bad ? 1 : 0;
