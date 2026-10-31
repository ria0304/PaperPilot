import { S, onChange, isGenerating } from './state.js';
import { metrics, layout } from './layout.js';
import { drawPage } from './draw.js';

const $ = (s) => document.querySelector(s);
const pagesEl = $('#pages');
const desk = $('#desk');
export const canvases = [];
const figs = [];
let raf = 0;

function ensureCanvases(n) {
  while (figs.length < n) {
    const fig = document.createElement('figure');
    fig.className = 'sheet';
    const cv = document.createElement('canvas');
    cv.setAttribute('role', 'img');
    const cap = document.createElement('figcaption');
    fig.append(cv, cap);
    pagesEl.appendChild(fig);
    figs.push(fig);
    canvases.push(cv);
  }
  while (figs.length > n) {
    figs.pop().remove();
    canvases.pop();
  }
}

export function updateWidth() {
  const avail = Math.max(260, desk.clientWidth - 40),
    base = Math.min(avail, 880);
  pagesEl.style.setProperty('--pw', Math.round(base * S.zoom) + 'px');
  $('#zval').textContent = Math.round(S.zoom * 100) + '%';
}

export function render() {
  const L = metrics(),
    pages = layout(L),
    n = pages.length;
  ensureCanvases(n);
  pages.forEach((pg, i) => {
    drawPage(canvases[i], pg, i, L);
    canvases[i].setAttribute(
      'aria-label',
      'Handwritten page ' + (i + 1) + ' of ' + n
    );
    figs[i].lastChild.textContent = 'Page ' + (i + 1) + ' of ' + n;
  });
  $('#count').textContent = n + (n === 1 ? ' page' : ' pages');
}

export function schedule() {
  if (isGenerating) {
    return;
  }
  if (!raf) {
    raf = requestAnimationFrame(() => {
      raf = 0;
      render();
    });
  }
}

onChange(schedule);

export function ensureFont() {
  let p;
  try {
    p = document.fonts.load('40px "' + S.font + '"', 'Abcdefg 0123');
  } catch {
    p = Promise.resolve();
  }
  return Promise.resolve(p)
    .catch(() => {})
    .then(schedule);
}
