import { pool } from '../config/database.js';
import { KeluhanRow, KeluhanStatus } from '../types/db.types.js';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

export class KeluhanRepository {
  async submitComplaint(
    userId: number,
    orderId: number | null,
    judul: string,
    isi: string
  ): Promise<number> {
    const [res] = await pool.query<ResultSetHeader>(
      `INSERT INTO keluhan (id_user, id_pemesanan, judul, isi, status)
       VALUES (?, ?, ?, ?, 'baru')`,
      [userId, orderId, judul, isi]
    );
    return res.insertId;
  }

  async getComplaintsByMember(userId: number): Promise<KeluhanRow[]> {
    const sql = `
      SELECT k.*, p.kode_booking
      FROM keluhan k
      LEFT JOIN pemesanan p ON p.id = k.id_pemesanan
      WHERE k.id_user = ?
      ORDER BY k.dibuat_pada DESC
    `;
    const [rows] = await pool.query<RowDataPacket[]>(sql, [userId]);
    return rows as KeluhanRow[];
  }

  async getAllComplaints(): Promise<KeluhanRow[]> {
    const sql = `
      SELECT k.*, u.nama AS nama_pelapor, u.email AS email_pelapor,
             petugas.nama AS nama_petugas, p.kode_booking
      FROM keluhan k
      JOIN users u ON u.id = k.id_user
      LEFT JOIN users petugas ON petugas.id = k.ditangani_oleh
      LEFT JOIN pemesanan p ON p.id = k.id_pemesanan
      ORDER BY 
        CASE WHEN k.status = 'baru' THEN 1 
             WHEN k.status = 'diproses' THEN 2 
             ELSE 3 END,
        k.dibuat_pada DESC
    `;
    const [rows] = await pool.query<RowDataPacket[]>(sql);
    return rows as KeluhanRow[];
  }

  async getComplaintById(id: number): Promise<KeluhanRow | null> {
    const sql = `
      SELECT k.*, u.nama AS nama_pelapor, u.email AS email_pelapor,
             petugas.nama AS nama_petugas, p.kode_booking
      FROM keluhan k
      JOIN users u ON u.id = k.id_user
      LEFT JOIN users petugas ON petugas.id = k.ditangani_oleh
      LEFT JOIN pemesanan p ON p.id = k.id_pemesanan
      WHERE k.id = ?
    `;
    const [rows] = await pool.query<RowDataPacket[]>(sql, [id]);
    return (rows[0] as KeluhanRow) || null;
  }

  async respondToComplaint(
    id: number,
    tanggapan: string,
    adminUserId: number,
    status: KeluhanStatus = 'selesai'
  ): Promise<boolean> {
    const [res] = await pool.query<ResultSetHeader>(
      `UPDATE keluhan 
       SET tanggapan = ?, ditangani_oleh = ?, status = ?,
           selesai_pada = CASE WHEN ? = 'selesai' THEN NOW() ELSE NULL END
       WHERE id = ?`,
      [tanggapan, adminUserId, status, status, id]
    );
    return res.affectedRows > 0;
  }
}

export const keluhanRepository = new KeluhanRepository();
