import React, { useState } from 'react';
import { X, Calendar, BookOpen, Clock, AlertCircle } from 'lucide-react';
import { Homework } from '../types';
import { dataService } from '../services/dataService';
import { useAuth } from '../context/AuthContext';
import { getTodayUlaanbaatar } from '../utils/dateUtils';

interface HomeworkModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingHomework?: Homework | null;
  onSaved: () => void;
}

export const HomeworkModal: React.FC<HomeworkModalProps> = ({
  isOpen,
  onClose,
  existingHomework,
  onSaved,
}) => {
  const { currentUser, showToast } = useAuth();
  const classes = dataService.getClasses();
  const today = getTodayUlaanbaatar();

  const [title, setTitle] = useState(existingHomework?.title || '');
  const [classId, setClassId] = useState(existingHomework?.classId || (classes[0] || '10А'));
  const [subjectName, setSubjectName] = useState(existingHomework?.subjectName || 'Математик');
  const [description, setDescription] = useState(existingHomework?.description || '');
  const [assignedDate, setAssignedDate] = useState(existingHomework?.assignedDate || today);
  const [dueDate, setDueDate] = useState(existingHomework?.dueDate || today);
  const [status, setStatus] = useState<'ACTIVE' | 'CANCELLED'>(existingHomework?.status || 'ACTIVE');
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim() || !subjectName.trim()) {
      setError('Бүх шаардлагатай талбарыг бөглөнө үү.');
      return;
    }

    if (dueDate < assignedDate) {
      setError('Дуусах хугацаа нь өгсөн хугацаанаас өмнө байж болохгүй.');
      return;
    }

    if (!currentUser) return;

    const hw: Homework = {
      homeworkId: existingHomework?.homeworkId || ('hw_' + Math.random().toString(36).substring(2, 9)),
      classId,
      subjectId: 'sub_' + subjectName.toLowerCase().replace(/[^a-z0-9]/g, '_'),
      subjectName,
      title: title.trim(),
      description: description.trim(),
      assignedDate,
      dueDate,
      createdBy: currentUser.userId,
      status,
      createdAt: existingHomework?.createdAt || new Date().toISOString()
    };

    dataService.saveHomework(currentUser, hw);


    showToast('success', 'Амжилттай хадгалагдлаа', `"${hw.title}" даалгавар систем болон Google Sheet-д бүртгэгдлээ (автоматаар хадгалагдана).`);
    onSaved();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden animate-fadeIn">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-blue-600" />
            <h3 className="font-bold text-slate-900 text-sm">
              {existingHomework ? 'Гэрийн даалгавар засах' : 'Шинэ гэрийн даалгавар үүсгэх'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          {error && (
            <div className="p-2.5 rounded bg-rose-50 border border-rose-200 text-rose-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Анги:</label>
              <select
                value={classId}
                onChange={(e) => setClassId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-blue-500"
              >
                {classes.map(c => (
                  <option key={c} value={c}>{c} анги</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Хичээл:</label>
              <select
                value={subjectName}
                onChange={(e) => setSubjectName(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-blue-500"
              >
                <option value="Математик">Математик</option>
                <option value="Физик">Физик</option>
                <option value="Монгол хэл">Монгол хэл</option>
                <option value="Уран зохиол">Уран зохиол</option>
                <option value="Англи хэл">Англи хэл</option>
                <option value="Мэдээлэл зүй">Мэдээлэл зүй</option>
                <option value="Хими">Хими</option>
                <option value="Биологи">Биологи</option>
                <option value="Түүх">Түүх</option>
                <option value="Нийгэм судлал">Нийгэм судлал</option>
                <option value="Газар зүй">Газар зүй</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Даалгаврын нэр / Сэдэв:</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Жишээ: Квадрат тэгшитгэл бодох хуудас 45"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Дэлгэрэнгүй заавар, тайлбар:</label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Даалгаврын шаардлага, сурах бичгийн бодлогын дугаарууд..."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Өгсөн огноо:</label>
              <input
                type="date"
                value={assignedDate}
                onChange={(e) => setAssignedDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Хугацаа дуусах огноо:</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
          </div>

          {existingHomework && (
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Төлөв:</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as 'ACTIVE' | 'CANCELLED')}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500"
              >
                <option value="ACTIVE">Идэвхтэй</option>
                <option value="CANCELLED">Цуцалсан</option>
              </select>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Болих
            </button>
            <button
              type="submit"
              className="px-4 py-2 font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs transition-colors"
            >
              Хадгалах
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
