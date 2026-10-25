// SheetSync (фронтенд) ↔ Apps Script (mock Sheet) интеграцийн тест.
// Ажиллуулах: npx tsx apps-script/test/sync.test.ts
import assert from 'node:assert';
import { createRequire } from 'node:module';
import { SheetSync, TableBinding } from '../../src/services/sheetSync';

const require = createRequire(import.meta.url);
const { makeEnv } = require('./harness.cjs');

const env = makeEnv([
  ['Багш', [['Нэвтрэх нэр', 'Нууц үг', 'Нэр'], ['teacher1', 'pw', 'Багш']]],
  ['Сурагч', [['Нэвтрэх нэр', 'Нууц үг', 'Овог нэр', 'Анги', 'Код'], ['10A-01', '1', 'Бат Болд', '10А', '10A-01']]]
]);

// ---- браузерийн орчныг дууриана ----
let offline = false;
const store: Record<string, string> = {};
(globalThis as any).localStorage = { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => (store[k] = v), removeItem: (k: string) => delete store[k] };
(globalThis as any).fetch = async (url: string, init: any) => {
  if (offline) throw new TypeError('Failed to fetch');
  const u = new URL(url);
  const out = init?.method === 'POST' ? env.post(JSON.parse(init.body)) : env.get(Object.fromEntries(u.searchParams));
  return { ok: true, status: 200, text: async () => JSON.stringify(out) };
};

const state: Record<string, any[]> = { Schedule: [], Homework: [], Submissions: [], Groups: [], Leaders: [], StudentData: [], Subjects: [], AuditLog: [] };
const keys: Record<string, string> = { Schedule: 'scheduleId', Homework: 'homeworkId', Submissions: 'submissionId', Groups: 'groupId', Leaders: 'leaderId', StudentData: 'studentId', Subjects: 'subjectId', AuditLog: 'logId' };
const del: Record<string, boolean> = { Schedule: true, Groups: true, Subjects: true };
const bindings = (): TableBinding[] => Object.keys(state).map(n => ({ name: n as any, key: keys[n], propagateDeletes: !!del[n], get: () => state[n], set: r => (state[n] = r) }));

const login = env.post({ action: 'login', username: 'teacher1', password: 'pw' });
assert(login.success);
const sync = new SheetSync({
  getUrl: () => 'https://script.google.com/macros/s/x/exec',
  getToken: () => login.token,
  getRole: () => 'TEACHER',
  bindings,
  applyPull: p => { for (const [k, v] of Object.entries(p.tables)) state[k] = v as any[]; },
  onAuthError: m => { throw new Error('auth ' + m); },
  onChange: () => {}
});
const sheetRows = (name: string) => env.ss.getSheetByName(name).getLastRow() - 1;
const wait = (ms: number) => new Promise(r => setTimeout(r, ms));
let n = 0;
const t = async (name: string, fn: () => Promise<void>) => { try { await fn(); n++; console.log('  ok  ' + name); } catch (e: any) { console.error('  FAIL ' + name + '\n     ' + e.message); process.exitCode = 1; } };

(async () => {
  sync.start();
  await t('эхний таталт: сурагч Sheet-ээс ирнэ', async () => {
    await sync.pull();
    assert.strictEqual(state.StudentData.length, 1);
    assert.strictEqual(state.StudentData[0].fullName, 'Бат Болд');
  });
  await t('локал өөрчлөлт Sheet-д хадгалагдаж, дахин татахад буцаж ирнэ', async () => {
    state.Schedule.push({ scheduleId: 'sch_1', classId: '10А', weekday: 1, period: 1, subjectId: 'm', subjectName: 'Математик', teacherName: 'Б', startTime: '08:00', endTime: '08:45', active: true });
    sync.notifyLocalChange();
    await sync.flush();
    assert.strictEqual(sheetRows('Schedule'), 1);
    state.Schedule[0] = { ...state.Schedule[0], startTime: '' }; // локал утгыг эвдэж, Sheet-ийн хувилбар буцаж ирэхийг шалгана
    sync.notifyLocalChange();
    await sync.flush();
    state.Schedule = [];
    // "Өөр төхөөрөмж": snapshot-ийг цэвэрлээд Sheet-ээс шинээр татна
    sync.resetSnapshot();
    await sync.pull();
    assert.strictEqual(state.Schedule.length, 1);
    assert.strictEqual(state.Schedule[0].startTime, '');
    assert.strictEqual(state.Schedule[0].weekday, 1);
    assert.strictEqual(state.Schedule[0].active, true);
  });
  await t('сүлжээ тасрахад өөрчлөлт алдагдахгүй, pull дарж бичихгүй', async () => {
    offline = true;
    state.Homework.push({ homeworkId: 'hw_1', classId: '10А', subjectId: 'm', subjectName: 'Математик', title: 'Бодлого', description: '', assignedDate: '2026-10-14', dueDate: '2026-10-15', createdBy: 'u_teacher1', status: 'ACTIVE', createdAt: new Date().toISOString() });
    sync.notifyLocalChange();
    await wait(900);
    assert.strictEqual(sync.countPendingRaw(), 1);
    await assert.rejects(() => sync.pull());
    assert.strictEqual(state.Homework.length, 1, 'локал өөрчлөлт хэвээр');
    offline = false;
    await sync.flush();
    assert.strictEqual(sync.countPendingRaw(), 0);
    assert.strictEqual(sheetRows('Homework'), 1);
  });
  await t('устгал Sheet-д дамжина', async () => {
    state.Schedule = [];
    await sync.flush();
    assert.strictEqual(sheetRows('Schedule'), 0);
  });
  await t('хуудас дахин ачаалсан (шинэ SheetSync): хадгалагдаагүй өөрчлөлт snapshot-оос олдоно', async () => {
    offline = true;
    state.Submissions.push({ submissionId: 'sm_1', homeworkId: 'hw_1', studentId: state.StudentData[0].studentId, status: 'EXCELLENT', updatedAt: new Date().toISOString() });
    await sync.flush().catch(() => {});
    sync.stop();
    const sync2 = new SheetSync({ getUrl: () => 'https://script.google.com/macros/s/x/exec', getToken: () => login.token, getRole: () => 'TEACHER', bindings, applyPull: p => { for (const [k, v] of Object.entries(p.tables)) state[k] = v as any[]; }, onAuthError: () => {}, onChange: () => {} });
    sync2.start();
    assert.strictEqual(sync2.countPendingRaw(), 1);
    offline = false;
    await sync2.pull();
    assert.strictEqual(sheetRows('Submissions'), 1);
    assert.strictEqual(state.Submissions.length, 1);
    sync2.stop();
  });
  console.log(`\n${n} интеграцийн шалгалт амжилттай`);
  process.exit(process.exitCode || 0);
})();
