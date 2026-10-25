import {
  User,
  Student,
  ScheduleItem,
  UserRole,
  Submission,
  Homework,
  ClassGroup,
  Leader
} from '../types';
import {
  INITIAL_USERS,
  INITIAL_STUDENTS,
  INITIAL_SCHEDULE,
  INITIAL_HOMEWORK,
  INITIAL_SUBMISSIONS,
  INITIAL_LEADERS,
  INITIAL_AUDIT_LOGS
} from './mockData';

const BASE_URL = 'https://sheets.googleapis.com/v4/spreadsheets';

export interface SpreadsheetVerificationResult {
  success: boolean;
  spreadsheetTitle: string;
  sheetsFound: string[];
  userCount: number;
  studentCount: number;
  scheduleCount: number;
  homeworkCount: number;
  groupCount?: number;
  classes?: string[];
  sampleUsers: { name: string; role: string; username: string; classId?: string }[];
  sampleStudents: { code: string; name: string; classId: string }[];
  sampleSchedule: { day: string; period: number; subject: string; teacher: string; classId: string }[];
  message: string;
}

export interface ParsedSheetData {
  users: User[];
  students: Student[];
  schedule: ScheduleItem[];
  homework: Homework[];
  submissions?: Submission[];
  groups?: ClassGroup[];
  classes?: string[];
  settings?: Record<string, string>;
}

/**
 * Fetch spreadsheet metadata to check access and existing sheet tabs
 */
export async function getSpreadsheet(spreadsheetId: string, token: string) {
  const res = await fetch(`${BASE_URL}/${spreadsheetId}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Google Sheets нээхэд алдаа гарлаа: HTTP ${res.status}`);
  }
  return res.json();
}

/**
 * Ensures the core sheets exist in exact order and removes any obsolete 'leaders' tab:
 * 1. users (Багш, сурагчдын нэвтрэх нэр, нууц үг, role [teacher, leader1..5, хоосон=student], group [group1..5])
 * 2. Schedule (Хичээлийн хуваарь)
 * 3. Homework (Гэрийн даалгаврын биелэлт, илгээлт, явц - Автоматаар sync хийгдэнэ)
 * 4. Settings (Тохиргоо)
 */
export async function ensureSheetsExist(spreadsheetId: string, token: string) {
  const meta = await getSpreadsheet(spreadsheetId, token);
  const existingSheetObjs: { title: string; sheetId: number }[] = (meta.sheets || []).map((s: any) => ({
    title: s.properties?.title as string,
    sheetId: s.properties?.sheetId as number
  }));

  const requiredSheets = [
    'users',
    'Schedule',
    'Homework',
    'Settings'
  ];

  const requests: any[] = [];
  for (let idx = 0; idx < requiredSheets.length; idx++) {
    const sheetName = requiredSheets[idx];
    const existing = existingSheetObjs.find(
      s => s.title.toLowerCase().trim() === sheetName.toLowerCase()
    );
    if (!existing) {
      requests.push({
        addSheet: {
          properties: {
            title: sheetName,
            index: idx
          }
        }
      });
    } else {
      requests.push({
        updateSheetProperties: {
          properties: {
            sheetId: existing.sheetId,
            title: sheetName,
            index: idx
          },
          fields: 'title,index'
        }
      });
    }
  }

  // Delete obsolete 'leaders' sheet if present
  const obsoleteLeadersSheet = existingSheetObjs.find(
    s => s.title.toLowerCase().trim() === 'leaders'
  );
  if (obsoleteLeadersSheet && existingSheetObjs.length > 1) {
    requests.push({
      deleteSheet: {
        sheetId: obsoleteLeadersSheet.sheetId
      }
    });
  }

  if (requests.length > 0) {
    const batchRes = await fetch(`${BASE_URL}/${spreadsheetId}:batchUpdate`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ requests })
    });
    if (!batchRes.ok) {
      const err = await batchRes.json().catch(() => ({}));
      console.warn('Sheet properties update warning:', err.error?.message);
    }
  }

  return requiredSheets;
}

/**
 * Write values to a specific range (e.g. users!A1)
 */
export async function writeRange(spreadsheetId: string, range: string, values: any[][], token: string) {
  const url = `${BASE_URL}/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ values })
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `${range} хэсэгт өгөгдөл бичихэд алдаа гарлаа.`);
  }

  return res.json();
}

/**
 * Read values from a specific range
 */
export async function readRange(spreadsheetId: string, range: string, token: string): Promise<any[][]> {
  const url = `${BASE_URL}/${spreadsheetId}/values/${encodeURIComponent(range)}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `${range} хэсгээс өгөгдөл уншихад алдаа гарлаа.`);
  }

  const data = await res.json();
  return data.values || [];
}

/**
 * Helper to find tab name case-insensitively across the sheets
 */
function findSheetName(existingSheets: string[], targetName: string): string {
  const targetLower = targetName.toLowerCase().trim();

  // 1. Exact case-insensitive match first
  const exact = existingSheets.find(s => s.toLowerCase().trim() === targetLower);
  if (exact) return exact;

  // 2. Synonym matching
  const found = existingSheets.find(s => {
    const sLower = s.toLowerCase().trim();
    if (targetLower === 'users') {
      return (
        sLower.includes('user') ||
        sLower.includes('хэрэглэгч') ||
        sLower.includes('хэрэглэгчид') ||
        sLower.includes('нэвтрэх') ||
        sLower.includes('бүртгэл') ||
        sLower.includes('login') ||
        sLower.includes('account')
      );
    }
    if (targetLower === 'schedule') {
      return (
        sLower.includes('sched') ||
        sLower.includes('хуваарь') ||
        sLower.includes('цагийн') ||
        sLower.includes('цаг')
      );
    }
    if (targetLower === 'homework') {
      return (
        sLower.includes('homework') ||
        sLower.includes('даалгавар') ||
        sLower.includes('гэрийн')
      );
    }
    if (targetLower === 'settings') {
      return (
        sLower.includes('setting') ||
        sLower.includes('тохиргоо')
      );
    }
    return false;
  });
  return found || targetName;
}

/**
 * Searches rows 0 through 5 to locate the true header row with highest matching score
 */
function findHeaderRowIndex(rows: any[][], keywords: string[]): { headerIndex: number; headerRow: string[] } {
  let bestIdx = 0;
  let bestScore = 0;
  let bestHeaderRow: string[] = [];

  for (let r = 0; r < Math.min(6, rows.length); r++) {
    const row = rows[r];
    if (!row || !Array.isArray(row) || row.length === 0) continue;
    const strRow = row.map(c => String(c ?? '').trim().toLowerCase());
    let score = 0;
    for (const cell of strRow) {
      if (!cell) continue;
      for (const kw of keywords) {
        if (cell === kw || cell.includes(kw)) {
          score++;
          break;
        }
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestIdx = r;
      bestHeaderRow = strRow;
    }
  }

  if (bestScore === 0 && rows.length > 0) {
    bestHeaderRow = rows[0].map(c => String(c ?? '').trim().toLowerCase());
  }

  return { headerIndex: bestIdx, headerRow: bestHeaderRow };
}

/**
 * Reads data from Google Sheet:
 * 1. users (Багш, сурагчдын нэвтрэх нэр, нууц үг, role [teacher, leader1..5, хоосон=student], group [group1..5])
 * 2. Schedule (Хичээлийн хуваарь)
 * 3. Homework (Гэрийн даалгаврын биелэлт, явц)
 * 4. Settings (Тохиргоо)
 */
export async function readFilledDataFromSheet(spreadsheetId: string, token: string): Promise<ParsedSheetData> {
  const meta = await getSpreadsheet(spreadsheetId, token);
  const existingSheets: string[] = (meta.sheets || []).map((s: any) => s.properties?.title as string);

  const usersSheetName = findSheetName(existingSheets, 'users');
  const scheduleSheetName = findSheetName(existingSheets, 'Schedule');
  const homeworkSheetName = findSheetName(existingSheets, 'Homework');
  const settingsSheetName = findSheetName(existingSheets, 'Settings');

  // 1. Read Sheet 1: users (contains all users, students, roles: teacher / leader1..5 / empty=student, and groups: group1..5)
  let rawUsers: any[][] = [];
  try {
    rawUsers = await readRange(spreadsheetId, `${usersSheetName}!A1:Z1000`, token);
  } catch (e) {
    console.warn('Could not read users sheet:', e);
  }

  // 2. Read Sheet 2: Schedule
  let rawSchedule: any[][] = [];
  try {
    rawSchedule = await readRange(spreadsheetId, `${scheduleSheetName}!A1:Z1000`, token);
  } catch (e) {
    console.warn('Could not read Schedule sheet:', e);
  }

  // 3. Read Sheet 3: Homework (assignments + student homework progress/submissions)
  let rawHomework: any[][] = [];
  try {
    rawHomework = await readRange(spreadsheetId, `${homeworkSheetName}!A1:Z2000`, token);
  } catch (e) {
    console.warn('Could not read Homework sheet:', e);
  }

  // 4. Read Sheet 4: Settings
  let rawSettings: any[][] = [];
  try {
    rawSettings = await readRange(spreadsheetId, `${settingsSheetName}!A1:Z100`, token);
  } catch {
    // ignore
  }

  // Parse Sheet 1: users -> extracts Users, Students, ClassGroups (group1..5), Leaders (leader1..5), and Classes (from 'class' column)
  const parsedUsersBundle = parseUnifiedUsersSheet(rawUsers);
  // Parse Schedule
  const parsedSchedule = parseScheduleRows(rawSchedule);
  // Parse Homework + Submissions
  const parsedHomework = parseHomeworkRows(rawHomework);
  const parsedSubmissions = parseSubmissionsFromHomeworkRows(rawHomework, parsedUsersBundle.students);
  // Parse Settings
  const parsedSettings = parseSettingsRows(rawSettings);

  return {
    users: parsedUsersBundle.users,
    students: parsedUsersBundle.students,
    schedule: parsedSchedule,
    homework: parsedHomework,
    submissions: parsedSubmissions,
    groups: parsedUsersBundle.groups,
    classes: parsedUsersBundle.classes,
    settings: parsedSettings
  };
}

/**
 * Normalizes username / student code across Cyrillic and Latin homoglyphs,
 * stripping dashes, spaces, dots, underscores, so "10А-01" matches "10A-01" or "10a01".
 */
export function normalizeUsername(str: string): string {
  if (!str) return '';
  return str
    .trim()
    .toLowerCase()
    .replace(/\u0430/g, 'a') // Cyrillic а -> Latin a
    .replace(/\u0432/g, 'b') // Cyrillic в -> Latin b
    .replace(/\u0435/g, 'e') // Cyrillic е -> Latin e
    .replace(/\u043e/g, 'o') // Cyrillic о -> Latin o
    .replace(/\u0441/g, 'c') // Cyrillic с -> Latin c
    .replace(/\u0445/g, 'x') // Cyrillic х -> Latin x
    .replace(/\u0440/g, 'p') // Cyrillic р -> Latin p
    .replace(/\u0443/g, 'y') // Cyrillic у -> Latin y
    .replace(/\u0442/g, 't') // Cyrillic т -> Latin t
    .replace(/\u043c/g, 'm') // Cyrillic м -> Latin m
    .replace(/\u043d/g, 'n') // Cyrillic н -> Latin n
    .replace(/\u0451/g, 'e') // Cyrillic ё -> Latin e
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Clean cell value from Google Sheets: handles numbers, integers with .0 suffix, and wrapping quotes.
 */
export function cleanSheetValue(val: any): string {
  if (val === null || val === undefined) return '';
  let str = String(val).trim();
  str = str.replace(/^['"`]|['"`]$/g, '').trim();
  if (/^\d+\.0+$/.test(str)) {
    str = str.replace(/\.0+$/, '');
  }
  return str;
}

/**
 * Normalizes a class value from the 'class' column of the 'users' sheet
 * (e.g., "10A", "10а", "10А анги" -> "10А"; "11B" -> "11Б")
 */
export function cleanClassValue(raw: string): string {
  if (!raw) return '';
  let val = cleanSheetValue(raw)
    .replace(/\s*анги\s*$/i, '')
    .replace(/\s+/g, '')
    .toUpperCase();
  // Convert common Latin grade letters after numbers into Cyrillic so class IDs match consistently
  val = val.replace(/^(\d{1,2})([A-Z])$/, (_m, num, letter) => {
    const map: Record<string, string> = {
      A: 'А',
      B: 'Б',
      V: 'В',
      G: 'Г',
      D: 'Д',
      E: 'Е',
      C: 'С',
      K: 'К',
      M: 'М',
      H: 'Н',
      O: 'О',
      P: 'Р',
      T: 'Т',
      X: 'Х'
    };
    return `${num}${map[letter] || letter}`;
  });
  return val;
}

/**
 * Strips any email addresses (e.g., "user@gmail.com", "(user@gmail.com)", "<user@gmail.com>")
 * and group/leader tags from a student's name so emails never appear behind student names.
 */
export function stripEmailsFromName(raw: string): string {
  if (!raw) return '';
  let str = String(raw).trim();
  // If the entire string is just an email address, take only the part before '@'
  if (/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(str)) {
    return str.split('@')[0].trim();
  }
  // Remove parenthesized, bracketed, or angle-bracketed email addresses
  str = str.replace(/\s*[\(\[<][a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}[\)\]>]\s*/gi, ' ');
  // Remove standalone email addresses anywhere in the string
  str = str.replace(/\s*[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\s*/gi, ' ');
  // Remove trailing punctuation like " -", " ·", "," left over after an email
  str = str.replace(/[\s\-·,/|:]+$/, '').replace(/^[\s\-·,/|:]+/, '').trim();
  return str;
}

/**
 * Ensures studentCode never contains an email address (e.g., when the sheet's username column is an email).
 */
export function sanitizeStudentCode(rawCode: string, classId: string, index: number): string {
  const cleaned = cleanSheetValue(rawCode);
  if (!cleaned || cleaned.includes('@')) {
    return `${classId || '10А'}-${String(index).padStart(2, '0')}`;
  }
  const withoutEmail = stripEmailsFromName(cleaned);
  if (!withoutEmail || withoutEmail.includes('@')) {
    return `${classId || '10А'}-${String(index).padStart(2, '0')}`;
  }
  return withoutEmail.toUpperCase();
}

/**
 * Unified parser for the 'users' sheet:
 * - Reads username, password, fullName/displayName, class (from 'class' column), role, and group
 * - role column:
 *   - 'teacher' (or 'admin', 'багш') -> TEACHER role
 *   - 'leader1', 'leader2', ..., 'leader5' (or 'leader 1'..'leader 5', 'leader', 'ахлагч') -> LEADER role
 *   - empty ('') or 'student' -> STUDENT role
 * - group column:
 *   - 'group1', 'group2', ..., 'group5' -> assigns the student to that group (1 to 5)
 * - class column:
 *   - pulls class information (e.g. '10А', '10Б', '11А', etc.) for users, students, and class groups
 */
export function parseUnifiedUsersSheet(
  rows: any[][],
  existingStudents: Student[] = []
): { users: User[]; students: Student[]; groups: ClassGroup[]; leaders: Leader[]; classes: string[] } {
  if (!rows || rows.length === 0) {
    const fallbackClasses = Array.from(new Set(existingStudents.map(s => s.classId).filter(Boolean)));
    return { users: [], students: existingStudents, groups: [], leaders: [], classes: fallbackClasses };
  }

  const { headerIndex, headerRow } = findHeaderRowIndex(rows, [
    'username', 'user', 'хэрэглэгч', 'нэвтрэх', 'логин', 'studentcode', 'код',
    'password', 'нууц', 'pass', 'pin',
    'role', 'үүрэг', 'эрх',
    'group', 'групп', 'бүлэг', 'хэсэг',
    'class', 'classid', 'анги',
    'fullname', 'displayname', 'нэр', 'овог'
  ]);

  let startIndex = headerIndex + 1;

  let usernameIdx = headerRow.findIndex(h =>
    h === 'username' ||
    h === 'user' ||
    h === 'нэвтрэх нэр' ||
    h === 'хэрэглэгчийн нэр' ||
    h === 'хэрэглэгч' ||
    h.includes('нэвтрэх нэр') ||
    h.includes('хэрэглэгч') ||
    h.includes('нэвтрэх') ||
    h === 'логин' ||
    h === 'login' ||
    h === 'account' ||
    h === 'studentcode' ||
    h === 'сурагчийн код' ||
    h === 'код'
  );
  if (usernameIdx === -1) {
    usernameIdx = headerRow.findIndex(h => h.includes('user') || h.includes('код') || h.includes('code') || h === 'id');
  }

  let passwordIdx = headerRow.findIndex(h =>
    h === 'password' ||
    h === 'passwordhash' ||
    h === 'нууц үг' ||
    h === 'нууц код' ||
    h === 'нууцүг' ||
    h.includes('нууц үг') ||
    h.includes('нууцүг') ||
    h.includes('нууц код') ||
    h.includes('нууц') ||
    h.includes('pass') ||
    h.includes('pin') ||
    h.includes('пин')
  );

  let roleIdx = headerRow.findIndex(h =>
    h === 'role' ||
    h.includes('role') ||
    h.includes('үүрэг') ||
    h.includes('эрх') ||
    h.includes('төрөл') ||
    h.includes('албан тушаал') ||
    h === 'leader' ||
    h.includes('ахлагч')
  );

  let groupIdx = headerRow.findIndex(h =>
    h === 'group' ||
    h === 'groupnumber' ||
    h.includes('group') ||
    h.includes('групп') ||
    h.includes('бүлэг') ||
    h.includes('хэсэг')
  );

  // Specifically prioritize 'class' / 'анги' / 'classid' column from 'users' sheet
  let classIdx = headerRow.findIndex(h =>
    h === 'class' ||
    h === 'анги' ||
    h === 'classid' ||
    h === 'class_id' ||
    h.includes('class') ||
    h.includes('анги')
  );

  let nameIdx = headerRow.findIndex((h, idx) =>
    idx !== usernameIdx &&
    idx !== classIdx &&
    !h.includes('mail') &&
    !h.includes('мэйл') &&
    !h.includes('меил') &&
    (
      h.includes('fullname') ||
      h.includes('displayname') ||
      h.includes('овог') ||
      h.includes('бүтэн') ||
      h.includes('сурагч') ||
      h.includes('student') ||
      (h.includes('нэр') && !h.includes('нэвтрэх') && !h.includes('хэрэглэгч')) ||
      h === 'name'
    )
  );

  let studentCodeColIdx = headerRow.findIndex((h, idx) =>
    idx !== usernameIdx &&
    idx !== classIdx &&
    !h.includes('mail') &&
    !h.includes('мэйл') &&
    (h.includes('studentcode') || h.includes('studentid') || h.includes('сурагчийн код') || h.includes('сурагч код') || h === 'код')
  );

  let activeIdx = headerRow.findIndex(h =>
    h.includes('active') ||
    h.includes('идэвх') ||
    h.includes('төлөв') ||
    h.includes('status')
  );

  // Positional fallback if no headers matched
  if (usernameIdx === -1) {
    const firstCell = rows[0]?.[0]?.toString().toLowerCase() || '';
    if (headerIndex === 0 && !firstCell.includes('user') && !firstCell.includes('нэвтрэх') && !firstCell.includes('код')) {
      startIndex = 0;
    }
    usernameIdx = 0;
    if (passwordIdx === -1) passwordIdx = 1;
    if (roleIdx === -1) roleIdx = 2;
    if (groupIdx === -1) groupIdx = 3;
    if (classIdx === -1) classIdx = 4;
    if (nameIdx === -1) nameIdx = 5;
  }

  // First pass: collect all explicit class names from the 'class' column of 'users' sheet
  const sheetClassesSet = new Set<string>();
  for (let i = startIndex; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;
    if (classIdx !== -1 && row[classIdx] !== undefined) {
      const cVal = cleanClassValue(row[classIdx]);
      if (cVal && cVal.toLowerCase() !== 'class' && cVal.toLowerCase() !== 'classid' && cVal.toLowerCase() !== 'анги') {
        sheetClassesSet.add(cVal);
      }
    }
  }
  const defaultSheetClass = Array.from(sheetClassesSet)[0] || '10А';

  const users: User[] = [];
  const students: Student[] = [];
  const seenUsernames = new Set<string>();
  const GROUP_COLORS = ['blue', 'emerald', 'amber', 'purple', 'rose'];
  const groupMap = new Map<string, { classId: string; groupNumber: number; groupName: string; studentIds: string[] }>();

  for (let i = startIndex; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    let usernameRaw = usernameIdx !== -1 && row[usernameIdx] !== undefined ? cleanSheetValue(row[usernameIdx]) : '';
    const extraCode = studentCodeColIdx !== -1 && row[studentCodeColIdx] !== undefined ? cleanSheetValue(row[studentCodeColIdx]) : '';
    const rawName = nameIdx !== -1 && row[nameIdx] !== undefined ? cleanSheetValue(row[nameIdx]) : '';

    if (!usernameRaw && extraCode) {
      usernameRaw = extraCode;
    }

    // Skip empty rows or repeated header rows
    if (!usernameRaw && !rawName) continue;
    const uLower = usernameRaw.toLowerCase();
    if (uLower === 'username' || uLower === 'нэвтрэх нэр' || uLower === 'studentcode' || uLower === 'код') {
      continue;
    }

    const norm = normalizeUsername(usernameRaw || rawName);
    const dedupKey = norm || uLower;
    if (dedupKey && seenUsernames.has(dedupKey)) continue;
    if (dedupKey) seenUsernames.add(dedupKey);

    const rawPass = passwordIdx !== -1 && row[passwordIdx] !== undefined ? cleanSheetValue(row[passwordIdx]) : '';
    let rawRoleCell = roleIdx !== -1 && row[roleIdx] !== undefined ? cleanSheetValue(row[roleIdx]) : '';
    let rawGroupCell = groupIdx !== -1 && row[groupIdx] !== undefined ? cleanSheetValue(row[groupIdx]) : '';
    let rawClass = classIdx !== -1 && row[classIdx] !== undefined ? cleanClassValue(row[classIdx]) : '';
    const rawActive = activeIdx !== -1 && row[activeIdx] !== undefined ? cleanSheetValue(row[activeIdx]).toLowerCase() : 'true';
    const isActive = rawActive !== 'false' && rawActive !== '0';

    // Also scan all cells in the row for 'group1'..'group5', 'leader1'..'leader5', 'teacher', or class pattern (e.g. '10А', '11Б') in case columns are shifted
    for (let c = 0; c < row.length; c++) {
      if (c === usernameIdx || c === passwordIdx || c === nameIdx) continue;
      const cellVal = cleanSheetValue(row[c]);
      if (!cellVal) continue;
      if (/^group\s*[1-5]$/i.test(cellVal) && !rawGroupCell) {
        rawGroupCell = cellVal;
      } else if (/^leader\s*[1-5]$/i.test(cellVal) && !rawRoleCell) {
        rawRoleCell = cellVal;
      } else if (/^(teacher|багш|admin)$/i.test(cellVal) && !rawRoleCell) {
        rawRoleCell = cellVal;
      } else if (!rawClass && /^\d{1,2}\s*[А-ЯӨҮЁA-Zа-яөүёa-z]{1,2}(\s*анги)?$/i.test(cellVal) && !/^(group|leader)/i.test(cellVal)) {
        rawClass = cleanClassValue(cellVal);
      }
    }

    // If rawClass is still empty, check if username or studentCode starts with a class prefix like "10А-01" or "10A-01"
    if (!rawClass) {
      const codeForClass = extraCode || usernameRaw;
      const prefixMatch = codeForClass.match(/^(\d{1,2}[А-ЯӨҮЁA-Zа-яөүёa-z])[-_]/);
      if (prefixMatch) {
        rawClass = cleanClassValue(prefixMatch[1]);
      }
    }

    if (rawClass) {
      sheetClassesSet.add(rawClass);
    }

    const roleLower = rawRoleCell.toLowerCase().trim();
    const groupLower = rawGroupCell.toLowerCase().trim();

    // Determine role:
    // - 'teacher', 'admin', 'багш' -> TEACHER
    // - 'leader1', 'leader2', ..., 'leader 1', 'leader', 'ахлагч' -> LEADER
    // - empty ('') or 'student', 'сурагч' -> STUDENT
    let role: UserRole = 'STUDENT';
    let isLeader = false;
    if (
      roleLower.includes('teach') ||
      roleLower.includes('багш') ||
      roleLower.includes('admin') ||
      uLower === 'teacher' ||
      uLower === 'admin'
    ) {
      role = 'TEACHER';
    } else if (
      /^leader\s*[1-5]?$/i.test(roleLower) ||
      roleLower.includes('leader') ||
      roleLower.includes('ахлагч') ||
      /^leader\s*[1-5]$/i.test(groupLower)
    ) {
      role = 'LEADER';
      isLeader = true;
    } else {
      // Empty role cell or 'student' -> STUDENT
      role = 'STUDENT';
      isLeader = false;
    }

    // Parse group number (1..5) from group column (e.g., 'group1', 'group2') or from leader role (e.g., 'leader1', 'leader2')
    let groupNumber = 1;
    const grpMatch = rawGroupCell.match(/[1-5]/);
    const roleGrpMatch = rawRoleCell.match(/[1-5]/);
    if (grpMatch) {
      groupNumber = parseInt(grpMatch[0], 10);
    } else if (roleGrpMatch) {
      groupNumber = parseInt(roleGrpMatch[0], 10);
    }
    groupNumber = Math.max(1, Math.min(5, groupNumber));

    const classId = rawClass || defaultSheetClass;
    sheetClassesSet.add(classId);

    // If rawName is empty or is an email address, check other cells in the row for a person name (non-email, non-role, non-group, non-class)
    let candidateName = rawName;
    if (!candidateName || candidateName.includes('@')) {
      for (let c = 0; c < row.length; c++) {
        if (c === passwordIdx || c === roleIdx || c === groupIdx || c === classIdx || c === activeIdx) continue;
        const val = cleanSheetValue(row[c]);
        if (
          val &&
          !val.includes('@') &&
          !/^(group|leader)\s*[1-5]?$/i.test(val) &&
          !/^(teacher|багш|admin|student|сурагч|true|false|0|1)$/i.test(val) &&
          !/^\d{1,2}\s*[А-ЯӨҮЁA-Zа-яөүёa-z]{1,2}(\s*анги)?$/i.test(val) &&
          !/^\d{1,2}[А-ЯӨҮЁA-Zа-яөүёa-z][-_]\d+$/i.test(val) &&
          /[А-ЯӨҮЁа-яөүёA-Za-z]{2,}/.test(val)
        ) {
          candidateName = val;
          break;
        }
      }
    }

    const cleanFullName = stripEmailsFromName(
      (candidateName || usernameRaw).replace(/\s*\((?:leader|group)\s*\d+.*?\)\s*/gi, '').trim()
    );

    if (role === 'TEACHER') {
      users.push({
        userId: `u_${norm || uLower.replace(/[^a-z0-9]/g, '_') || i}`,
        username: uLower || `teacher_${i}`,
        passwordHash: rawPass || 'admin',
        role: 'TEACHER',
        classId: rawClass || undefined,
        active: isActive,
        displayName: cleanFullName || 'Багш',
        createdAt: new Date().toISOString()
      });
    } else {
      // Both LEADER and STUDENT rows represent students in a group (group1..group5) and class (from 'class' column)
      // Never use an email address as studentCode
      const studentSeq = students.length + 1;
      const rawCandidateCode = extraCode && !extraCode.includes('@')
        ? extraCode
        : (!usernameRaw.includes('@') ? usernameRaw : '');
      const studentCode = sanitizeStudentCode(rawCandidateCode, classId, studentSeq);
      const normCode = normalizeUsername(usernameRaw || studentCode);
      const studentId = `std_${normCode || studentCode.toLowerCase().replace(/[^a-z0-9]/g, '_') || i}`;
      const groupName = `${groupNumber}-р хэсэг (group${groupNumber})`;

      let student = students.find(
        s =>
          s.studentId === studentId ||
          (normCode && normalizeUsername(s.studentCode) === normCode)
      );

      if (!student) {
        student = {
          studentId,
          studentCode,
          fullName: cleanFullName || studentCode,
          classId,
          active: isActive,
          publicDisplayName: cleanFullName ? cleanFullName.split(' ')[0] : studentCode,
          showOnLeaderboard: true,
          groupId: `grp_${classId}_${groupNumber}`,
          groupNumber,
          groupName,
          isLeader,
          password: rawPass || 'password123'
        };
        students.push(student);
      } else {
        student.studentCode = studentCode;
        if (cleanFullName) student.fullName = cleanFullName;
        student.classId = classId;
        student.active = isActive;
        student.groupId = `grp_${classId}_${groupNumber}`;
        student.groupNumber = groupNumber;
        student.groupName = groupName;
        student.isLeader = isLeader;
        if (rawPass) student.password = rawPass;
      }

      const userId = `u_${normCode || uLower.replace(/[^a-z0-9]/g, '_') || i}`;
      users.push({
        userId,
        username: (usernameRaw || studentCode).toLowerCase(),
        passwordHash: rawPass || student.password || 'password123',
        role: isLeader ? 'LEADER' : 'STUDENT',
        studentId: student.studentId,
        classId,
        active: isActive,
        displayName: student.fullName,
        createdAt: new Date().toISOString()
      });

      const groupKey = `${classId}_${groupNumber}`;
      if (!groupMap.has(groupKey)) {
        groupMap.set(groupKey, {
          classId,
          groupNumber,
          groupName,
          studentIds: []
        });
      }
      if (!groupMap.get(groupKey)!.studentIds.includes(student.studentId)) {
        groupMap.get(groupKey)!.studentIds.push(student.studentId);
      }
    }
  }

  const finalGroups: ClassGroup[] = [];
  const finalLeaders: Leader[] = [];

  groupMap.forEach(grpInfo => {
    const grpStudents = students.filter(s => grpInfo.studentIds.includes(s.studentId));
    let leaderSt = grpStudents.find(s => s.isLeader) || grpStudents[0];
    if (leaderSt) {
      leaderSt.isLeader = true;
      const leaderUser = users.find(u => u.studentId === leaderSt!.studentId);
      if (leaderUser) {
        leaderUser.role = 'LEADER';
        leaderUser.displayName = `${leaderSt.fullName} (leader${grpInfo.groupNumber})`;
      }
    }

    const leaderUserId = leaderSt
      ? (users.find(u => u.studentId === leaderSt!.studentId)?.userId || `u_${normalizeUsername(leaderSt.studentCode)}`)
      : undefined;

    const classGroup: ClassGroup = {
      groupId: `grp_${grpInfo.classId}_${grpInfo.groupNumber}`,
      classId: grpInfo.classId,
      groupNumber: grpInfo.groupNumber,
      name: grpInfo.groupName,
      leaderStudentId: leaderSt?.studentId,
      leaderName: leaderSt?.fullName,
      leaderUserId,
      color: GROUP_COLORS[grpInfo.groupNumber - 1] || 'blue'
    };
    finalGroups.push(classGroup);

    if (leaderSt && leaderUserId) {
      finalLeaders.push({
        leaderId: `lead_${grpInfo.classId}_${grpInfo.groupNumber}`,
        userId: leaderUserId,
        classId: grpInfo.classId,
        groupId: classGroup.groupId,
        groupNumber: grpInfo.groupNumber,
        assignedBy: 'sheet',
        active: true,
        createdAt: new Date().toISOString()
      });
    }
  });

  const classesList = Array.from(sheetClassesSet).sort((a, b) => a.localeCompare(b, 'mn', { numeric: true }));

  return {
    users,
    students: students.length > 0 ? students : existingStudents,
    groups: finalGroups.sort((a, b) => a.groupNumber - b.groupNumber),
    leaders: finalLeaders,
    classes: classesList
  };
}

/**
 * Legacy-compatible wrapper that parses groups/students/leaders/classes from 'users' sheet rows
 */
export function parseGroupsRows(
  rows: any[][],
  students: Student[]
): { groups: ClassGroup[]; updatedStudents: Student[]; leaders: Leader[]; classes: string[] } {
  const res = parseUnifiedUsersSheet(rows, students);
  return {
    groups: res.groups,
    updatedStudents: res.students,
    leaders: res.leaders,
    classes: res.classes
  };
}

/**
 * Parses Sheet 3 ('Schedule') rows
 */
function parseScheduleRows(rows: any[][]): ScheduleItem[] {
  if (!rows || rows.length === 0) return [];

  let headerRow = rows[0].map((c: any) => String(c || '').trim().toLowerCase());
  let startIndex = 1;

  let dayIdx = headerRow.findIndex(h => h.includes('weekday') || h.includes('гараг') || h.includes('өдөр'));
  let periodIdx = headerRow.findIndex(h => h.includes('period') || h.includes('цаг'));
  let subjectIdx = headerRow.findIndex(h => h.includes('subject') || h.includes('хичээл'));
  let teacherIdx = headerRow.findIndex(h => h.includes('teacher') || h.includes('багш'));
  let classIdx = headerRow.findIndex(h => h.includes('class') || h.includes('анги'));
  let startIdx = headerRow.findIndex(h => h.includes('start') || h.includes('эхлэх'));
  let endIdx = headerRow.findIndex(h => h.includes('end') || h.includes('дуусах'));
  let notesIdx = headerRow.findIndex(h => h.includes('note') || h.includes('тайлбар') || h.includes('танхим'));

  if (subjectIdx === -1) {
    if (!rows[0][0]?.toString().toLowerCase().includes('schedule')) {
      startIndex = 0;
    }
    classIdx = 1;
    dayIdx = 2;
    periodIdx = 3;
    subjectIdx = 5;
    teacherIdx = 6;
    startIdx = 7;
    endIdx = 8;
    notesIdx = 10;
  }

  const items: ScheduleItem[] = [];

  const PERIOD_DEFAULT_TIMES: Record<number, { start: string; end: string }> = {
    1: { start: '08:00', end: '08:45' },
    2: { start: '08:50', end: '09:35' },
    3: { start: '09:45', end: '10:30' },
    4: { start: '10:40', end: '11:25' },
    5: { start: '11:35', end: '12:20' },
    6: { start: '12:30', end: '13:15' },
    7: { start: '13:25', end: '14:10' }
  };

  for (let i = startIndex; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    const subjectName = row[subjectIdx] !== undefined ? String(row[subjectIdx]).trim() : '';
    if (!subjectName) continue;

    const rawDay = row[dayIdx] !== undefined ? String(row[dayIdx]).trim().toLowerCase() : '1';
    let weekday = 1;
    if (rawDay.includes('мяг') || rawDay === '2' || rawDay.includes('tue')) weekday = 2;
    else if (rawDay.includes('лха') || rawDay === '3' || rawDay.includes('wed')) weekday = 3;
    else if (rawDay.includes('пүр') || rawDay === '4' || rawDay.includes('thu')) weekday = 4;
    else if (rawDay.includes('баа') || rawDay === '5' || rawDay.includes('fri')) weekday = 5;
    else if (rawDay.includes('бям') || rawDay === '6' || rawDay.includes('sat')) weekday = 6;
    else if (rawDay.includes('ням') || rawDay === '7' || rawDay.includes('sun')) weekday = 7;
    else if (rawDay.includes('дав') || rawDay === '1' || rawDay.includes('mon')) weekday = 1;
    else weekday = parseInt(rawDay) || 1;

    let rawPeriod = row[periodIdx] !== undefined ? String(row[periodIdx]).replace(/[^0-9]/g, '') : '1';
    const period = parseInt(rawPeriod) || 1;
    const teacherName = row[teacherIdx] !== undefined && String(row[teacherIdx]).trim()
      ? String(row[teacherIdx]).trim()
      : 'Багш';
    const classId = row[classIdx] !== undefined && String(row[classIdx]).trim()
      ? String(row[classIdx]).trim()
      : '10А';

    const defaultTimes = PERIOD_DEFAULT_TIMES[period] || { start: '08:00', end: '08:45' };
    const startTime = row[startIdx] !== undefined && String(row[startIdx]).trim()
      ? String(row[startIdx]).trim()
      : defaultTimes.start;
    const endTime = row[endIdx] !== undefined && String(row[endIdx]).trim()
      ? String(row[endIdx]).trim()
      : defaultTimes.end;
    const notes = row[notesIdx] !== undefined ? String(row[notesIdx]).trim() : undefined;

    items.push({
      scheduleId: row[0] ? String(row[0]).trim() : `sch_${i}`,
      classId,
      weekday,
      period,
      subjectId: `sub_${subjectName.toLowerCase().replace(/[^a-zA-Z0-9]/g, '_')}`,
      subjectName,
      teacherName,
      startTime,
      endTime,
      active: true,
      notes
    });
  }

  return items;
}

/**
 * Parses Homework definitions from Sheet 4 ('Homework')
 */
function parseHomeworkRows(rows: any[][]): Homework[] {
  if (!rows || rows.length === 0) return [];

  const headerRow = rows[0].map((c: any) => String(c || '').trim().toLowerCase());
  let startIndex = 1;

  let hwIdIdx = headerRow.findIndex(h => h === 'homeworkid' || h === 'даалгавар id');
  let titleIdx = headerRow.findIndex(h => h.includes('title') || h.includes('гарчиг') || h.includes('даалгавар'));
  let subjectIdx = headerRow.findIndex(h => h.includes('subject') || h.includes('хичээл'));
  let classIdx = headerRow.findIndex(h => h.includes('class') || h.includes('анги'));
  let descIdx = headerRow.findIndex(h => h.includes('desc') || h.includes('тайлбар') || h.includes('агуулга'));
  let assignIdx = headerRow.findIndex(h => h.includes('assign') || h.includes('огноо') || h.includes('өгсөн') || h === 'date');
  let dueIdx = headerRow.findIndex(h => h.includes('due') || h.includes('дуусах') || h.includes('хугацаа'));

  if (titleIdx === -1 && subjectIdx === -1) {
    if (!rows[0][0]?.toString().toLowerCase().includes('homework') && !rows[0][0]?.toString().toLowerCase().includes('огноо')) {
      startIndex = 0;
    }
    assignIdx = 0;
    classIdx = 1;
    subjectIdx = 2;
    titleIdx = 3;
  }

  const items: Homework[] = [];
  const seenHw = new Set<string>();

  for (let i = startIndex; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    const title = titleIdx !== -1 && row[titleIdx] !== undefined ? String(row[titleIdx]).trim() : '';
    const subjectName = subjectIdx !== -1 && row[subjectIdx] !== undefined ? String(row[subjectIdx]).trim() : '';

    if (!title && !subjectName) continue;

    const classId = classIdx !== -1 && row[classIdx] !== undefined && String(row[classIdx]).trim()
      ? String(row[classIdx]).trim()
      : '10А';
    const description = descIdx !== -1 && row[descIdx] !== undefined && String(row[descIdx]).trim()
      ? String(row[descIdx]).trim()
      : (title || `${subjectName} даалгавар`);
    const assignedDate = assignIdx !== -1 && row[assignIdx] !== undefined && String(row[assignIdx]).trim()
      ? String(row[assignIdx]).trim()
      : new Date().toISOString().substring(0, 10);
    const dueDate = dueIdx !== -1 && row[dueIdx] !== undefined && String(row[dueIdx]).trim()
      ? String(row[dueIdx]).trim()
      : assignedDate;

    const explicitHwId = hwIdIdx !== -1 && row[hwIdIdx] ? String(row[hwIdIdx]).trim() : (row[0] && String(row[0]).startsWith('hw_') ? String(row[0]).trim() : '');
    const subHash = Math.abs(
      (subjectName || title).split('').reduce((acc, char) => ((acc << 5) - acc) + char.charCodeAt(0), 0)
    ).toString(36);
    const dateClean = assignedDate.replace(/[^0-9]/g, '');
    const homeworkId = explicitHwId && !/^hw_.*_{5,}/.test(explicitHwId)
      ? explicitHwId
      : `hw_${classId}_${subHash}_${dateClean}`;

    if (!seenHw.has(homeworkId)) {
      seenHw.add(homeworkId);
      items.push({
        homeworkId,
        classId,
        subjectId: `sub_${subHash}`,
        subjectName: subjectName || 'Ерөнхий эрдэм',
        title: title || `${subjectName} даалгавар`,
        description,
        assignedDate,
        dueDate,
        createdBy: 'teacher',
        status: 'ACTIVE',
        createdAt: new Date().toISOString()
      });
    }
  }

  return items;
}

/**
 * Parses student homework completion/submission rows from Sheet 4 ('Homework')
 */
function parseSubmissionsFromHomeworkRows(rows: any[][], students: Student[]): Submission[] {
  if (!rows || rows.length <= 1) return [];

  const headerRow = rows[0].map((c: any) => String(c || '').trim().toLowerCase());
  const studentCodeIdx = headerRow.findIndex(h => h.includes('studentcode') || h.includes('сурагчийн код') || h === 'код');
  const studentIdIdx = headerRow.findIndex(h => h === 'studentid' || h === 'сурагч id');
  const statusIdx = headerRow.findIndex(h => h.includes('status') || h.includes('биелэлт') || h.includes('үнэлгээ') || h.includes('төлөв'));
  const hwIdIdx = headerRow.findIndex(h => h === 'homeworkid' || h === 'даалгавар id');
  const subIdIdx = headerRow.findIndex(h => h === 'submissionid' || h === 'гүйцэтгэл id');
  const checkedByIdx = headerRow.findIndex(h => h.includes('checkedby') || h.includes('шалгасан'));
  const updatedAtIdx = headerRow.findIndex(h => h.includes('updatedat') || h.includes('цаг'));
  const assignIdx = headerRow.findIndex(h => h.includes('assign') || h.includes('огноо') || h === 'date');
  const classIdx = headerRow.findIndex(h => h.includes('class') || h.includes('анги'));
  const subjectIdx = headerRow.findIndex(h => h.includes('subject') || h.includes('хичээл'));
  const titleIdx = headerRow.findIndex(h => h.includes('title') || h.includes('даалгавар'));

  if (studentCodeIdx === -1 && studentIdIdx === -1) return [];

  const submissions: Submission[] = [];
  const seenKey = new Set<string>();

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    const rawCode = studentCodeIdx !== -1 && row[studentCodeIdx] ? cleanSheetValue(row[studentCodeIdx]) : '';
    const rawStudentId = studentIdIdx !== -1 && row[studentIdIdx] ? cleanSheetValue(row[studentIdIdx]) : '';
    if (!rawCode && !rawStudentId) continue;

    const normCode = normalizeUsername(rawCode);
    const matchedStudent = students.find(
      s =>
        (rawStudentId && s.studentId === rawStudentId) ||
        (normCode && normalizeUsername(s.studentCode) === normCode)
    );
    const studentId = matchedStudent?.studentId || rawStudentId || (normCode ? `std_${normCode}` : '');
    if (!studentId) continue;

    const subjectName = subjectIdx !== -1 && row[subjectIdx] ? cleanSheetValue(row[subjectIdx]) : '';
    const title = titleIdx !== -1 && row[titleIdx] ? cleanSheetValue(row[titleIdx]) : '';
    const classId = classIdx !== -1 && row[classIdx] ? cleanSheetValue(row[classIdx]) : (matchedStudent?.classId || '10А');
    const assignedDate = assignIdx !== -1 && row[assignIdx] ? cleanSheetValue(row[assignIdx]) : new Date().toISOString().substring(0, 10);

    const subHash = Math.abs(
      (subjectName || title).split('').reduce((acc, char) => ((acc << 5) - acc) + char.charCodeAt(0), 0)
    ).toString(36);
    const dateClean = assignedDate.replace(/[^0-9]/g, '');

    const homeworkId = (hwIdIdx !== -1 && row[hwIdIdx] && cleanSheetValue(row[hwIdIdx]))
      ? cleanSheetValue(row[hwIdIdx])
      : `hw_${classId}_${subHash}_${dateClean}`;

    const rawStatus = statusIdx !== -1 && row[statusIdx] ? cleanSheetValue(row[statusIdx]).toUpperCase() : 'NOT_DONE';
    let status: Submission['status'] = 'NOT_DONE';
    if (rawStatus.includes('EXCELLENT') || rawStatus.includes('МАШ САЙН') || rawStatus === 'DONE') {
      status = 'EXCELLENT';
    } else if (rawStatus.includes('AVERAGE') || rawStatus.includes('ДУНД') || rawStatus.includes('IN_PROGRESS')) {
      status = 'AVERAGE';
    } else {
      status = 'NOT_DONE';
    }

    const key = `${homeworkId}_${studentId}`;
    if (seenKey.has(key)) continue;
    seenKey.add(key);

    submissions.push({
      submissionId: (subIdIdx !== -1 && row[subIdIdx] && cleanSheetValue(row[subIdIdx]))
        ? cleanSheetValue(row[subIdIdx])
        : `sub_${homeworkId}_${studentId}`,
      homeworkId,
      studentId,
      status,
      submittedAt: status !== 'NOT_DONE' ? (updatedAtIdx !== -1 && row[updatedAtIdx] ? cleanSheetValue(row[updatedAtIdx]) : new Date().toISOString()) : undefined,
      checkedBy: checkedByIdx !== -1 && row[checkedByIdx] ? cleanSheetValue(row[checkedByIdx]) : undefined,
      updatedAt: updatedAtIdx !== -1 && row[updatedAtIdx] ? cleanSheetValue(row[updatedAtIdx]) : new Date().toISOString()
    });
  }

  return submissions;
}

/**
 * Parses Sheet 5 ('Settings') rows
 */
function parseSettingsRows(rows: any[][]): Record<string, string> {
  const settings: Record<string, string> = {};
  if (!rows || rows.length === 0) return settings;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length < 2) continue;
    const key = cleanSheetValue(row[0]);
    const val = cleanSheetValue(row[1]);
    if (!key || key.toLowerCase() === 'settingkey' || key.toLowerCase() === 'түлхүүр') continue;
    settings[key] = val;
  }
  return settings;
}

/**
 * Populates the 4 sheets in exact order (no separate 'leaders' sheet):
 * 1. users (Багш, сурагчдын нэвтрэх нэр, нууц үг, role [teacher, leader1..5, хоосон=student], group [group1..5])
 * 2. Schedule (Хичээлийн хуваарь)
 * 3. Homework (Гэрийн даалгаврын биелэлт, илгээлтийн явц)
 * 4. Settings (Тохиргоо)
 */
export async function populateSampleDataToSheet(spreadsheetId: string, token: string) {
  await ensureSheetsExist(spreadsheetId, token);

  // 1-р Sheet: users (Багш болон бүх сурагчдын мэдээлэл, role, group, class баганатай)
  const userHeader = ['username', 'password', 'role', 'group', 'class', 'displayName', 'studentCode', 'active'];
  const teacherUsers = INITIAL_USERS.filter(u => u.role === 'TEACHER').map(u => [
    u.username,
    'admin',
    'teacher',
    '',
    u.classId || '10А',
    u.displayName,
    '',
    'TRUE'
  ]);
  const studentUsers = INITIAL_STUDENTS.map((s, idx) => {
    const grpNum = (idx % 5) + 1;
    const isLeader = idx < 5; // First student in each of the 5 groups is leader1..leader5
    return [
      s.studentCode.toLowerCase(),
      s.password || 'password123',
      isLeader ? `leader${grpNum}` : '',
      `group${grpNum}`,
      s.classId || '10А',
      s.fullName,
      s.studentCode,
      'TRUE'
    ];
  });
  const allUserRows = [...teacherUsers, ...studentUsers];
  await writeRange(spreadsheetId, 'users!A1:H', [userHeader, ...allUserRows], token);

  // 2-р Sheet: Schedule (Багшийн оруулсан хичээлийн хуваарь)
  const scheduleHeader = ['scheduleId', 'classId', 'weekday', 'period', 'subjectId', 'subjectName', 'teacherName', 'startTime', 'endTime', 'active', 'notes'];
  const scheduleRows = INITIAL_SCHEDULE.map(sch => [
    sch.scheduleId,
    sch.classId,
    sch.weekday,
    sch.period,
    sch.subjectId,
    sch.subjectName,
    sch.teacherName,
    sch.startTime,
    sch.endTime,
    String(sch.active),
    sch.notes || ''
  ]);
  await writeRange(spreadsheetId, 'Schedule!A1:K', [scheduleHeader, ...scheduleRows], token);

  // 3-р Sheet: Homework (Сурагчдын гэрийн даалгаврын биелэлт, илгээлтийн явц автоматаар sync хийгдэнэ)
  const homeworkHeader = [
    'assignedDate',
    'classId',
    'subjectName',
    'title',
    'studentCode',
    'studentName',
    'group',
    'leader',
    'status',
    'checkedBy',
    'updatedAt',
    'homeworkId',
    'studentId',
    'submissionId',
    'description',
    'dueDate'
  ];
  const studentMap = new Map(INITIAL_STUDENTS.map((s, idx) => [s.studentId, { ...s, grpNum: (idx % 5) + 1, isLeader: idx < 5 }]));
  const hwMap = new Map(INITIAL_HOMEWORK.map(h => [h.homeworkId, h]));

  const homeworkProgressRows: any[][] = [];
  INITIAL_SUBMISSIONS.forEach(sub => {
    const hw = hwMap.get(sub.homeworkId) || INITIAL_HOMEWORK[0];
    const st = studentMap.get(sub.studentId);
    if (!hw || !st) return;
    const statusLabel = sub.status === 'EXCELLENT' || sub.status === 'DONE'
      ? 'Маш сайн'
      : sub.status === 'AVERAGE' || sub.status === 'IN_PROGRESS'
      ? 'Дунд'
      : 'Хийгээгүй';

    homeworkProgressRows.push([
      hw.assignedDate,
      hw.classId,
      hw.subjectName,
      hw.title,
      st.studentCode,
      st.fullName,
      `group${st.grpNum}`,
      st.isLeader ? `leader${st.grpNum}` : '',
      statusLabel,
      sub.checkedBy || `leader${st.grpNum}`,
      sub.updatedAt || new Date().toISOString(),
      hw.homeworkId,
      st.studentId,
      sub.submissionId,
      hw.description,
      hw.dueDate
    ]);
  });
  await writeRange(spreadsheetId, 'Homework!A1:P', [homeworkHeader, ...homeworkProgressRows], token);

  // 4-р Sheet: Settings (Системийн тохиргоо)
  const settingsHeader = ['settingKey', 'settingValue', 'description', 'updatedAt'];
  const settingsRows = [
    ['schoolName', 'ЕБС-ийн 1-р сургууль', 'Сургуулийн нэр', new Date().toISOString()],
    ['termName', '2026 оны Хаврын улирал', 'Хичээлийн улирал', new Date().toISOString()],
    ['defaultClass', '10А', 'Үндсэн анги', new Date().toISOString()],
    ['maxGroups', '5', 'Дээд хэсгийн тоо (group1 - group5)', new Date().toISOString()],
    ['timezone', 'Asia/Ulaanbaatar', 'Цагийн бүс', new Date().toISOString()]
  ];
  await writeRange(spreadsheetId, 'Settings!A1:D', [settingsHeader, ...settingsRows], token);

  return {
    usersCount: allUserRows.length,
    studentsCount: studentUsers.length,
    scheduleCount: scheduleRows.length,
    homeworkCount: homeworkProgressRows.length
  };
}

/**
 * Verify and inspect data across the sheets in the Google Sheet
 */
export async function verifySpreadsheetData(spreadsheetId: string, token: string): Promise<SpreadsheetVerificationResult> {
  const meta = await getSpreadsheet(spreadsheetId, token);
  const title = meta.properties?.title || 'Тодорхойгүй нэр';
  const sheetNames = (meta.sheets || []).map((s: any) => s.properties?.title as string);

  const parsed = await readFilledDataFromSheet(spreadsheetId, token);

  const WEEKDAY_NAMES = ['', 'Даваа', 'Мягмар', 'Лхагва', 'Пүрэв', 'Баасан', 'Бямба', 'Ням'];

  const sampleUsers = parsed.users.map(u => ({
    name: u.displayName,
    role: u.role,
    username: u.username,
    classId: u.classId
  }));

  const sampleStudents = parsed.students.map(s => ({
    code: s.studentCode,
    name: `${s.fullName} (group${s.groupNumber || 1}${s.isLeader ? ` · leader${s.groupNumber || 1}` : ''})`,
    classId: s.classId
  }));

  const sampleSchedule = parsed.schedule.map(sch => ({
    day: WEEKDAY_NAMES[sch.weekday] || `Өдөр ${sch.weekday}`,
    period: sch.period,
    subject: sch.subjectName,
    teacher: sch.teacherName,
    classId: sch.classId
  }));

  return {
    success: true,
    spreadsheetTitle: title,
    sheetsFound: sheetNames,
    userCount: parsed.users.length,
    studentCount: parsed.students.length,
    scheduleCount: parsed.schedule.length,
    homeworkCount: parsed.homework.length,
    groupCount: parsed.groups?.length || 0,
    classes: parsed.classes || [],
    sampleUsers: sampleUsers.slice(0, 6),
    sampleStudents: sampleStudents.slice(0, 10),
    sampleSchedule: sampleSchedule.slice(0, 8),
    message: `Google Sheet-ээс: ${parsed.users.length} хэрэглэгч, ${parsed.students.length} сурагч, ${(parsed.classes || []).join(', ') || '10А'} анги, ${parsed.groups?.length || 0} бүлэг (users хүснэгтээс), ${parsed.schedule.length} хуваарь (Schedule), ${parsed.homework.length} даалгавар (Homework) амжилттай уншигдлаа.`
  };
}

/**
 * Automatically records & syncs student homework completion/submissions into 'Homework' sheet
 */
export async function syncSubmissionsToSheet(
  spreadsheetId: string,
  token: string,
  payload: {
    classId: string;
    subjectName: string;
    date: string;
    leaderName: string;
    submissions: Submission[];
    students: Student[];
    homeworkTitle?: string;
  }
): Promise<{ success: boolean; writtenCount: number }> {
  const meta = await getSpreadsheet(spreadsheetId, token);
  const existingSheets: string[] = (meta.sheets || []).map((s: any) => s.properties?.title as string);
  const homeworkSheetName = findSheetName(existingSheets, 'Homework');

  if (!existingSheets.some(s => s.toLowerCase() === homeworkSheetName.toLowerCase())) {
    await fetch(`${BASE_URL}/${spreadsheetId}:batchUpdate`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ requests: [{ addSheet: { properties: { title: 'Homework', index: 2 } } }] })
    }).catch(e => console.warn('Could not add Homework tab:', e));
  }

  let existingRows: any[][] = [];
  try {
    existingRows = await readRange(spreadsheetId, `${homeworkSheetName || 'Homework'}!A1:P2000`, token);
  } catch {
    existingRows = [];
  }

  const studentMap = new Map(payload.students.map(s => [s.studentId, s]));

  const header = [
    'assignedDate',
    'classId',
    'subjectName',
    'title',
    'studentCode',
    'studentName',
    'group',
    'leader',
    'status',
    'checkedBy',
    'updatedAt',
    'homeworkId',
    'studentId',
    'submissionId',
    'description',
    'dueDate'
  ];

  const dataRows: any[][] = [];
  const existingKeyIndex = new Map<string, number>();

  if (existingRows.length > 1) {
    const hdr = existingRows[0].map((c: any) => String(c || '').trim().toLowerCase());
    const hwIdCol = hdr.findIndex(h => h === 'homeworkid');
    const stIdCol = hdr.findIndex(h => h === 'studentid');
    const stCodeCol = hdr.findIndex(h => h === 'studentcode' || h.includes('код'));
    const dateCol = hdr.findIndex(h => h === 'assigneddate' || h.includes('огноо'));
    const subjCol = hdr.findIndex(h => h === 'subjectname' || h.includes('хичээл'));

    for (let i = 1; i < existingRows.length; i++) {
      const row = existingRows[i];
      if (!row || row.length === 0) continue;
      const rHwId = hwIdCol !== -1 ? String(row[hwIdCol] || '') : '';
      const rStId = stIdCol !== -1 ? String(row[stIdCol] || '') : '';
      const rCode = stCodeCol !== -1 ? normalizeUsername(String(row[stCodeCol] || '')) : '';
      const rDate = dateCol !== -1 ? String(row[dateCol] || '') : '';
      const rSubj = subjCol !== -1 ? String(row[subjCol] || '') : '';

      const idxInData = dataRows.length;
      if (rHwId && rStId) {
        existingKeyIndex.set(`${rHwId}_${rStId}`, idxInData);
      }
      if (rDate && rSubj && rCode) {
        existingKeyIndex.set(`${rDate}_${rSubj}_${rCode}`, idxInData);
      }
      dataRows.push([...row]);
    }
  }

  let updatedCount = 0;
  const nowStr = new Date().toLocaleString('mn-MN', { timeZone: 'Asia/Ulaanbaatar' });

  payload.submissions.forEach(sub => {
    const st = studentMap.get(sub.studentId);
    const grpNum = st?.groupNumber || 1;
    const statusLabel = sub.status === 'EXCELLENT' || sub.status === 'DONE'
      ? 'Маш сайн'
      : sub.status === 'AVERAGE' || sub.status === 'IN_PROGRESS'
      ? 'Дунд'
      : 'Хийгээгүй';

    const rowData = [
      payload.date,
      payload.classId,
      payload.subjectName,
      payload.homeworkTitle || `${payload.subjectName} (${payload.date})`,
      st?.studentCode || '',
      st?.fullName || '',
      `group${grpNum}`,
      st?.isLeader ? `leader${grpNum}` : '',
      statusLabel,
      payload.leaderName || sub.checkedBy || `leader${grpNum}`,
      nowStr,
      sub.homeworkId,
      sub.studentId,
      sub.submissionId,
      payload.homeworkTitle || `${payload.subjectName} хичээлийн даалгавар`,
      payload.date
    ];

    const key1 = `${sub.homeworkId}_${sub.studentId}`;
    const key2 = st ? `${payload.date}_${payload.subjectName}_${normalizeUsername(st.studentCode)}` : '';

    if (existingKeyIndex.has(key1)) {
      dataRows[existingKeyIndex.get(key1)!] = rowData;
    } else if (key2 && existingKeyIndex.has(key2)) {
      dataRows[existingKeyIndex.get(key2)!] = rowData;
    } else {
      const newIdx = dataRows.length;
      dataRows.push(rowData);
      existingKeyIndex.set(key1, newIdx);
    }
    updatedCount++;
  });

  await writeRange(spreadsheetId, `${homeworkSheetName || 'Homework'}!A1:P`, [header, ...dataRows], token);
  return { success: true, writtenCount: updatedCount };
}

/**
 * Reads Submissions and evaluation records from 'Homework' sheet
 */
export async function readSubmissionsFromSheet(
  spreadsheetId: string,
  token: string,
  students: Student[] = INITIAL_STUDENTS
): Promise<Submission[]> {
  const meta = await getSpreadsheet(spreadsheetId, token);
  const existingSheets: string[] = (meta.sheets || []).map((s: any) => s.properties?.title as string);
  const homeworkSheetName = findSheetName(existingSheets, 'Homework');

  let rows: any[][] = [];
  try {
    rows = await readRange(spreadsheetId, `${homeworkSheetName || 'Homework'}!A1:P2000`, token);
  } catch {
    return [];
  }

  return parseSubmissionsFromHomeworkRows(rows, students);
}

/**
 * Pushes entire active schedule to 'Schedule' sheet
 */
export async function syncScheduleToSheet(
  spreadsheetId: string,
  token: string,
  schedule: ScheduleItem[]
): Promise<{ success: boolean; count: number }> {
  const meta = await getSpreadsheet(spreadsheetId, token);
  const existingSheets: string[] = (meta.sheets || []).map((s: any) => s.properties?.title as string);
  const scheduleSheetName = findSheetName(existingSheets, 'Schedule');

  if (!existingSheets.some(s => s.toLowerCase() === 'schedule')) {
    await fetch(`${BASE_URL}/${spreadsheetId}:batchUpdate`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ requests: [{ addSheet: { properties: { title: 'Schedule', index: 1 } } }] })
    }).catch(() => {});
  }

  const header = ['scheduleId', 'classId', 'weekday', 'period', 'subjectId', 'subjectName', 'teacherName', 'startTime', 'endTime', 'active', 'notes'];
  const rows = schedule.map(sch => [
    sch.scheduleId,
    sch.classId,
    sch.weekday,
    sch.period,
    sch.subjectId,
    sch.subjectName,
    sch.teacherName || '',
    sch.startTime || '',
    sch.endTime || '',
    String(sch.active),
    sch.notes || ''
  ]);

  await writeRange(spreadsheetId, `${scheduleSheetName || 'Schedule'}!A1:K`, [header, ...rows], token);
  return { success: true, count: schedule.length };
}

/**
 * Syncs homework assignments into 'Homework' sheet while preserving student submission progress rows
 */
export async function syncHomeworkToSheet(
  spreadsheetId: string,
  token: string,
  homeworkList: Homework[],
  submissions: Submission[] = [],
  students: Student[] = INITIAL_STUDENTS
): Promise<{ success: boolean; count: number }> {
  const meta = await getSpreadsheet(spreadsheetId, token);
  const existingSheets: string[] = (meta.sheets || []).map((s: any) => s.properties?.title as string);
  const homeworkSheetName = findSheetName(existingSheets, 'Homework');

  if (!existingSheets.some(s => s.toLowerCase() === 'homework')) {
    await fetch(`${BASE_URL}/${spreadsheetId}:batchUpdate`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ requests: [{ addSheet: { properties: { title: 'Homework', index: 2 } } }] })
    }).catch(() => {});
  }

  let existingRows: any[][] = [];
  try {
    existingRows = await readRange(spreadsheetId, `${homeworkSheetName || 'Homework'}!A1:P2000`, token);
  } catch {
    existingRows = [];
  }

  const header = [
    'assignedDate',
    'classId',
    'subjectName',
    'title',
    'studentCode',
    'studentName',
    'group',
    'leader',
    'status',
    'checkedBy',
    'updatedAt',
    'homeworkId',
    'studentId',
    'submissionId',
    'description',
    'dueDate'
  ];

  const dataRows: any[][] = existingRows.length > 1 ? existingRows.slice(1) : [];
  const existingHwIds = new Set<string>();
  dataRows.forEach(r => {
    if (r[11]) existingHwIds.add(String(r[11]));
  });

  const studentMap = new Map(students.map(s => [s.studentId, s]));

  // Upsert homework assignments and all student homework completion/submission rows into 'Homework' sheet
  homeworkList.forEach(hw => {
    const hwSubs = submissions.filter(s => s.homeworkId === hw.homeworkId);
    if (hwSubs.length > 0) {
      hwSubs.forEach(sub => {
        const st = studentMap.get(sub.studentId);
        const grpNum = st?.groupNumber || 1;
        const statusLabel = sub.status === 'EXCELLENT' || sub.status === 'DONE'
          ? 'Маш сайн'
          : sub.status === 'AVERAGE' || sub.status === 'IN_PROGRESS'
          ? 'Дунд'
          : sub.status === 'SUBMITTED_FOR_REVIEW'
          ? 'Шалгуулахаар илгээсэн'
          : 'Хийгээгүй';

        const rowValues = [
          hw.assignedDate,
          hw.classId,
          hw.subjectName,
          hw.title,
          st?.studentCode || '',
          st?.fullName || '',
          `group${grpNum}`,
          st?.isLeader ? `leader${grpNum}` : '',
          statusLabel,
          sub.checkedBy || `leader${grpNum}`,
          sub.updatedAt || hw.createdAt,
          hw.homeworkId,
          sub.studentId,
          sub.submissionId,
          hw.description,
          hw.dueDate
        ];

        const existingIdx = dataRows.findIndex(r => r[11] === hw.homeworkId && r[12] === sub.studentId);
        if (existingIdx >= 0) {
          dataRows[existingIdx] = rowValues;
        } else {
          dataRows.push(rowValues);
        }
      });
    } else if (!existingHwIds.has(hw.homeworkId)) {
      dataRows.push([
        hw.assignedDate,
        hw.classId,
        hw.subjectName,
        hw.title,
        '',
        '',
        '',
        '',
        'Хүлээгдэж буй',
        '',
        hw.createdAt,
        hw.homeworkId,
        '',
        '',
        hw.description,
        hw.dueDate
      ]);
    }
  });

  await writeRange(spreadsheetId, `${homeworkSheetName || 'Homework'}!A1:P`, [header, ...dataRows], token);
  return { success: true, count: homeworkList.length };
}

/**
 * Pushes all user accounts, student group divisions (group1..group5), and role assignments (teacher, leader1..5, empty=student)
 * to Sheet 1 ('users') and removes any legacy 'leaders' sheet if present.
 */
export async function syncGroupsToSheet(
  spreadsheetId: string,
  token: string,
  groups: ClassGroup[],
  students: Student[],
  users: User[] = INITIAL_USERS
): Promise<{ success: boolean; count: number; studentCount: number }> {
  await ensureSheetsExist(spreadsheetId, token);
  const res = await syncUsersToSheet(spreadsheetId, token, users, students);
  return { success: res.success, count: groups.length, studentCount: students.filter(s => s.active).length };
}

/**
 * Ensures Sheet 1 ('users') exists on the Google Sheet with unified role (teacher, leader1..5, empty=student) and group (group1..5) columns
 */
export async function ensureGroupsSheet(
  spreadsheetId: string,
  token: string,
  students: Student[] = []
): Promise<{ success: boolean; sheetName: string; isNew: boolean }> {
  await ensureSheetsExist(spreadsheetId, token);
  const meta = await getSpreadsheet(spreadsheetId, token);
  const existingSheets: string[] = (meta.sheets || []).map((s: any) => s.properties?.title as string);
  const usersSheetName = findSheetName(existingSheets, 'users');

  const targetSheet = usersSheetName || 'users';
  let existingValues: any[][] = [];
  try {
    existingValues = await readRange(spreadsheetId, `${targetSheet}!A1:H1`, token);
  } catch {
    // ignore
  }

  let isNew = false;
  if (!existingValues || existingValues.length === 0 || !existingValues[0] || existingValues[0].length === 0) {
    isNew = true;
    await syncUsersToSheet(spreadsheetId, token, INITIAL_USERS, students);
  }

  return { success: true, sheetName: targetSheet, isNew };
}

/**
 * Pulls and parses users, students, roles (teacher, leader1..5, empty=student), groups (group1..5), and classes (from 'class' column) from Sheet 1 ('users')
 */
export async function pullGroupsFromSheet(
  spreadsheetId: string,
  token: string,
  _students: Student[]
): Promise<{ groups: ClassGroup[]; updatedStudents: Student[]; leaders: Leader[]; users?: User[]; classes?: string[] }> {
  const meta = await getSpreadsheet(spreadsheetId, token);
  const existingSheets: string[] = (meta.sheets || []).map((s: any) => s.properties?.title as string);
  const usersSheetName = findSheetName(existingSheets, 'users');

  const rawUsers = await readRange(spreadsheetId, `${usersSheetName}!A1:Z1000`, token);
  const bundle = parseUnifiedUsersSheet(rawUsers);
  return {
    groups: bundle.groups,
    updatedStudents: bundle.students,
    leaders: bundle.leaders,
    users: bundle.users,
    classes: bundle.classes
  };
}

/**
 * Pushes teacher and student credentials, roles (teacher, leader1..5, empty=student), groups (group1..5), and class to Sheet 1 ('users')
 */
export async function syncUsersToSheet(
  spreadsheetId: string,
  token: string,
  users: User[],
  students: Student[]
): Promise<{ success: boolean; count: number }> {
  const meta = await getSpreadsheet(spreadsheetId, token);
  const existingSheets: string[] = (meta.sheets || []).map((s: any) => s.properties?.title as string);
  const usersSheetName = findSheetName(existingSheets, 'users');

  if (!existingSheets.some(s => s.toLowerCase() === usersSheetName.toLowerCase())) {
    await fetch(`${BASE_URL}/${spreadsheetId}:batchUpdate`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ requests: [{ addSheet: { properties: { title: 'users', index: 0 } } }] })
    }).catch(() => {});
  }

  const header = ['username', 'password', 'role', 'group', 'class', 'displayName', 'studentCode', 'active'];
  const studentMap = new Map(students.map(s => [s.studentId, s]));
  const studentByCode = new Map(students.map(s => [normalizeUsername(s.studentCode), s]));
  const writtenStudentIds = new Set<string>();

  const rows: any[][] = [];

  // 1. Write Teacher accounts first
  users.filter(u => u.role === 'TEACHER').forEach(u => {
    const isHash = /^[a-f0-9]{64}$/i.test(u.passwordHash || '');
    const readablePass = !isHash && u.passwordHash ? u.passwordHash : 'admin';
    rows.push([
      u.username,
      readablePass,
      'teacher',
      '',
      u.classId || '',
      u.displayName,
      '',
      u.active ? 'TRUE' : 'FALSE'
    ]);
  });

  // 2. Write Student & Leader accounts with role (leader1..5 or empty for student), group (group1..5), and class
  students.forEach(st => {
    writtenStudentIds.add(st.studentId);
    const linkedUser = users.find(
      u => u.studentId === st.studentId || normalizeUsername(u.username) === normalizeUsername(st.studentCode)
    );
    const grpNum = Math.max(1, Math.min(5, st.groupNumber || 1));
    const isLeader = Boolean(st.isLeader || linkedUser?.role === 'LEADER');
    const isHash = /^[a-f0-9]{64}$/i.test(linkedUser?.passwordHash || '');
    const readablePass = st.password || (!isHash && linkedUser?.passwordHash ? linkedUser.passwordHash : 'password123');
    const cleanName = st.fullName.replace(/\s*\(leader\s*\d+\)\s*$/i, '').trim();

    rows.push([
      linkedUser?.username || st.studentCode.toLowerCase(),
      readablePass,
      isLeader ? `leader${grpNum}` : '',
      `group${grpNum}`,
      st.classId || linkedUser?.classId || '10А',
      cleanName,
      st.studentCode,
      st.active ? 'TRUE' : 'FALSE'
    ]);
  });

  // 3. Any remaining non-teacher users not in students array
  users.filter(u => u.role !== 'TEACHER').forEach(u => {
    const st = (u.studentId ? studentMap.get(u.studentId) : undefined) || studentByCode.get(normalizeUsername(u.username));
    if (st && writtenStudentIds.has(st.studentId)) return;

    const grpMatch = u.displayName.match(/(\d+)/);
    const grpNum = grpMatch ? Math.max(1, Math.min(5, parseInt(grpMatch[1], 10))) : 1;
    const isLeader = u.role === 'LEADER';
    const isHash = /^[a-f0-9]{64}$/i.test(u.passwordHash || '');
    const readablePass = !isHash && u.passwordHash ? u.passwordHash : 'password123';

    rows.push([
      u.username,
      readablePass,
      isLeader ? `leader${grpNum}` : '',
      `group${grpNum}`,
      u.classId || '10А',
      u.displayName.replace(/\s*\(leader\s*\d+\)\s*$/i, '').trim(),
      u.studentId || u.username.toUpperCase(),
      u.active ? 'TRUE' : 'FALSE'
    ]);
  });

  await writeRange(spreadsheetId, `${usersSheetName || 'users'}!A1:H`, [header, ...rows], token);
  return { success: true, count: rows.length };
}

/**
 * Pushes system settings to 'Settings' sheet
 */
export async function syncSettingsToSheet(
  spreadsheetId: string,
  token: string,
  settingsEntries: Record<string, string>
): Promise<{ success: boolean; count: number }> {
  const meta = await getSpreadsheet(spreadsheetId, token);
  const existingSheets: string[] = (meta.sheets || []).map((s: any) => s.properties?.title as string);
  const settingsSheetName = findSheetName(existingSheets, 'Settings');

  if (!existingSheets.some(s => s.toLowerCase() === settingsSheetName.toLowerCase())) {
    await fetch(`${BASE_URL}/${spreadsheetId}:batchUpdate`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ requests: [{ addSheet: { properties: { title: 'Settings', index: 3 } } }] })
    }).catch(() => {});
  }

  const header = ['settingKey', 'settingValue', 'description', 'updatedAt'];
  const nowIso = new Date().toISOString();
  const rows = Object.entries(settingsEntries).map(([k, v]) => [k, v, '', nowIso]);

  await writeRange(spreadsheetId, `${settingsSheetName || 'Settings'}!A1:D`, [header, ...rows], token);
  return { success: true, count: rows.length };
}




