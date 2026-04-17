import { Telegraf } from 'telegraf';
import { env } from '../utils/env';
import { logger } from '../utils/logger';
import { startCommand } from './commands/start.command';
import { helpCommand } from './commands/help.command';

const BOT_COMMANDS = [
  { command: 'start', description: 'Iniciar el bot' },
  { command: 'help', description: 'Ver guía de uso' },
  { command: 'balance', description: 'Ver resumen del mes' },
  { command: 'export', description: 'Descargar Excel con transacciones' },
];

export function createBot(): Telegraf {
  const bot = new Telegraf(env.BOT_TOKEN);

  bot.command('start', startCommand);
  bot.command('help', helpCommand);

  bot.catch((err: unknown) => {
    logger.error('Unhandled bot error', err);
  });

  return bot;
}

export async function launchBot(bot: Telegraf): Promise<void> {
  await bot.telegram.setMyCommands(BOT_COMMANDS);
  logger.info('Bot commands registered');

  process.once('SIGINT', () => {
    void bot.stop('SIGINT');
  });
  process.once('SIGTERM', () => {
    void bot.stop('SIGTERM');
  });

  await bot.launch();
  logger.info('Bot launched successfully');
}
