import type { Context } from 'telegraf';
import { parseTransactionMessage } from '../../services/ai.service';
import { prisma } from '../../database/client';
import { logger } from '../../utils/logger';

export async function textHandler(ctx: Context): Promise<void> {
  if (!ctx.message || !('text' in ctx.message)) {
    return;
  }

  const text = ctx.message.text;

  if (text.startsWith('/')) {
    return;
  }

  const from = ctx.from;
  if (!from) {
    await ctx.reply('❌ No pude identificar tu usuario.');
    return;
  }

  await ctx.sendChatAction('typing');

  let parsed;
  try {
    parsed = await parseTransactionMessage(text);
  } catch (error) {
    logger.error('AI parsing failed', error);
    await ctx.reply(
      '❌ No pude procesar ese gasto. Intenta ser más específico (ej: Gasté 15 USD en comida)',
    );
    return;
  }

  const user = await prisma.user.findUnique({
    where: { telegramId: BigInt(from.id) },
  });

  if (!user) {
    await ctx.reply('👋 Primero debes registrarte. Ejecuta /start para comenzar.');
    return;
  }

  try {
    await prisma.transaction.create({
      data: {
        amount: parsed.amount,
        type: parsed.type,
        category: parsed.category,
        date: new Date(),
        userId: user.id,
      },
    });

    await ctx.replyWithHTML(
      `✅ <b>Gasto registrado</b>\n` +
        `💰 Monto: ${parsed.amount} ${parsed.currency}\n` +
        `🏷️ Categoría: ${parsed.category}`,
    );
  } catch (error) {
    logger.error('Error saving transaction', error);
    await ctx.reply('❌ Error al guardar la transacción. Intenta nuevamente.');
  }
}
