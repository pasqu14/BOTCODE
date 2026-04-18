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

  // Global debug middleware — first in chain
  bot.use(async (ctx, next) => {
    console.log(`[DEBUG] Update recibido: ${ctx.updateType}`);
    if (ctx.message && 'voice' in ctx.message) {
      console.log(`[DEBUG] 🚨 ¡Es un mensaje de voz! Duración: ${ctx.message.voice.duration}s`);
    }
    return next();
  });

  // Voice — string-based filter, registered immediately after debug middleware
  bot.on('voice', async (ctx) => {
    console.log('\n🚨 [AUDIOCATCHER] ¡Nota de voz interceptada con éxito!');
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await voiceHandler(ctx as any);
    } catch (error) {
      console.error('Error en el handler de voz:', error);
    }
  });

  // Commands
  bot.command('start', startCommand);
  bot.command('help', helpCommand);
  bot.command('resumen', resumenCommand);
  bot.command('categorias', categoriasCommand);

  // Text
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

  // No allowedUpdates restriction — all update types received including voice
  await bot.launch();
  logger.info('Bot launched successfully');
}
