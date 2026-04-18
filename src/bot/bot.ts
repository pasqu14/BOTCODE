import { Telegraf } from 'telegraf';
import { message } from 'telegraf/filters';
import { env } from '../utils/env';
import { logger } from '../utils/logger';
import { startCommand } from './commands/start.command';
import { helpCommand } from './commands/help.command';
import { resumenCommand, categoriasCommand } from './commands/summary.command';
import { textHandler } from './handlers/text.handler';
import { voiceHandler } from './handlers/voice.handler';

const BOT_COMMANDS = [
  { command: 'start', description: 'Iniciar el bot' },
  { command: 'help', description: 'Ver guía de uso' },
  { command: 'resumen', description: 'Ver resumen financiero' },
  { command: 'categorias', description: 'Ver gastos por categoría' },
  { command: 'balance', description: 'Ver balance del mes' },
  { command: 'export', description: 'Descargar Excel con transacciones' },
];

export function createBot(): Telegraf {
  const bot = new Telegraf(env.BOT_TOKEN);

  // Commands — must be registered before generic text listener
  bot.command('start', startCommand);
  bot.command('help', helpCommand);
  bot.command('resumen', resumenCommand);
  bot.command('categorias', categoriasCommand);

  // Message listeners
  bot.on(message('voice'), voiceHandler);
  bot.on(message('text'), textHandler);

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
