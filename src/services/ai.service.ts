import Groq, { toFile } from 'groq-sdk';
import { env } from '../utils/env';
import { logger } from '../utils/logger';

export interface ParsedTransaction {
  amount: number;
  type: 'INCOME' | 'EXPENSE';
  category: string;
  currency: string;
  description: string;
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
- "description": frase corta que resume la transacción tal como la describió el usuario (máx 60 caracteres)

Ejemplos:
- "gasté 500 pesos en el super" → {"amount":500,"type":"EXPENSE","category":"Supermercado","currency":"ARS","description":"Compra en el supermercado"}
- "me pagaron 1200 dólares de salario" → {"amount":1200,"type":"INCOME","category":"Salario","currency":"USD","description":"Pago de salario mensual"}
- "uber 15 usd" → {"amount":15,"type":"EXPENSE","category":"Transporte","currency":"USD","description":"Viaje en Uber"}
`.trim();

const groq = new Groq({ apiKey: env.GROQ_API_KEY });

export async function extractExpenseData(text: string): Promise<ParsedTransaction> {
  try {
    const completion = await groq.chat.completions.create({
      model: 'llama3-8b-8192',
      messages: [
        { role: 'system', content: SYSTEM_INSTRUCTION },
        { role: 'user', content: text },
      ],
      temperature: 0,
      max_tokens: 150,
      response_format: { type: 'json_object' },
    });

    const raw = completion.choices[0]?.message?.content?.trim() ?? '';
    const parsed: unknown = JSON.parse(raw);

    if (!isValidTransaction(parsed)) {
      throw new Error(`Respuesta inválida del modelo: ${raw}`);
    }

    return parsed;
  } catch (error) {
    logger.error('Error al parsear transacción con Groq', error);
    throw new Error('No pude entender el mensaje. Intenta con más detalle, ej: "gasté 200 en comida".');
  }
}

export async function transcribeAudio(buffer: Buffer): Promise<string> {
  try {
    const file = await toFile(buffer, 'audio.ogg', { type: 'audio/ogg' });

    const transcription = await groq.audio.transcriptions.create({
      file,
      model: 'whisper-large-v3',
      language: 'es',
      response_format: 'text',
    });

    return typeof transcription === 'string' ? transcription : transcription.text;
  } catch (error) {
    logger.error('Error al transcribir audio con Whisper', error);
    throw new Error('No pude transcribir el audio. Intenta enviando un mensaje de texto.');
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
    obj['currency'].length === 3 &&
    typeof obj['description'] === 'string' &&
    obj['description'].length > 0
  );
}
