import { PW, PH } from './config.js';

// Minimal PDF writer: one JPEG-backed A4 page per canvas.
export function buildPdf(jpegs) {
  const enc = new TextEncoder(),
    chunks = [],
    offsets = [];
  let off = 0;
  const n = jpegs.length,
    total = 2 + 3 * n;
  const push = (b) => {
    const u = typeof b === 'string' ? enc.encode(b) : b;
    chunks.push(u);
    off += u.length;
  };
  const obj = (id, fn) => {
    offsets[id] = off;
    push(id + ' 0 obj\n');
    fn();
    push('endobj\n');
  };

  push('%PDF-1.4\n');
  obj(1, () => push('<< /Type /Catalog /Pages 2 0 R >>\n'));
  obj(2, () =>
    push(
      '<< /Type /Pages /Kids [' +
        jpegs.map((_, i) => 3 + 3 * i + ' 0 R').join(' ') +
        '] /Count ' +
        n +
        ' >>\n'
    )
  );
  jpegs.forEach((jp, i) => {
    const p = 3 + 3 * i,
      c = p + 1,
      im = p + 2,
      cs = 'q 595.28 0 0 841.89 0 0 cm /Im0 Do Q';
    obj(p, () =>
      push(
        '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /XObject << /Im0 ' +
          im +
          ' 0 R >> >> /Contents ' +
          c +
          ' 0 R >>\n'
      )
    );
    obj(c, () =>
      push('<< /Length ' + cs.length + ' >>\nstream\n' + cs + '\nendstream\n')
    );
    obj(im, () => {
      push(
        '<< /Type /XObject /Subtype /Image /Width ' +
          PW +
          ' /Height ' +
          PH +
          ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' +
          jp.length +
          ' >>\nstream\n'
      );
      push(jp);
      push('\nendstream\n');
    });
  });
  const xref = off;
  push('xref\n0 ' + (total + 1) + '\n0000000000 65535 f \n');
  for (let i = 1; i <= total; i++) {
    push(String(offsets[i]).padStart(10, '0') + ' 00000 n \n');
  }
  push(
    'trailer\n<< /Size ' +
      (total + 1) +
      ' /Root 1 0 R >>\nstartxref\n' +
      xref +
      '\n%%EOF\n'
  );
  return new Blob(chunks, { type: 'application/pdf' });
}

export function canvasToJpeg(cv) {
  return new Promise((res, rej) =>
    cv.toBlob(
      (b) => (b ? res(b) : rej(new Error('encode failed'))),
      'image/jpeg',
      0.92
    )
  )
    .then((b) => b.arrayBuffer())
    .then((ab) => new Uint8Array(ab));
}

export function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
