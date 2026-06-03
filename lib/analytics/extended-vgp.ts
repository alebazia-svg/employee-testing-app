import * as XLSX from 'xlsx';

type CellValue = string | number | boolean | Date | null | undefined;
type SheetRow = {
  values: CellValue[];
  excelRow: number;
  outlineLevel?: number;
  indentLevel: number;
};

type HeaderMap = {
  hierarchy: number;
  employee: number;
  department: number;
  location: number;
  client: number;
  category: number;
  nomenclatureType: number;
  itemName: number;
  article: number;
  quantity: number;
  revenue: number;
  cost: number;
  grossProfit: number;
  marginPercent: number;
  documentName: number;
  documentDate: number;
};

export type ExtendedVgpDocumentType = 'RETURN' | 'SALE' | 'RETAIL_SALE' | 'UNKNOWN';

export type ExtendedVgpRowPayload = {
  sourceReportType: 'extended_vgp';
  employeeName: string;
  department: string | null;
  location: string | null;
  client: string | null;
  category: string | null;
  nomenclatureType: string | null;
  itemName: string;
  article: string | null;
  quantity: number | null;
  revenue: number;
  cost: number;
  grossProfit: number;
  marginPercent: number | null;
  markupPercent: number | null;
  documentName: string | null;
  documentType: ExtendedVgpDocumentType;
  documentDate: Date | null;
  unitRevenue: number | null;
  unitCost: number | null;
  unitGrossProfit: number | null;
  isCredit: boolean;
  isReturn: boolean;
  isRealReturn: boolean;
  isNegative: boolean;
  problemFlags: string[];
  checkReason: string | null;
};

export type ExtendedVgpParseResult = {
  sheetName: string;
  rows: ExtendedVgpRowPayload[];
  warnings: string[];
};

const sourceReportType = 'extended_vgp' as const;

const aliases = {
  employee: ['менеджер', 'сотрудник', 'продавец'],
  department: ['отдел', 'подразделение'],
  location: ['магазин', 'склад'],
  client: ['клиент', 'контрагент'],
  category: ['категория', 'вид номенклатуры', 'номенклатура.вид номенклатуры'],
  itemName: ['номенклатура, артикул', 'номенклатура', 'наименование'],
  article: ['артикул'],
  quantity: ['количество', 'кол-во', 'кол.'],
  revenue: ['выручка'],
  cost: ['себестоимость товаров', 'себестоимость'],
  grossProfit: ['валовая прибыль'],
  marginPercent: ['рентабельность', 'маржа'],
  documentName: ['регистратор', 'документ'],
  documentDate: ['дата'],
};

function normalizeText(value: CellValue) {
  return String(value ?? '')
    .replace(/\u00a0/g, ' ')
    .trim()
    .toLowerCase();
}

function formatCell(value: CellValue) {
  return String(value ?? '').replace(/\u00a0/g, ' ').trim();
}

function getCellValue(cell: unknown): CellValue {
  if (!cell || typeof cell !== 'object') return '';
  const typedCell = cell as { v?: CellValue; w?: string };
  return typedCell.w ?? typedCell.v ?? '';
}

function getIndentLevel(value: CellValue) {
  const text = String(value ?? '');
  const match = text.match(/^(\s+)/);
  return match ? match[1].replace(/\t/g, '    ').length : 0;
}

function isFilledRow(values: CellValue[]) {
  return values.some((value) => formatCell(value) !== '');
}

function sheetToRows(sheet: XLSX.WorkSheet): SheetRow[] {
  if (!sheet['!ref']) return [];
  const range = XLSX.utils.decode_range(sheet['!ref']);
  const rows: SheetRow[] = [];

  for (let rowIndex = range.s.r; rowIndex <= range.e.r; rowIndex += 1) {
    const values: CellValue[] = [];
    for (let columnIndex = range.s.c; columnIndex <= range.e.c; columnIndex += 1) {
      const cellAddress = XLSX.utils.encode_cell({ r: rowIndex, c: columnIndex });
      values.push(getCellValue(sheet[cellAddress]));
    }
    if (isFilledRow(values)) {
      rows.push({
        values,
        excelRow: rowIndex + 1,
        outlineLevel: sheet['!rows']?.[rowIndex]?.level,
        indentLevel: getIndentLevel(values[0]),
      });
    }
  }

  return rows;
}

function findColumn(cells: string[], options: string[]) {
  return cells.findIndex((cell) => options.some((alias) => cell.includes(alias)));
}

function findHeader(rows: SheetRow[]) {
  for (let index = 0; index < rows.length; index += 1) {
    const cells = rows[index].values.map(normalizeText);
    const revenue = findColumn(cells, aliases.revenue);
    const cost = findColumn(cells, aliases.cost);
    const grossProfit = findColumn(cells, aliases.grossProfit);
    if (revenue < 0 || cost < 0 || grossProfit < 0) continue;

    const employee = findColumn(cells, aliases.employee);
    const itemName = findColumn(cells, aliases.itemName);
    return {
      headerIndex: index,
      headerMap: {
        hierarchy: employee >= 0 ? employee : itemName >= 0 ? itemName : 0,
        employee,
        department: findColumn(cells, aliases.department),
        location: findColumn(cells, aliases.location),
        client: findColumn(cells, aliases.client),
        category: findColumn(cells, aliases.category),
        nomenclatureType: findColumn(cells, aliases.category),
        itemName,
        article: findColumn(cells, aliases.article),
        quantity: findColumn(cells, aliases.quantity),
        revenue,
        cost,
        grossProfit,
        marginPercent: findColumn(cells, aliases.marginPercent),
        documentName: findColumn(cells, aliases.documentName),
        documentDate: findColumn(cells, aliases.documentDate),
      } satisfies HeaderMap,
    };
  }

  return { headerIndex: -1, headerMap: null };
}

function toNumber(value: CellValue) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const raw = String(value ?? '')
    .replace(/\u00a0/g, '')
    .replace(/\s/g, '')
    .replace('%', '');
  const normalized = raw.includes(',') && raw.includes('.')
    ? raw.replace(/,/g, '')
    : raw.replace(',', '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toNullableNumber(value: CellValue) {
  const text = formatCell(value);
  if (!text) return null;
  const parsed = toNumber(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function excelSerialToDate(value: number) {
  const epoch = Date.UTC(1899, 11, 30);
  return new Date(epoch + value * 24 * 60 * 60 * 1000);
}

function parseDate(value: CellValue) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === 'number' && value > 20000 && value < 80000) return excelSerialToDate(value);

  const text = formatCell(value);
  if (!text) return null;
  const match = text.match(/(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})/);
  if (match) {
    const day = Number(match[1]);
    const month = Number(match[2]) - 1;
    const year = Number(match[3].length === 2 ? `20${match[3]}` : match[3]);
    const parsed = new Date(year, month, day);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function getExtendedVgpDocumentType(documentName: string | null | undefined): ExtendedVgpDocumentType {
  const normalized = normalizeText(documentName);
  if (normalized.includes('возврат товаров от клиента')) return 'RETURN';
  if (normalized.includes('реализация товаров и услуг')) return 'SALE';
  if (normalized.includes('отчет о розничных продажах') || normalized.includes('отчёт о розничных продажах')) return 'RETAIL_SALE';
  return 'UNKNOWN';
}

function getArticle(itemName: string, explicitArticle: string | null) {
  if (explicitArticle) return explicitArticle;
  const parts = itemName.split(',').map((part) => part.trim()).filter(Boolean);
  return parts.length > 1 ? parts[parts.length - 1] : null;
}

function isTotalRow(text: string) {
  const normalized = normalizeText(text);
  return normalized === 'итог' || normalized.startsWith('итог ') || normalized.includes('итого');
}

function isDocumentName(text: string) {
  const type = getExtendedVgpDocumentType(text);
  return type !== 'UNKNOWN';
}

function hasCreditMarker(client: string | null, documentName: string | null, itemName: string) {
  const text = normalizeText(`${client ?? ''} ${documentName ?? ''} ${itemName}`);
  return text.includes('кредит') || text.includes('рассроч');
}

function buildFlags(input: {
  documentType: ExtendedVgpDocumentType;
  revenue: number;
  cost: number;
  grossProfit: number;
  quantity: number | null;
}) {
  const flags: string[] = [];
  if (input.documentType === 'RETURN') flags.push('real-return');
  if (input.revenue < 0 || input.grossProfit < 0) flags.push('negative-row');
  if (input.quantity === null) flags.push('quantity-missing');
  if (input.revenue > 0 && input.cost === 0) flags.push('zero-cost');
  return flags;
}

function makePayload(input: {
  employeeName: string;
  department: string | null;
  location: string | null;
  client: string | null;
  category: string | null;
  nomenclatureType: string | null;
  itemName: string;
  article: string | null;
  quantity: number | null;
  revenue: number;
  cost: number;
  grossProfit: number;
  marginPercent: number | null;
  documentName: string | null;
  documentDate: Date | null;
}) {
  const documentType = getExtendedVgpDocumentType(input.documentName);
  const isRealReturn = documentType === 'RETURN';
  const isNegative = input.revenue < 0 || input.grossProfit < 0;
  const problemFlags = buildFlags({
    documentType,
    revenue: input.revenue,
    cost: input.cost,
    grossProfit: input.grossProfit,
    quantity: input.quantity,
  });
  const quantity = input.quantity && input.quantity !== 0 ? input.quantity : null;

  return {
    sourceReportType,
    employeeName: input.employeeName,
    department: input.department,
    location: input.location,
    client: input.client,
    category: input.category,
    nomenclatureType: input.nomenclatureType,
    itemName: input.itemName,
    article: getArticle(input.itemName, input.article),
    quantity,
    revenue: input.revenue,
    cost: input.cost,
    grossProfit: input.grossProfit,
    marginPercent: input.marginPercent ?? (input.revenue !== 0 ? (input.grossProfit / input.revenue) * 100 : null),
    markupPercent: input.cost !== 0 ? (input.grossProfit / input.cost) * 100 : null,
    documentName: input.documentName,
    documentType,
    documentDate: input.documentDate,
    unitRevenue: quantity ? input.revenue / quantity : null,
    unitCost: quantity ? input.cost / quantity : null,
    unitGrossProfit: quantity ? input.grossProfit / quantity : null,
    isCredit: hasCreditMarker(input.client, input.documentName, input.itemName),
    isReturn: isRealReturn || input.revenue < 0,
    isRealReturn,
    isNegative,
    problemFlags,
    checkReason: problemFlags.length ? problemFlags.join(', ') : null,
  } satisfies ExtendedVgpRowPayload;
}

function value(row: SheetRow, index: number) {
  return index >= 0 ? row.values[index] : '';
}

function parseFlatRows(rows: SheetRow[], headerIndex: number, headerMap: HeaderMap) {
  const parsed: ExtendedVgpRowPayload[] = [];
  let currentDocumentName: string | null = null;
  let currentDocumentDate: Date | null = null;

  rows.slice(headerIndex + 1).forEach((row) => {
    const hierarchyText = formatCell(value(row, headerMap.hierarchy));
    if (isDocumentName(hierarchyText)) {
      currentDocumentName = hierarchyText;
      currentDocumentDate = parseDate(hierarchyText);
    }

    const employeeName = formatCell(value(row, headerMap.employee));
    const itemName = formatCell(value(row, headerMap.itemName));
    const revenue = toNumber(value(row, headerMap.revenue));
    const grossProfit = toNumber(value(row, headerMap.grossProfit));
    if (!employeeName || !itemName || isTotalRow(itemName) || (revenue === 0 && grossProfit === 0)) return;
    const explicitDocumentName = formatCell(value(row, headerMap.documentName)) || null;
    const documentName = explicitDocumentName ?? currentDocumentName;

    parsed.push(makePayload({
      employeeName,
      department: formatCell(value(row, headerMap.department)) || null,
      location: formatCell(value(row, headerMap.location)) || null,
      client: formatCell(value(row, headerMap.client)) || null,
      category: formatCell(value(row, headerMap.category)) || null,
      nomenclatureType: formatCell(value(row, headerMap.nomenclatureType)) || null,
      itemName,
      article: formatCell(value(row, headerMap.article)) || null,
      quantity: toNullableNumber(value(row, headerMap.quantity)),
      revenue,
      cost: toNumber(value(row, headerMap.cost)),
      grossProfit,
      marginPercent: toNullableNumber(value(row, headerMap.marginPercent)),
      documentName,
      documentDate: parseDate(value(row, headerMap.documentDate)) ?? currentDocumentDate,
    }));
  });
  return parsed;
}

function getHierarchyLevel(row: SheetRow) {
  if (typeof row.outlineLevel === 'number') return row.outlineLevel;
  return Math.floor(row.indentLevel / 2);
}

function parseHierarchyRows(rows: SheetRow[], headerIndex: number, headerMap: HeaderMap) {
  const parsed: ExtendedVgpRowPayload[] = [];
  let employeeName = '';
  let client = '';
  let category = '';
  let itemName = '';
  let documentName = '';
  let documentDate: Date | null = null;

  const dataRows = rows.slice(headerIndex + 1);

  dataRows.forEach((row, index) => {
    const text = formatCell(value(row, headerMap.hierarchy));
    if (!text || isTotalRow(text)) return;

    const nextRow = dataRows[index + 1];
    const nextText = nextRow ? formatCell(value(nextRow, headerMap.hierarchy)) : '';
    const revenue = toNumber(value(row, headerMap.revenue));
    const cost = toNumber(value(row, headerMap.cost));
    const grossProfit = toNumber(value(row, headerMap.grossProfit));
    const quantity = toNullableNumber(value(row, headerMap.quantity));
    const level = getHierarchyLevel(row);
    const documentLike = isDocumentName(text);
    const nextIsDocument = Boolean(nextText && isDocumentName(nextText));

    if (documentLike) {
      documentName = text;
      documentDate = parseDate(text);
    } else if (level <= 0) {
      employeeName = text;
      client = '';
      category = '';
      itemName = '';
      documentName = '';
      documentDate = null;
      return;
    } else if (level === 1) {
      client = text;
      category = '';
      itemName = '';
      documentName = '';
      documentDate = null;
      return;
    } else if (level === 2) {
      category = text;
      itemName = '';
      documentName = '';
      documentDate = null;
      return;
    } else if (!documentLike) {
      itemName = text;
    }

    if (!employeeName || !itemName || (revenue === 0 && grossProfit === 0)) return;
    if (!documentLike && nextIsDocument) return;

    parsed.push(makePayload({
      employeeName,
      department: null,
      location: null,
      client: client || null,
      category: category || null,
      nomenclatureType: category || null,
      itemName,
      article: formatCell(value(row, headerMap.article)) || null,
      quantity,
      revenue,
      cost,
      grossProfit,
      marginPercent: toNullableNumber(value(row, headerMap.marginPercent)),
      documentName: documentName || null,
      documentDate,
    }));
  });

  return parsed;
}

export function parseExtendedVgp(buffer: ArrayBuffer): ExtendedVgpParseResult {
  const workbook = XLSX.read(buffer, { type: 'array', cellStyles: true, cellDates: true });
  const sheetName = workbook.SheetNames.includes('TDSheet') ? 'TDSheet' : workbook.SheetNames[0] ?? '';
  const sheet = sheetName ? workbook.Sheets[sheetName] : null;
  if (!sheet) return { sheetName, rows: [], warnings: ['Не найден лист Excel.'] };

  const sheetRows = sheetToRows(sheet);
  const { headerIndex, headerMap } = findHeader(sheetRows);
  if (!headerMap) return { sheetName, rows: [], warnings: ['Не найдена шапка с выручкой, себестоимостью и валовой прибылью.'] };

  const flatRowsAvailable = headerMap.employee >= 0 && headerMap.itemName >= 0;
  const rows = flatRowsAvailable ? parseFlatRows(sheetRows, headerIndex, headerMap) : parseHierarchyRows(sheetRows, headerIndex, headerMap);
  const warnings = rows.length ? [] : ['Строки расширенного ВВП не распознаны. Проверьте структуру отчёта и выбранный лист.'];

  return { sheetName, rows, warnings };
}
