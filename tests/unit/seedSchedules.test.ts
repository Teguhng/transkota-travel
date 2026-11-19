import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockQuery = vi.fn();
const mockConnectionQuery = vi.fn();
const mockBeginTransaction = vi.fn();
const mockCommit = vi.fn();
const mockRollback = vi.fn();
const mockRelease = vi.fn();
const mockGetConnection = vi.fn();

vi.mock('../../src/config/database.js', () => ({
  pool: {
    query: (...args: unknown[]) => mockQuery(...args),
    getConnection: (...args: unknown[]) => mockGetConnection(...args),
    end: vi.fn(),
  },
}));

import {
  toWibMysqlDateTime,
  buildUpcomingSchedulePlan,
  ensureUpcomingSchedules,
} from '../../src/scripts/seedDemoSchedules.js';

describe('seedDemoSchedules', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBeginTransaction.mockResolvedValue(undefined);
    mockCommit.mockResolvedValue(undefined);
    mockRollback.mockResolvedValue(undefined);
    mockRelease.mockReturnValue(undefined);
    mockConnectionQuery.mockResolvedValue([{ affectedRows: 1 }, []]);
    mockGetConnection.mockResolvedValue({
      query: mockConnectionQuery,
      beginTransaction: mockBeginTransaction,
      commit: mockCommit,
      rollback: mockRollback,
      release: mockRelease,
    });
  });

  it('memformat datetime dalam zona waktu WIB (+07:00) terlepas dari timezone OS', () => {
    // 2026-11-19T01:00:00Z == 2026-11-19 08:00:00 WIB
    const utcInstant = new Date(Date.UTC(2026, 10, 19, 1, 0, 0));
    expect(toWibMysqlDateTime(utcInstant)).toBe('2026-11-19 08:00:00');

    // Pergantian tanggal di WIB: 2026-11-19T18:30:00Z == 2026-11-20 01:30:00 WIB
    const lateUtc = new Date(Date.UTC(2026, 10, 19, 18, 30, 0));
    expect(toWibMysqlDateTime(lateUtc)).toBe('2026-11-20 01:30:00');
  });

  it('membuat rencana jadwal dari hari ini hingga 60 hari ke depan tanpa bentrok armada', () => {
    // 2026-11-19 05:00:00 WIB (2026-11-18T22:00:00Z)
    const now = new Date(Date.UTC(2026, 10, 18, 22, 0, 0));
    const routeIds = [1, 2, 3, 4, 5, 6];
    const vehicleIds = [1, 2];

    const plan = buildUpcomingSchedulePlan(now, routeIds, vehicleIds, 60);

    // 61 hari * 3 slot = 183 slot total; slot 08:00, 13:00, 19:00 di hari ke-0 semua >= +2 jam (07:00 WIB)
    expect(plan.length).toBe(183);

    // Pastikan jadwal pertama masih hari ini dan terakhir tepat 60 hari ke depan (2027-01-18)
    expect(plan[0].berangkat_pada).toBe('2026-11-19 08:00:00');
    expect(plan[plan.length - 1].berangkat_pada).toBe('2027-01-18 19:00:00');

    // Semua 6 rute tercakup
    const coveredRoutes = new Set(plan.map((item) => item.id_rute));
    expect(coveredRoutes.size).toBe(6);

    // Tidak ada armada yang dipakai dua kali pada jam keberangkatan yang persis sama
    const vehicleSlotKeys = new Set(plan.map((item) => `${item.id_kendaraan}:${item.berangkat_pada}`));
    expect(vehicleSlotKeys.size).toBe(plan.length);

    // Tiba harus selalu lebih besar dari berangkat
    for (const item of plan) {
      expect(item.tiba_pada > item.berangkat_pada).toBe(true);
      expect(item.harga).toBeGreaterThan(0);
    }
  });

  it('melewati seeding ketika cakupan jadwal 2 bulan sudah tersedia', async () => {
    mockQuery.mockResolvedValueOnce([[{ cnt: 180, days_covered: 60 }], []]);

    const inserted = await ensureUpcomingSchedules(60);

    expect(inserted).toBe(0);
    expect(mockQuery).toHaveBeenCalledTimes(1);
    expect(mockGetConnection).not.toHaveBeenCalled();
  });

  it('mengisi jadwal yang belum ada secara idempoten dalam transaksi', async () => {
    mockQuery
      .mockResolvedValueOnce([[{ cnt: 0, days_covered: 0 }], []]) // coverage check
      .mockResolvedValueOnce([[{ id: 1 }, { id: 2 }], []]) // kendaraan aktif
      .mockResolvedValueOnce([[{ id: 1 }, { id: 2 }, { id: 3 }], []]) // rute aktif
      .mockResolvedValueOnce([[], []]); // existing window

    const inserted = await ensureUpcomingSchedules(10);

    expect(inserted).toBeGreaterThanOrEqual(30);
    expect(mockBeginTransaction).toHaveBeenCalledTimes(1);
    expect(mockConnectionQuery).toHaveBeenCalledTimes(inserted);
    expect(mockCommit).toHaveBeenCalledTimes(1);
    expect(mockRelease).toHaveBeenCalledTimes(1);
  });
});
