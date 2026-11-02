import { Router } from 'express';
import { authController } from '../controllers/auth.controller.js';
import { requireGuest } from '../middlewares/auth.middleware.js';

export const authRouter = Router();

authRouter.get('/login', requireGuest, authController.showLogin);
authRouter.post('/login', requireGuest, authController.processLogin);

authRouter.get('/register', requireGuest, authController.showRegister);
authRouter.post('/register', requireGuest, authController.processRegister);

authRouter.get('/auth/activate', authController.showActivate);
authRouter.post('/auth/activate', authController.processActivate);

authRouter.post('/logout', authController.logout);

