import type { Context } from 'telegraf';
import { findOrCreateUser } from '../../services/user.service';
import { logger } from '../../utils/logger';

export async function startCommand(ctx: Context): Promise<void> {
  const from = ctx.from;
  if (!from) {
    await ctx.reply('No se pudo identificar al usuario.');
    return;
  }

  try {
    const user = await findOrCreateUser({
      telegramId: BigInt(from.id),
      username: from.username,
      firstName: from.first_name,
      lastName: from.last_name,
    });

    logger.info(`User registered: ${user.telegramId.toString()}`);
    await ctx.reply(`¡Hola, ${user.firstName}! Bienvenido al bot.`);
  } catch (error) {
    logger.error('Error in /start command', error);
    await ctx.reply('Ocurrió un error. Por favor intenta de nuevo.');
  }
}
