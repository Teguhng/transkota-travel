import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import fs from 'fs/promises';
import { apiController } from '../../src/controllers/api.controller.js';
import { authService } from '../../src/services/auth.service.js';
import { tokenService } from '../../src/services/token.service.js';
import { bookingService } from '../../src/services/booking.service.js';
import { paymentService } from '../../src/services/payment.service.js';
import { ruteRepository } from '../../src/repositories/rute.repository.js';
import { kendaraanRepository } from '../../src/repositories/kendaraan.repository.js';

function createMockRes() {
  const res: any = {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  };
  return res as Response & { statusCode: number; body: any };
}

describe('ApiController Unit Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('Auth endpoints', () => {
    it('login should authenticate, issue bearer token, and omit password_hash', async () => {
      vi.spyOn(authService, 'authenticate').mockResolvedValue({
        id: 7,
        username: 'aziz',
        email: 'aziz@localhost',
        nama: 'Aziz',
        telepon: '085745509897',
        alamat: 'Rajabasa',
        jenis_kelamin: 'L',
        role: 'member',
        password_hash: '$2a$10$secret',
        wajib_reset_password: 0,
        status_akun: 'aktif',
        sumber_legacy: null,
        id_legacy: null,
        dibuat_pada: null,
        diperbarui_pada: new Date(),
      });
      vi.spyOn(tokenService, 'issueToken').mockResolvedValue({
        tokenId: 1,
        plainTextToken: '1|' + 'a'.repeat(64),
        name: 'android-app',
        abilities: ['*'],
        expiresAt: new Date(Date.now() + 86_400_000),
      });

      const req = {
        body: {
          identifier: 'aziz',
          password: 'Password123!',
          device_name: 'android-app',
          ttl_days: 30,
        },
      } as unknown as Request;
      const res = createMockRes();
      const next = vi.fn() as NextFunction;

      await apiController.login(req, res, next);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.token).toMatch(/^1\|[a-f0-9]{64}$/);
      expect(res.body.data.user.password_hash).toBeUndefined();
      expect(res.body.data.user.username).toBe('aziz');
    });

    it('login should return 401 on invalid credentials and 403 on legacy reset required', async () => {
      vi.spyOn(authService, 'authenticate').mockRejectedValueOnce(
        new Error('Username atau kata sandi tidak valid.')
      );

      const req = {
        body: { identifier: 'aziz', password: 'wrong' },
      } as unknown as Request;
      const res401 = createMockRes();
      await apiController.login(req, res401, vi.fn());
      expect(res401.statusCode).toBe(401);
      expect(res401.body.error.code).toBe('INVALID_CREDENTIALS');

      vi.spyOn(authService, 'authenticate').mockRejectedValueOnce(
        new Error(
          'Akun Anda memerlukan aktivasi kata sandi awal pada menu /auth/activate.'
        )
      );
      const res403 = createMockRes();
      await apiController.login(req, res403, vi.fn());
      expect(res403.statusCode).toBe(403);
      expect(res403.body.error.code).toBe('PASSWORD_ACTIVATION_REQUIRED');
    });

    it('register should return 201 with token or 409 when username exists', async () => {
      vi.spyOn(authService, 'registerMember').mockResolvedValueOnce({
        id: 21,
        username: 'budi99',
        email: 'budi@example.com',
        nama: 'Budi',
        telepon: '08123456789',
        alamat: null,
        jenis_kelamin: 'L',
        role: 'member',
        password_hash: 'hash',
        wajib_reset_password: 0,
        status_akun: 'aktif',
        sumber_legacy: null,
        id_legacy: null,
        dibuat_pada: new Date(),
        diperbarui_pada: new Date(),
      });
      vi.spyOn(tokenService, 'issueToken').mockResolvedValueOnce({
        tokenId: 4,
        plainTextToken: '4|' + 'f'.repeat(64),
        name: 'api-client',
        abilities: ['*'],
        expiresAt: new Date(),
      });

      const req = {
        body: {
          username: 'budi99',
          nama: 'Budi',
          email: 'budi@example.com',
          telepon: '08123456789',
          password: 'Password123!',
        },
      } as unknown as Request;
      const res = createMockRes();
      await apiController.register(req, res, vi.fn());

      expect(res.statusCode).toBe(201);
      expect(res.body.data.token_type).toBe('Bearer');

      vi.spyOn(authService, 'registerMember').mockRejectedValueOnce(
        new Error('Username sudah digunakan oleh akun lain.')
      );
      const res409 = createMockRes();
      await apiController.register(req, res409, vi.fn());
      expect(res409.statusCode).toBe(409);
      expect(res409.body.error.code).toBe('CONFLICT');
    });
  });

  describe('Booking & Payment endpoints', () => {
    it('createBooking should forward passengers to bookingService and return 201', async () => {
      const createSpy = vi
        .spyOn(bookingService, 'createOnlineBooking')
        .mockResolvedValue({
          id_pemesanan: 88,
          kode_booking: 'TKT-ABC123',
          total: 170000,
          jatuh_tempo: new Date(),
        });

      const req = {
        user: { id: 7, role: 'member' },
        body: {
          jadwal_id: 10,
          penumpang: [
            { id_jadwal_kursi: 1, nama: 'Budi', telepon: '08123' },
            { id_jadwal_kursi: 2, nama: 'Sari', telepon: null },
          ],
        },
      } as unknown as Request;
      const res = createMockRes();

      await apiController.createBooking(req, res, vi.fn());

      expect(createSpy).toHaveBeenCalledWith(
        7,
        10,
        [1, 2],
        ['Budi', 'Sari'],
        ['08123', undefined]
      );
      expect(res.statusCode).toBe(201);
      expect(res.body.data.kode_booking).toBe('TKT-ABC123');
    });

    it('submitPayment should return 400 when file is missing and cleanup file if order lookup fails', async () => {
      const reqNoFile = {
        params: { kode: 'TKT-1' },
        user: { id: 7, role: 'member' },
        body: { referensi: 'REF123', no_rek_pengirim: '123456' },
      } as unknown as Request;
      const resNoFile = createMockRes();

      await apiController.submitPayment(reqNoFile, resNoFile, vi.fn());
      expect(resNoFile.statusCode).toBe(400);

      const unlinkSpy = vi.spyOn(fs, 'unlink').mockResolvedValue(undefined);
      vi.spyOn(bookingService, 'getInvoiceByCode').mockRejectedValue(
        new Error('Pesanan dengan kode tersebut tidak ditemukan.')
      );

      const reqWithFile = {
        params: { kode: 'TKT-404' },
        user: { id: 7, role: 'member' },
        body: { referensi: 'REF123', no_rek_pengirim: '123456' },
        file: { path: '/tmp/uploaded.jpg', filename: 'uploaded.jpg' },
      } as unknown as Request;
      const resWithFile = createMockRes();
      const next = vi.fn() as NextFunction;

      await apiController.submitPayment(reqWithFile, resWithFile, next);
      expect(unlinkSpy).toHaveBeenCalledWith('/tmp/uploaded.jpg');
      expect(next).toHaveBeenCalledTimes(1);
    });
  });

  describe('Operator & Admin endpoints', () => {
    it('verifyPayment should validate paymentId and invoke paymentService.verifyPayment', async () => {
      const reqBadId = {
        params: { id: 'abc' },
        user: { id: 6, role: 'operator' },
        body: { aksi: 'terima' },
      } as unknown as Request;
      const resBad = createMockRes();
      await apiController.verifyPayment(reqBadId, resBad, vi.fn());
      expect(resBad.statusCode).toBe(400);

      const verifySpy = vi
        .spyOn(paymentService, 'verifyPayment')
        .mockResolvedValue();
      const reqOk = {
        params: { id: '15' },
        user: { id: 6, role: 'operator' },
        body: { aksi: 'terima', alasan_penolakan: '' },
      } as unknown as Request;
      const resOk = createMockRes();
      await apiController.verifyPayment(reqOk, resOk, vi.fn());

      expect(verifySpy).toHaveBeenCalledWith(15, 6, true, '');
      expect(resOk.statusCode).toBe(200);
      expect(resOk.body.data.status).toBe('diterima');
    });

    it('createWalkinOrder should invoke bookingService.processWalkinBooking and return 201', async () => {
      const walkinSpy = vi
        .spyOn(bookingService, 'processWalkinBooking')
        .mockResolvedValue({
          id_pemesanan: 91,
          kode_booking: 'TKT-WALKIN',
          total: 85000,
          jatuh_tempo: new Date(),
        });

      const req = {
        user: { id: 6, role: 'operator' },
        body: {
          jadwal_id: 3,
          kursi_id: 12,
          nama: 'Penumpang Loket',
          telepon: '081200001111',
        },
      } as unknown as Request;
      const res = createMockRes();

      await apiController.createWalkinOrder(req, res, vi.fn());

      expect(walkinSpy).toHaveBeenCalledWith(
        6,
        3,
        12,
        'Penumpang Loket',
        '081200001111'
      );
      expect(res.statusCode).toBe(201);
    });

    it('createMasterEntity should validate entity and payload before calling repositories', async () => {
      const reqUnknown = {
        params: { entity: 'unknown' },
        body: {},
      } as unknown as Request;
      const resUnknown = createMockRes();
      await apiController.createMasterEntity(reqUnknown, resUnknown, vi.fn());
      expect(resUnknown.statusCode).toBe(400);
      expect(resUnknown.body.error.code).toBe('INVALID_ENTITY');

      const reqInvalidRoute = {
        params: { entity: 'rute' },
        body: { id_kota_asal: 1, id_kota_tujuan: 1 },
      } as unknown as Request;
      const resInvalidRoute = createMockRes();
      await apiController.createMasterEntity(
        reqInvalidRoute,
        resInvalidRoute,
        vi.fn()
      );
      expect(resInvalidRoute.statusCode).toBe(400);
      expect(resInvalidRoute.body.error.code).toBe('VALIDATION_ERROR');

      vi.spyOn(ruteRepository, 'createCity').mockResolvedValue(24);
      const reqCity = {
        params: { entity: 'kota' },
        body: { nama: 'Bandar Jaya' },
      } as unknown as Request;
      const resCity = createMockRes();
      await apiController.createMasterEntity(reqCity, resCity, vi.fn());
      expect(resCity.statusCode).toBe(201);
      expect(resCity.body.data).toEqual({ entity: 'kota', id: 24 });

      const createVehicleSpy = vi
        .spyOn(kendaraanRepository, 'createVehicle')
        .mockResolvedValue(9);
      const reqVehicle = {
        params: { entity: 'kendaraan' },
        body: { jenis: 'Hiace', nomor_polisi: 'be 1234 ab', warna: 'Putih' },
      } as unknown as Request;
      const resVehicle = createMockRes();
      await apiController.createMasterEntity(reqVehicle, resVehicle, vi.fn());
      expect(createVehicleSpy).toHaveBeenCalledWith(
        'Hiace',
        'BE 1234 AB',
        'Putih'
      );
      expect(resVehicle.statusCode).toBe(201);
    });
  });
});
