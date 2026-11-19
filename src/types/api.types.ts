import { z } from 'zod';

export interface ApiErrorDetail {
  field?: string;
  message: string;
}

export interface ApiSuccessResponse<T = unknown> {
  success: true;
  message?: string;
  data: T;
  meta?: Record<string, unknown>;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: ApiErrorDetail[];
  };
}

export function apiSuccess<T>(
  data: T,
  message?: string,
  meta?: Record<string, unknown>
): ApiSuccessResponse<T> {
  const payload: ApiSuccessResponse<T> = {
    success: true,
    data,
  };
  if (message) {
    payload.message = message;
  }
  if (meta) {
    payload.meta = meta;
  }
  return payload;
}

export function apiError(
  code: string,
  message: string,
  details?: ApiErrorDetail[]
): ApiErrorResponse {
  return {
    success: false,
    error: {
      code,
      message,
      ...(details ? { details } : {}),
    },
  };
}

// --- Auth Schemas ---
export const ApiLoginSchema = z.object({
  identifier: z.string().trim().min(1, 'Username atau email wajib diisi.'),
  password: z.string().min(1, 'Kata sandi wajib diisi.'),
  device_name: z.string().trim().min(1).max(100).optional().default('api-client'),
  abilities: z.array(z.string().min(1)).optional(),
  ttl_days: z.coerce.number().int().min(1).max(365).optional().default(30),
});

export const ApiRegisterSchema = z.object({
  username: z.string().trim().min(3, 'Username minimal 3 karakter.').max(100),
  nama: z.string().trim().min(2, 'Nama minimal 2 karakter.').max(150),
  email: z.string().trim().email('Format email tidak valid.').max(254),
  telepon: z.string().trim().min(6, 'Nomor telepon minimal 6 digit.').max(30),
  alamat: z.string().trim().optional(),
  jenis_kelamin: z.enum(['L', 'P']).optional(),
  password: z.string().min(6, 'Kata sandi minimal 6 karakter.'),
  device_name: z.string().trim().min(1).max(100).optional().default('api-client'),
});

export const ApiActivateSchema = z.object({
  username: z.string().trim().min(1, 'Username wajib diisi.'),
  phone_or_email: z.string().trim().min(1, 'Nomor telepon atau email wajib diisi.'),
  new_password: z.string().min(6, 'Kata sandi baru minimal 6 karakter.'),
});

// --- Public / Schedule Query Schemas ---
export const ApiScheduleFilterSchema = z.object({
  asal: z.coerce.number().int().positive().optional(),
  tujuan: z.coerce.number().int().positive().optional(),
  tanggal: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD.')
    .optional(),
});

// --- Member Booking & Complaint Schemas ---
export const ApiOnlineBookingSchema = z.object({
  jadwal_id: z.coerce.number().int().positive(),
  penumpang: z
    .array(
      z.object({
        id_jadwal_kursi: z.coerce.number().int().positive(),
        nama: z.string().trim().min(1, 'Nama penumpang wajib diisi.').max(150),
        telepon: z.string().trim().max(30).optional().nullable(),
      })
    )
    .min(1, 'Harap pilih minimal 1 kursi.')
    .max(10, 'Maksimal 10 kursi per transaksi.'),
});

export const ApiCancelOrderSchema = z.object({
  alasan: z
    .string()
    .trim()
    .min(3, 'Alasan pembatalan minimal 3 karakter.')
    .max(255)
    .optional()
    .default('Dibatalkan oleh pelanggan via API'),
});

export const ApiComplaintCreateSchema = z.object({
  id_pemesanan: z.coerce.number().int().positive().optional().nullable(),
  judul: z.string().trim().min(3, 'Judul keluhan minimal 3 karakter.').max(150),
  isi: z.string().trim().min(5, 'Isi keluhan minimal 5 karakter.'),
});

// --- Operator Schemas ---
export const ApiVerifyPaymentSchema = z
  .object({
    aksi: z.enum(['terima', 'tolak']),
    alasan_penolakan: z.string().trim().max(255).optional().default(''),
  })
  .refine((data) => data.aksi !== 'tolak' || data.alasan_penolakan.length > 0, {
    message: 'Alasan penolakan wajib diisi ketika aksi bernilai tolak.',
    path: ['alasan_penolakan'],
  });

export const ApiOrdersQuerySchema = z.object({
  status: z
    .enum([
      'menunggu_pembayaran',
      'menunggu_verifikasi',
      'lunas',
      'dibatalkan',
      'kedaluwarsa',
    ])
    .optional(),
});

// --- Admin Schemas ---
export const ApiUsersQuerySchema = z.object({
  role: z.enum(['admin', 'operator', 'member']).optional(),
});

export const ApiComplaintRespondSchema = z.object({
  tanggapan: z.string().trim().min(3, 'Tanggapan minimal 3 karakter.'),
  status: z.enum(['baru', 'diproses', 'selesai']).optional().default('selesai'),
});

export const ApiMasterKotaSchema = z.object({
  nama: z.string().trim().min(2, 'Nama kota minimal 2 karakter.').max(100),
});

export const ApiMasterRuteSchema = z
  .object({
    id_kota_asal: z.coerce.number().int().positive(),
    id_kota_tujuan: z.coerce.number().int().positive(),
  })
  .refine((d) => d.id_kota_asal !== d.id_kota_tujuan, {
    message: 'Kota asal dan kota tujuan tidak boleh sama.',
    path: ['id_kota_tujuan'],
  });

export const ApiMasterKendaraanSchema = z.object({
  jenis: z.string().trim().min(2, 'Jenis kendaraan minimal 2 karakter.').max(100),
  nomor_polisi: z.string().trim().min(3, 'Nomor polisi minimal 3 karakter.').max(20),
  warna: z.string().trim().max(30).optional().nullable(),
});

export const ApiMasterJadwalSchema = z.object({
  id_rute: z.coerce.number().int().positive(),
  id_kendaraan: z.coerce.number().int().positive(),
  berangkat_pada: z.string().trim().min(10, 'Waktu berangkat wajib diisi.'),
  tiba_pada: z.string().trim().optional().nullable(),
  harga: z.coerce.number().positive('Harga tiket harus lebih dari 0.'),
});
