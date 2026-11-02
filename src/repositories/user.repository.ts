import { pool } from '../config/database.js';
import { UserRow, UserRole } from '../types/db.types.js';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

export class UserRepository {
  async findById(id: number): Promise<UserRow | null> {
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM users WHERE id = ?',
      [id]
    );
    return (rows[0] as UserRow) || null;
  }

  async findByUsernameOrEmail(identifier: string): Promise<UserRow | null> {
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM users WHERE username = ? OR email = ? LIMIT 1',
      [identifier, identifier]
    );
    return (rows[0] as UserRow) || null;
  }

  async findMemberByPhone(phone: string): Promise<UserRow | null> {
    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT * FROM users WHERE telepon = ? AND role = 'member' LIMIT 1",
      [phone]
    );
    return (rows[0] as UserRow) || null;
  }

  async verifyLegacyAccount(username: string, phoneOrEmail: string): Promise<UserRow | null> {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT * FROM users 
       WHERE username = ? 
         AND (telepon = ? OR email = ?)
         AND wajib_reset_password = 1 
         AND password_hash IS NULL 
       LIMIT 1`,
      [username, phoneOrEmail, phoneOrEmail]
    );
    return (rows[0] as UserRow) || null;
  }

  async createMember(data: {
    username: string;
    nama: string;
    email?: string | null;
    telepon?: string | null;
    alamat?: string | null;
    jenis_kelamin?: 'L' | 'P' | null;
    password_hash: string | null;
    wajib_reset_password?: number;
  }): Promise<number> {
    const [res] = await pool.query<ResultSetHeader>(
      `INSERT INTO users (username, nama, email, telepon, alamat, jenis_kelamin, role, password_hash, wajib_reset_password, status_akun)
       VALUES (?, ?, ?, ?, ?, ?, 'member', ?, ?, 'aktif')`,
      [
        data.username,
        data.nama,
        data.email || null,
        data.telepon || null,
        data.alamat || null,
        data.jenis_kelamin || null,
        data.password_hash,
        data.wajib_reset_password ?? 0
      ]
    );
    return res.insertId;
  }

  async updatePassword(userId: number, passwordHash: string): Promise<boolean> {
    const [res] = await pool.query<ResultSetHeader>(
      'UPDATE users SET password_hash = ?, wajib_reset_password = 0 WHERE id = ?',
      [passwordHash, userId]
    );
    return res.affectedRows > 0;
  }

  async getAllUsers(roleFilter?: UserRole): Promise<UserRow[]> {
    let sql = 'SELECT id, username, email, nama, telepon, alamat, jenis_kelamin, role, wajib_reset_password, status_akun, dibuat_pada FROM users';
    const params: any[] = [];
    if (roleFilter) {
      sql += ' WHERE role = ?';
      params.push(roleFilter);
    }
    sql += ' ORDER BY id DESC';
    const [rows] = await pool.query<RowDataPacket[]>(sql, params);
    return rows as UserRow[];
  }
}

export const userRepository = new UserRepository();

