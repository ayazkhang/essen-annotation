import path from 'node:path';
import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';

// Load backend/.env when present (Docker injects env vars directly).
loadDotenv({ path: path.resolve(process.cwd(), '.env') });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3001),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  UPLOAD_DIR: z.string().default('./uploads'),
  MAX_UPLOAD_BYTES: z.coerce.number().int().positive().default(50 * 1024 * 1024),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  const details = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
  throw new Error(`Invalid environment configuration: ${details}`);
}

const data = parsed.data;

export const env = {
  ...data,
  uploadRoot: path.resolve(data.UPLOAD_DIR),
} as const;

export type Env = typeof env;
