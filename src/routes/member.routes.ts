import { Router } from 'express';
import { memberController } from '../controllers/member.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { requireRole } from '../middlewares/role.middleware.js';
import { uploadReceipt } from '../middlewares/upload.middleware.js';

export const memberRouter = Router();

// Endpoint pemesanan kursi & checkout
memberRouter.get('/booking/:id/kursi', requireAuth, requireRole(['member']), memberController.showSeatSelection);
memberRouter.post('/booking/:id/checkout', requireAuth, requireRole(['member']), memberController.processCheckout);

// Endpoint faktur invoice & pembayaran
memberRouter.get('/pesanan/:kode', requireAuth, memberController.showInvoice);
memberRouter.get('/pesanan/:kode/bayar', requireAuth, requireRole(['member']), memberController.showPaymentForm);
memberRouter.post(
  '/pesanan/:kode/bayar',
  requireAuth,
  requireRole(['member']),
  uploadReceipt.single('bukti'),
  memberController.submitPayment
);
memberRouter.post('/pesanan/:kode/batal', requireAuth, requireRole(['member']), memberController.cancelOrder);
memberRouter.get('/pesanan/:kode/cetak', requireAuth, memberController.printTicket);

// Endpoint riwayat tiket & layanan keluhan
memberRouter.get('/member/pesanan', requireAuth, requireRole(['member']), memberController.myTickets);
memberRouter.get('/member/keluhan', requireAuth, requireRole(['member']), memberController.showComplaints);
memberRouter.post('/member/keluhan', requireAuth, requireRole(['member']), memberController.submitComplaint);

