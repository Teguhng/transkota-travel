import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import zlib from 'zlib';
import { pool } from '../../src/config/database.js';
import { adminService } from '../../src/services/admin.service.js';
import { jadwalRepository } from '../../src/repositories/jadwal.repository.js';
import { ruteRepository } from '../../src/repositories/rute.repository.js';
import { csrfMiddleware } from '../../src/middlewares/csrf.middleware.js';
import { compressionMiddleware } from '../../src/middlewares/compression.middleware.js';

function createMockRes() {
  const headers: Record<string, string> = {};
  const res: any = {
    statusCode: 200,
    headersSent: false,
    body: undefined as unknown,
    redirectUrl: undefined as string | undefined,
    locals: {},
    setHeader(key: string, val: string) {
      headers[key.toLowerCase()] = val;
      return this;
    },
    getHeader(key: string) {
      return headers[key.toLowerCase()];
    },
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    redirect(url: string) {
      this.redirectUrl = url;
      return this;
    },
    send(payload?: unknown) {
      this.body = payload;
      return this;
    },
  };
  return res as Response & {
    statusCode: number;
    body: any;
    redirectUrl?: string;
  };
}

describe('Railway Cost & Correctness Optimizations Unit Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    ruteRepository.invalidateCache();
  });

  describe('AdminService.getDashboardMetrics', () => {
    it('should query status IN ("baru", "diproses") instead of "diajukan" and aggregate parallel results', async () => {
      const capturedSql: string[] = [];
      const querySpy = vi.spyOn(pool, 'query').mockImplementation((async (sql: string) => {
        capturedSql.push(sql);
        if (sql.includes('total_revenue')) return [[{ total_revenue: '500000' }], []];
        if (sql.includes('today_bookings')) return [[{ today_bookings: 4 }], []];
        if (sql.includes('active_schedules')) return [[{ active_schedules: 6 }], []];
        if (sql.includes('pending_complaints')) return [[{ pending_complaints: 3 }], []];
        if (sql.includes('GROUP BY r.id')) return [[{ kota_asal: 'Bandar Lampung', kota_tujuan: 'Metro', total_booking: 10 }], []];
        return [[{ kode_booking: 'TKT-1' }], []];
      }) as any);

      const metrics = await adminService.getDashboardMetrics();

      expect(querySpy).toHaveBeenCalledTimes(6);
      const complaintQuery = capturedSql.find((s) => s.includes('pending_complaints')) || '';
      expect(complaintQuery).toContain("'baru'");
      expect(complaintQuery).toContain("'diproses'");
      expect(complaintQuery).not.toContain('diajukan');

      expect(metrics.totalRevenue).toBe(500000);
      expect(metrics.todayBookings).toBe(4);
      expect(metrics.activeSchedulesCount).toBe(6);
      expect(metrics.pendingComplaintsCount).toBe(3);
      expect(metrics.topRoutes).toHaveLength(1);
      expect(metrics.recentBookings).toHaveLength(1);
    });
  });

  describe('JadwalRepository query optimization & expiry scope', () => {
    it('should use sargable date range instead of DATE(j.berangkat_pada) and apply LIMIT 100', async () => {
      const querySpy = vi.spyOn(pool, 'query').mockResolvedValue([[], []] as any);

      await jadwalRepository.getActiveSchedules(1, 2, '2026-11-20');

      const [sql, params] = querySpy.mock.calls[0] as [string, unknown[]];
      expect(sql).not.toContain('DATE(j.berangkat_pada)');
      expect(sql).toContain('j.berangkat_pada >= ? AND j.berangkat_pada < DATE_ADD(?, INTERVAL 1 DAY)');
      expect(sql).toContain('LIMIT 100');
      expect(params).toEqual([1, 2, '2026-11-20', '2026-11-20']);
    });

    it('should include menunggu_verifikasi in findSchedulesWithExpiredHolds', async () => {
      const querySpy = vi
        .spyOn(pool, 'query')
        .mockResolvedValue([[{ id_jadwal: '12' }], []] as any);

      const ids = await jadwalRepository.findSchedulesWithExpiredHolds();

      const [sql] = querySpy.mock.calls[0] as [string];
      expect(sql).toContain("'menunggu_pembayaran'");
      expect(sql).toContain("'menunggu_verifikasi'");
      expect(ids).toEqual([12]);
    });
  });

  describe('RuteRepository singleflight cache & invalidation', () => {
    it('should coalesce concurrent getAllCities calls into 1 query, hit cache, and invalidate on createCity', async () => {
      let resolveQuery!: (val: any) => void;
      const querySpy = vi.spyOn(pool, 'query').mockImplementation((() => {
        return new Promise((resolve) => {
          resolveQuery = resolve;
        });
      }) as any);

      // 2 panggilan paralel saat cache kosong hanya boleh memicu 1 query DB (singleflight)
      const p1 = ruteRepository.getAllCities();
      const p2 = ruteRepository.getAllCities();
      expect(querySpy).toHaveBeenCalledTimes(1);

      resolveQuery([[{ id: 1, nama: 'Bandar Lampung' }], []]);
      const [c1, c2] = await Promise.all([p1, p2]);
      expect(c1).toEqual([{ id: 1, nama: 'Bandar Lampung' }]);
      expect(c2).toEqual([{ id: 1, nama: 'Bandar Lampung' }]);

      // Panggilan ketiga memakai cache
      const c3 = await ruteRepository.getAllCities();
      expect(c3).toHaveLength(1);
      expect(querySpy).toHaveBeenCalledTimes(1);

      // Mutasi harus meng-invalidate cache
      querySpy.mockResolvedValueOnce([{ insertId: 2 }, []] as any);
      await ruteRepository.createCity('Metro');

      querySpy.mockResolvedValueOnce([
        [
          { id: 1, nama: 'Bandar Lampung' },
          { id: 2, nama: 'Metro' },
        ],
        [],
      ] as any);
      const c4 = await ruteRepository.getAllCities();
      expect(c4).toHaveLength(2);
      expect(querySpy).toHaveBeenCalledTimes(3);
    });
  });

  describe('csrfMiddleware session-write prevention', () => {
    it('should not mutate req.session on /api/* or anonymous GET / and GET /jadwal', () => {
      const anonHomeSession: Record<string, any> = {};
      csrfMiddleware(
        {
          session: anonHomeSession,
          method: 'GET',
          path: '/',
          originalUrl: '/',
          headers: {},
        } as unknown as Request,
        createMockRes(),
        vi.fn() as NextFunction
      );
      expect(anonHomeSession.csrfToken).toBeUndefined();

      const anonScheduleSession: Record<string, any> = {};
      csrfMiddleware(
        {
          session: anonScheduleSession,
          method: 'GET',
          path: '/jadwal',
          originalUrl: '/jadwal?asal=1',
          headers: {},
        } as unknown as Request,
        createMockRes(),
        vi.fn() as NextFunction
      );
      expect(anonScheduleSession.csrfToken).toBeUndefined();

      const apiSession: Record<string, any> = {};
      csrfMiddleware(
        {
          session: apiSession,
          method: 'POST',
          path: '/api/v1/auth/login',
          originalUrl: '/api/v1/auth/login',
          headers: {},
        } as unknown as Request,
        createMockRes(),
        vi.fn() as NextFunction
      );
      expect(apiSession.csrfToken).toBeUndefined();
    });

    it('should still generate csrfToken on GET /login and reject POST /login with invalid token', () => {
      const loginSession: Record<string, any> = {};
      const resGet = createMockRes();
      csrfMiddleware(
        {
          session: loginSession,
          method: 'GET',
          path: '/login',
          originalUrl: '/login',
          headers: {},
        } as unknown as Request,
        resGet,
        vi.fn() as NextFunction
      );
      expect(typeof loginSession.csrfToken).toBe('string');
      expect(loginSession.csrfToken.length).toBe(64);

      const flashSpy = vi.fn();
      const resPost = createMockRes();
      const nextPost = vi.fn();
      csrfMiddleware(
        {
          session: loginSession,
          method: 'POST',
          path: '/login',
          originalUrl: '/login',
          body: { _csrf: 'wrong' },
          headers: {},
          header: () => '/login',
          flash: flashSpy,
        } as unknown as Request,
        resPost,
        nextPost as unknown as NextFunction
      );
      expect(nextPost).not.toHaveBeenCalled();
      expect(resPost.statusCode).toBe(403);
      expect(flashSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('compressionMiddleware', () => {
    it('should gzip large text/json payloads when Accept-Encoding includes gzip and skip small payloads', () => {
      const reqGzip = {
        method: 'GET',
        headers: { 'accept-encoding': 'gzip, deflate' },
      } as unknown as Request;

      // Payload >= 1024 bytes -> dikompresi
      const resLarge = createMockRes();
      resLarge.setHeader('Content-Type', 'application/json');
      compressionMiddleware(reqGzip, resLarge, vi.fn());
      const largePayload = JSON.stringify({ data: 'x'.repeat(2000) });
      resLarge.send(largePayload);

      expect(resLarge.getHeader('Content-Encoding')).toBe('gzip');
      expect(resLarge.getHeader('Vary')).toBe('Accept-Encoding');
      expect(Buffer.isBuffer(resLarge.body)).toBe(true);
      expect((resLarge.body as Buffer).byteLength).toBeLessThan(largePayload.length);
      expect(zlib.gunzipSync(resLarge.body as Buffer).toString('utf8')).toBe(largePayload);

      // Payload < 1024 bytes -> tidak dikompresi
      const resSmall = createMockRes();
      resSmall.setHeader('Content-Type', 'application/json');
      compressionMiddleware(reqGzip, resSmall, vi.fn());
      resSmall.send('{"ok":true}');
      expect(resSmall.getHeader('Content-Encoding')).toBeUndefined();
      expect(resSmall.body).toBe('{"ok":true}');
    });
  });
});
