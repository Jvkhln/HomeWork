const assert = require('assert');
const { makeEnv } = require('./harness.cjs');

let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log('  ok  ' + name); } catch (e) { console.error('  FAIL ' + name + '\n     ' + e.message); process.exitCode = 1; } };

function fresh() {
  return makeEnv([
    ['Багш', [['Нэвтрэх нэр', 'Нууц үг', 'Нэр', 'Эрх'], ['teacher1', 'pw-teacher', 'Багш Энхжаргал', 'TEACHER'], ['', '', '', ''], ['t2', '', 'No pass', 'TEACHER']]],
    ['Сурагч', [['Нэвтрэх нэр', 'Нууц үг', 'Овог нэр', 'Анги', 'Код'],
      ['10A-01', '1234', 'Бат Болд', '10А', '10A-01'],
      ['10A-02', 'a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3', 'Сараа Нандин', '10А', '10A-02'],   // sha256('123')
      ['10A-03', 'x3', 'Төгс Мөнх', '10А', '10A-03'],
      ['10B-01', 'y', 'Дорж Гэрэл', '10Б', '10B-01']]],
  ]);
}
const login = (env, u, p) => env.post({ action: 'login', username: u, password: p });
const sync = (env, token, changes) => env.post({ action: 'sync', token, changes });
const fetchAll = (env, token) => env.post({ action: 'fetchAll', token });

console.log('Нэвтрэлт');
const env = fresh();
t('багш зөв нууц үгээр нэвтэрнэ', () => { const r = login(env, 'teacher1', 'pw-teacher'); assert(r.success && r.user.role === 'TEACHER' && r.token); });
t('буруу нууц үг татгалзана', () => assert.strictEqual(login(env, 'teacher1', 'nope').success, false));
t('нууц үггүй мөр нэвтэрч чадахгүй', () => assert.strictEqual(login(env, 't2', '').success, false));
t('сурагч энгийн текст нууц үгээр нэвтэрнэ', () => { const r = login(env, '10A-01', '1234'); assert(r.success && r.user.role === 'STUDENT' && r.user.studentId); });
t('SHA-256 хэш нууц үг дэмжинэ', () => assert(login(env, '10A-02', '123').success));
t('5 буруу оролдлогын дараа түгжинэ', () => { for (let i = 0; i < 5; i++) login(env, '10A-03', 'bad'); const r = login(env, '10A-03', 'x3'); assert(!r.success && /түр хаагдлаа/.test(r.error)); });
t('хуурамч токен татгалзана', () => { const r = fetchAll(env, 'eyJ1aWQiOiJ1X3RlYWNoZXIxIiwiZXhwIjo5OTk5OTk5OTk5OTk5fQ.AAAA'); assert(!r.success && r.code === 'AUTH'); });
t('нууц үг fetch хариунд гардаггүй', () => { const tk = login(env, 'teacher1', 'pw-teacher').token; const raw = JSON.stringify(fetchAll(env, tk)); assert(!/pw-teacher|1234/.test(raw)); });
t('эхний 2 sheet хэзээ ч өөрчлөгдөхгүй', () => { assert.strictEqual(env.sheets[0].cells.length, 4); assert.strictEqual(env.sheets[1].getLastColumn(), 5); });

console.log('Хадгалалт ба буцаан татах');
const E = fresh();
const T = login(E, 'teacher1', 'pw-teacher').token;
const S1 = login(E, '10A-01', '1234').token;
const hw = { homeworkId: 'hw_1', classId: '10А', subjectId: 'sub_math', subjectName: 'Математик', title: 'Бодлого 1-5', description: 'Х.12', assignedDate: '2026-10-14', dueDate: '2026-10-16', createdBy: 'u_teacher1', status: 'ACTIVE', createdAt: '2026-10-14T01:00:00.000Z' };
const sch = { scheduleId: 'sch_1', classId: '10А', weekday: 2, period: 3, subjectId: 'sub_math', subjectName: 'Математик', teacherName: 'Б', startTime: '09:45', endTime: '10:30', active: true, notes: '=SUM(1)' };
t('багш хуваарь + даалгавар хадгална', () => { const r = sync(E, T, [{ table: 'Schedule', upsert: [sch] }, { table: 'Homework', upsert: [hw] }]); assert(r.success, JSON.stringify(r)); assert.strictEqual(r.results[0].written, 1); });
t('огноо/цаг/boolean/тоо төрлөө хадгална (Sheets хөрвүүлсэн ч)', () => {
  const d = fetchAll(E, T).data;
  assert.strictEqual(d.homework[0].assignedDate, '2026-10-14');
  assert.strictEqual(d.schedule[0].startTime, '09:45'); assert.strictEqual(d.schedule[0].weekday, 2);
  assert.strictEqual(d.schedule[0].active, true); assert.strictEqual(d.schedule[0].notes, '=SUM(1)');
});
t('upsert мөрийг давхардуулдаггүй', () => { sync(E, T, [{ table: 'Homework', upsert: [{ ...hw, title: 'Шинэчилсэн' }] }]); const d = fetchAll(E, T).data; assert.strictEqual(d.homework.length, 1); assert.strictEqual(d.homework[0].title, 'Шинэчилсэн'); });
t('legacy sheet (Date хөрвүүлэлттэй) зөв уншигдана', () => {
  const E2 = makeEnv([['A', [['username', 'password'], ['t', 'p']]], ['B', [['username', 'password'], ['s', 'p']]],
    ['Homework', [['homeworkId', 'classId', 'title', 'assignedDate', 'status']]]]);
  const hsheet = E2.ss.getSheetByName('Homework');
  hsheet.getRange(2, 1, 1, 5).setNumberFormat('General'); // текст биш формат
  hsheet._set(2, 1, 'hw_old'); hsheet._set(2, 2, '10А'); hsheet._set(2, 3, 'Хуучин'); hsheet._set(2, 4, '2026-09-01'); hsheet._set(2, 5, 'ACTIVE');
  assert(hsheet.cells[1][3] instanceof Date);
  const tk = login(E2, 't', 'p').token; const d = fetchAll(E2, tk).data;
  assert.strictEqual(d.homework[0].assignedDate, '2026-09-01'); assert(d.homework[0].subjectName === '');
});
t('устгах', () => { sync(E, T, [{ table: 'Schedule', remove: ['sch_1'] }]); assert.strictEqual(fetchAll(E, T).data.schedule.length, 0); });
t('сурагчийн мэдээлэл: хэсэг, ахлагч хадгалагдана', () => {
  const d0 = fetchAll(E, T).data; const st = d0.students.find(s => s.studentCode === '10A-01');
  assert.strictEqual(st.classId, '10А'); assert.strictEqual(d0.students.length, 4);
  sync(E, T, [
    { table: 'Groups', upsert: [{ groupId: 'grp_10А_1', classId: '10А', groupNumber: 1, name: '1-р хэсэг', leaderStudentId: st.studentId, leaderName: st.fullName, color: 'blue' }] },
    { table: 'StudentData', upsert: [{ ...st, groupId: 'grp_10А_1', groupNumber: 1, groupName: '1-р хэсэг', isLeader: true }] },
  ]);
  const d1 = fetchAll(E, T).data; const s1 = d1.students.find(s => s.studentId === st.studentId);
  assert(s1.isLeader && s1.groupName === '1-р хэсэг' && s1.fullName === 'Бат Болд');
  assert.strictEqual(d1.groups.length, 1);
  // sheet-ээс ирсэн нэр overlay-д давхар хадгалагдаагүй
  const row = E.ss.getSheetByName('StudentData').cells[1]; assert(!row.includes('Бат Болд'));
  // Нэвтрэхэд ахлагч болсон
  const r = login(E, '10A-01', '1234'); assert.strictEqual(r.user.role, 'LEADER');
});

console.log('Эрх');
const L = login(E, '10A-01', '1234').token; // ахлагч
const S2 = login(E, '10A-02', '123').token;
const stu = id => fetchAll(E, T).data.students.find(s => s.studentCode === id).studentId;
const sub = (hwId, sid, status, extra = {}) => ({ submissionId: 'sm_' + Math.random().toString(36).slice(2, 8), homeworkId: hwId, studentId: sid, status, updatedAt: new Date().toISOString(), ...extra });
t('ахлагч өөрийн ангийн үнэлгээ бичнэ', () => { const r = sync(E, L, [{ table: 'Submissions', upsert: [sub('hw_1', stu('10A-02'), 'EXCELLENT')] }]); assert.strictEqual(r.results[0].written, 1, JSON.stringify(r)); });
t('ахлагч өөр ангийн сурагчид бичиж чадахгүй', () => { const r = sync(E, L, [{ table: 'Submissions', upsert: [sub('hw_1', stu('10B-01'), 'EXCELLENT')] }]); assert.strictEqual(r.results[0].rejected.length, 1); });
t('ахлагч Schedule/Groups өөрчилж чадахгүй', () => { const r = sync(E, L, [{ table: 'Schedule', upsert: [sch] }, { table: 'Groups', remove: ['grp_10А_1'] }]); assert(r.results.every(x => x.written === 0 && x.removed === 0)); assert.strictEqual(fetchAll(E, T).data.groups.length, 1); });
t('ижил (даалгавар,сурагч)-д өөр ID-тай ирвэл давхардахгүй', () => { sync(E, L, [{ table: 'Submissions', upsert: [sub('hw_1', stu('10A-02'), 'AVERAGE')] }]); const subs = fetchAll(E, T).data.submissions.filter(s => s.studentId === stu('10A-02')); assert.strictEqual(subs.length, 1); assert.strictEqual(subs[0].status, 'AVERAGE'); });
t('багш баталгаажуулсныг ахлагч дарж чадахгүй', () => { const ex = fetchAll(E, T).data.submissions[0]; sync(E, T, [{ table: 'Submissions', upsert: [{ ...ex, status: 'EXCELLENT', checkedBy: 'u_teacher1', checkedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }] }]);
  const r = sync(E, L, [{ table: 'Submissions', upsert: [sub('hw_1', ex.studentId, 'NOT_DONE')] }]); assert.strictEqual(r.results[0].rejected.length, 1); assert.strictEqual(fetchAll(E, T).data.submissions[0].status, 'EXCELLENT'); });
t('хуучин updatedAt-тай бичилт алгасагдана (stale)', () => { const ex = fetchAll(E, T).data.submissions[0]; const r = sync(E, T, [{ table: 'Submissions', upsert: [{ ...ex, status: 'NOT_DONE', updatedAt: '2000-01-01T00:00:00.000Z' }] }]); assert.strictEqual(r.results[0].skipped.length, 1); assert.strictEqual(fetchAll(E, T).data.submissions[0].status, 'EXCELLENT'); });
t('сурагч өөрөө илгээнэ, status хуурч чадахгүй', () => { const me = fetchAll(E, S2).data; const r = sync(E, S2, [{ table: 'Submissions', upsert: [sub('hw_1', stu('10A-02'), 'EXCELLENT', { studentNote: 'хийлээ', checkedBy: 'u_teacher1' })] }]); assert.strictEqual(r.results[0].written, 1); const s = fetchAll(E, S2).data.submissions; assert.strictEqual(s[0].status, 'SUBMITTED_FOR_REVIEW'); assert.strictEqual(s[0].studentNote, 'хийлээ'); });
t('сурагч бусдын нэрээр бичиж чадахгүй', () => { const r = sync(E, S2, [{ table: 'Submissions', upsert: [sub('hw_1', stu('10A-01'), 'EXCELLENT')] }]); assert.strictEqual(r.results[0].rejected.length, 1); });
t('сурагч зөвхөн өөрийн үнэлгээг татна', () => { const d = fetchAll(E, S2).data; assert(d.submissions.every(s => s.studentId === stu('10A-02'))); assert.strictEqual(d.auditLogs.length, 0); });
t('өөр ангийн хэрэглэгч 10А-ийн даалгаврыг харахгүй', () => { const B = login(E, '10B-01', 'y').token; const d = fetchAll(E, B).data; assert.strictEqual(d.homework.length, 0); assert(d.students.every(s => s.classId === '10Б')); });
t('AuditLog-ийн userId хуурч болохгүй', () => { sync(E, S2, [{ table: 'AuditLog', upsert: [{ logId: 'log_x', userId: 'u_teacher1', userName: 'x', action: 'FAKE', targetType: 'X', targetId: 'x', timestamp: 'now', details: '' }] }]); const a = fetchAll(E, T).data.auditLogs.find(l => l.logId === 'log_x'); assert.notStrictEqual(a.userId, 'u_teacher1'); });
t('нийтийн самбар нууц мэдээлэлгүй', () => { const p = E.get({ action: 'publicSnapshot' }); const raw = JSON.stringify(p); assert(p.success && !/Бат Болд|Сараа Нандин/.test(raw.replace(/"publicDisplayName":"[^"]*"/g, '').replace(/"fullName":"[^"]*"/g, ''))); assert(!/1234|pw-teacher/.test(raw)); });
t('initAllSheets 8 tab үүсгэнэ, эхний 2 sheet хөндөгдөхгүй', () => { const X = fresh(); X.sandbox.initAllSheets(); const names = X.sheets.map(s => s.name); ['Schedule', 'Homework', 'Submissions', 'Groups', 'Leaders', 'StudentData', 'Subjects', 'AuditLog'].forEach(n => assert(names.includes(n), n)); assert.strictEqual(X.sheets[0].cells.length, 4); });
t('эхний 2 sheet "Schedule" нэртэй бол db_ угтвартай tab руу бичнэ', () => { const X = makeEnv([['Schedule', [['username', 'password'], ['t', 'p']]], ['Users', [['username', 'password'], ['s', 'p']]]]); const tk = login(X, 't', 'p').token; sync(X, tk, [{ table: 'Schedule', upsert: [sch] }]); assert(X.ss.getSheetByName('db_Schedule')); assert.strictEqual(X.sheets[0].cells.length, 2); });


console.log('Нэмэлт: найдвартай байдал');
const F = fresh();
const FT = login(F, 'teacher1', 'pw-teacher').token;
const FS = login(F, '10A-01', '1234').token;
const fhw = { homeworkId: 'hw_9', classId: '10А', subjectId: 's', subjectName: 'Монгол', title: 'T', description: '', assignedDate: '2026-10-14', dueDate: '2026-10-14', createdBy: 'u_teacher1', status: 'ACTIVE', createdAt: '2026-10-14T01:00:00.000Z' };
t('ижил batch-ийг 2 удаа илгээхэд давхардахгүй (retry аюулгүй)', () => {
  const ch = [{ table: 'Homework', upsert: [fhw] }, { table: 'AuditLog', upsert: [{ logId: 'log_r1', userId: 'x', userName: 'x', action: 'A', targetType: 'T', targetId: 'h', timestamp: 'x', details: '' }] }];
  sync(F, FT, ch); sync(F, FT, ch);
  const d = fetchAll(F, FT).data; assert.strictEqual(d.homework.length, 1); assert.strictEqual(d.auditLogs.filter(l => l.logId === 'log_r1').length, 1);
});
t('200 үнэлгээг нэг дор бичиж, дахин шинэчлэхэд мөр давхардахгүй', () => {
  const sid = fetchAll(F, FT).data.students.find(s => s.studentCode === '10A-02').studentId;
  const rows = []; for (let i = 0; i < 200; i++) rows.push({ submissionId: 'sm_bulk' + i, homeworkId: 'hw_b' + i, studentId: sid, status: 'AVERAGE', updatedAt: '2026-10-14T02:00:00.000Z' });
  const r1 = sync(F, FT, [{ table: 'Submissions', upsert: rows }]); assert.strictEqual(r1.results[0].written, 200);
  const rows2 = rows.map((x, i) => (i % 3 === 0 ? { ...x, status: 'EXCELLENT', updatedAt: '2026-10-14T03:00:00.000Z' } : x));
  sync(F, FT, [{ table: 'Submissions', upsert: rows2 }]);
  const subs = fetchAll(F, FT).data.submissions.filter(s => s.submissionId.startsWith('sm_bulk'));
  assert.strictEqual(subs.length, 200); assert.strictEqual(subs.filter(s => s.status === 'EXCELLENT').length, 67);
});
t('ахлагч/сурагч мөр устгаж чадахгүй', () => { const r = sync(F, FS, [{ table: 'Submissions', remove: ['sm_bulk1'] }]); assert.strictEqual(r.results[0].removed, 0); assert.strictEqual(r.results[0].rejected.length, 1); });
t('сурагчийн хавсралт URL: javascript: цэвэрлэгдэнэ', () => {
  sync(F, FS, [{ table: 'Submissions', upsert: [{ submissionId: 'sm_a', homeworkId: 'hw_9', studentId: fetchAll(F, FS).data.students.find(s => s.studentCode === '10A-01').studentId, status: 'DONE', studentAttachmentUrl: 'javascript:alert(1)', updatedAt: new Date().toISOString() }] }]);
  const s = fetchAll(F, FS).data.submissions.find(x => x.submissionId === 'sm_a'); assert.strictEqual(s.studentAttachmentUrl, '');
});
t('app-аас нэмсэн (2-р sheet-д байхгүй) сурагч хадгалагдаж татагдана, нэвтэрч чадахгүй', () => {
  sync(F, FT, [{ table: 'StudentData', upsert: [{ studentId: 'std_extra1', studentCode: 'X-1', fullName: 'Шинэ Сурагч', classId: '10А', active: true, publicDisplayName: 'Сурагч', showOnLeaderboard: true }] }]);
  const st = fetchAll(F, FT).data.students.find(s => s.studentId === 'std_extra1'); assert(st && st.fullName === 'Шинэ Сурагч' && st.classId === '10А');
  assert.strictEqual(login(F, 'X-1', 'x').success, false);
});
t('идэвхгүй болгосон сурагч нэвтэрч чадахгүй, токен нь хүчингүй болно', () => {
  const st = fetchAll(F, FT).data.students.find(s => s.studentCode === '10A-01');
  sync(F, FT, [{ table: 'StudentData', upsert: [{ ...st, active: false }] }]);
  assert.strictEqual(login(F, '10A-01', '1234').success, false);
  const r = fetchAll(F, FS); assert(!r.success && r.code === 'AUTH');
});
t('Sheet-д "Багш/Сурагч" дараалал солигдсон ч (анги баганаар) таньна', () => {
  const X = makeEnv([['Сурагч', [['Нэвтрэх нэр', 'Нууц үг', 'Овог нэр', 'Анги', 'Код'], ['s1', 'p1', 'А Б', '9А', 'S1']]], ['Багш', [['Нэвтрэх нэр', 'Нууц үг', 'Нэр'], ['tt', 'pp', 'Багш']]]]);
  assert.strictEqual(login(X, 'tt', 'pp').user.role, 'TEACHER'); assert.strictEqual(login(X, 's1', 'p1').user.role, 'STUDENT');
});
t('тоон нууц үг (number нүд) болон код-оор нэвтрэх', () => {
  const X = makeEnv([['A', [['username', 'password'], ['t', 'p']]], ['B', [['Нэвтрэх нэр', 'Нууц үг', 'Овог нэр', 'Анги', 'Код'], ['stu', 5678, 'Н Н', '9А', 'C-9']]]]);
  assert(login(X, 'stu', '5678').success); assert(login(X, 'c-9', '5678').success);
});
t('буруу хүсэлт: changes массив биш / үл мэдэгдэх хүснэгт', () => {
  assert.strictEqual(F.post({ action: 'sync', token: FT, changes: 'x' }).success, false);
  const r = sync(F, FT, [{ table: 'Users', upsert: [{ userId: 'u' }] }]); assert(r.success && r.results[0].rejected.length === 1);
  assert.strictEqual(F.post({ action: 'nope', token: FT }).success, false);
});
t('амжилттай нэвтрэлт түгжих тоолуурыг тэглэнэ', () => { for (let i = 0; i < 4; i++) login(F, '10A-02', 'bad'); assert(login(F, '10A-02', '123').success); for (let i = 0; i < 4; i++) login(F, '10A-02', 'bad'); assert(login(F, '10A-02', '123').success); });
t('токены эрх сурагч → ахлагч өөрчлөлтийг шууд тусгана', () => {
  const st = fetchAll(F, FT).data.students.find(s => s.studentCode === '10A-02');
  const tk = login(F, '10A-02', '123').token;
  sync(F, FT, [{ table: 'StudentData', upsert: [{ ...st, isLeader: true }] }]);
  const r = sync(F, tk, [{ table: 'Homework', upsert: [{ ...fhw, homeworkId: 'hw_lead', createdBy: 'leader' }] }]);
  assert.strictEqual(r.results[0].written, 1);
  const bad = sync(F, tk, [{ table: 'Homework', upsert: [{ ...fhw, homeworkId: 'hw_lead2', classId: '10Б' }] }]); assert.strictEqual(bad.results[0].rejected.length, 1);
});

console.log('Даалгавар 1 & 2: Нэгдсэн users sheet, syncUsers, Хэсгийн эрх, homework_log, Formula Injection');
const U = makeEnv([
  ['any_name_first_sheet', [
    ['Хэсгийн ахлагч', 'Анги бүлэг', 'Нууц үг', 'Нэвтрэх нэр', 'Овог нэр', 'Хэсэг'],
    ['багш', '', 'admin123', '  Teacher_Main ', 'Багш Наран', ''],
    ['тийм', '10А', 'leadpass', 'leader_g1', 'Ахлагч Болд', 'group1'],
    ['үгүй', '10А', 'stupass1', 'stu_g1', 'Сурагч Сарнай', 'group1'],
    ['үгүй', '10А', 'stupass2', 'stu_g2', 'Сурагч Тэмүүлэн', 'group2'],
    ['үгүй', '10А', 'dup_pass', 'stu_g1', 'Давхардсан Сурагч', 'group1']
  ]]
]);
t('getSheets()[0] баганын дараалал өөрчлөгдсөн ч толгойгоор таньж нэвтрүүлнэ (trim + case-insensitive)', () => {
  const rT = login(U, '  teacher_main ', 'admin123');
  assert(rT.success && rT.user.role === 'TEACHER');
  const rL = login(U, 'LEADER_G1', 'leadpass');
  assert(rL.success && rL.user.role === 'LEADER' && rL.user.classId === '10А' && rL.user.groupId === 'grp_10А_1' && rL.user.isLeader === true);
  const rS = login(U, 'stu_g1', 'stupass1');
  assert(rS.success && rS.user.role === 'STUDENT' && rS.user.groupId === 'grp_10А_1');
});
t('syncUsers() функц болон админы syncUsers action давхардсан нэрийг илрүүлж cache шинэчилнэ', () => {
  const tkT = login(U, 'teacher_main', 'admin123').token;
  const tkS = login(U, 'stu_g1', 'stupass1').token;
  assert.strictEqual(U.post({ action: 'syncUsers', token: tkS }).success, false);
  const res = U.post({ action: 'syncUsers', token: tkT });
  assert(res.success && res.teacherCount === 1 && res.leaderCount === 1 && res. duplicates.includes('stu_g1'));
});
t('хэсгийн ахлагч зөвхөн өөрийн хэсгийн (group1) сурагчийг бүртгэж, өөр хэсгийн (group2) сурагчийг засаж чадахгүй', () => {
  const tkL = login(U, 'leader_g1', 'leadpass').token;
  const rOk = U.post({
    action: 'saveHomeworkLog',
    token: tkL,
    requestId: 'req_test_1',
    entries: [{ studentId: 'std_stu_g1', subjectName: 'Математик', date: '2026-10-20', status: 'хийсэн', comment: '=SUM(1,2) Бодлого бүрэн' }]
  });
  assert(rOk.success && rOk.verified && rOk.written === 1);
  // Өөр хэсгийн (group2) сурагчийг засах оролдлого татгалзагдана
  const rBad = U.post({
    action: 'saveHomeworkLog',
    token: tkL,
    requestId: 'req_test_2',
    entries: [{ studentId: 'std_stu_g2', subjectName: 'Математик', date: '2026-10-20', status: 'хийсэн', comment: 'Бусдын хэсэг' }]
  });
  assert.strictEqual(rBad.written, 0);
  assert.strictEqual(rBad.rejected.length, 1);
});
t('Formula Injection хамгаалалт: Sheet-ийн нүдэнд \' угтвартай хадгалагдаж, уншихад цэвэр ирнэ', () => {
  const logSheet = U.ss.getSheetByName('homework_log');
  const rawCells = logSheet.cells[1].map(String);
  assert(rawCells.some(c => c.startsWith("'=SUM(1,2)")), 'Түүхий нүд \'-ээр эхэлсэн байх ёстой');
  const tkL = login(U, 'leader_g1', 'leadpass').token;
  const d = fetchAll(U, tkL).data;
  assert.strictEqual(d.homeworkLog.length, 1);
  assert.strictEqual(d.homeworkLog[0].comment, '=SUM(1,2) Бодлого бүрэн');
  assert.strictEqual(d.homeworkLog[0].updatedBy, 'leader_g1');
});
t('Soft-delete: Schedule мөрийг deleted тэмдэглэгээгээр устгахад Sheet-д түүх үлдэж, fetchAll-д харагдахгүй', () => {
  const tkT = login(U, 'teacher_main', 'admin123').token;
  U.post({ action: 'saveSchedule', token: tkT, item: { scheduleId: 'sch_s1', classId: '10А', weekday: 1, period: 1, subjectName: 'Физик', teacherName: 'Багш Б', room: '302' } });
  assert.strictEqual(fetchAll(U, tkT).data.schedule.length, 1);
  U.post({ action: 'saveSchedule', token: tkT, deleteId: 'sch_s1', softDelete: true });
  assert.strictEqual(fetchAll(U, tkT).data.schedule.length, 0);
  assert.strictEqual(U.ss.getSheetByName('Schedule').getLastRow(), 2); // мөр устгагдаагүй, deleted=true болсон
});

console.log(`\n${passed} шалгалт амжилттай`);

