import { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import fsPromises from 'fs/promises';
import { ZodSchema } from 'zod';
import { testConnection } from '../config/database.js';
import { authService } from '../services/auth.service.js';
import { tokenService } from '../services/token.service.js';
import { bookingService } from '../services/booking.service.js';
import { paymentService } from '../services/payment.service.js';
import { adminService } from '../services/admin.service.js';
import { userRepository } from '../repositories/user.repository.js';
import { ruteRepository } from '../repositories/rute.repository.js';
import { jadwalRepository } from '../repositories/jadwal.repository.js';
import { kendaraanRepository } from '../repositories/kendaraan.repository.js';
import { pemesananRepository } from '../repositories/pemesanan.repository.js';
import { pembayaranRepository } from '../repositories/pembayaran.repository.js';
import { keluhanRepository } from '../repositories/keluhan.repository.js';
import { generateQrCodeSvg } from '../utils/qrcode.js';
import { UserRole, UserRow } from '../types/db.types.js';
import {
  apiError,
  apiSuccess,
  ApiMasterJadwalSchema,
  ApiMasterKendaraanSchema,
  ApiMasterKotaSchema,
  ApiMasterRuteSchema,
} from '../types/api.types.js';

function sanitizeUser(user: UserRow) {
  return {
    id: Number(user.id),
    username: user.username,
    nama: user.nama,
    email: user.email,
    telepon: user.telepon,
    alamat: user.alamat,
    jenis_kelamin: user.jenis_kelamin,
    role: user.role,
    wajib_reset_password: Number(user.wajib_reset_password),
    status_akun: user.status_akun,
  };
}

function parsePositiveInt(raw: string): number | null {
  if (!/^\d+$/.test(raw)) {
    return null;
  }
  const num = Number(raw);
  if (!Number.isSafeInteger(num) || num <= 0) {
    return null;
  }
  return num;
}

function destroySessionAsync(req: Request): Promise<void> {
  return new Promise((resolve) => {
    if (!req.session) {
      resolve();
      return;
    }
    req.session.destroy(() => resolve());
  });
}

async function cleanupUploadedFile(file?: Express.Multer.File): Promise<void> {
  if (!file?.path) return;
  try {
    await fsPromises.unlink(file.path);
  } catch {
    // Abaikan jika berkas sudah terhapus
  }
}

export class ApiController {
  async health(_req: Request, res: Response) {
    const dbUp = await testConnection();
    if (!dbUp) {
      return res
        .status(503)
        .json(apiError('SERVICE_UNAVAILABLE', 'Database tidak dapat dijangkau.'));
    }
    return res.json(
      apiSuccess({
        status: 'ok',
        database: 'up',
        timestamp: new Date().toISOString(),
      })
    );
  }

  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const { identifier, password, device_name, abilities, ttl_days } = req.body;

      let user: UserRow;
      try {
        user = await authService.authenticate(identifier, password);
      } catch (authErr: any) {
        const msg: string = authErr?.message || 'Autentikasi gagal.';
        if (msg.includes('aktivasi kata sandi')) {
          return res
            .status(403)
            .json(apiError('PASSWORD_ACTIVATION_REQUIRED', msg));
        }
        if (msg.includes('dinonaktifkan')) {
          return res.status(403).json(apiError('ACCOUNT_DISABLED', msg));
        }
        return res.status(401).json(apiError('INVALID_CREDENTIALS', msg));
      }

      const issued = await tokenService.issueToken(Number(user.id), {
        name: device_name,
        abilities,
        ttlDays: ttl_days,
      });

      return res.json(
        apiSuccess(
          {
            token: issued.plainTextToken,
            token_type: 'Bearer',
            token_id: issued.tokenId,
            device_name: issued.name,
            abilities: issued.abilities,
            expires_at: issued.expiresAt,
            user: sanitizeUser(user),
          },
          'Login berhasil.'
        )
      );
    } catch (err) {
      return next(err);
    }
  }

  async register(req: Request, res: Response, next: NextFunction) {
    try {
      const {
        username,
        nama,
        email,
        telepon,
        alamat,
        jenis_kelamin,
        password,
        device_name,
      } = req.body;

      let newUser: UserRow;
      try {
        newUser = await authService.registerMember({
          username,
          nama,
          email,
          telepon,
          alamat,
          jenis_kelamin,
          password,
        });
      } catch (regErr: any) {
        if (
          typeof regErr?.message === 'string' &&
          regErr.message.includes('sudah digunakan')
        ) {
          return res.status(409).json(apiError('CONFLICT', regErr.message));
        }
        throw regErr;
      }

      const issued = await tokenService.issueToken(Number(newUser.id), {
        name: device_name || 'api-client',
        ttlDays: 30,
      });

      return res.status(201).json(
        apiSuccess(
          {
            token: issued.plainTextToken,
            token_type: 'Bearer',
            token_id: issued.tokenId,
            device_name: issued.name,
            abilities: issued.abilities,
            expires_at: issued.expiresAt,
            user: sanitizeUser(newUser),
          },
          'Pendaftaran akun member berhasil.'
        )
      );
    } catch (err) {
      return next(err);
    }
  }

  async activate(req: Request, res: Response, next: NextFunction) {
    try {
      const { username, phone_or_email, new_password } = req.body;

      try {
        await authService.activateLegacyAccount(
          username,
          phone_or_email,
          new_password
        );
      } catch (actErr: any) {
        if (
          typeof actErr?.message === 'string' &&
          actErr.message.startsWith('Verifikasi gagal')
        ) {
          return res
            .status(400)
            .json(apiError('ACTIVATION_VERIFICATION_FAILED', actErr.message));
        }
        throw actErr;
      }

      if (req.session?.user && req.session.user.username === username) {
        req.session.user.wajib_reset_password = 0;
      }

      return res.json(
        apiSuccess(
          { activated: true },
          'Aktivasi kata sandi berhasil. Silakan masuk menggunakan kata sandi baru.'
        )
      );
    } catch (err) {
      return next(err);
    }
  }

  async me(req: Request, res: Response, next: NextFunction) {
    try {
      const currentUser = req.user!;
      const freshUser = await userRepository.findById(currentUser.id);

      return res.json(
        apiSuccess({
          user: freshUser ? sanitizeUser(freshUser) : currentUser,
          auth_method: req.authMethod || 'bearer',
          token_id: req.authTokenId ?? null,
          abilities: req.authAbilities ?? ['*'],
        })
      );
    } catch (err) {
      return next(err);
    }
  }

  async listTokens(req: Request, res: Response, next: NextFunction) {
    try {
      const tokens = await tokenService.listActiveTokens(req.user!.id);
      return res.json(
        apiSuccess({
          current_token_id: req.authTokenId ?? null,
          tokens,
        })
      );
    } catch (err) {
      return next(err);
    }
  }

  async logout(req: Request, res: Response, next: NextFunction) {
    try {
      let revoked = false;
      if (req.authMethod === 'bearer' && req.authTokenId) {
        revoked = await tokenService.revokeToken(req.authTokenId, req.user!.id);
      }
      if (req.session?.user) {
        await destroySessionAsync(req);
        revoked = true;
      }

      return res.json(apiSuccess({ revoked }, 'Logout berhasil.'));
    } catch (err) {
      return next(err);
    }
  }

  async logoutAll(req: Request, res: Response, next: NextFunction) {
    try {
      const revokedCount = await tokenService.revokeAllTokens(req.user!.id);
      if (req.session?.user) {
        await destroySessionAsync(req);
      }
      return res.json(
        apiSuccess(
          { revoked_count: revokedCount },
          'Semua token aktif telah dicabut.'
        )
      );
    } catch (err) {
      return next(err);
    }
  }

  async revokeToken(req: Request, res: Response, next: NextFunction) {
    try {
      const tokenId = parsePositiveInt(req.params.tokenId);
      if (!tokenId) {
        return res
          .status(400)
          .json(apiError('INVALID_PARAMETER', 'ID token tidak valid.'));
      }

      const revoked = await tokenService.revokeToken(tokenId, req.user!.id);
      if (!revoked) {
        return res
          .status(404)
          .json(apiError('NOT_FOUND', 'Token tidak ditemukan.'));
      }

      return res.json(
        apiSuccess(
          { revoked: true, token_id: tokenId },
          'Token berhasil dicabut.'
        )
      );
    } catch (err) {
      return next(err);
    }
  }

  // --- Public Catalog ---
  async listCities(_req: Request, res: Response, next: NextFunction) {
    try {
      const cities = await ruteRepository.getAllCities();
      return res.json(apiSuccess(cities));
    } catch (err) {
      return next(err);
    }
  }

  async listRoutes(_req: Request, res: Response, next: NextFunction) {
    try {
      const routes = await ruteRepository.getAllRoutes();
      return res.json(apiSuccess(routes));
    } catch (err) {
      return next(err);
    }
  }

  async listSchedules(req: Request, res: Response, next: NextFunction) {
    try {
      const query = ((req as any).validatedQuery || {}) as {
        asal?: number;
        tujuan?: number;
        tanggal?: string;
      };
      const schedules = await jadwalRepository.getActiveSchedules(
        query.asal,
        query.tujuan,
        query.tanggal
      );
      return res.json(
        apiSuccess(schedules, undefined, { count: schedules.length })
      );
    } catch (err) {
      return next(err);
    }
  }

  async getScheduleDetail(req: Request, res: Response, next: NextFunction) {
    try {
      const jadwalId = parsePositiveInt(req.params.id);
      if (!jadwalId) {
        return res
          .status(400)
          .json(apiError('INVALID_PARAMETER', 'ID jadwal tidak valid.'));
      }

      const [schedule, seats] = await Promise.all([
        jadwalRepository.getScheduleById(jadwalId),
        jadwalRepository.getScheduleSeats(jadwalId),
      ]);

      if (!schedule) {
        return res
          .status(404)
          .json(apiError('NOT_FOUND', 'Jadwal travel tidak ditemukan.'));
      }

      return res.json(apiSuccess({ schedule, seats }));
    } catch (err) {
      return next(err);
    }
  }

  // --- Member Booking & Complaints ---
  async createBooking(req: Request, res: Response, next: NextFunction) {
    try {
      const { jadwal_id, penumpang } = req.body as {
        jadwal_id: number;
        penumpang: Array<{
          id_jadwal_kursi: number;
          nama: string;
          telepon?: string | null;
        }>;
      };

      const seatIds = penumpang.map((p) => Number(p.id_jadwal_kursi));
      const names = penumpang.map((p) => p.nama);
      const phones = penumpang.map((p) => p.telepon ?? undefined);

      const created = await bookingService.createOnlineBooking(
        req.user!.id,
        jadwal_id,
        seatIds,
        names,
        phones
      );

      return res
        .status(201)
        .json(
          apiSuccess(
            created,
            'Kursi berhasil ditahan. Harap segera selesaikan pembayaran sebelum jatuh tempo.'
          )
        );
    } catch (err) {
      return next(err);
    }
  }

  async listMyBookings(req: Request, res: Response, next: NextFunction) {
    try {
      const bookings = await pemesananRepository.getMemberBookings(req.user!.id);
      return res.json(
        apiSuccess(bookings, undefined, { count: bookings.length })
      );
    } catch (err) {
      return next(err);
    }
  }

  async getBookingInvoice(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await bookingService.getInvoiceByCode(
        req.params.kode,
        req.user!
      );
      return res.json(apiSuccess(result));
    } catch (err) {
      return next(err);
    }
  }

  async submitPayment(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.file) {
        return res
          .status(400)
          .json(
            apiError(
              'VALIDATION_ERROR',
              'Berkas bukti transfer (field: bukti) wajib diunggah.'
            )
          );
      }

      let booking;
      try {
        const invoice = await bookingService.getInvoiceByCode(
          req.params.kode,
          req.user!
        );
        booking = invoice.booking;
      } catch (lookupErr) {
        await cleanupUploadedFile(req.file);
        throw lookupErr;
      }

      const { referensi, no_rek_pengirim } = req.body;
      await paymentService.submitPaymentProof(
        booking.id,
        req.user!.id,
        referensi,
        no_rek_pengirim,
        req.file
      );

      return res.status(201).json(
        apiSuccess(
          {
            kode_booking: booking.kode_booking,
            status: 'menunggu_verifikasi',
          },
          'Bukti transfer berhasil diunggah dan menunggu verifikasi petugas.'
        )
      );
    } catch (err) {
      return next(err);
    }
  }

  async cancelBooking(req: Request, res: Response, next: NextFunction) {
    try {
      const { booking } = await bookingService.getInvoiceByCode(
        req.params.kode,
        req.user!
      );
      const { alasan } = req.body;

      await bookingService.cancelBooking(booking.id, req.user!.id, alasan);

      return res.json(
        apiSuccess(
          {
            kode_booking: booking.kode_booking,
            status: 'dibatalkan',
          },
          'Pesanan tiket berhasil dibatalkan.'
        )
      );
    } catch (err) {
      return next(err);
    }
  }

  async getTicket(req: Request, res: Response, next: NextFunction) {
    try {
      const { booking, payment } = await bookingService.getInvoiceByCode(
        req.params.kode,
        req.user!
      );
      const qrSvg = generateQrCodeSvg(booking.kode_booking || String(booking.id));

      return res.json(
        apiSuccess({
          booking,
          payment,
          qr_svg: qrSvg,
        })
      );
    } catch (err) {
      return next(err);
    }
  }

  async listMyComplaints(req: Request, res: Response, next: NextFunction) {
    try {
      const complaints = await keluhanRepository.getComplaintsByMember(
        req.user!.id
      );
      return res.json(
        apiSuccess(complaints, undefined, { count: complaints.length })
      );
    } catch (err) {
      return next(err);
    }
  }

  async createComplaint(req: Request, res: Response, next: NextFunction) {
    try {
      const { id_pemesanan, judul, isi } = req.body;

      if (id_pemesanan) {
        const order = await pemesananRepository.getBookingById(id_pemesanan);
        if (!order) {
          return res
            .status(404)
            .json(apiError('NOT_FOUND', 'Pesanan yang direferensikan tidak ditemukan.'));
        }
        if (Number(order.id_pemesan) !== req.user!.id) {
          return res
            .status(403)
            .json(apiError('FORBIDDEN', 'Anda tidak memiliki akses ke pesanan ini.'));
        }
      }

      const id = await keluhanRepository.submitComplaint(
        req.user!.id,
        id_pemesanan ?? null,
        judul,
        isi
      );

      return res
        .status(201)
        .json(apiSuccess({ id }, 'Keluhan berhasil dikirim.'));
    } catch (err) {
      return next(err);
    }
  }

  // --- Operator Endpoints ---
  async listPendingPayments(_req: Request, res: Response, next: NextFunction) {
    try {
      const queue = await paymentService.getPendingVerificationList();
      return res.json(apiSuccess(queue, undefined, { count: queue.length }));
    } catch (err) {
      return next(err);
    }
  }

  async getPaymentDetail(req: Request, res: Response, next: NextFunction) {
    try {
      const paymentId = parsePositiveInt(req.params.id);
      if (!paymentId) {
        return res
          .status(400)
          .json(apiError('INVALID_PARAMETER', 'ID pembayaran tidak valid.'));
      }

      const detail = await paymentService.getPaymentDetail(paymentId);
      return res.json(apiSuccess(detail));
    } catch (err) {
      return next(err);
    }
  }

  async streamReceipt(req: Request, res: Response, next: NextFunction) {
    try {
      const paymentId = parsePositiveInt(req.params.id);
      if (!paymentId) {
        return res
          .status(400)
          .json(apiError('INVALID_PARAMETER', 'ID pembayaran tidak valid.'));
      }

      const payment = await pembayaranRepository.getPaymentById(paymentId);
      if (!payment || !payment.bukti_pembayaran) {
        return res
          .status(404)
          .json(
            apiError('NOT_FOUND', 'Berkas bukti pembayaran tidak ditemukan.')
          );
      }

      const safeFilename = path.basename(payment.bukti_pembayaran);
      const filePath = path.resolve(process.cwd(), 'storage/uploads', safeFilename);

      if (!fs.existsSync(filePath)) {
        return res
          .status(404)
          .json(
            apiError(
              'NOT_FOUND',
              'Berkas fisik bukti pembayaran tidak ditemukan di server.'
            )
          );
      }

      res.setHeader('Content-Disposition', `inline; filename="${safeFilename}"`);
      res.setHeader('X-Content-Type-Options', 'nosniff');
      return res.sendFile(filePath);
    } catch (err) {
      return next(err);
    }
  }

  async verifyPayment(req: Request, res: Response, next: NextFunction) {
    try {
      const paymentId = parsePositiveInt(req.params.id);
      if (!paymentId) {
        return res
          .status(400)
          .json(apiError('INVALID_PARAMETER', 'ID pembayaran tidak valid.'));
      }

      const { aksi, alasan_penolakan } = req.body;
      const isApproved = aksi === 'terima';

      await paymentService.verifyPayment(
        paymentId,
        req.user!.id,
        isApproved,
        alasan_penolakan || ''
      );

      return res.json(
        apiSuccess(
          {
            payment_id: paymentId,
            status: isApproved ? 'diterima' : 'ditolak',
          },
          isApproved
            ? 'Pembayaran disetujui. Tiket kini berstatus lunas.'
            : 'Pembayaran ditolak. Penumpang dapat mengunggah ulang bukti baru.'
        )
      );
    } catch (err) {
      return next(err);
    }
  }

  async createWalkinOrder(req: Request, res: Response, next: NextFunction) {
    try {
      const { jadwal_id, kursi_id, nama, telepon } = req.body;
      const booking = await bookingService.processWalkinBooking(
        req.user!.id,
        jadwal_id,
        kursi_id,
        nama,
        telepon
      );

      return res
        .status(201)
        .json(apiSuccess(booking, 'Tiket walk-in berhasil diterbitkan dan dilunasi.'));
    } catch (err) {
      return next(err);
    }
  }

  async listAllOrders(req: Request, res: Response, next: NextFunction) {
    try {
      const query = ((req as any).validatedQuery || {}) as { status?: string };
      const orders = await pemesananRepository.getAllBookings(query.status);
      return res.json(apiSuccess(orders, undefined, { count: orders.length }));
    } catch (err) {
      return next(err);
    }
  }

  // --- Admin Endpoints ---
  async getAdminMetrics(_req: Request, res: Response, next: NextFunction) {
    try {
      const metrics = await adminService.getDashboardMetrics();
      return res.json(apiSuccess(metrics));
    } catch (err) {
      return next(err);
    }
  }

  async getMasterData(_req: Request, res: Response, next: NextFunction) {
    try {
      const [cities, routes, vehicles, schedules] = await Promise.all([
        ruteRepository.getAllCities(),
        ruteRepository.getAllRoutes(),
        kendaraanRepository.getAllVehicles(),
        jadwalRepository.getAllSchedulesAdmin(),
      ]);

      return res.json(
        apiSuccess({
          kota: cities,
          rute: routes,
          kendaraan: vehicles,
          jadwal: schedules,
        })
      );
    } catch (err) {
      return next(err);
    }
  }

  private parseEntityPayload<T>(
    schema: ZodSchema<T>,
    body: unknown,
    res: Response
  ): T | null {
    const parsed = schema.safeParse(body ?? {});
    if (!parsed.success) {
      const details = parsed.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      }));
      res
        .status(400)
        .json(apiError('VALIDATION_ERROR', 'Validasi data gagal.', details));
      return null;
    }
    return parsed.data;
  }

  async createMasterEntity(req: Request, res: Response, next: NextFunction) {
    try {
      const entity = req.params.entity;

      if (entity === 'kota') {
        const data = this.parseEntityPayload(ApiMasterKotaSchema, req.body, res);
        if (!data) return;
        const id = await ruteRepository.createCity(data.nama);
        return res
          .status(201)
          .json(apiSuccess({ entity, id }, 'Kota baru berhasil ditambahkan.'));
      }

      if (entity === 'rute') {
        const data = this.parseEntityPayload(ApiMasterRuteSchema, req.body, res);
        if (!data) return;
        const id = await ruteRepository.createRoute(
          data.id_kota_asal,
          data.id_kota_tujuan
        );
        return res
          .status(201)
          .json(apiSuccess({ entity, id }, 'Rute baru berhasil ditambahkan.'));
      }

      if (entity === 'kendaraan') {
        const data = this.parseEntityPayload(
          ApiMasterKendaraanSchema,
          req.body,
          res
        );
        if (!data) return;
        const id = await kendaraanRepository.createVehicle(
          data.jenis,
          data.nomor_polisi.toUpperCase(),
          data.warna ?? null
        );
        return res
          .status(201)
          .json(
            apiSuccess(
              { entity, id },
              'Armada minibus baru beserta 5 kursi aktif berhasil didaftarkan.'
            )
          );
      }

      if (entity === 'jadwal') {
        const data = this.parseEntityPayload(ApiMasterJadwalSchema, req.body, res);
        if (!data) return;
        const id = await jadwalRepository.createSchedule({
          id_rute: data.id_rute,
          id_kendaraan: data.id_kendaraan,
          berangkat_pada: data.berangkat_pada,
          tiba_pada: data.tiba_pada ?? null,
          harga: data.harga,
        });
        return res
          .status(201)
          .json(
            apiSuccess(
              { entity, id },
              'Jadwal perjalanan baru berhasil diterbitkan.'
            )
          );
      }

      return res
        .status(400)
        .json(apiError('INVALID_ENTITY', 'Entitas master tidak dikenali.'));
    } catch (err) {
      return next(err);
    }
  }

  async listUsers(req: Request, res: Response, next: NextFunction) {
    try {
      const query = ((req as any).validatedQuery || {}) as { role?: UserRole };
      const users = await userRepository.getAllUsers(query.role);
      return res.json(apiSuccess(users, undefined, { count: users.length }));
    } catch (err) {
      return next(err);
    }
  }

  async listAllComplaints(_req: Request, res: Response, next: NextFunction) {
    try {
      const complaints = await keluhanRepository.getAllComplaints();
      return res.json(
        apiSuccess(complaints, undefined, { count: complaints.length })
      );
    } catch (err) {
      return next(err);
    }
  }

  async respondComplaint(req: Request, res: Response, next: NextFunction) {
    try {
      const complaintId = parsePositiveInt(req.params.id);
      if (!complaintId) {
        return res
          .status(400)
          .json(apiError('INVALID_PARAMETER', 'ID keluhan tidak valid.'));
      }

      const { tanggapan, status } = req.body;
      const updated = await keluhanRepository.respondToComplaint(
        complaintId,
        tanggapan,
        req.user!.id,
        status
      );

      if (!updated) {
        return res
          .status(404)
          .json(apiError('NOT_FOUND', 'Data keluhan tidak ditemukan.'));
      }

      return res.json(
        apiSuccess(
          { id: complaintId, status },
          'Tanggapan keluhan berhasil disimpan.'
        )
      );
    } catch (err) {
      return next(err);
    }
  }
}

export const apiController = new ApiController();
