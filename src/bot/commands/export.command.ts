import type { Context } from 'telegraf';
import ExcelJS from 'exceljs';
import { prisma } from '../../database/client';
import { logger } from '../../utils/logger';
import { getExportInsights } from '../../services/ai.service';

// ─── Paleta de colores ────────────────────────────────────────────────────────
const COLOR = {
  darkBg: '1A1A2E',       // Fondo encabezado oscuro (azul noche)
  accentBlue: '16213E',   // Fondo sección secundaria
  green: '00B050',        // Verde ingresos
  red: 'FF0000',          // Rojo gastos
  lightGreen: 'E2EFDA',   // Fondo verde suave
  lightRed: 'FFDDD5',     // Fondo rojo suave
  gold: 'FFD700',         // Dorado para títulos
  white: 'FFFFFF',
  gray: 'D9D9D9',
  darkText: '1A1A2E',
};

function solidFill(hex: string): ExcelJS.FillPattern {
  return { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${hex}` } };
}

function thinBorder(): Partial<ExcelJS.Borders> {
  const side = { style: 'thin' as ExcelJS.BorderStyle, color: { argb: 'FFD9D9D9' } };
  return { top: side, left: side, bottom: side, right: side };
}

// ─── Pestaña 1: Tablero de Control ───────────────────────────────────────────

function buildDashboard(
  wb: ExcelJS.Workbook,
  totalIngresos: number,
  totalGastos: number,
  byCategory: Map<string, number>,
  tips: string[],
  monthName: string,
  count: number,
): void {
  const ws = wb.addWorksheet('Tablero de Control');
  ws.views = [{ showGridLines: false }];

  // Configurar anchos de columna
  ws.getColumn(1).width = 3;
  ws.getColumn(2).width = 28;
  ws.getColumn(3).width = 22;
  ws.getColumn(4).width = 22;
  ws.getColumn(5).width = 3;

  let rowIdx = 1;

  // ── Fila vacía superior
  rowIdx++;

  // ── Título principal
  const titleRow = ws.getRow(rowIdx++);
  ws.mergeCells(`B${rowIdx - 1}:D${rowIdx - 1}`);
  const titleCell = titleRow.getCell(2);
  titleCell.value = `📊 TABLERO DE CONTROL — ${monthName.toUpperCase()}`;
  titleCell.font = { name: 'Calibri', size: 16, bold: true, color: { argb: `FF${COLOR.gold}` } };
  titleCell.fill = solidFill(COLOR.darkBg);
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  titleRow.height = 36;

  // ── Subtítulo
  const subRow = ws.getRow(rowIdx++);
  ws.mergeCells(`B${rowIdx - 1}:D${rowIdx - 1}`);
  const subCell = subRow.getCell(2);
  subCell.value = `${count} movimientos registrados`;
  subCell.font = { name: 'Calibri', size: 10, italic: true, color: { argb: `FF${COLOR.gray}` } };
  subCell.fill = solidFill(COLOR.darkBg);
  subCell.alignment = { horizontal: 'center' };
  subRow.height = 18;

  // ── Espacio
  rowIdx++;

  // ── KPI: encabezado de sección
  const kpiHeaderRow = ws.getRow(rowIdx++);
  ws.mergeCells(`B${rowIdx - 1}:D${rowIdx - 1}`);
  const kpiHeader = kpiHeaderRow.getCell(2);
  kpiHeader.value = 'RESUMEN FINANCIERO';
  kpiHeader.font = { name: 'Calibri', size: 11, bold: true, color: { argb: `FF${COLOR.white}` } };
  kpiHeader.fill = solidFill(COLOR.accentBlue);
  kpiHeader.alignment = { horizontal: 'center', vertical: 'middle' };
  kpiHeaderRow.height = 24;

  // ── KPI: Total Ingresos
  const ingRow = ws.getRow(rowIdx++);
  ingRow.height = 28;
  const ingLabel = ingRow.getCell(2);
  ingLabel.value = '💰 Total Ingresos';
  ingLabel.font = { name: 'Calibri', size: 11, bold: true, color: { argb: `FF${COLOR.darkText}` } };
  ingLabel.fill = solidFill(COLOR.lightGreen);
  ingLabel.border = thinBorder();
  ingLabel.alignment = { vertical: 'middle' };
  const ingVal = ingRow.getCell(3);
  ws.mergeCells(`C${rowIdx - 1}:D${rowIdx - 1}`);
  ingVal.value = totalIngresos;
  ingVal.numFmt = '$#,##0.00';
  ingVal.font = { name: 'Calibri', size: 13, bold: true, color: { argb: `FF${COLOR.green}` } };
  ingVal.fill = solidFill(COLOR.lightGreen);
  ingVal.border = thinBorder();
  ingVal.alignment = { horizontal: 'right', vertical: 'middle' };

  // ── KPI: Total Gastos
  const gasRow = ws.getRow(rowIdx++);
  gasRow.height = 28;
  const gasLabel = gasRow.getCell(2);
  gasLabel.value = '💸 Total Gastos';
  gasLabel.font = { name: 'Calibri', size: 11, bold: true, color: { argb: `FF${COLOR.darkText}` } };
  gasLabel.fill = solidFill(COLOR.lightRed);
  gasLabel.border = thinBorder();
  gasLabel.alignment = { vertical: 'middle' };
  const gasVal = gasRow.getCell(3);
  ws.mergeCells(`C${rowIdx - 1}:D${rowIdx - 1}`);
  gasVal.value = totalGastos;
  gasVal.numFmt = '$#,##0.00';
  gasVal.font = { name: 'Calibri', size: 13, bold: true, color: { argb: `FF${COLOR.red}` } };
  gasVal.fill = solidFill(COLOR.lightRed);
  gasVal.border = thinBorder();
  gasVal.alignment = { horizontal: 'right', vertical: 'middle' };

  // ── KPI: Balance Neto
  const balance = totalIngresos - totalGastos;
  const balRow = ws.getRow(rowIdx++);
  balRow.height = 32;
  ws.mergeCells(`B${rowIdx - 1}:B${rowIdx - 1}`);
  const balLabel = balRow.getCell(2);
  balLabel.value = balance >= 0 ? '✅ Balance Neto' : '⚠️ Balance Neto';
  balLabel.font = { name: 'Calibri', size: 11, bold: true, color: { argb: `FF${COLOR.white}` } };
  balLabel.fill = solidFill(balance >= 0 ? COLOR.green : COLOR.red);
  balLabel.border = thinBorder();
  balLabel.alignment = { vertical: 'middle' };
  const balVal = balRow.getCell(3);
  ws.mergeCells(`C${rowIdx - 1}:D${rowIdx - 1}`);
  balVal.value = balance;
  balVal.numFmt = '$#,##0.00';
  balVal.font = { name: 'Calibri', size: 14, bold: true, color: { argb: `FF${COLOR.white}` } };
  balVal.fill = solidFill(balance >= 0 ? COLOR.green : COLOR.red);
  balVal.border = thinBorder();
  balVal.alignment = { horizontal: 'right', vertical: 'middle' };

  // ── Espacio
  rowIdx++;

  // ── Gastos por categoría
  if (byCategory.size > 0) {
    const catHeaderRow = ws.getRow(rowIdx++);
    ws.mergeCells(`B${rowIdx - 1}:D${rowIdx - 1}`);
    const catHeader = catHeaderRow.getCell(2);
    catHeader.value = 'GASTOS POR CATEGORÍA';
    catHeader.font = { name: 'Calibri', size: 11, bold: true, color: { argb: `FF${COLOR.white}` } };
    catHeader.fill = solidFill(COLOR.accentBlue);
    catHeader.alignment = { horizontal: 'center', vertical: 'middle' };
    catHeaderRow.height = 22;

    const sortedCats = [...byCategory.entries()].sort((a, b) => b[1] - a[1]);
    for (const [cat, amt] of sortedCats) {
      const catRow = ws.getRow(rowIdx++);
      catRow.height = 22;
      const catLabel = catRow.getCell(2);
      catLabel.value = cat;
      catLabel.font = { name: 'Calibri', size: 10 };
      catLabel.fill = solidFill(COLOR.white);
      catLabel.border = thinBorder();
      catLabel.alignment = { vertical: 'middle' };
      const catAmt = catRow.getCell(3);
      ws.mergeCells(`C${rowIdx - 1}:D${rowIdx - 1}`);
      catAmt.value = amt;
      catAmt.numFmt = '$#,##0.00';
      catAmt.font = { name: 'Calibri', size: 10, color: { argb: `FF${COLOR.red}` } };
      catAmt.fill = solidFill(COLOR.white);
      catAmt.border = thinBorder();
      catAmt.alignment = { horizontal: 'right', vertical: 'middle' };
    }
  }

  // ── Espacio
  rowIdx++;

  // ── AI Insights
  const insightHeaderRow = ws.getRow(rowIdx++);
  ws.mergeCells(`B${rowIdx - 1}:D${rowIdx - 1}`);
  const insightHeader = insightHeaderRow.getCell(2);
  insightHeader.value = '🤖 ANÁLISIS DE TU ASISTENTE';
  insightHeader.font = { name: 'Calibri', size: 11, bold: true, color: { argb: `FF${COLOR.gold}` } };
  insightHeader.fill = solidFill(COLOR.darkBg);
  insightHeader.alignment = { horizontal: 'center', vertical: 'middle' };
  insightHeaderRow.height = 26;

  const tipEmojis = ['💡', '📌', '🎯'];
  for (let i = 0; i < 3; i++) {
    const tipRow = ws.getRow(rowIdx++);
    ws.mergeCells(`B${rowIdx - 1}:D${rowIdx - 1}`);
    const tipCell = tipRow.getCell(2);
    tipCell.value = tips[i] ? `${tipEmojis[i]} ${tips[i]}` : '';
    tipCell.font = { name: 'Calibri', size: 10, color: { argb: `FF${COLOR.darkText}` } };
    tipCell.fill = solidFill(i % 2 === 0 ? 'F5F5F5' : COLOR.white);
    tipCell.border = thinBorder();
    tipCell.alignment = { wrapText: true, vertical: 'middle' };
    tipRow.height = 36;
  }

  // ── Pie de página
  rowIdx++;
  const footerRow = ws.getRow(rowIdx);
  ws.mergeCells(`B${rowIdx}:D${rowIdx}`);
  const footerCell = footerRow.getCell(2);
  footerCell.value = `Generado el ${new Date().toLocaleDateString('es-AR')} · Bot de Finanzas Personales`;
  footerCell.font = { name: 'Calibri', size: 8, italic: true, color: { argb: 'FF999999' } };
  footerCell.alignment = { horizontal: 'center' };
}

// ─── Pestaña 2: Detalle de Movimientos ───────────────────────────────────────

function buildDetail(wb: ExcelJS.Workbook, expenses: Array<{
  createdAt: Date; amount: number; currency: string;
  category: string; description: string; rawText: string | null; type: string;
}>): void {
  const ws = wb.addWorksheet('Detalle de Movimientos');

  ws.getColumn(1).width = 14;
  ws.getColumn(2).width = 12;
  ws.getColumn(3).width = 12;
  ws.getColumn(4).width = 10;
  ws.getColumn(5).width = 20;
  ws.getColumn(6).width = 35;
  ws.getColumn(7).width = 35;

  // ── Encabezados
  const headerRow = ws.getRow(1);
  headerRow.height = 22;
  const headers = ['Fecha', 'Monto', 'Tipo', 'Moneda', 'Categoría', 'Descripción', 'Texto Original'];
  headers.forEach((h, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = h;
    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: `FF${COLOR.white}` } };
    cell.fill = solidFill(COLOR.darkBg);
    cell.border = thinBorder();
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  });

  // ── Datos
  expenses.forEach((e, i) => {
    const row = ws.getRow(i + 2);
    row.height = 18;
    const isIngreso = e.type === 'ingreso';
    const rowBg = isIngreso ? 'F0FFF0' : 'FFF5F5';

    const values = [
      e.createdAt.toISOString().split('T')[0],
      e.amount,
      isIngreso ? 'Ingreso' : 'Gasto',
      e.currency,
      e.category,
      e.description,
      e.rawText ?? '',
    ];

    values.forEach((val, j) => {
      const cell = row.getCell(j + 1);
      cell.value = val;
      cell.fill = solidFill(rowBg);
      cell.border = thinBorder();
      cell.alignment = { vertical: 'middle', wrapText: j >= 5 };

      if (j === 1) {
        // Columna de monto
        cell.numFmt = '#,##0.00';
        cell.font = {
          name: 'Calibri', size: 10, bold: true,
          color: { argb: isIngreso ? `FF${COLOR.green}` : `FF${COLOR.red}` },
        };
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
      } else {
        cell.font = { name: 'Calibri', size: 10 };
      }
    });
  });

  // ── AutoFilter en encabezados
  ws.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: 7 },
  };

  // ── Fijar primera fila
  ws.views = [{ state: 'frozen', xSplit: 0, ySplit: 1 }];
}

// ─── Pestaña 3: Comparativa Mensual ──────────────────────────────────────────

interface MonthSummary {
  label: string;       // "Enero 2025"
  sortKey: string;     // "2025-01"
  ingresos: number;
  gastos: number;
  balance: number;
  count: number;
  topCategory: string;
}

function buildComparison(wb: ExcelJS.Workbook, expenses: Array<{
  createdAt: Date; amount: number; currency: string;
  category: string; type: string;
}>): void {
  const ws = wb.addWorksheet('Comparativa Mensual');
  ws.views = [{ state: 'frozen', xSplit: 0, ySplit: 1 }];

  // Agrupar por mes (solo ARS)
  const monthMap = new Map<string, MonthSummary>();

  for (const e of expenses) {
    if (e.currency !== 'ARS') continue;
    const d = e.createdAt;
    const sortKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleString('es-AR', { month: 'long', year: 'numeric' });

    if (!monthMap.has(sortKey)) {
      monthMap.set(sortKey, { label, sortKey, ingresos: 0, gastos: 0, balance: 0, count: 0, topCategory: '' });
    }
    const m = monthMap.get(sortKey)!;
    m.count++;
    if (e.type === 'ingreso') {
      m.ingresos += e.amount;
    } else {
      m.gastos += e.amount;
    }
    m.balance = m.ingresos - m.gastos;
  }

  // Top categoría por mes (gastos)
  const catByMonth = new Map<string, Map<string, number>>();
  for (const e of expenses) {
    if (e.currency !== 'ARS' || e.type === 'ingreso') continue;
    const d = e.createdAt;
    const sortKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (!catByMonth.has(sortKey)) catByMonth.set(sortKey, new Map());
    const cats = catByMonth.get(sortKey)!;
    cats.set(e.category, (cats.get(e.category) ?? 0) + e.amount);
  }
  for (const [key, cats] of catByMonth) {
    const top = [...cats.entries()].sort((a, b) => b[1] - a[1])[0];
    const m = monthMap.get(key);
    if (m && top) m.topCategory = top[0];
  }

  // Ordenar cronológicamente
  const months = [...monthMap.values()].sort((a, b) => a.sortKey.localeCompare(b.sortKey));

  // ── Anchos de columna
  ws.getColumn(1).width = 20;  // Mes
  ws.getColumn(2).width = 16;  // Ingresos
  ws.getColumn(3).width = 16;  // Gastos
  ws.getColumn(4).width = 16;  // Balance
  ws.getColumn(5).width = 12;  // Movimientos
  ws.getColumn(6).width = 18;  // Mayor Categoría

  // ── Encabezados
  const headers = ['Mes', 'Ingresos', 'Gastos', 'Balance', 'Movimientos', 'Mayor Categoría'];
  const headerRow = ws.getRow(1);
  headerRow.height = 24;
  headers.forEach((h, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = h;
    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: `FF${COLOR.white}` } };
    cell.fill = solidFill(COLOR.darkBg);
    cell.border = thinBorder();
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  });

  // Totales acumulados
  let totalIng = 0, totalGas = 0, totalCount = 0;

  // ── Filas por mes
  months.forEach((m, i) => {
    const row = ws.getRow(i + 2);
    row.height = 20;
    const isPos = m.balance >= 0;
    const rowBg = i % 2 === 0 ? 'F9F9F9' : COLOR.white;

    totalIng += m.ingresos;
    totalGas += m.gastos;
    totalCount += m.count;

    // Mes
    const mesCell = row.getCell(1);
    mesCell.value = m.label.charAt(0).toUpperCase() + m.label.slice(1);
    mesCell.font = { name: 'Calibri', size: 10, bold: true };
    mesCell.fill = solidFill(rowBg);
    mesCell.border = thinBorder();
    mesCell.alignment = { vertical: 'middle' };

    // Ingresos
    const ingCell = row.getCell(2);
    ingCell.value = m.ingresos;
    ingCell.numFmt = '$#,##0.00';
    ingCell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: `FF${COLOR.green}` } };
    ingCell.fill = solidFill(rowBg);
    ingCell.border = thinBorder();
    ingCell.alignment = { horizontal: 'right', vertical: 'middle' };

    // Gastos
    const gasCell = row.getCell(3);
    gasCell.value = m.gastos;
    gasCell.numFmt = '$#,##0.00';
    gasCell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: `FF${COLOR.red}` } };
    gasCell.fill = solidFill(rowBg);
    gasCell.border = thinBorder();
    gasCell.alignment = { horizontal: 'right', vertical: 'middle' };

    // Balance
    const balCell = row.getCell(4);
    balCell.value = m.balance;
    balCell.numFmt = '$#,##0.00';
    balCell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: isPos ? `FF${COLOR.green}` : `FF${COLOR.red}` } };
    balCell.fill = solidFill(isPos ? 'F0FFF0' : 'FFF5F5');
    balCell.border = thinBorder();
    balCell.alignment = { horizontal: 'right', vertical: 'middle' };

    // Movimientos
    const cntCell = row.getCell(5);
    cntCell.value = m.count;
    cntCell.font = { name: 'Calibri', size: 10 };
    cntCell.fill = solidFill(rowBg);
    cntCell.border = thinBorder();
    cntCell.alignment = { horizontal: 'center', vertical: 'middle' };

    // Mayor categoría
    const catCell = row.getCell(6);
    catCell.value = m.topCategory || '—';
    catCell.font = { name: 'Calibri', size: 10, italic: true };
    catCell.fill = solidFill(rowBg);
    catCell.border = thinBorder();
    catCell.alignment = { vertical: 'middle' };
  });

  // ── Fila de TOTALES
  const totalRowIdx = months.length + 2;
  const totalRow = ws.getRow(totalRowIdx);
  totalRow.height = 24;

  const totalBal = totalIng - totalGas;

  const totalsData = [
    { val: 'TOTALES', isNum: false },
    { val: totalIng, isNum: true, color: COLOR.green },
    { val: totalGas, isNum: true, color: COLOR.red },
    { val: totalBal, isNum: true, color: totalBal >= 0 ? COLOR.green : COLOR.red },
    { val: totalCount, isNum: true, color: COLOR.darkText },
    { val: `${months.length} mes${months.length !== 1 ? 'es' : ''}`, isNum: false },
  ];

  totalsData.forEach((t, i) => {
    const cell = totalRow.getCell(i + 1);
    cell.value = t.val as ExcelJS.CellValue;
    cell.font = {
      name: 'Calibri', size: 10, bold: true,
      color: { argb: `FF${(t as { color?: string }).color ?? COLOR.white}` },
    };
    cell.fill = solidFill(COLOR.accentBlue);
    cell.border = thinBorder();
    if (t.isNum && i > 0 && i < 4) {
      cell.numFmt = '$#,##0.00';
      cell.alignment = { horizontal: 'right', vertical: 'middle' };
    } else {
      cell.alignment = { horizontal: i === 0 ? 'center' : 'center', vertical: 'middle' };
    }
  });

  // ── AutoFilter
  ws.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: 6 },
  };
}

// ─── Comando /exportar ────────────────────────────────────────────────────────

export async function exportCommand(ctx: Context): Promise<void> {
  const from = ctx.from;
  if (!from) return;

  try {
    const telegramId = BigInt(from.id);
    const user = await prisma.user.findUnique({ where: { telegramId } });

    if (!user) {
      await ctx.reply('Primero usá /start para registrarte.');
      return;
    }

    const rawExpenses = await prisma.expense.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    });

    if (rawExpenses.length === 0) {
      await ctx.reply('No tenés movimientos registrados para exportar.');
      return;
    }

    await ctx.reply('⏳ Generando tu reporte Pro...');

    const now = new Date();
    const monthName = now.toLocaleString('es-AR', { month: 'long', year: 'numeric' });

    // Calcular totales
    const expenses = rawExpenses.map((e) => ({
      createdAt: e.createdAt,
      amount: Number(e.amount),
      currency: e.currency,
      category: e.category,
      description: e.description,
      rawText: e.rawText,
      type: (e as { type?: string }).type ?? 'gasto',
    }));

    const arsExpenses = expenses.filter((e) => e.currency === 'ARS');
    const totalIngresos = arsExpenses.filter((e) => e.type === 'ingreso').reduce((s, e) => s + e.amount, 0);
    const totalGastos = arsExpenses.filter((e) => e.type !== 'ingreso').reduce((s, e) => s + e.amount, 0);

    // Gastos por categoría (solo gastos ARS)
    const byCategory = new Map<string, number>();
    for (const e of arsExpenses.filter((e) => e.type !== 'ingreso')) {
      byCategory.set(e.category, (byCategory.get(e.category) ?? 0) + e.amount);
    }

    // AI Insights
    const expenseRows = expenses.map((e) => ({ ...e }));
    const tips = await getExportInsights(expenseRows, totalGastos, totalIngresos, monthName);

    // Construir Excel
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Bot de Finanzas Personales';
    wb.created = now;

    buildDashboard(wb, totalIngresos, totalGastos, byCategory, tips, monthName, rawExpenses.length);
    buildDetail(wb, expenses);
    buildComparison(wb, expenses);

    const buffer = await wb.xlsx.writeBuffer();
    const filename = `finanzas_${now.toISOString().split('T')[0]}.xlsx`;

    await ctx.replyWithDocument(
      { source: Buffer.from(buffer), filename },
      { caption: `📊 Reporte Pro generado: ${rawExpenses.length} movimientos · ${monthName}` },
    );
  } catch (error) {
    logger.error('Error en /exportar', error);
    await ctx.reply('❌ Error al generar el reporte. Intentá de nuevo.');
  }
}
