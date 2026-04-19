import Groq, { toFile } from 'groq-sdk';
import { env } from '../utils/env';
import { logger } from '../utils/logger';

const groq = new Groq({ apiKey: env.GROQ_API_KEY });

export async function transcribeAudio(telegramFileUrl: string): Promise<string | null> {
  try {
    // Descargar el audio desde los servidores de Telegram
    const response = await fetch(telegramFileUrl);
    if (!response.ok) {
      throw new Error(`Error descargando audio: HTTP ${response.status}`);
    }
    const buffer = Buffer.from(await response.arrayBuffer());

    // Transcribir con Groq Whisper (llega vía WebSockets/HTTPS, sin problema de puertos)
    const transcription = await groq.audio.transcriptions.create({
      file: await toFile(buffer, 'voice.ogg', { type: 'audio/ogg' }),
      model: 'whisper-large-v3-turbo',
      language: 'es',
      response_format: 'text',
    });

    const text = typeof transcription === 'string' ? transcription : transcription.text;
    logger.info(`Audio transcripto: "${text}"`);
    return text.trim();
  } catch (error) {
    logger.error('Error al transcribir audio con Groq Whisper', error);
    return null;
  }
}
