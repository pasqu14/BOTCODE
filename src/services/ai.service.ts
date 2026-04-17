import { GoogleGenAI } from '@google/genai';
import { env } from '../utils/env';
import { logger } from '../utils/logger';

export interface ParsedTransaction {
  amount: number;
  type: 'INCOME' | 'EXPENSE';
  category: string;
  currency: string;
}

const SYSTEM_INSTRUCTION = `
Eres un extractor financiero preciso. Tu única tarea es analizar mensajes en lenguaje natural
y extraer datos de una transacción económica.

Responde SIEMPRE con un objeto JSON válido y nada más. Sin explicaciones, sin markdown, sin bloques de código.

El JSON debe tener exactamente estos campos:
- "amount": número positivo (Float), nunca negativo
- "type": "INCOME" si es un ingreso/cobro/ganancia, "EXPENSE" si es un gasto/pago/compra
- "category": categoría corta en español (ej: "Comida", "Transporte", "Salario", "Entretenimiento", "Salud", "Servicios")
- "currency": código ISO 4217 de la moneda mencionada (ej: "USD", "ARS", "EUR"). Default "USD" si no se menciona.

Ejemplos:
- "gasté 500 pesos en el super" → {"amount":500,"type":"EXPENSE","category":"Supermercado","currency":"ARS"}
- "me pagaron 1200 dólares de salario" → {"amount":1200,"type":"INCOME","category":"Salario","currency":"USD"}
- "uber 15 usd" → {"amount":15,"type":"EXPENSE","category":"Transporte","currency":"USD"}
`.trim();

const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });

export async function parseTransactionMessage(text: string): Promise<ParsedTransaction> {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-1.5-flash',
      contents: text,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 0,
        maxOutputTokens: 128,
      },
    });

    const raw = response.text?.trim() ?? '';

    const parsed: unknown = JSON.parse(raw);

    if (!isValidTransaction(parsed)) {
      throw new Error(`Respuesta inválida del modelo: ${raw}`);
    }

    return parsed;
  } catch (error) {
    logger.error('Error al parsear transacción con IA', error);
    throw new Error('No pude entender el mensaje. Intenta con más detalle, ej: "gasté 200 en comida".');
  }
}

function isValidTransaction(value: unknown): value is ParsedTransaction {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const obj = value as Record<string, unknown>;
  return (
    typeof obj['amount'] === 'number' &&
    obj['amount'] > 0 &&
    (obj['type'] === 'INCOME' || obj['type'] === 'EXPENSE') &&
    typeof obj['category'] === 'string' &&
    obj['category'].length > 0 &&
    typeof obj['currency'] === 'string' &&
    obj['currency'].length === 3
  );
}
