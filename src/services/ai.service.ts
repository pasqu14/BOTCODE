import Groq from 'groq-sdk';
import { env } from '../utils/env';
import { logger } from '../utils/logger';

export interface ExpenseData {
  amount: number;
  currency: string;
  category: string;
  description: string;
  type: 'ingreso' | 'gasto';
}

export interface ExpenseRow {
  createdAt: Date;
  amount: number;
  currency: string;
  category: string;
  description: string;
  type?: string;
}

const groq = new Groq({ apiKey: env.GROQ_API_KEY });

// ─── Extracción de gasto desde texto libre ───────────────────────────────────

export async function extractExpenseData(text: string): Promise<ExpenseData | null> {
  try {
    logger.info(`Enviando a Groq: "${text}"`);

    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      temperature: 0.1,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `Sos un asistente de finanzas personales para usuarios de Argentina. Devolvé SIEMPRE JSON válido.
Analizás mensajes en español informal y clasificás movimientos de dinero (ingresos Y gastos).
Contexto cultural:
- "papas", "mangos", "gambas", "pesos" = pesos argentinos (ARS)
- "dólares", "verdes", "USD" = dólares americanos (USD)
- Si no se menciona moneda, usar ARS por defecto
- Gastos: "gasté", "pagué", "compré", "salí a comer", "fui al super", etc.
- Ingresos: "cobré", "me pagaron", "recibí", "entró plata", "me transfirieron", "salario", "sueldo", etc.
- Ser muy permisivo: si hay un número y un contexto financiero claro, procesalo.
Cuando detectás un movimiento:
{"found": true, "type": "<ingreso|gasto>", "amount": <número>, "currency": "<ARS|USD|EUR>", "category": "<Comida|Transporte|Entretenimiento|Servicios|Salud|Ropa|Educación|Sueldo|Freelance|Otros>", "description": "<descripción muy breve>"}
Cuando NO hay ningún movimiento financiero:
{"found": false}`,
        },
        { role: 'user', content: text },
      ],
    });

    const content = completion.choices[0].message.content;
    logger.info(`Respuesta de Groq: ${content}`);
    if (!content) {
      logger.warn('Groq devolvió content vacío/null');
      return null;
    }

    let parsed: { found: boolean } & Partial<ExpenseData>;
    try {
      parsed = JSON.parse(content) as { found: boolean } & Partial<ExpenseData>;
    } catch (parseErr) {
      logger.error(`JSON.parse falló para: ${content}`, parseErr);
      return null;
    }

    if (!parsed.found) {
      logger.info(`Groq dijo found=false para: "${text}"`);
      return null;
    }
    if (!parsed.amount) {
      logger.warn(`Groq no devolvió amount. parsed=${JSON.stringify(parsed)}`);
      return null;
    }
    if (!parsed.currency) {
      logger.warn(`Groq no devolvió currency. parsed=${JSON.stringify(parsed)}`);
      return null;
    }
    if (!parsed.category) {
      logger.warn(`Groq no devolvió category. parsed=${JSON.stringify(parsed)}`);
      return null;
    }

    return {
      amount: parsed.amount,
      currency: parsed.currency,
      category: parsed.category,
      description: parsed.description ?? text,
      type: parsed.type === 'ingreso' ? 'ingreso' : 'gasto',
    };
  } catch (error) {
    const err = error as { status?: number; message?: string };
    if (err.status === 401 || err.status === 403) {
      logger.error('GROQ API KEY inválida o revocada. Actualizá GROQ_API_KEY en .env', error);
    } else {
      logger.error('Error en Groq AI (extractExpenseData)', error);
    }
    return null;
  }
}

// ─── Detección de suscripciones recurrentes ──────────────────────────────────

export async function detectRecurringExpenses(expenses: ExpenseRow[]): Promise<string> {
  if (expenses.length === 0) return 'No tenés gastos en los últimos 60 días.';

  const expenseList = expenses
    .map((e) => `- ${e.createdAt.toISOString().split('T')[0]} | $${e.amount} ${e.currency} | ${e.category} | ${e.description}`)
    .join('\n');

  try {
    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content: `Sos un asistente financiero. Analizás gastos y detectás suscripciones o pagos recurrentes.
Identificá SOLO pagos que aparecen repetidamente o tienen nombres de servicios conocidos (Netflix, Spotify, gimnasio, internet, alquiler, etc.).
Respondé en español con un mensaje amigable, listando cada suscripción detectada y el total fijo mensual estimado.
Si no encontrás ninguna, decí "No detecté suscripciones recurrentes."`,
        },
        {
          role: 'user',
          content: `Estos son mis gastos de los últimos 60 días:\n${expenseList}\n\n¿Cuáles son mis suscripciones o pagos fijos?`,
        },
      ],
    });

    return completion.choices[0].message.content ?? 'No pude analizar los gastos.';
  } catch (error) {
    logger.error('Error en Groq AI (detectRecurringExpenses)', error);
    return '❌ Error al analizar suscripciones. Intentá de nuevo.';
  }
}

// ─── Insights para exportar ──────────────────────────────────────────────────

export async function getExportInsights(
  expenses: ExpenseRow[],
  totalGastos: number,
  totalIngresos: number,
  monthName: string,
): Promise<string[]> {
  if (expenses.length === 0) return ['Sin datos suficientes para generar consejos.', '', ''];

  const gastosList = expenses
    .filter((e) => e.type !== 'ingreso')
    .map((e) => `${e.category}: $${e.amount} (${e.description})`)
    .join('\n');

  try {
    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      temperature: 0.4,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `Sos un asesor financiero experto en finanzas personales para Argentina. Analizás gastos e ingresos y dás exactamente 3 consejos de ahorro ultra-específicos, mencionando montos y categorías reales. Respondé SOLO con JSON: {"tips": ["consejo1", "consejo2", "consejo3"]}`,
        },
        {
          role: 'user',
          content: `Mes: ${monthName}\nTotal ingresos: $${totalIngresos.toFixed(0)} ARS\nTotal gastos: $${totalGastos.toFixed(0)} ARS\nBalance: $${(totalIngresos - totalGastos).toFixed(0)} ARS\n\nDetalle gastos:\n${gastosList}\n\nDame 3 consejos específicos para mejorar mis finanzas.`,
        },
      ],
    });

    const content = completion.choices[0].message.content;
    if (!content) return ['Optimizá tu mayor categoría de gasto.', 'Revisá suscripciones activas.', 'Ahorrá al menos el 10% de tus ingresos.'];
    const parsed = JSON.parse(content) as { tips?: string[] };
    const tips = parsed.tips ?? [];
    while (tips.length < 3) tips.push('');
    return tips.slice(0, 3);
  } catch (error) {
    logger.error('Error en Groq AI (getExportInsights)', error);
    return ['Optimizá tu mayor categoría de gasto.', 'Revisá suscripciones activas.', 'Ahorrá al menos el 10% de tus ingresos.'];
  }
}

// ─── Auditoría financiera ─────────────────────────────────────────────────────

export async function analyzeFinances(expenses: ExpenseRow[], monthName: string): Promise<string> {
  if (expenses.length === 0) return `No tenés gastos registrados en ${monthName}.`;

  const expenseList = expenses
    .map((e) => `- ${e.createdAt.toISOString().split('T')[0]} | $${e.amount} ${e.currency} | ${e.category} | ${e.description}`)
    .join('\n');

  const total = expenses.filter((e) => e.currency === 'ARS').reduce((s, e) => s + e.amount, 0);

  try {
    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      temperature: 0.3,
      messages: [
        {
          role: 'system',
          content: `Sos un analista financiero experto y directo. Analizás gastos personales y das consejos concretos.
Respondé SIEMPRE con exactamente 3 viñetas en este formato:
🔴 Mayor fuga de dinero: [análisis concreto]
📊 Comparativa rápida: [observación sobre distribución del gasto]
💡 Consejo accionable: [un consejo específico y directo para ahorrar]
Sé directo, no uses vaguedades. Mencioná montos reales.`,
        },
        {
          role: 'user',
          content: `Analizá mis gastos de ${monthName} (total ARS: $${total.toFixed(0)}):\n${expenseList}`,
        },
      ],
    });

    return completion.choices[0].message.content ?? 'No pude generar el análisis.';
  } catch (error) {
    logger.error('Error en Groq AI (analyzeFinances)', error);
    return '❌ Error al generar la auditoría. Intentá de nuevo.';
  }
}
