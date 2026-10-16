/**
 * ==============================================================================
 * ГЭРИЙН ДААЛГАВРЫН ГҮЙЦЭТГЭЛ ХЯНАХ ВЕБ АПП - GOOGLE APPS SCRIPT BACKEND
 * ==============================================================================
 * Энэхүү скрипт нь Google Sheets-ийг өгөгдлийн сан болгон ашиглаж,
 * Веб апптай аюулгүй REST API байдлаар харилцах боломжийг олгоно.
 *
 * СУУЛГАХ АЛХАМ:
 * 1. Google Drive дээр шинэ "Google Sheets" үүсгэнэ.
 * 2. Sheets цэснээс: Extensions -> Apps Script сонгоно.
 * 3. Энэ кодоо хуулж тавина.
 * 4. Deploy -> New deployment -> Select type: "Web app"
 * 5. Execute as: "Me"
 *    Who has access: "Anyone" (эсвэл тухайн сургуулийн домэйн)
 * 6. "Deploy" дарж гарч ирсэн Web App URL-ийг веб системийн тохиргоонд оруулна.
 * ==============================================================================
 */

// Баталгаажуулалтын Sheet-үүдийн нэрс
var SHEETS = {
  USERS: 'Users',
  STUDENTS: 'Students',
  SCHEDULE: 'Schedule',
  HOMEWORK: 'Homework',
  SUBMISSIONS: 'Submissions',
  LEADERS: 'Leaders',
  SETTINGS: 'Settings',
  AUDIT_LOG: 'AuditLog'
};

// Sheet тус бүрийн баганын толгой (Headers)
var SCHEMAS = {
  Users: ['userId', 'username', 'passwordHash', 'role', 'studentId', 'active', 'displayName', 'createdAt'],
  Students: ['studentId', 'studentCode', 'fullName', 'classId', 'active', 'publicDisplayName', 'showOnLeaderboard'],
  Schedule: ['scheduleId', 'classId', 'weekday', 'period', 'subjectId', 'subjectName', 'teacherName', 'startTime', 'endTime', 'active', 'notes'],
  Homework: ['homeworkId', 'classId', 'subjectId', 'subjectName', 'title', 'description', 'assignedDate', 'dueDate', 'createdBy', 'status', 'createdAt'],
  Submissions: ['submissionId', 'homeworkId', 'studentId', 'status', 'submittedAt', 'checkedBy', 'checkedAt', 'teacherComment', 'studentNote', 'updatedAt', 'leaderComment', 'studentAttachmentUrl'],
  Leaders: ['leaderId', 'userId', 'classId', 'assignedBy', 'active', 'createdAt'],
  Settings: ['settingKey', 'settingValue', 'updatedAt'],
  AuditLog: ['logId', 'userId', 'userName', 'action', 'targetType', 'targetId', 'timestamp', 'details']
};

/**
 * GET хүсэлт боловсруулах (Эрүүл мэндийн тест, олон нийтийн тэргүүлэгчид)
 */
function doGet(e) {
  try {
    var params = (e && e.parameter) || {};
    var action = params.action || 'ping';

    if (action === 'ping') {
      return jsonResponse({
        success: true,
        message: 'Google Apps Script API хэвийн ажиллаж байна.',
        timestamp: new Date().toISOString()
      });
    }

    if (action === 'publicLeaderboard') {
      var classId = params.classId || '';
      var data = getLeaderboardData(classId);
      return jsonResponse({ success: true, leaderboard: data });
    }

    return jsonResponse({ success: false, error: 'Үл мэдэгдэх үйлдэл: ' + action });
  } catch (err) {
    return jsonResponse({ success: false, error: err.toString() });
  }
}

/**
 * POST хүсэлт боловсруулах
 */
function doPost(e) {
  try {
    var body = {};
    if (e && e.postData && e.postData.contents) {
      body = JSON.parse(e.postData.contents);
    }
    var action = body.action;

    // 1. Анхны бүтцийг автоматаар үүсгэх
    if (action === 'initDatabase') {
      initAllSheets();
      return jsonResponse({ success: true, message: 'Google Sheets өгөгдлийн бүтэц амжилттай бэлтгэгдлээ.' });
    }

    // 2. Нэвтрэх
    if (action === 'login') {
      return handleLogin(body.username, body.password);
    }

    // Бусад бүх үйлдэлд токен болон эрх шалгана
    var authUser = verifyToken(body.token);
    if (!authUser) {
      return jsonResponse({ success: false, error: 'Нэвтрэх эрх хүчингүй эсвэл хугацаа дууссан байна.' }, 401);
    }

    // 3. Өгөгдөл татах (Бүх өгөгдлийг эрхийн дагуу шүүж өгнө)
    if (action === 'fetchAll') {
      return handleFetchAll(authUser);
    }

    // 4. Сурагч хадгалах / засах (Зөвхөн Багш)
    if (action === 'saveStudent') {
      if (authUser.role !== 'TEACHER') {
        return jsonResponse({ success: false, error: 'Эрх хүрэлцэхгүй. Зөвхөн багш сурагч удирдах боломжтой.' }, 403);
      }
      return handleSaveStudent(authUser, body.student);
    }

    // 5. Хичээлийн хуваарь хадгалах (Зөвхөн Багш)
    if (action === 'saveSchedule') {
      if (authUser.role !== 'TEACHER') {
        return jsonResponse({ success: false, error: 'Зөвхөн багш хичээлийн хуваарь өөрчлөх боломжтой.' }, 403);
      }
      return handleSaveSchedule(authUser, body.items);
    }

    // 6. Гэрийн даалгавар үүсгэх / засах (Зөвхөн Багш)
    if (action === 'saveHomework') {
      if (authUser.role !== 'TEACHER') {
        return jsonResponse({ success: false, error: 'Зөвхөн багш гэрийн даалгавар үүсгэх эрхтэй.' }, 403);
      }
      return handleSaveHomework(authUser, body.homework);
    }

    // 7. Даалгаврын гүйцэтгэл бүртгэх (Хэсгийн ахлагч эсвэл Багш)
    if (action === 'recordSubmissions') {
      return handleRecordSubmissions(authUser, body.submissions);
    }

    // 8. Багш шалгаж баталгаажуулах (Зөвхөн Багш)
    if (action === 'verifySubmission') {
      if (authUser.role !== 'TEACHER') {
        return jsonResponse({ success: false, error: 'Зөвхөн багш даалгаврыг баталгаажуулах эрхтэй.' }, 403);
      }
      return handleVerifySubmission(authUser, body.submissionId, body.status, body.comment);
    }

    // 9. Сурагч өөрөө даалгавраа илгээх (Зөвхөн тухайн сурагч)
    if (action === 'submitHomeworkSelf') {
      return handleSubmitSelf(authUser, body.homeworkId, body.note, body.attachmentUrl);
    }

    // 10. Ахлагч томилох / цуцлах (Зөвхөн Багш)
    if (action === 'assignLeader') {
      if (authUser.role !== 'TEACHER') {
        return jsonResponse({ success: false, error: 'Зөвхөн багш хэсгийн ахлагч томилох эрхтэй.' }, 403);
      }
      return handleAssignLeader(authUser, body.studentId, body.classId, body.active);
    }

    return jsonResponse({ success: false, error: 'Тодорхойгүй хүсэлт: ' + action });
  } catch (err) {
    return jsonResponse({ success: false, error: 'Серверийн алдаа: ' + err.toString() });
  }
}

/**
 * Нэвтрэх үйлдэл
 */
function handleLogin(username, password) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEETS.USERS);
  if (!sheet) {
    return jsonResponse({ success: false, error: 'Өгөгдлийн сангийн Users хүснэгт олдсонгүй. Эхлээд бүтцийг бэлтгэнэ үү.' });
  }

  var data = getSheetDataAsObjects(sheet);
  var hash = computeSha256(password);
  
  for (var i = 0; i < data.length; i++) {
    var u = data[i];
    if (u.username === username && (u.passwordHash === hash || u.passwordHash === password) && String(u.active) === 'true') {
      var tokenPayload = {
        userId: u.userId,
        username: u.username,
        role: u.role,
        studentId: u.studentId || '',
        displayName: u.displayName,
        exp: new Date().getTime() + (24 * 60 * 60 * 1000) // 24 цаг
      };
      var token = Utilities.base64Encode(JSON.stringify(tokenPayload));
      
      logAudit(u.userId, u.displayName, 'LOGIN', 'USER', u.userId, 'Хэрэглэгч системд амжилттай нэвтэрлээ.');

      return jsonResponse({
        success: true,
        token: token,
        user: {
          userId: u.userId,
          username: u.username,
          role: u.role,
          studentId: u.studentId,
          displayName: u.displayName,
          active: true
        }
      });
    }
  }

  return jsonResponse({ success: false, error: 'Нэвтрэх нэр эсвэл нууц үг буруу байна.' });
}

/**
 * Токен шалгах
 */
function verifyToken(token) {
  if (!token) return null;
  try {
    var jsonStr = Utilities.newBlob(Utilities.base64Decode(token)).getDataAsString();
    var payload = JSON.parse(jsonStr);
    if (payload.exp && payload.exp < new Date().getTime()) {
      return null;
    }
    return payload;
  } catch (e) {
    return null;
  }
}

/**
 * Бүх өгөгдлийг татаж аюулгүй байдлын дагуу буцаах
 */
function handleFetchAll(authUser) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  
  var students = getSheetDataAsObjects(ss.getSheetByName(SHEETS.STUDENTS));
  var schedule = getSheetDataAsObjects(ss.getSheetByName(SHEETS.SCHEDULE));
  var homework = getSheetDataAsObjects(ss.getSheetByName(SHEETS.HOMEWORK));
  var submissions = getSheetDataAsObjects(ss.getSheetByName(SHEETS.SUBMISSIONS));
  var leaders = getSheetDataAsObjects(ss.getSheetByName(SHEETS.LEADERS));
  var auditLogs = [];

  if (authUser.role === 'TEACHER') {
    auditLogs = getSheetDataAsObjects(ss.getSheetByName(SHEETS.AUDIT_LOG));
  } else if (authUser.role === 'LEADER') {
    // Ахлагч зөвхөн өөрийн ангийн сурагчид, хуваарь, даалгаврыг харна
    var myLeaderRecord = leaders.find(function(l) { return l.userId === authUser.userId && String(l.active) === 'true'; });
    var allowedClass = myLeaderRecord ? myLeaderRecord.classId : '';
    students = students.filter(function(s) { return s.classId === allowedClass; });
    schedule = schedule.filter(function(sch) { return sch.classId === allowedClass; });
    homework = homework.filter(function(h) { return h.classId === allowedClass; });
    var studentIds = students.map(function(s) { return s.studentId; });
    submissions = submissions.filter(function(sub) { return studentIds.indexOf(sub.studentId) !== -1; });
  } else if (authUser.role === 'STUDENT') {
    // Сурагч зөвхөн өөрийн сурагчийн мэдээлэл болон ангийн хуваарийг харна
    var me = students.find(function(s) { return s.studentId === authUser.studentId; });
    var myClass = me ? me.classId : '';
    students = students.filter(function(s) { return s.studentId === authUser.studentId; });
    schedule = schedule.filter(function(sch) { return sch.classId === myClass; });
    homework = homework.filter(function(h) { return h.classId === myClass; });
    submissions = submissions.filter(function(sub) { return sub.studentId === authUser.studentId; });
  }

  return jsonResponse({
    success: true,
    data: {
      students: students,
      schedule: schedule,
      homework: homework,
      submissions: submissions,
      leaders: leaders,
      auditLogs: auditLogs
    }
  });
}

/**
 * Сурагч нэмэх / засах
 */
function handleSaveStudent(authUser, student) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEETS.STUDENTS);
  var studentId = student.studentId || ('std_' + Utilities.getUuid().substring(0, 8));
  student.studentId = studentId;

  upsertRow(sheet, 'studentId', studentId, student, SCHEMAS.Students);
  logAudit(authUser.userId, authUser.displayName, 'SAVE_STUDENT', 'STUDENT', studentId, 'Сурагчийн мэдээлэл хадгалав: ' + student.fullName);

  return jsonResponse({ success: true, studentId: studentId });
}

/**
 * Хичээлийн хуваарь шинэчлэх
 */
function handleSaveSchedule(authUser, items) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEETS.SCHEDULE);
  
  // Хэрэв тодорхой ангийн хуваарь ирсэн бол тухайн ангийн мөрүүдийг шинэчилнэ
  for (var i = 0; i < items.length; i++) {
    var item = items[i];
    if (!item.scheduleId) {
      item.scheduleId = 'sch_' + Utilities.getUuid().substring(0, 8);
    }
    upsertRow(sheet, 'scheduleId', item.scheduleId, item, SCHEMAS.Schedule);
  }

  logAudit(authUser.userId, authUser.displayName, 'UPDATE_SCHEDULE', 'SCHEDULE', 'MULTIPLE', 'Хичээлийн хуваарь шинэчлэгдлээ.');
  return jsonResponse({ success: true });
}

/**
 * Гэрийн даалгавар хадгалах
 */
function handleSaveHomework(authUser, hw) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEETS.HOMEWORK);
  var hwId = hw.homeworkId || ('hw_' + Utilities.getUuid().substring(0, 8));
  hw.homeworkId = hwId;
  hw.createdBy = authUser.userId;
  if (!hw.createdAt) hw.createdAt = new Date().toISOString();

  upsertRow(sheet, 'homeworkId', hwId, hw, SCHEMAS.Homework);
  logAudit(authUser.userId, authUser.displayName, 'SAVE_HOMEWORK', 'HOMEWORK', hwId, 'Даалгавар бүртгэв: ' + hw.title);

  return jsonResponse({ success: true, homeworkId: hwId });
}

/**
 * Даалгаврын гүйцэтгэл бөөнөөр бүртгэх (Хэсгийн ахлагч)
 */
function handleRecordSubmissions(authUser, submissions) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEETS.SUBMISSIONS);
  
  for (var i = 0; i < submissions.length; i++) {
    var sub = submissions[i];
    if (!sub.submissionId) {
      sub.submissionId = 'subm_' + Utilities.getUuid().substring(0, 8);
    }
    sub.updatedAt = new Date().toISOString();
    upsertRow(sheet, 'submissionId', sub.submissionId, sub, SCHEMAS.Submissions);
  }

  logAudit(authUser.userId, authUser.displayName, 'RECORD_SUBMISSIONS', 'SUBMISSION', 'BATCH', submissions.length + ' сурагчийн гүйцэтгэл бүртгэгдлээ.');
  return jsonResponse({ success: true, count: submissions.length });
}

/**
 * Багш даалгаврыг баталгаажуулах
 */
function handleVerifySubmission(authUser, submissionId, status, comment) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEETS.SUBMISSIONS);
  
  var existing = findRow(sheet, 'submissionId', submissionId);
  if (!existing) {
    return jsonResponse({ success: false, error: 'Бүртгэл олдсонгүй.' });
  }

  var updated = existing.data;
  updated.status = status;
  updated.checkedBy = authUser.userId;
  updated.checkedAt = new Date().toISOString();
  updated.teacherComment = comment || updated.teacherComment || '';
  updated.updatedAt = new Date().toISOString();

  updateRow(sheet, existing.rowNumber, updated, SCHEMAS.Submissions);
  logAudit(authUser.userId, authUser.displayName, 'VERIFY_SUBMISSION', 'SUBMISSION', submissionId, 'Багш шалгаж төлөвийг ' + status + ' болгов.');

  return jsonResponse({ success: true });
}

/**
 * Сурагч өөрөө даалгавар илгээх
 */
function handleSubmitSelf(authUser, homeworkId, note, attachmentUrl) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEETS.SUBMISSIONS);
  
  var data = getSheetDataAsObjects(sheet);
  var found = data.find(function(s) { return s.homeworkId === homeworkId && s.studentId === authUser.studentId; });

  var submissionId = found ? found.submissionId : ('subm_' + Utilities.getUuid().substring(0, 8));
  var sub = {
    submissionId: submissionId,
    homeworkId: homeworkId,
    studentId: authUser.studentId,
    status: 'SUBMITTED_FOR_REVIEW',
    submittedAt: new Date().toISOString(),
    studentNote: note || '',
    studentAttachmentUrl: attachmentUrl || '',
    updatedAt: new Date().toISOString()
  };

  upsertRow(sheet, 'submissionId', submissionId, sub, SCHEMAS.Submissions);
  logAudit(authUser.userId, authUser.displayName, 'SUBMIT_SELF', 'SUBMISSION', submissionId, 'Сурагч даалгавраа шалгуулахаар илгээлээ.');

  return jsonResponse({ success: true, submissionId: submissionId });
}

/**
 * Хэсгийн ахлагч томилох
 */
function handleAssignLeader(authUser, studentId, classId, active) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var leadersSheet = ss.getSheetByName(SHEETS.LEADERS);
  var usersSheet = ss.getSheetByName(SHEETS.USERS);

  // Хэрэглэгчийн эрхийг LEADER болгох
  var users = getSheetDataAsObjects(usersSheet);
  var user = users.find(function(u) { return u.studentId === studentId; });
  if (user) {
    user.role = active ? 'LEADER' : 'STUDENT';
    upsertRow(usersSheet, 'userId', user.userId, user, SCHEMAS.Users);
  }

  var leaderRecord = {
    leaderId: 'lead_' + Utilities.getUuid().substring(0, 8),
    userId: user ? user.userId : '',
    classId: classId,
    assignedBy: authUser.userId,
    active: active,
    createdAt: new Date().toISOString()
  };

  upsertRow(leadersSheet, 'userId', user ? user.userId : '', leaderRecord, SCHEMAS.Leaders);
  logAudit(authUser.userId, authUser.displayName, 'ASSIGN_LEADER', 'LEADER', studentId, 'Хэсгийн ахлагчийн эрхийг ' + (active ? 'олгов' : 'цуцлав'));

  return jsonResponse({ success: true });
}

/**
 * Анхны бүтцийг автоматаар үүсгэх туслах функц
 */
function initAllSheets() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  for (var name in SCHEMAS) {
    var sheet = ss.getSheetByName(name);
    if (!sheet) {
      sheet = ss.insertSheet(name);
    }
    // Хоосон хүснэгтэд гарчиг бичих; хуучин хүснэгтэд шинэ багануудыг
    // өгөгдөлд хүрэлгүйгээр баруун талд нэмж schema-г урагш нийцүүлэх.
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(SCHEMAS[name]);
      sheet.getRange(1, 1, 1, SCHEMAS[name].length).setFontWeight('bold').setBackground('#f1f5f9');
    } else {
      var currentHeaders = sheet.getRange(1, 1, 1, Math.max(1, sheet.getLastColumn())).getValues()[0]
        .map(function(value) { return String(value || '').trim(); });
      var missingHeaders = SCHEMAS[name].filter(function(header) {
        return currentHeaders.indexOf(header) === -1;
      });
      if (missingHeaders.length > 0) {
        var firstNewColumn = sheet.getLastColumn() + 1;
        sheet.getRange(1, firstNewColumn, 1, missingHeaders.length).setValues([missingHeaders]);
        sheet.getRange(1, firstNewColumn, 1, missingHeaders.length).setFontWeight('bold').setBackground('#f1f5f9');
      }
    }
  }
}

/**
 * Тэргүүлэгчдийн самбарын өгөгдөл тооцоолох
 */
function getLeaderboardData(classId) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var students = getSheetDataAsObjects(ss.getSheetByName(SHEETS.STUDENTS));
  var homework = getSheetDataAsObjects(ss.getSheetByName(SHEETS.HOMEWORK));
  var submissions = getSheetDataAsObjects(ss.getSheetByName(SHEETS.SUBMISSIONS));

  if (classId) {
    students = students.filter(function(s) { return s.classId === classId; });
    homework = homework.filter(function(h) { return h.classId === classId; });
  }

  var activeHwCount = homework.filter(function(h) { return h.status === 'ACTIVE'; }).length;

  var results = [];
  for (var i = 0; i < students.length; i++) {
    var s = students[i];
    if (String(s.active) !== 'true' || String(s.showOnLeaderboard) !== 'true') continue;

    var mySubs = submissions.filter(function(sub) { return sub.studentId === s.studentId; });
    var completedCount = mySubs.filter(function(sub) { return sub.status === 'DONE'; }).length;
    var onTimeCount = mySubs.filter(function(sub) { return sub.status === 'DONE'; }).length; // Хугацаандаа

    var rate = activeHwCount > 0 ? Math.round((completedCount / activeHwCount) * 100) : 0;

    results.push({
      studentId: s.studentId,
      publicDisplayName: s.publicDisplayName || s.fullName.split(' ')[0],
      classId: s.classId,
      completionRate: rate,
      totalCompleted: completedCount,
      onTimeCompleted: onTimeCount,
      totalAssigned: activeHwCount
    });
  }

  // Эрэмбэлэх: 1) Гүйцэтгэлийн хувь, 2) Нийт гүйцэтгэсэн тоо, 3) Хугацаандаа
  results.sort(function(a, b) {
    if (b.completionRate !== a.completionRate) return b.completionRate - a.completionRate;
    if (b.totalCompleted !== a.totalCompleted) return b.totalCompleted - a.totalCompleted;
    return b.onTimeCompleted - a.onTimeCompleted;
  });

  return results.slice(0, 5).map(function(item, idx) {
    item.rank = idx + 1;
    return item;
  });
}

/**
 * AuditLog-д бичих туслах функц
 */
function logAudit(userId, userName, action, targetType, targetId, details) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(SHEETS.AUDIT_LOG);
    if (!sheet) return;

    var logId = 'log_' + Utilities.getUuid().substring(0, 8);
    var timestamp = Utilities.formatDate(new Date(), 'Asia/Ulaanbaatar', 'yyyy-MM-dd HH:mm:ss');
    sheet.appendRow([logId, userId, userName, action, targetType, targetId, timestamp, details]);
  } catch (e) {
    // Audit log алдаа гарсан ч үндсэн процессийг таслахгүй
  }
}

/**
 * Sheets өгөгдлийг JSON Object массив болгох
 */
function getSheetDataAsObjects(sheet) {
  if (!sheet || sheet.getLastRow() <= 1) return [];
  var range = sheet.getDataRange();
  var values = range.getValues();
  var headers = values[0];
  var results = [];

  for (var i = 1; i < values.length; i++) {
    var row = values[i];
    // Skip empty row! ("зөвхөн мэдээллүүдийг бөглөсөн хэсгээс систем уншина")
    var hasData = false;
    for (var k = 0; k < row.length; k++) {
      if (row[k] !== '' && row[k] !== null && row[k] !== undefined) {
        hasData = true;
        break;
      }
    }
    if (!hasData) continue;

    var obj = {};
    for (var j = 0; j < headers.length; j++) {
      obj[headers[j]] = row[j];
    }
    results.push(obj);
  }
  return results;
}

/**
 * Нэг мөрийг хайж олох
 */
function findRow(sheet, keyColumn, keyValue) {
  if (!sheet || sheet.getLastRow() <= 1) return null;
  var values = sheet.getDataRange().getValues();
  var headers = values[0];
  var colIdx = headers.indexOf(keyColumn);
  if (colIdx === -1) return null;

  for (var i = 1; i < values.length; i++) {
    if (String(values[i][colIdx]) === String(keyValue)) {
      var obj = {};
      for (var j = 0; j < headers.length; j++) {
        obj[headers[j]] = values[i][j];
      }
      return { rowNumber: i + 1, data: obj };
    }
  }
  return null;
}

/**
 * Мөрийг шинэчлэх эсвэл шинээр нэмэх (Upsert)
 */
function upsertRow(sheet, keyColumn, keyValue, dataObj, schemaHeaders) {
  var existing = findRow(sheet, keyColumn, keyValue);
  var rowValues = [];
  for (var i = 0; i < schemaHeaders.length; i++) {
    var key = schemaHeaders[i];
    rowValues.push(dataObj[key] !== undefined ? dataObj[key] : '');
  }

  if (existing) {
    sheet.getRange(existing.rowNumber, 1, 1, rowValues.length).setValues([rowValues]);
  } else {
    sheet.appendRow(rowValues);
  }
}

function updateRow(sheet, rowNumber, dataObj, schemaHeaders) {
  var rowValues = [];
  for (var i = 0; i < schemaHeaders.length; i++) {
    var key = schemaHeaders[i];
    rowValues.push(dataObj[key] !== undefined ? dataObj[key] : '');
  }
  sheet.getRange(rowNumber, 1, 1, rowValues.length).setValues([rowValues]);
}

/**
 * Нууц үгийг SHA-256-аар хэшлэх
 */
function computeSha256(text) {
  var rawHash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, text, Utilities.Charset.UTF_8);
  var txtHash = '';
  for (var i = 0; i < rawHash.length; i++) {
    var hashVal = rawHash[i];
    if (hashVal < 0) hashVal += 256;
    var byteStr = hashVal.toString(16);
    if (byteStr.length === 1) byteStr = '0' + byteStr;
    txtHash += byteStr;
  }
  return txtHash;
}

/**
 * Стандарт JSON хариу буцаах
 */
function jsonResponse(data, statusCode) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
