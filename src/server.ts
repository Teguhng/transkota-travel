import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import crypto from 'crypto';
import expressLayouts from 'express-ejs-layouts';
import flash from 'connect-flash';
import { env } from './config/env.js';
import { sessionMiddleware, sessionStore } from './config/session.js';
import { csrfMiddleware } from './middlewares/csrf.middleware.js';
import { compressionMiddleware } from './middlewares/compression.middleware.js';
import { errorHandler, notFoundHandler } from './middlewares/error.middleware.js';
import { appRouter } from './routes/index.js';
import { startExpiryWorker, stopExpiryWorker } from './services/expiry.worker.js';
import { pool } from './config/database.js';
import { ensureDatabaseInitialized } from './scripts/initDb.js';
import { ensureUpcomingSchedules } from './scripts/seedDemoSchedules.js';
import { ensureDemoPasswordsSeeded } from './scripts/seedPasswords.js';

export const app = express();

// Wajib agar cookie secure bekerja di belakang reverse proxy HTTPS (Railway/Vercel)
app.set('trust proxy', 1);

// Telemetri ringkas low-cardinality (log hanya saat >=500 atau lambat >=250ms)
app.use((req: Request, res: Response, next: NextFunction) => {
  const requestId =
    (typeof req.headers['x-request-id'] === 'string' && req.headers['x-request-id']) ||
    crypto.randomUUID();
  res.setHeader('X-Request-Id', requestId);
  const startNs = process.hrtime.bigint();

  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startNs) / 1_000_000;
    if (res.statusCode >= 500 || durationMs >= 250) {
      const routeTemplate = req.route?.path
        ? `${req.baseUrl || ''}${req.route.path}`
        : req.path.replace(/\/\d+/g, '/:id');
      console.log(
        JSON.stringify({
          level: res.statusCode >= 500 ? 'error' : 'warn',
          method: req.method,
          route: routeTemplate,
          status: res.statusCode,
          duration_ms: Math.round(durationMs * 100) / 100,
          request_id: requestId,
        })
      );
    }
  });

  next();
});

// Kompresi gzip ringan untuk mengurangi public egress
app.use(compressionMiddleware);

// Konfigurasi parser body
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Konfigurasi berkas statis publik (CSS, JS, Asset) dengan cache header produksi
app.use(
  express.static(path.resolve(process.cwd(), 'public'), {
    maxAge: env.NODE_ENV === 'production' ? '7d' : 0,
    etag: true,
  })
);

// Konfigurasi view engine EJS & layout modular
app.set('views', path.resolve(process.cwd(), 'views'));
app.set('view engine', 'ejs');
app.use(expressLayouts);
app.set('layout', 'layouts/main');
app.set('layout extractScripts', true);
app.set('layout extractStyles', true);

function isStatelessApiRequest(req: Request): boolean {
  if (req.path === '/api/v1/health') {
    return true;
  }
  if (!req.path.startsWith('/api/')) {
    return false;
  }
  return (
    typeof req.headers.authorization === 'string' ||
    !req.headers.cookie?.includes('travel_sid')
  );
}

// Konfigurasi Session & Flash Messages (lewati untuk request API stateless agar DB sessions tidak membengkak)
const flashMiddleware = flash();
app.use((req, res, next) => {
  if (isStatelessApiRequest(req)) {
    return next();
  }
  sessionMiddleware(req, res, (err) => {
    if (err) return next(err);
    return flashMiddleware(req, res, next);
  });
});
app.use(csrfMiddleware);

// Middleware injeksi konteks global ke template EJS
app.use((req, res, next) => {
  res.locals.user = req.session?.user || null;
  res.locals.csrfToken = req.session?.csrfToken || '';
  res.locals.currentPath = req.path;
  res.locals.flash =
    typeof req.flash === 'function'
      ? {
          success: req.flash('success'),
          error: req.flash('error'),
          info: req.flash('info')
        }
      : { success: [], error: [], info: [] };
  next();
});

// Daftarkan seluruh rute sistem
app.use(appRouter);

// Tangani halaman 404 & Central Error Handling
app.use(notFoundHandler);
app.use(errorHandler);

// Inisialisasi schema database (idempoten) lalu jalankan worker & HTTP server
const PORT = env.PORT || 3000;
let server: ReturnType<typeof app.listen> | null = null;

async function bootstrap() {
  try {
    await ensureDatabaseInitialized();
    await ensureDemoPasswordsSeeded();
    await ensureUpcomingSchedules(60);
  } catch (err) {
    console.error('[Bootstrap] Gagal menginisialisasi database:', err);
    process.exit(1);
  }

  startExpiryWorker(env.EXPIRY_INTERVAL_MS);

  server = app.listen(PORT, () => {
    console.log(`[Server] Travel Booking Monolith berjalan aktif pada http://localhost:${PORT}`);
    console.log(`[Environment] Mode: ${env.NODE_ENV} | Database: ${env.DB_HOST}:${env.DB_PORT}/${env.DB_NAME}`);
  });
}

bootstrap();

// Graceful shutdown handling
const handleGracefulShutdown = async (signal: string) => {
  console.log(`[Server] Menerima sinyal ${signal}. Memulai penutupan server secara bertahap...`);
  stopExpiryWorker();

  const closeConnections = async () => {
    console.log('[Server] Koneksi HTTP tertutup.');
    try {
      await sessionStore.close().catch(() => {});
      await pool.end();
      console.log('[Database] Pool koneksi database berhasil ditutup.');
      process.exit(0);
    } catch (err) {
      console.error('[Database] Gagal menutup pool koneksi:', err);
      process.exit(1);
    }
  };

  if (server) {
    server.close(closeConnections);
  } else {
    await closeConnections();
  }
};

process.on('SIGTERM', () => handleGracefulShutdown('SIGTERM'));
process.on('SIGINT', () => handleGracefulShutdown('SIGINT'));

export default app;
