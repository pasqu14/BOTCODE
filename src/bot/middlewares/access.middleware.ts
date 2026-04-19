import type { Context } from 'telegraf';
import { prisma } from '../../database/client';
import { logger } from '../../utils/logger';

const EXEMPT_PREFIXES = ['/start', '/activar'];

function isExemptCommand(ctx: Context): boolean {
  if (!ctx.message || !('text' in ctx.message)) {
    return false;
  }
  const text = ctx.message.text.toLowerCase();
  return EXEMPT_PREFIXES.some((prefix) => text.startsWith(prefix));
}

export async function accessMiddleware(
  ctx: Context,
  next: () => Promise<void>,
): Promise<void> {
  // Never block exempt commands
  if (isExemptCommand(ctx)) {
    return next();
  }

  const from = ctx.from;
  if (!from) {
    return next();
  }

  try {
    const user = await prisma.user.findUnique({
      where: { telegramId: BigInt(from.id) },
      select: { hasAccess: true },
    });

    if (user?.hasAccess === true) {
      return next();
    }

    await ctx.replyWithHTML(
      `🔒 <b>Acceso Premium Requerido</b>\n\n` +
        `Este bot es un servicio exclusivo. Para desbloquearlo necesitas un código de activación.\n\n` +
        `Si ya tienes un código, úsalo así:\n` +
        `<code>/activar TU_CÓDIGO</code>\n\n` +
        `Si aún no tienes uno, contacta al administrador para adquirirlo.`,
    );
  } catch (error) {
    logger.error('Error in accessMiddleware', error);
    return next();
  }
}
