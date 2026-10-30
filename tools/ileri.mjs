// İleri başvuruları app kaydına çevirir: modül, kendisinden sonra gelen modülün X adını app.X diye kullanır,
// X'in modülü sonunda Object.assign(app, { X, ... }) ile kaydeder. Kapsama duyarlı (yerel gölgeler dokunulmaz).
// Kullanım: node tools/ileri.mjs [--dry]
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as acorn from 'acorn';
import * as eslintScope from 'eslint-scope';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIR = join(ROOT, 'src', 'js');
const files = readdirSync(DIR).filter(f => /^\d\d-.*\.js$/.test(f)).sort();
const PRE = '(() => {\n';

const mods = files.map((f, idx) => {
  const text = readFileSync(join(DIR, f), 'utf8');
  const ast = acorn.parse(PRE + text + '\n})', { ecmaVersion: 2022, sourceType: 'script', ranges: true });
  const sm = eslintScope.analyze(ast, { ecmaVersion: 2022, sourceType: 'script' });
  const fn = sm.scopes.find(s => s.type === 'function' && s.upper && s.upper.type === 'global');
  // kısa yazılmış nesne özellikleri ({ X }) için ebeveyn bilgisi
  const shorthand = new Set();
  (function walk(n) {
    if (!n || typeof n.type !== 'string') return;
    if (n.type === 'Property' && n.shorthand && n.value.type === 'Identifier') shorthand.add(n.value);
    for (const k in n) { const v = n[k]; if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v.type === 'string') walk(v); }
  })(ast);
  return { f, idx, text, fn, shorthand, names: new Set(fn.variables.map(v => v.name)) };
});
const owner = new Map();
for (const m of mods) for (const n of m.names) owner.set(n, m);

const reg = new Map();   // modül -> kaydedilecek adlar
for (const m of mods) {
  const edits = [];
  for (const r of m.fn.through) {
    const o = owner.get(r.identifier.name);
    if (!o || o.idx <= m.idx) continue;
    if (r.isWrite()) throw new Error(`${m.f}: ${r.identifier.name} sonraki modüle yazıyor`);
    const id = r.identifier, n = id.name;
    const [a, b] = id.range.map(x => x - PRE.length);
    edits.push({ a, b, s: m.shorthand.has(id) ? `${n}: app.${n}` : `app.${n}` });
    if (!reg.has(o.f)) reg.set(o.f, new Set());
    reg.get(o.f).add(n);
  }
  edits.sort((x, y) => y.a - x.a);
  let t = m.text;
  for (const e of edits) t = t.slice(0, e.a) + e.s + t.slice(e.b);
  m.out = t;
  if (edits.length) console.log(`${m.f}: ${edits.length} başvuru → app`);
}
for (const m of mods) {
  const ns = reg.get(m.f);
  if (!ns) continue;
  const line = `Object.assign(app, { ${[...ns].sort().join(', ')} });   // önceki modüllerin geç başvuruları\n`;
  m.out = (m.out.endsWith('\n') ? m.out : m.out + '\n') + line;
  console.log(`${m.f}: kayıt ${[...ns].join(', ')}`);
}
if (!process.argv.includes('--dry')) for (const m of mods) if (m.out !== m.text) writeFileSync(join(DIR, m.f), m.out);
