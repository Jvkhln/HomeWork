import React, { useState, useRef } from 'react';
import {
  Award,
  Trophy,
  Calendar,
  Filter,
  UserCircle,
  CheckCircle2,
  Clock,
  Sparkles,
  BookOpen,
  ArrowRight,
  TrendingUp,
  AlertCircle,
  XCircle,
  GraduationCap,
  ShieldCheck,
  UserCheck,
  ChevronRight,
  Flame,
  FileText,
  LogIn
} from 'lucide-react';
import { dataService } from '../services/dataService';
import { getTodayUlaanbaatar, getWeekRange, getMonthRange, getCurrentWeekday, WEEKDAYS } from '../utils/dateUtils';
import { StatusDonutChart } from './Charts';
import { HeroBanner } from './HeroBanner';

interface PublicLandingProps {
  onOpenLogin: () => void;
}

export const PublicLanding: React.FC<PublicLandingProps> = ({ onOpenLogin }) => {
  const [selectedClass, setSelectedClass] = useState<string>('ALL');
  const [timeframe, setTimeframe] = useState<'TODAY' | 'WEEK' | 'MONTH'>('WEEK');
  const [activeTab, setActiveTab] = useState<'SCHEDULE' | 'HOMEWORK'>('SCHEDULE');
  const currentWeekdayNum = getCurrentWeekday();
  const [scheduleWeekday, setScheduleWeekday] = useState<number>(currentWeekdayNum);

  const statsSectionRef = useRef<HTMLDivElement>(null);
  const scheduleSectionRef = useRef<HTMLDivElement>(null);

  const classes = dataService.getClasses();
  const todayStr = getTodayUlaanbaatar();
  const weekRange = getWeekRange();
  const monthRange = getMonthRange();

  let startDate: string | undefined;
  let endDate: string | undefined;

  if (timeframe === 'TODAY') {
    startDate = todayStr;
    endDate = todayStr;
  } else if (timeframe === 'WEEK') {
    startDate = weekRange.start;
    endDate = weekRange.end;
  } else if (timeframe === 'MONTH') {
    startDate = monthRange.start;
    endDate = monthRange.end;
  }

  const stats = dataService.getStats(selectedClass === 'ALL' ? undefined : selectedClass, startDate, endDate);
  const leaderboard = dataService.getLeaderboard(selectedClass === 'ALL' ? undefined : selectedClass, startDate, endDate);

  // Schedule preview by chosen weekday
  const chosenWeekdayObj = WEEKDAYS.find(w => w.id === scheduleWeekday);
  const displaySchedule = dataService.getSchedule(selectedClass === 'ALL' ? '10А' : selectedClass, scheduleWeekday);
  const activeHomework = dataService.getHomework(selectedClass === 'ALL' ? undefined : selectedClass, 'ACTIVE');

  const scrollToStats = () => {
    statsSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const scrollToSchedule = () => {
    scheduleSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Circular progress calculations for Overall Completion Ring
  const ringSize = 140;
  const ringStroke = 12;
  const ringRadius = (ringSize - ringStroke) / 2;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const strokeDashoffset = ringCircumference - (stats.completionRate / 100) * ringCircumference;

  return (
    <div className="space-y-10 pb-16 animate-fadeIn">
      {/* 1. ТОЛГОЙ ХЭСГИЙН ДИЗАЙН (HERO BANNER) */}
      <HeroBanner
        onOpenLogin={onOpenLogin}
        onExploreStats={scrollToStats}
      />

      {/* 3. ТҮРГЭН НЭВТРЭХ КАРТУУД (QUICK ACCESS CARDS) */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Quick Card 1: Хичээлийн хуваарь харах */}
        <div
          onClick={scrollToSchedule}
          className="group cursor-pointer bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs hover:shadow-md hover:border-blue-300 transition-all duration-300 flex flex-col justify-between"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-colors duration-200 shadow-xs">
              <Calendar className="w-5 h-5" />
            </div>
            <span className="text-[11px] font-semibold text-blue-600 bg-blue-50/70 px-2.5 py-0.5 rounded-full">
              Өнөөдөр
            </span>
          </div>
          <div>
            <h4 className="font-bold text-slate-900 text-sm group-hover:text-blue-600 transition-colors">
              Хичээлийн хуваарь харах
            </h4>
            <p className="text-xs text-slate-500 mt-1 line-clamp-2">
              Өнөөдрийн 7 цагийн хуваарь, багш нарын мэдээлэл болон танхим
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center text-xs font-semibold text-blue-600 group-hover:translate-x-1 transition-transform">
            <span>Хуваарь үзэх</span>
            <ChevronRight className="w-4 h-4 ml-0.5" />
          </div>
        </div>

        {/* Quick Card 2: Өөрийн гэрийн даалгавар */}
        <div
          onClick={onOpenLogin}
          className="group cursor-pointer bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs hover:shadow-md hover:border-indigo-300 transition-all duration-300 flex flex-col justify-between"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-colors duration-200 shadow-xs">
              <BookOpen className="w-5 h-5" />
            </div>
            <span className="text-[11px] font-semibold text-indigo-600 bg-indigo-50/70 px-2.5 py-0.5 rounded-full">
              Дэвтэр
            </span>
          </div>
          <div>
            <h4 className="font-bold text-slate-900 text-sm group-hover:text-indigo-600 transition-colors">
              Өөрийн гэрийн даалгавар
            </h4>
            <p className="text-xs text-slate-500 mt-1 line-clamp-2">
              Ахлагчийн тавьсан 3 үнэлгээ, багшийн баталгаажуулсан төлөв шалгах
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center text-xs font-semibold text-indigo-600 group-hover:translate-x-1 transition-transform">
            <span>Дэвтрээ шалгах</span>
            <ChevronRight className="w-4 h-4 ml-0.5" />
          </div>
        </div>

        {/* Quick Card 3: Ахицын тайлан */}
        <div
          onClick={scrollToStats}
          className="group cursor-pointer bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs hover:shadow-md hover:border-emerald-300 transition-all duration-300 flex flex-col justify-between"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-colors duration-200 shadow-xs">
              <TrendingUp className="w-5 h-5" />
            </div>
            <span className="text-[11px] font-semibold text-emerald-600 bg-emerald-50/70 px-2.5 py-0.5 rounded-full">
              Статистик
            </span>
          </div>
          <div>
            <h4 className="font-bold text-slate-900 text-sm group-hover:text-emerald-600 transition-colors">
              Ахицын тайлан
            </h4>
            <p className="text-xs text-slate-500 mt-1 line-clamp-2">
              Ангийн болон сургуулийн гэрийн даалгаврын 7 хоног, сарын графикууд
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center text-xs font-semibold text-emerald-600 group-hover:translate-x-1 transition-transform">
            <span>Тайлан харах</span>
            <ChevronRight className="w-4 h-4 ml-0.5" />
          </div>
        </div>

        {/* Quick Card 4: Сурагч / Багш нэвтрэх */}
        <div
          onClick={onOpenLogin}
          className="group cursor-pointer bg-gradient-to-br from-blue-900 to-indigo-900 text-white p-5 rounded-2xl shadow-sm hover:shadow-lg transition-all duration-300 flex flex-col justify-between"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 text-white flex items-center justify-center backdrop-blur-md border border-white/20">
              <UserCircle className="w-5 h-5" />
            </div>
            <span className="text-[11px] font-semibold text-blue-200 bg-white/10 px-2.5 py-0.5 rounded-full border border-white/10">
              Нэвтрэлт
            </span>
          </div>
          <div>
            <h4 className="font-bold text-white text-sm">
              Сурагч / Багш нэвтрэх
            </h4>
            <p className="text-xs text-blue-200/90 mt-1 line-clamp-2">
              Хэсгийн ахлагч, багш, сурагчийн эрхээр системд нэвтрэх
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-white/10 flex items-center text-xs font-semibold text-blue-200 group-hover:text-white group-hover:translate-x-1 transition-all">
            <span>Нэвтрэх цонх нээх</span>
            <ArrowRight className="w-4 h-4 ml-0.5" />
          </div>
        </div>
      </section>

      {/* FILTER TOOLBAR */}
      <div
        ref={statsSectionRef}
        className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4"
      >
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-700 uppercase tracking-wider">
            <Filter className="w-4 h-4 text-blue-600" />
            <span>Шүүлт & Харагдац:</span>
          </div>

          {/* Class Filter */}
          <div className="relative">
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="text-xs font-semibold bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-800 rounded-xl px-3.5 py-2 focus:outline-hidden focus:ring-2 focus:ring-blue-500 cursor-pointer transition-colors"
            >
              <option value="ALL">Бүх анги хамтдаа</option>
              {classes.map((c) => (
                <option key={c} value={c}>{c} анги</option>
              ))}
            </select>
          </div>

          {/* Timeframe Filter Buttons */}
          <div className="flex items-center p-1 bg-slate-100/90 rounded-xl text-xs font-semibold">
            <button
              onClick={() => setTimeframe('TODAY')}
              className={`px-3.5 py-1.5 rounded-lg transition-all ${
                timeframe === 'TODAY'
                  ? 'bg-white text-blue-700 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Өнөөдөр
            </button>
            <button
              onClick={() => setTimeframe('WEEK')}
              className={`px-3.5 py-1.5 rounded-lg transition-all ${
                timeframe === 'WEEK'
                  ? 'bg-white text-blue-700 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Энэ 7 хоног
            </button>
            <button
              onClick={() => setTimeframe('MONTH')}
              className={`px-3.5 py-1.5 rounded-lg transition-all ${
                timeframe === 'MONTH'
                  ? 'bg-white text-blue-700 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Энэ сар
            </button>
          </div>
        </div>

        <div className="text-xs text-slate-500 flex items-center gap-2 self-start md:self-auto bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200/60 font-medium">
          <Calendar className="w-3.5 h-3.5 text-blue-600" />
          <span>
            {timeframe === 'TODAY' && `Өнөөдөр: ${todayStr}`}
            {timeframe === 'WEEK' && `7 хоног: ${weekRange.start} ~ ${weekRange.end}`}
            {timeframe === 'MONTH' && `Сар: ${monthRange.start} ~ ${monthRange.end}`}
          </span>
        </div>
      </div>

      {/* 4.1. АНГИЙН НИЙТ ГҮЙЦЭТГЭЛ (OVERALL PERFORMANCE SECTION) */}
      <section className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-6 md:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-5 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
                <TrendingUp className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-black text-slate-900 tracking-tight">
                Ангийн нийт гүйцэтгэл
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Хэсгийн ахлагчийн шалгасан дэвтэрийн бүртгэл болон багшийн баталгаажуулсан үнэлгээний нэгтгэл
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="font-semibold text-slate-700 bg-slate-100 px-3 py-1.5 rounded-xl">
              Сонголт: {selectedClass === 'ALL' ? 'Нийт сургууль' : `${selectedClass} анги`}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-center">
          {/* Progress Ring Card */}
          <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/40 border border-blue-100 flex flex-col items-center justify-center text-center">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">
              Нийт гүйцэтгэлийн хувь
            </span>

            {/* SVG Circular Progress Ring */}
            <div className="relative w-[140px] h-[140px] flex items-center justify-center">
              <svg width={ringSize} height={ringSize} className="rotate-[-90deg]">
                {/* Background Ring */}
                <circle
                  cx={ringSize / 2}
                  cy={ringSize / 2}
                  r={ringRadius}
                  fill="none"
                  stroke="#e2e8f0"
                  strokeWidth={ringStroke}
                />
                {/* Value Progress Ring */}
                <circle
                  cx={ringSize / 2}
                  cy={ringSize / 2}
                  r={ringRadius}
                  fill="none"
                  stroke={stats.completionRate >= 80 ? '#10b981' : stats.completionRate >= 60 ? '#2563eb' : '#f59e0b'}
                  strokeWidth={ringStroke}
                  strokeDasharray={ringCircumference}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                  className="transition-all duration-1000 ease-out"
                />
              </svg>

              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-black text-slate-900 tracking-tight">
                  {stats.completionRate}%
                </span>
                <span className="text-[11px] font-semibold text-slate-500">
                  {stats.completionRate >= 80 ? 'Маш сайн' : stats.completionRate >= 60 ? 'Хангалттай' : 'Анхаарах'}
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-600 mt-4 max-w-xs font-medium">
              Нийт <strong className="text-slate-900">{stats.totalExpectedSubmissions}</strong> шалгагдсан даалгавраас <strong className="text-emerald-600">{stats.completedCount}</strong> дэвтэр бүрэн хийгдсэн.
            </p>
          </div>

          {/* Performance breakdown indicators (3 Evaluations: Маш сайн, Дунд, Хийгээгүй, Шалгуулах) */}
          <div className="lg:col-span-2 space-y-4">
            {/* Metric 1: Маш сайн */}
            <div className="p-4 rounded-xl border border-emerald-100 bg-emerald-50/40 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  <span className="font-bold text-emerald-950">«Маш сайн» үнэлгээтэй дэвтэр</span>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-lg font-black text-emerald-600">{stats.onTimeCount}</span>
                  <span className="text-xs text-emerald-700 font-medium">даалгавар ({stats.onTimeRate}%)</span>
                </div>
              </div>
              <div className="h-2.5 w-full bg-emerald-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all duration-700"
                  style={{ width: `${stats.onTimeRate}%` }}
                />
              </div>
            </div>

            {/* Metric 2: Дунд */}
            <div className="p-4 rounded-xl border border-amber-100 bg-amber-50/40 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                  <span className="font-bold text-amber-950">«Дунд» үнэлгээтэй дэвтэр</span>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-lg font-black text-amber-600">{stats.lateCount}</span>
                  <span className="text-xs text-amber-700 font-medium">даалгавар</span>
                </div>
              </div>
              <div className="h-2.5 w-full bg-amber-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-amber-500 transition-all duration-700"
                  style={{
                    width: `${stats.totalExpectedSubmissions > 0 ? (stats.lateCount / stats.totalExpectedSubmissions) * 100 : 0}%`
                  }}
                />
              </div>
            </div>

            {/* Metric 3: Хийгээгүй */}
            <div className="p-4 rounded-xl border border-rose-100 bg-rose-50/40 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                  <span className="font-bold text-rose-950">«Хийгээгүй» даалгаврууд</span>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-lg font-black text-rose-600">{stats.notDoneCount}</span>
                  <span className="text-xs text-rose-700 font-medium">даалгавар</span>
                </div>
              </div>
              <div className="h-2.5 w-full bg-rose-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-rose-500 transition-all duration-700"
                  style={{
                    width: `${stats.totalExpectedSubmissions > 0 ? (stats.notDoneCount / stats.totalExpectedSubmissions) * 100 : 0}%`
                  }}
                />
              </div>
            </div>

            {/* Quick summary footer pills */}
            <div className="pt-2 flex flex-wrap items-center gap-3 text-xs text-slate-500">
              <div className="flex items-center gap-1.5 bg-slate-100 px-3 py-1.5 rounded-lg">
                <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
                <span>Нийт гүйцэтгэсэн: <strong>{stats.completedCount}</strong></span>
              </div>
              <div className="flex items-center gap-1.5 bg-slate-100 px-3 py-1.5 rounded-lg">
                <GraduationCap className="w-3.5 h-3.5 text-indigo-600" />
                <span>Хамрагдсан сурагч: <strong>{stats.totalStudents}</strong></span>
              </div>
              <div className="flex items-center gap-1.5 bg-slate-100 px-3 py-1.5 rounded-lg">
                <Clock className="w-3.5 h-3.5 text-amber-600" />
                <span>Шалгалт хүлээгдэж буй: <strong>{stats.submittedForReviewCount}</strong></span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4.2. ГЭРИЙН ДААЛГАВРАА ХАМГИЙН САЙН ХИЙСЭН 5 СУРАГЧ (TOP 5 LEADERBOARD) */}
      <section className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-6 md:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-5 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
                <Trophy className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-black text-slate-900 tracking-tight">
                Гэрийн даалгавраа хамгийн сайн хийсэн 5 сурагч
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Дэвтрийн шалгалтын гүйцэтгэлийн хувиар эрэмбэлэгдсэн манлайлагч сурагчид (Зөвшөөрсөн нийтийн нэрээр)
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="text-amber-800 bg-amber-50 border border-amber-200/60 font-bold px-3 py-1 rounded-full flex items-center gap-1.5">
              <Flame className="w-3.5 h-3.5 text-amber-500" />
              Тэргүүн байрууд
            </span>
          </div>
        </div>

        {leaderboard.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-xs bg-slate-50 rounded-2xl border border-dashed border-slate-200">
            Сонгосон хугацаа болон ангид одоогоор бүртгэл хийгдээгүй байна.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {leaderboard.map((item) => {
              // Distinction for top 3 vs 4th & 5th
              const isFirst = item.rank === 1;
              const isSecond = item.rank === 2;
              const isThird = item.rank === 3;

              return (
                <div
                  key={item.studentId}
                  className={`relative p-5 rounded-2xl border transition-all duration-300 flex flex-col justify-between group hover:-translate-y-1 hover:shadow-lg ${
                    isFirst
                      ? 'bg-gradient-to-b from-amber-50/70 via-white to-amber-50/30 border-amber-300 shadow-amber-100/50'
                      : isSecond
                      ? 'bg-gradient-to-b from-slate-100/80 via-white to-slate-50 border-slate-300 shadow-slate-100'
                      : isThird
                      ? 'bg-gradient-to-b from-amber-900/5 via-white to-orange-50/30 border-amber-600/30 shadow-orange-100/40'
                      : 'bg-white border-slate-200 hover:border-blue-200'
                  }`}
                >
                  {/* Top Rank Badge */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-1.5">
                      {isFirst && (
                        <span className="px-2.5 py-1 rounded-full bg-gradient-to-r from-amber-400 to-amber-600 text-white font-extrabold text-xs shadow-sm flex items-center gap-1">
                          <span>🥇</span>
                          <span>1-р байр</span>
                        </span>
                      )}
                      {isSecond && (
                        <span className="px-2.5 py-1 rounded-full bg-gradient-to-r from-slate-400 to-slate-600 text-white font-extrabold text-xs shadow-sm flex items-center gap-1">
                          <span>🥈</span>
                          <span>2-р байр</span>
                        </span>
                      )}
                      {isThird && (
                        <span className="px-2.5 py-1 rounded-full bg-gradient-to-r from-amber-700 to-amber-900 text-white font-extrabold text-xs shadow-sm flex items-center gap-1">
                          <span>🥉</span>
                          <span>3-р байр</span>
                        </span>
                      )}
                      {item.rank > 3 && (
                        <span className="w-7 h-7 rounded-full bg-slate-100 text-slate-700 font-bold text-xs flex items-center justify-center border border-slate-200">
                          #{item.rank}
                        </span>
                      )}
                    </div>

                    <span className="text-[11px] font-semibold text-slate-600 bg-white px-2 py-0.5 rounded-lg border border-slate-200">
                      {item.classId}
                    </span>
                  </div>

                  {/* Student Name & Completion */}
                  <div className="space-y-2">
                    <h4
                      className="font-black text-slate-900 text-base truncate"
                      title={item.publicDisplayName}
                    >
                      {item.publicDisplayName}
                    </h4>

                    <div>
                      <div className="flex items-baseline justify-between mb-1">
                        <span className="text-2xl font-black text-blue-600">
                          {item.completionRate}%
                        </span>
                        <span className="text-[10px] font-bold text-slate-400 uppercase">
                          Гүйцэтгэл
                        </span>
                      </div>

                      {/* Progress Bar for each student */}
                      <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-700 ${
                            item.completionRate >= 90
                              ? 'bg-gradient-to-r from-amber-400 to-emerald-500'
                              : item.completionRate >= 80
                              ? 'bg-emerald-500'
                              : 'bg-blue-600'
                          }`}
                          style={{ width: `${item.completionRate}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Breakdown details */}
                  <div className="mt-4 pt-3 border-t border-slate-100 text-xs text-slate-600 space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="text-[11px] text-slate-500">Нийт гүйцэтгэсэн:</span>
                      <strong className="text-slate-800">{item.totalCompleted}</strong>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[11px] text-emerald-700 font-medium">«Маш сайн»:</span>
                      <strong className="text-emerald-600">{item.onTimeCompleted}</strong>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[11px] text-amber-700 font-medium">«Дунд»:</span>
                      <strong className="text-amber-600">{Math.max(0, item.totalCompleted - item.onTimeCompleted)}</strong>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* SCHEDULE & HOMEWORK EXPLORER (INTERACTIVE DETAILS) */}
      <section ref={scheduleSectionRef} className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-6 md:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setActiveTab('SCHEDULE')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'SCHEDULE'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:text-slate-900'
              }`}
            >
              <Calendar className="w-4 h-4" />
              <span>Хичээлийн хуваарь ({chosenWeekdayObj ? chosenWeekdayObj.name : 'Өнөөдөр'})</span>
            </button>

            <button
              onClick={() => setActiveTab('HOMEWORK')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'HOMEWORK'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:text-slate-900'
              }`}
            >
              <BookOpen className="w-4 h-4" />
              <span>Хичээлийн дэвтрийн шалгалтууд ({activeHomework.length})</span>
            </button>
          </div>

          <span className="text-xs text-slate-500 font-semibold bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200/60">
            {selectedClass === 'ALL' ? '10А анги' : `${selectedClass} анги`}
          </span>
        </div>

        {activeTab === 'SCHEDULE' ? (
          <div className="space-y-4">
            {/* Weekday Switcher */}
            <div className="flex items-center gap-1.5 p-1 bg-slate-100/90 rounded-xl max-w-md">
              {WEEKDAYS.map((day) => (
                <button
                  key={day.id}
                  onClick={() => setScheduleWeekday(day.id)}
                  className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-semibold text-center transition-all ${
                    scheduleWeekday === day.id
                      ? 'bg-white text-blue-700 shadow-2xs font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {day.name}
                </button>
              ))}
            </div>

            {displaySchedule.length === 0 ? (
              <p className="text-xs text-slate-400 py-10 text-center bg-slate-50 rounded-xl">
                {chosenWeekdayObj?.name} гарагт хичээлийн хуваарь ороогүй байна.
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {displaySchedule.map((item) => (
                  <div
                    key={item.scheduleId}
                    className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 hover:bg-white border border-slate-200/70 hover:border-blue-300 hover:shadow-xs transition-all text-xs"
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-8 h-8 rounded-xl bg-blue-100 text-blue-800 flex items-center justify-center font-bold text-xs border border-blue-200/70">
                        {item.period}
                      </span>
                      <div>
                        <div className="font-bold text-slate-900 text-sm">{item.subjectName}</div>
                        <div className="text-[11px] text-slate-500 font-mono">{item.period}-р цагийн хичээл</div>
                      </div>
                    </div>
                    <div className="text-[11px] font-bold text-blue-700 bg-blue-50 px-3 py-1 rounded-lg border border-blue-200/60">
                      {item.period}-р цаг
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
            {activeHomework.length === 0 ? (
              <div className="col-span-3 text-center text-xs text-slate-400 py-8 bg-slate-50 rounded-xl">
                Одоогоор идэвхтэй даалгавар байхгүй байна.
              </div>
            ) : (
              activeHomework.map((hw, idx) => (
                <div
                  key={`${hw.homeworkId}-${idx}`}
                  className="p-4 rounded-xl border border-slate-200/90 hover:border-blue-300 hover:shadow-xs transition-all text-xs space-y-2 bg-slate-50/50 hover:bg-white"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-blue-700 text-[11px] bg-blue-50 px-2.5 py-0.5 rounded-md border border-blue-200/50">
                      {hw.subjectName} · {hw.classId}
                    </span>
                    <span className="text-[11px] text-slate-500 font-medium">
                      Хугацаа: <strong>{hw.dueDate}</strong>
                    </span>
                  </div>
                  <div className="font-bold text-slate-900 text-sm">
                    {hw.title}
                  </div>
                  <p className="text-[11px] text-slate-600 line-clamp-3">
                    {hw.description}
                  </p>
                </div>
              ))
            )}
          </div>
        )}
      </section>

      {/* 4.4. ДООД ХЭСЭГ (INSPIRATIONAL EDUCATION BANNER) */}
      <section className="rounded-2xl md:rounded-3xl p-8 bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white shadow-lg border border-blue-950 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="space-y-2 text-center md:text-left">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-xs font-semibold text-blue-200 border border-white/15">
            <Sparkles className="w-3.5 h-3.5 text-blue-300" />
            <span>Урам зориг & Амжилт</span>
          </div>
          <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            “Сайн суралцаж, өндөр амжилт гаргаарай!”
          </h3>
          <p className="text-xs sm:text-sm text-blue-200 max-w-xl font-medium">
            “Боловсрол бол ирээдүйн түлхүүр.” Гэрийн даалгавраа өдөр бүр нямбай гүйцэтгэж, мэдлэг чадвараа ахиулах нь амжилтын эхлэл юм.
          </p>
        </div>

        <button
          onClick={onOpenLogin}
          className="px-6 py-3 rounded-xl bg-white hover:bg-blue-50 text-blue-950 font-bold text-xs sm:text-sm shadow-md transition-all flex items-center gap-2 whitespace-nowrap transform active:scale-95"
        >
          <LogIn className="w-4 h-4 text-blue-600" />
          <span>Системд нэвтрэх</span>
        </button>
      </section>
    </div>
  );
};
