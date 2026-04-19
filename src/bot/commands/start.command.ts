import type { Context } from 'telegraf';
import { findOrCreateUser } from '../../services/user.service';
import { logger } from '../../utils/logger';

export async function startCommand(ctx: Context): Promise<void> {
  const from = ctx.from;
  if (!from) {
    await ctx.reply('No se pudo identificar al usuario.');
    return;
  }

  try {
    const user = await findOrCreateUser({
      telegramId: BigInt(from.id),
      username: from.username,
      firstName: from.first_name,
      lastName: from.last_name,
    });

    logger.info(`User registered: ${user.telegramId.toString()}`);

    await ctx.reply(
      `¡Hola, ${user.firstName}! 👋 Soy tu asistente financiero personal.\n\n` +
        `📝 *Registrá gastos escribiendo o mandando un audio:*\n` +
        `   "gasté 500 en almuerzo"\n` +
        `   "pagué 2000 de nafta"\n\n` +
        `📋 *Comandos disponibles:*\n` +
        `/gastos — Últimos 10 gastos\n` +
        `/resumen — Resumen del mes por categoría\n` +
        `/exportar — Exportar gastos a Excel\n` +
        `/presupuesto [monto] — Fijar límite mensual\n` +
        `/alerta — Ver cuánto del presupuesto usaste\n` +
        `/borrarultimo — Borrar el último gasto\n` +
        `/buscar [palabra] — Buscar en tus gastos\n` +
        `/suscripciones — Detectar pagos recurrentes\n` +
        `/dividir [monto] con [@usuario] — Dividir un gasto\n` +
        `/auditoria — Análisis financiero del mes`,
    );
  } catch (error) {
    logger.error('Error in /start command', error);
    await ctx.reply('Ocurrió un error. Por favor intentá de nuevo.');
  }
}
