import { buildPdf } from '../src/pdf.js';
import { test, expect } from 'vitest';

test('buildPdf returns a Blob with application/pdf type', async () => {
  const jpegs = [new Uint8Array(10), new Uint8Array(20)];
  const blob = await buildPdf(jpegs);
  expect(blob.type).toBe('application/pdf');
  expect(blob.size).toBeGreaterThan(0);
});

test('buildPdf PDF contains valid header', async () => {
  const jpegs = [new Uint8Array(10), new Uint8Array(20)];
  const blob = await buildPdf(jpegs);
  const text = await blob.text();
  expect(text).toContain('%PDF-1.4');
});

test('buildPdf PDF contains xref table', async () => {
  const jpegs = [new Uint8Array(10), new Uint8Array(20)];
  const blob = await buildPdf(jpegs);
  const text = await blob.text();
  expect(text).toContain('xref');
});

test('buildPdf PDF contains trailer', async () => {
  const jpegs = [new Uint8Array(10), new Uint8Array(20)];
  const blob = await buildPdf(jpegs);
  const text = await blob.text();
  expect(text).toContain('%%EOF');
});
