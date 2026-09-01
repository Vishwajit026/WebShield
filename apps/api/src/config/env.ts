import dotenv from 'dotenv';
import path from 'path';

// Load .env from monorepo root (if present) or local
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config(); // fallback to local .env

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

const config = {
  nodeEnv: (process.env.NODE_ENV ?? 'development') as 'development' | 'production' | 'test',
  port: parseInt(process.env.PORT ?? '5000', 10),
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  database: {
    url: process.env.DATABASE_URL ?? '',
  },
  jwt: {
    get secret(): string {
      return requireEnv('JWT_SECRET');
    },
    get refreshSecret(): string {
      return requireEnv('REFRESH_TOKEN_SECRET');
    },
    accessExpiresIn: process.env.ACCESS_TOKEN_EXPIRES_IN ?? '15m',
    refreshExpiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN ?? '7d',
    refreshExpiresInMs: () => {
      const val = process.env.REFRESH_TOKEN_EXPIRES_IN ?? '7d';
      const days = parseInt(val.replace('d', ''), 10);
      return days * 24 * 60 * 60 * 1000;
    },
  },
  // Phase 3
  scanner: {
    timeout: parseInt(process.env.SCAN_TIMEOUT ?? '10000', 10),
    maxRequests: parseInt(process.env.MAX_SCAN_REQUESTS ?? '10', 10),
  },
  // Development seed
  devAdminPassword: process.env.DEV_ADMIN_PASSWORD ?? '',
} as const;

export default config;
