import { z } from 'zod';

export interface PassengerInput {
  id_jadwal_kursi: number;
  nama: string;
  telepon: string | null;
}

export const CheckoutSchema = z.object({
  jadwal_id: z.coerce.number().positive(),
  kursi_ids: z.union([
    z.coerce.number().positive().array(),
    z.coerce.number().positive().transform(val => [val])
  ]),
  penumpang_nama: z.union([
    z.string().min(1).array(),
    z.string().min(1).transform(val => [val])
  ]),
  penumpang_telepon: z.union([
    z.string().optional().array(),
    z.string().optional().transform(val => [val || ''])
  ]).optional()
});

export type CheckoutInput = z.infer<typeof CheckoutSchema>;

export const PaymentProofSchema = z.object({
  referensi: z.string().min(3, 'Nomor referensi / resi minimal 3 karakter').max(100),
  no_rek_pengirim: z.string().min(4, 'Nomor rekening minimal 4 digit').max(34)
});

export const WalkinBookingSchema = z.object({
  jadwal_id: z.coerce.number().positive(),
  kursi_id: z.coerce.number().positive(),
  nama: z.string().min(2, 'Nama minimal 2 karakter').max(150),
  telepon: z.string().min(6, 'Nomor telepon minimal 6 digit').max(30)
});

export const ScheduleFilterSchema = z.object({
  asal: z.coerce.number().optional(),
  tujuan: z.coerce.number().optional(),
  tanggal: z.string().optional()
});

