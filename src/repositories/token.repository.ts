import { pool } from '../config/database.js';
import {
  PersonalAccessTokenRow,
  UserRole,
  UserStatus,
} from '../types/db.types.js';
import { ResultSetHeader, RowDataPacket } from 'mysql2';

export interface TokenWithUserRow extends PersonalAccessTokenRow {
  username: string;
  nama: string;
  role: UserRole;
  wajib_reset_password: number;
  status_akun: UserStatus;
}

export type TokenSummaryRow = Omit<PersonalAccessTokenRow, 'token_hash'>;

const CREATE_PAT_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS personal_access_tokens (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    id_user BIGINT UNSIGNED NOT NULL,
    name VARCHAR(100) NOT NULL DEFAULT 'api-client',
    token_hash CHAR(64) NOT NULL UNIQUE,
    abilities JSON NULL,
    terakhir_dipakai_pada DATETIME NULL,
    kedaluwarsa_pada DATETIME NULL,
    dibuat_pada DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY ix_pat_user (id_user),
    KEY ix_pat_expiry (kedaluwarsa_pada),
    FOREIGN KEY (id_user) REFERENCES users(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
`;

export class TokenRepository {
  private tableReadyPromise: Promise<void> | null = null;

  resetTableInitCache(): void {
    this.tableReadyPromise = null;
  }

  async ensureTable(): Promise<void> {
    if (!this.tableReadyPromise) {
      this.tableReadyPromise = pool
        .query(CREATE_PAT_TABLE_SQL)
        .then(() => undefined)
        .catch((err) => {
          this.tableReadyPromise = null;
          throw err;
        });
    }
    return this.tableReadyPromise;
  }

  async createToken(data: {
    id_user: number;
    name: string;
    token_hash: string;
    abilities: string[];
    kedaluwarsa_pada: Date | null;
  }): Promise<number> {
    await this.ensureTable();
    const [res] = await pool.query<ResultSetHeader>(
      `INSERT INTO personal_access_tokens (id_user, name, token_hash, abilities, kedaluwarsa_pada)
       VALUES (?, ?, ?, ?, ?)`,
      [
        data.id_user,
        data.name,
        data.token_hash,
        JSON.stringify(data.abilities),
        data.kedaluwarsa_pada,
      ]
    );
    return Number(res.insertId);
  }

  async findTokenWithUserById(tokenId: number): Promise<TokenWithUserRow | null> {
    await this.ensureTable();
    const sql = `
      SELECT pat.id, pat.id_user, pat.name, pat.token_hash, pat.abilities,
             pat.terakhir_dipakai_pada, pat.kedaluwarsa_pada, pat.dibuat_pada,
             u.username, u.nama, u.role, u.wajib_reset_password, u.status_akun
      FROM personal_access_tokens pat
      JOIN users u ON u.id = pat.id_user
      WHERE pat.id = ?
      LIMIT 1
    `;
    const [rows] = await pool.query<RowDataPacket[]>(sql, [tokenId]);
    if (!rows.length) {
      return null;
    }

    const row = rows[0] as any;
    return {
      ...row,
      id: Number(row.id),
      id_user: Number(row.id_user),
      wajib_reset_password: Number(row.wajib_reset_password),
    } as TokenWithUserRow;
  }

  async touchLastUsed(tokenId: number): Promise<void> {
    await this.ensureTable();
    await pool.query(
      'UPDATE personal_access_tokens SET terakhir_dipakai_pada = NOW() WHERE id = ?',
      [tokenId]
    );
  }

  async revokeTokenById(tokenId: number, userId: number): Promise<boolean> {
    await this.ensureTable();
    const [res] = await pool.query<ResultSetHeader>(
      'DELETE FROM personal_access_tokens WHERE id = ? AND id_user = ?',
      [tokenId, userId]
    );
    return res.affectedRows > 0;
  }

  async revokeAllUserTokens(userId: number): Promise<number> {
    await this.ensureTable();
    const [res] = await pool.query<ResultSetHeader>(
      'DELETE FROM personal_access_tokens WHERE id_user = ?',
      [userId]
    );
    return res.affectedRows;
  }

  async listUserTokens(userId: number): Promise<TokenSummaryRow[]> {
    await this.ensureTable();
    const sql = `
      SELECT id, id_user, name, abilities, terakhir_dipakai_pada, kedaluwarsa_pada, dibuat_pada
      FROM personal_access_tokens
      WHERE id_user = ?
        AND (kedaluwarsa_pada IS NULL OR kedaluwarsa_pada > NOW())
      ORDER BY dibuat_pada DESC
    `;
    const [rows] = await pool.query<RowDataPacket[]>(sql, [userId]);
    return rows.map((row: any) => ({
      ...row,
      id: Number(row.id),
      id_user: Number(row.id_user),
    })) as TokenSummaryRow[];
  }
}

export const tokenRepository = new TokenRepository();
