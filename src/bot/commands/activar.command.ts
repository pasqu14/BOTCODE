import type { Context } from 'telegraf';
import type { Message } from 'telegraf/types';
import { prisma } from '../../database/client';
import { findOrCreateUser } from '../../services/user.service';
import { logger } from '../../utils/logger';

export async function activarCommand(ctx: Context): Promise<void> {
  const from = ctx.from;
  const msg = ctx.message as Message.TextMessage | undefined;
  if (!from || !msg) return;

  const parts = msg.text.trim().split(/\s+/);
  const code = parts[1]?.toUpperCase();

  if (!code) {
    await ctx.reply(
      '❓ Necesitás ingresar tu código de activación.\n\nUso: `/activar TU_CODIGO`',
      { parse_mode: 'Markdown' },
    );
    return;
  }

  try {
    // Buscar código válido (no usado)
    const activationCode = await prisma.activationCode.findFirst({
      where: { code, usedById: null },
    });

    if (!activationCode) {
      await ctx.reply('❌ Código inválido o ya utilizado. Verificá que lo escribiste bien.');
      return;
    }

    // Crear o encontrar el usuario
    const user = await findOrCreateUser({
      telegramId: BigInt(from.id),
      username: from.username,
      firstName: from.first_name,
      lastName: from.last_name,
    });

    // Transacción atómica: quemar el código y activar el usuario
    await prisma.$transaction([
      prisma.activationCode.update({
        where: { id: activationCode.id },
        data: { usedById: user.id, usedAt: new Date() },
      }),
      prisma.user.update({
        where: { id: user.id },
        data: { isActive: true },
      }),
    ]);

    logger.info(`Usuario ${from.id} activado con código ${code}`);

    await ctx.reply(
      `✅ *¡Acceso activado, ${from.first_name}!*\n\n` +
        `Ya podés usar el bot. Escribí /start para ver todos los comandos disponibles.`,
      { parse_mode: 'Markdown' },
    );
  } catch (error) {
    logger.error('Error en /activar', error);
    await ctx.reply('❌ Error al procesar la activación. Intentá de nuevo.');
  }
}
