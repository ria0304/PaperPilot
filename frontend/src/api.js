// Thin client for the PaperPilot backend.
const BASE = import.meta.env.VITE_API_BASE || '';

export class ApiError extends Error {
  constructor(code, message) {
    super(message || code);
    this.code = code;
  }
}

export async function health() {
  try {
    const r = await fetch(BASE + '/api/health');
    if (!r.ok) {
      return { ok: false };
    }
    return await r.json();
  } catch {
    return { ok: false };
  }
}

function fileToBase64(file) {
  return new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(String(fr.result).split(',')[1]);
    fr.onerror = () => rej(new Error('read failed'));
    fr.readAsDataURL(file);
  });
}

/**
 * Streams a generated answer. onText receives the full text so far.
 * Resolves with { text, truncated }. Abort with the signal.
 */
export async function generateAnswer({
  question,
  subject,
  length,
  image,
  signal,
  onText,
}) {
  const body = { question, subject, length };
  if (image) {
    body.image = { mediaType: image.type, data: await fileToBase64(image) };
  }

  let resp;
  try {
    resp = await fetch(BASE + '/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    });
  } catch (e) {
    if (e.name === 'AbortError') {
      throw new ApiError('cancelled');
    }
    throw new ApiError('network', 'Could not reach the server.');
  }

  if (!resp.ok) {
    let code = 'failed';
    try {
      code = (await resp.json()).code || code;
    } catch {
      /* ignore */
    }
    throw new ApiError(code);
  }

  const reader = resp.body.getReader();
  const dec = new TextDecoder();
  let buf = '',
    text = '',
    truncated = false;

  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) {
        break;
      }
      buf += dec.decode(value, { stream: true });
      let idx;
      while ((idx = buf.indexOf('\n\n')) >= 0) {
        const raw = buf.slice(0, idx);
        buf = buf.slice(idx + 2);
        const line = raw.split('\n').find((l) => l.startsWith('data: '));
        if (!line) {
          continue;
        }
        const evt = JSON.parse(line.slice(6));
        if (evt.type === 'delta') {
          text += evt.text;
          onText && onText(text);
        } else if (evt.type === 'done') {
          truncated = !!evt.truncated;
        } else if (evt.type === 'error') {
          const err = new ApiError(evt.code || 'failed');
          err.text = text;
          throw err;
        }
      }
    }
  } catch (e) {
    if (e.name === 'AbortError') {
      const err = new ApiError('cancelled');
      err.text = text;
      throw err;
    }
    if (e instanceof ApiError) {
      throw e;
    }
    const err = new ApiError('network');
    err.text = text;
    throw err;
  }
  return { text, truncated };
}
