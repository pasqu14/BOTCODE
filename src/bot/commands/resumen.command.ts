import type { Context } from 'telegraf';
import { prisma } from '../../database/client';
import { logger } from '../../utils/logger';

export async function resumenCommand(ctx: Context): Promise<void> {
  const from = ctx.from;
  if (!from) return;

  try {
    const telegramId = BigInt(from.id);
    const user = await prisma.user.findUnique({ where: { telegramId } });

    if (!user) {
      await ctx.reply('Primero usá /start para registrarte.');
      return;
    }

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthName = now.toLocaleString('es-AR', { month: 'long', year: 'numeric' });

    const expenses = await prisma.expense.findMany({
      where: { userId: user.id, createdAt: { gte: startOfMonth } },
    });

    if (expenses.length === 0) {
      await ctx.reply(`No tenés gastos registrados en ${monthName}.`);
      return;
    }

    // Agrupar por categoría y moneda
    const grouped: Record<string, number> = {};
    for (const e of expenses) {
      const key = `${e.category} (${e.currency})`;
      grouped[key] = (grouped[key] ?? 0) + Number(e.amount);
    }

    const lines = Object.entries(grouped)
      .sort((a, b) => b[1] - a[1])
      .map(([cat, total]) => `  • ${cat}: $${total.toFixed(2)}`);

    const totalArs = expenses
      .filter((e) => e.currency === 'ARS')
      .reduce((sum, e) => sum + Number(e.amount), 0);

    const totalUsd = expenses
      .filter((e) => e.currency === 'USD')
      .reduce((sum, e) => sum + Number(e.amount), 0);

    let totalesText = '';
    if (totalArs > 0) totalesText += `\n💵 Total ARS: $${totalArs.toFixed(2)}`;
    if (totalUsd > 0) totalesText += `\n💵 Total USD: $${totalUsd.toFixed(2)}`;

    await ctx.reply(
      `📊 Resumen de ${monthName}:\n\n${lines.join('\n')}${totalesText}\n\n📝 ${expenses.length} gastos registrados`,
    );
  } catch (error) {
    logger.error('Error en /resumen', error);
    await ctx.reply('❌ Error al generar el resumen. Intentá de nuevo.');
  }
}
