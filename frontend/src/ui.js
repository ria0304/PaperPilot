import { FONTS, INKS, PAPERS, MMPX } from './config.js';
import { S, assets, changed, setGeneratingFlag } from './state.js';
import { render, ensureFont, updateWidth, canvases } from './render.js';
import { buildPdf, canvasToJpeg, saveBlob } from './pdf.js';
import { generateAnswer, health } from './api.js';

const $ = (s) => document.querySelector(s);
let toastTimer = 0,
  ctl = null,
  serverOk = null;

export function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('on'), 3800);
}

/* ---------- bindings ---------- */
function bindText(id, key) {
  const el = $('#' + id);
  el.value = S[key];
  el.addEventListener('input', () => {
    S[key] = el.value;
    changed();
  });
}
function bindRange(id, key, fmt) {
  const el = $('#' + id),
    out = $('#' + id + '-v');
  el.value = S[key];
  const show = () => {
    out.textContent = fmt(+el.value);
  };
  show();
  el.addEventListener('input', () => {
    S[key] = +el.value;
    show();
    changed();
  });
}
function bindCheck(id, key) {
  const el = $('#' + id);
  el.checked = S[key];
  el.addEventListener('change', () => {
    S[key] = el.checked;
    changed();
  });
}

function initControls() {
  [
    'q:question',
    'a:answer',
    'subject:subject',
    'name:name',
    'date:date',
    'length:length',
  ].forEach((p) => {
    const [id, key] = p.split(':');
    bindText(id, key);
  });
  bindRange('size', 'size', (v) => v + ' px');
  bindRange('natural', 'natural', (v) => v + '%');
  bindRange('gap', 'gap', (v) => (v / MMPX).toFixed(1) + ' mm');
  bindRange('mL', 'mL', (v) => v + ' mm');
  bindRange('mR', 'mR', (v) => v + ' mm');
  ['margin', 'header', 'pageNums', 'scan'].forEach((k) => bindCheck(k, k));
}

function initFonts() {
  const el = $('#fonts');
  const mark = () =>
    el
      .querySelectorAll('.fontbtn')
      .forEach((b) =>
        b.setAttribute('aria-pressed', String(b.dataset.font === S.font))
      );
  FONTS.forEach((f) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'fontbtn';
    b.dataset.font = f.n;
    const s = document.createElement('span');
    s.className = 's';
    s.textContent = 'Binary search tree';
    s.style.fontFamily = '"' + f.n + '", cursive';
    s.style.fontSize = Math.round(21 * Math.min(f.k, 1.25)) + 'px';
    const n = document.createElement('span');
    n.className = 'n';
    n.textContent = f.tag + ' · ' + f.n;
    b.append(s, n);
    el.appendChild(b);
    b.addEventListener('click', () => {
      S.font = f.n;
      mark();
      ensureFont();
      changed();
    });
  });
  mark();
}

function initInks() {
  const el = $('#inks');
  const mark = () =>
    el
      .querySelectorAll('.ink')
      .forEach((b) =>
        b.setAttribute('aria-pressed', String(b.dataset.ink === S.ink))
      );
  INKS.forEach((i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'ink';
    b.style.setProperty('--c', i.c);
    b.dataset.ink = i.id;
    b.setAttribute('aria-label', i.name + ' ink');
    b.title = i.name;
    el.appendChild(b);
    b.addEventListener('click', () => {
      S.ink = i.id;
      mark();
      changed();
    });
  });
  mark();
}

function initAlign() {
  const el = $('#align');
  const mark = () =>
    el
      .querySelectorAll('button')
      .forEach((b) =>
        b.setAttribute('aria-pressed', String(b.dataset.v === S.align))
      );
  el.querySelectorAll('button').forEach((b) =>
    b.addEventListener('click', () => {
      S.align = b.dataset.v;
      mark();
      changed();
    })
  );
  mark();
}

function initPapers() {
  const el = $('#papers');
  const mark = () =>
    el
      .querySelectorAll('.ptile')
      .forEach((b) =>
        b.setAttribute('aria-pressed', String(b.dataset.paper === S.paper))
      );
  PAPERS.forEach((p) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'ptile p-' + p.id;
    b.dataset.paper = p.id;
    const i = document.createElement('i');
    if (p.id === 'custom') {
      i.textContent = '+';
    }
    b.append(i, document.createTextNode(p.name));
    el.appendChild(b);
    b.addEventListener('click', () => {
      if (p.id === 'custom') {
        $('#bgfile').click();
        return;
      }
      S.paper = p.id;
      S.margin = p.id === 'ruled';
      $('#margin').checked = S.margin;
      mark();
      changed();
    });
  });
  mark();
  $('#bgfile').addEventListener('change', (e) => {
    const f = e.target.files[0];
    e.target.value = '';
    if (!f) {
      return;
    }
    createImageBitmap(f)
      .then((bm) => {
        if (assets.bgImage) {
          assets.bgImage.close();
        } // close previous bitmap to avoid leak
        assets.bgImage = bm;
        S.paper = 'custom';
        S.margin = false;
        $('#margin').checked = false;
        mark();
        changed();
        toast('Custom paper applied.');
      })
      .catch(() => toast('That image could not be read. Try a PNG or JPG.'));
  });
}

function initTabsAndViews() {
  $('#tabs')
    .querySelectorAll('button')
    .forEach((b) =>
      b.addEventListener('click', () => {
        $('#tabs')
          .querySelectorAll('button')
          .forEach((x) => x.setAttribute('aria-selected', String(x === b)));
        document.querySelectorAll('[data-panel]').forEach((p) => {
          p.hidden = p.dataset.panel !== b.dataset.tab;
        });
        if (b.dataset.tab === 'hand') {
          ensureFont();
        }
      })
    );
  $('#viewseg')
    .querySelectorAll('button')
    .forEach((b) =>
      b.addEventListener('click', () => {
        $('#app').dataset.view = b.dataset.view;
        $('#viewseg')
          .querySelectorAll('button')
          .forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
        updateWidth();
      })
    );
}

function initZoom() {
  const setZoom = (z) => {
    S.zoom = Math.max(0.6, Math.min(1.8, Math.round(z * 100) / 100));
    updateWidth();
    changed();
  };
  $('#zin').addEventListener('click', () => setZoom(S.zoom + 0.15));
  $('#zout').addEventListener('click', () => setZoom(S.zoom - 0.15));
  $('#zfit').addEventListener('click', () => setZoom(1));
  $('#reroll').addEventListener('click', () => {
    S.seed = (S.seed * 7 + 13) % 99991;
    changed();
  });
  if (window.ResizeObserver) {
    new ResizeObserver(updateWidth).observe($('#desk'));
  }
  window.addEventListener('resize', updateWidth);
}

/* ---------- question paper upload ---------- */
function showChip() {
  $('#qchip').hidden = !assets.qImage;
  if (assets.qImage) {
    $('#qchip-n').textContent = assets.qImage.name || 'question paper';
  }
}
function initUpload() {
  $('#attach').addEventListener('click', () => $('#paperfile').click());
  $('#qchip-x').addEventListener('click', () => {
    assets.qImage = null;
    showChip();
  });
  $('#paperfile').addEventListener('change', (e) => {
    const f = e.target.files[0];
    e.target.value = '';
    if (!f) {
      return;
    }
    if (/\.pdf$/i.test(f.name) || f.type === 'application/pdf') {
      toast(
        'PDFs are not supported yet. Paste the questions as text or upload a screenshot.'
      );
      return;
    }
    if (f.type.indexOf('image/') === 0) {
      if (f.size > 5 * 1024 * 1024) {
        toast('That image is over 5 MB. Use a smaller screenshot.');
        return;
      }
      assets.qImage = f;
      showChip();
      toast('Question paper attached. Press Generate answer.');
      return;
    }
    f.text()
      .then((txt) => {
        S.question = txt.trim().slice(0, 20000);
        $('#q').value = S.question;
        assets.qImage = null;
        showChip();
        changed();
        toast('Question paper loaded.');
      })
      .catch(() => toast('That file could not be read.'));
  });
}

/* ---------- generation ---------- */
const setAnswer = (t) => {
  S.answer = t;
  $('#a').value = t;
  changed();
};

function setGenerating(on) {
  const b = $('#gen');
  b.textContent = on ? 'Stop' : 'Generate answer';
  b.setAttribute('aria-busy', String(on));
}

const ERRORS = {
  rate_limited: 'Usage limit reached. Try again in a moment.',
  refused: 'The request was declined. Change the question and try again.',
  too_large:
    'The question paper is too large. Use fewer questions or a smaller image.',
  no_key: 'The server has no API key configured. See the README.',
  network: 'Could not reach the server. Is the backend running?',
};

function generate() {
  if (ctl) {
    ctl.abort();
    return;
  }
  if (!serverOk) {
    toast(
      'The backend is not reachable. Start it, or type your answer instead.'
    );
    return;
  }
  if (!S.question.trim() && !assets.qImage) {
    toast('Add a question first.');
    return;
  }
  setGeneratingFlag(true);
  setGenerating(true);
  ctl = new AbortController();
  generateAnswer({
    question: S.question.trim(),
    subject: S.subject.trim(),
    length: S.length,
    image: assets.qImage,
    signal: ctl.signal,
    onText: setAnswer,
  })
    .then((r) => {
      setAnswer(r.text);
      if (r.truncated) {
        toast(
          'The answer was cut short. Choose a shorter length or fewer questions.'
        );
      }
    })
    .catch((e) => {
      if (e && e.text) {
        setAnswer(e.text);
      }
      if (e.code === 'cancelled') {
        setGeneratingFlag(false);
        setGenerating(false);
        return;
      }
      toast(ERRORS[e.code] || 'Generation failed. Try again.');
    })
    .then(() => {
      setGeneratingFlag(false);
      setGenerating(false);
      ctl = null;
    });
}

/* ---------- PDF ---------- */
function downloadPdf() {
  const btn = $('#dl');
  btn.disabled = true;
  btn.textContent = 'Preparing…';
  render();
  Promise.all(canvases.map(canvasToJpeg))
    .then((jp) => {
      const slug =
        (S.subject || 'assignment')
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '') || 'assignment';
      saveBlob(buildPdf(jp), slug + '.pdf');
      toast('PDF saved.');
    })
    .catch(() => toast('Could not build the PDF. Try again.'))
    .then(() => {
      btn.disabled = false;
      btn.textContent = 'Download PDF';
    });
}

/* ---------- server status ---------- */
async function checkServer() {
  const h = await health();
  serverOk = !!h.ok;
  const el = $('#status');
  el.dataset.state = !h.ok ? 'down' : h.configured ? 'up' : 'nokey';
  el.querySelector('em').textContent = !h.ok
    ? 'Server offline'
    : h.configured
      ? 'AI ready'
      : 'No API key';
  if (h.ok && !h.configured) {
    serverOk = false;
  }
}

export function initUi() {
  initControls();
  initFonts();
  initInks();
  initAlign();
  initPapers();
  initTabsAndViews();
  initZoom();
  initUpload();
  $('#gen').addEventListener('click', generate);
  $('#dl').addEventListener('click', downloadPdf);
  $('#status').addEventListener('click', checkServer);
  checkServer();
  setInterval(checkServer, 30000);
}
