import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { pool } from '../../src/config/database.js';
import { buildPaginationMeta, paginateItems } from '../../src/utils/pagination.js';
import { jadwalRepository } from '../../src/repositories/jadwal.repository.js';
import { ruteRepository } from '../../src/repositories/rute.repository.js';
import { kendaraanRepository } from '../../src/repositories/kendaraan.repository.js';
import { AdminController } from '../../src/controllers/admin.controller.js';

describe('Admin Master Pagination & Ordering', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    ruteRepository.invalidateCache();
  });

  it('menghitung metadata pagination dan memotong halaman dengan aman', () => {
    const empty = buildPaginationMeta(0, 3, 12);
    expect(empty.page).toBe(1);
    expect(empty.totalPages).toBe(1);
    expect(empty.startItem).toBe(0);
    expect(empty.endItem).toBe(0);
    expect(empty.hasPrev).toBe(false);
    expect(empty.hasNext).toBe(false);

    const items = Array.from({ length: 125 }, (_, i) => i + 1);
    const clamped = paginateItems(items, 99, 12);
    expect(clamped.pagination.page).toBe(11);
    expect(clamped.pagination.totalPages).toBe(11);
    expect(clamped.pagination.startItem).toBe(121);
    expect(clamped.pagination.endItem).toBe(125);
    expect(clamped.items).toEqual([121, 122, 123, 124, 125]);

    const middle = buildPaginationMeta(125, 6, 12);
    expect(middle.pages).toEqual([1, '...', 5, 6, 7, '...', 11]);
    expect(middle.hasPrev).toBe(true);
    expect(middle.hasNext).toBe(true);
  });

  it('getSchedulesAdminPaginated mengurutkan j.id DESC dan menghitung LIMIT/OFFSET yang tepat', async () => {
    const querySpy = vi
      .spyOn(pool, 'query')
      .mockResolvedValueOnce([[{ total: 185 }], []] as any)
      .mockResolvedValueOnce([
        [
          {
            id: 191,
            kota_asal: 'Cirebon',
            kota_tujuan: 'Bandung',
            nama_kendaraan: 'Toyota Avanza',
            nomor_polisi: 'BE 1212 AT',
          },
        ],
        [],
      ] as any);

    const result = await jadwalRepository.getSchedulesAdminPaginated(2, 12);

    expect(querySpy).toHaveBeenCalledTimes(2);
    const dataSql = String(querySpy.mock.calls[1][0]);
    const dataParams = querySpy.mock.calls[1][1];
    expect(dataSql).toContain('ORDER BY j.id DESC');
    expect(dataSql).toContain('LIMIT ? OFFSET ?');
    expect(dataParams).toEqual([12, 12]);
    expect(result.pagination.totalItems).toBe(185);
    expect(result.pagination.totalPages).toBe(16);
    expect(result.pagination.page).toBe(2);
    expect(result.items[0].id).toBe(191);
  });

  it('getAllRoutes mengurutkan rute terbaru paling atas (ORDER BY r.id DESC)', async () => {
    const querySpy = vi.spyOn(pool, 'query').mockResolvedValueOnce([
      [
        { id: 7, id_kota_asal: 26, id_kota_tujuan: 27, aktif: 1, kota_asal: 'Cirebon', kota_tujuan: 'Bandung' },
        { id: 1, id_kota_asal: 1, id_kota_tujuan: 9, aktif: 1, kota_asal: 'Bandar Lampung', kota_tujuan: 'Lampung Barat' },
      ],
      [],
    ] as any);

    const routes = await ruteRepository.getAllRoutes();
    const sql = String(querySpy.mock.calls[0][0]);

    expect(sql).toContain('ORDER BY r.id DESC');
    expect(routes[0].id).toBe(7);
  });

  it('AdminController.masterData mempaginasi jadwal serta merender urutan terbaru paling atas', async () => {
    vi.spyOn(ruteRepository, 'getAllRoutes').mockResolvedValueOnce([
      { id: 7, id_kota_asal: 26, id_kota_tujuan: 27, aktif: 1, kota_asal: 'Cirebon', kota_tujuan: 'Bandung' } as any,
    ]);
    vi.spyOn(kendaraanRepository, 'getAllVehicles').mockResolvedValueOnce([
      { id: 1, jenis: 'Toyota Avanza', nomor_polisi: 'BE 1212 AT', status: 'aktif' } as any,
    ]);
    const pagedSpy = vi.spyOn(jadwalRepository, 'getSchedulesAdminPaginated').mockResolvedValueOnce({
      items: [{ id: 191 } as any],
      pagination: buildPaginationMeta(185, 1, 12),
    });

    const controller = new AdminController();
    const req = { query: { tab: 'jadwal', page: '1' } } as unknown as Request;
    const renderMock = vi.fn();
    const res = { render: renderMock } as unknown as Response;
    const next = vi.fn() as NextFunction;

    await controller.masterData(req, res, next);

    expect(pagedSpy).toHaveBeenCalledWith(1, 12);
    expect(renderMock).toHaveBeenCalledWith(
      'admin/master-data',
      expect.objectContaining({
        tab: 'jadwal',
        schedules: [{ id: 191 }],
        pagination: expect.objectContaining({ page: 1, totalPages: 16, totalItems: 185 }),
      })
    );
  });

  it('AdminController.masterData mempaginasi tab kota dengan kota terbaru di atas', async () => {
    vi.spyOn(ruteRepository, 'getAllCities').mockResolvedValueOnce([
      { id: 1, nama: 'Bandar Lampung' },
      { id: 27, nama: 'Bandung' },
      { id: 26, nama: 'Cirebon' },
    ]);

    const controller = new AdminController();
    const req = { query: { tab: 'kota', page: '1' } } as unknown as Request;
    const renderMock = vi.fn();
    const res = { render: renderMock } as unknown as Response;
    const next = vi.fn() as NextFunction;

    await controller.masterData(req, res, next);

    const viewModel = renderMock.mock.calls[0][1];
    expect(viewModel.cities.map((c: any) => c.id)).toEqual([27, 26, 1]);
  });

  it('AdminController.mutateMaster mempertahankan tab saat terjadi error validasi', async () => {
    const controller = new AdminController();
    const req = {
      params: { entity: 'jadwal' },
      body: { id_rute: '' },
      flash: vi.fn(),
    } as unknown as Request;
    const res = { redirect: vi.fn() } as unknown as Response;
    const next = vi.fn() as NextFunction;

    await controller.mutateMaster(req, res, next);

    expect(req.flash).toHaveBeenCalledWith('error', 'Semua kolom jadwal wajib diisi.');
    expect(res.redirect).toHaveBeenCalledWith('/admin/master?tab=jadwal');
  });
});
