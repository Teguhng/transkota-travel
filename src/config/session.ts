import session from 'express-session';
import MySQLSessionStore from 'express-mysql-session';
import { env } from './env.js';

const MySQLStore = MySQLSessionStore(session as any);

const sessionStoreOptions = {
  host: env.DB_HOST,
  port: env.DB_PORT,
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  database: env.DB_NAME,
  createDatabaseTable: true,
  schema: {
    tableName: 'sessions',
    columnNames: {
      session_id: 'session_id',
      expires: 'expires',
      data: 'data'
    }
  }
};

export const sessionStore = new MySQLStore(sessionStoreOptions);

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
