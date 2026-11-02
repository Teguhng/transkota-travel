import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

export function csrfMiddleware(req: Request, res: Response, next: NextFunction) {
  if (!req.session) {
    return next();
  }

  // Sediakan token pada sesi jika belum ada
  if (!(req.session as any).csrfToken) {
    (req.session as any).csrfToken = crypto.randomBytes(32).toString('hex');
  }

  const token = (req.session as any).csrfToken;
  res.locals.csrfToken = token;
  req.csrfToken = () => token;

  // Lewati validasi untuk metode baca aman
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  // Ambil token dari body form, query string (untuk multipart upload), atau header
  const submittedToken =
    req.body?._csrf ||
    req.query?._csrf ||
    req.headers['x-csrf-token'] ||
    req.headers['csrf-token'];

  if (!submittedToken || submittedToken !== token) {
    req.flash('error', 'Token keamanan sesi kedaluwarsa atau tidak valid. Harap coba kembali.');
    const backUrl = req.header('Referer') || '/';
    return res.status(403).redirect(backUrl);
  }

  next();
}
