import { Telegraf } from 'telegraf';
import { env } from '../utils/env';
import { logger } from '../utils/logger';
import { startCommand } from './commands/start.command';

export function createBot(): Telegraf {
  const bot = new Telegraf(env.BOT_TOKEN);

  bot.command('start', startCommand);

  bot.catch((err: unknown) => {
    logger.error('Unhandled bot error', err);
  });

  return bot;
}

export async function launchBot(bot: Telegraf): Promise<void> {
  process.once('SIGINT', () => {
    void bot.stop('SIGINT');
  });
  process.once('SIGTERM', () => {
    void bot.stop('SIGTERM');
  });

  await bot.launch();
  logger.info('Bot launched successfully');
}
