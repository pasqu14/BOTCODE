import type { Context } from 'telegraf';
import { prisma } from '../../database/client';
import { logger } from '../../utils/logger';

export async function gastosCommand(ctx: Context): Promise<void> {
  const from = ctx.from;
  if (!from) return;

  try {
    const telegramId = BigInt(from.id);
    const user = await prisma.user.findUnique({ where: { telegramId } });

    if (!user) {
      await ctx.reply('Primero usá /start para registrarte.');
      return;
    }

    const expenses = await prisma.expense.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    if (expenses.length === 0) {
      await ctx.reply('No tenés gastos registrados aún. Mandame un mensaje como "gasté 500 en almuerzo".');
      return;
    }

    const lines = expenses.map((e, i) => {
      const date = e.createdAt.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });
      return `${i + 1}. ${date} — $${e.amount} ${e.currency}\n   📂 ${e.category} · ${e.description}`;
    });

    await ctx.reply(`📋 Últimos ${expenses.length} gastos:\n\n${lines.join('\n\n')}`);
  } catch (error) {
    logger.error('Error en /gastos', error);
    await ctx.reply('❌ Error al obtener los gastos. Intentá de nuevo.');
  }
}
