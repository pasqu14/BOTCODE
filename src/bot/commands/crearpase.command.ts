import type { Context } from 'telegraf';
import type { Message } from 'telegraf/types';
import { prisma } from '../../database/client';
import { env } from '../../utils/env';
import { logger } from '../../utils/logger';

function isAdmin(ctx: Context): boolean {
  return ctx.from?.id.toString() === env.ADMIN_TELEGRAM_ID;
}

export async function crearPaseCommand(ctx: Context): Promise<void> {
  // Silent ignore for non-admins — no error, no acknowledgement
  if (!isAdmin(ctx)) {
    return;
  }

  const msg = ctx.message as Message.TextMessage | undefined;
  const parts = msg?.text?.trim().split(/\s+/) ?? [];
  const rawCode = parts[1];

  if (!rawCode) {
    await ctx.replyWithHTML(
      `⚙️ <b>Uso correcto:</b>\n<code>/crearpase NOMBRE_DEL_CODIGO</code>\n\n` +
        `Ejemplo: <code>/crearpase BETA-2025-VIP01</code>`,
    );
    return;
  }

  const code = rawCode.toUpperCase().trim();

  // Validate format: alphanumeric + hyphens, 4–32 chars
  if (!/^[A-Z0-9\-]{4,32}$/.test(code)) {
    await ctx.replyWithHTML(
      `⚠️ <b>Formato inválido.</b>\n\n` +
        `El código solo puede contener letras, números y guiones (<code>-</code>), ` +
        `y debe tener entre 4 y 32 caracteres.`,
    );
    return;
  }

  try {
    const existing = await prisma.activationCode.findUnique({
      where: { code },
    });

    if (existing) {
      const status = existing.isUsed
        ? `🔴 ya fue canjeado el ${existing.usedAt?.toLocaleDateString('es-AR') ?? '?'}`
        : `🟡 existe pero aún no fue usado`;
      await ctx.replyWithHTML(
        `⚠️ <b>Código duplicado.</b>\n\n` +
          `El código <code>${code}</code> ${status}.\n` +
          `Elige un nombre diferente.`,
      );
      return;
    }

    await prisma.activationCode.create({ data: { code } });

    logger.info(`Admin created activation code: ${code}`);

    await ctx.replyWithHTML(
      `✅ <b>Pase creado con éxito.</b>\n\n` +
        `🔑 Código: <code>${code}</code>\n\n` +
        `Este código está listo para ser vendido.\n` +
        `El cliente lo canjea con:\n<code>/activar ${code}</code>`,
    );
  } catch (error) {
    logger.error('Error creating activation code', error);
    await ctx.reply('❌ Error al crear el código. Revisa los logs del servidor.');
  }
}
