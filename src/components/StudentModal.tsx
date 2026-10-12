import React, { useState } from 'react';
import { X, User, AlertCircle, ShieldCheck } from 'lucide-react';
import { Student } from '../types';
import { dataService } from '../services/dataService';
import { useAuth } from '../context/AuthContext';

interface StudentModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingStudent?: Student | null;
  onSaved: () => void;
}

export const StudentModal: React.FC<StudentModalProps> = ({
  isOpen,
  onClose,
  existingStudent,
  onSaved,
}) => {
  const { currentUser, showToast } = useAuth();
  const classes = dataService.getClasses();

  const [studentCode, setStudentCode] = useState(existingStudent?.studentCode || '');
  const [fullName, setFullName] = useState(existingStudent?.fullName || '');
  const [classId, setClassId] = useState(existingStudent?.classId || (classes[0] || '10А'));
  const [publicDisplayName, setPublicDisplayName] = useState(existingStudent?.publicDisplayName || '');
  const [showOnLeaderboard, setShowOnLeaderboard] = useState(existingStudent ? existingStudent.showOnLeaderboard : true);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentCode.trim() || !fullName.trim()) {
      setError('Сурагчийн код болон овог нэрийг заавал бөглөнө үү.');
      return;
    }

    if (!currentUser) return;

    const student: Student = {
      studentId: existingStudent?.studentId || ('std_' + Math.random().toString(36).substring(2, 9)),
      studentCode: studentCode.trim().toUpperCase(),
      fullName: fullName.trim(),
      classId,
      active: existingStudent ? existingStudent.active : true,
      publicDisplayName: publicDisplayName.trim() || fullName.trim().split(' ')[0],
      showOnLeaderboard
    };

    dataService.saveStudent(currentUser, student);
    showToast('success', 'Амжилттай хадгалагдлаа', `${student.fullName} сурагчийн мэдээлэл шинэчлэгдлээ.`);
    onSaved();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-fadeIn">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-blue-600" />
            <h3 className="font-bold text-slate-900 text-sm">
              {existingStudent ? 'Сурагчийн мэдээлэл засах' : 'Шинэ сурагч бүртгэх'}
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
              <label className="block font-semibold text-slate-700 mb-1">Сурагчийн код:</label>
              <input
                type="text"
                value={studentCode}
                onChange={(e) => setStudentCode(e.target.value)}
                placeholder="Жишээ: 10A-15"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono uppercase focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

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
                <option value="11А">11А анги</option>
                <option value="11Б">11Б анги</option>
                <option value="12А">12А анги</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Бүтэн овог нэр:</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Жишээ: Бат овогтой Болд"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Самбарт харуулах нэр (Public alias):
            </label>
            <input
              type="text"
              value={publicDisplayName}
              onChange={(e) => setPublicDisplayName(e.target.value)}
              placeholder="Жишээ: Болд Б. (Нүүр хуудсанд харагдах нэр)"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Хоосон орхивол нэрийн эхний үг ашиглагдана.
            </p>
          </div>

          <div className="pt-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showOnLeaderboard}
                onChange={(e) => setShowOnLeaderboard(e.target.checked)}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="font-medium text-slate-700">Тэргүүлэгчдийн самбарт харуулахыг зөвшөөрөх</span>
            </label>
          </div>

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
