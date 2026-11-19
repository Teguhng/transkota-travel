import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { splitSqlStatements } from '../../src/scripts/initDb.js';

describe('initDb SQL Parser Unit Tests', () => {
  it('should parse db_tiket.sql accurately with DELIMITER $$ triggers, procedures, and semicolons in JSON', () => {
    const sqlPath = path.resolve(process.cwd(), 'db_tiket.sql');
    const rawSql = fs.readFileSync(sqlPath, 'utf8');
    const statements = splitSqlStatements(rawSql);

    expect(statements.length).toBeGreaterThan(50);

    // Tidak boleh ada statement DELIMITER tersisa
    expect(statements.some((s) => /^DELIMITER\b/i.test(s))).toBe(false);

    // Pastikan tabel baru & index sudah ter-parse utuh
    const usersTable = statements.find((s) => s.startsWith('CREATE TABLE users'));
    expect(usersTable).toBeDefined();
    expect(usersTable).toContain('KEY ix_users_telepon (telepon,role)');

    const patTable = statements.find((s) =>
      s.startsWith('CREATE TABLE personal_access_tokens')
    );
    expect(patTable).toBeDefined();

    // Trigger harus utuh dalam 1 statement
    const triggerStmt = statements.find((s) =>
      s.startsWith('CREATE TRIGGER trg_jadwal_buat_kursi')
    );
    expect(triggerStmt).toBeDefined();
    expect(triggerStmt).toContain('INSERT INTO jadwal_kursi');
    expect(triggerStmt).toContain('END');

    // Semua 7 stored procedures harus utuh
    const expectedProcedures = [
      'internal_kunci_pemesanan',
      'internal_kedaluwarsa_jadwal',
      'sp_kedaluwarsa_jadwal',
      'sp_buat_pemesanan',
      'sp_ajukan_pembayaran',
      'sp_verifikasi_pembayaran',
      'sp_batalkan_pemesanan',
    ];
    for (const proc of expectedProcedures) {
      const found = statements.find((s) =>
        s.startsWith(`CREATE PROCEDURE ${proc}`)
      );
      expect(found, `Missing procedure ${proc}`).toBeDefined();
      expect(found).toContain('END');
    }

    // String berisi titik-koma di dalam INSERT tidak boleh terpotong
    const kotaDupStmt = statements.find((s) =>
      s.includes('Nama kota duplikat; dipetakan ke kota yang sama')
    );
    expect(kotaDupStmt).toBeDefined();
    expect(kotaDupStmt).toContain('"nm_kota_asal": "Pringsewu"');
  });
});
