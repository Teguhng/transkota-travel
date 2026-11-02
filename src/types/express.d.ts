import 'express-session';
import { UserRole } from './db.types.js';

export interface SessionUser {
  id: number;
  username: string;
  nama: string;
  role: UserRole;
  wajib_reset_password: number;
}

declare module 'express-mysql-session';

declare module 'express-session' {
  interface SessionData {
    user?: SessionUser;
    flash?: { [key: string]: string[] };
    csrfToken?: string;
  }
}

declare global {
  namespace Express {
    interface Request {
      user?: SessionUser;
      csrfToken?: () => string;
    }
  }
}
