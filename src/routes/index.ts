import { Router } from 'express';
import { publicRouter } from './public.routes.js';
import { authRouter } from './auth.routes.js';
import { memberRouter } from './member.routes.js';
import { operatorRouter } from './operator.routes.js';
import { adminRouter } from './admin.routes.js';

export const appRouter = Router();

appRouter.use(publicRouter);
appRouter.use(authRouter);
appRouter.use(memberRouter);
appRouter.use(operatorRouter);
appRouter.use(adminRouter);

