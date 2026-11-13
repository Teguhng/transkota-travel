import { describe, it, expect } from 'vitest';
import QRCode from 'qrcode';
import { generateQrCodeSvg } from '../../src/utils/qrcode.js';

interface ParsedQrSvg {
  width: number;
  height: number;
  totalModules: number;
  grid: boolean[][];
}

function parseQrSvg(svg: string): ParsedQrSvg {
  const dimMatch = svg.match(/width="(\d+)" height="(\d+)" viewBox="0 0 (\d+) (\d+)"/);
  expect(dimMatch).not.toBeNull();

  const width = Number(dimMatch![1]);
  const height = Number(dimMatch![2]);
  const viewW = Number(dimMatch![3]);
  const viewH = Number(dimMatch![4]);
  expect(viewW).toBe(viewH);

  const pathMatch = svg.match(/<path fill="currentColor" d="([^"]+)"\/>/);
  expect(pathMatch).not.toBeNull();

  const totalModules = viewW;
  const grid = Array.from({ length: totalModules }, () => Array(totalModules).fill(false));

  const runRegex = /M(\d+) (\d+)h(\d+)v1h-\d+z/g;
  let match: RegExpExecArray | null;
  let count = 0;
  while ((match = runRegex.exec(pathMatch![1])) !== null) {
    count += 1;
    const xStart = Number(match[1]);
    const y = Number(match[2]);
    const runWidth = Number(match[3]);
    expect(y).toBeGreaterThanOrEqual(0);
    expect(y).toBeLessThan(totalModules);
    expect(xStart).toBeGreaterThanOrEqual(0);
    expect(xStart + runWidth).toBeLessThanOrEqual(totalModules);
    for (let dx = 0; dx < runWidth; dx++) {
      grid[y][xStart + dx] = true;
    }
  }
  expect(count).toBeGreaterThan(0);

  return { width, height, totalModules, grid };
}

function expectFinderPattern(grid: boolean[][], top: number, left: number): void {
  for (let r = 0; r < 7; r++) {
    for (let c = 0; c < 7; c++) {
      const isOuterBorder = r === 0 || r === 6 || c === 0 || c === 6;
      const isInnerCore = r >= 2 && r <= 4 && c >= 2 && c <= 4;
      expect(grid[top + r][left + c]).toBe(isOuterBorder || isInnerCore);
    }
  }
}

describe('QR Code Monochrome SVG Generator', () => {
  it('encodes legacy and 36-char UUID booking codes matching ISO 18004 module matrices', () => {
    const samples = [
      'LEGACY-108',
      'LEGACY-4',
      'TKT-bec1f298df1b11f1a1b70a0027000018',
      'TRV-20261113-0001',
    ];

    for (const sample of samples) {
      const svg = generateQrCodeSvg(sample);
      expect(svg).toContain('fill="currentColor"');
      expect(svg).toContain('shape-rendering="crispEdges"');
      expect(svg).toContain(`aria-label="QR Code ${sample}"`);

      const parsed = parseQrSvg(svg);
      expect(parsed.width).toBe(96);
      expect(parsed.height).toBe(96);

      const expectedQr = QRCode.create(sample, { errorCorrectionLevel: 'M' });
      const moduleCount = expectedQr.modules.size;
      const quietZone = (parsed.totalModules - moduleCount) / 2;
      expect(quietZone).toBe(4);

      // Verify quiet zone rings are completely empty around the symbol.
      for (let r = 0; r < parsed.totalModules; r++) {
        for (let c = 0; c < parsed.totalModules; c++) {
          const inSymbol =
            r >= quietZone &&
            r < quietZone + moduleCount &&
            c >= quietZone &&
            c < quietZone + moduleCount;
          if (!inSymbol) {
            expect(parsed.grid[r][c]).toBe(false);
          } else {
            const expectedDark = Boolean(expectedQr.modules.get(r - quietZone, c - quietZone));
            expect(parsed.grid[r][c]).toBe(expectedDark);
          }
        }
      }

      // Verify 7x7 finder patterns in top-left, top-right, and bottom-left corners.
      expectFinderPattern(parsed.grid, quietZone, quietZone);
      expectFinderPattern(parsed.grid, quietZone, quietZone + moduleCount - 7);
      expectFinderPattern(parsed.grid, quietZone + moduleCount - 7, quietZone);
    }
  });

  it('produces compact square dimensions regardless of UUID length', () => {
    const legacy = parseQrSvg(generateQrCodeSvg('LEGACY-108'));
    const uuid = parseQrSvg(generateQrCodeSvg('TKT-bec1f298df1b11f1a1b70a0027000018'));

    expect(legacy.width).toBe(legacy.height);
    expect(uuid.width).toBe(uuid.height);
    expect(uuid.width).toBe(96);
  });

  it('validates inputs, custom options, and escapes XML special chars in aria-label', () => {
    expect(() => generateQrCodeSvg('')).toThrow();
    expect(() => generateQrCodeSvg('   ')).toThrow();
    expect(() => generateQrCodeSvg('TKT-1', { size: 0 })).toThrow();
    expect(() => generateQrCodeSvg('TKT-1', { quietZoneModules: -1 })).toThrow();

    const customSvg = generateQrCodeSvg('  A&B"<C>  ', { size: 112, quietZoneModules: 2 });
    expect(customSvg).toContain('width="112" height="112"');
    expect(customSvg).toContain('aria-label="QR Code A&amp;B&quot;&lt;C&gt;"');

    const parsed = parseQrSvg(customSvg);
    const expectedQr = QRCode.create('A&B"<C>', { errorCorrectionLevel: 'M' });
    expect(parsed.totalModules).toBe(expectedQr.modules.size + 4);
  });
});

