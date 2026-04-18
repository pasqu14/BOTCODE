import type { Context } from 'telegraf';
import { prisma } from '../../database/client';
import { logger } from '../../utils/logger';

const CATEGORY_EMOJIS: Record<string, string> = {
  Comida: '🍕',
  Supermercado: '🛒',
  Transporte: '🚌',
  Salud: '💊',
  Entretenimiento: '🎬',
  Servicios: '💡',
  Salario: '💰',
  Educación: '📚',
  Ropa: '👕',
};

function emojiFor(category: string): string {
  return CATEGORY_EMOJIS[category] ?? '📌';
}

export async function resumenCommand(ctx: Context): Promise<void> {
  const from = ctx.from;
  if (!from) {
    await ctx.reply('❌ No pude identificar tu usuario.');
    return;
  }

  try {
    const user = await prisma.user.findUnique({
      where: { telegramId: BigInt(from.id) },
    });

    if (!user) {
      await ctx.reply('👋 Primero debes registrarte. Ejecuta /start para comenzar.');
      return;
    }

    const [aggregate, count] = await Promise.all([
      prisma.transaction.aggregate({
        where: { userId: user.id, type: 'EXPENSE' },
        _sum: { amount: true },
      }),
      prisma.transaction.count({ where: { userId: user.id } }),
    ]);

    const incomeAgg = await prisma.transaction.aggregate({
      where: { userId: user.id, type: 'INCOME' },
      _sum: { amount: true },
    });

    const totalExpense = aggregate._sum.amount ?? 0;
    const totalIncome = incomeAgg._sum.amount ?? 0;
    const balance = totalIncome - totalExpense;

    await ctx.replyWithHTML(
      `📊 <b>Tu resumen financiero</b>\n\n` +
        `📥 Ingresos: <b>${user.currency} ${totalIncome.toFixed(2)}</b>\n` +
        `📤 Gastos: <b>${user.currency} ${totalExpense.toFixed(2)}</b>\n` +
        `─────────────────\n` +
        `💼 Balance: <b>${user.currency} ${balance.toFixed(2)}</b>\n\n` +
        `📝 Transacciones registradas: ${count}`,
    );
  } catch (error) {
    logger.error('Error in /resumen command', error);
    await ctx.reply('❌ Error al obtener el resumen. Intenta de nuevo.');
  }
}

export async function categoriasCommand(ctx: Context): Promise<void> {
  const from = ctx.from;
  if (!from) {
    await ctx.reply('❌ No pude identificar tu usuario.');
    return;
  }

  try {
    const user = await prisma.user.findUnique({
      where: { telegramId: BigInt(from.id) },
    });

    if (!user) {
      await ctx.reply('👋 Primero debes registrarte. Ejecuta /start para comenzar.');
      return;
    }

    const groups = await prisma.transaction.groupBy({
      by: ['category'],
      where: { userId: user.id, type: 'EXPENSE' },
      _sum: { amount: true },
      orderBy: { _sum: { amount: 'desc' } },
    });

    if (groups.length === 0) {
      await ctx.reply('📭 Aún no tienes gastos registrados.');
      return;
    }

    const lines = groups.map((g) => {
      const emoji = emojiFor(g.category);
      const amount = (g._sum.amount ?? 0).toFixed(2);
      return `${emoji} <b>${g.category}</b>: ${user.currency} ${amount}`;
    });

    await ctx.replyWithHTML(`🏷️ <b>Gastos por categoría</b>\n\n${lines.join('\n')}`);
  } catch (error) {
    logger.error('Error in /categorias command', error);
    await ctx.reply('❌ Error al obtener las categorías. Intenta de nuevo.');
  }
}
