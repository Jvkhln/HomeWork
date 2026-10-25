import React, { useState } from 'react';
import {
  Users,
  BookOpen,
  Calendar,
  BarChart3,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Download,
  Plus,
  ShieldCheck,
  Search,
  Filter,
  Check,
  UserCheck,
  Eye,
  Edit,
  History,
  FileSpreadsheet,
  RefreshCw,
  Info
} from 'lucide-react';
import { dataService } from '../services/dataService';
import { useAuth } from '../context/AuthContext';
import { Student, Homework, Submission, SubmissionStatus, SUBMISSION_STATUS_LABELS, SUBMISSION_STATUS_COLORS } from '../types';
import { WeeklyBarChart, SubjectProgressBarChart, StatusDonutChart } from './Charts';
import { ScheduleManager } from './ScheduleManager';
import { HomeworkModal } from './HomeworkModal';
import { StudentModal } from './StudentModal';
import { VerificationModal } from './VerificationModal';
import { AuditLogView } from './AuditLogView';
import { getTodayUlaanbaatar, getWeekRange, getMonthRange } from '../utils/dateUtils';
import { exportToCSV } from '../utils/csvExport';

export const TeacherDashboard: React.FC = () => {
  const { currentUser, showToast } = useAuth();

  // Navigation tab
  const [activeTab, setActiveTab] = useState<'overview' | 'homework' | 'reviews' | 'groups' | 'students' | 'schedule' | 'reports' | 'audit'>('overview');

  // Filters
  const [selectedClass, setSelectedClass] = useState<string>('ALL');
  const [timeframe, setTimeframe] = useState<'WEEK' | 'MONTH' | 'ALL'>('WEEK');

  // Class Groups state (1 to 5 groups)
  const [targetGroupClass, setTargetGroupClass] = useState<string>('10А');
  const [selectedGroupCount, setSelectedGroupCount] = useState<number>(3);

  // Modal controls
  const [isHomeworkModalOpen, setIsHomeworkModalOpen] = useState(false);
  const [editingHomework, setEditingHomework] = useState<Homework | null>(null);

  const [isStudentModalOpen, setIsStudentModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);

  const [selectedSubmission, setSelectedSubmission] = useState<{
    sub: Submission;
    studentName: string;
    hwTitle: string;
  } | null>(null);

  // Search in tabs
  const [studentSearch, setStudentSearch] = useState('');
  const [reviewSearch, setReviewSearch] = useState('');
  const [reviewStatusFilter, setReviewStatusFilter] = useState<string>('ALL');
  const [isPullingSheet, setIsPullingSheet] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handlePullLatestFromSheet = async () => {
    setIsPullingSheet(true);
    try {
      if (!dataService.isSheetsMode()) {
        setRefreshTrigger(prev => prev + 1);
        showToast('info', 'Шинэчлэгдлээ', 'Демо горимд ажиллаж байна. Google Sheets холбоогүй.');
        return;
      }
      const res = await dataService.syncUsers();
      setRefreshTrigger(prev => prev + 1);
      showToast(res.success ? 'success' : 'error', res.success ? 'Users Sheet & Өгөгдөл Sync хийгдлээ' : 'Sync хийхэд алдаа гарлаа', res.message);
    } finally {
      setIsPullingSheet(false);
    }
  };

  // Date ranges
  const today = getTodayUlaanbaatar();
  const weekRange = getWeekRange();
  const monthRange = getMonthRange();

  let startDate: string | undefined;
  let endDate: string | undefined;
  if (timeframe === 'WEEK') {
    startDate = weekRange.start;
    endDate = weekRange.end;
  } else if (timeframe === 'MONTH') {
    startDate = monthRange.start;
    endDate = monthRange.end;
  }

  const classes = dataService.getClasses();
  const targetClass = selectedClass === 'ALL' ? undefined : selectedClass;

  // Data fetching
  const stats = dataService.getStats(targetClass, startDate, endDate);
  const subjectStats = dataService.getSubjectStats(targetClass);
  const dailyStats = dataService.getDailyCompletionStats(targetClass);
  const leaderboard = dataService.getLeaderboard(targetClass, startDate, endDate);
  const needingSupport = dataService.getStudentsNeedingSupport(targetClass);
  const students = dataService.getStudents(targetClass);
  const homeworkList = dataService.getHomework(targetClass);
  const submissions = dataService.getSubmissions();
  const leaders = dataService.getLeaders(targetClass);

  // Student list helpers
  const filteredStudents = students.filter(s =>
    s.fullName.toLowerCase().includes(studentSearch.toLowerCase()) ||
    s.studentCode.toLowerCase().includes(studentSearch.toLowerCase()) ||
    s.classId.toLowerCase().includes(studentSearch.toLowerCase())
  );

  // Submissions review helpers
  const homeworkMap = new Map(homeworkList.map(h => [h.homeworkId, h]));
  const studentMap = new Map(students.map(s => [s.studentId, s]));

  const reviewList = submissions.filter(sub => {
    const hw = homeworkMap.get(sub.homeworkId);
    const st = studentMap.get(sub.studentId);
    if (!hw || !st) return false;

    if (reviewStatusFilter !== 'ALL' && sub.status !== reviewStatusFilter) return false;

    const term = reviewSearch.toLowerCase();
    return (
      st.fullName.toLowerCase().includes(term) ||
      st.studentCode.toLowerCase().includes(term) ||
      hw.title.toLowerCase().includes(term) ||
      hw.subjectName.toLowerCase().includes(term)
    );
  });

  const targetClassStudents = dataService.getStudents(targetGroupClass).filter(s => s.active);
  const classGroups = dataService.getGroups(targetGroupClass);
  const allUsers = dataService.getUsers();

  const handleSplitGroups = () => {
    if (!currentUser) return;
    dataService.splitClassIntoGroups(currentUser, targetGroupClass, selectedGroupCount);
    setRefreshTrigger(prev => prev + 1);
    showToast(
      'success',
      'Амжилттай хуваариллаа',
      `${targetGroupClass} ангийн ${targetClassStudents.length} сурагчийг ${selectedGroupCount} хэсэгт хувааж, хэсэг бүрт ахлагч томиллоо.`
    );
  };

  const handleSetLeader = (groupId: string, studentId: string) => {
    if (!currentUser) return;
    dataService.setGroupLeader(currentUser, targetGroupClass, groupId, studentId);
    setRefreshTrigger(prev => prev + 1);
    const st = targetClassStudents.find(s => s.studentId === studentId);
    showToast('success', 'Хэсгийн ахлагч томилогдлоо', `${st?.fullName || 'Сурагч'} тус хэсгийн ахлагчаар томилогдлоо.`);
  };

  const handleMoveStudent = (studentId: string, targetGroupId: string) => {
    if (!currentUser) return;
    dataService.moveStudentToGroup(currentUser, studentId, targetGroupId);
    setRefreshTrigger(prev => prev + 1);
    showToast('info', 'Сурагчийг шилжүүллээ', 'Сурагчийн харьяалагдах хэсэг шинэчлэгдлээ.');
  };

  const handleToggleStudent = (studentId: string) => {
    if (!currentUser) return;
    dataService.toggleStudentStatus(currentUser, studentId);
    showToast('info', 'Сурагчийн төлөв өөрчлөгдлөө');
  };

  const handleToggleLeader = (student: Student) => {
    if (!currentUser) return;
    const isCurrentlyLeader = leaders.some(l => {
      const u = dataService.getUsers().find(user => user.studentId === student.studentId);
      return u && l.userId === u.userId;
    });

    dataService.assignLeader(currentUser, student.studentId, student.classId, !isCurrentlyLeader);
    showToast('success', 'Ахлагчийн эрх өөрчлөгдлөө', `${student.fullName} сурагчийн ахлагчийн эрхийг ${!isCurrentlyLeader ? 'олгов' : 'цуцлав'}`);
  };

  const handleExportCSV = () => {
    const headers = [
      'Сурагчийн код',
      'Овог нэр',
      'Анги',
      'Даалгаврын нэр',
      'Хичээл',
      'Гүйцэтгэлийн төлөв',
      'Өгсөн огноо',
      'Шалгасан огноо',
      'Багшийн санал'
    ];

    const rows = submissions.map(sub => {
      const hw = homeworkMap.get(sub.homeworkId);
      const st = studentMap.get(sub.studentId);
      return [
        st?.studentCode || '-',
        st?.fullName || '-',
        st?.classId || '-',
        hw?.title || '-',
        hw?.subjectName || '-',
        SUBMISSION_STATUS_LABELS[sub.status] || sub.status,
        hw?.assignedDate || '-',
        sub.checkedAt ? sub.checkedAt.substring(0, 10) : '-',
        sub.teacherComment || '-'
      ];
    });

    const filename = `Гэрийн_даалгаврын_тайлан_${selectedClass}_${today}`;
    exportToCSV(filename, headers, rows);
    showToast('success', 'Excel/CSV файл татагдлаа', `${filename}.csv амжилттай үүслээ.`);
  };

  return (
    <div className="space-y-6 pb-12 animate-fadeIn">
      {/* Top Banner / Actions Bar */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-blue-50 text-blue-700 font-bold text-xs flex items-center gap-1.5 border border-blue-200/60">
              <ShieldCheck className="w-4 h-4 text-blue-600" />
              Багш / Админ
            </span>
            <h2 className="text-lg font-black text-slate-900 tracking-tight">
              Багшийн удирдлагын хяналтын самбар
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1.5">
            Сурагчдын гэрийн даалгаврын бүртгэл, баталгаажуулалт, хичээлийн хуваарь болон аналитик тайлангууд.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 self-stretch md:self-auto">
          {/* Class selector */}
          <select
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
            className="text-xs font-semibold bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-800 rounded-xl px-3.5 py-2 cursor-pointer transition-colors"
          >
            <option value="ALL">Бүх ангиуд</option>
            {classes.map(c => (
              <option key={c} value={c}>{c} анги</option>
            ))}
          </select>

          {/* Timeframe */}
          <select
            value={timeframe}
            onChange={(e) => setTimeframe(e.target.value as 'WEEK' | 'MONTH' | 'ALL')}
            className="text-xs font-semibold bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-800 rounded-xl px-3.5 py-2 cursor-pointer transition-colors"
          >
            <option value="WEEK">Энэ 7 хоног</option>
            <option value="MONTH">Энэ сар</option>
            <option value="ALL">Бүх хугацаа</option>
          </select>

          {/* Actions */}
          <button
            onClick={handlePullLatestFromSheet}
            disabled={isPullingSheet}
            title="Users sheet-ийн cache шинэчлэх болон бүх өгөгдөл Sync хийх (syncUsers)"
            className="flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs rounded-xl shadow-xs hover:shadow-md transition-all disabled:opacity-50 active:scale-95"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isPullingSheet ? 'animate-spin' : ''}`} />
            <span>{isPullingSheet ? 'Sync хийж байна...' : 'Sync хийх'}</span>
          </button>

          <button
            onClick={handleExportCSV}
            title="Excel/CSV файл татах"
            className="flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs rounded-xl shadow-xs hover:shadow-md transition-all active:scale-95"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Excel/CSV татах</span>
          </button>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex gap-2 border-b border-slate-200 overflow-x-auto pb-1 text-xs">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2 font-semibold rounded-lg flex items-center gap-2 whitespace-nowrap transition-colors ${
            activeTab === 'overview'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          Хяналт & Статистик
        </button>

        <button
          onClick={() => setActiveTab('homework')}
          className={`px-4 py-2 font-semibold rounded-lg flex items-center gap-2 whitespace-nowrap transition-colors ${
            activeTab === 'homework'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          Дэвтрийн шалгалтууд ({homeworkList.length})
        </button>

        <button
          onClick={() => setActiveTab('reviews')}
          className={`px-4 py-2 font-semibold rounded-lg flex items-center gap-2 whitespace-nowrap transition-colors ${
            activeTab === 'reviews'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <CheckCircle2 className="w-4 h-4" />
          Сурагч бүрээр баталгаажуулах
        </button>

        <button
          onClick={() => setActiveTab('groups')}
          className={`px-4 py-2 font-semibold rounded-lg flex items-center gap-2 whitespace-nowrap transition-colors ${
            activeTab === 'groups'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Users className="w-4 h-4" />
          Ангийн хэсэг & Ахлагчид (1-5 хэсэг)
        </button>

        <button
          onClick={() => setActiveTab('students')}
          className={`px-4 py-2 font-semibold rounded-lg flex items-center gap-2 whitespace-nowrap transition-colors ${
            activeTab === 'students'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Users className="w-4 h-4" />
          Сурагчид & Ахлагч ({students.length})
        </button>

        <button
          onClick={() => setActiveTab('schedule')}
          className={`px-4 py-2 font-semibold rounded-lg flex items-center gap-2 whitespace-nowrap transition-colors ${
            activeTab === 'schedule'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Calendar className="w-4 h-4" />
          Хичээлийн хуваарь
        </button>

        <button
          onClick={() => setActiveTab('reports')}
          className={`px-4 py-2 font-semibold rounded-lg flex items-center gap-2 whitespace-nowrap transition-colors ${
            activeTab === 'reports'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Download className="w-4 h-4" />
          Тайлан & Экспорт
        </button>

        <button
          onClick={() => setActiveTab('audit')}
          className={`px-4 py-2 font-semibold rounded-lg flex items-center gap-2 whitespace-nowrap transition-colors ${
            activeTab === 'audit'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <History className="w-4 h-4" />
          Үйлдлийн түүх
        </button>
      </div>

      {/* TAB 1: OVERVIEW & STATS */}
      {activeTab === 'overview' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Key Metrics Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 text-xs">
            <div className="bg-white p-3.5 rounded-xl border border-slate-200">
              <span className="text-[11px] font-semibold text-slate-400 block">Нийт сурагч</span>
              <span className="text-xl font-bold text-slate-900 mt-1 block">{stats.totalStudents}</span>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-slate-200">
              <span className="text-[11px] font-semibold text-slate-400 block">Шалгасан хичээл</span>
              <span className="text-xl font-bold text-slate-900 mt-1 block">{stats.totalHomework}</span>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/20">
              <span className="text-[11px] font-bold text-emerald-700 block">Маш сайн</span>
              <span className="text-xl font-black text-emerald-600 mt-1 block">{stats.excellentCount}</span>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-amber-200 bg-amber-50/20">
              <span className="text-[11px] font-bold text-amber-700 block">Дунд</span>
              <span className="text-xl font-black text-amber-600 mt-1 block">{stats.averageCount}</span>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-rose-200 bg-rose-50/20">
              <span className="text-[11px] font-bold text-rose-700 block">Хийгээгүй</span>
              <span className="text-xl font-black text-rose-600 mt-1 block">{stats.notDoneCount}</span>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-blue-200 bg-blue-50/20">
              <span className="text-[11px] font-semibold text-blue-700 block">Шалгуулах</span>
              <span className="text-xl font-bold text-blue-600 mt-1 block">{stats.submittedForReviewCount}</span>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-blue-200 bg-blue-50/40 col-span-2 sm:col-span-1">
              <span className="text-[11px] font-bold text-blue-800 block">Дундаж гүйцэтгэл</span>
              <span className="text-xl font-extrabold text-blue-800 mt-1 block">{stats.completionRate}%</span>
            </div>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Status Donut */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3">
                Гүйцэтгэлийн төлөвийн хуваарилалт
              </h3>
              <StatusDonutChart
                done={stats.onTimeCount}
                late={stats.lateCount}
                inProgress={stats.inProgressCount}
                notDone={stats.notDoneCount}
                submitted={stats.submittedForReviewCount}
              />
              <div className="text-[11px] text-slate-400 text-center mt-3 pt-2 border-t border-slate-100">
                Сонгогдсон хугацааны даалгавруудын нэгдсэн бүтэц
              </div>
            </div>

            {/* Weekly Daily Trend */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3">
                7 хоногийн өдрүүдийн гүйцэтгэл (%)
              </h3>
              <WeeklyBarChart data={dailyStats} height={180} />
              <div className="text-[11px] text-slate-400 text-center mt-3 pt-2 border-t border-slate-100">
                Даваа-Баасан гарагийн дундаж ачаалал ба идэвх
              </div>
            </div>

            {/* Subject breakdown */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3">
                Хичээл тус бүрийн гүйцэтгэл
              </h3>
              <div className="overflow-y-auto max-h-[220px] pr-1">
                <SubjectProgressBarChart data={subjectStats} />
              </div>
              <div className="text-[11px] text-slate-400 text-center mt-3 pt-2 border-t border-slate-100">
                Нийт даалгаврын хувиар эрэмбэлэгдсэн
              </div>
            </div>
          </div>

          {/* Section 5 Requirement: Students Needing Support + Top 5 Performers */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top 5 Performers */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Хамгийн сайн гүйцэтгэлтэй 5 сурагч
                </h3>
                <span className="text-xs text-slate-400 font-medium">Эрэмбэ</span>
              </div>

              <div className="space-y-2.5">
                {leaderboard.map((item) => (
                  <div
                    key={item.studentId}
                    className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-100 text-xs"
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-800 font-bold flex items-center justify-center text-xs">
                        #{item.rank}
                      </span>
                      <div>
                        <div className="font-bold text-slate-900">{item.publicDisplayName}</div>
                        <div className="text-[11px] text-slate-500">
                          {item.classId} · Хугацаандаа: {item.onTimeCompleted}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-extrabold text-blue-600 text-sm">{item.completionRate}%</div>
                      <div className="text-[10px] text-slate-400">{item.totalCompleted}/{item.totalAssigned} даалгавар</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Students Needing Support (Mandatory Teacher private report requirement) */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2 text-rose-700">
                  <AlertTriangle className="w-4 h-4 text-rose-600" />
                  Дэмжлэг үзүүлэх шаардлагатай сурагчид
                </h3>
                <span className="text-[11px] text-rose-500 font-semibold bg-rose-50 px-2 py-0.5 rounded">
                  Багшийн хувийн тайлан
                </span>
              </div>

              {needingSupport.length === 0 ? (
                <div className="py-8 text-center text-emerald-600 text-xs font-medium">
                  Бүх сурагчдын даалгаврын гүйцэтгэл 60%-иас дээш байна!
                </div>
              ) : (
                <div className="space-y-2.5">
                  {needingSupport.map((item) => (
                    <div
                      key={item.student.studentId}
                      className="flex items-center justify-between p-3 rounded-lg bg-rose-50/50 border border-rose-200/60 text-xs"
                    >
                      <div>
                        <div className="font-bold text-slate-900">
                          {item.student.fullName} ({item.student.studentCode})
                        </div>
                        <div className="text-[11px] text-rose-700 mt-0.5">
                          {item.missing} даалгавар дутуу эсвэл хийгээгүй
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-rose-600 text-sm">{item.completionRate}%</div>
                        <span className="text-[10px] text-slate-400">Гүйцэтгэл</span>
                      </div>
                    </div>
                  ))}
                  <div className="pt-2 text-[11px] text-slate-500 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                    💡 <strong>Зөвлөмж:</strong> Дээрх сурагчдад хувийн зөвлөгөө өгч, хичээлийн хоцрогдол арилгах тусгайлсан даалгавар өгөх боломжтой.
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: NOTEBOOK CHECKS RECORD */}
      {activeTab === 'homework' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-4 animate-fadeIn">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Хичээлийн дэвтрийн гэрийн даалгаврын шалгалтууд</h3>
              <p className="text-xs text-slate-500">
                Хичээл дээр хэсгийн ахлагч нарын шалгаж үнэлсэн дэвтрийн шалгалтууд
              </p>
            </div>
            <div className="text-xs text-emerald-800 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200 font-medium">
              ✓ Багш тусад нь даалгавар бичих шаардлагагүй, ахлагч нар хичээл дээр шууд бүртгэнэ
            </div>
          </div>

          <div className="space-y-3">
            {homeworkList.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs bg-slate-50 rounded-xl border border-dashed border-slate-200">
                Одоогоор бүртгэгдсэн дэвтрийн шалгалт алга байна. Хэсгийн ахлагч хичээл дээр сурагчдын дэвтрийг шалгаж хадгалахад энд шууд гарч ирнэ.
              </div>
            ) : (
              homeworkList.map((hw, idx) => {
                const hwSubs = submissions.filter(s => s.homeworkId === hw.homeworkId);
                const excellent = hwSubs.filter(s => s.status === 'EXCELLENT' || s.status === 'DONE').length;
                const average = hwSubs.filter(s => s.status === 'AVERAGE' || s.status === 'IN_PROGRESS').length;
                const notDone = hwSubs.filter(s => s.status === 'NOT_DONE').length;
                const doneCount = excellent + average;
                const targetStudents = students.filter(s => s.classId === hw.classId && s.active).length;
                const rate = targetStudents > 0 ? Math.round((doneCount / targetStudents) * 100) : 0;

                return (
                  <div
                    key={`${hw.homeworkId}-${idx}`}
                    className="p-4 rounded-xl border border-slate-200 hover:border-emerald-300 transition-all text-xs space-y-2.5 bg-slate-50/30"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded border border-emerald-200 text-[11px]">
                          {hw.subjectName} · {hw.classId}
                        </span>
                        <h4 className="font-bold text-slate-900 text-sm">{hw.title}</h4>
                      </div>

                      <div className="flex items-center gap-3 text-slate-500 text-[11px]">
                        <span>Шалгасан огноо: <strong className="text-slate-800">{hw.assignedDate}</strong></span>
                      </div>
                    </div>

                    <p className="text-slate-600 text-xs leading-relaxed">{hw.description}</p>

                    {/* Breakdown metrics */}
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <span className="bg-emerald-50 text-emerald-700 font-bold px-2 py-0.5 rounded border border-emerald-200 text-[11px]">
                        🌟 Маш сайн: {excellent}
                      </span>
                      <span className="bg-amber-50 text-amber-700 font-bold px-2 py-0.5 rounded border border-amber-200 text-[11px]">
                        ⚡ Дунд: {average}
                      </span>
                      <span className="bg-rose-50 text-rose-700 font-bold px-2 py-0.5 rounded border border-rose-200 text-[11px]">
                        ❌ Хийгээгүй: {notDone}
                      </span>
                    </div>

                    <div className="pt-2 flex items-center justify-between border-t border-slate-200 text-[11px]">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-500">Нийт гүйцэтгэл:</span>
                        <span className="font-bold text-slate-900">{doneCount} / {targetStudents} сурагч ({rate}%)</span>
                      </div>

                      <button
                        onClick={() => {
                          setReviewSearch(hw.title);
                          setActiveTab('reviews');
                        }}
                        className="text-emerald-700 font-bold hover:underline flex items-center gap-1"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Сурагч бүрийн үнэлгээг шалгах & баталгаажуулах
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* TAB 3: REVIEW & VERIFICATION */}
      {activeTab === 'reviews' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-4 animate-fadeIn">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Сурагчдын даалгавар шалгах & баталгаажуулах</h3>
              <p className="text-xs text-slate-500">Шалгуулахаар илгээсэн болон бусад төлөвтэй даалгавруудыг хянана.</p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={reviewSearch}
                  onChange={(e) => setReviewSearch(e.target.value)}
                  placeholder="Сурагч, даалгавраар хайх..."
                  className="pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs"
                />
              </div>

              <select
                value={reviewStatusFilter}
                onChange={(e) => setReviewStatusFilter(e.target.value)}
                className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-medium"
              >
                <option value="ALL">Бүх үнэлгээ</option>
                <option value="EXCELLENT">Маш сайн</option>
                <option value="AVERAGE">Дунд</option>
                <option value="NOT_DONE">Хийгээгүй</option>
                <option value="SUBMITTED_FOR_REVIEW">Шалгуулахаар илгээсэн</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-2.5 px-4">Сурагч</th>
                  <th className="py-2.5 px-4">Анги</th>
                  <th className="py-2.5 px-4">Даалгавар</th>
                  <th className="py-2.5 px-4">Төлөв</th>
                  <th className="py-2.5 px-4">Илгээсэн / Шалгасан</th>
                  <th className="py-2.5 px-4">Багшийн санал</th>
                  <th className="py-2.5 px-4 text-right">Үйлдэл</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {reviewList.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400">
                      Шалгах шаардлагатай даалгавар олдсонгүй.
                    </td>
                  </tr>
                ) : (
                  reviewList.map((sub) => {
                    const st = studentMap.get(sub.studentId);
                    const hw = homeworkMap.get(sub.homeworkId);
                    const color = SUBMISSION_STATUS_COLORS[sub.status];

                    return (
                      <tr key={sub.submissionId} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-2.5 px-4 font-semibold text-slate-900 whitespace-nowrap">
                          {st?.fullName}
                          <span className="block text-[11px] font-normal text-slate-400">{st?.studentCode}</span>
                        </td>
                        <td className="py-2.5 px-4 whitespace-nowrap">{st?.classId}</td>
                        <td className="py-2.5 px-4">
                          <span className="font-semibold text-slate-800">{hw?.title}</span>
                          <span className="block text-[11px] text-slate-500">{hw?.subjectName}</span>
                        </td>
                        <td className="py-2.5 px-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold border ${color.bg} ${color.text} ${color.border}`}>
                            {SUBMISSION_STATUS_LABELS[sub.status]}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 whitespace-nowrap text-slate-500 text-[11px]">
                          {sub.submittedAt ? sub.submittedAt.substring(0, 10) : '-'}
                          {sub.checkedAt && (
                            <span className="block text-emerald-600 font-medium">Шалгасан: {sub.checkedAt.substring(0, 10)}</span>
                          )}
                        </td>
                        <td className="py-2.5 px-4 text-slate-600 max-w-[200px] truncate">
                          {sub.teacherComment || <span className="text-slate-400 italic">Сэтгэгдэл алга</span>}
                        </td>
                        <td className="py-2.5 px-4 text-right whitespace-nowrap">
                          <button
                            onClick={() => {
                              setSelectedSubmission({
                                sub,
                                studentName: st?.fullName || 'Сурагч',
                                hwTitle: hw?.title || 'Даалгавар'
                              });
                            }}
                            className="px-3 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold rounded-md border border-blue-200 transition-colors"
                          >
                            Шалгах / Засах
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB: CLASS GROUPS & LEADERS (1 to 5 groups) */}
      {activeTab === 'groups' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Group Division Control Card */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-6 space-y-4">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2">
                  <span className="p-2 rounded-xl bg-blue-50 text-blue-700">
                    <Users className="w-5 h-5 text-blue-600" />
                  </span>
                  <h3 className="font-bold text-slate-900 text-base">
                    Ангийн сурагчдыг хэсэгт хуваах & Ахлагч томилох
                  </h3>
                </div>
                <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                  Ангийн багш ангийн нийт сурагчдыг 1-ээс 5 хүртэлх хэсэгт хуваах ба хэсэг дотроо хариуцсан ахлагчтай байна. Ахлагч нар хариуцсан хэсгийнхээ гэрийн даалгаврыг шалгаж үнэлгээ хийнэ.
                </p>
              </div>

              {/* Class Selector */}
              <div className="flex items-center gap-2 self-start md:self-auto">
                <span className="text-xs font-semibold text-slate-600">Сонгосон анги:</span>
                <select
                  value={targetGroupClass}
                  onChange={(e) => setTargetGroupClass(e.target.value)}
                  className="px-3 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-800 rounded-xl text-xs font-bold cursor-pointer transition-colors"
                >
                  {classes.map(c => (
                    <option key={c} value={c}>{c} анги</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Split controls */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50/70 p-4 rounded-xl border border-slate-200/80">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-xs font-bold text-slate-700">
                  Хэсгийн тоо (1-ээс 5 хүртэл):
                </span>
                <div className="flex items-center gap-1.5">
                  {[1, 2, 3, 4, 5].map(cnt => (
                    <button
                      key={cnt}
                      type="button"
                      onClick={() => setSelectedGroupCount(cnt)}
                      className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                        selectedGroupCount === cnt
                          ? 'bg-blue-600 text-white border-blue-600 shadow-xs ring-2 ring-blue-300'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {cnt} хэсэг
                    </button>
                  ))}
                </div>
                <span className="text-[11px] text-slate-500 font-medium ml-1">
                  ({targetClassStudents.length} сурагч, хэсэг бүрт дунджаар {Math.max(1, Math.round(targetClassStudents.length / selectedGroupCount))} сурагч)
                </span>
              </div>

              <button
                type="button"
                onClick={handleSplitGroups}
                className="flex items-center justify-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs rounded-xl shadow-xs hover:shadow-md transition-all active:scale-95"
              >
                <Users className="w-4 h-4" />
                <span>Сурагчдыг {selectedGroupCount} хэсэгт хувааж ахлагч томилох</span>
              </button>
            </div>
          </div>

          {/* Groups Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {classGroups.map(grp => {
              const grpStudents = targetClassStudents.filter(s => s.groupId === grp.groupId);
              const leader = grpStudents.find(s => s.isLeader) || grpStudents.find(s => s.studentId === grp.leaderStudentId);
              const leaderUser = allUsers.find(u => u.studentId === leader?.studentId);

              return (
                <div
                  key={grp.groupId}
                  className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden flex flex-col justify-between hover:border-blue-300 transition-all"
                >
                  <div>
                    {/* Group Header */}
                    <div className="p-4 bg-slate-50 border-b border-slate-200/80 flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-blue-600 text-white font-black text-xs flex items-center justify-center shadow-xs">
                          {grp.groupNumber}
                        </div>
                        <div>
                          <h4 className="font-bold text-slate-900 text-sm">{grp.name}</h4>
                          <span className="text-[11px] text-slate-500">{grpStudents.length} сурагч</span>
                        </div>
                      </div>
                      <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200">
                        {grp.groupNumber}-р хэсэг
                      </span>
                    </div>

                    {/* Assigned Leader Box */}
                    <div className="p-3.5 bg-amber-50/70 border-b border-amber-100 flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-amber-900 flex items-center gap-1 uppercase tracking-wider">
                          <span>👑</span> Хэсгийн ахлагч:
                        </span>
                        <div className="flex items-center gap-1.5">
                          <label className="text-[10px] text-slate-500 font-semibold">Солих:</label>
                          <select
                            value={leader?.studentId || ''}
                            onChange={(e) => handleSetLeader(grp.groupId, e.target.value)}
                            className="text-[11px] font-semibold bg-white border border-amber-300 rounded px-2 py-0.5 text-slate-800"
                          >
                            {grpStudents.map(s => (
                              <option key={s.studentId} value={s.studentId}>
                                {s.fullName} ({s.studentCode})
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="bg-white p-2.5 rounded-xl border border-amber-200/80 shadow-2xs">
                        <div className="font-bold text-xs text-slate-900">
                          {leader?.fullName || grp.leaderName || 'Томилогдоогүй'}
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1">
                          <span>Сурагчийн код: <strong className="font-mono text-slate-700">{leader?.studentCode || '-'}</strong></span>
                          <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 text-[10px]">
                            👑 Хэсгийн ахлагч
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Students inside Group */}
                    <div className="p-4 space-y-2">
                      <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                        Хэсгийн сурагчид ({grpStudents.length}):
                      </label>
                      <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                        {grpStudents.map(st => (
                          <div
                            key={st.studentId}
                            className="p-2 rounded-lg border border-slate-100 hover:border-slate-200 bg-slate-50/50 flex items-center justify-between text-xs transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-[11px] text-slate-400 w-14">{st.studentCode}</span>
                              <span className="font-semibold text-slate-800">{st.fullName}</span>
                              {st.isLeader && (
                                <span className="text-[10px] font-bold text-amber-700 bg-amber-100/70 px-1.5 py-0.2 rounded">
                                  👑 Ахлагч
                                </span>
                              )}
                            </div>

                            {/* Move student to other group */}
                            {classGroups.length > 1 && (
                              <select
                                value={grp.groupId}
                                onChange={(e) => handleMoveStudent(st.studentId, e.target.value)}
                                title="Өөр хэсэг рүү шилжүүлэх"
                                className="text-[10px] text-slate-500 bg-white border border-slate-200 rounded px-1.5 py-0.5"
                              >
                                {classGroups.map(targetGrp => (
                                  <option key={targetGrp.groupId} value={targetGrp.groupId}>
                                    Шилжүүлэх: {targetGrp.name}
                                  </option>
                                ))}
                              </select>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Card footer */}
                  <div className="p-3 bg-slate-50 border-t border-slate-100 text-[11px] text-slate-500 flex items-center justify-between">
                    <span>{grp.name} · {targetGroupClass} анги</span>
                    <span className="text-emerald-700 font-semibold">✓ Ахлагч гэрийн даалгавар шалгана</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Helper Callout */}
          <div className="bg-blue-50/80 border border-blue-200/80 rounded-2xl p-4.5 text-xs text-blue-900 flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <strong className="font-bold text-blue-950 block">
                Хэсэг ба Ахлагчийн системд нэвтрэх ба ажиллах заавар:
              </strong>
              <ul className="list-disc list-inside space-y-1 text-blue-900">
                <li><strong>Ахлагч өөрийн нэр нууц үгээр ороход:</strong> Зөвхөн өөрийн хариуцсан хэсгийн сурагчдын нэрс харагдаж, хичээлийн дэвтрийг шалган «Маш сайн», «Дунд», «Хийгээгүй» үнэлгээ болон тэмдэглэл хийнэ.</li>
                <li><strong>Сурагч өөрийн нэр нууц үгээр ороход:</strong> Өөрийн харьяалагдах хэсэг ба хэсгийн ахлагчийн хийсэн үнэлгээ, багшийн санал дүгнэлт шууд харагдана.</li>
                <li><strong>Хэрэглэгчдийн туршилтын нийтлэг нууц үг:</strong> <code className="bg-blue-100 px-1 py-0.5 rounded text-blue-800 font-mono">password123</code> (Нэвтрэх нэрээр сурагчийн хувийн код e.g. 10A-01, 10A-02 гэх мэтээр шууд орж болно).</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: STUDENTS & LEADERS */}
      {activeTab === 'students' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-4 animate-fadeIn">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Сурагчдын нэгдсэн жагсаалт</h3>
              <p className="text-xs text-slate-500">
                Сурагч нэмэх, засах, идэвхгүй болгох, хэсгийн ахлагч томилох
              </p>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  placeholder="Код, нэрээр хайх..."
                  className="pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs"
                />
              </div>

              <button
                onClick={() => {
                  setEditingStudent(null);
                  setIsStudentModalOpen(true);
                }}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-lg flex items-center gap-1.5 shadow-xs"
              >
                <Plus className="w-4 h-4" />
                Сурагч нэмэх
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-2.5 px-4">Код</th>
                  <th className="py-2.5 px-4">Бүтэн овог нэр</th>
                  <th className="py-2.5 px-4">Анги</th>
                  <th className="py-2.5 px-4">Самбарт харуулах нэр</th>
                  <th className="py-2.5 px-4">Үүрэг (Role)</th>
                  <th className="py-2.5 px-4">Төлөв</th>
                  <th className="py-2.5 px-4 text-right">Үйлдэл</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredStudents.map((student) => {
                  const isLeader = leaders.some(l => {
                    const u = dataService.getUsers().find(user => user.studentId === student.studentId);
                    return u && l.userId === u.userId;
                  });

                  return (
                    <tr key={student.studentId} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-2.5 px-4 font-mono font-bold text-slate-900">{student.studentCode}</td>
                      <td className="py-2.5 px-4 font-semibold text-slate-900">{student.fullName}</td>
                      <td className="py-2.5 px-4">{student.classId}</td>
                      <td className="py-2.5 px-4 text-slate-600">{student.publicDisplayName}</td>
                      <td className="py-2.5 px-4">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {student.groupName && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                              {student.groupName}
                            </span>
                          )}
                          {isLeader ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                              👑 Хэсгийн ахлагч
                            </span>
                          ) : (
                            <span className="text-slate-500 text-[11px]">Сурагч</span>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 px-4">
                        <button
                          onClick={() => handleToggleStudent(student.studentId)}
                          className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${
                            student.active
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-slate-100 text-slate-500 border-slate-200'
                          }`}
                        >
                          {student.active ? 'Идэвхтэй' : 'Идэвхгүй'}
                        </button>
                      </td>
                      <td className="py-2.5 px-4 text-right space-x-2 whitespace-nowrap">
                        <button
                          onClick={() => handleToggleLeader(student)}
                          title="Ахлагчийн эрх олгох / цуцлах"
                          className={`px-2.5 py-1 rounded text-[11px] font-semibold border ${
                            isLeader
                              ? 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                              : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                          }`}
                        >
                          {isLeader ? 'Ахлагч цуцлах' : 'Ахлагч болгох'}
                        </button>
                        <button
                          onClick={() => {
                            setEditingStudent(student);
                            setIsStudentModalOpen(true);
                          }}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[11px] font-semibold"
                        >
                          Засах
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 5: SCHEDULE CONFIGURATION */}
      {activeTab === 'schedule' && (
        <ScheduleManager classId={selectedClass === 'ALL' ? '10А' : selectedClass} />
      )}

      {/* TAB 6: REPORTS & EXPORT */}
      {activeTab === 'reports' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 space-y-5 animate-fadeIn">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-4 border-b border-slate-200">
            <div>
              <h3 className="font-bold text-slate-900 text-base">Статистик тайлан ба Excel/CSV татах</h3>
              <p className="text-xs text-slate-500">
                Сонгогдсон огноо, анги, хичээлийн хүрээнд бүх сурагчдын даалгаврын нэгтгэсэн тайлан
              </p>
            </div>

            <button
              onClick={handleExportCSV}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg shadow-xs flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Excel / CSV файл татаж авах
            </button>
          </div>

          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-2">
            <h4 className="font-bold text-slate-900">Тайлангийн хураангуй мэдээлэл:</h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-slate-700 pt-2">
              <div>Шүүсэн анги: <strong>{selectedClass === 'ALL' ? 'Бүх анги' : selectedClass}</strong></div>
              <div>Хугацааны интервал: <strong>{timeframe === 'WEEK' ? 'Энэ 7 хоног' : timeframe === 'MONTH' ? 'Энэ сар' : 'Бүх цаг'}</strong></div>
              <div>Нийт бичилт: <strong>{submissions.length} гүйцэтгэл</strong></div>
              <div>Файлын формат: <strong>CSV (UTF-8 BOM бүхий монгол крилл үсгийн алдаагүй)</strong></div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 7: AUDIT LOG */}
      {activeTab === 'audit' && (
        <AuditLogView />
      )}

      {/* Modals */}
      <HomeworkModal
        isOpen={isHomeworkModalOpen}
        onClose={() => setIsHomeworkModalOpen(false)}
        existingHomework={editingHomework}
        onSaved={() => {}}
      />

      <StudentModal
        isOpen={isStudentModalOpen}
        onClose={() => setIsStudentModalOpen(false)}
        existingStudent={editingStudent}
        onSaved={() => {}}
      />

      <VerificationModal
        isOpen={!!selectedSubmission}
        onClose={() => setSelectedSubmission(null)}
        submission={selectedSubmission?.sub || null}
        studentName={selectedSubmission?.studentName || ''}
        homeworkTitle={selectedSubmission?.hwTitle || ''}
        onVerified={() => {}}
      />
    </div>
  );
};
