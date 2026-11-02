import { Request, Response, NextFunction } from 'express';
import multer from 'multer';

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).render('public/404', {
    title: 'Halaman Tidak Ditemukan - 404',
    url: req.originalUrl,
    user: req.session?.user || null
  });
}

export function errorHandler(err: any, req: Request, res: Response, _next: NextFunction) {
  console.error('[Application Error]:', err);

  let userMessage = 'Terjadi kesalahan pada sistem. Silakan coba kembali beberapa saat lagi.';

  // Tangani error Multer (ukuran file melebihi batas)
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      userMessage = 'Ukuran berkas melebihi batas maksimal 3MB.';
    } else {
      userMessage = `Kesalahan unggah berkas: ${err.message}`;
    }
  } else if (err.sqlState === '45000') {
    // Tangani custom SQLSTATE 45000 dari Stored Procedure
    userMessage = err.sqlMessage || err.message || 'Operasi transaksi ditolak oleh sistem.';
  } else if (err.code === 'ER_DUP_ENTRY' || err.sqlState === '23000') {
    userMessage = 'Data atau referensi yang Anda masukkan sudah terdaftar di sistem.';
  } else if (err.message) {
    userMessage = err.message;
  }

  // Jika request menghendaki JSON atau AJAX
  if (req.xhr || req.headers.accept?.includes('application/json')) {
    return res.status(err.status || 500).json({
      success: false,
      message: userMessage
    });
  }

  // Redirect kembali dengan flash notification jika tersedia referer
  const referer = req.header('Referer');
  if (req.flash && referer && req.method === 'POST') {
    req.flash('error', userMessage);
    return res.redirect(referer);
  }

  res.status(err.status || 500).render('public/500', {
    title: 'Terjadi Kesalahan Sistem - 500',
    message: userMessage,
    error: process.env.NODE_ENV === 'development' ? err : {},
    user: req.session?.user || null
  });
}

