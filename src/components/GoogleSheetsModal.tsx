import React, { useState, useEffect } from 'react';
import {
  X,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  RefreshCw,
  Sparkles,
  Database,
  Users,
  Check,
  FileSpreadsheet,
  LogIn,
  LogOut,
  ShieldAlert,
  Calendar,
  ArrowDownToLine
} from 'lucide-react';
import { dataService } from '../services/dataService';
import { useAuth } from '../context/AuthContext';
import {
  googleSignIn,
  googleLogout,
  getAccessToken,
  initGoogleAuth
} from '../services/googleAuth';
import {
  populateSampleDataToSheet,
  verifySpreadsheetData,
  readFilledDataFromSheet,
  SpreadsheetVerificationResult
} from '../services/googleSheetsApi';
import { User as FirebaseUser } from 'firebase/auth';

interface GoogleSheetsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const DEFAULT_TARGET_SHEET_ID = '1Q6zw3ylYDCeKoEUuXey3Pu7lQT8LMc_r8e2jyHa8cTM';

export const GoogleSheetsModal: React.FC<GoogleSheetsModalProps> = ({ isOpen, onClose }) => {
  const { showToast, refreshUserData } = useAuth();
  const currentSettings = dataService.getSettings();

  const [sheetId, setSheetId] = useState(currentSettings.sheetId || DEFAULT_TARGET_SHEET_ID);
  const [gasUrl, setGasUrl] = useState(currentSettings.gasWebAppUrl || '');
  const [activeTab, setActiveTab] = useState<'direct_sheet' | 'apps_script' | 'guide'>('direct_sheet');

  // Google OAuth Auth State
  const [googleUser, setGoogleUser] = useState<FirebaseUser | null>(null);
  const [googleToken, setGoogleToken] = useState<string | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  // Operations state
  const [isPopulating, setIsPopulating] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [verificationResult, setVerificationResult] = useState<SpreadsheetVerificationResult | null>(null);
  const [showConfirmPopulate, setShowConfirmPopulate] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    initGoogleAuth(
      (user, token) => {
        setGoogleUser(user);
        setGoogleToken(token);
      },
      () => {
        setGoogleUser(null);
        setGoogleToken(null);
      }
    );
  }, []);

  if (!isOpen) return null;

  const handleGoogleLogin = async () => {
    setIsAuthenticating(true);
    setErrorMessage(null);
    try {
      const res = await googleSignIn();
      if (res) {
        setGoogleUser(res.user);
        setGoogleToken(res.accessToken);
        showToast('success', 'Google холболт амжилттай', `${res.user.email} бүртгэлээр нэвтэрлээ.`);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Google-ээр нэвтрэхэд алдаа гарлаа.');
      showToast('error', 'Google нэвтрэлт амжилтгүй', err.message);
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleGoogleLogout = async () => {
    await googleLogout();
    setGoogleUser(null);
    setGoogleToken(null);
    setVerificationResult(null);
    showToast('info', 'Google холболтыг салгалаа');
  };

  // Populate data with user confirmation
  const handlePopulateData = async () => {
    if (!googleToken) {
      setErrorMessage('Эхлээд Google бүртгэлээрээ нэвтэрнэ үү.');
      return;
    }
    if (!sheetId.trim()) {
      setErrorMessage('Google Sheet ID-гаа оруулна уу.');
      return;
    }

    setShowConfirmPopulate(false);
    setIsPopulating(true);
    setErrorMessage(null);

    try {
      await populateSampleDataToSheet(sheetId.trim(), googleToken);
      showToast('success', 'Амжилттай бичигдлээ!', 'Багш, сурагчид, хуваарь болон даалгаврууд Google Sheet рүү амжилттай орлоо.');
      // Auto-verify and sync after writing
      await handleSyncFromSheet();
    } catch (err: any) {
      setErrorMessage(err.message || 'Google Sheet рүү өгөгдөл бичихэд алдаа гарлаа.');
      showToast('error', 'Бичихэд алдаа гарлаа', err.message);
    } finally {
      setIsPopulating(false);
    }
  };

  // Sync filled rows directly from Google Sheet into active system
  const handleSyncFromSheet = async () => {
    if (!googleToken) {
      setErrorMessage('Эхлээд Google бүртгэлээрээ нэвтэрнэ үү.');
      return;
    }
    if (!sheetId.trim()) {
      setErrorMessage('Google Sheet ID-гаа оруулна уу.');
      return;
    }

    setIsSyncing(true);
    setErrorMessage(null);

    try {
      // 1. Read only filled rows
      const parsed = await readFilledDataFromSheet(sheetId.trim(), googleToken);
      // 2. Import into dataService
      const counts = dataService.importFromGoogleSheet({
        users: parsed.users,
        students: parsed.students,
        schedule: parsed.schedule,
        homework: parsed.homework,
        submissions: parsed.submissions,
        sheetId: sheetId.trim()
      });
      refreshUserData();

      // 3. Also run verification to display the latest metadata
      const verifyRes = await verifySpreadsheetData(sheetId.trim(), googleToken);
      setVerificationResult(verifyRes);

      showToast(
        'success',
        'Sheet-ээс амжилттай синк хийлээ!',
        `Хүснэгтийн бөглөсөн хэсгээс: ${counts.userCount} хэрэглэгч, ${counts.studentCount} сурагч, ${counts.scheduleCount} хичээлийн хуваарь, ${counts.homeworkCount} гэрийн даалгавар уншигдаж системд шинэчлэгдлээ. Даалгаврын явцын мөрүүд мөн шинэчлэгдлээ.`
      );
    } catch (err: any) {
      setErrorMessage(err.message || 'Хүснэгтээс өгөгдөл татахад алдаа гарлаа.');
      showToast('error', 'Синк амжилтгүй', err.message);
    } finally {
      setIsSyncing(false);
    }
  };

  // Verify data in the spreadsheet
  const handleVerifyData = async () => {
    if (!googleToken) {
      setErrorMessage('Эхлээд Google бүртгэлээрээ нэвтэрнэ үү.');
      return;
    }
    if (!sheetId.trim()) {
      setErrorMessage('Google Sheet ID-гаа оруулна уу.');
      return;
    }

    setIsVerifying(true);
    setErrorMessage(null);

    try {
      const result = await verifySpreadsheetData(sheetId.trim(), googleToken);
      setVerificationResult(result);
      showToast('success', 'Шалгалт амжилттай', result.message);
    } catch (err: any) {
      setErrorMessage(err.message || 'Хүснэгтийг шалгахад алдаа гарлаа. Хандах эрхээ шалгана уу.');
      showToast('error', 'Шалгалт амжилтгүй', err.message);
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden animate-fadeIn">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-emerald-600 text-white shadow-xs">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">
                Google Sheet Интеграц & Өгөгдөл Шалгах
              </h3>
              <p className="text-xs text-slate-500">
                Хүснэгт ID: <code className="font-mono text-emerald-800 font-semibold">{sheetId}</code>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switcher */}
        <div className="flex border-b border-slate-200 px-6 bg-slate-100/70 text-xs">
          <button
            onClick={() => setActiveTab('direct_sheet')}
            className={`py-3 px-4 font-bold border-b-2 transition-colors ${
              activeTab === 'direct_sheet'
                ? 'border-emerald-600 text-emerald-700 bg-white shadow-xs'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            1. Шууд Google Sheets API (OAuth & Синк)
          </button>
          <button
            onClick={() => setActiveTab('apps_script')}
            className={`py-3 px-4 font-bold border-b-2 transition-colors ${
              activeTab === 'apps_script'
                ? 'border-blue-600 text-blue-700 bg-white shadow-xs'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            2. Google Apps Script Web App
          </button>
          <button
            onClick={() => setActiveTab('guide')}
            className={`py-3 px-4 font-bold border-b-2 transition-colors ${
              activeTab === 'guide'
                ? 'border-slate-800 text-slate-900 bg-white shadow-xs'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            3. Заавар
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1 text-xs">
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 flex items-start gap-2 animate-shake">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {activeTab === 'direct_sheet' && (
            <div className="space-y-5">
              {/* Step 1: Google Account Authentication */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div>
                    <h4 className="font-bold text-slate-900 text-xs">1. Google бүртгэлээр холбогдох:</h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Хүснэгт рүү өгөгдөл бичих, унших зөвшөөрөл олгоно.
                    </p>
                  </div>

                  {googleUser ? (
                    <div className="flex items-center gap-2.5">
                      <div className="text-right">
                        <div className="font-bold text-slate-900 text-[11px]">{googleUser.displayName || 'Google Хэрэглэгч'}</div>
                        <div className="text-[10px] text-emerald-600 font-semibold">{googleUser.email}</div>
                      </div>
                      <button
                        onClick={handleGoogleLogout}
                        className="px-2.5 py-1 text-slate-600 hover:text-rose-600 bg-white border border-slate-200 rounded-md text-[11px]"
                      >
                        Салгах
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={handleGoogleLogin}
                      disabled={isAuthenticating}
                      className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 font-bold border border-slate-300 rounded-lg shadow-xs flex items-center gap-2 transition-all"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                      </svg>
                      {isAuthenticating ? 'Холбогдож байна...' : 'Google-ээр нэвтрэх'}
                    </button>
                  )}
                </div>
              </div>

              {/* Step 2: Spreadsheet ID Input & Direct link */}
              <div className="space-y-1.5">
                <label className="block font-bold text-slate-800">
                  Google Sheet ID (Хүснэгтийн ID):
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={sheetId}
                    onChange={(e) => setSheetId(e.target.value)}
                    placeholder="1Q6zw3ylYDCeKoEUuXey3Pu7lQT8LMc_r8e2jyHa8cTM"
                    className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono font-semibold"
                  />
                  <a
                    href={`https://docs.google.com/spreadsheets/d/${sheetId}/edit`}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold rounded-lg flex items-center gap-1.5 transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Sheet нээх
                  </a>
                </div>
              </div>

              {/* Step 3: Action Buttons */}
              <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/40 space-y-3">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div>
                    <h4 className="font-bold text-emerald-950 text-xs">
                      Хүснэгттэй харилцах үндсэн үйлдлүүд:
                    </h4>
                    <p className="text-[11px] text-emerald-800 mt-0.5">
                      Хүснэгтийн <strong>Users</strong>, <strong>Students</strong>, <strong>Schedule</strong> таб-уудын өгөгдлийг системд татаж, <strong>Submissions</strong> таб дахь даалгаврын явцыг хоёр чиглэлд синк хийнэ.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                    {/* Sync directly from Sheet to System Button */}
                    <button
                      onClick={handleSyncFromSheet}
                      disabled={isSyncing || !googleToken}
                      className="flex-1 sm:flex-none px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-lg shadow-xs flex items-center justify-center gap-1.5 disabled:opacity-50 transition-colors"
                    >
                      {isSyncing ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <ArrowDownToLine className="w-3.5 h-3.5" />
                      )}
                      Sheet-ээс уншиж синк хийх
                    </button>

                    {/* Populate Button */}
                    <button
                      onClick={() => setShowConfirmPopulate(true)}
                      disabled={isPopulating || !googleToken}
                      className="flex-1 sm:flex-none px-3.5 py-2 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 font-semibold rounded-lg shadow-xs flex items-center justify-center gap-1.5 disabled:opacity-50 transition-colors"
                    >
                      {isPopulating ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                      )}
                      Анхны өгөгдөл оруулах
                    </button>

                    {/* Verify Button */}
                    <button
                      onClick={handleVerifyData}
                      disabled={isVerifying || !googleToken}
                      className="flex-1 sm:flex-none px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white font-semibold rounded-lg shadow-xs flex items-center justify-center gap-1.5 disabled:opacity-50 transition-colors"
                    >
                      {isVerifying ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      )}
                      Шалгах
                    </button>
                  </div>
                </div>

                {!googleToken && (
                  <div className="text-[11px] text-amber-800 font-medium bg-amber-50 p-2.5 rounded-lg border border-amber-200">
                    💡 Эхлээд дээрх "Google-ээр нэвтрэх" товчийг дарж зөвшөөрөл олгоно уу.
                  </div>
                )}
              </div>

              {/* Confirmation Modal Box */}
              {showConfirmPopulate && (
                <div className="p-4 rounded-xl border-2 border-amber-400 bg-amber-50 space-y-3 animate-fadeIn">
                  <div className="flex items-start gap-2.5">
                    <ShieldAlert className="w-5 h-5 text-amber-700 flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-bold text-amber-900 text-xs">
                        Та хүснэгтэд өгөгдөл оруулахдаа итгэлтэй байна уу?
                      </h4>
                      <p className="text-[11px] text-amber-800 mt-1 leading-relaxed">
                        Энэ үйлдэл нь <strong>{sheetId}</strong> хүснэгтэд <code>Users</code>, <code>Students</code>, <code>Schedule</code>, <code>Homework</code>, <code>Submissions</code>, <code>Leaders</code>, <code>Settings</code>, <code>AuditLog</code> гэсэн таб үүсгэж, багш сурагчдын жишээ бүртгэлийг бичнэ.
                      </p>
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      onClick={() => setShowConfirmPopulate(false)}
                      className="px-3 py-1.5 bg-white border border-slate-300 text-slate-700 font-semibold rounded-lg hover:bg-slate-50"
                    >
                      Цуцлах
                    </button>
                    <button
                      onClick={handlePopulateData}
                      className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg shadow-xs"
                    >
                      Тийм, өгөгдлийг бичих
                    </button>
                  </div>
                </div>
              )}

              {/* Verification Results Report */}
              {verificationResult && (
                <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-3.5 shadow-xs animate-fadeIn">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <h4 className="font-bold text-slate-900 text-xs">
                        Хүснэгтийн шалгалтын дүн ({verificationResult.spreadsheetTitle})
                      </h4>
                    </div>
                    <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      Зөвхөн бөглөсөн мөрүүд уншигдсан
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div className="p-2.5 bg-slate-50 rounded-lg">
                      <span className="text-[10px] text-slate-400 font-semibold block">Users (Хэрэглэгчид)</span>
                      <span className="text-base font-bold text-slate-900">{verificationResult.userCount}</span>
                    </div>
                    <div className="p-2.5 bg-slate-50 rounded-lg">
                      <span className="text-[10px] text-slate-400 font-semibold block">Students (Сурагчид)</span>
                      <span className="text-base font-bold text-slate-900">{verificationResult.studentCount}</span>
                    </div>
                    <div className="p-2.5 bg-slate-50 rounded-lg">
                      <span className="text-[10px] text-slate-400 font-semibold block">Schedule (Хуваарь)</span>
                      <span className="text-base font-bold text-blue-600">{verificationResult.scheduleCount}</span>
                    </div>
                    <div className="p-2.5 bg-slate-50 rounded-lg">
                      <span className="text-[10px] text-slate-400 font-semibold block">Үүссэн Sheets таб</span>
                      <span className="text-base font-bold text-emerald-600">{verificationResult.sheetsFound.length}</span>
                    </div>
                  </div>

                  {/* Sample verified users preview */}
                  {verificationResult.sampleUsers.length > 0 && (
                    <div className="space-y-1 pt-1">
                      <div className="text-[11px] font-bold text-slate-700 flex items-center justify-between">
                        <span>Users хүснэгтээс уншсан хэрэглэгчид (Нэвтрэх нэр & Нууц үг):</span>
                        <span className="text-[10px] text-slate-400">Нийт {verificationResult.userCount}</span>
                      </div>
                      <div className="space-y-1">
                        {verificationResult.sampleUsers.map((u, idx) => (
                          <div key={idx} className="p-2 bg-slate-50 rounded border border-slate-100 flex items-center justify-between text-[11px]">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-blue-600 font-semibold">{u.username}</span>
                              <span className="text-slate-700">· {u.name}</span>
                            </div>
                            <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-mono text-[10px] font-bold">
                              {u.role}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Sample verified students preview */}
                  {verificationResult.sampleStudents.length > 0 && (
                    <div className="space-y-1 pt-1">
                      <div className="text-[11px] font-bold text-slate-700 flex items-center justify-between">
                        <span>Students хүснэгтээс уншсан сурагчид:</span>
                        <span className="text-[10px] text-slate-400">Нийт {verificationResult.studentCount}</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                        {verificationResult.sampleStudents.map((s, idx) => (
                          <div key={idx} className="p-2 bg-slate-50 rounded border border-slate-100 flex items-center justify-between text-[11px]">
                            <span className="font-semibold text-slate-800">{s.name}</span>
                            <span className="font-mono text-slate-500">{s.code} · {s.classId}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Sample verified schedule preview */}
                  {verificationResult.sampleSchedule && verificationResult.sampleSchedule.length > 0 && (
                    <div className="space-y-1 pt-1">
                      <div className="text-[11px] font-bold text-slate-700 flex items-center justify-between">
                        <span>Schedule хүснэгтээс уншсан хичээлийн хуваарь:</span>
                        <span className="text-[10px] text-slate-400">Нийт {verificationResult.scheduleCount}</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                        {verificationResult.sampleSchedule.map((sch, idx) => (
                          <div key={idx} className="p-2 bg-slate-50 rounded border border-slate-100 flex items-center justify-between text-[11px]">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-slate-800">{sch.day}</span>
                              <span className="text-slate-400">{sch.period}-р цаг:</span>
                              <span className="font-semibold text-blue-700">{sch.subject}</span>
                            </div>
                            <span className="text-slate-500 text-[10px]">{sch.teacher} ({sch.classId})</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === 'apps_script' && (
            <div className="space-y-4">
              <p className="text-slate-600 leading-relaxed text-xs">
                Хэрэв та Google Apps Script Web App ашиглан хүснэгттэйгээ харилцахыг хүсвэл доорх талбарт байршуулах боломжтой.
              </p>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Google Apps Script Web App URL:
                </label>
                <input
                  type="url"
                  value={gasUrl}
                  onChange={(e) => setGasUrl(e.target.value)}
                  placeholder="https://script.google.com/macros/s/.../exec"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono"
                />
              </div>
            </div>
          )}

          {activeTab === 'guide' && (
            <div className="space-y-3 leading-relaxed text-slate-700 text-xs">
              <div className="p-3 bg-blue-50 rounded-lg text-blue-900 border border-blue-200">
                <strong>Хүснэгтийн ID:</strong> <code>{sheetId}</code>
              </div>
              <ol className="list-decimal list-inside space-y-2 pl-1">
                <li>"Google-ээр нэвтрэх" товчийг дарж зөвшөөрөл олгоно.</li>
                <li>"Sheet-ээс уншиж синк хийх" товчийг дарснаар <code>users</code>, <code>students</code>, <code>Schedule</code> хүснэгтээс зөвхөн бөглөсөн мөрүүдийг автоматаар уншиж системд синк хийнэ.</li>
                <li><code>users</code> хүснэгтэд бичигдсэн хэрэглэгчийн нэр, нууц үгээр системд шууд нэвтрэх боломжтой болно.</li>
                <li><code>Schedule</code> хүснэгтэд бичигдсэн Даваа–Баасан гарагийн хичээлүүд сурагч болон багшийн дэлгэцэнд автоматаар харагдана.</li>
              </ol>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-slate-200 bg-slate-50">
          <div className="text-[11px] text-slate-500">
            Зорилтот хүснэгт: <span className="font-mono text-slate-700 font-semibold">{sheetId}</span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
            >
              Хаах
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
