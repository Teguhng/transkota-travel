import QRCode, { type QRCodeErrorCorrectionLevel } from 'qrcode';

export interface QrCodeSvgOptions {
  size?: number;
  quietZoneModules?: number;
  errorCorrectionLevel?: QRCodeErrorCorrectionLevel;
}

function escapeXmlAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function normalizePositiveInt(value: number | undefined, fallback: number, name: string): number {
  const resolved = value ?? fallback;
  if (!Number.isFinite(resolved) || resolved <= 0) {
    throw new Error(`${name} harus berupa angka positif.`);
  }
  return Math.round(resolved);
}

function normalizeQuietZone(value: number | undefined): number {
  const resolved = value ?? 4;
  if (!Number.isFinite(resolved) || resolved < 0) {
    throw new Error('quietZoneModules tidak boleh negatif.');
  }
  return Math.floor(resolved);
}

/**
 * Generates an ISO/IEC 18004 monochrome QR Code SVG using contiguous horizontal
 * path runs so dark modules render without anti-aliasing hairline gaps.
 */
export function generateQrCodeSvg(rawValue: string, options: QrCodeSvgOptions = {}): string {
  const value = rawValue.trim();
  if (!value) {
    throw new Error('Kode QR tidak boleh kosong.');
  }

  const size = normalizePositiveInt(options.size, 96, 'size');
  const quietZone = normalizeQuietZone(options.quietZoneModules);
  const errorCorrectionLevel = options.errorCorrectionLevel ?? 'M';

  const qr = QRCode.create(value, { errorCorrectionLevel });
  const moduleCount = qr.modules.size;
  const totalModules = moduleCount + quietZone * 2;
  const pathSegments: string[] = [];

  for (let row = 0; row < moduleCount; row++) {
    let col = 0;
    while (col < moduleCount) {
      if (!qr.modules.get(row, col)) {
        col += 1;
        continue;
      }

      const runStart = col;
      while (col < moduleCount && qr.modules.get(row, col)) {
        col += 1;
      }
      const runWidth = col - runStart;
      pathSegments.push(`M${runStart + quietZone} ${row + quietZone}h${runWidth}v1h-${runWidth}z`);
    }
  }

  const label = escapeXmlAttr(value);
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${totalModules} ${totalModules}" shape-rendering="crispEdges" role="img" aria-label="QR Code ${label}" style="display:block;max-width:100%;height:auto;">`,
    `<path fill="currentColor" d="${pathSegments.join('')}"/>`,
    `</svg>`
  ].join('');
}

