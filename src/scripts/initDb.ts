import fs from 'fs/promises';
import path from 'path';
import { pathToFileURL } from 'url';
import { RowDataPacket } from 'mysql2';
import { pool } from '../config/database.js';

export function splitSqlStatements(sqlContent: string): string[] {
  const sql = sqlContent.replace(/^\uFEFF/, '');
  const statements: string[] = [];
  let delimiter = ';';
  let current = '';

  let inSingleQuote = false;
  let inDoubleQuote = false;
  let inBacktick = false;
  let inLineComment = false;
  let inBlockComment = false;
  let atLineStart = true;

  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    const next = i + 1 < sql.length ? sql[i + 1] : '';

    if (inLineComment) {
      if (ch === '\n') {
        inLineComment = false;
        atLineStart = true;
      }
      continue;
    }

    if (inBlockComment) {
      if (ch === '*' && next === '/') {
        inBlockComment = false;
        i += 1;
      }
      continue;
    }

    if (inSingleQuote) {
      current += ch;
      if (ch === '\\' && next) {
        current += next;
        i += 1;
      } else if (ch === "'" && next === "'") {
        current += next;
        i += 1;
      } else if (ch === "'") {
        inSingleQuote = false;
      }
      atLineStart = false;
      continue;
    }

    if (inDoubleQuote) {
      current += ch;
      if (ch === '\\' && next) {
        current += next;
        i += 1;
      } else if (ch === '"') {
        inDoubleQuote = false;
      }
      atLineStart = false;
      continue;
    }

    if (inBacktick) {
      current += ch;
      if (ch === '`') {
        inBacktick = false;
      }
      atLineStart = false;
      continue;
    }

    // Handle line comments (-- or #) outside quotes
    if ((ch === '-' && next === '-') || ch === '#') {
      inLineComment = true;
      continue;
    }

    // Handle block comments /* ... */
    if (ch === '/' && next === '*') {
      inBlockComment = true;
      i += 1;
      continue;
    }

    // Handle DELIMITER directive at line start (or after whitespace)
    if (atLineStart) {
      if (ch === ' ' || ch === '\t' || ch === '\r' || ch === '\n') {
        if (ch === '\n') atLineStart = true;
        current += ch;
        continue;
      }
      const lineRest = sql.slice(i);
      const delimMatch = lineRest.match(/^DELIMITER\s+(\S+)[ \t]*(?:\r?\n|$)/i);
      if (delimMatch) {
        delimiter = delimMatch[1];
        i += delimMatch[0].length - 1;
        atLineStart = true;
        continue;
      }
    }

    // Check active delimiter
    if (delimiter && sql.startsWith(delimiter, i)) {
      const trimmed = current.trim();
      if (trimmed.length > 0) {
        statements.push(trimmed);
      }
      current = '';
      i += delimiter.length - 1;
      atLineStart = false;
      continue;
    }

    if (ch === "'") {
      inSingleQuote = true;
    } else if (ch === '"') {
      inDoubleQuote = true;
    } else if (ch === '`') {
      inBacktick = true;
    }

    current += ch;
    atLineStart = ch === '\n';
  }

  const trailing = current.trim();
  if (trailing.length > 0) {
    statements.push(trailing);
  }

  return statements;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function ensureDatabaseInitialized(
  sqlFilePath: string = path.resolve(process.cwd(), 'db_tiket.sql')
): Promise<boolean> {
  const maxAttempts = 8;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const [existingTables] = await pool.query<RowDataPacket[]>(
        "SHOW TABLES LIKE 'users'"
      );
      if (existingTables.length > 0) {
        console.log('[InitDB] Schema sudah tersedia, melewati impor db_tiket.sql.');
        return false;
      }

      const rawSql = await fs.readFile(sqlFilePath, 'utf8');
      const statements = splitSqlStatements(rawSql);

      const conn = await pool.getConnection();
      try {
        for (const stmt of statements) {
          await conn.query(stmt);
        }
      } finally {
        conn.release();
      }

      console.log(
        `[InitDB] Berhasil mengimpor db_tiket.sql (${statements.length} statements).`
      );
      return true;
    } catch (err: any) {
      lastError = err;
      const transientCodes = ['ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND', 'PROTOCOL_CONNECTION_LOST'];
      if (transientCodes.includes(err?.code) && attempt < maxAttempts) {
        console.warn(
          `[InitDB] Koneksi MySQL belum siap (percobaan ${attempt}/${maxAttempts}: ${err.code}). Menunggu 2 detik...`
        );
        await sleep(2000);
        continue;
      }
      throw err;
    }
  }

  throw lastError;
}

const isDirectRun =
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isDirectRun) {
  ensureDatabaseInitialized()
    .then(() => pool.end())
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[InitDB Error]:', err);
      process.exit(1);
    });
}
