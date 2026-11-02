import { pool } from '../config/database.js';
import { KendaraanRow, KursiKendaraanRow } from '../types/db.types.js';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

export class KendaraanRepository {
  async getAllVehicles(): Promise<(KendaraanRow & { kapasitas?: number })[]> {
    const sql = `
      SELECT k.*, COUNT(s.id) AS kapasitas
      FROM kendaraan k
      LEFT JOIN kursi_kendaraan s ON s.id_kendaraan = k.id AND s.aktif = 1
      GROUP BY k.id
      ORDER BY k.id DESC
    `;
    const [rows] = await pool.query<RowDataPacket[]>(sql);
    return rows as (KendaraanRow & { kapasitas?: number })[];
  }

  async getVehicleById(id: number): Promise<KendaraanRow | null> {
    const [rows] = await pool.query<RowDataPacket[]>('SELECT * FROM kendaraan WHERE id = ?', [id]);
    return (rows[0] as KendaraanRow) || null;
  }

  async createVehicle(jenis: string, nomorPolisi: string, warna: string | null): Promise<number> {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const [res] = await conn.query<ResultSetHeader>(
        'INSERT INTO kendaraan (jenis, nomor_polisi, warna, status) VALUES (?, ?, ?, "aktif")',
        [jenis, nomorPolisi, warna]
      );
      const vehicleId = res.insertId;

      // Buat default 5 kursi minibus
      const seatQueries = [
        [vehicleId, '1', 1],
        [vehicleId, '2', 2],
        [vehicleId, '3', 3],
        [vehicleId, '4', 4],
        [vehicleId, '5', 5]
      ];
      for (const [vId, no, seq] of seatQueries) {
        await conn.query(
          'INSERT INTO kursi_kendaraan (id_kendaraan, nomor, urutan, aktif) VALUES (?, ?, ?, 1)',
          [vId, no, seq]
        );
      }

      await conn.commit();
      return vehicleId;
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }

  async updateVehicleStatus(id: number, status: 'aktif' | 'perawatan' | 'nonaktif'): Promise<boolean> {
    const [res] = await pool.query<ResultSetHeader>(
      'UPDATE kendaraan SET status = ? WHERE id = ?',
      [status, id]
    );
    return res.affectedRows > 0;
  }

  async getVehicleSeats(vehicleId: number): Promise<KursiKendaraanRow[]> {
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM kursi_kendaraan WHERE id_kendaraan = ? AND aktif = 1 ORDER BY urutan ASC',
      [vehicleId]
    );
    return rows as KursiKendaraanRow[];
  }
}

export const kendaraanRepository = new KendaraanRepository();

