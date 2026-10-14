import React from 'react';
import { useAuth } from '../context/AuthContext';
import { BookOpen, LogOut, UserCircle } from 'lucide-react';

interface HeaderProps {
  onOpenAuthModal: () => void;
  onOpenGoogleSheetsModal?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenAuthModal,
}) => {
  const { currentUser, logout } = useAuth();

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-18">
          {/* Logo & System Name */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-700 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-600/20 ring-2 ring-blue-100">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-extrabold text-slate-900 tracking-tight text-base sm:text-lg">
                  Миний гэрийн даалгавар
                </h1>
                <span className="hidden md:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200/60">
                  v2.5
                </span>
              </div>
              <p className="text-[11px] text-slate-500 hidden sm:block font-medium">
                Сургуулийн гэрийн даалгаврын гүйцэтгэл хяналт, тайлангийн систем
              </p>
            </div>
          </div>

          {/* Right Action buttons */}
          <div className="flex items-center gap-2.5">
            {currentUser ? (
              <div className="flex items-center gap-2.5 pl-2 border-l border-slate-200">
                <div className="flex items-center gap-2 text-right">
                  <div className="hidden sm:block">
                    <div className="text-xs font-bold text-slate-900 leading-tight">
                      {currentUser.displayName}
                    </div>
                    <div className="text-[11px] font-semibold text-slate-500">
                      {currentUser.role === 'TEACHER' && 'Багш / Админ'}
                      {currentUser.role === 'LEADER' && 'Хэсгийн ахлагч'}
                      {currentUser.role === 'STUDENT' && 'Сурагч'}
                    </div>
                  </div>
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 text-blue-700 font-bold flex items-center justify-center text-xs border border-blue-200 shadow-xs">
                    {currentUser.displayName ? currentUser.displayName[0] : 'U'}
                  </div>
                </div>

                <button
                  onClick={logout}
                  title="Гарах"
                  className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={onOpenAuthModal}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 rounded-xl shadow-sm hover:shadow-md transition-all active:scale-95"
              >
                <UserCircle className="w-4 h-4" />
                <span>Нэвтрэх</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
