import type { Context } from 'telegraf';
import type { Message } from 'telegraf/types';
import { prisma } from '../../database/client';
import { logger } from '../../utils/logger';

export async function dividirCommand(ctx: Context): Promise<void> {
  const from = ctx.from;
  const msg = ctx.message as Message.TextMessage | undefined;
  if (!from || !msg) return;

  try {
    // Formato: /dividir 1000 con @usuario
    const match = msg.text.match(/\/dividir\s+([\d.,]+)\s+con\s+(@\w+)/i);

    if (!match) {
      await ctx.reply('Uso: /dividir [monto] con [@usuario]\nEjemplo: /dividir 5000 con @franco');
      return;
    }

    const fullAmount = parseFloat(match[1].replace(',', '.'));
    const targetUser = match[2];
    const halfAmount = fullAmount / 2;

    const telegramId = BigInt(from.id);
    const user = await prisma.user.findUnique({ where: { telegramId } });

    if (!user) {
      await ctx.reply('Primero usá /start para registrarte.');
      return;
    }

    await prisma.expense.create({
      data: {
        amount: halfAmount,
        currency: 'ARS',
        category: 'Otros',
        description: `Gasto compartido con ${targetUser}`,
        rawText: msg.text,
        type: 'gasto',
        userId: user.id,
      },
    });

    await ctx.reply(
      `✅ Anoté $${halfAmount.toLocaleString('es-AR')} (tu mitad de $${fullAmount.toLocaleString('es-AR')}).\n` +
        `💬 ¡No te olvides de cobrarle la otra mitad a ${targetUser}!`,
    );
  } catch (error) {
    logger.error('Error en /dividir', error);
    await ctx.reply('❌ Error al registrar el gasto. Intentá de nuevo.');
  }
}
