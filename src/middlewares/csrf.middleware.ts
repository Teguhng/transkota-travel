import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

export function csrfMiddleware(req: Request, res: Response, next: NextFunction) {
  if (!req.session) {
    return next();
  }

  // Jangan pernah memutasi sesi pada rute API agar tidak memicu INSERT INTO sessions sia-sia
  if (req.path.startsWith('/api/') || req.originalUrl.startsWith('/api/')) {
    const existingToken = (req.session as any).csrfToken || '';
    res.locals.csrfToken = existingToken;
    req.csrfToken = () => existingToken;
    return next();
  }

  // Halaman baca publik anonim tidak memiliki form POST; hindari membuat baris sesi di MySQL
  if (
    !req.session.user &&
    ['GET', 'HEAD', 'OPTIONS'].includes(req.method) &&
    (req.path === '/' || req.path === '/jadwal')
  ) {
    const existingToken = (req.session as any).csrfToken || '';
    res.locals.csrfToken = existingToken;
    req.csrfToken = () => existingToken;
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
