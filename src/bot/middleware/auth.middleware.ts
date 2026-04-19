import type { Context } from 'telegraf';
import { prisma } from '../../database/client';
import { logger } from '../../utils/logger';

// Comandos que siempre pasan sin importar el estado de la cuenta
const PUBLIC_COMMANDS = ['/start', '/activar', '/crearpase', '/test'];

export async function authMiddleware(ctx: Context, next: () => Promise<void>): Promise<void> {
  if (!ctx.from) return next();

  // Detectar si es un comando público
  const text = ctx.message && 'text' in ctx.message ? ctx.message.text ?? '' : '';
  const isPublic = PUBLIC_COMMANDS.some((cmd) => text.startsWith(cmd));
  if (isPublic) return next();

  // Verificar si el usuario tiene acceso
  const telegramId = BigInt(ctx.from.id);
  const user = await prisma.user.findUnique({ where: { telegramId } });

  if (!user || !user.isActive) {
    logger.info(`Acceso denegado para ${telegramId}`);
    await ctx.reply(
      '🔒 *Acceso restringido*\n\n' +
        'Este bot es de uso privado. Para acceder necesitás un código de activación.\n\n' +
        'Si ya tenés uno, usá:\n`/activar TU_CODIGO`',
      { parse_mode: 'Markdown' },
    );
    return;
  }

  return next();
}
