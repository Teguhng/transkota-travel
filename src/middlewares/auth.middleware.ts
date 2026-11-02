import { Request, Response, NextFunction } from 'express';

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session || !req.session.user) {
    if (req.method === 'GET') {
      return res.redirect(`/login?redirect=${encodeURIComponent(req.originalUrl)}`);
    }
    return res.status(401).redirect('/login');
  }

  // Cek apakah akun legacy wajib ganti kata sandi
  const user = req.session.user;
  const currentPath = req.path;
  const whitelist = ['/auth/activate', '/logout', '/login'];

  if (user.wajib_reset_password === 1 && !whitelist.some(p => currentPath.startsWith(p))) {
    req.flash('error', 'Akun Anda memerlukan aktivasi kata sandi baru sebelum dapat melanjutkan.');
    return res.redirect('/auth/activate');
  }

  req.user = user;
  res.locals.user = user;
  next();
}

export function requireGuest(req: Request, res: Response, next: NextFunction) {
  if (req.session && req.session.user) {
    const role = req.session.user.role;
    if (role === 'admin') return res.redirect('/admin/dashboard');
    if (role === 'operator') return res.redirect('/operator/dashboard');
    return res.redirect('/');
  }
  next();
}

