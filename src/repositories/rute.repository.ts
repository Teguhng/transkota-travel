import { pool } from '../config/database.js';
import { KotaRow, RuteRow } from '../types/db.types.js';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

interface CacheBucket<T> {
  data: T[];
  expiresAt: number;
}

const REFERENCE_TTL_BASE_MS = 60_000;
const REFERENCE_TTL_JITTER_MS = 15_000;

export class RuteRepository {
  private citiesCache: CacheBucket<KotaRow> | null = null;
  private routesCache: CacheBucket<RuteRow> | null = null;
  private citiesInFlight: Promise<KotaRow[]> | null = null;
  private routesInFlight: Promise<RuteRow[]> | null = null;
  private cacheVersion = 0;

  private nextExpiry(): number {
    return (
      Date.now() +
      REFERENCE_TTL_BASE_MS +
      Math.floor(Math.random() * REFERENCE_TTL_JITTER_MS)
    );
  }

  invalidateCache(): void {
    this.cacheVersion += 1;
    this.citiesCache = null;
    this.routesCache = null;
  }

  async getAllCities(): Promise<KotaRow[]> {
    const now = Date.now();
    if (this.citiesCache && this.citiesCache.expiresAt > now) {
      return [...this.citiesCache.data];
    }

    if (this.citiesInFlight) {
      return [...(await this.citiesInFlight)];
    }

    const startVersion = this.cacheVersion;
    this.citiesInFlight = pool
      .query<RowDataPacket[]>('SELECT * FROM kota ORDER BY nama ASC')
      .then(([rows]) => {
        const result = rows as KotaRow[];
        if (this.cacheVersion === startVersion) {
          this.citiesCache = { data: result, expiresAt: this.nextExpiry() };
        }
        return result;
      })
      .finally(() => {
        this.citiesInFlight = null;
      });

    return [...(await this.citiesInFlight)];
  }

  async getCityById(id: number): Promise<KotaRow | null> {
    const [rows] = await pool.query<RowDataPacket[]>('SELECT * FROM kota WHERE id = ?', [id]);
    return (rows[0] as KotaRow) || null;
  }

  async createCity(nama: string): Promise<number> {
    const [res] = await pool.query<ResultSetHeader>('INSERT INTO kota (nama) VALUES (?)', [nama]);
    this.invalidateCache();
    return res.insertId;
  }

  async getAllRoutes(): Promise<RuteRow[]> {
    const now = Date.now();
    if (this.routesCache && this.routesCache.expiresAt > now) {
      return [...this.routesCache.data];
    }

    if (this.routesInFlight) {
      return [...(await this.routesInFlight)];
    }

    const startVersion = this.cacheVersion;
    const sql = `
      SELECT r.id, r.id_kota_asal, r.id_kota_tujuan, r.aktif,
             ka.nama AS kota_asal, kt.nama AS kota_tujuan
      FROM rute r
      JOIN kota ka ON ka.id = r.id_kota_asal
      JOIN kota kt ON kt.id = r.id_kota_tujuan
      ORDER BY ka.nama ASC, kt.nama ASC
    `;

    this.routesInFlight = pool
      .query<RowDataPacket[]>(sql)
      .then(([rows]) => {
        const result = rows as RuteRow[];
        if (this.cacheVersion === startVersion) {
          this.routesCache = { data: result, expiresAt: this.nextExpiry() };
        }
        return result;
      })
      .finally(() => {
        this.routesInFlight = null;
      });

    return [...(await this.routesInFlight)];
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
    this.invalidateCache();
    return res.insertId;
  }

  async toggleRouteStatus(id: number, aktif: boolean): Promise<boolean> {
    const [res] = await pool.query<ResultSetHeader>(
      'UPDATE rute SET aktif = ? WHERE id = ?',
      [aktif ? 1 : 0, id]
    );
    this.invalidateCache();
    return res.affectedRows > 0;
  }
}

export const ruteRepository = new RuteRepository();

