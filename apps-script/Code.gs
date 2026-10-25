/**
 * ==============================================================================
 * ГЭРИЙН ДААЛГАВРЫН СИСТЕМ — GOOGLE APPS SCRIPT BACKEND (Web App)
 * ==============================================================================
 * Google Spreadsheet ID: 1Q6zw3ylYDCeKoEUuXey3Pu7lQT8LMc_r8e2jyHa8cTM
 *
 * Өгөгдлийн эх сурвалж ба Sheet-ийн бүтэц:
 *   1) Эхний sheet (`ss.getSheets()[0]` - "users"):
 *      - Багана (толгойн мөрөөс дараалал харгалзахгүй танина):
 *        `нэвтрэх нэр`, `нууц үг`, `анги бүлэг`, `хэсгийн ахлагч` (тийм/үгүй),
 *        мөн `овог нэр`, `хэсэг` (group1..5), `эрх` (багш/ахлагч/сурагч), `код`.
 *      - Цорын ганц үнэн эх сурвалж (Single Source of Truth) — тусдаа хуулбар хадгалахгүй.
 *      - CacheService ашиглан 3 минутын (180 сек) cache хийнэ; `onEdit` болон 5 минутын
 *        time-driven trigger, эсвэл админы "Sync хийх" (`syncUsers()`) командаар шинэчилнэ.
 *   2) `homework_log` ба `Submissions` / `Homework`:
 *      - Хэсгийн ахлагчийн бүртгэсэн гэрийн даалгаврын гүйцэтгэл (сурагч, хичээл, огноо,
 *        төлөв: хийсэн/хийгээгүй/дутуу, тайлбар, `Utilities.getUuid()`, үүсгэсэн/зассан цаг,
 *        оруулсан хэрэглэгчийн нэр).
 *   3) `schedule` / `Schedule`:
 *      - Багшийн оруулсан хичээлийн хуваарь (анги бүлэг, гараг, цаг, хичээл, багш, танхим,
 *        `Utilities.getUuid()`, үүсгэсэн/зассан цаг, оруулсан хэрэглэгчийн нэр, `deleted`).
 *   4) Бусад туслах хүснэгтүүд:
 *      - `Groups`, `Leaders`, `StudentData`, `Subjects`, `AuditLog`.
 *
 * Найдвартай хадгалалт ба Аюулгүй байдал:
 *   - Бүх бичих үйлдэл `LockService.getScriptLock()` (`waitLock(30000)`) дотор хийгдэж,
 *     `finally` блок дээр чөлөөлөгдөнө.
 *   - Олон мөрийг `setValues()` batch аргаар бичиж, `SpreadsheetApp.flush()` дуудна.
 *   - Хадгалсны дараа Sheet-ээс буцаан уншиж баталгаажуулна (`verified: true`).
 *   - Клиентийн `requestId`-аар давхар илгээлтийг (idempotency) шалгана.
 *   - Formula Injection хамгаалалт: `=`, `+`, `-`, `@`-ээр эхэлсэн утгын өмнө `'` залгуулна.
 *   - Нууц үгийг клиент рүү хэзээ ч илгээхгүй, сервер талд (энгийн эсвэл SHA-256) шалгана.
 * ==============================================================================
 */

var DEFAULT_SHEET_ID = '1Q6zw3ylYDCeKoEUuXey3Pu7lQT8LMc_r8e2jyHa8cTM';
var TZ = 'Asia/Ulaanbaatar';
var TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
var SESSION_TTL_SEC = 6 * 60 * 60; // 6 цаг (CacheService дээд хязгаар)
var USERS_CACHE_KEY = 'USERS_SHEET_CACHE_V2';
var USERS_CACHE_TTL_SEC = 180; // 3 минут (1-5 минутын интервал)
var REQ_IDEMPOTENCY_TTL_SEC = 600; // 10 минут
var LOCK_WAIT_MS = 30000; // 30 секунд LockService waitLock
var MAX_FAILS = 5;
var LOCK_SECONDS = 600;
var MAX_ROWS_PER_REQUEST = 500;
var MAX_CELL_CHARS = 5000;
var AUDIT_FETCH_LIMIT = 300;

/**
 * Баганын төрөл: s=текст, n=тоо, b=boolean, d=огноо(yyyy-MM-dd), t=цаг(HH:mm)
 * 3 дахь элемент = хоосон үеийн анхны утга.
 */
var SCHEMA = {
  Schedule: {
    key: 'scheduleId',
    cols: [
      ['scheduleId', 's'],
      ['classId', 's'],
      ['weekday', 'n'],
      ['period', 'n'],
      ['subjectId', 's'],
      ['subjectName', 's'],
      ['teacherName', 's'],
      ['room', 's'],
      ['startTime', 't'],
      ['endTime', 't'],
      ['active', 'b', true],
      ['notes', 's'],
      ['createdAt', 's'],
      ['updatedAt', 's'],
      ['updatedBy', 's'],
      ['deleted', 'b', false]
    ]
  },
  Homework: {
    key: 'homeworkId',
    cols: [
      ['homeworkId', 's'],
      ['classId', 's'],
      ['subjectId', 's'],
      ['subjectName', 's'],
      ['title', 's'],
      ['description', 's'],
      ['assignedDate', 'd'],
      ['dueDate', 'd'],
      ['createdBy', 's'],
      ['status', 's'],
      ['createdAt', 's'],
      ['updatedAt', 's'],
      ['updatedBy', 's'],
      ['deleted', 'b', false]
    ]
  },
  Submissions: {
    key: 'submissionId',
    cols: [
      ['submissionId', 's'],
      ['homeworkId', 's'],
      ['studentId', 's'],
      ['status', 's'],
      ['submittedAt', 's'],
      ['checkedBy', 's'],
      ['checkedAt', 's'],
      ['teacherComment', 's'],
      ['leaderComment', 's'],
      ['studentNote', 's'],
      ['studentAttachmentUrl', 's'],
      ['updatedAt', 's'],
      ['updatedBy', 's'],
      ['deleted', 'b', false]
    ]
  },
  homework_log: {
    key: 'id',
    cols: [
      ['id', 's'],
      ['submissionId', 's'],
      ['homeworkId', 's'],
      ['studentId', 's'],
      ['studentName', 's'],
      ['classId', 's'],
      ['groupId', 's'],
      ['subjectName', 's'],
      ['date', 'd'],
      ['status', 's'],
      ['statusMn', 's'],
      ['comment', 's'],
      ['createdAt', 's'],
      ['updatedAt', 's'],
      ['updatedBy', 's'],
      ['deleted', 'b', false]
    ]
  },
  Groups: {
    key: 'groupId',
    cols: [
      ['groupId', 's'],
      ['classId', 's'],
      ['groupNumber', 'n'],
      ['name', 's'],
      ['leaderStudentId', 's'],
      ['leaderUserId', 's'],
      ['leaderName', 's'],
      ['color', 's']
    ]
  },
  Leaders: {
    key: 'leaderId',
    cols: [
      ['leaderId', 's'],
      ['userId', 's'],
      ['classId', 's'],
      ['groupId', 's'],
      ['groupNumber', 'n'],
      ['assignedBy', 's'],
      ['active', 'b', true],
      ['createdAt', 's']
    ]
  },
  StudentData: {
    key: 'studentId',
    cols: [
      ['studentId', 's'],
      ['groupId', 's'],
      ['groupNumber', 'n'],
      ['groupName', 's'],
      ['isLeader', 'b', false],
      ['active', 'b', true],
      ['publicDisplayName', 's'],
      ['showOnLeaderboard', 'b', true],
      ['studentCode', 's'],
      ['fullName', 's'],
      ['classId', 's']
    ]
  },
  Subjects: {
    key: 'subjectId',
    cols: [
      ['subjectId', 's'],
      ['name', 's'],
      ['code', 's'],
      ['color', 's'],
      ['defaultTeacher', 's'],
      ['category', 's'],
      ['active', 'b', true]
    ]
  },
  AuditLog: {
    key: 'logId',
    cols: [
      ['logId', 's'],
      ['userId', 's'],
      ['userName', 's'],
      ['action', 's'],
      ['targetType', 's'],
      ['targetId', 's'],
      ['timestamp', 's'],
      ['details', 's']
    ]
  }
};

var TABLE_ORDER = [
  'Schedule',
  'Homework',
  'Submissions',
  'homework_log',
  'Groups',
  'Leaders',
  'StudentData',
  'Subjects',
  'AuditLog'
];

/** Эрх бүрээр бичиж болох хүснэгтүүд */
var WRITABLE = {
  TEACHER: ['Schedule', 'Homework', 'Submissions', 'homework_log', 'Groups', 'Leaders', 'StudentData', 'Subjects', 'AuditLog'],
  LEADER: ['Homework', 'Submissions', 'homework_log', 'AuditLog'],
  STUDENT: ['Submissions', 'AuditLog']
};

var VALID_STATUSES = [
  'EXCELLENT',
  'AVERAGE',
  'NOT_DONE',
  'DONE',
  'IN_PROGRESS',
  'LATE',
  'SUBMITTED_FOR_REVIEW'
];

/** Монгол төлвийг стандарт код руу хөрвүүлэх */
var MN_STATUS_MAP = {
  'хийсэн': 'EXCELLENT',
  'маш сайн': 'EXCELLENT',
  'дутуу': 'AVERAGE',
  'дунд': 'AVERAGE',
  'хийж байгаа': 'AVERAGE',
  'хийгээгүй': 'NOT_DONE',
  'хоцорч хийсэн': 'LATE',
  'шалгуулахаар илгээсэн': 'SUBMITTED_FOR_REVIEW'
};

var STATUS_TO_MN = {
  EXCELLENT: 'хийсэн',
  DONE: 'хийсэн',
  AVERAGE: 'дутуу',
  IN_PROGRESS: 'дутуу',
  NOT_DONE: 'хийгээгүй',
  LATE: 'дутуу',
  SUBMITTED_FOR_REVIEW: 'шалгуулахаар илгээсэн'
};

// ============================================================================
//  ХҮСЭЛТИЙН ХУВААРИЛАЛТ (Web App Entry Points)
// ============================================================================

function doGet(e) {
  try {
    var params = (e && e.parameter) || {};
    var action = params.action || 'ping';
    if (action === 'ping') {
      return jsonResponse({
        success: true,
        message: 'Google Apps Script API хэвийн ажиллаж байна.',
        timestamp: new Date().toISOString(),
        version: 3
      });
    }
    if (action === 'publicSnapshot') {
      return jsonResponse({ success: true, data: buildPublicSnapshot(openDb()) });
    }
    return jsonResponse(fail('BAD_REQUEST', 'Үл мэдэгдэх үйлдэл: ' + action));
  } catch (err) {
    return jsonResponse(serverError(err));
  }
}

function doPost(e) {
  try {
    var body = {};
    if (e && e.postData && e.postData.contents) {
      try {
        body = JSON.parse(e.postData.contents);
      } catch (pe) {
        return jsonResponse(fail('BAD_REQUEST', 'Хүсэлтийн JSON буруу байна.'));
      }
    }
    var action = body.action;
    var ss = openDb();

    if (action === 'ping') {
      return jsonResponse({ success: true, timestamp: new Date().toISOString(), version: 3 });
    }
    if (action === 'login') {
      return jsonResponse(handleLogin(ss, body.username, body.password));
    }

    var auth = authenticate(ss, body.token);
    if (!auth.ok) return jsonResponse(fail('AUTH', auth.error));
    var ctx = auth.ctx;

    if (action === 'fetchAll') {
      return jsonResponse({
        success: true,
        data: buildFetchAll(ss, ctx, body.filters || {})
      });
    }
    if (action === 'sync') {
      return jsonResponse(handleSync(ss, ctx, body.changes, body.requestId));
    }
    if (action === 'syncUsers') {
      if (ctx.user.role !== 'TEACHER') {
        return jsonResponse(fail('FORBIDDEN', 'Зөвхөн багш/админ хэрэглэгчийн мэдээллийг sync хийх эрхтэй.'));
      }
      var syncRes = syncUsersInternal(ss);
      return jsonResponse(syncRes);
    }
    if (action === 'saveHomeworkLog') {
      return jsonResponse(handleSaveHomeworkLog(ss, ctx, body.entries, body.requestId));
    }
    if (action === 'saveSchedule') {
      return jsonResponse(handleSaveSchedule(ss, ctx, body.item, body.deleteId, body.softDelete, body.requestId));
    }
    if (action === 'initDatabase') {
      if (ctx.user.role !== 'TEACHER') {
        return jsonResponse(fail('FORBIDDEN', 'Зөвхөн багш бүтэц бэлтгэх эрхтэй.'));
      }
      initAllSheets();
      return jsonResponse({ success: true, message: 'Өгөгдлийн бүтэц бэлэн боллоо.' });
    }
    return jsonResponse(fail('BAD_REQUEST', 'Тодорхойгүй хүсэлт: ' + action));
  } catch (err) {
    return jsonResponse(serverError(err));
  }
}

// ============================================================================
//  ДААЛГАВАР №1: USERS SHEET (`getSheets()[0]`) УНШИХ, CACHE & TRIGGERS
// ============================================================================

var HEADER_ALIASES = {
  username: ['нэвтрэх нэр', 'username', 'login', 'хэрэглэгчийн нэр', 'нэвтрэх', 'хэрэглэгч', 'user'],
  password: ['нууц үг', 'нууц код', 'password', 'pass', 'нууц', 'нууцүг', 'pin'],
  name: ['овог нэр', 'овог, нэр', 'бүтэн нэр', 'нэр', 'fullname', 'full name', 'name', 'displayname', 'сурагч', 'сурагчийн нэр'],
  role: ['эрх', 'role', 'үүрэг', 'төрөл'],
  leader: ['хэсгийн ахлагч', 'ахлагч эсэх', 'ахлагч', 'leader', 'is_leader', 'isleader'],
  classId: ['анги бүлэг', 'анги, бүлэг', 'анги/бүлэг', 'анги', 'класс', 'class', 'classid', 'class_id'],
  group: ['хэсэг', 'групп', 'бүлэг', 'group', 'groupnumber', 'groupid', 'баг'],
  code: ['код', 'сурагчийн код', 'studentcode', 'code', 'id']
};

function normHeader(h) {
  return String(h === null || h === undefined ? '' : h)
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * Толгойн мөрөөс баганын индексийг динамикаар танина (баганын дараалал өөрчлөгдсөн ч ажиллана).
 */
function mapLoginColumns(headers, isStudentSheet) {
  var map = {};
  var norm = headers.map(normHeader);
  for (var key in HEADER_ALIASES) {
    var aliases = HEADER_ALIASES[key];
    for (var a = 0; a < aliases.length; a++) {
      var i = norm.indexOf(aliases[a]);
      if (i !== -1) {
        map[key] = i;
        break;
      }
    }
    if (map[key] === undefined) {
      // Partial match fallback
      for (var c = 0; c < norm.length; c++) {
        if (!norm[c]) continue;
        for (var b = 0; b < aliases.length; b++) {
          if (norm[c].indexOf(aliases[b]) !== -1) {
            map[key] = c;
            break;
          }
        }
        if (map[key] !== undefined) break;
      }
    }
  }
  var used = {};
  for (var k in map) used[map[k]] = true;
  if (map.username === undefined) map.username = 0;
  if (map.password === undefined) map.password = 1;
  if (map.name === undefined && !used[2] && 2 !== map.username && 2 !== map.password) map.name = 2;
  if (isStudentSheet) {
    if (map.classId === undefined && norm.length > 3 && !used[3]) map.classId = 3;
    if (map.code === undefined && norm.length > 4 && !used[4]) map.code = 4;
  }
  return map;
}

function sheetHasClassColumn(sheet) {
  if (!sheet || sheet.getLastRow() < 1 || sheet.getLastColumn() < 1) return false;
  var h = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(normHeader);
  return HEADER_ALIASES.classId.some(function (a) {
    return h.indexOf(a) !== -1;
  });
}

function sheetHasLeaderColumn(sheet) {
  if (!sheet || sheet.getLastRow() < 1 || sheet.getLastColumn() < 1) return false;
  var h = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(normHeader);
  return HEADER_ALIASES.leader.some(function (a) {
    return h.indexOf(a) !== -1;
  });
}

function isSystemTableSheetName(name) {
  var lower = String(name || '').trim().toLowerCase();
  var sys = [
    'schedule',
    'homework',
    'submissions',
    'homework_log',
    'groups',
    'leaders',
    'studentdata',
    'subjects',
    'auditlog',
    'settings'
  ];
  return sys.indexOf(lower) !== -1 || lower.indexOf('db_') === 0;
}

function sheetHasLoginColumns(sheet) {
  if (!sheet || sheet.getLastRow() < 1 || sheet.getLastColumn() < 1) return false;
  var h = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(normHeader);
  var hasUser = HEADER_ALIASES.username.some(function (a) { return h.indexOf(a) !== -1; });
  var hasPass = HEADER_ALIASES.password.some(function (a) { return h.indexOf(a) !== -1; });
  return hasUser && hasPass;
}

/**
 * Эхний sheet (`ss.getSheets()[0]`) нь үндсэн `users` sheet байна.
 * Хэрэв хуучин 2-tab бүтэцтэй (1: Багш, 2: Сурагч) бол хоёуланг нь дэмжинэ.
 */
function getLoginSheets(ss) {
  var sheets = ss.getSheets();
  if (!sheets || sheets.length < 1) {
    throw userError('Google Sheet дотор "users" (эхний sheet) олдсонгүй.');
  }
  var a = sheets[0];
  // Хэрэв эхний sheet нь "хэсгийн ахлагч" баганатай эсвэл 2 дахь sheet байхгүй/системийн хүснэгт бол UNIFIED горим:
  if (sheetHasLeaderColumn(a) || sheets.length < 2) {
    return { mode: 'UNIFIED', unified: a, teachers: null, students: null };
  }
  var b = sheets[1];
  if (isSystemTableSheetName(b.getName()) && !sheetHasLoginColumns(b)) {
    return { mode: 'UNIFIED', unified: a, teachers: null, students: null };
  }
  if (sheetHasClassColumn(a) && !sheetHasClassColumn(b)) {
    return { mode: 'TWO_SHEETS', teachers: b, students: a, unified: null };
  }
  return { mode: 'TWO_SHEETS', teachers: a, students: b, unified: null };
}

function parseClassAndGroup(rawClassId, rawGroup, rawLeader, rawRole) {
  var classId = String(rawClassId || '').trim();
  var groupStr = String(rawGroup || '').trim();
  var leaderStr = String(rawLeader || '').trim();
  var roleStr = String(rawRole || '').trim();
  var groupNumber = undefined;

  // "10А group2", "10А / 2-р хэсэг", "10А-2" зэрэг бичвэрээс анги болон хэсгийг салгах
  var cgMatch = /^(\d{1,2}\s*[А-ЯӨҮЁA-Zа-яөүёa-z])\s*(?:[/|-]|\s+)(?:group\s*)?([1-5])(?:-р\s*хэсэг)?$/i.exec(classId);
  if (cgMatch) {
    classId = cgMatch[1].replace(/\s+/g, '').toUpperCase();
    groupNumber = parseInt(cgMatch[2], 10);
  } else {
    classId = classId.replace(/\s*анги\s*$/i, '').trim();
  }

  if (!groupNumber && groupStr) {
    var gm = /([1-5])/.exec(groupStr);
    if (gm) groupNumber = parseInt(gm[1], 10);
  }
  if (!groupNumber && leaderStr) {
    var lm = /leader\s*([1-5])/i.exec(leaderStr);
    if (lm) groupNumber = parseInt(lm[1], 10);
  }
  if (!groupNumber && roleStr) {
    var rm = /leader\s*([1-5])/i.exec(roleStr);
    if (rm) groupNumber = parseInt(rm[1], 10);
  }

  return {
    classId: classId,
    groupNumber: groupNumber,
    groupId: classId && groupNumber ? 'grp_' + classId + '_' + groupNumber : '',
    groupName: groupNumber ? groupNumber + '-р хэсэг' : ''
  };
}

function parseIsLeaderValue(rawLeader, rawRole) {
  var l = String(rawLeader || '').trim().toLowerCase();
  var r = String(rawRole || '').trim().toLowerCase();
  if (
    l === 'тийм' ||
    l === 'yes' ||
    l === 'true' ||
    l === '1' ||
    l === 'ахлагч' ||
    l.indexOf('leader') !== -1 ||
    l.indexOf('тийм') !== -1
  ) {
    return true;
  }
  if (r.indexOf('leader') !== -1 || r.indexOf('ахлагч') !== -1) {
    return true;
  }
  return false;
}

function parseIsTeacherValue(rawRole, rawLeader, rawClassId, username) {
  var r = String(rawRole || '').trim().toLowerCase();
  var l = String(rawLeader || '').trim().toLowerCase();
  var c = String(rawClassId || '').trim().toLowerCase();
  var u = String(username || '').trim().toLowerCase();
  if (
    r === 'teacher' ||
    r === 'багш' ||
    r === 'admin' ||
    r === 'админ' ||
    l === 'багш' ||
    l === 'teacher' ||
    c === 'багш' ||
    c === 'teacher' ||
    c === 'admin' ||
    u === 'teacher' ||
    u === 'admin'
  ) {
    return true;
  }
  return false;
}

function readLoginSheet(sheet, isStudentSheet) {
  var out = [];
  if (!sheet) return out;
  var lastRow = sheet.getLastRow(),
    lastCol = sheet.getLastColumn();
  if (lastRow < 2 || lastCol < 1) return out;
  var rng = sheet.getRange(1, 1, lastRow, lastCol);
  var vals = rng.getValues();
  var disp = rng.getDisplayValues();
  var map = mapLoginColumns(vals[0], isStudentSheet);
  var get = function (row, key) {
    return map[key] === undefined ? '' : cellText(row[map[key]]);
  };
  for (var i = 1; i < vals.length; i++) {
    var row = vals[i];
    var username = get(row, 'username').trim();
    if (!username) continue; // хоосон мөрийг алгасна
    var uLow = username.toLowerCase();
    if (uLow === 'нэвтрэх нэр' || uLow === 'username') continue; // давтагдсан толгой мөр
    var pwRaw = map.password === undefined ? '' : row[map.password];
    var pwCands = [];
    var p1 = cellText(pwRaw).trim(),
      p2 = map.password !== undefined ? cellText(disp[i][map.password]).trim() : '';
    if (p1) pwCands.push(p1);
    if (p2 && p2 !== p1) pwCands.push(p2);

    var rawClassId = get(row, 'classId').trim();
    var rawGroup = get(row, 'group').trim();
    var rawLeader = get(row, 'leader').trim();
    var rawRole = get(row, 'role').trim();
    var cg = parseClassAndGroup(rawClassId, rawGroup, rawLeader, rawRole);

    out.push({
      rowNumber: i + 1,
      username: username,
      passwords: pwCands,
      name: get(row, 'name').trim(),
      classId: cg.classId,
      groupNumber: cg.groupNumber,
      groupId: cg.groupId,
      groupName: cg.groupName,
      code: get(row, 'code').trim(),
      roleRaw: rawRole,
      leaderRaw: rawLeader,
      isLeader: parseIsLeaderValue(rawLeader, rawRole),
      isTeacher: parseIsTeacherValue(rawRole, rawLeader, rawClassId, username)
    });
  }
  return out;
}

function cellText(v) {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return v.toISOString();
  return String(v);
}

function slug(s) {
  var t = String(s || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '_')
    .replace(/^_+|_+$/g, '');
  return t || 'x';
}

/**
 * `users` sheet-ээс (эсвэл CacheService-ээс) хэрэглэгчийн түүхий мөрүүдийг уншина.
 * CacheService-д 180 секунд (3 минут) хадгална.
 */
function readCachedUsersSheetData(ss, forceRefresh) {
  var cache = CacheService.getScriptCache();
  if (!forceRefresh && cache) {
    try {
      var cachedJson = cache.get(USERS_CACHE_KEY);
      if (cachedJson) {
        var parsed = JSON.parse(cachedJson);
        if (parsed && Array.isArray(parsed.teacherRows) && Array.isArray(parsed.studentRows)) {
          return parsed;
        }
      }
    } catch (e) {
      // Cache эвдэрсэн бол sheet-ээс шууд уншина
    }
  }

  var ls = getLoginSheets(ss);
  var teacherRows = [];
  var studentRows = [];
  var duplicates = [];
  var seenUsernames = {};

  if (ls.mode === 'TWO_SHEETS') {
    var tRaw = readLoginSheet(ls.teachers, false);
    var sRaw = readLoginSheet(ls.students, true);
    tRaw.forEach(function (r) {
      var k = r.username.toLowerCase();
      if (seenUsernames[k]) {
        duplicates.push(r.username);
        return;
      }
      seenUsernames[k] = true;
      teacherRows.push(r);
    });
    sRaw.forEach(function (r) {
      var k = r.username.toLowerCase();
      if (seenUsernames[k]) {
        duplicates.push(r.username);
      }
      seenUsernames[k] = true;
      studentRows.push(r);
    });
  } else {
    // Эхний sheet (`ss.getSheets()[0]`) дээрх нэгдсэн `users` хүснэгт
    var allRows = readLoginSheet(ls.unified, true);
    allRows.forEach(function (r) {
      var k = r.username.toLowerCase();
      if (seenUsernames[k]) {
        duplicates.push(r.username);
        return;
      }
      seenUsernames[k] = true;
      if (r.isTeacher) {
        teacherRows.push(r);
      } else {
        studentRows.push(r);
      }
    });
  }

  var payload = {
    teacherRows: teacherRows,
    studentRows: studentRows,
    duplicates: duplicates,
    cachedAt: new Date().toISOString()
  };

  if (cache) {
    try {
      var serialized = JSON.stringify(payload);
      if (serialized.length < 95000) {
        cache.put(USERS_CACHE_KEY, serialized, USERS_CACHE_TTL_SEC);
      }
    } catch (e) {
      // Cache хэмжээ хэтэрвэл алгасна
    }
  }
  return payload;
}

function invalidateUsersCache() {
  try {
    var cache = CacheService.getScriptCache();
    if (cache) cache.remove(USERS_CACHE_KEY);
  } catch (e) {
    // ignore
  }
}

/**
 * Гараар болон Trigger-ээр (5 минут тутам / onEdit) дуудагдах `syncUsers()` функц.
 */
function syncUsers() {
  var ss = openDb();
  return syncUsersInternal(ss);
}

function syncUsersInternal(ss) {
  invalidateUsersCache();
  var sheetData = readCachedUsersSheetData(ss, true);
  var data = loadAccounts(ss, true);
  var teachers = data.accounts.filter(function (a) {
    return a.role === 'TEACHER';
  });
  var leaders = data.accounts.filter(function (a) {
    return a.role === 'LEADER';
  });
  var students = data.accounts.filter(function (a) {
    return a.role === 'STUDENT';
  });
  var syncedAt = new Date().toISOString();
  try {
    PropertiesService.getScriptProperties().setProperty('LAST_USER_SYNC_AT', syncedAt);
  } catch (e) {
    // ignore
  }
  return {
    success: true,
    message:
      'Users sheet-ээс ' +
      data.accounts.length +
      ' хэрэглэгч (' +
      teachers.length +
      ' багш, ' +
      leaders.length +
      ' ахлагч, ' +
      students.length +
      ' сурагч) амжилттай синк хийгдлээ.',
    userCount: data.accounts.length,
    teacherCount: teachers.length,
    leaderCount: leaders.length,
    studentCount: data.students.length,
    duplicates: sheetData.duplicates || [],
    syncedAt: syncedAt
  };
}

/**
 * Simple болон Installable `onEdit` trigger handler:
 * Эхний sheet (`users`) дээр өөрчлөлт ормогц cache-ийг тэр дор нь шинэчилнэ.
 */
function onEdit(e) {
  try {
    if (!e || !e.range) {
      invalidateUsersCache();
      return;
    }
    var editedSheet = e.range.getSheet();
    var ss = editedSheet.getParent();
    var firstSheet = ss.getSheets()[0];
    if (
      editedSheet.getSheetId() === firstSheet.getSheetId() ||
      editedSheet.getIndex() <= 2
    ) {
      invalidateUsersCache();
      readCachedUsersSheetData(ss, true);
    }
  } catch (err) {
    invalidateUsersCache();
  }
}

function onSheetEdit(e) {
  onEdit(e);
}

/**
 * Installable trigger-үүдийг (5 минут тутмын time-driven + onEdit) автоматаар үүсгэх функц.
 * Apps Script Editor-оос 1 удаа `setupTriggers` сонгоод Run дарна.
 */
function setupTriggers() {
  if (typeof ScriptApp === 'undefined') return;
  var ss = openDb();
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    var fn = triggers[i].getHandlerFunction();
    if (fn === 'syncUsers' || fn === 'onSheetEdit') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
  ScriptApp.newTrigger('syncUsers').timeBased().everyMinutes(5).create();
  ScriptApp.newTrigger('onSheetEdit').forSpreadsheet(ss).onEdit().create();
  Logger.log('5 минут тутмын syncUsers болон onSheetEdit trigger амжилттай үүслээ.');
}

/**
 * Бүх хэрэглэгчийг (багш + хэсгийн ахлагч + сурагч) эрх, анги, хэсэгтэйгээр бүрдүүлнэ.
 * `users` sheet (`ss.getSheets()[0]`) нь цорын ганц үнэн эх сурвалж байна.
 */
function loadAccounts(ss, forceRefresh) {
  var rawUsers = readCachedUsersSheetData(ss, !!forceRefresh);
  var teacherRows = rawUsers.teacherRows;
  var studentRows = rawUsers.studentRows;

  var overlay = {};
  var leadersByUser = {};
  var sd = tableIfExists(ss, 'StudentData');
  if (sd) {
    sd.items.forEach(function (it) {
      overlay[it.obj.studentId] = it.obj;
    });
  }
  var ld = tableIfExists(ss, 'Leaders');
  if (ld) {
    ld.items.forEach(function (it) {
      if (it.obj.active) leadersByUser[it.obj.userId] = it.obj;
    });
  }

  var accounts = [];
  var seenTeacher = {};
  teacherRows.forEach(function (r) {
    var uid = 'u_' + slug(r.username);
    if (seenTeacher[uid]) return;
    seenTeacher[uid] = true;
    accounts.push({
      userId: uid,
      username: r.username,
      role: 'TEACHER',
      studentId: '',
      classId: r.classId || '',
      groupId: '',
      groupNumber: undefined,
      groupName: '',
      isLeader: false,
      displayName: r.name || r.username,
      passwords: r.passwords,
      active: true,
      extra: false
    });
  });

  var students = [];
  var seenStudent = {};
  studentRows.forEach(function (r) {
    var base = 'std_' + slug(r.code || r.username);
    var sid = base;
    if (seenStudent[sid]) sid = base + '_' + r.rowNumber;
    seenStudent[sid] = true;
    var ov = overlay[sid];
    var uid = 'u_' + slug(r.code || r.username);

    var isLeader =
      r.isLeader === true ||
      (ov ? ov.isLeader === true : !!leadersByUser[uid]);
    var active = ov ? ov.active !== false : true;
    var fullName = r.name || r.username;
    var classId = r.classId || (ov && ov.classId) || '';
    var groupNumber =
      r.groupNumber !== undefined
        ? r.groupNumber
        : ov && ov.groupNumber !== undefined
        ? ov.groupNumber
        : undefined;
    var groupId =
      r.groupId ||
      (ov && ov.groupId) ||
      (classId && groupNumber ? 'grp_' + classId + '_' + groupNumber : '');
    var groupName =
      r.groupName ||
      (ov && ov.groupName) ||
      (groupNumber ? groupNumber + '-р хэсэг' : '');

    var student = {
      studentId: sid,
      studentCode: r.code || r.username,
      fullName: fullName,
      classId: classId,
      active: active,
      publicDisplayName: (ov && ov.publicDisplayName) || givenName(fullName),
      showOnLeaderboard: ov ? ov.showOnLeaderboard !== false : true,
      groupId: groupId,
      groupNumber: groupNumber,
      groupName: groupName,
      isLeader: isLeader
    };
    students.push(student);
    accounts.push({
      userId: uid,
      username: r.username,
      altUsername: r.code,
      role: isLeader ? 'LEADER' : 'STUDENT',
      studentId: sid,
      classId: classId,
      groupId: groupId,
      groupNumber: groupNumber,
      groupName: groupName,
      isLeader: isLeader,
      displayName: fullName,
      passwords: r.passwords,
      active: active,
      extra: false
    });
  });

  // Апп дотроос нэмсэн сурагчид: жагсаалтад харагдана
  var known = {};
  students.forEach(function (s) {
    known[s.studentId] = true;
  });
  if (sd) {
    sd.items.forEach(function (it) {
      var o = it.obj;
      if (known[o.studentId] || !o.fullName) return;
      students.push({
        studentId: o.studentId,
        studentCode: o.studentCode || '',
        fullName: o.fullName,
        classId: o.classId || '',
        active: o.active !== false,
        publicDisplayName: o.publicDisplayName || givenName(o.fullName),
        showOnLeaderboard: o.showOnLeaderboard !== false,
        groupId: o.groupId || '',
        groupNumber: o.groupNumber,
        groupName: o.groupName || '',
        isLeader: o.isLeader === true
      });
    });
  }

  return { accounts: accounts, students: students, duplicates: rawUsers.duplicates || [] };
}

function givenName(fullName) {
  var parts = String(fullName || '').trim().split(/\s+/);
  return parts[parts.length - 1] || '';
}

function handleLogin(ss, username, password) {
  username = String(username === undefined || username === null ? '' : username).trim();
  password = String(password === undefined || password === null ? '' : password).trim();
  if (!username || !password) {
    return fail('BAD_CREDENTIALS', 'Нэвтрэх нэр болон нууц үгээ оруулна уу.');
  }

  var cache = CacheService.getScriptCache();
  var failKey = 'lf_' + computeSha256(username.toLowerCase()).substring(0, 32);
  var fails = parseInt((cache && cache.get(failKey)) || '0', 10) || 0;
  if (fails >= MAX_FAILS) {
    return fail(
      'LOCKED',
      'Хэт олон буруу оролдлого хийсэн тул түр хаагдлаа. 10 минутын дараа дахин оролдоно уу.'
    );
  }

  // Нэвтрэх үед Sheet-ээс хамгийн шинэ мэдээллийг шалгана
  var data = loadAccounts(ss, false);
  var uname = username.toLowerCase();
  var found = null;
  for (var i = 0; i < data.accounts.length; i++) {
    var a = data.accounts[i];
    if (
      a.username.trim().toLowerCase() === uname ||
      (a.altUsername && String(a.altUsername).trim().toLowerCase() === uname)
    ) {
      found = a;
      break;
    }
  }

  var ok = false;
  if (found && found.active) {
    for (var p = 0; p < found.passwords.length; p++) {
      if (passwordMatches(found.passwords[p], password)) {
        ok = true;
        break;
      }
    }
  }
  if (!ok) {
    if (cache) cache.put(failKey, String(fails + 1), LOCK_SECONDS);
    return fail('BAD_CREDENTIALS', 'Нэвтрэх нэр эсвэл нууц үг буруу байна.');
  }
  if (cache) cache.remove(failKey);

  var user = publicUser(found);
  var token = createSessionToken(found);
  safeAudit(ss, found, 'LOGIN', 'USER', found.userId, 'Хэрэглэгч системд нэвтэрлээ.');
  return { success: true, token: token, user: user };
}

/**
 * Клиент рүү илгээх хэрэглэгчийн мэдээлэл (нууц үгийг ХЭЗЭЭ Ч илгээхгүй).
 */
function publicUser(a) {
  return {
    userId: a.userId,
    username: a.username,
    role: a.role,
    studentId: a.studentId || '',
    classId: a.classId || '',
    groupId: a.groupId || '',
    groupNumber: a.groupNumber,
    groupName: a.groupName || '',
    isLeader: a.role === 'LEADER' || !!a.isLeader,
    displayName: a.displayName,
    active: true,
    createdAt: ''
  };
}

/**
 * Sheet-д энгийн текст эсвэл SHA-256 hex хэш (64 тэмдэгт) хэлбэрээр хадгалсан нууц үгийг шалгана.
 */
function passwordMatches(stored, input) {
  if (!stored) return false;
  stored = String(stored).trim();
  input = String(input).trim();
  if (/^[a-f0-9]{64}$/i.test(stored)) {
    return safeEqual(stored.toLowerCase(), computeSha256(input));
  }
  return safeEqual(stored, input);
}

function safeEqual(a, b) {
  a = String(a);
  b = String(b);
  var diff = a.length ^ b.length;
  var n = Math.max(a.length, b.length);
  for (var i = 0; i < n; i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

// ---- Session & Token: CacheService + HMAC-SHA256 ---------------------------

function getSecret() {
  var props = PropertiesService.getScriptProperties();
  var s = props.getProperty('TOKEN_SECRET');
  if (s) return s;
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    s = props.getProperty('TOKEN_SECRET');
    if (!s) {
      s = Utilities.getUuid() + Utilities.getUuid() + Utilities.getUuid();
      props.setProperty('TOKEN_SECRET', s);
    }
  } finally {
    lock.releaseLock();
  }
  return s;
}

function createSessionToken(account) {
  var now = new Date().getTime();
  var payloadObj = {
    uid: account.userId,
    role: account.role,
    classId: account.classId || '',
    groupId: account.groupId || '',
    isLeader: account.role === 'LEADER' || !!account.isLeader,
    exp: now + TOKEN_TTL_MS
  };
  var payload = JSON.stringify(payloadObj);
  var p = Utilities.base64EncodeWebSafe(payload);
  var sig = Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(p, getSecret()));
  var token = p + '.' + sig;

  // Session мэдээллийг CacheService-д хугацаатай хадгална
  try {
    var cache = CacheService.getScriptCache();
    if (cache) {
      cache.put('sess_' + account.userId, JSON.stringify(payloadObj), SESSION_TTL_SEC);
    }
  } catch (e) {
    // ignore
  }
  return token;
}

function signToken(userId) {
  return createSessionToken({ userId: userId, role: 'STUDENT', classId: '', groupId: '', isLeader: false });
}

function authenticate(ss, token) {
  if (!token || typeof token !== 'string' || token.indexOf('.') === -1) {
    return { ok: false, error: 'Нэвтрэх эрх хүчингүй байна. Дахин нэвтэрнэ үү.' };
  }
  var parts = token.split('.');
  if (parts.length !== 2) {
    return { ok: false, error: 'Нэвтрэх эрх хүчингүй байна. Дахин нэвтэрнэ үү.' };
  }
  var expected = Utilities.base64EncodeWebSafe(
    Utilities.computeHmacSha256Signature(parts[0], getSecret())
  );
  if (!safeEqual(expected, parts[1])) {
    return { ok: false, error: 'Нэвтрэх эрх хүчингүй байна. Дахин нэвтэрнэ үү.' };
  }
  var payload;
  try {
    payload = JSON.parse(
      Utilities.newBlob(Utilities.base64DecodeWebSafe(parts[0])).getDataAsString()
    );
  } catch (e) {
    return { ok: false, error: 'Нэвтрэх эрх хүчингүй байна. Дахин нэвтэрнэ үү.' };
  }
  if (!payload || !payload.uid || !payload.exp || payload.exp < new Date().getTime()) {
    return { ok: false, error: 'Нэвтрэх хугацаа дууссан байна. Дахин нэвтэрнэ үү.' };
  }
  // Эрх, анги бүлэг, хэсгийн ахлагч эсэхийг хүсэлт бүрд sheet/cache-ээс баталгаажуулна
  var data = loadAccounts(ss, false);
  for (var i = 0; i < data.accounts.length; i++) {
    var a = data.accounts[i];
    if (a.userId === payload.uid) {
      if (!a.active) return { ok: false, error: 'Таны эрх идэвхгүй болсон байна.' };
      return { ok: true, ctx: { user: a, students: data.students, accounts: data.accounts } };
    }
  }
  return { ok: false, error: 'Хэрэглэгч олдсонгүй. Дахин нэвтэрнэ үү.' };
}

// ============================================================================
//  ӨГӨГДӨЛ ТАТАХ (Сервер талын шүүлт: анги бүлэг, хэсэг, огноо)
// ============================================================================

function rowsOf(ss, name) {
  var t = tableIfExists(ss, name);
  if (!t) return [];
  return t.items
    .map(function (it) {
      return it.obj;
    })
    .filter(function (obj) {
      return obj.deleted !== true && String(obj.deleted).toLowerCase() !== 'deleted';
    });
}

function buildFetchAll(ss, ctx, filters) {
  filters = filters || {};
  var role = ctx.user.role;
  var cls = filters.classId || ctx.user.classId;
  var grp = filters.groupId || ctx.user.groupId;
  var filterDate = filters.date ? normalizeDate(String(filters.date)) : '';

  var students = ctx.students.slice();
  var schedule = rowsOf(ss, 'Schedule');
  var homework = rowsOf(ss, 'Homework');
  var submissions = rowsOf(ss, 'Submissions');
  var homeworkLog = rowsOf(ss, 'homework_log');
  var groups = rowsOf(ss, 'Groups');
  var leaders = rowsOf(ss, 'Leaders');
  var subjects = rowsOf(ss, 'Subjects');
  var auditLogs = [];
  var users;

  if (role === 'TEACHER') {
    if (filters.classId && filters.classId !== 'ALL') {
      students = students.filter(function (s) { return s.classId === filters.classId; });
      schedule = schedule.filter(function (x) { return x.classId === filters.classId; });
      homework = homework.filter(function (x) { return x.classId === filters.classId; });
      groups = groups.filter(function (x) { return x.classId === filters.classId; });
      homeworkLog = homeworkLog.filter(function (x) { return x.classId === filters.classId; });
    }
    var al = rowsOf(ss, 'AuditLog');
    auditLogs = al.slice(Math.max(0, al.length - AUDIT_FETCH_LIMIT));
    users = ctx.accounts.map(publicUser);
  } else {
    students = students.filter(function (s) {
      return s.classId === cls;
    });
    schedule = schedule.filter(function (x) {
      return x.classId === cls;
    });
    homework = homework.filter(function (x) {
      return x.classId === cls;
    });
    groups = groups.filter(function (x) {
      return x.classId === cls;
    });
    var allowedStudentIds = {};
    students.forEach(function (s) {
      if (role === 'LEADER' && grp && s.groupId && s.groupId !== grp) {
        return; // Ахлагч өөрийн хэсгийн сурагчдын даалгаврыг л засна
      }
      allowedStudentIds[s.studentId] = true;
    });
    if (role === 'LEADER') {
      submissions = submissions.filter(function (x) {
        return allowedStudentIds[x.studentId];
      });
      homeworkLog = homeworkLog.filter(function (x) {
        return x.classId === cls && (!grp || !x.groupId || x.groupId === grp);
      });
      leaders = leaders.filter(function (x) {
        return x.classId === cls;
      });
    } else {
      var me = ctx.user.studentId;
      submissions = submissions.filter(function (x) {
        return x.studentId === me;
      });
      homeworkLog = homeworkLog.filter(function (x) {
        return x.studentId === me;
      });
      leaders = [];
    }
  }

  if (filterDate) {
    homework = homework.filter(function (h) {
      return h.assignedDate === filterDate;
    });
    homeworkLog = homeworkLog.filter(function (l) {
      return l.date === filterDate;
    });
  }

  return {
    students: students,
    schedule: schedule,
    homework: homework,
    submissions: submissions,
    homeworkLog: homeworkLog,
    groups: groups,
    leaders: leaders,
    subjects: subjects,
    auditLogs: auditLogs,
    users: users
  };
}

/** Нэвтрээгүй хэрэглэгчид: нууц мэдээлэлгүй нийтийн самбарын өгөгдөл. */
function buildPublicSnapshot(ss) {
  var data = loadAccounts(ss, false);
  var students = data.students
    .filter(function (s) {
      return s.active;
    })
    .map(function (s) {
      return {
        studentId: s.studentId,
        studentCode: '',
        fullName: s.publicDisplayName,
        classId: s.classId,
        active: true,
        publicDisplayName: s.publicDisplayName,
        showOnLeaderboard: s.showOnLeaderboard,
        groupId: s.groupId,
        groupNumber: s.groupNumber,
        groupName: s.groupName,
        isLeader: false
      };
    });
  var ids = {};
  students.forEach(function (s) {
    ids[s.studentId] = true;
  });
  var submissions = rowsOf(ss, 'Submissions')
    .filter(function (x) {
      return ids[x.studentId];
    })
    .map(function (x) {
      return {
        submissionId: x.submissionId,
        homeworkId: x.homeworkId,
        studentId: x.studentId,
        status: x.status,
        updatedAt: x.updatedAt
      };
    });
  var groups = rowsOf(ss, 'Groups').map(function (g) {
    return {
      groupId: g.groupId,
      classId: g.classId,
      groupNumber: g.groupNumber,
      name: g.name,
      color: g.color
    };
  });
  return {
    students: students,
    schedule: rowsOf(ss, 'Schedule'),
    homework: rowsOf(ss, 'Homework'),
    submissions: submissions,
    groups: groups,
    leaders: [],
    subjects: rowsOf(ss, 'Subjects'),
    auditLogs: []
  };
}

// ============================================================================
//  ДААЛГАВАР №2: НАЙДВАРТАЙ ХАДГАЛАЛТ (LockService, setValues, flush, verify)
// ============================================================================

function checkIdempotency(requestId) {
  if (!requestId || typeof requestId !== 'string') return null;
  try {
    var cache = CacheService.getScriptCache();
    if (!cache) return null;
    var cached = cache.get('req_' + requestId);
    if (cached) return JSON.parse(cached);
  } catch (e) {
    // ignore
  }
  return null;
}

function saveIdempotency(requestId, responseObj) {
  if (!requestId || typeof requestId !== 'string') return;
  try {
    var cache = CacheService.getScriptCache();
    if (!cache) return;
    var str = JSON.stringify(responseObj);
    if (str.length < 90000) {
      cache.put('req_' + requestId, str, REQ_IDEMPOTENCY_TTL_SEC);
    }
  } catch (e) {
    // ignore
  }
}

function handleSync(ss, ctx, changes, requestId) {
  if (!Array.isArray(changes)) return fail('BAD_REQUEST', 'changes массив байх ёстой.');
  var prevResponse = checkIdempotency(requestId);
  if (prevResponse) return prevResponse;

  var total = 0;
  changes.forEach(function (c) {
    total += ((c && c.upsert) || []).length + ((c && c.remove) || []).length;
  });
  if (total > MAX_ROWS_PER_REQUEST) {
    return fail(
      'BAD_REQUEST',
      'Нэг удаагийн хүсэлтэд хэт олон мөр байна (дээд тал ' + MAX_ROWS_PER_REQUEST + ').'
    );
  }

  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(LOCK_WAIT_MS);
  } catch (e) {
    return {
      success: false,
      error: 'Сервер завгүй байна (өөр хэрэглэгч хадгалж байна). Түр хүлээгээд дахин оролдоно уу.',
      code: 'BUSY',
      retryable: true
    };
  }
  try {
    var results = [];
    var writable = WRITABLE[ctx.user.role] || [];
    var state = { students: indexBy(ctx.students, 'studentId') };
    var invalidateUsers = false;

    for (var i = 0; i < changes.length; i++) {
      var ch = changes[i] || {};
      var res = {
        table: ch.table,
        written: 0,
        removed: 0,
        verified: false,
        rejected: [],
        skipped: [],
        adjusted: [],
        idMap: {}
      };
      results.push(res);
      var upsert = Array.isArray(ch.upsert) ? ch.upsert : [];
      var remove = Array.isArray(ch.remove) ? ch.remove : [];
      if (!SCHEMA[ch.table]) {
        res.rejected.push('table:' + ch.table);
        continue;
      }
      var key = SCHEMA[ch.table].key;
      if (writable.indexOf(ch.table) === -1) {
        upsert.forEach(function (r) {
          res.rejected.push(String((r && r[key]) || '?'));
        });
        remove.forEach(function (id) {
          res.rejected.push(String(id));
        });
        continue;
      }
      if (ch.table === 'StudentData' || ch.table === 'Leaders' || ch.table === 'Groups') {
        invalidateUsers = true;
      }
      applyTableChange(ss, ctx, state, ch.table, upsert, remove, !!ch.softDelete, res);
    }

    if (typeof SpreadsheetApp.flush === 'function') {
      SpreadsheetApp.flush();
    }

    if (invalidateUsers) {
      invalidateUsersCache();
    }

    var responseObj = {
      success: true,
      verified: true,
      syncedAt: new Date().toISOString(),
      results: results
    };
    saveIdempotency(requestId, responseObj);
    return responseObj;
  } finally {
    lock.releaseLock();
  }
}

/**
 * Хэсгийн ахлагч (эсвэл багш) гэрийн даалгаврын гүйцэтгэлийг `homework_log` болон `Submissions` руу
 * шууд хадгалах тусгай функц (Даалгавар №2.1).
 */
function handleSaveHomeworkLog(ss, ctx, entries, requestId) {
  if (!Array.isArray(entries) || !entries.length) {
    return fail('BAD_REQUEST', 'Хадгалах даалгаврын мэдээлэл хоосон байна.');
  }
  if (ctx.user.role !== 'LEADER' && ctx.user.role !== 'TEACHER') {
    return fail('FORBIDDEN', 'Зөвхөн хэсгийн ахлагч болон багш даалгаврын гүйцэтгэл бүртгэх эрхтэй.');
  }

  var prevResponse = checkIdempotency(requestId);
  if (prevResponse) return prevResponse;

  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(LOCK_WAIT_MS);
  } catch (e) {
    return {
      success: false,
      error: 'Сервер завгүй байна. Түр хүлээгээд дахин оролдоно уу.',
      code: 'BUSY',
      retryable: true
    };
  }

  try {
    var studentMap = indexBy(ctx.students, 'studentId');
    var nowIso = new Date().toISOString();
    var logUpserts = [];
    var rejected = [];

    entries.forEach(function (raw) {
      if (!raw || typeof raw !== 'object') {
        rejected.push('invalid');
        return;
      }
      var st = studentMap[raw.studentId];
      if (!st) {
        rejected.push(String(raw.studentId || '?'));
        return;
      }
      // Сервер талын эрхийн шалгалт: Ахлагч зөвхөн өөрийн анги бүлэг, өөрийн хэсгийн сурагчийг засна
      if (ctx.user.role === 'LEADER') {
        if (st.classId !== ctx.user.classId) {
          rejected.push(st.studentId);
          return;
        }
        if (ctx.user.groupId && st.groupId && st.groupId !== ctx.user.groupId) {
          rejected.push(st.studentId);
          return;
        }
      }
      var subjectName = String(raw.subjectName || '').trim();
      var dateStr = normalizeDate(String(raw.date || ''));
      if (!subjectName || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        rejected.push(st.studentId);
        return;
      }
      var normSt = normalizeStatusInput(raw.status);
      if (!normSt) {
        rejected.push(st.studentId);
        return;
      }
      var logId = String(raw.id || Utilities.getUuid()).trim();
      logUpserts.push({
        id: logId,
        submissionId: String(raw.submissionId || 'subm_' + logId.substring(0, 8)),
        homeworkId: String(raw.homeworkId || 'hw_' + st.classId + '_' + slug(subjectName) + '_' + dateStr.replace(/-/g, '')),
        studentId: st.studentId,
        studentName: st.fullName,
        classId: st.classId,
        groupId: st.groupId || ctx.user.groupId || '',
        subjectName: subjectName,
        date: dateStr,
        status: normSt,
        statusMn: STATUS_TO_MN[normSt] || 'хийгээгүй',
        comment: String(raw.comment || raw.leaderComment || '').substring(0, 1000),
        createdAt: raw.createdAt || nowIso,
        updatedAt: nowIso,
        updatedBy: ctx.user.username,
        deleted: false
      });
    });

    var res = { table: 'homework_log', written: 0, removed: 0, verified: false, rejected: rejected, skipped: [], adjusted: [], idMap: {} };
    var state = { students: studentMap };
    applyTableChange(ss, ctx, state, 'homework_log', logUpserts, [], false, res);
    if (typeof SpreadsheetApp.flush === 'function') SpreadsheetApp.flush();

    // Read-after-write баталгаажуулалт
    var verifyTable = openTable(ss, 'homework_log');
    var verifiedCount = 0;
    logUpserts.forEach(function (u) {
      if (verifyTable.byKey[u.id]) verifiedCount++;
    });

    var out = {
      success: verifiedCount === logUpserts.length,
      verified: verifiedCount === logUpserts.length,
      written: res.written,
      rejected: rejected,
      message: 'Даалгаврын гүйцэтгэл (' + verifiedCount + ' мөр) Sheet-д найдвартай хадгалагдлаа.'
    };
    saveIdempotency(requestId, out);
    return out;
  } finally {
    lock.releaseLock();
  }
}

/**
 * Багш хичээлийн хуваарь оруулах, засах, устгах тусгай функц (Даалгавар №2.2).
 */
function handleSaveSchedule(ss, ctx, item, deleteId, softDelete, requestId) {
  if (ctx.user.role !== 'TEACHER') {
    return fail('FORBIDDEN', 'Зөвхөн багш хичээлийн хуваарь оруулах, засах, устгах эрхтэй.');
  }
  var upsert = item ? [item] : [];
  var remove = deleteId ? [String(deleteId)] : [];
  return handleSync(
    ss,
    ctx,
    [{ table: 'Schedule', upsert: upsert, remove: remove, softDelete: softDelete !== false }],
    requestId
  );
}

function normalizeStatusInput(rawStatus) {
  var s = String(rawStatus || '').trim();
  if (!s) return 'NOT_DONE';
  var upper = s.toUpperCase();
  if (VALID_STATUSES.indexOf(upper) !== -1) return upper;
  var lower = s.toLowerCase();
  if (MN_STATUS_MAP[lower]) return MN_STATUS_MAP[lower];
  return '';
}

function applyTableChange(ss, ctx, state, tableName, upsert, remove, softDelete, res) {
  var schema = SCHEMA[tableName];
  var key = schema.key;
  var role = ctx.user.role;
  var table = openTable(ss, tableName);
  var pendingKeys = {};
  var nowIso = new Date().toISOString();

  var homeworkIndex = null;
  if (tableName === 'Submissions') {
    homeworkIndex = indexBy(rowsOf(ss, 'Homework'), 'homeworkId');
  }
  var subByPair = null;
  if (tableName === 'Submissions') {
    subByPair = {};
    table.items.forEach(function (it) {
      subByPair[it.obj.homeworkId + '\u0001' + it.obj.studentId] = it;
    });
  }

  var updates = [];
  var appends = [];
  var removals = [];
  var hwLogMirrorEntries = [];

  upsert.forEach(function (raw) {
    if (!raw || typeof raw !== 'object') {
      res.rejected.push('?');
      return;
    }
    var id = String(raw[key] === undefined || raw[key] === null ? '' : raw[key]).trim();
    if (!id) {
      if (tableName === 'homework_log' || tableName === 'Schedule') {
        id = Utilities.getUuid();
      } else {
        res.rejected.push('?');
        return;
      }
    }
    var obj = sanitizeRow(tableName, raw);
    obj[key] = id;
    var existing = table.byKey[id] || null;

    // Үүсгэсэн/зассан хугацаа болон оруулсан хэрэглэгчийн нэр
    if (schemaHasCol(tableName, 'createdAt') && !obj.createdAt) {
      obj.createdAt = (existing && existing.obj.createdAt) || nowIso;
    }
    if (schemaHasCol(tableName, 'updatedAt') && !obj.updatedAt) {
      obj.updatedAt = nowIso;
    }
    if (schemaHasCol(tableName, 'updatedBy')) {
      obj.updatedBy = ctx.user.username;
    }

    // ---------- Хүснэгт тус бүрийн дүрэм ба Validation ----------
    if (tableName === 'Submissions') {
      if (!obj.homeworkId || !obj.studentId) {
        res.rejected.push(id);
        return;
      }
      var pair = subByPair[obj.homeworkId + '\u0001' + obj.studentId];
      if (pair && (!existing || existing.rowNumber !== pair.rowNumber)) {
        res.idMap[id] = pair.obj.submissionId;
        existing = pair;
        id = pair.obj.submissionId;
        obj.submissionId = id;
      }
      var verdict = guardSubmission(ctx, state, homeworkIndex, existing, obj);
      if (verdict === 'reject') {
        res.rejected.push(id);
        return;
      }
      if (verdict === 'skip') {
        res.skipped.push(id);
        return;
      }
      if (!existing && !subByPair[obj.homeworkId + '\u0001' + obj.studentId]) {
        subByPair[obj.homeworkId + '\u0001' + obj.studentId] = { rowNumber: -1, obj: obj };
      }
      // `homework_log` sheet рүү давхар бичих мөрийг бэлтгэнэ
      var stObj = state.students[obj.studentId];
      var hwObj = homeworkIndex ? homeworkIndex[obj.homeworkId] : null;
      hwLogMirrorEntries.push({
        id: 'log_' + obj.submissionId,
        submissionId: obj.submissionId,
        homeworkId: obj.homeworkId,
        studentId: obj.studentId,
        studentName: stObj ? stObj.fullName : obj.studentId,
        classId: (stObj && stObj.classId) || (hwObj && hwObj.classId) || ctx.user.classId || '',
        groupId: (stObj && stObj.groupId) || ctx.user.groupId || '',
        subjectName: (hwObj && hwObj.subjectName) || '',
        date: (hwObj && hwObj.assignedDate) || nowIso.substring(0, 10),
        status: obj.status,
        statusMn: STATUS_TO_MN[obj.status] || obj.status,
        comment: obj.leaderComment || obj.teacherComment || obj.studentNote || '',
        createdAt: (existing && existing.obj.submittedAt) || obj.submittedAt || nowIso,
        updatedAt: obj.updatedAt || nowIso,
        updatedBy: ctx.user.username,
        deleted: false
      });
    } else if (tableName === 'Homework') {
      if (role === 'LEADER') {
        if (!obj.classId || obj.classId !== ctx.user.classId) {
          res.rejected.push(id);
          return;
        }
        if (existing && existing.obj.classId !== ctx.user.classId) {
          res.rejected.push(id);
          return;
        }
      }
      if (!obj.createdBy && !(existing && existing.obj.createdBy)) {
        obj.createdBy = ctx.user.userId;
      }
    } else if (tableName === 'Schedule') {
      if (role !== 'TEACHER') {
        res.rejected.push(id);
        return;
      }
      if (!obj.classId || !obj.subjectName) {
        res.rejected.push(id);
        return;
      }
    } else if (tableName === 'StudentData') {
      var sheetStudent = state.students[id];
      if (sheetStudent && isLoginStudent(ctx, id)) {
        if (
          (raw.fullName !== undefined && raw.fullName !== sheetStudent.fullName) ||
          (raw.classId !== undefined && raw.classId !== sheetStudent.classId) ||
          (raw.studentCode !== undefined && raw.studentCode !== sheetStudent.studentCode)
        ) {
          res.adjusted.push(id);
        }
        obj.fullName = '';
        obj.classId = '';
        obj.studentCode = '';
      }
    } else if (tableName === 'AuditLog') {
      if (existing) {
        res.skipped.push(id);
        return;
      }
      obj.userId = ctx.user.userId;
      obj.userName = ctx.user.displayName;
      obj.timestamp = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm:ss');
    }

    if (pendingKeys[id]) {
      var pk = pendingKeys[id];
      pk.obj = mergeObj(pk.obj, obj);
      return;
    }
    var entry = { item: existing && existing.rowNumber > 0 ? existing : null, obj: obj };
    pendingKeys[id] = entry;
    if (entry.item) updates.push(entry);
    else appends.push(entry);
  });

  remove.forEach(function (rid) {
    var id = String(rid);
    var existing = table.byKey[id];
    if (!existing) return;
    if (role !== 'TEACHER') {
      res.rejected.push(id);
      return;
    }
    if (tableName === 'AuditLog') {
      res.rejected.push(id);
      return;
    }
    if (softDelete && schemaHasCol(tableName, 'deleted')) {
      var softObj = mergeObj(existing.obj, {
        deleted: true,
        active: false,
        updatedAt: nowIso,
        updatedBy: ctx.user.username
      });
      updates.push({ item: existing, obj: softObj });
      res.removed++;
    } else {
      removals.push(existing.rowNumber);
    }
  });

  writeChanges(table, updates, appends, removals);
  res.written = updates.length + appends.length;
  res.removed += removals.length;

  // Read-after-write verification: бичсэн мөрүүд Sheet-д орсон эсэхийг шалгана
  var verifyTable = readTable(table.sheet, tableName);
  var allVerified = true;
  Object.keys(pendingKeys).forEach(function (k) {
    if (!verifyTable.byKey[k]) allVerified = false;
  });
  res.verified = allVerified;

  // Хэрэв Submissions шинэчлэгдсэн бол `homework_log` sheet рүү мөн sync хийнэ
  if (tableName === 'Submissions' && hwLogMirrorEntries.length > 0) {
    try {
      var logTable = openTable(ss, 'homework_log');
      var logUpdates = [];
      var logAppends = [];
      hwLogMirrorEntries.forEach(function (le) {
        var ex = logTable.byKey[le.id];
        if (ex && ex.rowNumber > 0) {
          logUpdates.push({ item: ex, obj: le });
        } else {
          logAppends.push({ item: null, obj: le });
        }
      });
      writeChanges(logTable, logUpdates, logAppends, []);
    } catch (e) {
      // homework_log тольдох үеийн алдаа үндсэн хадгалалтыг зогсоохгүй
    }
  }
}

function schemaHasCol(tableName, colName) {
  var cols = SCHEMA[tableName] ? SCHEMA[tableName].cols : [];
  for (var i = 0; i < cols.length; i++) {
    if (cols[i][0] === colName) return true;
  }
  return false;
}

function isLoginStudent(ctx, studentId) {
  for (var i = 0; i < ctx.accounts.length; i++) {
    if (ctx.accounts[i].studentId === studentId) return true;
  }
  return false;
}

function mergeObj(a, b) {
  var o = {};
  for (var k in a) o[k] = a[k];
  for (var j in b) if (b[j] !== undefined) o[j] = b[j];
  return o;
}

/**
 * Submissions-д эрхийн дүрэм ба шалгалт: 'ok' | 'reject' | 'skip'.
 * Ахлагч зөвхөн өөрийн анги бүлэг, өөрийн хэсгийн сурагчийн даалгаврыг бүртгэнэ.
 */
function guardSubmission(ctx, state, homeworkIndex, existing, obj) {
  var role = ctx.user.role;
  var old = existing ? existing.obj : null;

  if (obj.status) {
    var norm = normalizeStatusInput(obj.status);
    if (!norm) return 'reject';
    obj.status = norm;
  }

  if (role === 'STUDENT') {
    if (!ctx.user.studentId || obj.studentId !== ctx.user.studentId) return 'reject';
    var hw = homeworkIndex[obj.homeworkId];
    if (!hw || hw.classId !== ctx.user.classId) return 'reject';
    var now = new Date().toISOString();
    var safe = {
      submissionId: obj.submissionId,
      homeworkId: obj.homeworkId,
      studentId: obj.studentId,
      status: 'SUBMITTED_FOR_REVIEW',
      submittedAt: isIso(obj.submittedAt) ? obj.submittedAt : now,
      checkedBy: '',
      checkedAt: '',
      teacherComment: old ? old.teacherComment : '',
      leaderComment: old ? old.leaderComment : '',
      studentNote: obj.studentNote || '',
      studentAttachmentUrl: /^https?:\/\//i.test(obj.studentAttachmentUrl || '')
        ? obj.studentAttachmentUrl
        : '',
      updatedAt: isIso(obj.updatedAt) ? obj.updatedAt : now,
      updatedBy: ctx.user.username,
      deleted: false
    };
    if (old && isStale(old.updatedAt, safe.updatedAt)) return 'skip';
    replaceContents(obj, safe);
    return 'ok';
  }

  if (role === 'LEADER') {
    var st = state.students[obj.studentId];
    if (!st || st.classId !== ctx.user.classId) return 'reject';
    // Хэрэв ахлагч болон сурагч аль аль нь хэсэгт хуваарилагдсан бол зөвхөн өөрийн хэсгийг засна
    if (ctx.user.groupId && st.groupId && st.groupId !== ctx.user.groupId) {
      return 'reject';
    }
    if (old && old.checkedBy) return 'reject'; // багш баталгаажуулсныг ахлагч өөрчилж чадахгүй
    obj.checkedBy = '';
    obj.checkedAt = '';
    obj.teacherComment = old ? old.teacherComment : '';
    if (obj.status === 'SUBMITTED_FOR_REVIEW' && old && old.status !== 'SUBMITTED_FOR_REVIEW') {
      obj.status = old.status;
    }
  }

  if (obj.status && VALID_STATUSES.indexOf(obj.status) === -1) return 'reject';
  if (!isIso(obj.updatedAt)) obj.updatedAt = new Date().toISOString();
  if (old && isStale(old.updatedAt, obj.updatedAt)) return 'skip';
  return 'ok';
}

function replaceContents(target, src) {
  for (var k in target) delete target[k];
  for (var j in src) target[j] = src[j];
}

function isIso(s) {
  return typeof s === 'string' && s.length >= 10 && !isNaN(Date.parse(s));
}

function isStale(existingTs, incomingTs) {
  if (!isIso(existingTs) || !isIso(incomingTs)) return false;
  return Date.parse(incomingTs) < Date.parse(existingTs);
}

function indexBy(arr, key) {
  var m = {};
  arr.forEach(function (x) {
    m[x[key]] = x;
  });
  return m;
}

/** Зөвхөн схемд байгаа талбаруудыг төрлөөр нь цэвэрлэж авна. */
function sanitizeRow(tableName, raw) {
  var out = {};
  SCHEMA[tableName].cols.forEach(function (c) {
    var name = c[0],
      type = c[1];
    var v = raw[name];
    if (v === undefined) return;
    if (v === null) v = '';
    if (type === 'n') {
      if (v === '') out[name] = '';
      else {
        var n = Number(v);
        out[name] = isFinite(n) ? n : '';
      }
    } else if (type === 'b') {
      out[name] = v === true || String(v).toLowerCase() === 'true';
    } else if (type === 'd') {
      out[name] = normalizeDate(String(v));
    } else {
      var s = String(v);
      if (s.length > MAX_CELL_CHARS) s = s.substring(0, MAX_CELL_CHARS);
      out[name] = s;
    }
  });
  return out;
}

// ============================================================================
//  SHEET ТУСЛАХ ФУНКЦҮҮД & FORMULA INJECTION ХАМГААЛАЛТ
// ============================================================================

function openDb() {
  var id = PropertiesService.getScriptProperties().getProperty('SHEET_ID') || DEFAULT_SHEET_ID;
  return SpreadsheetApp.openById(id);
}

function reservedNames(ss) {
  var sheets = ss.getSheets();
  var out = {};
  if (!sheets || !sheets.length) return out;
  out[sheets[0].getName().toLowerCase()] = true;
  if (sheets.length >= 2 && !isSystemTableSheetName(sheets[1].getName())) {
    out[sheets[1].getName().toLowerCase()] = true;
  }
  return out;
}

function findExistingSheetCaseInsensitive(ss, targetName) {
  var exact = ss.getSheetByName(targetName);
  if (exact) return exact;
  var lower = targetName.toLowerCase();
  var sheets = ss.getSheets();
  for (var i = 0; i < sheets.length; i++) {
    if (sheets[i].getName().toLowerCase() === lower) {
      return sheets[i];
    }
  }
  return null;
}

function dbSheetName(ss, table) {
  return reservedNames(ss)[table.toLowerCase()] ? 'db_' + table : table;
}

function tableIfExists(ss, tableName) {
  var name = dbSheetName(ss, tableName);
  var sheet = findExistingSheetCaseInsensitive(ss, name);
  if (!sheet || reservedNames(ss)[sheet.getName().toLowerCase()]) return null;
  return readTable(sheet, tableName);
}

function openTable(ss, tableName) {
  var name = dbSheetName(ss, tableName);
  var sheet = findExistingSheetCaseInsensitive(ss, name);
  if (!sheet || reservedNames(ss)[sheet.getName().toLowerCase()]) {
    sheet = ss.insertSheet(name);
  }
  ensureHeaders(sheet, tableName);
  return readTable(sheet, tableName);
}

/** Толгойн мөр байхгүй/дутуу бол нөхнө. */
function ensureHeaders(sheet, tableName) {
  var cols = SCHEMA[tableName].cols;
  var lastCol = sheet.getLastColumn();
  var existing = [];
  if (sheet.getLastRow() >= 1 && lastCol >= 1) {
    existing = sheet
      .getRange(1, 1, 1, lastCol)
      .getValues()[0]
      .map(function (h) {
        return String(h).trim();
      });
  }
  var missing = cols
    .map(function (c) {
      return c[0];
    })
    .filter(function (n) {
      return existing.indexOf(n) === -1;
    });
  if (!missing.length) return;
  var startCol = existing.length ? lastCol + 1 : 1;
  var maxRows = Math.max(sheet.getMaxRows(), 2);
  var rng = sheet.getRange(1, startCol, maxRows, missing.length);
  rng.setNumberFormat('@');
  sheet
    .getRange(1, startCol, 1, missing.length)
    .setValues([missing])
    .setFontWeight('bold')
    .setBackground('#f1f5f9');
  if (sheet.getFrozenRows() < 1) sheet.setFrozenRows(1);
}

function readTable(sheet, tableName) {
  var cols = SCHEMA[tableName].cols;
  var key = SCHEMA[tableName].key;
  var table = {
    sheet: sheet,
    name: tableName,
    headers: [],
    idx: {},
    items: [],
    byKey: {},
    lastRow: sheet.getLastRow(),
    lastCol: sheet.getLastColumn()
  };
  if (table.lastRow < 1 || table.lastCol < 1) return table;

  var range = sheet.getRange(1, 1, table.lastRow, table.lastCol);
  var values = range.getValues();
  var headers = values[0].map(function (h) {
    return String(h).trim();
  });
  table.headers = headers;
  headers.forEach(function (h, i) {
    if (h && table.idx[h] === undefined) table.idx[h] = i;
  });

  var display = null;
  for (var r = 1; r < values.length; r++) {
    var row = values[r];
    var blank = true;
    for (var k = 0; k < row.length; k++) {
      if (row[k] !== '' && row[k] !== null && row[k] !== undefined) {
        blank = false;
        break;
      }
    }
    if (blank) continue;
    var obj = {};
    for (var c = 0; c < cols.length; c++) {
      var col = cols[c];
      var ci = table.idx[col[0]];
      var cell = ci === undefined ? '' : row[ci];
      if (cell instanceof Date && (col[1] === 't' || col[1] === 'd') && !display) {
        display = range.getDisplayValues();
      }
      var typed = parseCell(
        cell,
        col[1],
        col[2],
        display && ci !== undefined ? display[r][ci] : ''
      );
      if (typed !== undefined) obj[col[0]] = typed;
    }
    var id = String(obj[key] === undefined ? '' : obj[key]);
    if (!id) continue;
    var item = { rowNumber: r + 1, raw: row, obj: obj };
    table.items.push(item);
    if (!table.byKey[id]) table.byKey[id] = item;
  }
  return table;
}

function pad2(n) {
  return (n < 10 ? '0' : '') + n;
}

/**
 * Formula Injection-оос хамгаалах: `=`, `+`, `-`, `@`-ээр эхэлсэн текстийн өмнө `'` нэмнэ.
 * Уншихдаа `unescapeFormulaCell`-ээр буцаана.
 */
function escapeFormulaCell(str) {
  var s = String(str === undefined || str === null ? '' : str);
  if (/^[=+\-@]/.test(s)) {
    return "'" + s;
  }
  return s;
}

function unescapeFormulaCell(str) {
  var s = String(str === undefined || str === null ? '' : str);
  if (/^'[=+\-@]/.test(s)) {
    return s.substring(1);
  }
  return s;
}

function parseCell(cell, type, dflt, displayText) {
  var empty = cell === '' || cell === null || cell === undefined;
  if (type === 'n') {
    if (empty) return undefined;
    var n = Number(cell);
    return isFinite(n) ? n : undefined;
  }
  if (type === 'b') {
    if (empty) return dflt === true;
    if (cell === true || cell === false) return cell;
    var s = String(cell).trim().toLowerCase();
    return s === 'true' || s === '1' || s === 'yes' || s === 'тийм' || s === 'deleted';
  }
  if (empty) return '';
  if (type === 'd') {
    if (cell instanceof Date) return Utilities.formatDate(cell, TZ, 'yyyy-MM-dd');
    return normalizeDate(unescapeFormulaCell(String(cell)));
  }
  if (type === 't') {
    if (cell instanceof Date) return normalizeTime(displayText || '') || '';
    if (typeof cell === 'number') {
      var mins = Math.round(cell * 1440);
      return pad2(Math.floor(mins / 60) % 24) + ':' + pad2(mins % 60);
    }
    var rawT = unescapeFormulaCell(String(cell));
    return normalizeTime(rawT) || rawT.trim();
  }
  if (cell instanceof Date) return cell.toISOString();
  return unescapeFormulaCell(String(cell));
}

function normalizeDate(s) {
  s = String(s || '').trim();
  var m = /^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})/.exec(s);
  if (m) return m[1] + '-' + pad2(+m[2]) + '-' + pad2(+m[3]);
  return s;
}

function normalizeTime(s) {
  var m = /^(\d{1,2}):(\d{2})(?::\d{2})?\s*([AaPp][Mm])?$/.exec(String(s).trim());
  if (!m) return '';
  var h = +m[1];
  if (m[3]) {
    var pm = m[3].toLowerCase() === 'pm';
    if (pm && h < 12) h += 12;
    if (!pm && h === 12) h = 0;
  }
  return pad2(h) + ':' + m[2];
}

function serializeCell(type, value) {
  if (value === undefined || value === null) return '';
  if (type === 'n') return value === '' ? '' : String(Number(value));
  if (type === 'b') {
    return value === true || String(value).toLowerCase() === 'true' ? 'true' : 'false';
  }
  return escapeFormulaCell(String(value));
}

function buildRowValues(table, item, obj) {
  var width = Math.max(table.lastCol, table.headers.length);
  var vals = [];
  var cols = SCHEMA[table.name].cols;
  var colByName = {};
  cols.forEach(function (c) {
    colByName[c[0]] = c;
  });
  for (var i = 0; i < width; i++) {
    var h = table.headers[i];
    var c = h ? colByName[h] : null;
    if (c) {
      if (obj[h] !== undefined) vals.push(serializeCell(c[1], obj[h]));
      else if (item && item.obj[h] !== undefined) vals.push(serializeCell(c[1], item.obj[h]));
      else vals.push(c[1] === 'b' ? serializeCell('b', c[2] === true) : '');
    } else {
      vals.push(item && item.raw[i] !== undefined ? item.raw[i] : '');
    }
  }
  return vals;
}

/**
 * Бүх бичилтийг мөр бүрээр биш `setValues()` batch аргаар хийнэ.
 */
function writeChanges(table, updates, appends, removals) {
  var sheet = table.sheet;
  var width = Math.max(table.lastCol, table.headers.length);
  if (!width) return;

  // 1) Байгаа мөрүүдийг шинэчилнэ (дараалсан мөрүүдийг нэг setValues дуудлагаар)
  if (updates.length) {
    var sorted = updates.slice().sort(function (a, b) {
      return a.item.rowNumber - b.item.rowNumber;
    });
    var runs = [];
    sorted.forEach(function (u) {
      var last = runs[runs.length - 1];
      if (last && last.rows[last.rows.length - 1].item.rowNumber + 1 === u.item.rowNumber) {
        last.rows.push(u);
      } else {
        runs.push({ rows: [u] });
      }
    });
    runs.forEach(function (run) {
      var matrix = run.rows.map(function (u) {
        return buildRowValues(table, u.item, u.obj);
      });
      var rng = sheet.getRange(run.rows[0].item.rowNumber, 1, matrix.length, width);
      rng.setNumberFormat('@');
      rng.setValues(matrix);
    });
  }

  // 2) Шинэ мөрүүдийг төгсгөлд нь нэг batch setValues-аар нэмнэ
  if (appends.length) {
    var start = sheet.getLastRow() + 1;
    var need = start + appends.length - 1;
    if (need > sheet.getMaxRows()) {
      sheet.insertRowsAfter(sheet.getMaxRows(), need - sheet.getMaxRows() + 50);
    }
    var rows = appends.map(function (a) {
      return buildRowValues(table, null, a.obj);
    });
    var r2 = sheet.getRange(start, 1, rows.length, width);
    r2.setNumberFormat('@');
    r2.setValues(rows);
  }

  // 3) Устгал (доороос дээш)
  if (removals.length) {
    removals
      .sort(function (a, b) {
        return b - a;
      })
      .forEach(function (rn) {
        sheet.deleteRow(rn);
      });
  }
}

function safeAudit(ss, account, action, targetType, targetId, details) {
  try {
    var table = openTable(ss, 'AuditLog');
    var obj = {
      logId: 'log_' + Utilities.getUuid().substring(0, 8),
      userId: account.userId,
      userName: account.displayName,
      action: action,
      targetType: targetType,
      targetId: targetId,
      timestamp: Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm:ss'),
      details: details
    };
    var lock = LockService.getScriptLock();
    lock.waitLock(5000);
    try {
      var fresh = readTable(table.sheet, 'AuditLog');
      writeChanges(fresh, [], [{ obj: obj }], []);
    } finally {
      lock.releaseLock();
    }
  } catch (e) {
    // Аудитын алдаа нэвтрэлтийг тасалдуулахгүй
  }
}

// ============================================================================
//  ЭХНИЙ ТОХИРУУЛГА (Apps Script editor-оос гараар ажиллуулна)
// ============================================================================

/** Бүх өгөгдлийн tab-ыг (толгойн мөртэй, текст форматтай) бэлтгэнэ. `users` sheet-д хүрэхгүй. */
function initAllSheets() {
  var ss = openDb();
  TABLE_ORDER.forEach(function (t) {
    openTable(ss, t);
  });
  getSecret();
}

/** `users` sheet-ээс хэдэн хэрэглэгч уншигдаж байгааг шалгана (нууц үг харуулахгүй). */
function diagnose() {
  var ss = openDb();
  var res = syncUsersInternal(ss);
  Logger.log(res.message);
  if (res.duplicates && res.duplicates.length) {
    Logger.log('Анхаар — давхардсан нэвтрэх нэрс: ' + res.duplicates.join(', '));
  }
  Logger.log(
    'Tab-ууд: ' +
      ss
        .getSheets()
        .map(function (s) {
          return s.getName();
        })
        .join(', ')
  );
  return res;
}

// ============================================================================
//  ТУСЛАХ ФУНКЦҮҮД
// ============================================================================

function fail(code, message) {
  return { success: false, error: message, code: code };
}

function userError(message) {
  var e = new Error(message);
  e.userMessage = message;
  return e;
}

function serverError(err) {
  if (err && err.userMessage) return { success: false, error: err.userMessage, code: 'CONFIG' };
  return {
    success: false,
    error: 'Серверийн алдаа: ' + String(err && err.message ? err.message : err),
    code: 'SERVER',
    retryable: true
  };
}

function computeSha256(text) {
  var raw = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    String(text),
    Utilities.Charset.UTF_8
  );
  var out = '';
  for (var i = 0; i < raw.length; i++) {
    var b = raw[i];
    if (b < 0) b += 256;
    out += (b < 16 ? '0' : '') + b.toString(16);
  }
  return out;
}

function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(
    ContentService.MimeType.JSON
  );
}
