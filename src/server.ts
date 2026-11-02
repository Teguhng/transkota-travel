import express from 'express';
import path from 'path';
import expressLayouts from 'express-ejs-layouts';
import flash from 'connect-flash';
import { env } from './config/env.js';
import { sessionMiddleware } from './config/session.js';
import { csrfMiddleware } from './middlewares/csrf.middleware.js';
import { errorHandler, notFoundHandler } from './middlewares/error.middleware.js';
import { appRouter } from './routes/index.js';
import { startExpiryWorker, stopExpiryWorker } from './services/expiry.worker.js';
import { pool } from './config/database.js';

const app = express();

// Konfigurasi parser body
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Konfigurasi berkas statis publik (CSS, JS, Asset)
app.use(express.static(path.resolve(process.cwd(), 'public')));

// Konfigurasi view engine EJS & layout modular
app.set('views', path.resolve(process.cwd(), 'views'));
app.set('view engine', 'ejs');
app.use(expressLayouts);
app.set('layout', 'layouts/main');
app.set('layout extractScripts', true);
app.set('layout extractStyles', true);

// Konfigurasi Session & Flash Messages
app.use(sessionMiddleware);
app.use(flash());
app.use(csrfMiddleware);

// Middleware injeksi konteks global ke template EJS
app.use((req, res, next) => {
  res.locals.user = req.session?.user || null;
  res.locals.csrfToken = req.session?.csrfToken || '';
  res.locals.currentPath = req.path;
  res.locals.flash = {
    success: req.flash('success'),
    error: req.flash('error'),
    info: req.flash('info')
  };
  next();
});

// Daftarkan seluruh rute sistem
app.use(appRouter);

// Tangani halaman 404 & Central Error Handling
app.use(notFoundHandler);
app.use(errorHandler);

// Inisialisasi background worker pembersih kursi kedaluwarsa (setiap 5 menit)
startExpiryWorker(300_000);

// Mulai HTTP server
const PORT = env.PORT || 3000;
const server = app.listen(PORT, () => {
  console.log(`[Server] Travel Booking Monolith berjalan aktif pada http://localhost:${PORT}`);
  console.log(`[Environment] Mode: ${env.NODE_ENV} | Database: ${env.DB_HOST}:${env.DB_PORT}/${env.DB_NAME}`);
});

// Graceful shutdown handling
const handleGracefulShutdown = async (signal: string) => {
  console.log(`[Server] Menerima sinyal ${signal}. Memulai penutupan server secara bertahap...`);
  stopExpiryWorker();
  
  server.close(async () => {
    console.log('[Server] Koneksi HTTP tertutup.');
    try {
      await pool.end();
      console.log('[Database] Pool koneksi database berhasil ditutup.');
      process.exit(0);
    } catch (err) {
      console.error('[Database] Gagal menutup pool koneksi:', err);
      process.exit(1);
    }
  });
};

process.on('SIGTERM', () => handleGracefulShutdown('SIGTERM'));
process.on('SIGINT', () => handleGracefulShutdown('SIGINT'));
