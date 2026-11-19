import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DB_HOST: z.string().default(process.env.MYSQLHOST || 'localhost'),
  DB_PORT: z.coerce.number().default(Number(process.env.MYSQLPORT) || 3306),
  DB_USER: z.string().default(process.env.MYSQLUSER || 'root'),
  DB_PASSWORD: z.string().default(process.env.MYSQLPASSWORD || ''),
  DB_NAME: z.string().default(process.env.MYSQLDATABASE || 'db_tiket'),
  DB_POOL_LIMIT: z.coerce.number().int().min(1).max(50).default(5),
  SESSION_SECRET: z.string().default('secret-travel-session-key-12345'),
  EXPIRY_INTERVAL_MS: z.coerce.number().int().min(0).default(300_000),
});

export const env = envSchema.parse(process.env);

