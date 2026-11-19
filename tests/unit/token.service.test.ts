import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'crypto';
import { tokenService } from '../../src/services/token.service.js';
import {
  tokenRepository,
  TokenWithUserRow,
} from '../../src/repositories/token.repository.js';

describe('TokenService Unit Tests (Sanctum-Style PAT)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('issueToken', () => {
    it('should issue "<id>|<64-hex>" token and store only SHA-256 hash', async () => {
      let storedHash = '';
      vi.spyOn(tokenRepository, 'createToken').mockImplementation(async (data) => {
        storedHash = data.token_hash;
        expect(data.id_user).toBe(42);
        expect(data.name).toBe('flutter-android');
        expect(data.abilities).toEqual(['bookings:read', 'bookings:write']);
        expect(data.kedaluwarsa_pada).toBeInstanceOf(Date);
        return 17;
      });

      const issued = await tokenService.issueToken(42, {
        name: 'flutter-android',
        abilities: ['bookings:read', 'bookings:write'],
        ttlDays: 7,
      });

      expect(issued.tokenId).toBe(17);
      expect(issued.plainTextToken).toMatch(/^17\|[a-f0-9]{64}$/);

      const rawSecret = issued.plainTextToken.split('|')[1];
      const expectedSha256 = crypto
        .createHash('sha256')
        .update(rawSecret, 'utf8')
        .digest('hex');

      expect(storedHash).toBe(expectedSha256);
      expect(storedHash).not.toBe(rawSecret);
    });
  });

  describe('verifyBearerToken', () => {
    const validSecret = 'a'.repeat(64);
    const validHash = crypto
      .createHash('sha256')
      .update(validSecret, 'utf8')
      .digest('hex');

    const baseRow: TokenWithUserRow = {
      id: 5,
      id_user: 11,
      name: 'mobile',
      token_hash: validHash,
      abilities: JSON.stringify(['*']),
      terakhir_dipakai_pada: null,
      kedaluwarsa_pada: new Date(Date.now() + 60 * 60 * 1000),
      dibuat_pada: new Date(),
      username: 'aziz',
      nama: 'Aziz',
      role: 'member',
      wajib_reset_password: 0,
      status_akun: 'aktif',
    };

    it('should authenticate valid token and trigger touchLastUsed when stale/null', async () => {
      vi.spyOn(tokenRepository, 'findTokenWithUserById').mockResolvedValue({
        ...baseRow,
      });
      const touchSpy = vi
        .spyOn(tokenRepository, 'touchLastUsed')
        .mockResolvedValue();

      const result = await tokenService.verifyBearerToken(`5|${validSecret}`);

      expect(result).toEqual({
        tokenId: 5,
        abilities: ['*'],
        user: {
          id: 11,
          username: 'aziz',
          nama: 'Aziz',
          role: 'member',
          wajib_reset_password: 0,
        },
      });
      expect(touchSpy).toHaveBeenCalledWith(5);
    });

    it('should throttle touchLastUsed when terakhir_dipakai_pada is within 60 seconds', async () => {
      vi.spyOn(tokenRepository, 'findTokenWithUserById').mockResolvedValue({
        ...baseRow,
        terakhir_dipakai_pada: new Date(Date.now() - 10_000),
      });
      const touchSpy = vi
        .spyOn(tokenRepository, 'touchLastUsed')
        .mockResolvedValue();

      const result = await tokenService.verifyBearerToken(`5|${validSecret}`);

      expect(result).not.toBeNull();
      expect(touchSpy).not.toHaveBeenCalled();
    });

    it('should reject wrong secret', async () => {
      vi.spyOn(tokenRepository, 'findTokenWithUserById').mockResolvedValue({
        ...baseRow,
      });

      const wrongSecret = 'b'.repeat(64);
      const result = await tokenService.verifyBearerToken(`5|${wrongSecret}`);

      expect(result).toBeNull();
    });

    it('should reject expired token', async () => {
      vi.spyOn(tokenRepository, 'findTokenWithUserById').mockResolvedValue({
        ...baseRow,
        kedaluwarsa_pada: new Date(Date.now() - 1000),
      });

      const result = await tokenService.verifyBearerToken(`5|${validSecret}`);

      expect(result).toBeNull();
    });

    it('should reject token for inactive user account', async () => {
      vi.spyOn(tokenRepository, 'findTokenWithUserById').mockResolvedValue({
        ...baseRow,
        status_akun: 'nonaktif',
      });

      const result = await tokenService.verifyBearerToken(`5|${validSecret}`);

      expect(result).toBeNull();
    });

    it('should reject malformed tokens without hitting repository', async () => {
      const findSpy = vi.spyOn(tokenRepository, 'findTokenWithUserById');

      expect(await tokenService.verifyBearerToken('invalid-no-pipe')).toBeNull();
      expect(await tokenService.verifyBearerToken('abc|' + validSecret)).toBeNull();
      expect(await tokenService.verifyBearerToken('5|too-short')).toBeNull();
      expect(await tokenService.verifyBearerToken('0|' + validSecret)).toBeNull();
      expect(findSpy).not.toHaveBeenCalled();
    });
  });

  describe('token revocation and listing', () => {
    it('should delegate revokeToken, revokeAllTokens, and parse listActiveTokens', async () => {
      vi.spyOn(tokenRepository, 'revokeTokenById').mockResolvedValue(true);
      vi.spyOn(tokenRepository, 'revokeAllUserTokens').mockResolvedValue(3);
      vi.spyOn(tokenRepository, 'listUserTokens').mockResolvedValue([
        {
          id: 9,
          id_user: 11,
          name: 'ios-app',
          abilities: '["bookings:read"]',
          terakhir_dipakai_pada: null,
          kedaluwarsa_pada: null,
          dibuat_pada: new Date(),
        },
      ]);

      expect(await tokenService.revokeToken(9, 11)).toBe(true);
      expect(await tokenService.revokeAllTokens(11)).toBe(3);

      const list = await tokenService.listActiveTokens(11);
      expect(list).toHaveLength(1);
      expect(list[0].abilities).toEqual(['bookings:read']);
    });
  });
});
