import React, { useState, useEffect } from 'react';
import {
  UserCheck,
  Calendar,
  BookOpen,
  Send,
  Save,
  Lock,
  BookCheck,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Sparkles,
  Clock,
  RefreshCw,
  FileSpreadsheet
} from 'lucide-react';
import { dataService } from '../services/dataService';
import { useAuth } from '../context/AuthContext';
import { SubmissionStatus, Submission } from '../types';
import { getTodayUlaanbaatar, getCurrentWeekday, WEEKDAYS } from '../utils/dateUtils';

export const LeaderDashboard: React.FC = () => {
  const { currentUser, showToast } = useAuth();
  const today = getTodayUlaanbaatar();
  const currentWeekdayNum = getCurrentWeekday();

  // Find leader assignment & class
  const allLeaders = dataService.getLeaders();
  const leaderRecord = allLeaders.find(l => l.userId === currentUser?.userId && l.active);
  const currentStudent = currentUser?.studentId
    ? dataService.getStudents().find(s => s.studentId === currentUser.studentId)
    : dataService.getStudents().find(s => s.studentCode.toLowerCase() === currentUser?.username.toLowerCase());

  const assignedClass = leaderRecord?.classId || currentStudent?.classId || '10А';
  const allClassStudents = dataService.getStudents(assignedClass).filter(s => s.active);
  const classGroups = dataService.getGroups(assignedClass);

  // Determine which group this leader leads:
  const myAssignedGroup = classGroups.find(g =>
    g.leaderUserId === currentUser?.userId ||
    (currentStudent && g.leaderStudentId === currentStudent.studentId) ||
    leaderRecord?.groupId === g.groupId ||
    (currentStudent && currentStudent.groupId === g.groupId)
  ) || classGroups[0];

  const [selectedGroupId, setSelectedGroupId] = useState<string>(myAssignedGroup?.groupId || '');

  useEffect(() => {
    if (myAssignedGroup && (!selectedGroupId || !classGroups.some(g => g.groupId === selectedGroupId))) {
      setSelectedGroupId(myAssignedGroup.groupId);
    }
  }, [myAssignedGroup, classGroups, selectedGroupId]);

  const activeGroup = classGroups.find(g => g.groupId === selectedGroupId) || myAssignedGroup || classGroups[0];

  // Students to display: strictly students belonging to this group!
  const groupStudents = allClassStudents.filter(s => s.groupId === activeGroup?.groupId);
  // Fallback to all class students if no groups assigned yet
  const students = groupStudents.length > 0 ? groupStudents : allClassStudents;

  // Date selection (default today)
  const [selectedDate, setSelectedDate] = useState<string>(today);

  // Available subjects for this class
  const classSubjects = dataService.getSubjectsForClass(assignedClass);
  // Today's schedule items for quick selection pills
  const todaySchedule = dataService.getSchedule(assignedClass, currentWeekdayNum);

  // Initial selected subject: first from today's schedule or first class subject
  const [selectedSubject, setSelectedSubject] = useState<string>(
    todaySchedule[0]?.subjectName || classSubjects[0]?.subjectName || 'Математик'
  );

  const [isSaving, setIsSaving] = useState(false);

  // Automatically find or create daily subject homework
  const currentHw = dataService.getOrCreateDailySubjectHomework(
    assignedClass,
    selectedSubject,
    selectedDate
  );

  const currentSubmissions = dataService.getSubmissions(currentHw.homeworkId);
  const submissionMap = new Map(currentSubmissions.map(s => [s.studentId, s]));

  // Local draft status for each student
  const [draftStatuses, setDraftStatuses] = useState<Record<string, SubmissionStatus>>(() => {
    const map: Record<string, SubmissionStatus> = {};
    currentSubmissions.forEach(sub => {
      let st = sub.status;
      if (st === 'DONE') st = 'EXCELLENT';
      if (st === 'IN_PROGRESS') st = 'AVERAGE';
      map[sub.studentId] = st;
    });
    return map;
  });

  // Local draft comments/evaluations for each student
  const [draftComments, setDraftComments] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    currentSubmissions.forEach(sub => {
      if (sub.leaderComment) map[sub.studentId] = sub.leaderComment;
    });
    return map;
  });

  // When subject or date changes, reset draft from existing submissions
  useEffect(() => {
    const hw = dataService.getOrCreateDailySubjectHomework(
      assignedClass,
      selectedSubject,
      selectedDate
    );
    const existing = dataService.getSubmissions(hw.homeworkId);
    const statusMap: Record<string, SubmissionStatus> = {};
    const commentMap: Record<string, string> = {};
    existing.forEach(sub => {
      let st = sub.status;
      if (st === 'DONE') st = 'EXCELLENT';
      if (st === 'IN_PROGRESS') st = 'AVERAGE';
      statusMap[sub.studentId] = st;
      if (sub.leaderComment) commentMap[sub.studentId] = sub.leaderComment;
    });
    setDraftStatuses(statusMap);
    setDraftComments(commentMap);
  }, [selectedSubject, selectedDate, assignedClass]);

  const handleStatusChange = (studentId: string, status: SubmissionStatus) => {
    const existingSub = submissionMap.get(studentId);
    if (existingSub?.checkedBy) {
      showToast('warning', 'Өөрчлөх боломжгүй', 'Багш аль хэдийн шалгаж баталгаажуулсан бичилтийг өөрчлөх эрхгүй.');
      return;
    }

    setDraftStatuses(prev => ({
      ...prev,
      [studentId]: status
    }));
  };

  const handleQuickMarkAll = (status: SubmissionStatus) => {
    const nextMap = { ...draftStatuses };
    students.forEach(st => {
      const existingSub = submissionMap.get(st.studentId);
      if (!existingSub?.checkedBy) {
        nextMap[st.studentId] = status;
      }
    });
    setDraftStatuses(nextMap);
  };

  const [lastSheetSyncTime, setLastSheetSyncTime] = useState<string | null>(null);

  const handleSaveAll = async () => {
    if (!currentUser || !currentHw) return;

    setIsSaving(true);
    const submissionsToSave: Submission[] = students.map(st => {
      const existing = submissionMap.get(st.studentId);
      const status = draftStatuses[st.studentId] || 'NOT_DONE';
      const leaderComment = draftComments[st.studentId] !== undefined
        ? draftComments[st.studentId]
        : (existing?.leaderComment || '');

      return {
        submissionId: existing?.submissionId || ('subm_' + Math.random().toString(36).substring(2, 9)),
        homeworkId: currentHw.homeworkId,
        studentId: st.studentId,
        status,
        leaderComment,
        submittedAt: status === 'EXCELLENT' || status === 'AVERAGE' || status === 'DONE'
          ? (existing?.submittedAt || new Date().toISOString())
          : undefined,
        checkedBy: existing?.checkedBy,
        checkedAt: existing?.checkedAt,
        teacherComment: existing?.teacherComment,
        updatedAt: new Date().toISOString()
      };
    });

    // 1. First record directly in central DataService so it is instantly available
    dataService.recordSubmissionBatch(currentUser, submissionsToSave);

    // 2. Google Sheet рүү автоматаар (дараалалтай, сүлжээ тасарвал дахин оролдоно) хадгалагдана
    const sheetSyncSuccess = dataService.isSheetsMode();
    if (sheetSyncSuccess) {
      void dataService.syncNow().then(r => {
        if (r.success) setLastSheetSyncTime(new Date().toLocaleTimeString('mn-MN', { hour: '2-digit', minute: '2-digit' }));
      });
    }

    setIsSaving(false);
    if (sheetSyncSuccess) {
      showToast(
        'success',
        'Google Sheet & Системд хадгалагдлаа',
        `${assignedClass} ангийн ${activeGroup?.name || 'хэсгийн'} ${selectedSubject} хичээлийн үнэлгээ Google Sheet болон багшийн самбарт амжилттай илгээгдлээ.`
      );
    } else {
      showToast(
        'success',
        'Амжилттай хадгалагдлаа',
        `${assignedClass} ангийн ${activeGroup?.name || 'хэсгийн'} ${selectedSubject} хичээлийн үнэлгээ хадгалагдаж багш, сурагчдад харагдана.`
      );
    }
  };

  // Live counters for current draft
  const excellentCount = students.filter(s => {
    const st = draftStatuses[s.studentId] || submissionMap.get(s.studentId)?.status;
    return st === 'EXCELLENT' || st === 'DONE';
  }).length;

  const averageCount = students.filter(s => {
    const st = draftStatuses[s.studentId] || submissionMap.get(s.studentId)?.status;
    return st === 'AVERAGE' || st === 'IN_PROGRESS';
  }).length;

  const notDoneCount = students.filter(s => {
    const st = draftStatuses[s.studentId] || submissionMap.get(s.studentId)?.status;
    return st === 'NOT_DONE' || !st;
  }).length;

  return (
    <div className="space-y-6 pb-12 animate-fadeIn">
      {/* Top Banner */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-emerald-50 text-emerald-800 font-bold text-xs flex items-center gap-1.5 border border-emerald-200/60">
              <UserCheck className="w-4 h-4 text-emerald-600" />
              Хэсгийн ахлагч
            </span>
            <h2 className="text-lg font-black text-slate-900 tracking-tight">
              {assignedClass} анги · Хичээл дээр дэвтрийн гэрийн даалгавар шалгаж үнэлэх
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
            Багш тусад нь даалгавар бичиж оруулах шаардлагагүй. Хэсгийн ахлагч та хичээл дээр сурагчдын дэвтрийг хянаад <strong>«Маш сайн»</strong>, <strong>«Дунд»</strong>, <strong>«Хийгээгүй»</strong> үнэлгээг шууд хийнэ.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2 self-stretch md:self-auto">
          {lastSheetSyncTime && (
            <span className="text-[11px] text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200 font-medium flex items-center gap-1.5 shadow-2xs">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              {lastSheetSyncTime} Google Sheet-д синк хийсэн
            </span>
          )}
          <button
            onClick={handleSaveAll}
            disabled={isSaving}
            className="flex items-center justify-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs rounded-xl shadow-sm hover:shadow-md transition-all disabled:opacity-50 w-full sm:w-auto active:scale-95"
          >
            {isSaving ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Хадгалж байна...</span>
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                <span>Хадгалж багшид илгээх</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Assigned Group Banner & Switcher */}
      <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 border border-emerald-200/90 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-2xs">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-black text-base shadow-xs">
            {activeGroup?.groupNumber || 1}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-slate-900 text-sm">
                Хариуцсан хэсэг: {activeGroup?.name || '1-р хэсэг'} ({students.length} сурагч)
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                <span>👑</span> Ахлагч: {activeGroup?.leaderName || currentUser?.displayName}
              </span>
            </div>
            <p className="text-xs text-slate-600 mt-1">
              Таны хариуцсан хэсгийн сурагчид харагдаж байна. Хичээл дээр сурагчдын дэвтрийг шалгаж <strong>«Маш сайн»</strong>, <strong>«Дунд»</strong>, <strong>«Хийгээгүй»</strong> үнэлгээ болон тэмдэглэл оруулна уу.
            </p>
          </div>
        </div>

        {/* Group tabs if multiple groups exist */}
        {classGroups.length > 1 && (
          <div className="flex items-center gap-1.5 flex-wrap self-start md:self-auto bg-white/80 p-1.5 rounded-xl border border-emerald-200/60">
            <span className="text-[11px] font-semibold text-slate-500 px-1">Хэсэг:</span>
            {classGroups.map(grp => (
              <button
                key={grp.groupId}
                type="button"
                onClick={() => setSelectedGroupId(grp.groupId)}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all border ${
                  activeGroup?.groupId === grp.groupId
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                    : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
                }`}
              >
                {grp.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Date & Subject Control Center */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/90 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="flex items-center gap-1.5 text-xs text-slate-700 font-semibold">
              <Calendar className="w-4 h-4 text-emerald-600" />
              Шалгах огноо:
            </div>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-3 py-1.5 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="text-xs text-slate-500">
            Оноогдсон анги: <strong className="text-slate-800">{assignedClass}</strong> · {activeGroup?.name} (<strong className="text-slate-800">{students.length}</strong> сурагч)
          </div>
        </div>

        {/* Quick subject selector from Timetable */}
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
            Хичээлээ сонгоно уу:
          </label>

          <div className="flex flex-wrap gap-2">
            {classSubjects.map((sub) => {
              const isSelected = sub.subjectName === selectedSubject;
              const isToday = todaySchedule.some(ts => ts.subjectName === sub.subjectName);

              return (
                <button
                  key={sub.subjectName}
                  type="button"
                  onClick={() => setSelectedSubject(sub.subjectName)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all border flex items-center gap-2 ${
                    isSelected
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs ring-2 ring-emerald-300/50'
                      : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
                  }`}
                >
                  <BookOpen className={`w-3.5 h-3.5 ${isSelected ? 'text-white' : 'text-emerald-600'}`} />
                  <span>{sub.subjectName}</span>
                  {isToday && (
                    <span className={`text-[10px] px-1.5 py-0.2 rounded font-semibold ${
                      isSelected ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-800'
                    }`}>
                      Өнөөдрийн хуваарь
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Evaluation Workspace */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Workspace Toolbar */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <BookCheck className="w-4 h-4 text-emerald-600" />
              <span className="font-bold text-slate-900 text-sm">
                {selectedSubject} хичээлийн дэвтэр шалгалт · {activeGroup?.name}
              </span>
              <span className="text-slate-500">· {selectedDate}</span>
            </div>
            {/* Live Counter Badges */}
            <div className="flex items-center gap-3 text-[11px] pt-0.5">
              <span className="text-slate-600 font-medium">Нийт: <strong>{students.length}</strong></span>
              <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                🌟 Маш сайн: {excellentCount}
              </span>
              <span className="text-amber-700 font-bold bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                ⚡ Дунд: {averageCount}
              </span>
              <span className="text-rose-700 font-bold bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                ❌ Хийгээгүй: {notDoneCount}
              </span>
            </div>
          </div>

          {/* Quick Mark All Buttons */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] text-slate-400 mr-1">Бүгдийг зэрэг сонгох:</span>
            <button
              type="button"
              onClick={() => handleQuickMarkAll('EXCELLENT')}
              className="px-2.5 py-1.5 rounded-md bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-300 text-[11px] font-bold transition-colors shadow-2xs"
            >
              🌟 Бүгд Маш сайн
            </button>
            <button
              type="button"
              onClick={() => handleQuickMarkAll('AVERAGE')}
              className="px-2.5 py-1.5 rounded-md bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-300 text-[11px] font-bold transition-colors shadow-2xs"
            >
              ⚡ Бүгд Дунд
            </button>
            <button
              type="button"
              onClick={() => handleQuickMarkAll('NOT_DONE')}
              className="px-2.5 py-1.5 rounded-md bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-300 text-[11px] font-bold transition-colors shadow-2xs"
            >
              ❌ Бүгд Хийгээгүй
            </button>
          </div>
        </div>

        {/* Students Evaluation List */}
        <div className="divide-y divide-slate-100">
          {students.map((student) => {
            const existingSub = submissionMap.get(student.studentId);
            let rawStatus = draftStatuses[student.studentId] || existingSub?.status || 'NOT_DONE';
            if (rawStatus === 'DONE') rawStatus = 'EXCELLENT';
            if (rawStatus === 'IN_PROGRESS') rawStatus = 'AVERAGE';

            const currentStatus = rawStatus;
            const isLocked = !!existingSub?.checkedBy;

            return (
              <div
                key={student.studentId}
                className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:bg-slate-50/50 transition-colors text-xs"
              >
                {/* Student Code & Name */}
                <div className="flex items-center gap-3 min-w-[200px]">
                  <span className="font-mono text-slate-400 text-xs w-16">{student.studentCode}</span>
                  <div>
                    <div className="font-bold text-slate-900 text-xs flex items-center gap-2">
                      <span>{student.fullName}</span>
                      {student.isLeader && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                          👑 Хэсгийн ахлагч
                        </span>
                      )}
                      {isLocked && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                          <Lock className="w-3 h-3 text-blue-600" />
                          Багш баталгаажуулсан
                        </span>
                      )}
                    </div>
                    {existingSub?.teacherComment && (
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        Багшийн санал: <span className="text-slate-700 italic font-medium">{existingSub.teacherComment}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Evaluation Comment / Note */}
                <div className="flex-1 max-w-sm">
                  <input
                    type="text"
                    disabled={isLocked}
                    value={draftComments[student.studentId] ?? (existingSub?.leaderComment || '')}
                    onChange={(e) => setDraftComments(prev => ({ ...prev, [student.studentId]: e.target.value }))}
                    placeholder="Ахлагчийн тэмдэглэл / үнэлгээний тайлбар (сонголттой)..."
                    className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white focus:outline-hidden focus:ring-1 focus:ring-emerald-500 text-slate-700 placeholder:text-slate-400"
                  />
                </div>

                {/* 3 Evaluation Buttons */}
                <div className="flex items-center gap-2 flex-wrap">
                  {(
                    [
                      { id: 'EXCELLENT', label: '🌟 Маш сайн', color: 'emerald' },
                      { id: 'AVERAGE', label: '⚡ Дунд', color: 'amber' },
                      { id: 'NOT_DONE', label: '❌ Хийгээгүй', color: 'rose' }
                    ] as const
                  ).map((statusOption) => {
                    const isSelected = currentStatus === statusOption.id;
                    return (
                      <button
                        key={statusOption.id}
                        type="button"
                        disabled={isLocked}
                        onClick={() => handleStatusChange(student.studentId, statusOption.id)}
                        className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                          isSelected
                            ? statusOption.color === 'emerald'
                              ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs ring-2 ring-emerald-300/60'
                              : statusOption.color === 'amber'
                              ? 'bg-amber-500 text-white border-amber-500 shadow-xs ring-2 ring-amber-300/60'
                              : 'bg-rose-600 text-white border-rose-600 shadow-xs ring-2 ring-rose-300/60'
                            : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200 disabled:opacity-40'
                        }`}
                      >
                        {statusOption.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-3 text-xs">
          <span className="text-slate-500">
            Дэвтэр шалгаж үнэлгээгээ хийж дуусаад баруун талын товчийг дарж багшид илгээнэ үү.
          </span>
          <button
            onClick={handleSaveAll}
            disabled={isSaving}
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg shadow-xs transition-colors flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            Бүртгэлийг хадгалж багшид илгээх
          </button>
        </div>
      </div>
    </div>
  );
};
