import { Telegraf } from 'telegraf';
import { message } from 'telegraf/filters';
import { env } from '../utils/env';
import { logger } from '../utils/logger';
import { accessMiddleware } from './middlewares/access.middleware';
import { startCommand } from './commands/start.command';
import { helpCommand } from './commands/help.command';
import { activarCommand } from './commands/activar.command';
import { resumenCommand, categoriasCommand } from './commands/summary.command';
import { exportarCommand } from './commands/export.command';
import { textHandler } from './handlers/text.handler';
import { voiceHandler } from './handlers/voice.handler';

const BOT_COMMANDS = [
  { command: 'start', description: 'Iniciar el bot' },
  { command: 'activar', description: 'Activar acceso con código' },
  { command: 'help', description: 'Ver guía de uso' },
  { command: 'resumen', description: 'Ver resumen financiero' },
  { command: 'categorias', description: 'Ver gastos por categoría' },
  { command: 'exportar', description: 'Descargar reporte Excel con IA' },
];

export function createBot(): Telegraf {
  const bot = new Telegraf(env.BOT_TOKEN);

  // 1. Global debug middleware
  bot.use(async (ctx, next) => {
    console.log(`[DEBUG] Update recibido: ${ctx.updateType}`);
    if (ctx.message && 'voice' in ctx.message) {
      console.log(`[DEBUG] 🚨 ¡Es un mensaje de voz! Duración: ${ctx.message.voice.duration}s`);
    }
    return next();
  });

  // 2. Access guard — runs before everything except /start and /activar
  bot.use(accessMiddleware);

  // 3. Exempt commands (always reachable regardless of hasAccess)
  bot.command('start', startCommand);
  bot.command('activar', activarCommand);

  // 4. Protected commands (only reachable if accessMiddleware called next())
  bot.command('help', helpCommand);
  bot.command('resumen', resumenCommand);
  bot.command('categorias', categoriasCommand);
  bot.command('exportar', exportarCommand);

  // 5. Voice — string-based filter
  bot.on('voice', async (ctx) => {
    console.log('\n🚨 [AUDIOCATCHER] ¡Nota de voz interceptada con éxito!');
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await voiceHandler(ctx as any);
    } catch (error) {
      console.error('Error en el handler de voz:', error);
    }
  });

  // 6. Free-text (protected by accessMiddleware above)
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
