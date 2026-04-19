import { PrismaClient } from '../../generated/prisma';
import { PrismaNeon } from '@prisma/adapter-neon';
import { neonConfig } from '@neondatabase/serverless';
import ws from 'ws';
import { env } from '../utils/env';
import { logger } from '../utils/logger';

// Conectar a Neon vía WebSockets (puerto 443) para evitar el bloqueo del ISP en el 5432
neonConfig.webSocketConstructor = ws;

// En @prisma/adapter-neon v7+, PrismaNeon recibe el config directamente, no un Pool
const adapter = new PrismaNeon({ connectionString: env.DATABASE_URL });

export const prisma = new PrismaClient({
  adapter,
  log: [
    { emit: 'event', level: 'error' },
    { emit: 'event', level: 'warn' },
  ],
});

prisma.$on('error', (e: unknown) => {
  logger.error('Prisma error', e);
});

export async function connectDatabase(): Promise<void> {
  await prisma.$connect();
  logger.info('Database connected');
}

export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
  logger.info('Database disconnected');
}
