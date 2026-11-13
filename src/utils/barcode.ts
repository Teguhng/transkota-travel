// ISO/IEC 15417 Code 128 bar/space module widths for symbols 0..106.
const CODE128_PATTERNS: readonly string[] = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213',
  '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132',
  '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211',
  '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331',
  '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111',
  '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214',
  '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141',
  '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141',
  '114131', '311141', '411131', '211412', '211214', '211232', '2331112'
];

const CODE_C_SWITCH = 99;
const CODE_B_SWITCH = 100;
const START_B = 104;
const START_C = 105;
const STOP_CODE = 106;

export interface Code128SvgOptions {
  moduleWidth?: number;
  height?: number;
  quietZoneModules?: number;
}

function escapeXmlAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function countConsecutiveDigits(input: string, start: number): number {
  let count = 0;
  while (start + count < input.length) {
    const code = input.charCodeAt(start + count);
    if (code < 48 || code > 57) break;
    count++;
  }
  return count;
}

/**
 * Encodes printable ASCII text into ISO/IEC 15417 Code 128 symbol values
 * (start symbol, data symbols, modulo-103 checksum, and stop symbol).
 */
export function encodeCode128(rawValue: string): number[] {
  const sanitized = rawValue.replace(/[^\x20-\x7e]/g, '');
  if (!sanitized) {
    throw new Error('Kode barcode harus berisi karakter ASCII cetak.');
  }

  const codes: number[] = [];
  const initialDigits = countConsecutiveDigits(sanitized, 0);
  let inSetC =
    (initialDigits === sanitized.length && (initialDigits === 2 || initialDigits >= 4)) ||
    initialDigits >= 4;

  codes.push(inSetC ? START_C : START_B);

  let i = 0;
  while (i < sanitized.length) {
    const digits = countConsecutiveDigits(sanitized, i);
    const atEnd = i + digits === sanitized.length;

    if (inSetC) {
      if (digits >= 2) {
        codes.push(Number(sanitized.slice(i, i + 2)));
        i += 2;
        continue;
      }
      inSetC = false;
      codes.push(CODE_B_SWITCH);
    }

    if (atEnd && digits >= 4) {
      // Delay switching to Set C by 1 digit when trailing digit count is odd.
      if (digits % 2 === 1) {
        codes.push(sanitized.charCodeAt(i) - 32);
        i += 1;
      }
      inSetC = true;
      codes.push(CODE_C_SWITCH);
      continue;
    }

    if (!atEnd && digits >= 6) {
      inSetC = true;
      codes.push(CODE_C_SWITCH);
      continue;
    }

    codes.push(sanitized.charCodeAt(i) - 32);
    i += 1;
  }

  let checksum = codes[0];
  for (let idx = 1; idx < codes.length; idx++) {
    checksum += codes[idx] * idx;
  }
  codes.push(checksum % 103);
  codes.push(STOP_CODE);

  return codes;
}

/**
 * Generates an inline monochrome SVG Code 128 barcode using currentColor
 * with ISO-compliant 10x quiet zones and crisp integer module geometry.
 */
export function generateCode128Svg(value: string, options: Code128SvgOptions = {}): string {
  const moduleWidth = options.moduleWidth ?? 2;
  const height = options.height ?? 24;
  const quietZoneModules = options.quietZoneModules ?? 10;

  const codes = encodeCode128(value);
  const rects: string[] = [];
  let cursorModules = quietZoneModules;

  for (const code of codes) {
    const pattern = CODE128_PATTERNS[code];
    for (let j = 0; j < pattern.length; j++) {
      const widthModules = Number(pattern[j]);
      // Even indices in each Code 128 pattern represent dark bars; odd indices represent spaces.
      if (j % 2 === 0) {
        const x = cursorModules * moduleWidth;
        const w = widthModules * moduleWidth;
        rects.push(`<rect x="${x}" y="0" width="${w}" height="${height}"/>`);
      }
      cursorModules += widthModules;
    }
  }

  const totalWidth = (cursorModules + quietZoneModules) * moduleWidth;
  const label = escapeXmlAttr(value);

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="${height}" viewBox="0 0 ${totalWidth} ${height}" shape-rendering="crispEdges" role="img" aria-label="Barcode ${label}" style="display:block;max-width:100%;height:auto;">`,
    `<g fill="currentColor">${rects.join('')}</g>`,
    `</svg>`
  ].join('');
}

export { CODE128_PATTERNS };
