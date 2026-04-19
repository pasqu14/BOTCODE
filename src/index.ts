import http from 'http';
import { connectDatabase, disconnectDatabase } from './database/client';
import { createBot, launchBot } from './bot/bot';
import { logger } from './utils/logger';

// Servidor HTTP mínimo para que Render detecte el puerto y no mate el proceso
function startHealthServer(): void {
  const port = process.env['PORT'] ?? '3000';
  const server = http.createServer((_req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('OK');
  });
  server.listen(Number(port), () => {
    logger.info(`Health check server listening on port ${port}`);
  });
}

async function main(): Promise<void> {
  logger.info('Starting application...');

  startHealthServer();
  await connectDatabase();

  const bot = createBot();
  await launchBot(bot);

  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled rejection', reason);
    void disconnectDatabase().then(() => process.exit(1));
  });
}

main().catch((error) => {
  logger.error('Fatal error during startup', error);
  process.exit(1);
});
