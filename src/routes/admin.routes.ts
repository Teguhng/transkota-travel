import { Router } from 'express';
import { adminController } from '../controllers/admin.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { requireRole } from '../middlewares/role.middleware.js';

export const adminRouter = Router();

adminRouter.use('/admin', (req, res, next) => {
  res.locals.layout = 'layouts/dashboard';
  next();
});

const adminGuards = [requireAuth, requireRole(['admin'])];

adminRouter.get('/admin/dashboard', ...adminGuards, adminController.dashboard);
adminRouter.get('/admin/master', ...adminGuards, adminController.masterData);
adminRouter.post('/admin/master/:entity', ...adminGuards, adminController.mutateMaster);
adminRouter.get('/admin/users-keluhan', ...adminGuards, adminController.usersAndComplaints);
adminRouter.post('/admin/keluhan/:id/tanggapi', ...adminGuards, adminController.respondComplaint);
