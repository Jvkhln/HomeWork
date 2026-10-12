/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Header } from './components/Header';
import { PublicLanding } from './components/PublicLanding';
import { TeacherDashboard } from './components/TeacherDashboard';
import { LeaderDashboard } from './components/LeaderDashboard';
import { StudentDashboard } from './components/StudentDashboard';
import { AuthModal } from './components/AuthModal';
import { GoogleSheetsModal } from './components/GoogleSheetsModal';
import { AlertCircle, X, CheckCircle, Info, AlertTriangle } from 'lucide-react';

const AppContent: React.FC = () => {
  const { currentUser, toasts, dismissToast } = useAuth();
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isGoogleSheetsModalOpen, setIsGoogleSheetsModalOpen] = useState(false);
  const [showPublicPreview, setShowPublicPreview] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans selection:bg-blue-100 selection:text-blue-900">
      {/* Toast Notifications */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto p-3.5 rounded-xl shadow-lg border text-xs flex items-start gap-2.5 transition-all duration-300 animate-slideUp ${
              toast.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : toast.type === 'error'
                ? 'bg-rose-50 border-rose-200 text-rose-900'
                : toast.type === 'warning'
                ? 'bg-amber-50 border-amber-200 text-amber-900'
                : 'bg-blue-50 border-blue-200 text-blue-900'
            }`}
          >
            {toast.type === 'success' && <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />}
            {toast.type === 'error' && <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />}
            {toast.type === 'warning' && <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />}
            {toast.type === 'info' && <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />}
            
            <div className="flex-1">
              <div className="font-bold">{toast.title}</div>
              {toast.message && <div className="text-[11px] opacity-90 mt-0.5">{toast.message}</div>}
            </div>

            <button
              onClick={() => dismissToast(toast.id)}
              className="p-1 hover:opacity-75 transition-opacity"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>

      {/* Main Header */}
      <Header
        onOpenAuthModal={() => setIsAuthModalOpen(true)}
      />

      {/* Secondary Bar for Logged in Users wishing to toggle between role dashboard and public preview */}
      {currentUser && (
        <div className="bg-white border-b border-slate-200 px-4 py-2">
          <div className="max-w-7xl mx-auto flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-slate-500">
              <span>Нэвтэрсэн эрх:</span>
              <strong className="text-slate-800 font-semibold">
                {currentUser.role === 'TEACHER' && 'Багш / Админ'}
                {currentUser.role === 'LEADER' && 'Хэсгийн ахлагч'}
                {currentUser.role === 'STUDENT' && 'Сурагч'}
              </strong>
            </div>

            <button
              onClick={() => setShowPublicPreview(!showPublicPreview)}
              className="text-blue-600 hover:text-blue-800 font-semibold underline text-xs"
            >
              {showPublicPreview ? 'Өөрийн удирдлагын цонх руу буцах' : 'Нийтийн нүүр хуудсыг урьдчилан харах'}
            </button>
          </div>
        </div>
      )}

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {!currentUser || showPublicPreview ? (
          <PublicLanding onOpenLogin={() => setIsAuthModalOpen(true)} />
        ) : (
          <>
            {currentUser.role === 'TEACHER' && <TeacherDashboard />}
            {currentUser.role === 'LEADER' && <LeaderDashboard />}
            {currentUser.role === 'STUDENT' && <StudentDashboard />}
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200/80 py-8 text-xs text-slate-500 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-xs">
                М
              </div>
              <div>
                <span className="font-extrabold text-slate-800 text-sm">Миний гэрийн даалгавар</span>
                <span className="text-slate-400 text-xs hidden sm:inline"> — Сургуулийн гэрийн даалгаврын нэгдсэн систем</span>
              </div>
            </div>

            {/* Inspiring motto */}
            <div className="text-center sm:text-right">
              <p className="font-bold text-slate-700 text-xs">“Сайн суралцаж, өндөр амжилт гаргаарай!”</p>
              <p className="text-[11px] text-blue-600 font-medium">“Боловсрол бол ирээдүйн түлхүүр.”</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-slate-400">
            <div>
              <span>Цагийн бүс: Asia/Ulaanbaatar (UTC+8)</span>
              <span className="mx-2">·</span>
              <span>Дэвтрийн шалгалт, хяналтын стандарт</span>
            </div>

            {currentUser?.role === 'TEACHER' && (
              <button
                onClick={() => setIsGoogleSheetsModalOpen(true)}
                className="text-slate-500 hover:text-blue-600 transition-colors font-semibold flex items-center gap-1.5"
              >
                <span>⚙️ Системийн тохиргоо (Google Sheets)</span>
              </button>
            )}
          </div>
        </div>
      </footer>

      {/* Modals */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
      />

      <GoogleSheetsModal
        isOpen={isGoogleSheetsModalOpen}
        onClose={() => setIsGoogleSheetsModalOpen(false)}
      />
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
