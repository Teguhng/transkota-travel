import { Router } from 'express';
import { publicController } from '../controllers/public.controller.js';

export const publicRouter = Router();

publicRouter.get('/', publicController.home);
publicRouter.get('/jadwal', publicController.searchSchedules);

