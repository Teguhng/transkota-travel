import { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { apiError } from '../types/api.types.js';

function isApiRequest(req: Request): boolean {
  return req.path.startsWith('/api/') || req.originalUrl.startsWith('/api/');
}

function mapApiError(err: any): {
  status: number;
  code: string;
  message: string;
} {
  if (err instanceof multer.MulterError) {
    return {
      status: 400,
      code: 'UPLOAD_ERROR',
      message:
        err.code === 'LIMIT_FILE_SIZE'
          ? 'Ukuran berkas melebihi batas maksimal 3MB.'
          : `Kesalahan unggah berkas: ${err.message}`,
    };
  }

  if (err?.sqlState === '45000') {
    return {
      status: 422,
      code: 'BUSINESS_RULE_VIOLATION',
      message:
        err.sqlMessage || err.message || 'Operasi transaksi ditolak oleh sistem.',
    };
  }

  if (err?.code === 'ER_DUP_ENTRY' || err?.sqlState === '23000') {
    return {
      status: 409,
      code: 'CONFLICT',
      message: 'Data atau referensi yang Anda masukkan sudah terdaftar di sistem.',
    };
  }

  const rawMsg = typeof err?.message === 'string' ? err.message : '';
  const lowerMsg = rawMsg.toLowerCase();

  if (
    typeof err?.status === 'number' &&
    err.status >= 400 &&
    err.status < 500
  ) {
    return {
      status: err.status,
      code: err.code || 'BAD_REQUEST',
      message: rawMsg || 'Permintaan tidak valid.',
    };
  }

  if (lowerMsg.includes('format berkas tidak didukung')) {
    return {
      status: 400,
      code: 'INVALID_FILE_TYPE',
      message: rawMsg,
    };
  }

  if (
    lowerMsg.includes('tidak memiliki akses') ||
    lowerMsg.includes('akses ditolak')
  ) {
    return {
      status: 403,
      code: 'FORBIDDEN',
      message: rawMsg,
    };
  }

  if (lowerMsg.includes('tidak ditemukan')) {
    return {
      status: 404,
      code: 'NOT_FOUND',
      message: rawMsg,
    };
  }

  // Jangan pernah membocorkan stack trace, SQL query, atau detail sistem internal pada 500
  return {
    status: 500,
    code: 'INTERNAL_SERVER_ERROR',
    message:
      'Terjadi kesalahan pada sistem. Silakan coba kembali beberapa saat lagi.',
  };
}

export function notFoundHandler(req: Request, res: Response) {
  if (isApiRequest(req)) {
    return res
      .status(404)
      .json(
        apiError(
          'NOT_FOUND',
          `Endpoint ${req.method} ${req.originalUrl} tidak ditemukan.`
        )
      );
  }

  res.status(404).render('public/404', {
    title: 'Halaman Tidak Ditemukan - 404',
    url: req.originalUrl,
    user: req.session?.user || null
  });
}

export function errorHandler(err: any, req: Request, res: Response, _next: NextFunction) {
  console.error('[Application Error]:', err);

  if (isApiRequest(req)) {
    const mapped = mapApiError(err);
    return res
      .status(mapped.status)
      .json(apiError(mapped.code, mapped.message));
  }

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

