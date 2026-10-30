// Modül analizi: her modülün üst düzey adları, başka modüllerden kullandıkları,
// başka modülün değişkenine yazdıkları ve ileri (sonraki modüle) başvurular.
// Kullanım: node tools/analiz.mjs [--json]
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as acorn from 'acorn';
import * as eslintScope from 'eslint-scope';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIR = join(ROOT, 'src', 'js');
const files = readdirSync(DIR).filter(f => /^\d\d-.*\.js$/.test(f)).sort();

const mods = files.map((f, idx) => {
  const src = '(() => {\n' + readFileSync(join(DIR, f), 'utf8') + '\n})';
  const ast = acorn.parse(src, { ecmaVersion: 2022, sourceType: 'script', locations: true, ranges: true });
  const sm = eslintScope.analyze(ast, { ecmaVersion: 2022, sourceType: 'script' });
  const fnScope = sm.scopes.find(s => s.type === 'function' && s.block.type === 'ArrowFunctionExpression' && s.upper && s.upper.type === 'global');
  const decls = new Map();
  for (const v of fnScope.variables) {
    if (v.name === 'arguments') continue;
    const d = v.defs[0];
    decls.set(v.name, { kind: d.type === 'FunctionName' ? 'function' : d.type === 'ClassName' ? 'class' : d.parent?.kind || d.type,
      reassigned: v.references.some(r => r.isWrite() && !r.init) });
  }
  return { f, idx, decls, through: fnScope.through, fnScope };
});

const owner = new Map();
for (const m of mods) for (const n of m.decls.keys()) {
  if (owner.has(n)) console.warn(`! ${n} iki modülde tanımlı: ${owner.get(n).f} ve ${m.f}`);
  owner.set(n, m);
}

const report = [];
for (const m of mods) {
  const uses = new Map();   // ad -> { from, write, topLevel }
  for (const r of m.through) {
    const o = owner.get(r.identifier.name);
    if (!o) continue;   // tarayıcı/THREE gibi gerçek global
    const u = uses.get(r.identifier.name) || { from: o.f, fromIdx: o.idx, write: false, top: false };
    if (r.isWrite()) u.write = true;
    if (r.from === m.fnScope) u.top = true;   // üst düzeyde, modül yüklenirken çalışan başvuru
    uses.set(r.identifier.name, u);
  }
  report.push({ m, uses });
}

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(report.map(({ m, uses }) => ({ file: m.f,
    decls: Object.fromEntries(m.decls), uses: Object.fromEntries(uses) })), null, 1));
} else {
  const crossWrites = [], forwardTop = [];
  let fwd = 0;
  for (const { m, uses } of report) {
    for (const [n, u] of uses) {
      if (u.write) crossWrites.push(`${n} (${u.from} ← ${m.f})`);
      if (u.fromIdx > m.idx) { fwd++; if (u.top) forwardTop.push(`${m.f} üst düzeyde ${n} (${u.from}) kullanıyor`); }
    }
    const deps = new Set([...uses.values()].map(u => u.from));
    console.log(`${m.f.padEnd(26)} ${String(m.decls.size).padStart(3)} ad, ${String(uses.size).padStart(3)} içe alım, ${deps.size} modülden`);
  }
  console.log(`\nBaşka modülün değişkenine yazma (${crossWrites.length}):\n  ` + crossWrites.join('\n  '));
  console.log(`\nİleri başvuru: ${fwd}; bunlardan yüklenirken çalışanlar (${forwardTop.length}):\n  ` + forwardTop.join('\n  '));
}
