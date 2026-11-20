import path from 'path';
import { pathToFileURL } from 'url';
import bcrypt from 'bcryptjs';
import { RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { pool } from '../config/database.js';

const DEMO_ACCOUNTS = ['admin_1', 'operator_1', 'aziz'] as const;
const DEFAULT_DEMO_PASSWORD = 'Password123!';

interface PendingUserRow extends RowDataPacket {
  username: string;
}

export interface SeedPasswordsOptions {
  force?: boolean;
}

export async function ensureDemoPasswordsSeeded(
  options: SeedPasswordsOptions = {}
): Promise<number> {
  const force = Boolean(options.force);
  const placeholders = DEMO_ACCOUNTS.map(() => '?').join(', ');

  let targetUsernames: string[] = [...DEMO_ACCOUNTS];
  if (!force) {
    const [pendingRows] = await pool.query<PendingUserRow[]>(
      `SELECT username FROM users WHERE username IN (${placeholders}) AND password_hash IS NULL`,
      [...DEMO_ACCOUNTS]
    );
    targetUsernames = pendingRows.map((row) => row.username);
    if (targetUsernames.length === 0) {
      console.log('[SeedPasswords] Password akun demo sudah aktif. Dilewati.');
      return 0;
    }
  }

  const salt = await bcrypt.genSalt(10);
  const hash = await bcrypt.hash(DEFAULT_DEMO_PASSWORD, salt);

  const targetPlaceholders = targetUsernames.map(() => '?').join(', ');
  const whereClause = force
    ? `username IN (${targetPlaceholders})`
    : `username IN (${targetPlaceholders}) AND password_hash IS NULL`;

  const [updateResult] = await pool.query<ResultSetHeader>(
    `UPDATE users SET password_hash = ?, wajib_reset_password = 0 WHERE ${whereClause}`,
    [hash, ...targetUsernames]
  );

  await pool.query<ResultSetHeader>(
    `UPDATE users SET telepon = '081299990001' WHERE username = 'operator_1' AND telepon IS NULL`
  );

  const updatedRows = Number(updateResult.affectedRows ?? 0);
  console.log(
    `[SeedPasswords] Berhasil mengaktifkan password default untuk ${updatedRows} akun demo (${targetUsernames.join(', ')}).`
  );
  return updatedRows;
}

const isDirectRun =
  process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isDirectRun) {
  ensureDemoPasswordsSeeded({ force: true })
    .then(async () => {
      await pool.end();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error('[SeedPasswords] Failed to seed passwords:', err);
      await pool.end();
      process.exit(1);
    });
}
