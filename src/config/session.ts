import session from 'express-session';
import MySQLSessionStore from 'express-mysql-session';
import { env } from './env.js';
import { pool } from './database.js';

const MySQLStore = MySQLSessionStore(session as any);

const sessionStoreOptions = {
  createDatabaseTable: true,
  clearExpired: true,
  checkExpirationInterval: 60 * 60 * 1000, // 1 jam (hemat CPU/IOPS MySQL)
  expiration: 24 * 60 * 60 * 1000,
  disableTouch: true, // Hindari UPDATE sessions pada setiap request baca
  endConnectionOnClose: false, // Pool dikelola terpusat oleh database.ts
  schema: {
    tableName: 'sessions',
    columnNames: {
      session_id: 'session_id',
      expires: 'expires',
      data: 'data'
    }
  }
};

export const sessionStore = new (MySQLStore as any)(sessionStoreOptions, pool as any);

export const sessionMiddleware = session({
  name: 'travel_sid',
  secret: env.SESSION_SECRET,
  store: sessionStore,
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 1000 * 60 * 60 * 24, // 24 jam
    httpOnly: true,
    sameSite: 'lax',
    secure: env.NODE_ENV === 'production'
  }
});
