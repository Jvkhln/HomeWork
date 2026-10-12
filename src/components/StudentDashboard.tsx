import React from 'react';
import {
  GraduationCap,
  Calendar,
  BookOpen,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Clock,
  Sparkles,
  Award,
  BookCheck,
  Info
} from 'lucide-react';
import { dataService } from '../services/dataService';
import { useAuth } from '../context/AuthContext';
import { SUBMISSION_STATUS_LABELS, SUBMISSION_STATUS_COLORS } from '../types';
import { getTodayUlaanbaatar, getCurrentWeekday, WEEKDAYS } from '../utils/dateUtils';

export const StudentDashboard: React.FC = () => {
  const { currentUser } = useAuth();
  const today = getTodayUlaanbaatar();
  const weekdayNum = getCurrentWeekday();
  const todayWeekdayObj = WEEKDAYS.find(w => w.id === weekdayNum);

  // Find student record
  const student = dataService.getStudents().find(s => s.studentId === currentUser?.studentId);
  const classId = student ? student.classId : '10А';

  const [selectedScheduleDay, setSelectedScheduleDay] = React.useState<number>(weekdayNum);
  const selectedWeekdayObj = WEEKDAYS.find(w => w.id === selectedScheduleDay);

  // Timetable
  const daySchedule = dataService.getSchedule(classId, selectedScheduleDay);

  // Homework & Submissions
  const homeworkList = dataService.getHomework(classId, 'ACTIVE');
  const mySubmissions = dataService.getSubmissions(undefined, student?.studentId);
  const submissionMap = new Map(mySubmissions.map(s => [s.homeworkId, s]));

  // 3 evaluation counts: Маш сайн, Дунд, Хийгээгүй
  const totalAssigned = homeworkList.length;
  const excellentCount = mySubmissions.filter(s => s.status === 'EXCELLENT' || s.status === 'DONE').length;
  const averageCount = mySubmissions.filter(s => s.status === 'AVERAGE' || s.status === 'IN_PROGRESS' || s.status === 'LATE').length;
  const notDoneCount = mySubmissions.filter(s => s.status === 'NOT_DONE').length + Math.max(0, totalAssigned - mySubmissions.length);

  const completionRate = totalAssigned > 0
    ? Math.round(((excellentCount * 100 + averageCount * 70) / (totalAssigned * 100)) * 100)
    : 0;

  return (
    <div className="space-y-6 pb-12 animate-fadeIn">
      {/* Student Welcome Profile Banner */}
      <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-indigo-800 rounded-2xl p-6 text-white shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20">
            <GraduationCap className="w-8 h-8 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold tracking-tight">
                {student?.fullName || currentUser?.displayName}
              </h2>
              <span className="px-2.5 py-0.5 rounded-full bg-white/20 text-xs font-semibold text-white">
                {classId} анги
              </span>
            </div>
            <p className="text-xs text-blue-100 mt-1">
              Сурагчийн хувийн код: <strong className="font-mono">{student?.studentCode}</strong> · Өнөөдөр: {today} ({todayWeekdayObj?.name || 'Өнөөдөр'})
            </p>
          </div>
        </div>

        {/* Completion rate summary pill */}
        <div className="bg-white/10 backdrop-blur-md px-5 py-3 rounded-xl border border-white/15 text-right self-stretch md:self-auto">
          <span className="text-[11px] text-blue-200 block uppercase tracking-wider font-semibold">
            Миний гэрийн даалгаврын гүйцэтгэл
          </span>
          <div className="text-2xl font-black text-white mt-0.5">
            {completionRate}%
          </div>
        </div>
      </div>

      {/* Info notice about Notebook evaluations */}
      <div className="bg-emerald-50/80 border border-emerald-200 rounded-xl p-4 text-xs text-emerald-900 flex items-start gap-3 shadow-xs">
        <BookCheck className="w-5 h-5 text-emerald-700 flex-shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          <strong className="font-bold text-emerald-950 block mb-0.5">
            Дэвтрийн шалгалтын зарчим (Сурагч илгээх шаардлагагүй):
          </strong>
          Сурагчид цахимаар файл эсвэл даалгавар илгээхгүй. Хэсгийн ахлагч ангидаа таны хичээлийн дэвтрийн гэрийн даалгаврын үйл ажиллагааг биечлэн шалгаад <strong>«Маш сайн»</strong>, <strong>«Дунд»</strong>, <strong>«Хийгээгүй»</strong> гэсэн 3 үнэлгээгээр бүртгэнэ. Багш шалгаж баталгаажуулна.
        </div>
      </div>

      {/* Progress Cards: 3 Evaluations */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div className="bg-white p-4.5 rounded-2xl border border-slate-200/90 shadow-xs hover:shadow-md transition-all">
          <span className="text-[11px] text-slate-400 font-semibold block">Нийт өгсөн даалгавар</span>
          <span className="text-2xl font-black text-slate-900 mt-1 block">{totalAssigned}</span>
        </div>

        <div className="bg-white p-4.5 rounded-2xl border border-emerald-200 bg-emerald-50/20 shadow-xs hover:shadow-md transition-all">
          <span className="text-[11px] text-emerald-700 font-bold block flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            Маш сайн
          </span>
          <span className="text-2xl font-black text-emerald-600 mt-1 block">{excellentCount}</span>
        </div>

        <div className="bg-white p-4.5 rounded-2xl border border-amber-200 bg-amber-50/20 shadow-xs hover:shadow-md transition-all">
          <span className="text-[11px] text-amber-700 font-bold block flex items-center gap-1">
            <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
            Дунд
          </span>
          <span className="text-2xl font-black text-amber-600 mt-1 block">{averageCount}</span>
        </div>

        <div className="bg-white p-4.5 rounded-2xl border border-rose-200 bg-rose-50/20 shadow-xs hover:shadow-md transition-all">
          <span className="text-[11px] text-rose-700 font-bold block flex items-center gap-1">
            <XCircle className="w-3.5 h-3.5 text-rose-600" />
            Хийгээгүй
          </span>
          <span className="text-2xl font-black text-rose-600 mt-1 block">{notDoneCount}</span>
        </div>
      </div>

      {/* Main Two Column: My Homework & Today's Schedule */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: My Homework List (Span 2) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold text-slate-900 text-sm">
                  Хичээлүүдийн дэвтрийн үнэлгээ ({homeworkList.length})
                </h3>
              </div>
              <span className="text-xs text-slate-400">
                Хэсгийн ахлагчийн шалгасан үнэлгээ
              </span>
            </div>

            <div className="space-y-3.5">
              {homeworkList.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs">
                  Одоогоор бүртгэгдсэн дэвтрийн шалгалт байхгүй байна. Хичээл дээр хэсгийн ахлагч шалгаж бүртгэхэд энд харагдана.
                </div>
              ) : (
                homeworkList.map((hw, idx) => {
                  const sub = submissionMap.get(hw.homeworkId);
                  let rawStatus = sub?.status || 'NOT_DONE';
                  if (rawStatus === 'DONE') rawStatus = 'EXCELLENT';
                  if (rawStatus === 'IN_PROGRESS') rawStatus = 'AVERAGE';

                  const status = rawStatus;
                  const color = SUBMISSION_STATUS_COLORS[status];

                  return (
                    <div
                      key={`${hw.homeworkId}-${idx}`}
                      className="p-4 rounded-xl border border-slate-200 hover:border-slate-300 transition-all text-xs bg-slate-50/30 space-y-2.5"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-blue-800 bg-blue-50 px-2.5 py-0.5 rounded border border-blue-200 text-[11px]">
                            {hw.subjectName}
                          </span>
                          <h4 className="font-bold text-slate-900 text-sm">{hw.title}</h4>
                        </div>

                        {/* Status Badge */}
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold border ${color.bg} ${color.text} ${color.border}`}>
                            {status === 'EXCELLENT' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
                            {status === 'AVERAGE' && <AlertCircle className="w-3.5 h-3.5 text-amber-600" />}
                            {status === 'NOT_DONE' && <XCircle className="w-3.5 h-3.5 text-rose-600" />}
                            Дэвтрийн үнэлгээ: {SUBMISSION_STATUS_LABELS[status]}
                          </span>
                        </div>
                      </div>

                      <p className="text-slate-600 text-xs leading-relaxed">
                        {hw.description}
                      </p>

                      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200 text-[11px]">
                        <div className="flex items-center gap-4 text-slate-500">
                          <span>Шалгасан огноо: <strong className="text-slate-800">{hw.assignedDate}</strong></span>
                        </div>

                        <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
                          {sub?.checkedBy ? (
                            <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-semibold border border-emerald-200">
                              ✓ Багш баталгаажуулсан
                            </span>
                          ) : sub?.submittedAt ? (
                            <span className="text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                              Ахлагч шалгасан
                            </span>
                          ) : (
                            <span className="text-slate-400 italic">
                              Ахлагч шалгаж байна
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Teacher's Feedback comment if available */}
                      {sub?.teacherComment && (
                        <div className="mt-2 p-2.5 bg-blue-50/80 border border-blue-200 rounded-lg text-[11px] flex items-start gap-2 text-blue-900">
                          <Info className="w-3.5 h-3.5 text-blue-600 flex-shrink-0 mt-0.5" />
                          <div>
                            <strong>Багшийн санал дүгнэлт:</strong> {sub.teacherComment}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Today's Schedule & Timetable */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5">
            <div className="pb-3 border-b border-slate-200 mb-3 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-blue-600" />
                  <h3 className="font-bold text-slate-900 text-sm">
                    Хичээлийн хуваарь
                  </h3>
                </div>
                <span className="text-xs text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full font-bold">
                  {selectedWeekdayObj?.name || 'Өнөөдөр'}
                </span>
              </div>

              {/* Day selection tabs */}
              <div className="grid grid-cols-5 gap-1 p-1 bg-slate-100 rounded-lg text-[11px] font-semibold">
                {WEEKDAYS.map((day) => (
                  <button
                    key={day.id}
                    onClick={() => setSelectedScheduleDay(day.id)}
                    className={`py-1 rounded text-center transition-all ${
                      selectedScheduleDay === day.id
                        ? 'bg-white text-blue-700 font-bold shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {day.name.slice(0, 3)}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              {daySchedule.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-xs">
                  {selectedWeekdayObj?.name} гарагт хичээлийн хуваарь бүртгэгдээгүй байна.
                </div>
              ) : (
                daySchedule.map((item) => (
                  <div
                    key={item.scheduleId}
                    className="p-3 rounded-lg bg-slate-50 border border-slate-100 text-xs flex items-center justify-between hover:border-slate-200 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-md bg-white border border-slate-200 text-slate-800 font-bold flex items-center justify-center text-xs">
                        {item.period}
                      </span>
                      <div>
                        <div className="font-bold text-slate-900">{item.subjectName}</div>
                        <div className="text-[11px] text-slate-500 font-medium">
                          {item.period}-р цагийн хичээл
                        </div>
                      </div>
                    </div>
                    <span className="text-[11px] font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200/60">
                      {item.period}-р цаг
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Privacy Notice Box */}
          <div className="p-4 rounded-xl bg-slate-100 border border-slate-200 text-slate-600 text-xs leading-relaxed space-y-1.5">
            <span className="font-bold text-slate-900 flex items-center gap-1.5">
              🔒 Сурагчийн нууцлал & Дэвтрийн үнэлгээ
            </span>
            <p className="text-[11px]">
              Хэсгийн ахлагч ангид таны дэвтрийг шалгаж үнэлсэн дүн шууд таны самбарт тусна. Та өөрийн гэрийн даалгаврын хувийн үнэлгээ, багшийн өгсөн саналыг харах эрхтэй.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
