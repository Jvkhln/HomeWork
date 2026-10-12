import {
  User,
  Student,
  ScheduleItem,
  UserRole,
  Submission,
  Homework
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
  sampleUsers: { name: string; role: string; username: string }[];
  sampleStudents: { code: string; name: string; classId: string }[];
  sampleSchedule: { day: string; period: number; subject: string; teacher: string; classId: string }[];
  message: string;
}

export interface ParsedSheetData {
  users: User[];
  students: Student[];
  schedule: ScheduleItem[];
  homework: Homework[];
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
 * Creates missing sheets/tabs in the spreadsheet if they don't exist
 */
export async function ensureSheetsExist(spreadsheetId: string, token: string) {
  const meta = await getSpreadsheet(spreadsheetId, token);
  const existingSheets = (meta.sheets || []).map((s: any) => s.properties?.title as string);

  const requiredSheets = [
    'Users',
    'Students',
    'Schedule',
    'Homework',
    'Submissions',
    'Leaders',
    'Settings',
    'AuditLog'
  ];

  const requests: any[] = [];
  for (const sheetName of requiredSheets) {
    const found = existingSheets.some(
      (s: string) => s.toLowerCase() === sheetName.toLowerCase()
    );
    if (!found) {
      requests.push({
        addSheet: {
          properties: {
            title: sheetName
          }
        }
      });
    }
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
      throw new Error(err.error?.message || 'Хүснэгтийн таб нэмэхэд алдаа гарлаа.');
    }
  }

  return requiredSheets;
}

/**
 * Write values to a specific range (e.g. Users!A1)
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
 * Helper to find tab name case-insensitively
 */
function findSheetName(existingSheets: string[], targetName: string): string {
  const targetLower = targetName.toLowerCase();
  const found = existingSheets.find(s => {
    const sLower = s.toLowerCase();
    if (sLower === targetLower) return true;
    if (targetLower === 'users' && (sLower.includes('user') || sLower.includes('хэрэглэгч'))) return true;
    if (targetLower === 'students' && (sLower.includes('student') || sLower.includes('сурагч'))) return true;
    if (targetLower === 'schedule' && (sLower.includes('sched') || sLower.includes('хуваарь') || sLower.includes('цагийн'))) return true;
    return false;
  });
  return found || targetName;
}

/**
 * Reads only the filled rows of Users, Students, Schedule from Google Sheet!
 * Filters out empty rows and parses columns intelligently.
 */
export async function readFilledDataFromSheet(spreadsheetId: string, token: string): Promise<ParsedSheetData> {
  const meta = await getSpreadsheet(spreadsheetId, token);
  const existingSheets: string[] = (meta.sheets || []).map((s: any) => s.properties?.title as string);

  const usersSheetName = findSheetName(existingSheets, 'Users');
  const studentsSheetName = findSheetName(existingSheets, 'Students');
  const scheduleSheetName = findSheetName(existingSheets, 'Schedule');
  const homeworkSheetName = findSheetName(existingSheets, 'Homework');

  // 1. Read Users (up to 1000 rows to capture all latest lines)
  let rawUsers: any[][] = [];
  try {
    rawUsers = await readRange(spreadsheetId, `${usersSheetName}!A1:Z1000`, token);
  } catch (e) {
    console.warn('Could not read Users sheet:', e);
  }

  // 2. Read Students (up to 1000 rows)
  let rawStudents: any[][] = [];
  try {
    rawStudents = await readRange(spreadsheetId, `${studentsSheetName}!A1:Z1000`, token);
  } catch (e) {
    console.warn('Could not read Students sheet:', e);
  }

  // 3. Read Schedule (up to 1000 rows)
  let rawSchedule: any[][] = [];
  try {
    rawSchedule = await readRange(spreadsheetId, `${scheduleSheetName}!A1:Z1000`, token);
  } catch (e) {
    console.warn('Could not read Schedule sheet:', e);
  }

  // 4. Read Homework (up to 1000 rows)
  let rawHomework: any[][] = [];
  try {
    rawHomework = await readRange(spreadsheetId, `${homeworkSheetName}!A1:Z1000`, token);
  } catch (e) {
    console.warn('Could not read Homework sheet:', e);
  }

  // Parse Users
  const parsedUsers = parseUsersRows(rawUsers);
  // Parse Students
  const parsedStudents = parseStudentsRows(rawStudents);
  // Parse Schedule
  const parsedSchedule = parseScheduleRows(rawSchedule);
  // Parse Homework
  const parsedHomework = parseHomeworkRows(rawHomework);

  return {
    users: parsedUsers,
    students: parsedStudents,
    schedule: parsedSchedule,
    homework: parsedHomework
  };
}

/**
 * Parses only filled Users rows
 */
function parseUsersRows(rows: any[][]): User[] {
  if (!rows || rows.length === 0) return [];

  // Determine headers if row 0 has strings like 'username', 'role', etc.
  let headerRow = rows[0].map((c: any) => String(c || '').trim().toLowerCase());
  let startIndex = 1;

  let usernameIdx = headerRow.findIndex(h =>
    h === 'username' ||
    h.includes('нэвтрэх') ||
    h.includes('хэрэглэгч') ||
    h === 'user' ||
    h === 'логин'
  );
  if (usernameIdx === -1) {
    usernameIdx = headerRow.findIndex(h => h.includes('username') || h.includes('код'));
  }

  let passwordIdx = headerRow.findIndex(h =>
    h.includes('password') ||
    h.includes('нууц') ||
    h.includes('pass')
  );

  let roleIdx = headerRow.findIndex(h =>
    h.includes('role') ||
    h.includes('үүрэг') ||
    h.includes('эрх')
  );

  let nameIdx = headerRow.findIndex(h =>
    h.includes('displayname') ||
    h.includes('овог') ||
    h.includes('бүтэн') ||
    (h.includes('нэр') && !h.includes('нэвтрэх')) ||
    h === 'name'
  );

  let studentIdIdx = headerRow.findIndex(h =>
    h.includes('studentid') ||
    h.includes('сурагчийн код') ||
    (h.includes('сурагч') && !h.includes('нэр'))
  );

  let activeIdx = headerRow.findIndex(h =>
    h.includes('active') ||
    h.includes('идэвх') ||
    h.includes('төлөв')
  );

  // Fallbacks if header wasn't detected cleanly
  if (usernameIdx === -1) {
    // If first row was actually data, set startIndex = 0
    if (!rows[0][0]?.toString().toLowerCase().includes('user')) {
      startIndex = 0;
    }
    usernameIdx = 1;
    passwordIdx = 2;
    roleIdx = 3;
    studentIdIdx = 4;
    activeIdx = 5;
    nameIdx = 6;
  }

  const users: User[] = [];

  for (let i = startIndex; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    const username = String(row[usernameIdx] !== undefined ? row[usernameIdx] : '').trim();
    // Skip empty row! ("зөвхөн мэдээллүүдийг бөглөсөн хэсгээс систем уншина")
    if (!username) continue;

    const rawPass = row[passwordIdx] !== undefined ? String(row[passwordIdx]).trim() : '';
    const rawRole = row[roleIdx] !== undefined ? String(row[roleIdx]).trim().toUpperCase() : 'STUDENT';
    const rawName = row[nameIdx] !== undefined ? String(row[nameIdx]).trim() : '';
    const studentId = row[studentIdIdx] !== undefined ? String(row[studentIdIdx]).trim() : '';
    const rawActive = row[activeIdx] !== undefined ? String(row[activeIdx]).trim().toLowerCase() : 'true';

    let role: UserRole = 'STUDENT';
    if (rawRole.includes('TEACH') || rawRole.includes('БАГШ') || rawRole.includes('ADMIN')) {
      role = 'TEACHER';
    } else if (rawRole.includes('LEAD') || rawRole.includes('АХЛАГЧ')) {
      role = 'LEADER';
    }

    users.push({
      userId: row[0] ? String(row[0]).trim() : `u_${username.replace(/[^a-zA-Z0-9]/g, '_')}`,
      username: username,
      passwordHash: rawPass || 'password123',
      role,
      studentId: studentId || undefined,
      active: rawActive !== 'false' && rawActive !== '0',
      displayName: rawName || username,
      createdAt: new Date().toISOString()
    });
  }

  return users;
}

/**
 * Parses only filled Students rows
 */
function parseStudentsRows(rows: any[][]): Student[] {
  if (!rows || rows.length === 0) return [];

  let headerRow = rows[0].map((c: any) => String(c || '').trim().toLowerCase());
  let startIndex = 1;

  let codeIdx = headerRow.findIndex(h => h.includes('studentcode') || h.includes('код'));
  let nameIdx = headerRow.findIndex(h => h.includes('fullname') || h.includes('овог') || h.includes('нэр'));
  let classIdx = headerRow.findIndex(h => h.includes('class') || h.includes('анги'));
  let publicNameIdx = headerRow.findIndex(h => h.includes('public') || h.includes('товч') || h.includes('самбар'));

  if (codeIdx === -1 || nameIdx === -1) {
    if (!rows[0][0]?.toString().toLowerCase().includes('student')) {
      startIndex = 0;
    }
    codeIdx = 1;
    nameIdx = 2;
    classIdx = 3;
    publicNameIdx = 5;
  }

  const students: Student[] = [];

  for (let i = startIndex; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    const studentCode = row[codeIdx] !== undefined ? String(row[codeIdx]).trim() : '';
    const fullName = row[nameIdx] !== undefined ? String(row[nameIdx]).trim() : '';

    // Skip empty row! ("зөвхөн мэдээллүүдийг бөглөсөн хэсгээс систем уншина")
    if (!studentCode && !fullName) continue;

    const classId = row[classIdx] !== undefined && String(row[classIdx]).trim() ? String(row[classIdx]).trim() : '10А';
    const publicDisplayName = row[publicNameIdx] !== undefined && String(row[publicNameIdx]).trim()
      ? String(row[publicNameIdx]).trim()
      : fullName.split(' ')[0] || studentCode;

    students.push({
      studentId: row[0] ? String(row[0]).trim() : `std_${i}`,
      studentCode: studentCode || `STD-${i}`,
      fullName: fullName || studentCode,
      classId,
      active: true,
      publicDisplayName,
      showOnLeaderboard: true
    });
  }

  return students;
}

/**
 * Parses only filled Schedule rows
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
    // Skip empty row! ("зөвхөн мэдээллүүдийг бөглөсөн хэсгээс систем уншина")
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

    // Extract period numbers safely (e.g. "1-р цаг" or "1")
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
 * Parses only filled Homework rows
 */
function parseHomeworkRows(rows: any[][]): Homework[] {
  if (!rows || rows.length === 0) return [];

  let headerRow = rows[0].map((c: any) => String(c || '').trim().toLowerCase());
  let startIndex = 1;

  let titleIdx = headerRow.findIndex(h => h.includes('title') || h.includes('нэр') || h.includes('гарчиг') || h.includes('даалгавар'));
  let subjectIdx = headerRow.findIndex(h => h.includes('subject') || h.includes('хичээл'));
  let classIdx = headerRow.findIndex(h => h.includes('class') || h.includes('анги'));
  let descIdx = headerRow.findIndex(h => h.includes('desc') || h.includes('тайлбар') || h.includes('агуулга'));
  let assignIdx = headerRow.findIndex(h => h.includes('assign') || h.includes('өгсөн') || h.includes('эхлэх'));
  let dueIdx = headerRow.findIndex(h => h.includes('due') || h.includes('дуусах') || h.includes('хугацаа'));

  if (titleIdx === -1 && subjectIdx === -1) {
    if (!rows[0][0]?.toString().toLowerCase().includes('homework')) {
      startIndex = 0;
    }
    classIdx = 1;
    subjectIdx = 3;
    titleIdx = 4;
    descIdx = 5;
    assignIdx = 6;
    dueIdx = 7;
  }

  const items: Homework[] = [];
  const seenHw = new Set<string>();

  for (let i = startIndex; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    const title = row[titleIdx] !== undefined ? String(row[titleIdx]).trim() : '';
    const subjectName = row[subjectIdx] !== undefined ? String(row[subjectIdx]).trim() : '';

    if (!title && !subjectName) continue;

    const classId = row[classIdx] !== undefined && String(row[classIdx]).trim()
      ? String(row[classIdx]).trim()
      : '10А';
    const description = row[descIdx] !== undefined && String(row[descIdx]).trim()
      ? String(row[descIdx]).trim()
      : (title || `${subjectName} даалгавар`);
    const assignedDate = row[assignIdx] !== undefined && String(row[assignIdx]).trim()
      ? String(row[assignIdx]).trim()
      : new Date().toISOString().substring(0, 10);
    const dueDate = row[dueIdx] !== undefined && String(row[dueIdx]).trim()
      ? String(row[dueIdx]).trim()
      : assignedDate;

    const rawId = row[0] ? String(row[0]).trim() : '';
    // Build unique ID avoiding key collisions
    const subHash = Math.abs(
      (subjectName || title).split('').reduce((acc, char) => ((acc << 5) - acc) + char.charCodeAt(0), 0)
    ).toString(36);
    const dateClean = assignedDate.replace(/-/g, '');
    const homeworkId = rawId && !seenHw.has(rawId) && !/^hw_.*_{5,}/.test(rawId)
      ? rawId
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
 * Populates sample Teachers, Students, Schedule, Homework into the Google Sheet
 */
export async function populateSampleDataToSheet(spreadsheetId: string, token: string) {
  await ensureSheetsExist(spreadsheetId, token);

  const userHeader = ['userId', 'username', 'passwordHash', 'role', 'studentId', 'active', 'displayName', 'createdAt'];
  const userRows = INITIAL_USERS.map(u => [
    u.userId,
    u.username,
    u.passwordHash || 'password123',
    u.role,
    u.studentId || '',
    String(u.active),
    u.displayName,
    u.createdAt
  ]);
  await writeRange(spreadsheetId, 'Users!A1:H', [userHeader, ...userRows], token);

  const studentHeader = ['studentId', 'studentCode', 'fullName', 'classId', 'active', 'publicDisplayName', 'showOnLeaderboard'];
  const studentRows = INITIAL_STUDENTS.map(s => [
    s.studentId,
    s.studentCode,
    s.fullName,
    s.classId,
    String(s.active),
    s.publicDisplayName,
    String(s.showOnLeaderboard)
  ]);
  await writeRange(spreadsheetId, 'Students!A1:G', [studentHeader, ...studentRows], token);

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

  const homeworkHeader = ['homeworkId', 'classId', 'subjectId', 'subjectName', 'title', 'description', 'assignedDate', 'dueDate', 'createdBy', 'status', 'createdAt'];
  const homeworkRows = INITIAL_HOMEWORK.map(hw => [
    hw.homeworkId,
    hw.classId,
    hw.subjectId,
    hw.subjectName,
    hw.title,
    hw.description,
    hw.assignedDate,
    hw.dueDate,
    hw.createdBy,
    hw.status,
    hw.createdAt
  ]);
  await writeRange(spreadsheetId, 'Homework!A1:K', [homeworkHeader, ...homeworkRows], token);

  const submissionHeader = ['submissionId', 'homeworkId', 'studentId', 'status', 'submittedAt', 'checkedBy', 'checkedAt', 'teacherComment', 'studentNote', 'updatedAt'];
  const submissionRows = INITIAL_SUBMISSIONS.map(sub => [
    sub.submissionId,
    sub.homeworkId,
    sub.studentId,
    sub.status,
    sub.submittedAt || '',
    sub.checkedBy || '',
    sub.checkedAt || '',
    sub.teacherComment || '',
    sub.studentNote || '',
    sub.updatedAt
  ]);
  await writeRange(spreadsheetId, 'Submissions!A1:J', [submissionHeader, ...submissionRows], token);

  const leaderHeader = ['leaderId', 'userId', 'classId', 'assignedBy', 'active', 'createdAt'];
  const leaderRows = INITIAL_LEADERS.map(l => [
    l.leaderId,
    l.userId,
    l.classId,
    l.assignedBy,
    String(l.active),
    l.createdAt
  ]);
  await writeRange(spreadsheetId, 'Leaders!A1:F', [leaderHeader, ...leaderRows], token);

  const settingsHeader = ['settingKey', 'settingValue', 'updatedAt'];
  const settingsRows = [
    ['schoolName', 'ЕБС-ийн 1-р сургууль', new Date().toISOString()],
    ['termName', '2026 оны Хаврын улирал', new Date().toISOString()],
    ['timezone', 'Asia/Ulaanbaatar', new Date().toISOString()]
  ];
  await writeRange(spreadsheetId, 'Settings!A1:C', [settingsHeader, ...settingsRows], token);

  const auditHeader = ['logId', 'userId', 'userName', 'action', 'targetType', 'targetId', 'timestamp', 'details'];
  const auditRows = INITIAL_AUDIT_LOGS.map(log => [
    log.logId,
    log.userId,
    log.userName,
    log.action,
    log.targetType,
    log.targetId,
    log.timestamp,
    log.details
  ]);
  await writeRange(spreadsheetId, 'AuditLog!A1:H', [auditHeader, ...auditRows], token);

  return {
    usersCount: userRows.length,
    studentsCount: studentRows.length,
    scheduleCount: scheduleRows.length,
    homeworkCount: homeworkRows.length
  };
}

/**
 * Verify and inspect data in the Google Sheet, filtering out empty rows
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
    username: u.username
  }));

  const sampleStudents = parsed.students.map(s => ({
    code: s.studentCode,
    name: s.fullName,
    classId: s.classId
  }));

  const sampleSchedule = parsed.schedule.map(sch => ({
    day: WEEKDAY_NAMES[sch.weekday] || `Өдөр ${sch.weekday}`,
    period: sch.period,
    subject: sch.subjectName,
    teacher: sch.teacherName,
    classId: sch.classId
  }));

  let hwRows: any[][] = [];
  try {
    const hwSheetName = findSheetName(sheetNames, 'Homework');
    hwRows = await readRange(spreadsheetId, `${hwSheetName}!A2:K30`, token);
  } catch {
    //
  }

  return {
    success: true,
    spreadsheetTitle: title,
    sheetsFound: sheetNames,
    userCount: parsed.users.length,
    studentCount: parsed.students.length,
    scheduleCount: parsed.schedule.length,
    homeworkCount: hwRows.filter(r => r && r[4]).length,
    sampleUsers: sampleUsers.slice(0, 6),
    sampleStudents: sampleStudents.slice(0, 10),
    sampleSchedule: sampleSchedule.slice(0, 8),
    message: `Хүснэгтийн зөвхөн бөглөсөн хэсгээс: ${parsed.users.length} хэрэглэгч, ${parsed.students.length} сурагч, ${parsed.schedule.length} хичээлийн хуваарь амжилттай уншигдлаа.`
  };
}

/**
 * Appends or updates evaluation submissions in Google Sheet 'Submissions' tab.
 * Also logs in 'EvaluationLogs' tab for clear audit view in Google Sheets.
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
  }
): Promise<{ success: boolean; writtenCount: number }> {
  const meta = await getSpreadsheet(spreadsheetId, token);
  const existingSheets: string[] = (meta.sheets || []).map((s: any) => s.properties?.title as string);

  // 1. Ensure 'Submissions' and 'Evaluations' tab exist
  const submissionsSheetName = findSheetName(existingSheets, 'Submissions');
  const evaluationsSheetName = findSheetName(existingSheets, 'Evaluations');

  const requests: any[] = [];
  if (!existingSheets.some(s => s.toLowerCase() === 'submissions')) {
    requests.push({ addSheet: { properties: { title: 'Submissions' } } });
  }
  if (!existingSheets.some(s => s.toLowerCase() === 'evaluations')) {
    requests.push({ addSheet: { properties: { title: 'Evaluations' } } });
  }

  if (requests.length > 0) {
    await fetch(`${BASE_URL}/${spreadsheetId}:batchUpdate`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ requests })
    }).catch(e => console.warn('Could not add sheet tabs:', e));
  }

  // 2. Read existing Submissions to avoid duplicate rows or update existing
  let existingSubmissionsRows: any[][] = [];
  try {
    existingSubmissionsRows = await readRange(spreadsheetId, `${submissionsSheetName || 'Submissions'}!A1:J1000`, token);
  } catch {
    existingSubmissionsRows = [];
  }

  const studentMap = new Map(payload.students.map(s => [s.studentId, s]));

  // Build row map by submissionId or (homeworkId + studentId)
  const header = ['submissionId', 'homeworkId', 'studentId', 'studentCode', 'studentName', 'status', 'submittedAt', 'checkedBy', 'checkedAt', 'updatedAt'];
  const dataRows: any[][] = [];

  const existingKeyIndex = new Map<string, number>();
  if (existingSubmissionsRows.length > 1) {
    for (let i = 1; i < existingSubmissionsRows.length; i++) {
      const row = existingSubmissionsRows[i];
      if (!row || row.length === 0) continue;
      const key = `${row[1]}_${row[2]}`; // hwId_studentId
      existingKeyIndex.set(key, i);
      dataRows.push([...row]);
    }
  }

  let updatedCount = 0;
  payload.submissions.forEach(sub => {
    const st = studentMap.get(sub.studentId);
    const key = `${sub.homeworkId}_${sub.studentId}`;
    const rowData = [
      sub.submissionId,
      sub.homeworkId,
      sub.studentId,
      st?.studentCode || '',
      st?.fullName || '',
      sub.status,
      sub.submittedAt || new Date().toISOString(),
      sub.checkedBy || '',
      sub.checkedAt || '',
      sub.updatedAt || new Date().toISOString()
    ];

    if (existingKeyIndex.has(key)) {
      const rowIdx = existingKeyIndex.get(key)! - 1;
      dataRows[rowIdx] = rowData;
    } else {
      dataRows.push(rowData);
    }
    updatedCount++;
  });

  // Write full updated Submissions back to sheet
  await writeRange(spreadsheetId, `${submissionsSheetName || 'Submissions'}!A1:J`, [header, ...dataRows], token);

  // 3. Also append a clean human-readable journal entry in 'Evaluations' tab for teacher visibility
  const evalHeader = ['Огноо', 'Анги', 'Хичээл', 'Сурагчийн код', 'Сурагчийн нэр', 'Үнэлгээ', 'Шалгасан ахлагч', 'Бүртгэсэн цаг'];
  const evalRows = payload.submissions.map(sub => {
    const st = studentMap.get(sub.studentId);
    const statusLabel = sub.status === 'EXCELLENT' ? 'Маш сайн' : sub.status === 'AVERAGE' ? 'Дунд' : 'Хийгээгүй';
    return [
      payload.date,
      payload.classId,
      payload.subjectName,
      st?.studentCode || '',
      st?.fullName || '',
      statusLabel,
      payload.leaderName,
      new Date().toLocaleString('mn-MN', { timeZone: 'Asia/Ulaanbaatar' })
    ];
  });

  // Append to Evaluations
  try {
    const appendUrl = `${BASE_URL}/${spreadsheetId}/values/${encodeURIComponent((evaluationsSheetName || 'Evaluations') + '!A1')}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
    
    // Check if Evaluations tab has header
    let evalExisting: any[][] = [];
    try {
      evalExisting = await readRange(spreadsheetId, `${evaluationsSheetName || 'Evaluations'}!A1:H1`, token);
    } catch {
      evalExisting = [];
    }

    const rowsToAppend = (evalExisting.length === 0) ? [evalHeader, ...evalRows] : evalRows;

    await fetch(appendUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ values: rowsToAppend })
    });
  } catch (e) {
    console.warn('Could not append to Evaluations tab:', e);
  }

  return { success: true, writtenCount: updatedCount };
}

/**
 * Reads Submissions and evaluation records from Google Sheet to ensure teacher views latest sheet data
 */
export async function readSubmissionsFromSheet(
  spreadsheetId: string,
  token: string
): Promise<Submission[]> {
  const meta = await getSpreadsheet(spreadsheetId, token);
  const existingSheets: string[] = (meta.sheets || []).map((s: any) => s.properties?.title as string);
  const submissionsSheetName = findSheetName(existingSheets, 'Submissions');

  let rows: any[][] = [];
  try {
    rows = await readRange(spreadsheetId, `${submissionsSheetName || 'Submissions'}!A1:J1000`, token);
  } catch {
    return [];
  }

  if (rows.length <= 1) return [];

  const submissions: Submission[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0 || !row[0]) continue;

    let statusRaw = String(row[5] || 'NOT_DONE').trim().toUpperCase();
    let status: Submission['status'] = 'NOT_DONE';
    if (statusRaw === 'EXCELLENT' || statusRaw === 'МАШ САЙН' || statusRaw === 'DONE') {
      status = 'EXCELLENT';
    } else if (statusRaw === 'AVERAGE' || statusRaw === 'ДУНД' || statusRaw === 'IN_PROGRESS') {
      status = 'AVERAGE';
    } else {
      status = 'NOT_DONE';
    }

    submissions.push({
      submissionId: String(row[0]),
      homeworkId: String(row[1] || ''),
      studentId: String(row[2] || ''),
      status,
      submittedAt: row[6] ? String(row[6]) : undefined,
      checkedBy: row[7] ? String(row[7]) : undefined,
      checkedAt: row[8] ? String(row[8]) : undefined,
      updatedAt: row[9] ? String(row[9]) : new Date().toISOString()
    });
  }

  return submissions;
}

/**
 * Pushes entire active schedule to Google Sheet Schedule tab
 */
export async function syncScheduleToSheet(
  spreadsheetId: string,
  token: string,
  schedule: ScheduleItem[]
): Promise<{ success: boolean; count: number }> {
  const meta = await getSpreadsheet(spreadsheetId, token);
  const existingSheets: string[] = (meta.sheets || []).map((s: any) => s.properties?.title as string);
  const scheduleSheetName = findSheetName(existingSheets, 'Schedule');

  // Ensure tab exists
  if (!existingSheets.some(s => s.toLowerCase() === 'schedule')) {
    await fetch(`${BASE_URL}/${spreadsheetId}:batchUpdate`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ requests: [{ addSheet: { properties: { title: 'Schedule' } } }] })
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
 * Pushes all homework items to Google Sheet Homework tab
 */
export async function syncHomeworkToSheet(
  spreadsheetId: string,
  token: string,
  homeworkList: Homework[]
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
      body: JSON.stringify({ requests: [{ addSheet: { properties: { title: 'Homework' } } }] })
    }).catch(() => {});
  }

  const header = ['homeworkId', 'classId', 'subjectId', 'subjectName', 'title', 'description', 'assignedDate', 'dueDate', 'createdBy', 'status', 'createdAt'];
  const rows = homeworkList.map(hw => [
    hw.homeworkId,
    hw.classId,
    hw.subjectId,
    hw.subjectName,
    hw.title,
    hw.description,
    hw.assignedDate,
    hw.dueDate,
    hw.createdBy,
    hw.status,
    hw.createdAt
  ]);

  await writeRange(spreadsheetId, `${homeworkSheetName || 'Homework'}!A1:K`, [header, ...rows], token);
  return { success: true, count: homeworkList.length };
}
