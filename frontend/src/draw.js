import { PW, PH, mm } from './config.js';
import { S, assets, fontStr, inkColor } from './state.js';

/* ---------- seeded random + wobbly strokes ---------- */
function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
const rngFor = (page, line, salt) => mulberry32((S.seed * 1000003) ^ (page * 7919) ^ (line * 104729) ^ (salt * 13));

function strokePts(ctx, pts) {
  ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length - 1; i++) {
    ctx.quadraticCurveTo(pts[i][0], pts[i][1], (pts[i][0] + pts[i + 1][0]) / 2, (pts[i][1] + pts[i + 1][1]) / 2);
  }
  const l = pts[pts.length - 1]; ctx.lineTo(l[0], l[1]); ctx.stroke();
}
function wobLine(ctx, x1, y1, x2, y2, rng, amp) {
  const d = Math.hypot(x2 - x1, y2 - y1), n = Math.max(2, Math.round(d / 28)), pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    pts.push([x1 + (x2 - x1) * t + (rng() - 0.5) * amp, y1 + (y2 - y1) * t + (rng() - 0.5) * amp]);
  }
  strokePts(ctx, pts);
}
function wobCircle(ctx, cx, cy, r, rng, amp) {
  const n = 14, a0 = rng() * 6.28, pts = [];
  for (let k = 0; k <= n + 2; k++) {
    const a = a0 + k * 6.2832 / n, rr = r + (rng() - 0.5) * amp + k * 0.25;
    pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
  }
  strokePts(ctx, pts);
}

/* ---------- paper ---------- */
let noiseCv = null;
function noisePattern(ctx) {
  if (!noiseCv) {
    noiseCv = document.createElement('canvas'); noiseCv.width = noiseCv.height = 200;
    const x = noiseCv.getContext('2d'), d = x.createImageData(200, 200);
    for (let i = 0; i < d.data.length; i += 4) { const v = Math.random() * 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; }
    x.putImageData(d, 0, 0);
  }
  return ctx.createPattern(noiseCv, 'repeat');
}

function gridLines(ctx, step, major, minor) {
  let i, p;
  for (p = 0, i = 0; p <= PW; p += step, i++) {
    ctx.strokeStyle = i % 5 === 0 ? major.c : minor.c; ctx.lineWidth = i % 5 === 0 ? major.w : minor.w;
    ctx.beginPath(); ctx.moveTo(p, 0); ctx.lineTo(p, PH); ctx.stroke();
  }
  for (p = 0, i = 0; p <= PH; p += step, i++) {
    ctx.strokeStyle = i % 5 === 0 ? major.c : minor.c; ctx.lineWidth = i % 5 === 0 ? major.w : minor.w;
    ctx.beginPath(); ctx.moveTo(0, p); ctx.lineTo(PW, p); ctx.stroke();
  }
}

function drawPaper(ctx, L) {
  const p = S.paper;
  ctx.fillStyle = p === 'eng' ? '#eaf3dc' : '#fdfdfb';
  ctx.fillRect(0, 0, PW, PH);
  const bg = assets.bgImage;
  if (p === 'custom' && bg) {
    const sc = Math.max(PW / bg.width, PH / bg.height);
    ctx.drawImage(bg, (PW - bg.width * sc) / 2, (PH - bg.height * sc) / 2, bg.width * sc, bg.height * sc);
    return;
  }
  if (p === 'ruled') {
    ctx.strokeStyle = 'rgba(88,126,196,0.42)'; ctx.lineWidth = 2;
    for (let i = 0; i <= L.nLines; i++) { const y = L.top + i * L.gap; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(PW, y); ctx.stroke(); }
  } else if (p === 'graph') {
    gridLines(ctx, mm(5), { c: 'rgba(90,140,205,0.55)', w: 1.8 }, { c: 'rgba(90,140,205,0.28)', w: 1.1 });
  } else if (p === 'eng') {
    gridLines(ctx, mm(5.08), { c: 'rgba(86,160,92,0.75)', w: 1.9 }, { c: 'rgba(86,160,92,0.38)', w: 1.1 });
  } else if (p === 'dotted') {
    ctx.fillStyle = 'rgba(80,90,115,0.5)';
    for (let x = mm(5); x < PW; x += mm(5)) for (let y = mm(5); y < PH; y += mm(5)) { ctx.beginPath(); ctx.arc(x, y, 2.1, 0, 6.2832); ctx.fill(); }
  }
  if (S.margin) {
    ctx.strokeStyle = 'rgba(205,70,66,0.7)'; ctx.lineWidth = 2.2;
    const x = L.left - mm(3.5);
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, PH); ctx.stroke();
    ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(x + 7, 0); ctx.lineTo(x + 7, PH); ctx.stroke();
  }
}

/* ---------- handwriting ---------- */
function drawWord(ctx, t, x, y, rng, N, tilt, bold) {
  const dx = (rng() - 0.5) * 2.4 * N, dy = (rng() - 0.5) * 3 * N + tilt, rot = (rng() - 0.5) * 0.05 * N;
  const sx = 1 + (rng() - 0.5) * 0.08 * N, sy = 1 + (rng() - 0.5) * 0.06 * N, a = 1 - rng() * 0.16 * N;
  ctx.save(); ctx.translate(x + dx, y + dy); ctx.rotate(rot); ctx.scale(sx, sy); ctx.globalAlpha = a;
  ctx.fillText(t, 0, 0);
  if (bold) ctx.fillText(t, 0.9, 0.4);
  ctx.restore();
}
function drawRun(ctx, text, x, y, size, rng, N) {
  ctx.font = fontStr(size);
  const sp = ctx.measureText(' ').width * 0.95;
  text.split(/\s+/).filter(Boolean).forEach((w) => { drawWord(ctx, w, x, y, rng, N, 0, false); x += ctx.measureText(w).width + sp; });
}
function runWidth(ctx, text, size) {
  ctx.font = fontStr(size);
  const sp = ctx.measureText(' ').width * 0.95;
  return text.split(/\s+/).filter(Boolean).reduce((w, p, i) => w + ctx.measureText(p).width + (i ? sp : 0), 0);
}

function drawText(ctx, it, pi, L, N) {
  const rng = rngFor(pi, it.line, 1), by = L.top + (it.line + 1) * L.gap - 4;
  const tiltSlope = (rng() - 0.5) * 0.012 * N, phase = rng() * 6;
  ctx.font = fontStr(it.size);
  it.words.forEach((w) => {
    const wave = Math.sin(w.x / 160 + phase) * 1.4 * N;
    drawWord(ctx, w.t, w.x, by + wave, rng, N, tiltSlope * (w.x - L.left), it.bold);
  });
  if (it.marker) {
    if (it.marker.kind === 'dot') {
      ctx.beginPath(); ctx.arc(it.marker.x, by - it.size * 0.3 + (rng() - 0.5) * 2 * N, it.size * 0.075 + rng() * 1.2 * N, 0, 6.2832); ctx.fill();
    } else {
      drawWord(ctx, it.marker.t, it.marker.x, by, rng, N, 0, false);
    }
  }
  if (it.underline) {
    ctx.save(); ctx.lineWidth = 2.4; ctx.lineCap = 'round'; ctx.globalAlpha = 0.9;
    wobLine(ctx, it.left - 4, by + 9, it.right + 4, by + 9 + (rng() - 0.5) * 3 * N, rng, 2.4 * (0.4 + N));
    ctx.restore();
  }
}

function drawBst(ctx, it, pi, L, N) {
  const rng = rngFor(pi, it.line, 2), t = it.tree, top = L.top + it.line * L.gap, availW = L.right - L.left;
  const sp = Math.min(76, availW / Math.max(t.n, 1)), cx = (L.left + L.right) / 2;
  const R = Math.min(25, sp * 0.4 + 4), amp = 0.8 + 2.2 * N;
  const pos = (n) => ({ x: cx + (n.i - (t.n - 1) / 2) * sp, y: top + 46 + n.d * 82 });
  ctx.save();
  ctx.lineWidth = 2.4; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const edge = (a, b) => {
    const p = pos(a), q = pos(b), ang = Math.atan2(q.y - p.y, q.x - p.x);
    wobLine(ctx, p.x + Math.cos(ang) * R, p.y + Math.sin(ang) * R, q.x - Math.cos(ang) * R, q.y - Math.sin(ang) * R, rng, amp);
  };
  t.nodes.forEach((n) => { if (n.l) edge(n, n.l); if (n.r) edge(n, n.r); });
  ctx.font = fontStr(L.base * 0.95); ctx.textAlign = 'center';
  t.nodes.forEach((n) => {
    const p = pos(n);
    wobCircle(ctx, p.x, p.y, R, rng, amp);
    ctx.fillText(String(n.k), p.x, p.y + L.base * 0.3);
  });
  ctx.restore();
}

export function drawPage(cv, pg, pi, L) {
  const ctx = cv.getContext('2d'), N = S.natural / 100, ink = inkColor();
  cv.width = PW; cv.height = PH;
  drawPaper(ctx, L);
  ctx.fillStyle = ink; ctx.strokeStyle = ink; ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
  ctx.shadowColor = ink; ctx.shadowBlur = 0.9;
  if (S.header) {
    const hs = L.base * 0.88, hr = rngFor(pi, 900, 3), hy = L.top - 9;
    if (S.name.trim()) drawRun(ctx, S.name.trim(), L.left, hy, hs, hr, N);
    if (S.subject.trim()) drawRun(ctx, S.subject.trim(), (L.left + L.right) / 2 - runWidth(ctx, S.subject.trim(), hs) / 2, hy, hs, hr, N);
    if (S.date.trim()) drawRun(ctx, S.date.trim(), L.right - runWidth(ctx, S.date.trim(), hs), hy, hs, hr, N);
  }
  pg.items.forEach((it) => { if (it.type === 'text') drawText(ctx, it, pi, L, N); else drawBst(ctx, it, pi, L, N); });
  if (S.pageNums) {
    const label = '- ' + (pi + 1) + ' -', fs = L.base * 0.85;
    drawRun(ctx, label, PW / 2 - runWidth(ctx, label, fs) / 2, PH - mm(8), fs, rngFor(pi, 901, 4), N);
  }
  ctx.shadowBlur = 0; ctx.globalAlpha = 1;
  if (S.scan) {
    ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = 0.07; ctx.fillStyle = noisePattern(ctx); ctx.fillRect(0, 0, PW, PH); ctx.restore();
    const g = ctx.createRadialGradient(PW / 2, PH / 2, PH * 0.35, PW / 2, PH / 2, PH * 0.78);
    g.addColorStop(0, 'rgba(70,55,30,0)'); g.addColorStop(1, 'rgba(70,55,30,0.16)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, PW, PH);
    const b = ctx.createLinearGradient(0, 0, mm(16), 0);
    b.addColorStop(0, 'rgba(0,0,0,0.13)'); b.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = b; ctx.fillRect(0, 0, mm(16), PH);
  }
}
