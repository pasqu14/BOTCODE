import type { NarrowedContext, Context } from 'telegraf';
import type { Update, Message } from 'telegraf/types';
import { extractExpenseData, transcribeAudio } from '../../services/ai.service';
import { prisma } from '../../database/client';
import { logger } from '../../utils/logger';

type VoiceContext = NarrowedContext<Context, Update.MessageUpdate<Message.VoiceMessage>>;

export async function voiceHandler(ctx: VoiceContext): Promise<void> {
  console.log('[INFO] 🎤 Audio recibido, procesando...');

  const from = ctx.from;
  if (!from) {
    await ctx.reply('❌ No pude identificar tu usuario.');
    return;
  }

  try {
    await ctx.sendChatAction('typing');

    // Download audio from Telegram
    let buffer: Buffer;
    try {
      const fileLink = await ctx.telegram.getFileLink(ctx.message.voice.file_id);
      console.log('[INFO] 🔗 File link obtenido:', fileLink.href);

      const audioResponse = await fetch(fileLink.href);
      if (!audioResponse.ok) {
        throw new Error(`HTTP ${audioResponse.status} al descargar el audio`);
      }
      buffer = Buffer.from(await audioResponse.arrayBuffer());
      console.log(`[INFO] 📦 Audio descargado: ${buffer.length} bytes`);
    } catch (error) {
      console.error('[ERROR] ❌ Fallo al descargar el audio:', error);
      await ctx.reply('❌ No pude descargar el audio. Intenta de nuevo.');
      return;
    }

    // Transcribe with Whisper
    let transcription: string;
    try {
      transcription = await transcribeAudio(buffer);
      console.log(`[INFO] 📝 Transcripción: "${transcription}"`);
    } catch (error) {
      console.error('[ERROR] ❌ Fallo en Whisper:', error);
      await ctx.reply('❌ No pude transcribir el audio. Intenta enviando un mensaje de texto.');
      return;
    }

    // Extract expense data with LLM
    let parsed;
    try {
      parsed = await extractExpenseData(transcription);
    } catch (error) {
      logger.error('AI parsing failed for voice', error);
      await ctx.replyWithHTML(
        `🎤 Escuché: "<i>${transcription}</i>"\n\n` +
          `❌ No pude extraer un gasto de eso. Intenta ser más específico.`,
      );
      return;
    }

    // Find user in DB
    const user = await prisma.user.findUnique({
      where: { telegramId: BigInt(from.id) },
    });

    if (!user) {
      await ctx.reply('👋 Primero debes registrarte. Ejecuta /start para comenzar.');
      return;
    }

    await prisma.transaction.create({
      data: {
        amount: parsed.amount,
        type: parsed.type,
        category: parsed.category,
        description: parsed.description,
        date: new Date(),
        userId: user.id,
      },
    });

    await ctx.replyWithHTML(
      `🎤 <i>Detectado por voz:</i> "${transcription}"\n\n` +
        `✅ <b>Gasto registrado</b>\n` +
        `💰 Monto: ${parsed.amount} ${parsed.currency}\n` +
        `🏷️ Categoría: ${parsed.category}\n` +
        `📝 Descripción: ${parsed.description}`,
    );
  } catch (error) {
    console.error('[ERROR] ❌ Error inesperado en voiceHandler:', error);
    await ctx.reply('❌ Ocurrió un error procesando tu nota de voz. Intenta de nuevo.');
  }
}
