import type { Config } from 'drizzle-kit';

export default {
  schema: './schema/schema.ts',
  out: './schema/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL || 'postgresql://localhost:5432/decision_logger',
  },
  verbose: true,
  strict: true,
} satisfies Config;
