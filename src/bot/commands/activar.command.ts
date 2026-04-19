import type { Context } from 'telegraf';
import type { Message } from 'telegraf/types';
import { prisma } from '../../database/client';
import { logger } from '../../utils/logger';

export async function activarCommand(ctx: Context): Promise<void> {
  const msg = ctx.message as Message.TextMessage | undefined;
  const parts = msg?.text?.trim().split(/\s+/) ?? [];
  const code = parts[1]?.toUpperCase();
  const from = ctx.from;

  if (!from) {
    await ctx.reply('❌ No pude identificar tu usuario.');
    return;
  }

  if (!code) {
    await ctx.replyWithHTML(
      `❓ <b>Código no especificado</b>\n\n` +
        `Uso correcto:\n<code>/activar TU_CÓDIGO</code>`,
    );
    return;
  }

  try {
    // Find or create user first
    const user = await prisma.user.findUnique({
      where: { telegramId: BigInt(from.id) },
    });

    if (!user) {
      await ctx.reply(
        '👋 Primero debes registrarte. Ejecuta /start y luego vuelve a intentarlo.',
      );
      return;
    }

    if (user.hasAccess) {
      await ctx.replyWithHTML(
        `✅ <b>Ya tienes acceso premium activo.</b>\n\nDisfruta todas las funciones del bot.`,
      );
      return;
    }

    // Validate the code
    const activationCode = await prisma.activationCode.findUnique({
      where: { code },
    });

    if (!activationCode) {
      await ctx.replyWithHTML(
        `❌ <b>Código inválido.</b>\n\n` +
          `El código <code>${code}</code> no existe. Verifica que lo hayas escrito correctamente.`,
      );
      return;
    }

    if (activationCode.isUsed) {
      await ctx.replyWithHTML(
        `🚫 <b>Código ya utilizado.</b>\n\n` +
          `Este código ya fue canjeado previamente. ` +
          `Si crees que es un error, contacta al administrador.`,
      );
      return;
    }

    // Atomic transaction: burn code + grant access
    await prisma.$transaction([
      prisma.activationCode.update({
        where: { id: activationCode.id },
        data: {
          isUsed: true,
          usedById: user.id,
          usedAt: new Date(),
        },
      }),
      prisma.user.update({
        where: { id: user.id },
        data: { hasAccess: true },
      }),
    ]);

    logger.info(`Access granted to user ${user.telegramId.toString()} via code ${code}`);

    await ctx.replyWithHTML(
      `🎉 <b>¡Acceso activado con éxito!</b>\n\n` +
        `Bienvenido al servicio premium, ${user.firstName}.\n\n` +
        `✅ Tu código ha sido registrado y tu cuenta está ahora desbloqueada.\n\n` +
        `<b>Comandos disponibles:</b>\n` +
        `📝 Escribe cualquier gasto en lenguaje natural\n` +
        `📊 /resumen — Ver tu balance\n` +
        `🏷️ /categorias — Gastos por categoría\n` +
        `📥 /exportar — Descargar reporte Excel`,
    );
  } catch (error) {
    logger.error('Error in /activar command', error);
    await ctx.reply('❌ Ocurrió un error al procesar tu código. Intenta de nuevo.');
  }
}
