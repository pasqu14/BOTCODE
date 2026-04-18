import ExcelJS from 'exceljs';
import type { Context } from 'telegraf';
import { prisma } from '../../database/client';
import { generateFinancialInsights } from '../../services/ai.service';
import { logger } from '../../utils/logger';

const HEADER_FILL: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FF1E3A5F' },
};

const HEADER_FONT: Partial<ExcelJS.Font> = {
  bold: true,
  color: { argb: 'FFFFFFFF' },
  size: 11,
};

const ACCENT_FILL: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFE8F4FD' },
};

const INSIGHT_FILL: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFFFF3CD' },
};

export async function exportarCommand(ctx: Context): Promise<void> {
  console.log('--- EJECUTANDO COMANDO EXPORTAR ---');
  const from = ctx.from;
  if (!from) {
    await ctx.reply('❌ No pude identificar tu usuario.');
    return;
  }

  try {
    await ctx.sendChatAction('upload_document');

    const user = await prisma.user.findUnique({
      where: { telegramId: BigInt(from.id) },
    });

    if (!user) {
      await ctx.reply('👋 Primero debes registrarte. Ejecuta /start para comenzar.');
      return;
    }

    const transactions = await prisma.transaction.findMany({
      where: { userId: user.id },
      orderBy: { date: 'desc' },
    });

    if (transactions.length === 0) {
      await ctx.reply('📭 Aún no tienes transacciones registradas para exportar.');
      return;
    }

    await ctx.reply('⏳ Generando tu reporte con IA, un momento...');

    // ── Build category summary ──────────────────────────────────────────────
    const categoryMap = new Map<string, number>();
    let totalExpense = 0;
    let totalIncome = 0;

    for (const t of transactions) {
      if (t.type === 'EXPENSE') {
        totalExpense += t.amount;
        categoryMap.set(t.category, (categoryMap.get(t.category) ?? 0) + t.amount);
      } else {
        totalIncome += t.amount;
      }
    }

    const categorySummaryText = [...categoryMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([cat, amt]) => `${cat}: ${user.currency} ${amt.toFixed(2)}`)
      .join('\n');

    const summaryForAI =
      `Total ingresos: ${user.currency} ${totalIncome.toFixed(2)}\n` +
      `Total gastos: ${user.currency} ${totalExpense.toFixed(2)}\n` +
      `Balance: ${user.currency} ${(totalIncome - totalExpense).toFixed(2)}\n\n` +
      `Gastos por categoría:\n${categorySummaryText}`;

    // ── AI insights (non-blocking on failure) ──────────────────────────────
    let insights = '';
    try {
      insights = await generateFinancialInsights(summaryForAI);
    } catch (error) {
      logger.error('AI insights failed, continuing without them', error);
      insights = 'No se pudieron generar consejos en este momento.';
    }

    // ── Build workbook ─────────────────────────────────────────────────────
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'FinBot';
    workbook.created = new Date();

    // ── Sheet 1: Gastos ────────────────────────────────────────────────────
    const sheet1 = workbook.addWorksheet('📋 Gastos');

    sheet1.columns = [
      { key: 'date', width: 14 },
      { key: 'description', width: 42 },
      { key: 'category', width: 20 },
      { key: 'type', width: 10 },
      { key: 'amount', width: 16 },
    ];

    const headers1 = ['Fecha', 'Descripción', 'Categoría', 'Tipo', 'Monto'];
    const headerRow1 = sheet1.addRow(headers1);
    headerRow1.height = 22;
    headerRow1.eachCell((cell) => {
      cell.fill = HEADER_FILL;
      cell.font = HEADER_FONT;
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = {
        bottom: { style: 'medium', color: { argb: 'FF0D47A1' } },
      };
    });

    transactions.forEach((t, i) => {
      const row = sheet1.addRow({
        date: new Date(t.date).toLocaleDateString('es-AR'),
        description: t.description ?? '',
        category: t.category,
        type: t.type === 'EXPENSE' ? '📤 Gasto' : '📥 Ingreso',
        amount: t.amount,
      });

      if (i % 2 === 0) {
        row.eachCell((cell) => {
          cell.fill = ACCENT_FILL;
        });
      }

      const amountCell = row.getCell('amount');
      amountCell.numFmt = `"${user.currency} "#,##0.00`;
      amountCell.font = {
        bold: true,
        color: { argb: t.type === 'EXPENSE' ? 'FFC62828' : 'FF2E7D32' },
      };
    });

    // Freeze header row
    sheet1.views = [{ state: 'frozen', ySplit: 1 }];

    // ── Sheet 2: Resumen ───────────────────────────────────────────────────
    const sheet2 = workbook.addWorksheet('📊 Resumen');
    sheet2.columns = [
      { key: 'category', width: 24 },
      { key: 'total', width: 18 },
      { key: 'pct', width: 14 },
    ];

    // Title
    sheet2.mergeCells('A1:C1');
    const titleCell = sheet2.getCell('A1');
    titleCell.value = '📊 Resumen financiero';
    titleCell.font = { bold: true, size: 14, color: { argb: 'FF1E3A5F' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    sheet2.getRow(1).height = 28;

    // Totals block
    const totalsData = [
      ['📥 Total ingresos', totalIncome],
      ['📤 Total gastos', totalExpense],
      ['💼 Balance', totalIncome - totalExpense],
    ];
    totalsData.forEach(([label, val]) => {
      const r = sheet2.addRow({ category: label, total: val });
      r.getCell('total').numFmt = `"${user.currency} "#,##0.00`;
      r.getCell('total').font = { bold: true };
    });

    sheet2.addRow([]);

    // Category breakdown header
    const catHeader = sheet2.addRow(['Categoría', 'Total gastado', '% del total']);
    catHeader.eachCell((cell) => {
      cell.fill = HEADER_FILL;
      cell.font = HEADER_FONT;
      cell.alignment = { horizontal: 'center' };
    });

    [...categoryMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .forEach(([cat, amt], i) => {
        const pct = totalExpense > 0 ? ((amt / totalExpense) * 100).toFixed(1) + '%' : '0%';
        const r = sheet2.addRow({ category: cat, total: amt, pct });
        r.getCell('total').numFmt = `"${user.currency} "#,##0.00`;
        if (i % 2 === 0) {
          r.eachCell((cell) => { cell.fill = ACCENT_FILL; });
        }
      });

    sheet2.addRow([]);

    // ── AI Insights block ──────────────────────────────────────────────────
    const insightTitleRow = sheet2.addRow(['💡 Consejos de tu asesor IA']);
    sheet2.mergeCells(`A${insightTitleRow.number}:C${insightTitleRow.number}`);
    insightTitleRow.getCell(1).font = { bold: true, size: 12, color: { argb: 'FF7B3F00' } };
    insightTitleRow.getCell(1).fill = INSIGHT_FILL;
    insightTitleRow.height = 20;

    insights.split('\n').filter(Boolean).forEach((line) => {
      const r = sheet2.addRow([line]);
      sheet2.mergeCells(`A${r.number}:C${r.number}`);
      r.getCell(1).fill = INSIGHT_FILL;
      r.getCell(1).alignment = { wrapText: true };
      r.height = 18;
    });

    // ── Export buffer & send ───────────────────────────────────────────────
    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
    const filename = `finanzas_${from.id}_${Date.now()}.xlsx`;

    await ctx.replyWithDocument({ source: buffer, filename });
    await ctx.reply('✅ ¡Aquí está tu reporte completo con análisis de IA!');
  } catch (error) {
    logger.error('Error in /exportar command', error);
    await ctx.reply('❌ Error al generar el reporte. Intenta de nuevo.');
  }
}
