import path from 'path';
import { pathToFileURL } from 'url';
import { RowDataPacket, ResultSetHeader, PoolConnection } from 'mysql2/promise';
import { pool } from '../config/database.js';

const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const MIN_LEAD_TIME_MS = 2 * 60 * 60 * 1000;

interface IdRow extends RowDataPacket {
  id: number;
}

interface CoverageRow extends RowDataPacket {
  cnt: number;
  days_covered: number;
}

interface ExistingScheduleRow extends RowDataPacket {
  id_rute: number;
  id_kendaraan: number;
  berangkat_str: string;
}

export interface PlannedSchedule {
  id_rute: number;
  id_kendaraan: number;
  berangkat_pada: string;
  tiba_pada: string;
  harga: number;
}

interface RouteProfile {
  durationMinutes: number;
  harga: number;
}

const ROUTE_PROFILES: Record<number, RouteProfile> = {
  1: { durationMinutes: 300, harga: 110000 },
  2: { durationMinutes: 120, harga: 55000 },
  3: { durationMinutes: 150, harga: 65000 },
  4: { durationMinutes: 120, harga: 60000 },
  5: { durationMinutes: 120, harga: 55000 },
  6: { durationMinutes: 180, harga: 75000 },
};

const DEFAULT_ROUTE_PROFILE: RouteProfile = {
  durationMinutes: 180,
  harga: 75000,
};

const DAILY_WIB_SLOTS: ReadonlyArray<{ hour: number; minute: number }> = [
  { hour: 8, minute: 0 },
  { hour: 13, minute: 0 },
  { hour: 19, minute: 0 },
];

export function toWibMysqlDateTime(date: Date): string {
  const wib = new Date(date.getTime() + WIB_OFFSET_MS);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${wib.getUTCFullYear()}-${pad(wib.getUTCMonth() + 1)}-${pad(wib.getUTCDate())} ${pad(wib.getUTCHours())}:${pad(wib.getUTCMinutes())}:${pad(wib.getUTCSeconds())}`;
}

export function buildUpcomingSchedulePlan(
  now: Date,
  routeIds: number[],
  vehicleIds: number[],
  daysAhead = 60
): PlannedSchedule[] {
  if (routeIds.length === 0 || vehicleIds.length === 0 || daysAhead < 0) {
    return [];
  }

  const wibNow = new Date(now.getTime() + WIB_OFFSET_MS);
  const baseYear = wibNow.getUTCFullYear();
  const baseMonth = wibNow.getUTCMonth();
  const baseDay = wibNow.getUTCDate();
  const minDepartureMs = now.getTime() + MIN_LEAD_TIME_MS;

  const plan: PlannedSchedule[] = [];
  let slotCounter = 0;

  for (let dayOffset = 0; dayOffset <= daysAhead; dayOffset += 1) {
    for (const slot of DAILY_WIB_SLOTS) {
      const departureMs = Date.UTC(baseYear, baseMonth, baseDay + dayOffset, slot.hour, slot.minute, 0) - WIB_OFFSET_MS;
      if (departureMs < minDepartureMs) {
        slotCounter += 1;
        continue;
      }

      const routeId = routeIds[slotCounter % routeIds.length];
      const vehicleId = vehicleIds[slotCounter % vehicleIds.length];
      const profile = ROUTE_PROFILES[routeId] || DEFAULT_ROUTE_PROFILE;
      const arrivalMs = departureMs + profile.durationMinutes * 60 * 1000;

      plan.push({
        id_rute: routeId,
        id_kendaraan: vehicleId,
        berangkat_pada: toWibMysqlDateTime(new Date(departureMs)),
        tiba_pada: toWibMysqlDateTime(new Date(arrivalMs)),
        harga: profile.harga,
      });

      slotCounter += 1;
    }
  }

  return plan;
}

export async function ensureUpcomingSchedules(daysAhead = 60): Promise<number> {
  const minRequiredDays = Math.max(1, daysAhead - 5);
  const [coverageRows] = await pool.query<CoverageRow[]>(
    `SELECT COUNT(*) AS cnt,
            COALESCE(TIMESTAMPDIFF(DAY, NOW(), MAX(berangkat_pada)), 0) AS days_covered
     FROM jadwal
     WHERE status = 'dijadwalkan' AND berangkat_pada > NOW()`
  );

  const existingCount = Number(coverageRows[0]?.cnt ?? 0);
  const daysCovered = Number(coverageRows[0]?.days_covered ?? 0);
  if (existingCount > 0 && daysCovered >= minRequiredDays) {
    console.log(
      `[SeedSchedules] Jadwal aktif sudah tersedia (${existingCount} jadwal hingga +${daysCovered} hari). Dilewati.`
    );
    return 0;
  }

  const [vehicles] = await pool.query<IdRow[]>(
    `SELECT id FROM kendaraan WHERE status = 'aktif' ORDER BY id ASC`
  );
  const [routes] = await pool.query<IdRow[]>(
    `SELECT id FROM rute WHERE aktif = 1 ORDER BY id ASC`
  );

  if (vehicles.length === 0 || routes.length === 0) {
    console.warn('[SeedSchedules] Tidak ditemukan kendaraan atau rute aktif. Seeding dilewati.');
    return 0;
  }

  const now = new Date();
  const plan = buildUpcomingSchedulePlan(
    now,
    routes.map((r) => r.id),
    vehicles.map((v) => v.id),
    daysAhead
  );

  if (plan.length === 0) {
    return 0;
  }

  const windowStart = toWibMysqlDateTime(new Date(now.getTime() - DAY_MS));
  const [existingRows] = await pool.query<ExistingScheduleRow[]>(
    `SELECT id_rute, id_kendaraan, DATE_FORMAT(berangkat_pada, '%Y-%m-%d %H:%i:%s') AS berangkat_str
     FROM jadwal
     WHERE berangkat_pada >= ?`,
    [windowStart]
  );

  const existingKeys = new Set(
    existingRows.map((row) => `${row.id_rute}:${row.id_kendaraan}:${row.berangkat_str}`)
  );

  const pending = plan.filter(
    (item) => !existingKeys.has(`${item.id_rute}:${item.id_kendaraan}:${item.berangkat_pada}`)
  );

  if (pending.length === 0) {
    console.log('[SeedSchedules] Semua slot jadwal hingga 2 bulan ke depan sudah ada.');
    return 0;
  }

  const connection: PoolConnection = await pool.getConnection();
  let insertedCount = 0;

  try {
    await connection.beginTransaction();

    for (const item of pending) {
      const [result] = await connection.query<ResultSetHeader>(
        `INSERT INTO jadwal (id_rute, id_kendaraan, berangkat_pada, tiba_pada, harga, status)
         VALUES (?, ?, ?, ?, ?, 'dijadwalkan')`,
        [item.id_rute, item.id_kendaraan, item.berangkat_pada, item.tiba_pada, item.harga]
      );
      if (result.affectedRows > 0) {
        insertedCount += 1;
      }
    }

    await connection.commit();
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }

  console.log(
    `[SeedSchedules] Berhasil menambahkan ${insertedCount} jadwal keberangkatan untuk ${daysAhead} hari ke depan.`
  );
  return insertedCount;
}

const isDirectRun =
  process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isDirectRun) {
  ensureUpcomingSchedules(60)
    .then(async () => {
      await pool.end();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error('[SeedSchedules] Gagal membuat jadwal:', err);
      await pool.end();
      process.exit(1);
    });
}
