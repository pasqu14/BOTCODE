import type { Context } from 'telegraf';
import { extractExpenseData } from '../../services/ai.service';
import { logger } from '../../utils/logger';

export async function testCommand(ctx: Context): Promise<void> {
  await ctx.reply('🔧 Probando extractExpenseData con texto real...');

  const testText = 'gaste 500 pesos en papas';

  try {
    logger.info(`TEST: llamando extractExpenseData con "${testText}"`);
    const result = await extractExpenseData(testText);

    if (result) {
      await ctx.reply(
        `✅ FUNCIONA:\n` +
        `• type: ${result.type}\n` +
        `• amount: ${result.amount}\n` +
        `• currency: ${result.currency}\n` +
        `• category: ${result.category}\n` +
        `• description: ${result.description}`,
      );
    } else {
      await ctx.reply(
        `❌ extractExpenseData devolvió NULL para "${testText}"\n\n` +
        `Revisá los logs del servidor para ver el error exacto.`,
      );
    }
  } catch (error) {
    const err = error as { status?: number; message?: string; code?: string };
    logger.error('Error en /test', error);
    await ctx.reply(
      `💥 EXCEPCIÓN:\nStatus: ${err.status ?? 'N/A'}\nCódigo: ${err.code ?? 'N/A'}\nMensaje: ${err.message ?? String(error)}`,
    );
  }
}
