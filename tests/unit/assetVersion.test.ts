import { describe, it, expect } from 'vitest';
import { getAssetVersion } from '../../src/utils/assetVersion.js';

describe('getAssetVersion', () => {
  it('menghasilkan hash 8 karakter heksadesimal untuk aset publik yang tersedia', () => {
    const version = getAssetVersion('js/theme-toggle.js');
    expect(version).toMatch(/^[0-9a-f]{8}$/);
  });

  it('mengembalikan fallback "1" bila berkas aset tidak ditemukan', () => {
    const version = getAssetVersion('js/non-existent-asset.js');
    expect(version).toBe('1');
  });
});
