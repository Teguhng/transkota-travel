import { pemesananRepository } from '../repositories/pemesanan.repository.js';
import { pembayaranRepository } from '../repositories/pembayaran.repository.js';
import { userRepository } from '../repositories/user.repository.js';
import { PassengerInput } from '../types/booking.types.js';
import crypto from 'crypto';

export class BookingService {
  async createOnlineBooking(
    userId: number,
    jadwalId: number,
    seatIds: number[],
    names: string[],
    phones?: (string | undefined)[]
  ) {
    if (!seatIds.length) {
      throw new Error('Harap pilih minimal 1 kursi.');
    }
    if (seatIds.length !== names.length) {
      throw new Error('Jumlah nama penumpang harus sesuai dengan jumlah kursi yang dipilih.');
    }

    const passengers: PassengerInput[] = seatIds.map((seatId, idx) => ({
      id_jadwal_kursi: Number(seatId),
      nama: names[idx]?.trim() || `Penumpang ${idx + 1}`,
      telepon: phones && phones[idx] ? phones[idx]!.trim() : null
    }));

    const passengersJson = JSON.stringify(passengers);

    return await pemesananRepository.createBooking(userId, jadwalId, passengersJson);
  }

  async processWalkinBooking(
    operatorId: number,
    jadwalId: number,
    seatId: number,
    passengerName: string,
    passengerPhone: string
  ) {
    // 1. Cari atau daftarkan akun member on-the-fly berbasis nomor telepon
    let member = await userRepository.findMemberByPhone(passengerPhone.trim());
    let memberId: number;

    if (member) {
      memberId = member.id;
    } else {
      // Buat username unik walkin_<telepon>
      const cleanPhone = passengerPhone.replace(/\D/g, '');
      const randomSuffix = crypto.randomBytes(2).toString('hex');
      const generatedUsername = `walkin_${cleanPhone}_${randomSuffix}`;

      memberId = await userRepository.createMember({
        username: generatedUsername,
        nama: passengerName.trim(),
        telepon: passengerPhone.trim(),
        password_hash: null,
        wajib_reset_password: 1
      });
    }

    // 2. Format JSON penumpang untuk sp_buat_pemesanan
    const passengers: PassengerInput[] = [
      {
        id_jadwal_kursi: Number(seatId),
        nama: passengerName.trim(),
        telepon: passengerPhone.trim()
      }
    ];

    // 3. Eksekusi sp_buat_pemesanan
    const booking = await pemesananRepository.createBooking(
      memberId,
      jadwalId,
      JSON.stringify(passengers)
    );

    // 4. Eksekusi pelunasan tunai ACID di loket
    await pembayaranRepository.processCashPayment(booking.id_pemesanan, operatorId);

    return booking;
  }

  async cancelBooking(orderId: number, userId: number, reason: string) {
    return await pemesananRepository.cancelBooking(orderId, userId, reason);
  }

  async getInvoiceByCode(code: string, requestingUser: { id: number; role: string }) {
    const booking = await pemesananRepository.getBookingByCode(code);
    if (!booking) {
      throw new Error('Pesanan dengan kode tersebut tidak ditemukan.');
    }

    // Akses diizinkan untuk pemilik pesanan atau staf loket/admin
    if (requestingUser.role === 'member' && booking.id_pemesan !== requestingUser.id) {
      throw new Error('Anda tidak memiliki akses ke tiket ini.');
    }

    const payment = await pembayaranRepository.getPaymentByOrderId(booking.id);

    return {
      booking,
      payment
    };
  }
}

export const bookingService = new BookingService();

