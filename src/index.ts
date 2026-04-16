import { connectDatabase, disconnectDatabase } from './database/client';
import { createBot, launchBot } from './bot/bot';
import { logger } from './utils/logger';

async function main(): Promise<void> {
  logger.info('Starting application...');

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
