import type { Context } from 'telegraf';
import type { Message } from 'telegraf/types';
import { prisma } from '../../database/client';
import { logger } from '../../utils/logger';

export async function presupuestoCommand(ctx: Context): Promise<void> {
  const from = ctx.from;
  const msg = ctx.message as Message.TextMessage | undefined;
  if (!from || !msg) return;

  try {
    const args = msg.text.split(/\s+/).slice(1);
    if (args.length === 0 || isNaN(Number(args[0]))) {
      await ctx.reply('Uso: /presupuesto [monto]\nEjemplo: /presupuesto 50000');
      return;
    }

    const budget = parseFloat(args[0].replace(',', '.'));
    const telegramId = BigInt(from.id);

    const user = await prisma.user.findUnique({ where: { telegramId } });
    if (!user) {
      await ctx.reply('Primero usá /start para registrarte.');
      return;
    }

    await prisma.user.update({
      where: { telegramId },
      data: { monthlyBudget: budget },
    });

    await ctx.reply(`✅ Presupuesto mensual fijado en $${budget.toLocaleString('es-AR')}.`);
  } catch (error) {
    logger.error('Error en /presupuesto', error);
    await ctx.reply('❌ Error al guardar el presupuesto. Intentá de nuevo.');
  }
}
