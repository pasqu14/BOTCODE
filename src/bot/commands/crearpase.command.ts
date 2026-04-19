import type { Context } from 'telegraf';
import crypto from 'crypto';
import { prisma } from '../../database/client';
import { env } from '../../utils/env';
import { logger } from '../../utils/logger';

export async function crearpaseCommand(ctx: Context): Promise<void> {
  const from = ctx.from;
  if (!from) return;

  // Solo el admin puede crear pases
  if (from.id.toString() !== env.ADMIN_TELEGRAM_ID) {
    logger.warn(`Intento no autorizado de /crearpase por ${from.id}`);
    await ctx.reply('⛔ No tenés permiso para usar este comando.');
    return;
  }

  try {
    // Generar código único de 12 caracteres
    const code = crypto.randomBytes(6).toString('hex').toUpperCase();

    await prisma.activationCode.create({ data: { code } });

    logger.info(`Admin creó pase: ${code}`);

    await ctx.reply(
      `🔑 *Nuevo pase de acceso creado:*\n\n` +
        `\`${code}\`\n\n` +
        `Compartí este código con tu cliente. Solo puede ser usado una vez.\n` +
        `El cliente lo canjea con: /activar ${code}`,
      { parse_mode: 'Markdown' },
    );
  } catch (error) {
    logger.error('Error en /crearpase', error);
    await ctx.reply('❌ Error al crear el pase. Intentá de nuevo.');
  }
}
