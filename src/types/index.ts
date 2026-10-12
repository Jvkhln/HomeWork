export type UserRole = 'TEACHER' | 'LEADER' | 'STUDENT';

export type SubmissionStatus = 
  | 'EXCELLENT'             // Маш сайн
  | 'AVERAGE'               // Дунд
  | 'NOT_DONE'              // Хийгээгүй
  | 'DONE'                  // Хийсэн (хуучин бичилттэй нийцтэй)
  | 'IN_PROGRESS'           // Хийж байгаа
  | 'LATE'                  // Хоцорч хийсэн
  | 'SUBMITTED_FOR_REVIEW'; // Багшид шалгуулахаар илгээсэн

export const SUBMISSION_STATUS_LABELS: Record<SubmissionStatus, string> = {
  EXCELLENT: 'Маш сайн',
  AVERAGE: 'Дунд',
  NOT_DONE: 'Хийгээгүй',
  DONE: 'Маш сайн',
  IN_PROGRESS: 'Дунд',
  LATE: 'Хоцорч хийсэн',
  SUBMITTED_FOR_REVIEW: 'Шалгуулахаар илгээсэн'
};

export const SUBMISSION_STATUS_COLORS: Record<SubmissionStatus, { bg: string; text: string; border: string }> = {
  EXCELLENT: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  AVERAGE: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  NOT_DONE: { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' },
  DONE: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  IN_PROGRESS: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  LATE: { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
  SUBMITTED_FOR_REVIEW: { bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-200' }
};

export interface User {
  userId: string;
  username: string;
  passwordHash?: string;
  role: UserRole;
  studentId?: string;
  active: boolean;
  displayName: string;
  createdAt: string;
}

export interface Student {
  studentId: string;
  studentCode: string;
  fullName: string;
  classId: string;
  active: boolean;
  publicDisplayName: string;
  showOnLeaderboard: boolean;
  groupId?: string; // e.g. "grp_10A_1", "grp_10A_2"
  groupNumber?: number; // 1, 2, 3, 4, 5
  groupName?: string; // e.g. "1-р хэсэг"
  isLeader?: boolean;
}

export interface ClassGroup {
  groupId: string;
  classId: string;
  groupNumber: number; // 1 to 5
  name: string; // e.g. "1-р хэсэг"
  leaderStudentId?: string; // studentId of the leader
  leaderUserId?: string;    // userId of the leader
  leaderName?: string;
  color?: string; // badge color e.g. blue, emerald, amber, purple, rose
}
export interface SubjectType {
  subjectId: string;
  name: string;
  code?: string;
  color?: string;
  defaultTeacher?: string;
  category?: string;
  active: boolean;
}

export interface ScheduleItem {
  scheduleId: string;
  classId: string;
  weekday: number; // 1: Даваа, 2: Мягмар, 3: Лхагва, 4: Пүрэв, 5: Баасан
  period: number;  // 1 to 7
  subjectId: string;
  subjectName: string;
  teacherName: string;
  startTime: string; // e.g. "08:00"
  endTime: string;   // e.g. "08:45"
  active: boolean;
  notes?: string;
}

export interface Homework {
  homeworkId: string;
  classId: string;
  subjectId: string;
  subjectName: string;
  title: string;
  description: string;
  assignedDate: string; // YYYY-MM-DD
  dueDate: string;      // YYYY-MM-DD
  createdBy: string;    // userId
  status: 'ACTIVE' | 'CANCELLED';
  createdAt: string;
}

export interface Submission {
  submissionId: string;
  homeworkId: string;
  studentId: string;
  status: SubmissionStatus;
  submittedAt?: string;
  checkedBy?: string;     // teacher userId
  checkedAt?: string;
  teacherComment?: string;
  studentNote?: string;
  studentAttachmentUrl?: string;
  updatedAt: string;
}

export interface Leader {
  leaderId: string;
  userId: string;
  classId: string;
  groupId?: string;
  groupNumber?: number;
  assignedBy: string;
  active: boolean;
  createdAt: string;
}

export interface AuditLogEntry {
  logId: string;
  userId: string;
  userName: string;
  action: string;
  targetType: string;
  targetId: string;
  timestamp: string;
  details: string;
}

export interface SystemSettings {
  mode: 'DEMO' | 'GOOGLE_SHEETS';
  gasWebAppUrl: string;
  sheetId: string;
  schoolName: string;
  termName: string;
  lastSyncAt: string | null;
}

export interface LeaderboardEntry {
  studentId: string;
  publicDisplayName: string;
  classId: string;
  completionRate: number;
  totalCompleted: number;
  onTimeCompleted: number;
  totalAssigned: number;
  rank: number;
}
