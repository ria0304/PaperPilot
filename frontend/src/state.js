import { FONTS, INKS, SAMPLE_Q, SAMPLE_A } from './config.js';

const KEY = 'paperpilot.v1';
const now = new Date();

export const DEF = {
  question: SAMPLE_Q, answer: SAMPLE_A, subject: 'Data Structures', length: 'medium',
  font: 'Caveat', size: 34, natural: 50, gap: 50, ink: 'blue', align: 'left',
  paper: 'ruled', mL: 24, mR: 10, margin: true, header: true, pageNums: true, scan: false,
  name: 'Your Name',
  date: String(now.getDate()).padStart(2, '0') + '/' + String(now.getMonth() + 1).padStart(2, '0') + '/' + now.getFullYear(),
  seed: 11, zoom: 1
};

export const S = Object.assign({}, DEF);

try {
  const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
  if (saved && typeof saved === 'object') {
    Object.keys(DEF).forEach((k) => { if (k in saved && typeof saved[k] === typeof DEF[k]) S[k] = saved[k]; });
  }
} catch (e) { /* storage unavailable */ }

if (S.paper === 'custom') S.paper = 'ruled';
if (!FONTS.some((f) => f.n === S.font)) S.font = 'Caveat';
if (!INKS.some((i) => i.id === S.ink)) S.ink = 'blue';

// Non-persisted runtime assets
export const assets = { bgImage: null, qImage: null };

let isGenerating = false;
export { isGenerating };

const listeners = new Set();
let saveTimer = 0;

export function onChange(fn) { listeners.add(fn); }

export function changed() {
  listeners.forEach((fn) => fn());
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* ignore */ }
  }, 400);
}

window.addEventListener('pagehide', () => { clearTimeout(saveTimer); try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* ignore */ } });
window.addEventListener('beforeunload', () => { clearTimeout(saveTimer); try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* ignore */ } });

export const fontInfo = () => FONTS.find((f) => f.n === S.font) || FONTS[0];
export const fontStr = (size) => Math.round(size * 10) / 10 + 'px "' + S.font + '", "Segoe Script", cursive';
export const inkColor = () => (INKS.find((i) => i.id === S.ink) || INKS[0]).c;
