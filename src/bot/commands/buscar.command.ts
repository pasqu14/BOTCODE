import type { Context } from 'telegraf';
import type { Message } from 'telegraf/types';
import { prisma } from '../../database/client';
import { logger } from '../../utils/logger';

export async function buscarCommand(ctx: Context): Promise<void> {
  const from = ctx.from;
  const msg = ctx.message as Message.TextMessage | undefined;
  if (!from || !msg) return;

  try {
    const keyword = msg.text.split(/\s+/).slice(1).join(' ').trim();

    if (!keyword) {
      await ctx.reply('Uso: /buscar [palabra]\nEjemplo: /buscar café');
      return;
    }

    const telegramId = BigInt(from.id);
    const user = await prisma.user.findUnique({ where: { telegramId } });

    if (!user) {
      await ctx.reply('Primero usá /start para registrarte.');
      return;
    }

    const results = await prisma.expense.findMany({
      where: {
        userId: user.id,
        OR: [
          { description: { contains: keyword, mode: 'insensitive' } },
          { category: { contains: keyword, mode: 'insensitive' } },
          { rawText: { contains: keyword, mode: 'insensitive' } },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    if (results.length === 0) {
      await ctx.reply(`🔍 No encontré gastos que coincidan con "${keyword}".`);
      return;
    }

    const lines = results.map((e, i) => {
      const date = e.createdAt.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });
      return `${i + 1}. ${date} — $${e.amount} ${e.currency}\n   📂 ${e.category} · ${e.description}`;
    });

    await ctx.reply(`🔍 Resultados para "${keyword}" (${results.length}):\n\n${lines.join('\n\n')}`);
  } catch (error) {
    logger.error('Error en /buscar', error);
    await ctx.reply('❌ Error en la búsqueda. Intentá de nuevo.');
  }
}
