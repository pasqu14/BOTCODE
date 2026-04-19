import { Telegraf } from 'telegraf';
import { message } from 'telegraf/filters';
import { env } from '../utils/env';
import { logger } from '../utils/logger';
import { startCommand } from './commands/start.command';
import { gastosCommand } from './commands/gastos.command';
import { resumenCommand } from './commands/resumen.command';
import { exportCommand } from './commands/export.command';
import { presupuestoCommand } from './commands/presupuesto.command';
import { alertaCommand } from './commands/alerta.command';
import { borrarultimoCommand } from './commands/borrarultimo.command';
import { buscarCommand } from './commands/buscar.command';
import { suscripcionesCommand } from './commands/suscripciones.command';
import { dividirCommand } from './commands/dividir.command';
import { auditoriaCommand } from './commands/auditoria.command';
import { testCommand } from './commands/test.command';
import { activarCommand } from './commands/activar.command';
import { crearpaseCommand } from './commands/crearpase.command';
import { authMiddleware } from './middleware/auth.middleware';
import { extractExpenseData } from '../services/ai.service';
import { transcribeAudio } from '../services/transcription.service';
import { prisma } from '../database/client';
import type { User } from '../../generated/prisma';

type ReplyFn = (text: string) => Promise<unknown>;

// ─── Alerta proactiva de presupuesto ─────────────────────────────────────────

async function checkBudgetAlert(user: User, reply: ReplyFn): Promise<void> {
  if (!user.monthlyBudget) return;

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const result = await prisma.expense.aggregate({
    where: { userId: user.id, currency: 'ARS', createdAt: { gte: startOfMonth } },
    _sum: { amount: true },
  });

  const spent = Number(result._sum.amount ?? 0);
  const budget = Number(user.monthlyBudget);
  const pct = (spent / budget) * 100;

  if (pct >= 100) {
    await reply(
      `🚨 ¡Superaste tu presupuesto mensual!\n` +
        `Llevás $${spent.toLocaleString('es-AR')} de $${budget.toLocaleString('es-AR')} (${pct.toFixed(0)}%)`,
    );
  } else if (pct >= 80) {
    await reply(
      `⚠️ Atención: usaste el ${pct.toFixed(0)}% de tu presupuesto.\n` +
        `Llevás $${spent.toLocaleString('es-AR')} de $${budget.toLocaleString('es-AR')}`,
    );
  }
}

// ─── Lógica central de procesamiento de gastos ───────────────────────────────

async function processExpense(
  reply: ReplyFn,
  telegramId: bigint,
  text: string,
  audioPrefix?: string,
): Promise<void> {
  const user = await prisma.user.findUnique({ where: { telegramId } });
  if (!user) {
    await reply('Primero usá /start para registrarte.');
    return;
  }

  let expense: Awaited<ReturnType<typeof extractExpenseData>>;
  try {
    expense = await extractExpenseData(text);
  } catch (error) {
    logger.error('Error llamando a extractExpenseData', error);
    await reply('❌ Error al conectar con el servicio de IA. Verificá la API key en .env y reiniciá el bot.');
    return;
  }
  const prefix = audioPrefix ? `🎤 Escuché: "${audioPrefix}"\n\n` : '';

  if (!expense) {
    await reply(
      `${prefix}❌ No pude identificar un movimiento. Intentá con algo como:\n"gasté 500 pesos en almuerzo" o "cobré 80000 de sueldo"`,
    );
    return;
  }

  await prisma.expense.create({
    data: {
      amount: expense.amount,
      currency: expense.currency,
      category: expense.category,
      description: expense.description,
      rawText: text,
      type: expense.type ?? 'gasto',
      userId: user.id,
    },
  });

  const typeEmoji = expense.type === 'ingreso' ? '📈 Ingreso' : '💸 Gasto';
  await reply(
    `${prefix}✅ ${typeEmoji} registrado:\n💰 ${expense.amount} ${expense.currency}\n📂 ${expense.category}\n📝 ${expense.description}`,
  );

  // Verificar presupuesto después de guardar (alerta proactiva)
  await checkBudgetAlert(user, reply);
}

// ─── Creación del bot ─────────────────────────────────────────────────────────

export function createBot(): Telegraf {
  const bot = new Telegraf(env.BOT_TOKEN);

  // Menú de comandos (aparece al escribir "/" en Telegram)
  void bot.telegram.setMyCommands([
    { command: 'start', description: '👋 Iniciar el bot' },
    { command: 'gastos', description: '📋 Ver últimos 10 gastos' },
    { command: 'resumen', description: '📊 Resumen del mes por categoría' },
    { command: 'exportar', description: '📁 Exportar gastos a Excel' },
    { command: 'presupuesto', description: '🎯 Fijar presupuesto mensual' },
    { command: 'alerta', description: '🔔 Ver estado del presupuesto' },
    { command: 'borrarultimo', description: '🗑️ Borrar el último gasto' },
    { command: 'buscar', description: '🔍 Buscar gastos por palabra' },
    { command: 'suscripciones', description: '📅 Detectar pagos recurrentes' },
    { command: 'dividir', description: '🤝 Dividir un gasto con alguien' },
    { command: 'auditoria', description: '🧠 Análisis financiero del mes' },
  ]);

  // Guardia global de acceso (va antes de todos los comandos)
  bot.use(authMiddleware);

  bot.command('start', startCommand);
  bot.command('activar', activarCommand);
  bot.command('crearpase', crearpaseCommand);
  bot.command('gastos', gastosCommand);
  bot.command('resumen', resumenCommand);
  bot.command('exportar', exportCommand);
  bot.command('presupuesto', presupuestoCommand);
  bot.command('alerta', alertaCommand);
  bot.command('borrarultimo', borrarultimoCommand);
  bot.command('buscar', buscarCommand);
  bot.command('suscripciones', suscripcionesCommand);
  bot.command('dividir', dividirCommand);
  bot.command('auditoria', auditoriaCommand);
  bot.command('test', testCommand);

  // Mensajes de texto → detectar gasto con IA (ignorar comandos)
  bot.on(message('text'), async (ctx, next) => {
    const text = ctx.message.text;
    if (text.startsWith('/')) return next();
    const telegramId = BigInt(ctx.from.id);
    logger.info(`Texto recibido de ${telegramId}: "${text}"`);
    await processExpense(ctx.reply.bind(ctx), telegramId, text);
  });

  // Mensajes de voz → transcribir con Groq Whisper y luego detectar gasto
  bot.on(message('voice'), async (ctx) => {
    const telegramId = BigInt(ctx.from.id);
    logger.info(`Audio recibido de ${telegramId}`);
    await ctx.reply('🎤 Procesando audio...');

    const fileLink = await ctx.telegram.getFileLink(ctx.message.voice.file_id);
    const transcribed = await transcribeAudio(fileLink.href);

    if (!transcribed) {
      await ctx.reply('❌ No pude procesar el audio. Intentá de nuevo o escribí el gasto.');
      return;
    }

    await processExpense(ctx.reply.bind(ctx), telegramId, transcribed, transcribed);
  });

  bot.catch((err: unknown) => {
    logger.error('Unhandled bot error', err);
  });

  return bot;
}

export async function launchBot(bot: Telegraf): Promise<void> {
  process.once('SIGINT', () => void bot.stop('SIGINT'));
  process.once('SIGTERM', () => void bot.stop('SIGTERM'));
  await bot.launch();
  logger.info('Bot launched successfully');
}
