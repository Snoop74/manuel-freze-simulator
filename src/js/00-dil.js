// ── Dil (DIL): t(anahtar, değişkenler) çeviri; sayfa() data-t işaretli metinleri yazar; para() dolar biçimi; dil seçimi ve dinleyiciler
//   Sözlükler: 00-dil-tr.js (kaynak), 00-dil-en.js, 00-dil-de.js. Anahtar bir dilde yoksa Türkçesi, o da yoksa anahtarın kendisi döner.
//   Değer metin ya da fonksiyon olabilir: '{n} delik' → t('k', { n:4 }); fonksiyon dilin kendi dilbilgisini kurar (çoğul, ek, sıra).
//   Sayfa şablonu: <b data-t="s.anahtar">Türkçe</b>; öznitelikler data-t-tip / data-t-title / data-t-aria / data-t-ph.
//   Dil ayarı 00-tercihler'de (AYAR.dil); değişince setDil çağrılır, sayfa yeniden yazılır, dilDinle ile kayıtlı modüller tazelenir.
import { DE } from './00-dil-de.js';
import { EN } from './00-dil-en.js';
import { TR } from './00-dil-tr.js';

const SOZ = { tr:TR, en:EN, de:DE };
const DILLER = [['tr', 'Türkçe'], ['en', 'English'], ['de', 'Deutsch']];
const YEREL = { tr:'tr-TR', en:'en-US', de:'de-DE' };
let dil = 'tr';
const dinleyen = [];

function t(k, v) {
  let s = SOZ[dil][k];
  if (s == null) s = TR[k];
  if (s == null) return k;
  if (typeof s === 'function') return s(v || {});
  return v ? s.replace(/\{(\w+)\}/g, (m, a) => v[a] != null ? v[a] : m) : s;
}
const ATT = [['t-tip', 'data-tip'], ['t-title', 'title'], ['t-aria', 'aria-label'], ['t-ph', 'placeholder']];
function sayfa(kok = document) {
  if (!kok || !kok.querySelectorAll) return;
  kok.querySelectorAll('[data-t]').forEach(e => { e.textContent = t(e.dataset.t); });
  for (const [d, a] of ATT) kok.querySelectorAll(`[data-${d}]`).forEach(e => e.setAttribute(a, t(e.getAttribute(`data-${d}`))));
}
function setDil(d) {
  if (!SOZ[d]) d = 'tr';
  const deg = d !== dil; dil = d;
  if (typeof document !== 'undefined') { document.documentElement.lang = d; sayfa(); }
  if (deg) for (const f of dinleyen) { try { f(d); } catch (e) { console.error(e); } }
}
function dilDinle(fn) { dinleyen.push(fn); }
// tarayıcının diline göre ilk açılış dili (Türkçe, Almanca, değilse İngilizce)
function varsayilanDil() {
  const n = (typeof navigator !== 'undefined' && (navigator.language || '')).toLowerCase();
  return n.startsWith('tr') ? 'tr' : n.startsWith('de') ? 'de' : 'en';
}
// para: oyunun birimi dolar (2026-11-06, Onat); rakamlar aynı, yalnızca biçim dile göre: $1,234 · 1.234 $
function para(v) {
  const n = Math.round(v), s = Math.abs(n).toLocaleString(YEREL[dil]);
  return dil === 'en' ? (n < 0 ? '−$' : '$') + s : (n < 0 ? '−' : '') + s + ' $';
}
const sayiYaz = v => Math.round(v).toLocaleString(YEREL[dil]);   // tam sayı, binlik ayraçlı (kasa kartı gibi)

export { DILLER, dil, dilDinle, para, sayfa, sayiYaz, setDil, t, varsayilanDil };
