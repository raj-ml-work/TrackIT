import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const readEnv = (key, fallback) => {
  const value = process.env[key];
  return value === undefined || value === '' ? fallback : value;
};

const parseDurationMs = (value) => {
  if (typeof value === 'number') return value;
  if (!value) return 0;

  const trimmed = String(value).trim();
  if (/^\d+$/.test(trimmed)) {
    return Number(trimmed) * 1000;
  }

  const match = trimmed.match(/^(\d+)(ms|s|m|h|d)$/i);
  if (!match) {
    throw new Error(`Invalid duration: ${value}`);
  }

  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();
  const multipliers = {
    ms: 1,
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000
  };

  return amount * multipliers[unit];
};

const accessTtl = readEnv('JWT_ACCESS_TTL', '15m');
const refreshTtl = readEnv('JWT_REFRESH_TTL', '1d');

export const config = {
  env: readEnv('NODE_ENV', 'development'),
  host: readEnv('HOST', '0.0.0.0'),
  port: Number(readEnv('PORT', '4000')),
  dbProvider: readEnv('DB_PROVIDER', 'sqlite'),
  pgUrl: readEnv('PG_URL', readEnv('DATABASE_URL', '')),
  sqlitePath: readEnv(
    'SQLITE_PATH',
    path.resolve(__dirname, '..', '..', 'data', 'inventory.db')
  ),
  corsOrigin: readEnv('CORS_ORIGIN', 'http://localhost:5173'),
  corsOrigins: readEnv('CORS_ORIGIN', 'http://localhost:5173')
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean),
  jwt: {
    accessSecret: readEnv('JWT_ACCESS_SECRET', 'dev_access_secret_change_me'),
    refreshSecret: readEnv('JWT_REFRESH_SECRET', 'dev_refresh_secret_change_me'),
    accessTtl,
    refreshTtl,
    accessTtlMs: parseDurationMs(accessTtl),
    refreshTtlMs: parseDurationMs(refreshTtl)
  },
  defaults: {
    adminEmail: readEnv('DEFAULT_ADMIN_EMAIL', 'admin@trackit.com'),
    adminPassword: readEnv('DEFAULT_ADMIN_PASSWORD', 'admin123')
  }
};

export { parseDurationMs };
