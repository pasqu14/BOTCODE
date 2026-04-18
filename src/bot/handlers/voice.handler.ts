import type { Context } from 'telegraf';
import type { Message } from 'telegraf/types';
import { extractExpenseData, transcribeAudio } from '../../services/ai.service';
import { prisma } from '../../database/client';
import { logger } from '../../utils/logger';

export async function voiceHandler(ctx: Context): Promise<void> {
  const msg = ctx.message as Message.VoiceMessage | undefined;
  if (!msg?.voice) {
    return;
  }

  const from = ctx.from;
  if (!from) {
    await ctx.reply('❌ No pude identificar tu usuario.');
    return;
  }

  try {
    await ctx.sendChatAction('typing');

    const fileLink = await ctx.telegram.getFileLink(msg.voice.file_id);
    const audioResponse = await fetch(fileLink.href);
    if (!audioResponse.ok) {
      throw new Error(`Error descargando audio: ${audioResponse.status}`);
    }
    const buffer = Buffer.from(await audioResponse.arrayBuffer());

    let transcription: string;
    try {
      transcription = await transcribeAudio(buffer);
    } catch (error) {
      logger.error('Whisper transcription failed', error);
      await ctx.reply('❌ No pude transcribir el audio. Intenta enviando un mensaje de texto.');
      return;
    }

    logger.info(`Transcription: "${transcription}"`);

    let parsed;
    try {
      parsed = await extractExpenseData(transcription);
    } catch (error) {
      logger.error('AI parsing failed for voice', error);
      await ctx.reply(
        `🎤 Escuché: "<i>${transcription}</i>"\n\n❌ No pude extraer un gasto de eso. Intenta ser más específico.`,
      );
      return;
    }

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
    logger.error('Error in voiceHandler', error);
    await ctx.reply('❌ Ocurrió un error procesando tu nota de voz. Intenta de nuevo.');
  }
}
