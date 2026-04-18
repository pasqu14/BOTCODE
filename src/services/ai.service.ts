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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const groq = new Groq({ apiKey: env.GROQ_API_KEY });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function extractExpenseData(text: string): Promise<any> {
  const prompt = `Analiza este texto y extrae los datos del gasto.
    Texto: "${text}"
    DEBES responder ÚNICAMENTE con un objeto JSON válido con esta estructura exacta, sin texto adicional ni bloques de markdown:
    {
      "amount": numero (solo el valor numérico),
      "currency": "ARS",
      "category": "Comida",
      "description": "resumen corto"
    }`;

  try {
    const chatCompletion = await groq.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: 'llama3-8b-8192',
      response_format: { type: 'json_object' },
      temperature: 0.2,
    });

    const content = chatCompletion.choices[0]?.message?.content ?? '';

    // Safety cleanup in case Llama3 ignores json_object
    const cleaned = content.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();

    return JSON.parse(cleaned);
  } catch (error) {
    console.error('\n❌ [ERROR FATAL EN GROQ] ❌');
    console.error(error);
    throw error;
  }
}

export async function generateFinancialInsights(summary: string): Promise<string> {
  const prompt = `Eres un asesor financiero amigable y directo. Un usuario te comparte este resumen de sus finanzas personales:

${summary}

Redacta exactamente 3 consejos financieros breves, útiles y con onda, basados específicamente en estos datos.
Sé concreto: menciona categorías o montos si es relevante.
Formato: una línea por consejo, numerados del 1 al 3. Sin markdown, sin asteriscos, sin encabezados.`;

  const chatCompletion = await groq.chat.completions.create({
    messages: [{ role: 'user', content: prompt }],
    model: 'llama3-8b-8192',
    temperature: 0.7,
    max_tokens: 350,
  });

  return chatCompletion.choices[0]?.message?.content?.trim() ?? 'No se pudieron generar consejos.';
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
