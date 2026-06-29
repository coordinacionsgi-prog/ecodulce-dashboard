/**
 * Aplica el estilo visual de las Fichas Técnicas (navy / azul / celeste, bordes)
 * a todas las tablas del Sheet "Eco Dulce - Maestro Vinculado", para que se pueda
 * copiar y pegar directo en Google Docs con formato de tabla ya armado.
 *
 * Paleta (tomada de Fichas_Tecnicas_Maquinas_Rev00):
 *   Título      #1F3864 fondo, blanco, negrita
 *   Sección     #2E74B5 fondo, blanco, negrita
 *   Encabezado  #D6E4F7 fondo, negro, negrita   (fila de columnas tipo "Año, Unidades, ...")
 *   Total       #FFF2CC fondo, negro, negrita
 *   Bordes      finos negros en todo el rango usado
 *
 * Heurística por fila (mirando solo los valores, sin tocar fórmulas):
 *   - Fila 1                          -> TÍTULO
 *   - Col A empieza con "TOTAL"       -> TOTAL
 *   - Col A con texto y sin ningún
 *     número en toda la fila          -> SECCIÓN (o ENCABEZADO si la fila
 *                                        anterior también era de ese tipo)
 *   - Cualquier otra fila             -> sin cambio de color (se le pone borde nomás)
 *
 * Cómo correrlo: Extensiones > Apps Script > pegar este archivo > desde el
 * menú "📊 Dashboard" tocar "Aplicar formato de fichas a todo el Sheet".
 */

const TABS_A_FORMATEAR = [
  'Plan de Ventas',
  'Materia Prima y Maquinas',
  'CAP',
  'Fichas Tecnicas',
  'Guerchet',
  'REL',
  'Carga-Distancia',
];

const COLOR_TITULO = '#1F3864';
const COLOR_SECCION = '#2E74B5';
const COLOR_ENCABEZADO = '#D6E4F7';
const COLOR_TOTAL = '#FFF2CC';

function aplicarFormatoFichas() {
  const ui = SpreadsheetApp.getUi();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let procesadas = [];
  let saltadas = [];

  TABS_A_FORMATEAR.forEach(nombre => {
    const sheet = ss.getSheetByName(nombre);
    if (!sheet) {
      saltadas.push(nombre);
      return;
    }
    formatearHoja(sheet);
    procesadas.push(nombre);
  });

  ui.alert(
    `Formato aplicado a: ${procesadas.join(', ')}.` +
    (saltadas.length ? `\n\nNo encontradas: ${saltadas.join(', ')}` : '')
  );
}

function formatearHoja(sheet) {
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow === 0 || lastCol === 0) return;

  const range = sheet.getRange(1, 1, lastRow, lastCol);
  const values = range.getValues();

  // Reset: sin esto, una corrida anterior podría dejar colores viejos pegados.
  range.setBackground(null).setFontColor('#000000').setFontWeight('normal');

  let prevWasHeaderLike = false;

  for (let i = 0; i < values.length; i++) {
    const row = values[i];
    const colA = row[0];
    const rowNum = i + 1;
    const fullRowRange = sheet.getRange(rowNum, 1, 1, lastCol);

    if (rowNum === 1) {
      fullRowRange.setBackground(COLOR_TITULO).setFontColor('#FFFFFF').setFontWeight('bold');
      prevWasHeaderLike = false;
      continue;
    }

    const colAEsTexto = typeof colA === 'string' && colA.trim() !== '';
    const colAEsTotal = colAEsTexto && colA.trim().toUpperCase().startsWith('TOTAL');
    const filaTieneNumero = row.some(v => typeof v === 'number');

    if (colAEsTotal) {
      fullRowRange.setBackground(COLOR_TOTAL).setFontColor('#000000').setFontWeight('bold');
      prevWasHeaderLike = false;
    } else if (colAEsTexto && !filaTieneNumero) {
      if (prevWasHeaderLike) {
        fullRowRange.setBackground(COLOR_ENCABEZADO).setFontColor('#000000').setFontWeight('bold');
      } else {
        fullRowRange.setBackground(COLOR_SECCION).setFontColor('#FFFFFF').setFontWeight('bold');
      }
      prevWasHeaderLike = true;
    } else {
      prevWasHeaderLike = false;
    }
  }

  range.setBorder(true, true, true, true, true, true, '#999999', SpreadsheetApp.BorderStyle.SOLID);
  sheet.setFrozenRows(1);
}
