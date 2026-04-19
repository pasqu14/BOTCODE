import type { Context } from 'telegraf';
import { prisma } from '../../database/client';
import { analyzeFinances } from '../../services/ai.service';
import { logger } from '../../utils/logger';

export async function auditoriaCommand(ctx: Context): Promise<void> {
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
      orderBy: { createdAt: 'asc' },
    });

    if (expenses.length === 0) {
      await ctx.reply(`No tenés gastos en ${monthName} para auditar.`);
      return;
    }

    await ctx.reply('🔍 Analizando tus finanzas del mes...');

    const rows = expenses.map((e) => ({
      createdAt: e.createdAt,
      amount: Number(e.amount),
      currency: e.currency,
      category: e.category,
      description: e.description,
    }));

    const analysis = await analyzeFinances(rows, monthName);
    await ctx.reply(`📊 Auditoría financiera — ${monthName}:\n\n${analysis}`);
  } catch (error) {
    logger.error('Error en /auditoria', error);
    await ctx.reply('❌ Error al generar la auditoría. Intentá de nuevo.');
  }
}
