import { Request, Response, NextFunction } from 'express';
import { UserRole } from '../types/db.types.js';

export function requireRole(allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.session || !req.session.user) {
      return res.redirect('/login');
    }

    const userRole = req.session.user.role;
    if (!allowedRoles.includes(userRole)) {
      req.flash('error', 'Akses ditolak: Anda tidak memiliki izin untuk mengakses halaman ini.');
      if (userRole === 'admin') return res.redirect('/admin/dashboard');
      if (userRole === 'operator') return res.redirect('/operator/dashboard');
      return res.redirect('/');
    }

    next();
  };
}

