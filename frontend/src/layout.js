import { PW, PH, mm } from './config.js';
import { S, fontInfo, fontStr } from './state.js';

const mctx = document.createElement('canvas').getContext('2d');

export function metrics() {
  const gap = S.gap,
    top = Math.round(mm(26)),
    bottom = mm(15);
  return {
    gap,
    top,
    nLines: Math.floor((PH - top - bottom) / gap),
    left: mm(S.mL),
    right: PW - mm(S.mR),
    base: S.size * fontInfo().k,
  };
}

export function measure(text, size) {
  mctx.font = fontStr(size);
  return mctx.measureText(text).width;
}

export function parseBst(str) {
  const keys = (str.match(/-?\d+(?:\.\d+)?/g) || []).map(Number).slice(0, 15);
  if (!keys.length) {
    return null;
  }
  let root = null;
  const nodes = [];
  keys.forEach((k) => {
    const nd = { k, l: null, r: null, d: 0, i: 0 };
    if (!root) {
      root = nd;
      nodes.push(nd);
      return;
    }
    let c = root,
      ok = true;
    for (;;) {
      if (k === c.k) {
        ok = false;
        break;
      }
      const side = k < c.k ? 'l' : 'r';
      if (!c[side]) {
        c[side] = nd;
        nd.d = c.d + 1;
        break;
      }
      c = c[side];
    }
    if (ok) {
      nodes.push(nd);
    }
  });
  let idx = 0;
  (function walk(n) {
    if (!n) {
      return;
    }
    walk(n.l);
    n.i = idx++;
    walk(n.r);
  })(root);
  let depth = 0;
  nodes.forEach((n) => {
    if (n.d + 1 > depth) {
      depth = n.d + 1;
    }
  });
  return { nodes, n: idx, depth };
}

export function layout(L) {
  const pages = [{ items: [] }];
  let line = 0;
  const cur = () => pages[pages.length - 1];
  const newPage = () => {
    pages.push({ items: [] });
    line = 0;
  };
  const room = (n) => {
    if (line + n > L.nLines) {
      newPage();
    }
  };

  function wrap(text, size, textX) {
    mctx.font = fontStr(size);
    const sp = mctx.measureText(' ').width * 0.95,
      avail = L.right - textX;
    const lines = [];
    let c = [],
      cw = 0;
    const pieces = [];
    text
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .forEach((t) => {
        if (mctx.measureText(t).width <= avail) {
          pieces.push(t);
          return;
        }
        let part = '';
        for (let i = 0; i < t.length; i++) {
          if (mctx.measureText(part + t[i]).width > avail - 6 && part) {
            pieces.push(part);
            part = t[i];
          } else {
            part += t[i];
          }
        }
        if (part) {
          pieces.push(part);
        }
      });
    pieces.forEach((t) => {
      const w = mctx.measureText(t).width;
      let add = (c.length ? sp : 0) + w;
      if (c.length && cw + add > avail) {
        lines.push({ words: c, w: cw });
        c = [];
        cw = 0;
        add = w;
      }
      c.push({ t, w });
      cw += add;
    });
    if (c.length) {
      lines.push({ words: c, w: cw });
    }
    return { lines, sp, avail };
  }

  function place(text, o) {
    const { size, textX } = o;
    const W = wrap(text, size, textX);
    W.lines.forEach((ln, i) => {
      room(1);
      const al = o.align,
        last = i === W.lines.length - 1;
      let space = W.sp,
        x = textX;
      if (al === 'justify' && !last && ln.words.length > 1) {
        space = W.sp + (W.avail - ln.w) / (ln.words.length - 1);
      } else if (al === 'center') {
        x = textX + (W.avail - ln.w) / 2;
      } else if (al === 'right') {
        x = L.right - ln.w;
      }
      const ws = [];
      let px = x;
      ln.words.forEach((w) => {
        ws.push({ t: w.t, x: px, w: w.w });
        px += w.w + space;
      });
      const it = {
        type: 'text',
        line,
        size,
        words: ws,
        left: x,
        right: px - space,
        bold: !!o.bold,
        underline: !!(o.underline && last),
      };
      if (i === 0 && o.marker) {
        it.marker = o.marker;
      }
      cur().items.push(it);
      line++;
    });
  }

  S.answer.split('\n').forEach((raw) => {
    let m;
    if (!raw.trim()) {
      if (line > 0 && line < L.nLines) {
        line++;
      }
      return;
    }
    if ((m = raw.match(/^\s*(#{1,2})\s+(.*)$/))) {
      const lvl = m[1].length;
      room(2);
      place(m[2], {
        size: L.base * (lvl === 1 ? 1.25 : 1.1),
        textX: L.left,
        align: S.align === 'center' ? 'center' : 'left',
        bold: true,
        underline: lvl === 1,
      });
      return;
    }
    if ((m = raw.match(/^\s*\[bst\s+([^\]]*)\]\s*$/i))) {
      const tree = parseBst(m[1]);
      if (tree) {
        const h = 46 + (tree.depth - 1) * 82 + 56,
          n = Math.ceil(h / L.gap);
        room(n);
        cur().items.push({ type: 'bst', line, lines: n, tree });
        line += n;
        return;
      }
    }
    const lead = (raw.match(/^ */) || [''])[0].length,
      lvlI = Math.floor(lead / 2);
    if ((m = raw.match(/^\s*[-*•]\s+(.*)$/))) {
      const bx = L.left + lvlI * mm(6) + mm(1.5),
        tx = bx + L.base * 0.9;
      place(m[1], {
        size: L.base,
        textX: tx,
        align: 'left',
        marker: { kind: 'dot', x: bx + L.base * 0.18 },
      });
      return;
    }
    if ((m = raw.match(/^\s*(\d+[.)])\s+(.*)$/))) {
      const nx = L.left + lvlI * mm(6) + mm(1.5),
        nw = measure(m[1], L.base);
      place(m[2], {
        size: L.base,
        textX: nx + nw + L.base * 0.3,
        align: 'left',
        marker: { kind: 'text', t: m[1], x: nx },
      });
      return;
    }
    place(raw, {
      size: L.base,
      textX: Math.min(L.left + lead * L.base * 0.25, L.right - mm(40)),
      align: S.align,
    });
  });

  if (pages.length > 1 && !cur().items.length) {
    pages.pop();
  }
  return pages;
}
