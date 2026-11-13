import { describe, it, expect } from 'vitest';
import { CODE128_PATTERNS, encodeCode128, generateCode128Svg } from '../../src/utils/barcode.js';

function decodeSvgToText(svg: string, moduleWidth = 2): string {
  const widthMatch = svg.match(/viewBox="0 0 (\d+) (\d+)"/);
  expect(widthMatch).not.toBeNull();
  const totalWidth = Number(widthMatch![1]);

  const rects = [...svg.matchAll(/<rect x="(\d+)" y="0" width="(\d+)" height="(\d+)"\/>/g)].map((m) => ({
    x: Number(m[1]),
    w: Number(m[2]),
  }));
  expect(rects.length).toBeGreaterThan(0);

  const leftQuietZone = rects[0].x;
  const lastRect = rects[rects.length - 1];
  const rightQuietZone = totalWidth - (lastRect.x + lastRect.w);
  expect(leftQuietZone).toBeGreaterThanOrEqual(10 * moduleWidth);
  expect(rightQuietZone).toBeGreaterThanOrEqual(10 * moduleWidth);

  const runs: number[] = [];
  for (let i = 0; i < rects.length; i++) {
    expect(rects[i].w % moduleWidth).toBe(0);
    runs.push(rects[i].w / moduleWidth);
    if (i < rects.length - 1) {
      const gap = rects[i + 1].x - (rects[i].x + rects[i].w);
      expect(gap).toBeGreaterThan(0);
      expect(gap % moduleWidth).toBe(0);
      runs.push(gap / moduleWidth);
    }
  }

  // Trailing 7 runs must be the Stop pattern (2331112).
  const stopPattern = runs.slice(-7).join('');
  expect(stopPattern).toBe('2331112');

  const bodyRuns = runs.slice(0, -7);
  expect(bodyRuns.length % 6).toBe(0);

  const patternToCode = new Map<string, number>();
  for (let code = 0; code <= 105; code++) {
    patternToCode.set(CODE128_PATTERNS[code], code);
  }

  const codes: number[] = [];
  for (let idx = 0; idx < bodyRuns.length; idx += 6) {
    const pat = bodyRuns.slice(idx, idx + 6).join('');
    const code = patternToCode.get(pat);
    expect(code).toBeDefined();
    codes.push(code!);
  }

  const checksumActual = codes[codes.length - 1];
  const dataAndStart = codes.slice(0, -1);
  let sum = dataAndStart[0];
  for (let pos = 1; pos < dataAndStart.length; pos++) {
    sum += dataAndStart[pos] * pos;
  }
  expect(checksumActual).toBe(sum % 103);

  let set: 'A' | 'B' | 'C' = dataAndStart[0] === 105 ? 'C' : 'B';
  let output = '';
  for (let idx = 1; idx < dataAndStart.length; idx++) {
    const code = dataAndStart[idx];
    if (set === 'C') {
      if (code === 100) {
        set = 'B';
      } else if (code === 101) {
        set = 'A';
      } else {
        output += String(code).padStart(2, '0');
      }
    } else {
      if (code === 99) {
        set = 'C';
      } else if (code === 100 && set === 'A') {
        set = 'B';
      } else if (code === 101 && set === 'B') {
        set = 'A';
      } else {
        output += String.fromCharCode(code + 32);
      }
    }
  }

  return output;
}

describe('Code 128 Barcode Generator', () => {
  it('verifies all 107 ISO/IEC 15417 patterns satisfy module and parity invariants', () => {
    expect(CODE128_PATTERNS).toHaveLength(107);
    const seen = new Set(CODE128_PATTERNS);
    expect(seen.size).toBe(107);

    for (let code = 0; code <= 105; code++) {
      const digits = CODE128_PATTERNS[code].split('').map(Number);
      expect(digits).toHaveLength(6);
      expect(digits.every((d) => d >= 1 && d <= 4)).toBe(true);
      expect(digits.reduce((a, b) => a + b, 0)).toBe(11);
      const barSum = digits[0] + digits[2] + digits[4];
      const spaceSum = digits[1] + digits[3] + digits[5];
      expect(barSum % 2).toBe(0);
      expect(spaceSum % 2).toBe(1);
    }

    const stopDigits = CODE128_PATTERNS[106].split('').map(Number);
    expect(stopDigits).toHaveLength(7);
    expect(stopDigits.reduce((a, b) => a + b, 0)).toBe(13);
  });

  it('encodes and round-trip decodes ticket booking codes including LEGACY-108', () => {
    const samples = [
      'LEGACY-108',
      'LEGACY-4',
      'BK-TEST99',
      'WLK-101',
      'TRV-20261113-0001',
      '12345678',
      '99',
      'abc-XYZ_99',
    ];

    for (const sample of samples) {
      const svg = generateCode128Svg(sample);
      expect(svg).toContain('fill="currentColor"');
      expect(svg).toContain('shape-rendering="crispEdges"');
      expect(decodeSvgToText(svg)).toBe(sample);
    }
  });

  it('uses Set C compression for long digit sequences', () => {
    const codes = encodeCode128('TRV-20261113-0001');
    expect(codes).toContain(99);
    expect(decodeSvgToText(generateCode128Svg('TRV-20261113-0001'))).toBe('TRV-20261113-0001');
  });

  it('rejects empty or non-ASCII-printable strings and escapes XML attributes', () => {
    expect(() => generateCode128Svg('')).toThrow();
    const svg = generateCode128Svg('A&B"C');
    expect(svg).toContain('aria-label="Barcode A&amp;B&quot;C"');
    expect(decodeSvgToText(svg)).toBe('A&B"C');
  });
});
