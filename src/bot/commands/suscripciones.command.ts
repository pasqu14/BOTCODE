import type { Context } from 'telegraf';
import { prisma } from '../../database/client';
import { detectRecurringExpenses } from '../../services/ai.service';
import { logger } from '../../utils/logger';

export async function suscripcionesCommand(ctx: Context): Promise<void> {
  const from = ctx.from;
  if (!from) return;

  try {
    const telegramId = BigInt(from.id);
    const user = await prisma.user.findUnique({ where: { telegramId } });

    if (!user) {
      await ctx.reply('Primero usá /start para registrarte.');
      return;
    }

    const since60Days = new Date();
    since60Days.setDate(since60Days.getDate() - 60);

    const expenses = await prisma.expense.findMany({
      where: { userId: user.id, createdAt: { gte: since60Days } },
      orderBy: { createdAt: 'desc' },
    });

    if (expenses.length === 0) {
      await ctx.reply('No tenés gastos en los últimos 60 días.');
      return;
    }

    await ctx.reply('🔍 Analizando tus gastos en busca de suscripciones...');

    const rows = expenses.map((e) => ({
      createdAt: e.createdAt,
      amount: Number(e.amount),
      currency: e.currency,
      category: e.category,
      description: e.description,
    }));

    const analysis = await detectRecurringExpenses(rows);
    await ctx.reply(`📅 Suscripciones y pagos fijos detectados:\n\n${analysis}`);
  } catch (error) {
    logger.error('Error en /suscripciones', error);
    await ctx.reply('❌ Error al analizar suscripciones. Intentá de nuevo.');
  }
}
