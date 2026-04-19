import type { Context } from 'telegraf';
import { prisma } from '../../database/client';
import { logger } from '../../utils/logger';

export async function alertaCommand(ctx: Context): Promise<void> {
  const from = ctx.from;
  if (!from) return;

  try {
    const telegramId = BigInt(from.id);
    const user = await prisma.user.findUnique({ where: { telegramId } });

    if (!user) {
      await ctx.reply('Primero usá /start para registrarte.');
      return;
    }

    if (!user.monthlyBudget) {
      await ctx.reply('No tenés un presupuesto fijado. Usá /presupuesto [monto] para configurarlo.');
      return;
    }

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const result = await prisma.expense.aggregate({
      where: { userId: user.id, currency: 'ARS', createdAt: { gte: startOfMonth } },
      _sum: { amount: true },
    });

    const spent = Number(result._sum.amount ?? 0);
    const budget = Number(user.monthlyBudget);
    const pct = (spent / budget) * 100;
    const remaining = budget - spent;

    let emoji = '🟢';
    if (pct >= 100) emoji = '🔴';
    else if (pct >= 80) emoji = '🟡';

    await ctx.reply(
      `${emoji} Estado de tu presupuesto este mes:\n\n` +
        `💰 Gastado: $${spent.toLocaleString('es-AR')} (${pct.toFixed(1)}%)\n` +
        `🎯 Presupuesto: $${budget.toLocaleString('es-AR')}\n` +
        `${remaining >= 0 ? `✅ Disponible: $${remaining.toLocaleString('es-AR')}` : `⚠️ Excedido por: $${Math.abs(remaining).toLocaleString('es-AR')}`}`,
    );
  } catch (error) {
    logger.error('Error en /alerta', error);
    await ctx.reply('❌ Error al calcular el presupuesto. Intentá de nuevo.');
  }
}
