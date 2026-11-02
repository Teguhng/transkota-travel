import { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import { paymentService } from '../services/payment.service.js';
import { bookingService } from '../services/booking.service.js';
import { pemesananRepository } from '../repositories/pemesanan.repository.js';
import { jadwalRepository } from '../repositories/jadwal.repository.js';
import { ruteRepository } from '../repositories/rute.repository.js';
import { pembayaranRepository } from '../repositories/pembayaran.repository.js';

export class OperatorController {
  async dashboard(req: Request, res: Response, next: NextFunction) {
    try {
      const pendingList = await paymentService.getPendingVerificationList();
      const allOrders = await pemesananRepository.getAllBookings();

      res.render('operator/dashboard', {
        title: 'Dashboard Operasional Loket',
        pendingCount: pendingList.length,
        totalOrders: allOrders.length,
        recentPending: pendingList.slice(0, 5)
      });
    } catch (err) {
      next(err);
    }
  }

  async verificationQueue(req: Request, res: Response, next: NextFunction) {
    try {
      const queue = await paymentService.getPendingVerificationList();
      res.render('operator/verifikasi', {
        title: 'Antrean Verifikasi Pembayaran Transfer',
        queue
      });
    } catch (err) {
      next(err);
    }
  }

  async verificationDetail(req: Request, res: Response, next: NextFunction) {
    try {
      const paymentId = Number(req.params.id);
      const { payment, booking } = await paymentService.getPaymentDetail(paymentId);

      res.render('operator/verifikasi-detail', {
        title: `Verifikasi Pembayaran: ${booking?.kode_booking || paymentId}`,
        payment,
        booking
      });
    } catch (err: any) {
      req.flash('error', err.message);
      res.redirect('/operator/verifikasi');
    }
  }

  async streamReceipt(req: Request, res: Response, next: NextFunction) {
    try {
      const paymentId = Number(req.params.id);
      const payment = await pembayaranRepository.getPaymentById(paymentId);
      if (!payment || !payment.bukti_pembayaran) {
        return res.status(404).send('Berkas bukti pembayaran tidak ditemukan.');
      }

      // Pastikan path aman dari path traversal
      const safeFilename = path.basename(payment.bukti_pembayaran);
      const filePath = path.resolve(process.cwd(), 'storage/uploads', safeFilename);

      if (!fs.existsSync(filePath)) {
        return res.status(404).send('Berkas fisik bukti pembayaran tidak ditemukan di server.');
      }

      res.setHeader('Content-Disposition', `inline; filename="${safeFilename}"`);
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.sendFile(filePath);
    } catch (err) {
      next(err);
    }
  }

  async processVerification(req: Request, res: Response, next: NextFunction) {
    try {
      const operator = req.session.user!;
      const paymentId = Number(req.params.id);
      const { aksi, alasan_penolakan } = req.body;

      const isApproved = aksi === 'terima';
      await paymentService.verifyPayment(
        paymentId,
        operator.id,
        isApproved,
        alasan_penolakan?.trim() || ''
      );

      if (isApproved) {
        req.flash('success', 'Pembayaran berhasil disetujui! Tiket kini telah berstatus Lunas.');
      } else {
        req.flash('info', 'Pembayaran ditolak. Penumpang dapat mengunggah ulang bukti baru.');
      }

      res.redirect('/operator/verifikasi');
    } catch (err: any) {
      req.flash('error', err.message || 'Gagal memverifikasi pembayaran.');
      res.redirect(`/operator/verifikasi/${req.params.id}`);
    }
  }

  async showWalkinOrder(req: Request, res: Response, next: NextFunction) {
    try {
      const schedules = await jadwalRepository.getActiveSchedules();
      const cities = await ruteRepository.getAllCities();

      const selectedJadwalId = req.query.jadwal ? Number(req.query.jadwal) : (schedules[0]?.id || 0);
      let seats: any[] = [];
      let selectedSchedule: any = null;

      if (selectedJadwalId) {
        selectedSchedule = await jadwalRepository.getScheduleById(selectedJadwalId);
        seats = await jadwalRepository.getScheduleSeats(selectedJadwalId);
      }

      res.render('operator/walkin-order', {
        title: 'Transaksi Tiket Walk-in (Loket Fisik)',
        schedules,
        cities,
        selectedJadwalId,
        selectedSchedule,
        seats
      });
    } catch (err) {
      next(err);
    }
  }

  async processWalkinOrder(req: Request, res: Response, next: NextFunction) {
    try {
      const operator = req.session.user!;
      const { jadwal_id, kursi_id, nama, telepon } = req.body;

      if (!jadwal_id || !kursi_id || !nama || !telepon) {
        req.flash('error', 'Semua kolom formulir tiket walk-in wajib diisi.');
        return res.redirect('/operator/walkin');
      }

      const booking = await bookingService.processWalkinBooking(
        operator.id,
        Number(jadwal_id),
        Number(kursi_id),
        nama,
        telepon
      );

      req.flash('success', `Tiket walk-in berhasil diterbitkan: ${booking.kode_booking}. Siap dicetak.`);
      res.redirect(`/pesanan/${booking.kode_booking}/cetak`);
    } catch (err: any) {
      req.flash('error', err.message || 'Gagal memproses tiket walk-in.');
      res.redirect('/operator/walkin');
    }
  }

  async orderList(req: Request, res: Response, next: NextFunction) {
    try {
      const statusFilter = req.query.status as string | undefined;
      const orders = await pemesananRepository.getAllBookings(statusFilter);

      res.render('operator/orders', {
        title: 'Manajemen Daftar Seluruh Tiket Pesanan',
        orders,
        statusFilter
      });
    } catch (err) {
      next(err);
    }
  }
}

export const operatorController = new OperatorController();

