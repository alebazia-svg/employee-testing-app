import { createSign } from 'crypto';

export type AttendanceRow = {
  timestamp: string;
  employee: string;
  date: string;
  action: string;
  time: string;
  shift: string;
  comment: string;
};

type AttendanceResult = {
  mode: 'demo' | 'google-sheets';
  rows: AttendanceRow[];
  message: string;
};

export type ScheduleRow = {
  date: string;
  dayOfWeek: string;
  employee: string;
  plannedWork: boolean | null;
  scheduleNote: string;
};

type ScheduleResult = {
  mode: 'not-configured' | 'google-sheets';
  rows: ScheduleRow[];
  message: string;
};

type SheetColor = {
  red?: number;
  green?: number;
  blue?: number;
};

type SheetCell = {
  formattedValue?: string;
  userEnteredValue?: {
    stringValue?: string;
    numberValue?: number;
    formulaValue?: string;
  };
  effectiveFormat?: {
    backgroundColor?: SheetColor;
    backgroundColorStyle?: {
      rgbColor?: SheetColor;
    };
  };
};

type GridRow = {
  values?: SheetCell[];
};

type SpreadsheetGetResponse = {
  sheets?: Array<{
    data?: Array<{
      rowData?: GridRow[];
    }>;
  }>;
};

type SpreadsheetTitlesResponse = {
  sheets?: Array<{
    properties?: {
      title?: string;
    };
  }>;
};

const DEMO_ATTENDANCE: AttendanceRow[] = [
  {
    timestamp: '23.05.2026 09:58:00',
    employee: 'Марина С.',
    date: '2026-05-23',
    action: 'Начало рабочего дня',
    time: '09:58',
    shift: '09:00–18:00',
    comment: 'Demo-данные до подключения Google Sheets',
  },
  {
    timestamp: '23.05.2026 18:11:00',
    employee: 'Алексей П.',
    date: '2026-05-23',
    action: 'Окончание рабочего дня',
    time: '18:11',
    shift: '10:00–19:00',
    comment: 'Будет заменено данными из таблицы',
  },
  {
    timestamp: '23.05.2026 10:17:00',
    employee: 'Ирина К.',
    date: '2026-05-23',
    action: 'Начало рабочего дня',
    time: '10:17',
    shift: '11:00–20:00',
    comment: 'Причина отклонения будет показана здесь',
  },
];

const SHEETS_SCOPE = 'https://www.googleapis.com/auth/spreadsheets.readonly';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const ATTENDANCE_SHEET_TITLE = 'Ответы на форму (1)';
const SCHEDULE_SHEET_TITLE = 'График работы';

function base64Url(input: string | Buffer) {
  return Buffer.from(input).toString('base64').replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/g, '');
}

function getPrivateKey() {
  return process.env.GOOGLE_SHEETS_PRIVATE_KEY?.replace(/\\n/g, '\n');
}

function hasGoogleSheetsConfig() {
  return Boolean(process.env.GOOGLE_SHEETS_CLIENT_EMAIL && getPrivateKey() && process.env.GOOGLE_SHEETS_SPREADSHEET_ID);
}

function hasScheduleSheetsConfig() {
  return Boolean(process.env.GOOGLE_SHEETS_CLIENT_EMAIL && getPrivateKey() && process.env.GOOGLE_SHEETS_SCHEDULE_SPREADSHEET_ID);
}

function describeCause(cause: unknown) {
  if (!cause) return '';
  if (cause instanceof Error) {
    return ` cause.name=${cause.name}; cause.message=${cause.message}`;
  }
  if (typeof cause === 'object') {
    try {
      return ` cause=${JSON.stringify(cause)}`;
    } catch {
      return ' cause=[unserializable object]';
    }
  }
  return ` cause=${String(cause)}`;
}

function describeFetchError(stage: 'OAuth token' | 'Sheets metadata' | 'Sheets values' | 'Schedule metadata' | 'Schedule grid', error: unknown) {
  if (error instanceof Error) {
    return `${stage} fetch failed: error.name=${error.name}; error.message=${error.message};${describeCause((error as Error & { cause?: unknown }).cause)}`;
  }

  return `${stage} fetch failed: error.name=Unknown; error.message=${String(error)}`;
}

function formatAvailableTitles(titles: string[]) {
  return titles.length ? titles.map((title) => `"${title}"`).join(', ') : 'список пуст или недоступен';
}

function quoteSheetTitle(title: string) {
  return `'${title.replaceAll("'", "''")}'`;
}

async function readResponseText(response: Response) {
  try {
    return await response.text();
  } catch {
    return '';
  }
}

async function getAccessToken() {
  const clientEmail = process.env.GOOGLE_SHEETS_CLIENT_EMAIL;
  const privateKey = getPrivateKey();

  if (!clientEmail || !privateKey) {
    throw new Error('Google Sheets service account credentials are not configured.');
  }

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claimSet = {
    iss: clientEmail,
    scope: SHEETS_SCOPE,
    aud: TOKEN_URL,
    exp: now + 60 * 60,
    iat: now,
  };
  const unsignedJwt = `${base64Url(JSON.stringify(header))}.${base64Url(JSON.stringify(claimSet))}`;
  const signer = createSign('RSA-SHA256');
  signer.update(unsignedJwt);
  signer.end();
  const signature = signer.sign(privateKey);
  const assertion = `${unsignedJwt}.${base64Url(signature)}`;

  let response: Response;
  try {
    response = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion,
      }),
      cache: 'no-store',
    });
  } catch (error) {
    throw new Error(describeFetchError('OAuth token', error));
  }

  if (!response.ok) {
    const responseText = await readResponseText(response);
    throw new Error(`OAuth token request failed: status=${response.status}; response=${responseText}`);
  }

  const data = await response.json() as { access_token?: string };
  if (!data.access_token) throw new Error('OAuth token response did not include access_token.');

  return data.access_token;
}

async function getSheetTitles(spreadsheetId: string, token: string, stage: 'Sheets metadata' | 'Schedule metadata') {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties.title`;

  let response: Response;
  try {
    response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
  } catch (error) {
    throw new Error(describeFetchError(stage, error));
  }

  if (!response.ok) {
    const responseText = await readResponseText(response);
    throw new Error(`${stage} request failed: status=${response.status}; response=${responseText}`);
  }

  const data = await response.json() as SpreadsheetTitlesResponse;
  return data.sheets?.map((sheet) => sheet.properties?.title).filter((title): title is string => Boolean(title)) ?? [];
}

function looksLikeHeader(row: string[]) {
  const normalized = row.map((cell) => cell.toLowerCase());
  return normalized.some((cell) => cell.includes('отметка') || cell.includes('фио') || cell.includes('приход'));
}

function formatTimestamp(timestamp: string) {
  if (!timestamp) return { date: '-', time: '-' };

  const parsed = new Date(timestamp);
  if (!Number.isNaN(parsed.getTime())) {
    return {
      date: parsed.toLocaleDateString('ru-RU'),
      time: parsed.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
    };
  }

  const [datePart = '-', timePart = '-'] = timestamp.trim().split(/\s+/);
  return {
    date: datePart,
    time: timePart.slice(0, 5) || '-',
  };
}

function mapRows(values: string[][]): AttendanceRow[] {
  const rows = values[0] && looksLikeHeader(values[0]) ? values.slice(1) : values;

  return rows
    .filter((row) => row.some(Boolean))
    .map((row) => {
      const timestamp = formatTimestamp(row[0] || '');

      return {
        timestamp: row[0] || '',
        employee: row[3] || '-',
        date: timestamp.date,
        action: row[1] || '-',
        time: timestamp.time,
        shift: row[4] || '-',
        comment: row[5] || '',
      };
    });
}

function getCellValue(cell?: SheetCell) {
  if (!cell) return '';
  if (cell.formattedValue) return cell.formattedValue.trim();
  const value = cell.userEnteredValue;
  if (!value) return '';
  if (typeof value.stringValue === 'string') return value.stringValue.trim();
  if (typeof value.formulaValue === 'string') return value.formulaValue.trim();
  if (typeof value.numberValue === 'number') return String(value.numberValue);
  return '';
}

function getEffectiveBackgroundColor(cell?: SheetCell) {
  return cell?.effectiveFormat?.backgroundColorStyle?.rgbColor ?? cell?.effectiveFormat?.backgroundColor ?? null;
}

function isNearWhite(color: SheetColor) {
  const red = color.red ?? 0;
  const green = color.green ?? 0;
  const blue = color.blue ?? 0;
  return red > 0.94 && green > 0.94 && blue > 0.94;
}

function classifyScheduleColor(color: SheetColor | null): boolean | null {
  if (!color || isNearWhite(color)) return null;

  const red = color.red ?? 0;
  const green = color.green ?? 0;
  const blue = color.blue ?? 0;

  if (green >= 0.45 && green > red * 1.15 && green > blue * 1.15) return true;
  if (red >= 0.45 && red > green * 1.15 && red > blue * 1.15) return false;

  return null;
}

function mapScheduleRows(data: SpreadsheetGetResponse): ScheduleRow[] {
  const rows = data.sheets?.[0]?.data?.[0]?.rowData ?? [];
  const headerCells = rows[0]?.values ?? [];
  const employees = headerCells.slice(2).map((cell) => getCellValue(cell));

  return rows.slice(1).flatMap((row) => {
    const cells = row.values ?? [];
    const date = getCellValue(cells[0]);
    const dayOfWeek = getCellValue(cells[1]);
    if (!date) return [];

    return employees.flatMap((employee, employeeIndex) => {
      if (!employee) return [];

      const cell = cells[employeeIndex + 2];
      const scheduleNote = getCellValue(cell);
      const color = getEffectiveBackgroundColor(cell);
      const plannedWork = classifyScheduleColor(color);
      const hasMeaningfulColor = Boolean(color && !isNearWhite(color));

      if (!hasMeaningfulColor && !scheduleNote) return [];

      return {
        date,
        dayOfWeek,
        employee,
        plannedWork,
        scheduleNote,
      };
    });
  });
}

export async function getAttendanceRows(): Promise<AttendanceResult> {
  if (!hasGoogleSheetsConfig()) {
    return {
      mode: 'demo',
      rows: DEMO_ATTENDANCE,
      message: 'Показаны demo-данные. Заполните Google Sheets переменные в .env, чтобы читать таблицу.',
    };
  }

  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID!;
  const token = await getAccessToken();
  const titles = await getSheetTitles(spreadsheetId, token, 'Sheets metadata');
  const attendanceTitle = titles.find((title) => title === ATTENDANCE_SHEET_TITLE);

  if (!attendanceTitle) {
    throw new Error(`Лист посещаемости "${ATTENDANCE_SHEET_TITLE}" не найден в GOOGLE_SHEETS_SPREADSHEET_ID. Доступные листы: ${formatAvailableTitles(titles)}.`);
  }

  const sheetRange = `${quoteSheetTitle(attendanceTitle)}!A:F`;
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sheetRange)}?majorDimension=ROWS`;

  let response: Response;
  try {
    response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
  } catch (error) {
    throw new Error(describeFetchError('Sheets values', error));
  }

  if (!response.ok) {
    const responseText = await readResponseText(response);
    throw new Error(`Sheets values request failed: status=${response.status}; response=${responseText}; available sheet titles=${formatAvailableTitles(titles)}`);
  }

  const data = await response.json() as { values?: string[][] };

  return {
    mode: 'google-sheets',
    rows: mapRows(data.values ?? []),
    message: 'Данные загружены из Google Sheets.',
  };
}

export async function getScheduleRows(): Promise<ScheduleResult> {
  if (!hasScheduleSheetsConfig()) {
    return {
      mode: 'not-configured',
      rows: [],
      message: 'График работы не подключён. Заполните GOOGLE_SHEETS_SCHEDULE_SPREADSHEET_ID в .env.',
    };
  }

  const spreadsheetId = process.env.GOOGLE_SHEETS_SCHEDULE_SPREADSHEET_ID!;
  const token = await getAccessToken();
  const titles = await getSheetTitles(spreadsheetId, token, 'Schedule metadata');
  const scheduleTitle = titles.find((title) => title === SCHEDULE_SHEET_TITLE);

  if (!scheduleTitle) {
    throw new Error(`Лист графика "${SCHEDULE_SHEET_TITLE}" не найден в GOOGLE_SHEETS_SCHEDULE_SPREADSHEET_ID. Доступные листы: ${formatAvailableTitles(titles)}.`);
  }

  const scheduleRange = `${quoteSheetTitle(scheduleTitle)}!A:ZZ`;
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?includeGridData=true&ranges=${encodeURIComponent(scheduleRange)}`;

  let response: Response;
  try {
    response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
  } catch (error) {
    throw new Error(describeFetchError('Schedule grid', error));
  }

  if (!response.ok) {
    const responseText = await readResponseText(response);
    throw new Error(`Schedule grid request failed: status=${response.status}; response=${responseText}; available sheet titles=${formatAvailableTitles(titles)}`);
  }

  const data = await response.json() as SpreadsheetGetResponse;

  return {
    mode: 'google-sheets',
    rows: mapScheduleRows(data),
    message: 'График работы загружен из Google Sheets.',
  };
}
