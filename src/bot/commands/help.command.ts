import type { Context } from 'telegraf';

const HELP_TEXT = `
<b>💰 FinBot — Tu asistente financiero personal</b>

Registra tus gastos e ingresos simplemente escribiéndolos en lenguaje natural. La IA se encarga del resto.

<b>📝 ¿Cómo registrar una transacción?</b>
Solo escríbela como si le contaras a un amigo:

  • <code>gasté 500 pesos en el súper</code>
  • <code>pagué 15 USD de Uber</code>
  • <code>me depositaron 1200 dólares de salario</code>
  • <code>café 3.50 EUR</code>

<b>📋 Comandos disponibles</b>
/start — Registrarse e iniciar el bot
/help — Ver esta guía
/balance — Ver tu resumen financiero del mes
/export — Descargar tus transacciones en Excel

<b>⚙️ Configuración</b>
Puedes cambiar tu moneda predeterminada escribiendo:
  <code>moneda ARS</code> o <code>currency EUR</code>

<b>💡 Tip</b>
Cuanto más detalle des, mejor clasifica la IA. Si algo no quedó bien registrado, puedes editarlo desde /balance.
`.trim();

export async function helpCommand(ctx: Context): Promise<void> {
  await ctx.replyWithHTML(HELP_TEXT);
}
