import { pool } from '../config/database.js';
import { JadwalRow, JadwalKursiRow } from '../types/db.types.js';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

export class JadwalRepository {
  async getActiveSchedules(
    originCityId?: number,
    destCityId?: number,
    dateStr?: string
  ): Promise<JadwalRow[]> {
    let sql = `
      SELECT j.id, j.id_rute, j.id_kendaraan, j.berangkat_pada, j.tiba_pada, j.harga, j.status,
             ka.id AS id_kota_asal, ka.nama AS kota_asal,
             kt.id AS id_kota_tujuan, kt.nama AS kota_tujuan,
             k.jenis AS nama_kendaraan, k.nomor_polisi,
             COUNT(CASE WHEN s.status = 'tersedia' THEN 1 END) AS kursi_tersedia
      FROM jadwal j
      JOIN rute r ON r.id = j.id_rute
      JOIN kota ka ON ka.id = r.id_kota_asal
      JOIN kota kt ON kt.id = r.id_kota_tujuan
      JOIN kendaraan k ON k.id = j.id_kendaraan
      LEFT JOIN jadwal_kursi s ON s.id_jadwal = j.id
      WHERE j.status = 'dijadwalkan'
        AND j.berangkat_pada > NOW()
    `;
    const params: any[] = [];

    if (originCityId) {
      sql += ' AND r.id_kota_asal = ?';
      params.push(originCityId);
    }
    if (destCityId) {
      sql += ' AND r.id_kota_tujuan = ?';
      params.push(destCityId);
    }
    if (dateStr) {
      sql += ' AND DATE(j.berangkat_pada) = ?';
      params.push(dateStr);
    }

    sql += `
      GROUP BY j.id
      ORDER BY j.berangkat_pada ASC
    `;

    const [rows] = await pool.query<RowDataPacket[]>(sql, params);
    return rows as JadwalRow[];
  }

  async getAllSchedulesAdmin(): Promise<JadwalRow[]> {
    const sql = `
      SELECT j.id, j.id_rute, j.id_kendaraan, j.berangkat_pada, j.tiba_pada, j.harga, j.status,
             ka.nama AS kota_asal, kt.nama AS kota_tujuan,
             k.jenis AS nama_kendaraan, k.nomor_polisi,
             COUNT(CASE WHEN s.status = 'tersedia' THEN 1 END) AS kursi_tersedia
      FROM jadwal j
      JOIN rute r ON r.id = j.id_rute
      JOIN kota ka ON ka.id = r.id_kota_asal
      JOIN kota kt ON kt.id = r.id_kota_tujuan
      JOIN kendaraan k ON k.id = j.id_kendaraan
      LEFT JOIN jadwal_kursi s ON s.id_jadwal = j.id
      GROUP BY j.id
      ORDER BY j.berangkat_pada DESC
    `;
    const [rows] = await pool.query<RowDataPacket[]>(sql);
    return rows as JadwalRow[];
  }

  async getScheduleById(id: number): Promise<JadwalRow | null> {
    const sql = `
      SELECT j.id, j.id_rute, j.id_kendaraan, j.berangkat_pada, j.tiba_pada, j.harga, j.status,
             ka.nama AS kota_asal, kt.nama AS kota_tujuan,
             k.jenis AS nama_kendaraan, k.nomor_polisi,
             COUNT(CASE WHEN s.status = 'tersedia' THEN 1 END) AS kursi_tersedia
      FROM jadwal j
      JOIN rute r ON r.id = j.id_rute
      JOIN kota ka ON ka.id = r.id_kota_asal
      JOIN kota kt ON kt.id = r.id_kota_tujuan
      JOIN kendaraan k ON k.id = j.id_kendaraan
      LEFT JOIN jadwal_kursi s ON s.id_jadwal = j.id
      WHERE j.id = ?
      GROUP BY j.id
    `;
    const [rows] = await pool.query<RowDataPacket[]>(sql, [id]);
    return (rows[0] as JadwalRow) || null;
  }

  async getScheduleSeats(jadwalId: number): Promise<JadwalKursiRow[]> {
    const sql = `
      SELECT s.id, s.id_jadwal, s.id_kendaraan, s.id_kursi, s.status, s.ditahan_sampai,
             k.nomor, k.urutan
      FROM jadwal_kursi s
      JOIN kursi_kendaraan k ON k.id = s.id_kursi
      WHERE s.id_jadwal = ?
      ORDER BY k.urutan ASC
    `;
    const [rows] = await pool.query<RowDataPacket[]>(sql, [jadwalId]);
    return rows as JadwalKursiRow[];
  }

  async releaseExpiredHolds(jadwalId: number): Promise<void> {
    await pool.query('CALL sp_kedaluwarsa_jadwal(?)', [jadwalId]);
  }

  async findSchedulesWithExpiredHolds(): Promise<number[]> {
    const sql = `
      SELECT DISTINCT p.id_jadwal
      FROM pemesanan p
      JOIN jadwal j ON j.id = p.id_jadwal
      WHERE p.status = 'menunggu_pembayaran'
        AND p.jatuh_tempo <= NOW()
        AND j.berangkat_pada >= NOW() - INTERVAL 1 DAY
    `;
    const [rows] = await pool.query<RowDataPacket[]>(sql);
    return rows.map((r: any) => Number(r.id_jadwal));
  }

  async createSchedule(data: {
    id_rute: number;
    id_kendaraan: number;
    berangkat_pada: string;
    tiba_pada?: string | null;
    harga: number;
  }): Promise<number> {
    // Trigger trg_jadwal_buat_kursi otomatis mengalokasikan 5 kursi
    const [res] = await pool.query<ResultSetHeader>(
      `INSERT INTO jadwal (id_rute, id_kendaraan, berangkat_pada, tiba_pada, harga, status)
       VALUES (?, ?, ?, ?, ?, 'dijadwalkan')`,
      [
        data.id_rute,
        data.id_kendaraan,
        data.berangkat_pada,
        data.tiba_pada || null,
        data.harga
      ]
    );
    return res.insertId;
  }

  async updateScheduleStatus(id: number, status: string): Promise<boolean> {
    const [res] = await pool.query<ResultSetHeader>(
      'UPDATE jadwal SET status = ? WHERE id = ?',
      [status, id]
    );
    return res.affectedRows > 0;
  }
}

export const jadwalRepository = new JadwalRepository();

