import { Router } from 'express';
import { apiController } from '../controllers/api.controller.js';
import {
  createApiRateLimiter,
  requireApiAuth,
  requireApiRole,
  validateBody,
  validateQuery,
} from '../middlewares/api-auth.middleware.js';
import { uploadReceipt } from '../middlewares/upload.middleware.js';
import {
  ApiActivateSchema,
  ApiCancelOrderSchema,
  ApiComplaintCreateSchema,
  ApiComplaintRespondSchema,
  ApiLoginSchema,
  ApiOnlineBookingSchema,
  ApiOrdersQuerySchema,
  ApiRegisterSchema,
  ApiScheduleFilterSchema,
  ApiUsersQuerySchema,
  ApiVerifyPaymentSchema,
} from '../types/api.types.js';
import {
  PaymentProofSchema,
  WalkinBookingSchema,
} from '../types/booking.types.js';

export const apiRouter = Router();

const authRateLimiter = createApiRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 30,
  keyPrefix: 'api-auth',
});

const generalRateLimiter = createApiRateLimiter({
  windowMs: 60 * 1000,
  max: 120,
  keyPrefix: 'api-general',
});

const v1 = Router();
v1.use(generalRateLimiter);

// --- Health & Public Catalog ---
v1.get('/health', (req, res) => apiController.health(req, res));
v1.get('/kota', (req, res, next) => apiController.listCities(req, res, next));
v1.get('/rute', (req, res, next) => apiController.listRoutes(req, res, next));
v1.get(
  '/jadwal',
  validateQuery(ApiScheduleFilterSchema),
  (req, res, next) => apiController.listSchedules(req, res, next)
);
v1.get('/jadwal/:id', (req, res, next) =>
  apiController.getScheduleDetail(req, res, next)
);

// --- Auth & Sanctum-Style Token Management ---
v1.post(
  '/auth/login',
  authRateLimiter,
  validateBody(ApiLoginSchema),
  (req, res, next) => apiController.login(req, res, next)
);
v1.post(
  '/auth/register',
  authRateLimiter,
  validateBody(ApiRegisterSchema),
  (req, res, next) => apiController.register(req, res, next)
);
v1.post(
  '/auth/activate',
  authRateLimiter,
  validateBody(ApiActivateSchema),
  (req, res, next) => apiController.activate(req, res, next)
);
v1.get('/auth/me', requireApiAuth, (req, res, next) =>
  apiController.me(req, res, next)
);
v1.get('/auth/tokens', requireApiAuth, (req, res, next) =>
  apiController.listTokens(req, res, next)
);
v1.post('/auth/logout', requireApiAuth, (req, res, next) =>
  apiController.logout(req, res, next)
);
v1.post('/auth/logout-all', requireApiAuth, (req, res, next) =>
  apiController.logoutAll(req, res, next)
);
v1.delete('/auth/tokens/:tokenId', requireApiAuth, (req, res, next) =>
  apiController.revokeToken(req, res, next)
);

// --- Member Booking, Payment Proof, E-Ticket & Complaints ---
v1.post(
  '/bookings',
  requireApiAuth,
  requireApiRole(['member']),
  validateBody(ApiOnlineBookingSchema),
  (req, res, next) => apiController.createBooking(req, res, next)
);
v1.get(
  '/bookings',
  requireApiAuth,
  requireApiRole(['member']),
  (req, res, next) => apiController.listMyBookings(req, res, next)
);
v1.get('/bookings/:kode', requireApiAuth, (req, res, next) =>
  apiController.getBookingInvoice(req, res, next)
);
v1.post(
  '/bookings/:kode/pay',
  requireApiAuth,
  requireApiRole(['member']),
  uploadReceipt.single('bukti'),
  validateBody(PaymentProofSchema),
  (req, res, next) => apiController.submitPayment(req, res, next)
);
v1.post(
  '/bookings/:kode/cancel',
  requireApiAuth,
  requireApiRole(['member']),
  validateBody(ApiCancelOrderSchema),
  (req, res, next) => apiController.cancelBooking(req, res, next)
);
v1.get('/bookings/:kode/ticket', requireApiAuth, (req, res, next) =>
  apiController.getTicket(req, res, next)
);

v1.get(
  '/member/complaints',
  requireApiAuth,
  requireApiRole(['member']),
  (req, res, next) => apiController.listMyComplaints(req, res, next)
);
v1.post(
  '/member/complaints',
  requireApiAuth,
  requireApiRole(['member']),
  validateBody(ApiComplaintCreateSchema),
  (req, res, next) => apiController.createComplaint(req, res, next)
);

// --- Operator Loket Endpoints ---
const operatorApiGuards = [
  requireApiAuth,
  requireApiRole(['operator', 'admin']),
];

v1.get(
  '/operator/payments/pending',
  ...operatorApiGuards,
  (req, res, next) => apiController.listPendingPayments(req, res, next)
);
v1.get(
  '/operator/payments/:id',
  ...operatorApiGuards,
  (req, res, next) => apiController.getPaymentDetail(req, res, next)
);
v1.get(
  '/operator/payments/:id/receipt',
  ...operatorApiGuards,
  (req, res, next) => apiController.streamReceipt(req, res, next)
);
v1.post(
  '/operator/payments/:id/verify',
  ...operatorApiGuards,
  validateBody(ApiVerifyPaymentSchema),
  (req, res, next) => apiController.verifyPayment(req, res, next)
);
v1.post(
  '/operator/walkin',
  ...operatorApiGuards,
  validateBody(WalkinBookingSchema),
  (req, res, next) => apiController.createWalkinOrder(req, res, next)
);
v1.get(
  '/operator/orders',
  ...operatorApiGuards,
  validateQuery(ApiOrdersQuerySchema),
  (req, res, next) => apiController.listAllOrders(req, res, next)
);

// --- Admin Endpoints ---
const adminApiGuards = [requireApiAuth, requireApiRole(['admin'])];

v1.get('/admin/metrics', ...adminApiGuards, (req, res, next) =>
  apiController.getAdminMetrics(req, res, next)
);
v1.get('/admin/master', ...adminApiGuards, (req, res, next) =>
  apiController.getMasterData(req, res, next)
);
v1.post('/admin/master/:entity', ...adminApiGuards, (req, res, next) =>
  apiController.createMasterEntity(req, res, next)
);
v1.get(
  '/admin/users',
  ...adminApiGuards,
  validateQuery(ApiUsersQuerySchema),
  (req, res, next) => apiController.listUsers(req, res, next)
);
v1.get('/admin/complaints', ...adminApiGuards, (req, res, next) =>
  apiController.listAllComplaints(req, res, next)
);
v1.post(
  '/admin/complaints/:id/respond',
  ...adminApiGuards,
  validateBody(ApiComplaintRespondSchema),
  (req, res, next) => apiController.respondComplaint(req, res, next)
);

apiRouter.use('/api/v1', v1);
