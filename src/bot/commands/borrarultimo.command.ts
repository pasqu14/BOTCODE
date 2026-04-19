import type { Context } from 'telegraf';
import { prisma } from '../../database/client';
import { logger } from '../../utils/logger';

export async function borrarultimoCommand(ctx: Context): Promise<void> {
  const from = ctx.from;
  if (!from) return;

  try {
    const telegramId = BigInt(from.id);
    const user = await prisma.user.findUnique({ where: { telegramId } });

    if (!user) {
      await ctx.reply('Primero usá /start para registrarte.');
      return;
    }

    const last = await prisma.expense.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    });

    if (!last) {
      await ctx.reply('No tenés gastos registrados para borrar.');
      return;
    }

    await prisma.expense.delete({ where: { id: last.id } });

    await ctx.reply(
      `🗑️ Gasto borrado:\n` +
        `💰 $${last.amount} ${last.currency}\n` +
        `📂 ${last.category} · ${last.description}\n` +
        `📅 ${last.createdAt.toLocaleDateString('es-AR')}`,
    );
  } catch (error) {
    logger.error('Error en /borrarultimo', error);
    await ctx.reply('❌ Error al borrar el gasto. Intentá de nuevo.');
  }
}
