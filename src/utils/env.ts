import 'dotenv/config';

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

export const env = {
  BOT_TOKEN: requireEnv('BOT_TOKEN'),
  DATABASE_URL: requireEnv('DATABASE_URL'),
  GROQ_API_KEY: requireEnv('GROQ_API_KEY'),
  ADMIN_TELEGRAM_ID: requireEnv('ADMIN_TELEGRAM_ID'),
  NODE_ENV: process.env['NODE_ENV'] ?? 'development',
};
