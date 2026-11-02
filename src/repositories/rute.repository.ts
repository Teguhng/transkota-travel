import { pool } from '../config/database.js';
import { KotaRow, RuteRow } from '../types/db.types.js';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

export class RuteRepository {
  async getAllCities(): Promise<KotaRow[]> {
    const [rows] = await pool.query<RowDataPacket[]>('SELECT * FROM kota ORDER BY nama ASC');
    return rows as KotaRow[];
  }

  async getCityById(id: number): Promise<KotaRow | null> {
    const [rows] = await pool.query<RowDataPacket[]>('SELECT * FROM kota WHERE id = ?', [id]);
    return (rows[0] as KotaRow) || null;
  }

  async createCity(nama: string): Promise<number> {
    const [res] = await pool.query<ResultSetHeader>('INSERT INTO kota (nama) VALUES (?)', [nama]);
    return res.insertId;
  }

  async getAllRoutes(): Promise<RuteRow[]> {
    const sql = `
      SELECT r.id, r.id_kota_asal, r.id_kota_tujuan, r.aktif,
             ka.nama AS kota_asal, kt.nama AS kota_tujuan
      FROM rute r
      JOIN kota ka ON ka.id = r.id_kota_asal
      JOIN kota kt ON kt.id = r.id_kota_tujuan
      ORDER BY ka.nama ASC, kt.nama ASC
    `;
    const [rows] = await pool.query<RowDataPacket[]>(sql);
    return rows as RuteRow[];
  }

  async getRouteById(id: number): Promise<RuteRow | null> {
    const sql = `
      SELECT r.id, r.id_kota_asal, r.id_kota_tujuan, r.aktif,
             ka.nama AS kota_asal, kt.nama AS kota_tujuan
      FROM rute r
      JOIN kota ka ON ka.id = r.id_kota_asal
      JOIN kota kt ON kt.id = r.id_kota_tujuan
      WHERE r.id = ?
    `;
    const [rows] = await pool.query<RowDataPacket[]>(sql, [id]);
    return (rows[0] as RuteRow) || null;
  }

  async createRoute(idKotaAsal: number, idKotaTujuan: number): Promise<number> {
    const [res] = await pool.query<ResultSetHeader>(
      'INSERT INTO rute (id_kota_asal, id_kota_tujuan, aktif) VALUES (?, ?, 1)',
      [idKotaAsal, idKotaTujuan]
    );
    return res.insertId;
  }

  async toggleRouteStatus(id: number, aktif: boolean): Promise<boolean> {
    const [res] = await pool.query<ResultSetHeader>(
      'UPDATE rute SET aktif = ? WHERE id = ?',
      [aktif ? 1 : 0, id]
    );
    return res.affectedRows > 0;
  }
}

export const ruteRepository = new RuteRepository();

