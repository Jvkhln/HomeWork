import React, { useState } from 'react';
import { X, Lock, User, ShieldCheck, UserCheck, GraduationCap, ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      setError('Нэвтрэх нэр болон нууц үгээ оруулна уу.');
      return;
    }
    setLoading(true);
    setError(null);
    const result = await login(username, password);
    setLoading(false);
    if (result.success) {
      onClose();
    } else {
      setError(result.error || 'Нэвтрэхэд алдаа гарлаа.');
    }
  };

  const handleQuickLogin = async (user: string, pass: string) => {
    setUsername(user);
    setPassword(pass);
    setLoading(true);
    setError(null);
    const result = await login(user, pass);
    setLoading(false);
    if (result.success) {
      onClose();
    } else {
      setError(result.error || 'Нэвтрэхэд алдаа гарлаа.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-fadeIn">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
          <div>
            <h3 className="font-bold text-slate-900 text-base">Системд нэвтрэх</h3>
            <p className="text-xs text-slate-500">Үүрэгт эрхээрээ нэвтэрч системд хандана уу</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5 text-xs">
          {/* Quick Demo Test Buttons */}
          <div>
            <label className="block text-slate-500 text-[11px] font-semibold uppercase tracking-wider mb-2">
              Шуурхай турших эрхүүд:
            </label>
            <div className="grid grid-cols-1 gap-2">
              <button
                type="button"
                onClick={() => handleQuickLogin('teacher1', 'password123')}
                className="flex items-center justify-between p-2.5 rounded-lg border border-blue-200 bg-blue-50/50 hover:bg-blue-100 text-left transition-colors group"
              >
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 bg-blue-600 text-white rounded">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-bold text-slate-900 text-xs">Багш / Админ</div>
                    <div className="text-[11px] text-slate-500">teacher1 · Д. Энхжаргал</div>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-blue-600 group-hover:translate-x-0.5 transition-transform" />
              </button>

              <button
                type="button"
                onClick={() => handleQuickLogin('leader_bold', 'password123')}
                className="flex items-center justify-between p-2.5 rounded-lg border border-emerald-200 bg-emerald-50/50 hover:bg-emerald-100 text-left transition-colors group"
              >
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 bg-emerald-600 text-white rounded">
                    <UserCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-bold text-slate-900 text-xs">Хэсгийн ахлагч</div>
                    <div className="text-[11px] text-slate-500">leader_bold · Т. Болд-Эрдэнэ (10А)</div>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-emerald-600 group-hover:translate-x-0.5 transition-transform" />
              </button>

              <button
                type="button"
                onClick={() => handleQuickLogin('student_bat', 'password123')}
                className="flex items-center justify-between p-2.5 rounded-lg border border-indigo-200 bg-indigo-50/50 hover:bg-indigo-100 text-left transition-colors group"
              >
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 bg-indigo-600 text-white rounded">
                    <GraduationCap className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-bold text-slate-900 text-xs">Сурагч</div>
                    <div className="text-[11px] text-slate-500">student_bat · Г. Батбаяр (10А)</div>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-indigo-600 group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>
          </div>

          <div className="relative flex items-center justify-center">
            <div className="border-t border-slate-200 w-full" />
            <span className="bg-white px-3 text-slate-400 text-[11px] uppercase tracking-wider absolute">
              эсвэл гараар нэвтрэх
            </span>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-3.5">
            {error && (
              <div className="p-2.5 rounded bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                {error}
              </div>
            )}

            <div>
              <label className="block font-medium text-slate-700 mb-1">
                Нэвтрэх нэр / Сурагчийн код:
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Жишээ: teacher1 эсвэл 10A-02"
                  className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 text-xs"
                />
              </div>
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">Нууц үг:</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Нууц үгээ оруулна уу"
                  className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 text-xs"
                />
              </div>
              <p className="text-[11px] text-slate-400 mt-1">Туршилтын нууц үг: password123</p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-xs transition-colors flex items-center justify-center gap-2 disabled:opacity-50 text-xs"
            >
              {loading ? 'Шалгаж байна...' : 'Нэвтрэх'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
