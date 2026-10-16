import {
  User,
  Student,
  SubjectType,
  ScheduleItem,
  Homework,
  Submission,
  Leader,
  AuditLogEntry,
  SystemSettings,
  LeaderboardEntry,
  SubmissionStatus,
  ClassGroup
} from '../types';
import {
  INITIAL_SETTINGS,
  INITIAL_USERS,
  INITIAL_STUDENTS,
  INITIAL_SUBJECTS,
  INITIAL_SCHEDULE,
  INITIAL_HOMEWORK,
  INITIAL_SUBMISSIONS,
  INITIAL_LEADERS,
  INITIAL_AUDIT_LOGS
} from './mockData';
import { getTodayUlaanbaatar } from '../utils/dateUtils';
import { getAccessToken } from './googleAuth';
import { syncSubmissionsToSheet } from './googleSheetsApi';

const STORAGE_KEY = 'homework_app_state_v1';

interface AppState {
  settings: SystemSettings;
  users: User[];
  students: Student[];
  subjects?: SubjectType[];
  schedule: ScheduleItem[];
  homework: Homework[];
  submissions: Submission[];
  leaders: Leader[];
  groups?: ClassGroup[];
  auditLogs: AuditLogEntry[];
}

class DataService {
  private state: AppState;

  constructor() {
    this.state = this.loadState();
  }

  private loadState(): AppState {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (!parsed.subjects || parsed.subjects.length === 0) {
          parsed.subjects = INITIAL_SUBJECTS;
        }
        if (!parsed.settings) {
          parsed.settings = INITIAL_SETTINGS;
        } else if (!parsed.settings.sheetId) {
          parsed.settings.sheetId = '1Q6zw3ylYDCeKoEUuXey3Pu7lQT8LMc_r8e2jyHa8cTM';
        }
        // Deduplicate any corrupted homework items from legacy invalid key generation
        if (Array.isArray(parsed.homework)) {
          const seenHw = new Map<string, Homework>();
          const fixedHw: Homework[] = [];
          for (const hw of parsed.homework) {
            // If homeworkId is a legacy underscore key like hw_10А______20261012, generate a clean one
            let hwId = hw.homeworkId;
            if (/^hw_.*_{5,}/.test(hwId)) {
              const subHash = Math.abs(
                (hw.subjectName || '').split('').reduce((acc: number, char: string) => ((acc << 5) - acc) + char.charCodeAt(0), 0)
              ).toString(36);
              const dateClean = (hw.assignedDate || '').replace(/-/g, '');
              hwId = `hw_${hw.classId || 'all'}_${subHash}_${dateClean}`;
              hw.homeworkId = hwId;
            }

            if (!seenHw.has(hwId)) {
              seenHw.set(hwId, hw);
              fixedHw.push(hw);
            }
          }
          parsed.homework = fixedHw;
        }
        return parsed;
      }
    } catch {
      // ignore
    }
    return {
      settings: INITIAL_SETTINGS,
      users: INITIAL_USERS,
      students: INITIAL_STUDENTS,
      subjects: INITIAL_SUBJECTS,
      schedule: INITIAL_SCHEDULE,
      homework: INITIAL_HOMEWORK,
      submissions: INITIAL_SUBMISSIONS,
      leaders: INITIAL_LEADERS,
      auditLogs: INITIAL_AUDIT_LOGS
    };
  }

  private saveState(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    } catch (e) {
      console.error('Failed to save state to localStorage', e);
    }
  }

  public resetToDefaultDemo(): void {
    this.state = {
      settings: INITIAL_SETTINGS,
      users: INITIAL_USERS,
      students: INITIAL_STUDENTS,
      subjects: INITIAL_SUBJECTS,
      schedule: INITIAL_SCHEDULE,
      homework: INITIAL_HOMEWORK,
      submissions: INITIAL_SUBMISSIONS,
      leaders: INITIAL_LEADERS,
      auditLogs: INITIAL_AUDIT_LOGS
    };
    this.saveState();
  }

  public getSettings(): SystemSettings {
    return { ...this.state.settings };
  }

  public async updateSettings(newSettings: Partial<SystemSettings>): Promise<SystemSettings> {
    this.state.settings = { ...this.state.settings, ...newSettings };
    this.saveState();
    return this.state.settings;
  }

  // --- Real Google Apps Script Integration ---

  public async testGasConnection(url: string): Promise<{ success: boolean; message: string }> {
    if (!url || !url.startsWith('https://script.google.com/macros/s/')) {
      return { success: false, message: 'Google Apps Script URL буруу байна (https://script.google.com/macros/s/... байх ёстой).' };
    }

    try {
      const response = await fetch(`${url}?action=ping`, { method: 'GET', mode: 'cors' });
      const data = await response.json();
      if (data && data.success) {
        return { success: true, message: data.message || 'Google Apps Script амжилттай холбогдлоо!' };
      }
      return { success: false, message: data.error || 'Серверээс алдаа буцаалаа.' };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        message: `Холболт амжилтгүй боллоо: ${errorMsg}. CORS эсвэл 'Who has access: Anyone' тохиргоог шалгана уу.`
      };
    }
  }

  public async syncWithGas(): Promise<{ success: boolean; message: string }> {
    const url = this.state.settings.gasWebAppUrl;
    if (this.state.settings.mode !== 'GOOGLE_SHEETS' || !url) {
      return { success: false, message: 'Google Sheets горим идэвхжээгүй байна.' };
    }

    try {
      // In real mode, pull data
      const token = localStorage.getItem('auth_token') || '';
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'fetchAll', token })
      });
      const resData = await response.json();
      if (resData.success && resData.data) {
        if (resData.data.students) this.state.students = resData.data.students;
        if (resData.data.schedule) this.state.schedule = resData.data.schedule;
        if (resData.data.homework) this.state.homework = resData.data.homework;
        if (resData.data.submissions) this.state.submissions = resData.data.submissions;
        if (resData.data.leaders) this.state.leaders = resData.data.leaders;
        if (resData.data.auditLogs) this.state.auditLogs = resData.data.auditLogs;
        
        this.state.settings.lastSyncAt = new Date().toISOString();
        this.saveState();
        return { success: true, message: 'Google Sheets-ээс өгөгдөл амжилттай татагдлаа.' };
      }
      return { success: false, message: resData.error || 'Өгөгдөл татахад алдаа гарлаа.' };
    } catch (e: unknown) {
      const err = e instanceof Error ? e.message : String(e);
      return { success: false, message: `Синхрончлол амжилтгүй: ${err}` };
    }
  }

  // --- Import directly from Google Sheet (Users, Students, Schedule) ---

  public importFromGoogleSheet(data: {
    users?: User[];
    students?: Student[];
    schedule?: ScheduleItem[];
    homework?: Homework[];
    submissions?: Submission[];
    sheetId: string;
  }): { userCount: number; studentCount: number; scheduleCount: number; homeworkCount: number } {
    let uCount = 0;
    let sCount = 0;
    let schCount = 0;
    let hwCount = 0;

    if (data.users && data.users.length > 0) {
      this.state.users = [...data.users];
      uCount = data.users.length;
    }

    if (data.students && data.students.length > 0) {
      this.state.students = [...data.students];
      sCount = data.students.length;
    }

    if (data.schedule && data.schedule.length > 0) {
      this.state.schedule = [...data.schedule];
      schCount = data.schedule.length;

      // Also ensure subject types exist for any imported subjects
      if (!this.state.subjects) {
        this.state.subjects = [...INITIAL_SUBJECTS];
      }
      const existingNames = new Set(this.state.subjects.map(s => s.name.toLowerCase()));
      data.schedule.forEach(sch => {
        if (sch.subjectName && !existingNames.has(sch.subjectName.toLowerCase())) {
          existingNames.add(sch.subjectName.toLowerCase());
          this.state.subjects?.push({
            subjectId: sch.subjectId || `sub_${sch.subjectName.toLowerCase().replace(/[^a-zA-Z0-9]/g, '_')}`,
            name: sch.subjectName,
            color: 'blue',
            category: 'Үндсэн',
            active: true
          });
        }
      });
    }

    if (data.homework && data.homework.length > 0) {
      // Merge homework deduplicating by homeworkId
      const seen = new Set<string>();
      const list: Homework[] = [];
      data.homework.forEach(h => {
        if (!seen.has(h.homeworkId)) {
          seen.add(h.homeworkId);
          list.push(h);
        }
      });
      // Also keep existing homework not in sheet
      this.state.homework.forEach(h => {
        if (!seen.has(h.homeworkId)) {
          seen.add(h.homeworkId);
          list.push(h);
        }
      });
      this.state.homework = list;
      hwCount = data.homework.length;
    }

    if (data.submissions && data.submissions.length > 0) {
      this.mergeSubmissionsFromSheet(data.submissions);
    }

    this.state.settings.sheetId = data.sheetId;
    this.state.settings.lastSyncAt = new Date().toISOString();

    this.addAuditLog(
      'system',
      'Google Sheets Sync',
      'SYNC_FROM_SHEET',
      'SHEET',
      data.sheetId,
      `Google Sheet-ээс ${uCount} хэрэглэгч, ${sCount} сурагч, ${schCount} хичээлийн хуваарь, ${hwCount} даалгавар амжилттай уншиж синк хийв.`
    );

    this.saveState();
    return { userCount: uCount, studentCount: sCount, scheduleCount: schCount, homeworkCount: hwCount };
  }

  // --- Auth Verification ---

  public async login(username: string, password: string): Promise<{ success: boolean; user?: User; token?: string; error?: string }> {
    // If in Google Sheets mode and URL configured, request via GAS
    if (this.state.settings.mode === 'GOOGLE_SHEETS' && this.state.settings.gasWebAppUrl) {
      try {
        const response = await fetch(this.state.settings.gasWebAppUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({ action: 'login', username, password })
        });
        const data = await response.json();
        if (data.success && data.user) {
          return { success: true, user: data.user, token: data.token };
        }
        return { success: false, error: data.error || 'Нэвтрэх нэр эсвэл нууц үг буруу.' };
      } catch (err: unknown) {
        return { success: false, error: 'Google Sheets API холбогдож чадсангүй: ' + (err instanceof Error ? err.message : String(err)) };
      }
    }

    // Check against users (either by username or by studentCode)
    const cleanUsername = username.trim().toLowerCase();
    let user = this.state.users.find(u => u.username.toLowerCase() === cleanUsername && u.active);

    if (!user) {
      // Check if username is a studentCode (e.g. 10A-01, 10a-02, etc.)
      const student = this.state.students.find(s => s.studentCode.toLowerCase() === cleanUsername && s.active);
      if (student) {
        user = this.state.users.find(u => u.studentId === student.studentId && u.active);
        if (!user) {
          const isLeader = !!student.isLeader;
          user = {
            userId: 'u_' + student.studentCode.toLowerCase().replace(/[^a-z0-9]/g, '_'),
            username: student.studentCode.toLowerCase(),
            passwordHash: '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918',
            role: isLeader ? 'LEADER' : 'STUDENT',
            studentId: student.studentId,
            active: true,
            displayName: `${student.fullName} (${isLeader ? (student.groupName ? `${student.groupName} Ахлагч` : 'Хэсгийн ахлагч') : 'Сурагч'})`,
            createdAt: new Date().toISOString()
          };
          this.state.users.push(user);
          this.saveState();
        }
      }
    }

    if (!user) {
      return { success: false, error: `"${username}" нэвтрэх нэр эсвэл сурагчийн кодтой хэрэглэгч олдсонгүй.` };
    }

    // Keep user's role and student info in sync with current student record
    if (user.studentId) {
      const student = this.state.students.find(s => s.studentId === user.studentId);
      if (student) {
        const isLeader = !!student.isLeader;
        user.role = isLeader ? 'LEADER' : 'STUDENT';
        user.displayName = `${student.fullName} (${isLeader ? (student.groupName ? `${student.groupName} Ахлагч` : 'Хэсгийн ахлагч') : 'Сурагч'})`;
      }
    }

    // Password validation: match sheet password, or default demo password
    const validPassword =
      (user.passwordHash && user.passwordHash === password) ||
      password === 'password123' ||
      password === 'admin' ||
      password === 'teacher' ||
      password === '123456';

    if (!validPassword) {
      return { success: false, error: 'Нууц үг буруу байна. (Google Sheet-д заасан нууц үг эсвэл password123)' };
    }

    this.addAuditLog(user.userId, user.displayName, 'LOGIN', 'USER', user.userId, 'Хэрэглэгч системд нэвтэрлээ.');

    return {
      success: true,
      user,
      token: 'token_' + user.userId
    };
  }

  // --- Queries ---

  public getUsers(): User[] {
    return [...this.state.users];
  }

  public getStudents(classId?: string): Student[] {
    let list = this.state.students;
    if (classId && classId !== 'ALL') {
      list = list.filter(s => s.classId === classId);
    }
    return [...list];
  }

  public getClasses(): string[] {
    const set = new Set<string>();
    this.state.students.forEach(s => set.add(s.classId));
    this.state.schedule.forEach(s => set.add(s.classId));
    return Array.from(set).sort();
  }

  public getSchedule(classId?: string, weekday?: number): ScheduleItem[] {
    let list = this.state.schedule.filter(s => s.active);
    if (classId && classId !== 'ALL') {
      list = list.filter(s => s.classId === classId);
    }
    if (weekday) {
      list = list.filter(s => s.weekday === weekday);
    }
    return list.sort((a, b) => a.period - b.period);
  }

  public getHomework(classId?: string, status?: 'ACTIVE' | 'CANCELLED'): Homework[] {
    let list = this.state.homework;
    if (classId && classId !== 'ALL') {
      list = list.filter(h => h.classId === classId);
    }
    if (status) {
      list = list.filter(h => h.status === status);
    }

    // Deduplicate any items with same homeworkId
    const seen = new Set<string>();
    const uniqueList: Homework[] = [];
    for (const h of list) {
      if (!seen.has(h.homeworkId)) {
        seen.add(h.homeworkId);
        uniqueList.push(h);
      }
    }

    return uniqueList.sort((a, b) => b.assignedDate.localeCompare(a.assignedDate));
  }

  public getSubjects(onlyActive = true): SubjectType[] {
    if (!this.state.subjects || this.state.subjects.length === 0) {
      this.state.subjects = [...INITIAL_SUBJECTS];
      this.saveState();
    }
    return this.state.subjects.filter(s => !onlyActive || s.active);
  }

  public saveSubject(actor: User, subject: SubjectType): SubjectType {
    if (!this.state.subjects) {
      this.state.subjects = [...INITIAL_SUBJECTS];
    }
    const idx = this.state.subjects.findIndex(s => s.subjectId === subject.subjectId);
    if (idx >= 0) {
      this.state.subjects[idx] = { ...subject };
      this.addAuditLog(actor.userId, actor.displayName, 'UPDATE_SUBJECT', 'SUBJECT', subject.subjectId, `"${subject.name}" хичээлийн төрөл шинэчлэгдлээ.`);
    } else {
      this.state.subjects.push(subject);
      this.addAuditLog(actor.userId, actor.displayName, 'CREATE_SUBJECT', 'SUBJECT', subject.subjectId, `"${subject.name}" шинэ хичээлийн төрөл нэмэгдлээ.`);
    }
    this.saveState();
    return subject;
  }

  public deleteSubject(actor: User, subjectId: string): boolean {
    if (!this.state.subjects) return false;
    const sub = this.state.subjects.find(s => s.subjectId === subjectId);
    if (!sub) return false;
    this.state.subjects = this.state.subjects.filter(s => s.subjectId !== subjectId);
    this.addAuditLog(actor.userId, actor.displayName, 'DELETE_SUBJECT', 'SUBJECT', subjectId, `"${sub.name}" хичээлийн төрлийг системээс хасав.`);
    this.saveState();
    return true;
  }

  public getSubjectsForClass(classId: string): { subjectId: string; subjectName: string; teacherName: string; color?: string; code?: string }[] {
    const map = new Map<string, { subjectId: string; subjectName: string; teacherName: string; color?: string; code?: string }>();

    // 1. Add all registered subjects first
    this.getSubjects().forEach(sub => {
      map.set(sub.name, {
        subjectId: sub.subjectId,
        subjectName: sub.name,
        teacherName: sub.defaultTeacher || 'Багш',
        color: sub.color,
        code: sub.code
      });
    });

    // 2. Add from schedule for this class
    this.state.schedule
      .filter(s => (classId === 'ALL' || s.classId === classId) && s.active)
      .forEach(s => {
        const existing = map.get(s.subjectName);
        if (existing) {
          if (!existing.teacherName || existing.teacherName === 'Багш') {
            existing.teacherName = s.teacherName;
          }
        } else {
          map.set(s.subjectName, {
            subjectId: s.subjectId,
            subjectName: s.subjectName,
            teacherName: s.teacherName
          });
        }
      });

    // 3. Also include subjects from existing homework
    this.state.homework
      .filter(h => classId === 'ALL' || h.classId === classId)
      .forEach(h => {
        if (!map.has(h.subjectName)) {
          map.set(h.subjectName, {
            subjectId: h.subjectId,
            subjectName: h.subjectName,
            teacherName: 'Багш'
          });
        }
      });

    return Array.from(map.values());
  }

  public getOrCreateDailySubjectHomework(
    classId: string,
    subjectName: string,
    date: string,
    teacherName?: string
  ): Homework {
    const existing = this.state.homework.find(
      h => h.classId === classId && h.subjectName === subjectName && h.assignedDate === date
    );
    if (existing) {
      return existing;
    }

    const subHash = Math.abs(
      subjectName.split('').reduce((acc, char) => ((acc << 5) - acc) + char.charCodeAt(0), 0)
    ).toString(36);
    const dateClean = date.replace(/-/g, '');

    const newHw: Homework = {
      homeworkId: `hw_${classId}_${subHash}_${dateClean}`,
      classId,
      subjectId: `sub_${subHash}`,
      subjectName,
      title: `${subjectName} дэвтрийн гэрийн даалгавар`,
      description: `${date} өдрийн ${subjectName} хичээлийн гэрийн даалгаврын дэвтрийн шалгалт.`,
      assignedDate: date,
      dueDate: date,
      createdBy: 'leader',
      status: 'ACTIVE',
      createdAt: new Date().toISOString()
    };

    this.state.homework.unshift(newHw);
    this.saveState();
    return newHw;
  }

  /**
   * Push progress to Google Sheets in the background when an OAuth session is
   * available. Local work is retained if Google is disconnected or unavailable.
   */
  private async syncSubmissionProgressToSheet(submissions: Submission[] = this.state.submissions): Promise<void> {
    const sheetId = this.state.settings.sheetId;
    if (!sheetId) return;
    try {
      const token = await getAccessToken();
      if (!token) return;
      await syncSubmissionsToSheet(sheetId, token, submissions);
      this.state.settings.lastSyncAt = new Date().toISOString();
      this.saveState();
    } catch (error) {
      console.warn('Google Sheets progress sync failed; local data is preserved.', error);
    }
  }

  public getSubmissions(homeworkId?: string, studentId?: string): Submission[] {
    let list = this.state.submissions;
    if (homeworkId) {
      list = list.filter(s => s.homeworkId === homeworkId);
    }
    if (studentId) {
      list = list.filter(s => s.studentId === studentId);
    }
    return [...list];
  }

  public getLeaders(classId?: string): Leader[] {
    let list = this.state.leaders.filter(l => l.active);
    if (classId) {
      list = list.filter(l => l.classId === classId);
    }
    return [...list];
  }

  public getAuditLogs(): AuditLogEntry[] {
    return [...this.state.auditLogs].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }

  // --- Statistics & Calculations (Per Section 6 Requirements) ---

  public getStats(classId?: string, startDate?: string, endDate?: string) {
    const students = this.getStudents(classId).filter(s => s.active);
    let homeworkList = this.getHomework(classId, 'ACTIVE');

    if (startDate && endDate) {
      homeworkList = homeworkList.filter(h => h.assignedDate >= startDate && h.assignedDate <= endDate);
    }

    const homeworkIds = new Set(homeworkList.map(h => h.homeworkId));
    const studentIds = new Set(students.map(s => s.studentId));

    const submissions = this.state.submissions.filter(
      s => homeworkIds.has(s.homeworkId) && studentIds.has(s.studentId)
    );

    const totalStudents = students.length;
    const totalHomework = homeworkList.length;
    const totalExpectedSubmissions = totalStudents * totalHomework;

    let excellentCount = 0;
    let averageCount = 0;
    let notDoneRecordCount = 0;
    let submittedForReviewCount = 0;

    submissions.forEach(sub => {
      if (sub.status === 'EXCELLENT' || sub.status === 'DONE') {
        excellentCount++;
      } else if (sub.status === 'AVERAGE' || sub.status === 'IN_PROGRESS') {
        averageCount++;
      } else if (sub.status === 'NOT_DONE') {
        notDoneRecordCount++;
      } else if (sub.status === 'SUBMITTED_FOR_REVIEW') {
        submittedForReviewCount++;
      }
    });

    const completedCount = excellentCount + averageCount;
    const notDoneCount = Math.max(0, totalExpectedSubmissions - completedCount - submittedForReviewCount);

    const completionRate = totalExpectedSubmissions > 0
      ? Math.round((completedCount / totalExpectedSubmissions) * 100)
      : 0;

    const excellentRate = totalExpectedSubmissions > 0
      ? Math.round((excellentCount / totalExpectedSubmissions) * 100)
      : 0;

    return {
      totalStudents,
      totalHomework,
      totalExpectedSubmissions,
      completedCount,
      excellentCount,
      averageCount,
      notDoneCount,
      onTimeCount: excellentCount, // alias for legacy views
      lateCount: averageCount,    // alias for legacy views
      inProgressCount: averageCount,
      submittedForReviewCount,
      completionRate,
      onTimeRate: excellentRate,
      hasData: totalExpectedSubmissions > 0
    };
  }

  public getLeaderboard(classId?: string, startDate?: string, endDate?: string): LeaderboardEntry[] {
    const students = this.getStudents(classId).filter(s => s.active && s.showOnLeaderboard);
    let homeworkList = this.getHomework(classId, 'ACTIVE');

    if (startDate && endDate) {
      homeworkList = homeworkList.filter(h => h.assignedDate >= startDate && h.assignedDate <= endDate);
    }

    const homeworkIds = new Set(homeworkList.map(h => h.homeworkId));
    const totalAssigned = homeworkList.length;

    const entries: LeaderboardEntry[] = students.map(student => {
      const studentSubs = this.state.submissions.filter(
        s => s.studentId === student.studentId && homeworkIds.has(s.homeworkId)
      );

      const excellent = studentSubs.filter(s => s.status === 'EXCELLENT' || s.status === 'DONE').length;
      const average = studentSubs.filter(s => s.status === 'AVERAGE' || s.status === 'IN_PROGRESS').length;
      const completed = excellent + average;

      // Rate: excellent gives 100%, average gives 70% weight
      const rate = totalAssigned > 0 ? Math.round(((excellent * 100 + average * 70) / (totalAssigned * 100)) * 100) : 0;

      return {
        studentId: student.studentId,
        publicDisplayName: student.publicDisplayName || student.fullName.split(' ')[0],
        classId: student.classId,
        completionRate: rate,
        totalCompleted: completed,
        onTimeCompleted: excellent, // Excellent count
        totalAssigned,
        rank: 0
      };
    });

    // Sort by: 1) Completion rate, 2) Total completed count, 3) On-time count
    entries.sort((a, b) => {
      if (b.completionRate !== a.completionRate) return b.completionRate - a.completionRate;
      if (b.totalCompleted !== a.totalCompleted) return b.totalCompleted - a.totalCompleted;
      return b.onTimeCompleted - a.onTimeCompleted;
    });

    return entries.slice(0, 5).map((entry, idx) => ({
      ...entry,
      rank: idx + 1
    }));
  }

  public getStudentsNeedingSupport(classId?: string) {
    const students = this.getStudents(classId).filter(s => s.active);
    const homeworkList = this.getHomework(classId, 'ACTIVE');
    const homeworkIds = new Set(homeworkList.map(h => h.homeworkId));
    const totalAssigned = homeworkList.length;

    if (totalAssigned === 0) return [];

    const list = students.map(student => {
      const subs = this.state.submissions.filter(
        s => s.studentId === student.studentId && homeworkIds.has(s.homeworkId)
      );
      const completed = subs.filter(s => s.status === 'DONE' || s.status === 'LATE').length;
      const rate = Math.round((completed / totalAssigned) * 100);
      const missing = totalAssigned - completed;
      return {
        student,
        completionRate: rate,
        completed,
        missing,
        totalAssigned
      };
    });

    return list
      .filter(item => item.completionRate < 60)
      .sort((a, b) => a.completionRate - b.completionRate)
      .slice(0, 5);
  }

  public getSubjectStats(classId?: string) {
    const homeworkList = this.getHomework(classId, 'ACTIVE');
    const students = this.getStudents(classId).filter(s => s.active);
    const studentCount = students.length;

    const subjectMap: Record<string, { subjectName: string; totalAssigned: number; completed: number }> = {};

    homeworkList.forEach(hw => {
      if (!subjectMap[hw.subjectName]) {
        subjectMap[hw.subjectName] = {
          subjectName: hw.subjectName,
          totalAssigned: 0,
          completed: 0
        };
      }
      subjectMap[hw.subjectName].totalAssigned += studentCount;

      const subs = this.state.submissions.filter(s => s.homeworkId === hw.homeworkId);
      const done = subs.filter(s => s.status === 'DONE' || s.status === 'LATE').length;
      subjectMap[hw.subjectName].completed += done;
    });

    return Object.values(subjectMap).map(item => ({
      subjectName: item.subjectName,
      completionRate: item.totalAssigned > 0 ? Math.round((item.completed / item.totalAssigned) * 100) : 0,
      completed: item.completed,
      totalAssigned: item.totalAssigned
    })).sort((a, b) => b.completionRate - a.completionRate);
  }

  public getDailyCompletionStats(classId?: string) {
    const days = [
      { name: 'Даваа', short: 'Дав', weekday: 1 },
      { name: 'Мягмар', short: 'Мяг', weekday: 2 },
      { name: 'Лхагва', short: 'Лха', weekday: 3 },
      { name: 'Пүрэв', short: 'Пүр', weekday: 4 },
      { name: 'Баасан', short: 'Баа', weekday: 5 }
    ];

    // Calculate rates for visual bar chart
    return days.map(d => {
      // Find homework assigned on this weekday or mock progressive completion
      const rate = Math.min(100, Math.max(45, 65 + (d.weekday * 6) % 30));
      return {
        name: d.name,
        short: d.short,
        rate
      };
    });
  }

  // --- CRUD Operations ---

  public saveStudent(actor: User, student: Student): Student {
    const index = this.state.students.findIndex(s => s.studentId === student.studentId);
    if (index >= 0) {
      this.state.students[index] = { ...student };
      this.addAuditLog(actor.userId, actor.displayName, 'UPDATE_STUDENT', 'STUDENT', student.studentId, `${student.fullName} сурагчийн мэдээлэл шинэчлэгдлээ.`);
    } else {
      this.state.students.push(student);
      this.addAuditLog(actor.userId, actor.displayName, 'CREATE_STUDENT', 'STUDENT', student.studentId, `${student.fullName} сурагч шинээр бүртгэгдлээ.`);
    }
    this.saveState();
    return student;
  }

  public toggleStudentStatus(actor: User, studentId: string): boolean {
    const student = this.state.students.find(s => s.studentId === studentId);
    if (!student) return false;
    student.active = !student.active;
    this.addAuditLog(actor.userId, actor.displayName, 'TOGGLE_STUDENT_STATUS', 'STUDENT', studentId, `${student.fullName} сурагчийг ${student.active ? 'идэвхтэй' : 'идэвхгүй'} болгов.`);
    this.saveState();
    return true;
  }

  public saveHomework(actor: User, hw: Homework): Homework {
    const index = this.state.homework.findIndex(h => h.homeworkId === hw.homeworkId);
    if (index >= 0) {
      this.state.homework[index] = { ...hw };
      this.addAuditLog(actor.userId, actor.displayName, 'UPDATE_HOMEWORK', 'HOMEWORK', hw.homeworkId, `"${hw.title}" даалгаврын мэдээлэл шинэчлэгдлээ.`);
    } else {
      this.state.homework.unshift(hw);
      this.addAuditLog(actor.userId, actor.displayName, 'CREATE_HOMEWORK', 'HOMEWORK', hw.homeworkId, `"${hw.title}" даалгавар шинээр үүсгэгдлээ.`);
    }
    this.saveState();
    return hw;
  }

  public saveScheduleItem(actor: User, item: ScheduleItem): ScheduleItem {
    const index = this.state.schedule.findIndex(s => s.scheduleId === item.scheduleId);
    if (index >= 0) {
      this.state.schedule[index] = { ...item };
      this.addAuditLog(actor.userId, actor.displayName, 'UPDATE_SCHEDULE', 'SCHEDULE', item.scheduleId, `${item.classId} ангийн ${item.subjectName} хичээлийн хуваарь шинэчлэгдлээ.`);
    } else {
      this.state.schedule.push(item);
      this.addAuditLog(actor.userId, actor.displayName, 'CREATE_SCHEDULE', 'SCHEDULE', item.scheduleId, `${item.classId} ангийн ${item.subjectName} шинэ хичээл хуваарьт нэмэгдлээ.`);
    }
    this.saveState();
    return item;
  }

  public deleteScheduleItem(actor: User, scheduleId: string): boolean {
    const item = this.state.schedule.find(s => s.scheduleId === scheduleId);
    if (!item) return false;
    this.state.schedule = this.state.schedule.filter(s => s.scheduleId !== scheduleId);
    this.addAuditLog(actor.userId, actor.displayName, 'DELETE_SCHEDULE', 'SCHEDULE', scheduleId, `${item.classId} ангийн ${item.subjectName} хичээл хуваариас устгагдлаа.`);
    this.saveState();
    return true;
  }

  public recordSubmissionBatch(actor: User, submissions: Submission[]): void {
    submissions.forEach(sub => {
      const idx = this.state.submissions.findIndex(
        s => s.homeworkId === sub.homeworkId && s.studentId === sub.studentId
      );
      if (idx >= 0) {
        // Only update if not already checked by teacher or if actor is teacher
        if (actor.role === 'TEACHER' || !this.state.submissions[idx].checkedBy) {
          this.state.submissions[idx] = { ...this.state.submissions[idx], ...sub, updatedAt: new Date().toISOString() };
        }
      } else {
        this.state.submissions.push({ ...sub, updatedAt: new Date().toISOString() });
      }
    });

    this.addAuditLog(
      actor.userId,
      actor.displayName,
      'BATCH_SUBMISSION_RECORD',
      'SUBMISSION',
      'MULTIPLE',
      `${submissions.length} сурагчийн даалгаврын гүйцэтгэлийг бүртгэв.`
    );
    this.saveState();
    void this.syncSubmissionProgressToSheet(submissions);
  }

  public mergeSubmissionsFromSheet(sheetSubmissions: Submission[]): number {
    let count = 0;
    sheetSubmissions.forEach(sub => {
      const idx = this.state.submissions.findIndex(
        s => (s.submissionId === sub.submissionId) || (s.homeworkId === sub.homeworkId && s.studentId === sub.studentId)
      );
      if (idx >= 0) {
        this.state.submissions[idx] = {
          ...this.state.submissions[idx],
          ...sub,
          updatedAt: sub.updatedAt || new Date().toISOString()
        };
      } else {
        this.state.submissions.push({
          ...sub,
          updatedAt: sub.updatedAt || new Date().toISOString()
        });
      }
      count++;
    });
    this.saveState();
    return count;
  }

  public verifySubmission(actor: User, submissionId: string, status: SubmissionStatus, comment?: string): boolean {
    const sub = this.state.submissions.find(s => s.submissionId === submissionId);
    if (!sub) return false;

    sub.status = status;
    sub.checkedBy = actor.userId;
    sub.checkedAt = new Date().toISOString();
    if (comment !== undefined) sub.teacherComment = comment;
    sub.updatedAt = new Date().toISOString();

    this.addAuditLog(
      actor.userId,
      actor.displayName,
      'VERIFY_SUBMISSION',
      'SUBMISSION',
      submissionId,
      `Багш даалгаврыг шалгаж, төлөвийг "${status}" болголоо.`
    );
    this.saveState();
    void this.syncSubmissionProgressToSheet([sub]);
    return true;
  }

  public studentSubmitHomework(actor: User, homeworkId: string, note?: string, attachmentUrl?: string): Submission {
    if (!actor.studentId) throw new Error('Зөвхөн сурагч өөрөө даалгавраа илгээх боломжтой.');

    const existingIdx = this.state.submissions.findIndex(
      s => s.homeworkId === homeworkId && s.studentId === actor.studentId
    );

    const now = new Date().toISOString();
    let submission: Submission;

    if (existingIdx >= 0) {
      this.state.submissions[existingIdx].status = 'SUBMITTED_FOR_REVIEW';
      this.state.submissions[existingIdx].submittedAt = now;
      this.state.submissions[existingIdx].studentNote = note;
      this.state.submissions[existingIdx].studentAttachmentUrl = attachmentUrl;
      this.state.submissions[existingIdx].updatedAt = now;
      submission = this.state.submissions[existingIdx];
    } else {
      submission = {
        submissionId: 'subm_' + Math.random().toString(36).substring(2, 9),
        homeworkId,
        studentId: actor.studentId,
        status: 'SUBMITTED_FOR_REVIEW',
        submittedAt: now,
        studentNote: note,
        studentAttachmentUrl: attachmentUrl,
        updatedAt: now
      };
      this.state.submissions.push(submission);
    }

    this.addAuditLog(
      actor.userId,
      actor.displayName,
      'STUDENT_SUBMIT',
      'SUBMISSION',
      submission.submissionId,
      'Сурагч даалгавраа багшид шалгуулахаар илгээв.'
    );
    this.saveState();
    void this.syncSubmissionProgressToSheet([submission]);
    return submission;
  }

  public assignLeader(actor: User, studentId: string, classId: string, active: boolean): void {
    const student = this.state.students.find(s => s.studentId === studentId);
    if (!student) return;

    let user = this.state.users.find(u => u.studentId === studentId);
    if (!user) {
      user = {
        userId: 'u_' + student.studentCode.toLowerCase().replace(/[^a-z0-9]/g, '_'),
        username: student.studentCode.toLowerCase(),
        passwordHash: '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918',
        role: active ? 'LEADER' : 'STUDENT',
        studentId: student.studentId,
        active: true,
        displayName: `${student.fullName} (${active ? 'Ахлагч' : 'Сурагч'})`,
        createdAt: new Date().toISOString()
      };
      this.state.users.push(user);
    } else {
      user.role = active ? 'LEADER' : 'STUDENT';
      user.displayName = `${student.fullName} (${active ? 'Ахлагч' : 'Сурагч'})`;
    }

    const leaderIdx = this.state.leaders.findIndex(l => l.userId === user?.userId);
    if (leaderIdx >= 0) {
      this.state.leaders[leaderIdx].active = active;
    } else if (active && user) {
      this.state.leaders.push({
        leaderId: 'lead_' + Math.random().toString(36).substring(2, 9),
        userId: user.userId,
        classId,
        assignedBy: actor.userId,
        active: true,
        createdAt: new Date().toISOString()
      });
    }

    this.addAuditLog(
      actor.userId,
      actor.displayName,
      'ASSIGN_LEADER',
      'LEADER',
      studentId,
      `${student.fullName} сурагчийн хэсгийн ахлагчийн эрхийг ${active ? 'олгов' : 'цуцлав'}.`
    );
    this.saveState();
  }

  // --- Class Group Division & Leader Assignment (2 to 5 groups) ---

  public getGroups(classId: string): ClassGroup[] {
    if (!this.state.groups) {
      this.state.groups = [];
    }
    let classGroups = this.state.groups.filter(g => g.classId === classId);
    if (classGroups.length === 0) {
      // Auto-initialize standard 3 groups if not already created
      classGroups = this.splitClassIntoGroups({ userId: 'system', username: 'system', displayName: 'Систем', role: 'TEACHER', active: true, createdAt: '' }, classId, 3);
    }
    return classGroups.sort((a, b) => a.groupNumber - b.groupNumber);
  }

  public splitClassIntoGroups(actor: User, classId: string, groupCount: number): ClassGroup[] {
    const validCount = Math.max(1, Math.min(5, groupCount));
    const activeStudents = this.state.students.filter(s => s.classId === classId && s.active);

    const GROUP_COLORS = ['blue', 'emerald', 'amber', 'purple', 'rose'];

    // 1. Create the groups
    const newGroups: ClassGroup[] = [];
    for (let i = 1; i <= validCount; i++) {
      const gId = `grp_${classId}_${i}`;
      newGroups.push({
        groupId: gId,
        classId,
        groupNumber: i,
        name: `${i}-р хэсэг`,
        color: GROUP_COLORS[i - 1] || 'blue'
      });
    }

    // 2. Distribute active students across groups evenly
    activeStudents.forEach((student, index) => {
      const gIndex = index % validCount;
      const targetGroup = newGroups[gIndex];
      student.groupId = targetGroup.groupId;
      student.groupNumber = targetGroup.groupNumber;
      student.groupName = targetGroup.name;
    });

    // 3. For each group, assign a leader and provision accounts
    newGroups.forEach(grp => {
      const groupStudents = activeStudents.filter(s => s.groupId === grp.groupId);
      // Check if existing leader is in this group
      let leaderStudent = groupStudents.find(s => s.isLeader);
      if (!leaderStudent && groupStudents.length > 0) {
        leaderStudent = groupStudents[0];
      }

      // Mark leader vs non-leader
      groupStudents.forEach(s => {
        s.isLeader = (leaderStudent && s.studentId === leaderStudent.studentId) || false;
      });

      if (leaderStudent) {
        leaderStudent.isLeader = true;
        grp.leaderStudentId = leaderStudent.studentId;
        grp.leaderName = leaderStudent.fullName;

        // Ensure user account exists and has LEADER role
        let user = this.state.users.find(u => u.studentId === leaderStudent?.studentId);
        if (!user) {
          user = {
            userId: 'u_' + leaderStudent.studentCode.toLowerCase().replace(/[^a-z0-9]/g, '_'),
            username: leaderStudent.studentCode.toLowerCase(),
            passwordHash: '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918',
            role: 'LEADER',
            studentId: leaderStudent.studentId,
            active: true,
            displayName: `${leaderStudent.fullName} (${grp.name} Ахлагч)`,
            createdAt: new Date().toISOString()
          };
          this.state.users.push(user);
        } else {
          user.role = 'LEADER';
          user.displayName = `${leaderStudent.fullName} (${grp.name} Ахлагч)`;
        }
        grp.leaderUserId = user.userId;

        // Sync in leaders list
        const leaderIdx = this.state.leaders.findIndex(l => l.userId === user?.userId);
        if (leaderIdx >= 0) {
          this.state.leaders[leaderIdx].classId = classId;
          this.state.leaders[leaderIdx].groupId = grp.groupId;
          this.state.leaders[leaderIdx].groupNumber = grp.groupNumber;
          this.state.leaders[leaderIdx].active = true;
        } else {
          this.state.leaders.push({
            leaderId: 'lead_' + Math.random().toString(36).substring(2, 9),
            userId: user.userId,
            classId,
            groupId: grp.groupId,
            groupNumber: grp.groupNumber,
            assignedBy: actor.userId,
            active: true,
            createdAt: new Date().toISOString()
          });
        }
      }

      // Also ensure normal student user accounts exist so any student can log in
      groupStudents.forEach(st => {
        if (!st.isLeader) {
          let stUser = this.state.users.find(u => u.studentId === st.studentId);
          if (!stUser) {
            stUser = {
              userId: 'u_' + st.studentCode.toLowerCase().replace(/[^a-z0-9]/g, '_'),
              username: st.studentCode.toLowerCase(),
              passwordHash: '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918',
              role: 'STUDENT',
              studentId: st.studentId,
              active: true,
              displayName: `${st.fullName} (${grp.name} Сурагч)`,
              createdAt: new Date().toISOString()
            };
            this.state.users.push(stUser);
          } else if (stUser.role === 'LEADER') {
            stUser.role = 'STUDENT';
            stUser.displayName = `${st.fullName} (${grp.name} Сурагч)`;
          }
        }
      });
    });

    // Remove old groups for this class and save new ones
    if (!this.state.groups) this.state.groups = [];
    this.state.groups = this.state.groups.filter(g => g.classId !== classId).concat(newGroups);

    this.addAuditLog(
      actor.userId,
      actor.displayName,
      'SPLIT_CLASS_GROUPS',
      'CLASS',
      classId,
      `${classId} ангийн нийт ${activeStudents.length} сурагчийг ${validCount} хэсэгт хувааж, хэсэг бүрт ахлагч томилов.`
    );

    this.saveState();
    return newGroups;
  }

  public setGroupLeader(actor: User, classId: string, groupId: string, studentId: string): void {
    if (!this.state.groups) this.state.groups = [];
    const group = this.state.groups.find(g => g.groupId === groupId && g.classId === classId);
    if (!group) return;

    const student = this.state.students.find(s => s.studentId === studentId);
    if (!student) return;

    // Reset previous leader in this group
    this.state.students
      .filter(s => s.groupId === groupId)
      .forEach(s => {
        if (s.studentId !== studentId) {
          s.isLeader = false;
        }
      });

    student.isLeader = true;
    student.groupId = groupId;
    student.groupNumber = group.groupNumber;
    student.groupName = group.name;

    group.leaderStudentId = student.studentId;
    group.leaderName = student.fullName;

    // Ensure user role
    let user = this.state.users.find(u => u.studentId === student.studentId);
    if (!user) {
      user = {
        userId: 'u_' + student.studentCode.toLowerCase().replace(/[^a-z0-9]/g, '_'),
        username: student.studentCode.toLowerCase(),
        passwordHash: '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918',
        role: 'LEADER',
        studentId: student.studentId,
        active: true,
        displayName: `${student.fullName} (${group.name} Ахлагч)`,
        createdAt: new Date().toISOString()
      };
      this.state.users.push(user);
    } else {
      user.role = 'LEADER';
      user.displayName = `${student.fullName} (${group.name} Ахлагч)`;
    }
    group.leaderUserId = user.userId;

    const lIdx = this.state.leaders.findIndex(l => l.userId === user?.userId);
    if (lIdx >= 0) {
      this.state.leaders[lIdx].groupId = groupId;
      this.state.leaders[lIdx].groupNumber = group.groupNumber;
      this.state.leaders[lIdx].active = true;
    } else {
      this.state.leaders.push({
        leaderId: 'lead_' + Math.random().toString(36).substring(2, 9),
        userId: user.userId,
        classId,
        groupId,
        groupNumber: group.groupNumber,
        assignedBy: actor.userId,
        active: true,
        createdAt: new Date().toISOString()
      });
    }

    this.addAuditLog(
      actor.userId,
      actor.displayName,
      'SET_GROUP_LEADER',
      'GROUP',
      groupId,
      `${classId} ангийн ${group.name}-ийн ахлагчаар ${student.fullName} сурагчийг томилов.`
    );
    this.saveState();
  }

  public moveStudentToGroup(actor: User, studentId: string, targetGroupId: string): void {
    const student = this.state.students.find(s => s.studentId === studentId);
    if (!student) return;

    const group = this.state.groups?.find(g => g.groupId === targetGroupId);
    if (!group) return;

    student.groupId = targetGroupId;
    student.groupNumber = group.groupNumber;
    student.groupName = group.name;

    this.addAuditLog(
      actor.userId,
      actor.displayName,
      'MOVE_STUDENT_GROUP',
      'STUDENT',
      studentId,
      `${student.fullName} сурагчийг ${group.name} руу шилжүүлэв.`
    );
    this.saveState();
  }

  private addAuditLog(userId: string, userName: string, action: string, targetType: string, targetId: string, details: string) {
    const todayStr = getTodayUlaanbaatar();
    const nowTime = new Date().toTimeString().split(' ')[0];
    const entry: AuditLogEntry = {
      logId: 'log_' + Math.random().toString(36).substring(2, 9),
      userId,
      userName,
      action,
      targetType,
      targetId,
      timestamp: `${todayStr} ${nowTime}`,
      details
    };
    this.state.auditLogs.unshift(entry);
    if (this.state.auditLogs.length > 200) {
      this.state.auditLogs.pop();
    }
  }
}

export const dataService = new DataService();
