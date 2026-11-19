import crypto from 'crypto';
import {
  tokenRepository,
  TokenSummaryRow,
} from '../repositories/token.repository.js';
import { SessionUser } from '../types/express.d.js';

export interface IssueTokenOptions {
  name?: string;
  abilities?: string[];
  ttlDays?: number | null;
}

export interface IssuedTokenResult {
  tokenId: number;
  plainTextToken: string;
  name: string;
  abilities: string[];
  expiresAt: Date | null;
}

export interface VerifiedTokenResult {
  tokenId: number;
  abilities: string[];
  user: SessionUser;
}

const LAST_USED_THROTTLE_MS = 60_000;

export class TokenService {
  hashSecret(secret: string): string {
    return crypto.createHash('sha256').update(secret, 'utf8').digest('hex');
  }

  constantTimeHexEqual(hashA: string, hashB: string): boolean {
    if (
      typeof hashA !== 'string' ||
      typeof hashB !== 'string' ||
      hashA.length !== 64 ||
      hashB.length !== 64
    ) {
      return false;
    }

    const bufA = Buffer.from(hashA, 'utf8');
    const bufB = Buffer.from(hashB, 'utf8');
    if (bufA.length !== bufB.length) {
      return false;
    }

    return crypto.timingSafeEqual(bufA, bufB);
  }

  private parseAbilities(raw: string[] | string | null): string[] {
    if (Array.isArray(raw)) {
      return raw.filter((item): item is string => typeof item === 'string');
    }
    if (typeof raw === 'string' && raw.trim().length > 0) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed.filter((item): item is string => typeof item === 'string');
        }
      } catch {
        return ['*'];
      }
    }
    return ['*'];
  }

  async issueToken(
    userId: number,
    options: IssueTokenOptions = {}
  ): Promise<IssuedTokenResult> {
    const name = options.name?.trim() || 'api-client';
    const abilities =
      options.abilities && options.abilities.length > 0
        ? options.abilities
        : ['*'];
    const ttlDays = options.ttlDays === undefined ? 30 : options.ttlDays;
    const expiresAt =
      ttlDays && ttlDays > 0
        ? new Date(Date.now() + ttlDays * 86_400_000)
        : null;

    const secret = crypto.randomBytes(32).toString('hex');
    const tokenHash = this.hashSecret(secret);

    const tokenId = await tokenRepository.createToken({
      id_user: userId,
      name,
      token_hash: tokenHash,
      abilities,
      kedaluwarsa_pada: expiresAt,
    });

    return {
      tokenId,
      plainTextToken: `${tokenId}|${secret}`,
      name,
      abilities,
      expiresAt,
    };
  }

  async verifyBearerToken(rawToken: string): Promise<VerifiedTokenResult | null> {
    const trimmed = rawToken.trim();
    const pipeIndex = trimmed.indexOf('|');
    if (pipeIndex <= 0) {
      return null;
    }

    const idPart = trimmed.slice(0, pipeIndex);
    const secret = trimmed.slice(pipeIndex + 1);

    if (!/^\d+$/.test(idPart) || secret.length < 32) {
      return null;
    }

    const tokenId = Number(idPart);
    if (!Number.isSafeInteger(tokenId) || tokenId <= 0) {
      return null;
    }

    const row = await tokenRepository.findTokenWithUserById(tokenId);
    if (!row) {
      return null;
    }

    if (row.status_akun !== 'aktif') {
      return null;
    }

    if (
      row.kedaluwarsa_pada &&
      new Date(row.kedaluwarsa_pada).getTime() <= Date.now()
    ) {
      return null;
    }

    const incomingHash = this.hashSecret(secret);
    if (!this.constantTimeHexEqual(row.token_hash, incomingHash)) {
      return null;
    }

    const abilities = this.parseAbilities(row.abilities);

    // Perbarui last_used maksimal 1x per menit agar tidak membebani row lock InnoDB saat trafik baca tinggi
    const lastUsedMs = row.terakhir_dipakai_pada
      ? new Date(row.terakhir_dipakai_pada).getTime()
      : 0;
    if (!lastUsedMs || Date.now() - lastUsedMs >= LAST_USED_THROTTLE_MS) {
      tokenRepository.touchLastUsed(tokenId).catch((err) => {
        console.error('[TokenService] Gagal memperbarui terakhir_dipakai_pada:', err);
      });
    }

    return {
      tokenId,
      abilities,
      user: {
        id: Number(row.id_user),
        username: row.username,
        nama: row.nama,
        role: row.role,
        wajib_reset_password: Number(row.wajib_reset_password),
      },
    };
  }

  async revokeToken(tokenId: number, userId: number): Promise<boolean> {
    return tokenRepository.revokeTokenById(tokenId, userId);
  }

  async revokeAllTokens(userId: number): Promise<number> {
    return tokenRepository.revokeAllUserTokens(userId);
  }

  async listActiveTokens(userId: number): Promise<
    Array<{
      id: number;
      name: string;
      abilities: string[];
      terakhir_dipakai_pada: Date | null;
      kedaluwarsa_pada: Date | null;
      dibuat_pada: Date;
    }>
  > {
    const rows: TokenSummaryRow[] = await tokenRepository.listUserTokens(userId);
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      abilities: this.parseAbilities(row.abilities),
      terakhir_dipakai_pada: row.terakhir_dipakai_pada,
      kedaluwarsa_pada: row.kedaluwarsa_pada,
      dibuat_pada: row.dibuat_pada,
    }));
  }
}

export const tokenService = new TokenService();
