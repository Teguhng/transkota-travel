import { Router } from 'express';
import { operatorController } from '../controllers/operator.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { requireRole } from '../middlewares/role.middleware.js';

export const operatorRouter = Router();

operatorRouter.use('/operator', (req, res, next) => {
  res.locals.layout = 'layouts/dashboard';
  next();
});

const operatorGuards = [requireAuth, requireRole(['operator', 'admin'])];

operatorRouter.get('/operator/dashboard', ...operatorGuards, operatorController.dashboard);
operatorRouter.get('/operator/verifikasi', ...operatorGuards, operatorController.verificationQueue);
operatorRouter.get('/operator/verifikasi/:id', ...operatorGuards, operatorController.verificationDetail);
operatorRouter.get('/operator/pembayaran/:id/bukti', ...operatorGuards, operatorController.streamReceipt);
operatorRouter.post('/operator/verifikasi/:id/proses', ...operatorGuards, operatorController.processVerification);

operatorRouter.get('/operator/walkin', ...operatorGuards, operatorController.showWalkinOrder);
operatorRouter.post('/operator/walkin/proses', ...operatorGuards, operatorController.processWalkinOrder);
operatorRouter.get('/operator/orders', ...operatorGuards, operatorController.orderList);
