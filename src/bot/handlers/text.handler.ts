import type { Context } from 'telegraf';
import type { Message } from 'telegraf/types';
import { extractExpenseData } from '../../services/ai.service';
import { prisma } from '../../database/client';
import { logger } from '../../utils/logger';

export async function textHandler(ctx: Context, next: () => Promise<void>): Promise<void> {
  const msg = ctx.message as Message.TextMessage | undefined;
  const text = msg?.text;

  // Pass commands through to their registered handlers
  if (!text || text.startsWith('/')) {
    return next();
  }

  try {
    await ctx.sendChatAction('typing');

    let parsed;
    try {
      parsed = await extractExpenseData(text);
    } catch (error) {
      logger.error('AI parsing failed', error);
      await ctx.reply(
        '❌ No pude procesar ese gasto. Intenta ser más específico (ej: Gasté 15 USD en comida)',
      );
      return;
    }

    const from = ctx.from;
    if (!from) {
      await ctx.reply('❌ No pude identificar tu usuario.');
      return;
    }

    const user = await prisma.user.findUnique({
      where: { telegramId: BigInt(from.id) },
    });

    if (!user) {
      await ctx.reply('👋 Primero debes registrarte. Ejecuta /start para comenzar.');
      return;
    }

    await prisma.transaction.create({
      data: {
        amount: parsed.amount,
        type: parsed.type,
        category: parsed.category,
        description: parsed.description,
        date: new Date(),
        userId: user.id,
      },
    });

    await ctx.replyWithHTML(
      `✅ <b>Gasto registrado</b>\n` +
        `💰 Monto: ${parsed.amount} ${parsed.currency}\n` +
        `🏷️ Categoría: ${parsed.category}\n` +
        `📝 Descripción: ${parsed.description}`,
    );
  } catch (error) {
    logger.error('Error in textHandler', error);
    await ctx.reply('❌ Ocurrió un error inesperado. Por favor intenta de nuevo.');
  }
}
