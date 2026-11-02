import { pool } from '../config/database.js';
import { PemesananRow, DetailPemesananRow } from '../types/db.types.js';
import { RowDataPacket } from 'mysql2';

export class PemesananRepository {
  async createBooking(
    userId: number,
    jadwalId: number,
    passengersJson: string
  ): Promise<{
    id_pemesanan: number;
    kode_booking: string;
    total: number;
    jatuh_tempo: Date;
  }> {
    const [result] = await pool.query<any>('CALL sp_buat_pemesanan(?, ?, ?)', [
      userId,
      jadwalId,
      passengersJson
    ]);

    // Format output sp_buat_pemesanan mengembalikan result set baris pertama
    const created = result[0][0];
    return {
      id_pemesanan: Number(created.id_pemesanan),
      kode_booking: created.kode_booking,
      total: Number(created.total),
      jatuh_tempo: new Date(created.jatuh_tempo)
    };
  }

  async cancelBooking(orderId: number, userId: number, reason: string): Promise<void> {
    await pool.query('CALL sp_batalkan_pemesanan(?, ?, ?)', [orderId, userId, reason]);
  }

  async getBookingByCode(code: string): Promise<(PemesananRow & { details: DetailPemesananRow[] }) | null> {
    const sqlOrder = `
      SELECT p.*, u.nama AS nama_pemesan, u.telepon AS telepon_pemesan,
             j.berangkat_pada, j.harga AS harga_jadwal,
             ka.nama AS kota_asal, kt.nama AS kota_tujuan,
             k.jenis AS jenis_kendaraan, k.nomor_polisi
      FROM pemesanan p
      JOIN users u ON u.id = p.id_pemesan
      JOIN jadwal j ON j.id = p.id_jadwal
      JOIN rute r ON r.id = j.id_rute
      JOIN kota ka ON ka.id = r.id_kota_asal
      JOIN kota kt ON kt.id = r.id_kota_tujuan
      JOIN kendaraan k ON k.id = j.id_kendaraan
      WHERE p.kode_booking = ?
      LIMIT 1
    `;
    const [orderRows] = await pool.query<RowDataPacket[]>(sqlOrder, [code]);
    if (!orderRows.length) return null;

    const order = orderRows[0] as PemesananRow;

    // Ambil detail kursi penumpang
    const sqlDetails = `
      SELECT d.*, kk.nomor AS nomor_kursi
      FROM detail_pemesanan d
      JOIN jadwal_kursi jk ON jk.id = d.id_jadwal_kursi
      JOIN kursi_kendaraan kk ON kk.id = jk.id_kursi
      WHERE d.id_pemesanan = ?
      ORDER BY kk.urutan ASC
    `;
    const [detailRows] = await pool.query<RowDataPacket[]>(sqlDetails, [order.id]);

    return {
      ...order,
      details: detailRows as DetailPemesananRow[]
    };
  }

  async getBookingById(id: number): Promise<PemesananRow | null> {
    const [rows] = await pool.query<RowDataPacket[]>('SELECT * FROM pemesanan WHERE id = ?', [id]);
    return (rows[0] as PemesananRow) || null;
  }

  async getMemberBookings(userId: number): Promise<PemesananRow[]> {
    const sql = `
      SELECT p.*, j.berangkat_pada, ka.nama AS kota_asal, kt.nama AS kota_tujuan, k.nomor_polisi
      FROM pemesanan p
      JOIN jadwal j ON j.id = p.id_jadwal
      JOIN rute r ON r.id = j.id_rute
      JOIN kota ka ON ka.id = r.id_kota_asal
      JOIN kota kt ON kt.id = r.id_kota_tujuan
      JOIN kendaraan k ON k.id = j.id_kendaraan
      WHERE p.id_pemesan = ?
      ORDER BY p.dibuat_pada DESC
    `;
    const [rows] = await pool.query<RowDataPacket[]>(sql, [userId]);
    return rows as PemesananRow[];
  }

  async getAllBookings(statusFilter?: string): Promise<PemesananRow[]> {
    let sql = `
      SELECT p.*, u.nama AS nama_pemesan, u.telepon AS telepon_pemesan,
             j.berangkat_pada, ka.nama AS kota_asal, kt.nama AS kota_tujuan, k.nomor_polisi
      FROM pemesanan p
      JOIN users u ON u.id = p.id_pemesan
      JOIN jadwal j ON j.id = p.id_jadwal
      JOIN rute r ON r.id = j.id_rute
      JOIN kota ka ON ka.id = r.id_kota_asal
      JOIN kota kt ON kt.id = r.id_kota_tujuan
      JOIN kendaraan k ON k.id = j.id_kendaraan
    `;
    const params: any[] = [];
    if (statusFilter) {
      sql += ' WHERE p.status = ?';
      params.push(statusFilter);
    }
    sql += ' ORDER BY p.dibuat_pada DESC LIMIT 100';
    const [rows] = await pool.query<RowDataPacket[]>(sql, params);
    return rows as PemesananRow[];
  }
}

export const pemesananRepository = new PemesananRepository();

