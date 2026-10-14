import React, { useState } from 'react';
import {
  Calendar,
  Plus,
  Trash2,
  Check,
  X,
  BookOpen,
  LayoutGrid,
  Layers,
  Sparkles,
  RefreshCw,
  ArrowDownToLine,
  CloudUpload
} from 'lucide-react';
import { ScheduleItem, SubjectType } from '../types';
import { dataService } from '../services/dataService';
import { useAuth } from '../context/AuthContext';
import { WEEKDAYS } from '../utils/dateUtils';
import { getAccessToken } from '../services/googleAuth';
import { syncScheduleToSheet, readFilledDataFromSheet } from '../services/googleSheetsApi';

interface ScheduleManagerProps {
  classId: string;
}

// Periods 1 to 7 matching school schedule table
export const PERIODS = [1, 2, 3, 4, 5, 6, 7];

export const SUBJECT_COLOR_STYLES: Record<string, { bg: string; text: string; border: string; badge: string }> = {
  blue: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', badge: 'bg-blue-600 text-white' },
  indigo: { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200', badge: 'bg-indigo-600 text-white' },
  emerald: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', badge: 'bg-emerald-600 text-white' },
  teal: { bg: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-200', badge: 'bg-teal-600 text-white' },
  violet: { bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-200', badge: 'bg-violet-600 text-white' },
  cyan: { bg: 'bg-cyan-50', text: 'text-cyan-700', border: 'border-cyan-200', badge: 'bg-cyan-600 text-white' },
  rose: { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200', badge: 'bg-rose-600 text-white' },
  amber: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', badge: 'bg-amber-600 text-white' },
  orange: { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200', badge: 'bg-orange-600 text-white' },
  yellow: { bg: 'bg-yellow-50', text: 'text-yellow-800', border: 'border-yellow-200', badge: 'bg-yellow-500 text-slate-900' },
  red: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', badge: 'bg-red-600 text-white' },
  pink: { bg: 'bg-pink-50', text: 'text-pink-700', border: 'border-pink-200', badge: 'bg-pink-600 text-white' },
  slate: { bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-300', badge: 'bg-slate-600 text-white' },
  purple: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200', badge: 'bg-purple-600 text-white' },
};

const COLOR_OPTIONS = [
  { id: 'blue', label: 'Цэнхэр', bg: 'bg-blue-500' },
  { id: 'indigo', label: 'Хөх', bg: 'bg-indigo-500' },
  { id: 'emerald', label: 'Ногоон', bg: 'bg-emerald-500' },
  { id: 'teal', label: 'Оюу', bg: 'bg-teal-500' },
  { id: 'violet', label: 'Нил ягаан', bg: 'bg-violet-500' },
  { id: 'cyan', label: 'Цайвар цэнхэр', bg: 'bg-cyan-500' },
  { id: 'rose', label: 'Ягаан', bg: 'bg-rose-500' },
  { id: 'amber', label: 'Шар', bg: 'bg-amber-500' },
  { id: 'orange', label: 'Улбар шар', bg: 'bg-orange-500' },
  { id: 'red', label: 'Улаан', bg: 'bg-red-500' },
  { id: 'slate', label: 'Саарал', bg: 'bg-slate-500' },
];

export const ScheduleManager: React.FC<ScheduleManagerProps> = ({ classId }) => {
  const { currentUser, showToast } = useAuth();

  // Active view: grid (weekly matrix table) or subjects (manage subject types)
  const [viewMode, setViewMode] = useState<'grid' | 'subjects'>('grid');

  // Subject modal state
  const [isSubjectModalOpen, setIsSubjectModalOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState<SubjectType | null>(null);

  // Form states for subject type
  const [subName, setSubName] = useState<string>('');
  const [subCode, setSubCode] = useState<string>('');
  const [subCategory, setSubCategory] = useState<string>('Үндсэн');
  const [subColor, setSubColor] = useState<string>('blue');

  // Trigger re-render after mutations
  const [, setVersion] = useState(0);
  const [isSyncingSheet, setIsSyncingSheet] = useState(false);

  // Sync active schedule directly to Google Sheet
  const handlePushScheduleToSheet = async () => {
    setIsSyncingSheet(true);
    try {
      const settings = dataService.getSettings();
      const sheetId = settings.sheetId || '1Q6zw3ylYDCeKoEUuXey3Pu7lQT8LMc_r8e2jyHa8cTM';
      const token = await getAccessToken();

      if (!token) {
        showToast('warning', 'Google нэвтрэлт шаардлагатай', 'Google Sheets-тэй синк хийхийн тулд Google бүртгэлээр нэвтэрсэн байх шаардлагатай.');
        return;
      }

      const allItems = dataService.getSchedule();
      const result = await syncScheduleToSheet(sheetId, token, allItems);
      showToast('success', 'Google Sheet-д хадгалагдлаа', `Нийт ${result.count} хуваарийн мөр Google Sheet-ийн "Schedule" таб руу амжилттай синк хийгдлээ.`);
    } catch (err: any) {
      showToast('error', 'Хуваарь синк хийхэд алдаа гарлаа', err.message || 'Google Sheets холболтоо шалгана уу.');
    } finally {
      setIsSyncingSheet(false);
    }
  };

  // Pull latest schedule from Google Sheet
  const handlePullScheduleFromSheet = async () => {
    setIsSyncingSheet(true);
    try {
      const settings = dataService.getSettings();
      const sheetId = settings.sheetId || '1Q6zw3ylYDCeKoEUuXey3Pu7lQT8LMc_r8e2jyHa8cTM';
      const token = await getAccessToken();

      if (!token) {
        showToast('warning', 'Google нэвтрэлт шаардлагатай', 'Google Sheet-ээс хуваарь татахын тулд нэвтэрнэ үү.');
        return;
      }

      const parsed = await readFilledDataFromSheet(sheetId, token);
      if (parsed.schedule && parsed.schedule.length > 0) {
        dataService.importFromGoogleSheet({
          users: parsed.users,
          students: parsed.students,
          schedule: parsed.schedule,
          homework: parsed.homework,
          sheetId
        });
        setVersion(v => v + 1);
        showToast('success', 'Google Sheet-ээс татлаа', `${parsed.schedule.length} хичээлийн хуваарь амжилттай татагдаж шинэчлэгдлээ.`);
      } else {
        showToast('info', 'Мэдээлэл олдсонгүй', 'Google Sheet-ийн "Schedule" таб хоосон байна.');
      }
    } catch (err: any) {
      showToast('error', 'Google Sheet-ээс татахад алдаа гарлаа', err.message || 'Холболтоо шалгана уу.');
    } finally {
      setIsSyncingSheet(false);
    }
  };

  // Load registered subjects and all schedule items
  const subjects = dataService.getSubjects();
  const allScheduleItems = dataService.getSchedule(classId);

  // Helper to get subject metadata
  const getSubjectMeta = (name: string): SubjectType | undefined => {
    return subjects.find(s => s.name.toLowerCase() === name.toLowerCase());
  };

  const getSubjectColorStyle = (name: string) => {
    const meta = getSubjectMeta(name);
    const colorKey = meta?.color || 'blue';
    return SUBJECT_COLOR_STYLES[colorKey] || SUBJECT_COLOR_STYLES.blue;
  };

  // Direct cell subject changer (instant spreadsheet-like entry!)
  const handleCellSubjectChange = (weekday: number, period: number, selectedValue: string) => {
    if (!currentUser) return;

    // Special trigger: user wants to add a new subject type
    if (selectedValue === '__NEW_SUBJECT__') {
      handleOpenAddSubject();
      return;
    }

    const existingItem = allScheduleItems.find(s => s.weekday === weekday && s.period === period);

    // If empty/cleared selected
    if (!selectedValue) {
      if (existingItem) {
        dataService.deleteScheduleItem(currentUser, existingItem.scheduleId);
        setVersion(v => v + 1);
        showToast('info', 'Хичээл хасагдлаа', `${weekday}-р гарагийн ${period}-р цаг хоосон боллоо.`);
      }
      return;
    }

    // Save or update schedule item (NO start/end times!)
    const targetSubject = subjects.find(s => s.name === selectedValue);
    const subjectId = targetSubject?.subjectId || `sub_${selectedValue.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;

    const itemToSave: ScheduleItem = {
      scheduleId: existingItem?.scheduleId || `sch_${classId}_${weekday}_${period}_${Date.now()}`,
      classId,
      weekday,
      period,
      subjectId,
      subjectName: selectedValue,
      teacherName: '',
      startTime: '',
      endTime: '',
      active: true
    };

    dataService.saveScheduleItem(currentUser, itemToSave);
    setVersion(v => v + 1);

    // Auto-sync schedule to Google Sheet in background
    (async () => {
      try {
        const token = await getAccessToken();
        const settings = dataService.getSettings();
        const sheetId = settings.sheetId || '1Q6zw3ylYDCeKoEUuXey3Pu7lQT8LMc_r8e2jyHa8cTM';
        if (token && sheetId) {
          const allItems = dataService.getSchedule();
          await syncScheduleToSheet(sheetId, token, allItems);
        }
      } catch (err) {
        console.warn('Auto-sync schedule failed:', err);
      }
    })();

    showToast('success', 'Хуваарь шинэчлэгдлээ', `${period}-р цагт "${selectedValue}" хичээл сонгогдлоо.`);
  };

  // Quick remove single cell
  const handleRemoveCell = (scheduleId: string, subjectName: string) => {
    if (!currentUser) return;
    dataService.deleteScheduleItem(currentUser, scheduleId);
    setVersion(v => v + 1);

    (async () => {
      try {
        const token = await getAccessToken();
        const settings = dataService.getSettings();
        const sheetId = settings.sheetId || '1Q6zw3ylYDCeKoEUuXey3Pu7lQT8LMc_r8e2jyHa8cTM';
        if (token && sheetId) {
          const allItems = dataService.getSchedule();
          await syncScheduleToSheet(sheetId, token, allItems);
        }
      } catch (err) {
        console.warn('Auto-sync schedule deletion failed:', err);
      }
    })();

    showToast('info', 'Хичээл хасагдлаа', `"${subjectName}" хичээл хуваариас хасагдлаа.`);
  };

  // Subject Type Management handlers
  const handleOpenAddSubject = () => {
    setEditingSubject(null);
    setSubName('');
    setSubCode('');
    setSubCategory('Үндсэн');
    setSubColor('blue');
    setIsSubjectModalOpen(true);
  };

  const handleOpenEditSubject = (sub: SubjectType) => {
    setEditingSubject(sub);
    setSubName(sub.name);
    setSubCode(sub.code || '');
    setSubCategory(sub.category || 'Үндсэн');
    setSubColor(sub.color || 'blue');
    setIsSubjectModalOpen(true);
  };

  const handleSaveSubject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    if (!subName.trim()) {
      showToast('warning', 'Хичээлийн нэрийг оруулна уу');
      return;
    }

    const subId = editingSubject?.subjectId || `sub_${subName.trim().toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now().toString().slice(-4)}`;
    const code = subCode.trim() || subName.trim().slice(0, 3).toUpperCase();

    const subject: SubjectType = {
      subjectId: subId,
      name: subName.trim(),
      code,
      category: subCategory,
      color: subColor,
      active: true
    };

    dataService.saveSubject(currentUser, subject);
    setVersion(v => v + 1);
    setIsSubjectModalOpen(false);
    setEditingSubject(null);
    showToast('success', 'Хичээлийн төрөл хадгалагдлаа', `"${subject.name}" (${subject.code}) амжилттай бүртгэгдлээ.`);
  };

  const handleDeleteSubject = (subjectId: string, name: string) => {
    if (!currentUser) return;
    if (confirm(`"${name}" хичээлийн төрлийг системээс устгах уу?`)) {
      dataService.deleteSubject(currentUser, subjectId);
      setVersion(v => v + 1);
      showToast('info', 'Хичээлийн төрөл устгагдлаа');
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden animate-fadeIn">
      {/* 1. Top Header Toolbar */}
      <div className="p-5 sm:p-6 border-b border-slate-200 bg-white">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-200/80 shadow-xs">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-slate-900 text-base sm:text-lg">
                    Хичээлийн хуваарь
                  </h3>
                  <span className="px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 font-bold text-xs">
                    {classId} анги
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Цаг бүрийн нүдэнд хичээлээ шууд сонгож оруулна. Эхлэх дуусах цаг оруулах шаардлагагүй.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
            {/* View Mode Switcher */}
            <div className="flex items-center p-1 bg-slate-100 rounded-xl text-xs font-semibold">
              <button
                onClick={() => setViewMode('grid')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                  viewMode === 'grid'
                    ? 'bg-white text-blue-700 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Хичээлийн хуваарийн хүснэгт"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>Хуваарийн хүснэгт</span>
              </button>

              <button
                onClick={() => setViewMode('subjects')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                  viewMode === 'subjects'
                    ? 'bg-white text-blue-700 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Хичээлийн төрлүүд удирдах"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Хичээлийн төрлүүд ({subjects.length})</span>
              </button>
            </div>

            {/* Google Sheets Sync Buttons */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={handlePullScheduleFromSheet}
                disabled={isSyncingSheet}
                className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl shadow-2xs transition-colors disabled:opacity-50"
                title="Хүснэгтээс хуваарь татах"
              >
                <ArrowDownToLine className={`w-3.5 h-3.5 ${isSyncingSheet ? 'animate-bounce' : 'text-blue-600'}`} />
                <span className="hidden sm:inline">Хүснэгтээс татах</span>
              </button>

              <button
                onClick={handlePushScheduleToSheet}
                disabled={isSyncingSheet}
                className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 font-bold text-xs rounded-xl shadow-2xs transition-colors disabled:opacity-50"
                title="Одоогийн хуваарийг Хүснэгтэд хадгалах"
              >
                <CloudUpload className={`w-3.5 h-3.5 ${isSyncingSheet ? 'animate-pulse' : 'text-emerald-600'}`} />
                <span className="hidden sm:inline">Хүснэгтэд хадгалах</span>
              </button>
            </div>

            {/* Add Subject Type Button */}
            <button
              onClick={handleOpenAddSubject}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors"
              title="Шинэ хичээлийн төрөл үүсгэх"
            >
              <Plus className="w-4 h-4" />
              <span>Шинэ хичээлийн төрөл нэмэх</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. WEEKLY MATRIX TABLE (EXACTLY MATCHING THE USER'S SCREENSHOT!) */}
      {viewMode === 'grid' && (
        <div className="p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <div className="flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>Хүснэгтийн нүд тус бүрт хичээлээ шууд сонгож хадгална.</span>
            </div>
            <div className="font-semibold text-slate-700">
              Нийт хуваарьт хичээл: {allScheduleItems.length}
            </div>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-xl shadow-xs bg-white">
            <table className="w-full text-xs border-collapse min-w-[760px]">
              {/* Header row: ЦАГ | ДАВАА | МЯГМАР | ЛХАГВА | ПҮРЭВ | БААСАН */}
              <thead>
                <tr className="bg-slate-800 text-white font-bold border-b border-slate-700">
                  <th className="py-3 px-3 w-20 text-center border-r border-slate-700 uppercase tracking-wider text-xs font-black">
                    ЦАГ
                  </th>
                  {WEEKDAYS.map((day) => (
                    <th
                      key={day.id}
                      className="py-3 px-3 text-center border-r border-slate-700 last:border-r-0 font-bold uppercase tracking-wider text-xs"
                    >
                      {day.name}
                    </th>
                  ))}
                </tr>
              </thead>

              {/* Rows 1 to 7 */}
              <tbody className="divide-y divide-slate-200">
                {PERIODS.map((periodNum) => (
                  <tr key={periodNum} className="hover:bg-slate-50/50 transition-colors">
                    {/* FIRST COLUMN: ЦАГ (1, 2, 3, 4, 5, 6, 7) */}
                    <td className="py-3 px-3 border-r border-slate-200 bg-slate-50/90 text-center align-middle">
                      <div className="w-9 h-9 mx-auto rounded-xl bg-white border border-slate-300 shadow-2xs flex items-center justify-center font-black text-slate-800 text-sm">
                        {periodNum}
                      </div>
                    </td>

                    {/* 5 DAYS COLUMNS: ДАВАА, МЯГМАР, ЛХАГВА, ПҮРЭВ, БААСАН */}
                    {WEEKDAYS.map((day) => {
                      const item = allScheduleItems.find(s => s.weekday === day.id && s.period === periodNum);
                      const colorStyle = item ? getSubjectColorStyle(item.subjectName) : null;
                      const subMeta = item ? getSubjectMeta(item.subjectName) : null;

                      return (
                        <td
                          key={day.id}
                          className="py-2 px-2.5 border-r border-slate-200 last:border-r-0 align-middle min-w-[130px] h-20"
                        >
                          {item ? (
                            <div
                              className={`group relative p-2.5 rounded-xl border ${colorStyle?.border} ${colorStyle?.bg} h-full flex flex-col justify-between shadow-2xs hover:shadow-xs transition-all`}
                            >
                              <div className="flex items-center justify-end">
                                {/* Quick remove button */}
                                <button
                                  onClick={() => handleRemoveCell(item.scheduleId, item.subjectName)}
                                  title="Хуваариас хасах"
                                  className="opacity-50 group-hover:opacity-100 hover:bg-rose-100 hover:text-rose-700 text-slate-400 rounded-lg p-1 transition-all"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>

                              {/* Subject selection dropdown to view and quickly switch subject */}
                              <div className="mt-auto">
                                <select
                                  value={item.subjectName}
                                  onChange={(e) => handleCellSubjectChange(day.id, periodNum, e.target.value)}
                                  className="w-full text-xs font-black text-slate-900 bg-transparent border-none p-0 cursor-pointer focus:ring-0 outline-none truncate"
                                  title="Хичээл солих"
                                >
                                  {subjects.map((sub) => (
                                    <option key={sub.subjectId} value={sub.name}>
                                      {sub.name}
                                    </option>
                                  ))}
                                  <option value="">-- Хасах (Хоосон) --</option>
                                  <option value="__NEW_SUBJECT__">+ Шинэ төрөл нэмэх...</option>
                                </select>
                              </div>
                            </div>
                          ) : (
                            <div className="h-full flex items-center justify-center">
                              <select
                                value=""
                                onChange={(e) => handleCellSubjectChange(day.id, periodNum, e.target.value)}
                                className="w-full py-2 px-2.5 text-xs text-slate-500 bg-slate-50 hover:bg-blue-50/50 border border-dashed border-slate-200 hover:border-blue-400 rounded-xl cursor-pointer transition-all outline-none text-center font-medium"
                                title={`${day.name} гараг, ${periodNum}-р цагт хичээл сонгох`}
                              >
                                <option value="">+ Сонгох</option>
                                {subjects.map((sub) => (
                                  <option key={sub.subjectId} value={sub.name} className="text-slate-800 font-semibold text-left">
                                    {sub.name}
                                  </option>
                                ))}
                                <option value="__NEW_SUBJECT__" className="text-blue-600 font-bold text-left">
                                  + Шинэ төрөл нэмэх...
                                </option>
                              </select>
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3. SUBJECT TYPES MANAGEMENT VIEW */}
      {viewMode === 'subjects' && (
        <div className="p-5 sm:p-6 space-y-5 animate-fadeIn">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
            <div>
              <h4 className="font-bold text-slate-900 text-sm">Бүртгэлтэй хичээлийн төрлүүд</h4>
              <p className="text-xs text-slate-500">
                Хичээлийн нэр, товчлол код, таних өнгийг эндээс нэмж удирдана
              </p>
            </div>
            <button
              onClick={handleOpenAddSubject}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Шинэ төрөл нэмэх</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {subjects.map((sub) => {
              const colorKey = sub.color || 'blue';
              const styles = SUBJECT_COLOR_STYLES[colorKey] || SUBJECT_COLOR_STYLES.blue;
              const countInSchedule = allScheduleItems.filter(s => s.subjectName.toLowerCase() === sub.name.toLowerCase()).length;

              return (
                <div
                  key={sub.subjectId}
                  className={`p-3.5 rounded-xl border ${styles.border} ${styles.bg} flex flex-col justify-between hover:shadow-xs transition-all`}
                >
                  <div className="flex items-start justify-between gap-2">
                    {sub.code && !sub.code.startsWith('SUB') ? (
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${styles.badge}`}>
                        {sub.code}
                      </span>
                    ) : (
                      <span className="w-2 h-2 rounded-full bg-blue-500 my-1"></span>
                    )}
                    <span className="text-[10px] text-slate-500 font-medium">
                      {countInSchedule} цаг орсон
                    </span>
                  </div>

                  <div className="my-2">
                    <div className="font-bold text-slate-900 text-sm">{sub.name}</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">{sub.category || 'Үндсэн'}</div>
                  </div>

                  <div className="pt-2 border-t border-slate-200/60 flex items-center justify-end gap-1.5">
                    <button
                      onClick={() => handleOpenEditSubject(sub)}
                      className="px-2 py-1 text-[11px] font-semibold text-slate-600 hover:text-blue-600 hover:bg-white rounded transition-colors"
                    >
                      Засах
                    </button>
                    <button
                      onClick={() => handleDeleteSubject(sub.subjectId, sub.name)}
                      className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                      title="Устгах"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 4. MODAL: ADD / EDIT SUBJECT TYPE */}
      {isSubjectModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 animate-scaleUp">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold text-slate-900 text-base">
                  {editingSubject ? 'Хичээлийн төрөл засах' : 'Шинэ хичээлийн төрөл нэмэх'}
                </h3>
              </div>
              <button
                onClick={() => setIsSubjectModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSubject} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Хичээлийн нэр <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={subName}
                  onChange={(e) => {
                    setSubName(e.target.value);
                    if (!subCode && e.target.value.length >= 2) {
                      setSubCode(e.target.value.slice(0, 3).toUpperCase());
                    }
                  }}
                  placeholder="Жишээ: Дүрслэх урлаг, Англи хэл"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Товчлол код (2-4 үсэг)
                  </label>
                  <input
                    type="text"
                    value={subCode}
                    onChange={(e) => setSubCode(e.target.value.toUpperCase())}
                    placeholder="Жишээ: ДУ, АНГ"
                    maxLength={4}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-mono font-bold uppercase focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Ангилал
                  </label>
                  <select
                    value={subCategory}
                    onChange={(e) => setSubCategory(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 outline-none font-medium"
                  >
                    <option value="Үндсэн">Үндсэн</option>
                    <option value="Сонгон">Сонгон</option>
                    <option value="Нэмэлт">Нэмэлт</option>
                    <option value="Дугуйлан">Дугуйлан</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Ялгах өнгө
                </label>
                <div className="flex flex-wrap gap-2">
                  {COLOR_OPTIONS.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setSubColor(c.id)}
                      className={`w-7 h-7 rounded-lg ${c.bg} flex items-center justify-center transition-all ${
                        subColor === c.id ? 'ring-2 ring-offset-2 ring-slate-800 scale-110 shadow-xs' : 'opacity-80 hover:opacity-100'
                      }`}
                      title={c.label}
                    >
                      {subColor === c.id && <Check className="w-4 h-4 text-white" />}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsSubjectModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  Болих
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
                >
                  {editingSubject ? 'Шинэчлэх' : 'Хадгалах'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
