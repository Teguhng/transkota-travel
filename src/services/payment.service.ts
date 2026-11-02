import fs from 'fs/promises';
import { pembayaranRepository } from '../repositories/pembayaran.repository.js';
import { pemesananRepository } from '../repositories/pemesanan.repository.js';

export class PaymentService {
  async submitPaymentProof(
    orderId: number,
    userId: number,
    reference: string,
    accountNumber: string,
    file?: Express.Multer.File
  ): Promise<void> {
    if (!file) {
      throw new Error('Berkas bukti transfer wajib diunggah.');
    }

    try {
      await pembayaranRepository.submitPaymentProof(
        orderId,
        userId,
        reference.trim(),
        accountNumber.trim(),
        file.filename
      );
    } catch (err) {
      // Proteksi Berkas Yatim (Orphaned File Cleanup)
      try {
        await fs.unlink(file.path);
      } catch (unlinkErr) {
        console.error('Gagal menghapus berkas yatim:', unlinkErr);
      }
      throw err;
    }
  }

  async verifyPayment(
    paymentId: number,
    operatorId: number,
    isApproved: boolean,
    rejectReason: string = ''
  ): Promise<void> {
    await pembayaranRepository.verifyPayment(
      paymentId,
      operatorId,
      isApproved,
      rejectReason
    );
  }

  async getPendingVerificationList() {
    return await pembayaranRepository.getPendingPayments();
  }

  async getPaymentDetail(paymentId: number) {
    const payment = await pembayaranRepository.getPaymentById(paymentId);
    if (!payment) throw new Error('Data pembayaran tidak ditemukan.');
    let booking: any = null;
    if (payment.kode_booking) {
      booking = await pemesananRepository.getBookingByCode(payment.kode_booking);
    }
    if (!booking) {
      booking = await pemesananRepository.getBookingById(payment.id_pemesanan);
    }
    return { payment, booking };
  }
}

export const paymentService = new PaymentService();
