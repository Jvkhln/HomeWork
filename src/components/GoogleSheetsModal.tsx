import React, { useEffect, useState } from 'react';
import { X, CheckCircle2, AlertCircle, ExternalLink, RefreshCw, Database, Link2, Unlink, Loader2 } from 'lucide-react';
import { dataService } from '../services/dataService';
import { useAuth } from '../context/AuthContext';

interface GoogleSheetsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SHEET_ID = '1Q6zw3ylYDCeKoEUuXey3Pu7lQT8LMc_r8e2jyHa8cTM';

const TABS: { name: string; desc: string }[] = [
  { name: '1-р tab (users)', desc: 'getSheets()[0] — Нэвтрэх нэр, нууц үг, анги бүлэг, хэсгийн ахлагч (тийм/үгүй) — цорын ганц үнэн эх сурвалж' },
  { name: 'homework_log', desc: 'Хэсгийн ахлагчийн бүртгэсэн даалгаврын гүйцэтгэл (UUID, сурагч, хичээл, огноо, төлөв, тайлбар, updatedBy)' },
  { name: 'Schedule', desc: 'Багшийн оруулсан хичээлийн хуваарь (анги бүлэг, гараг, цаг, хичээл, багш, танхим, updatedBy, deleted)' },
  { name: 'Homework', desc: 'Гэрийн даалгаврын бүртгэл' },
  { name: 'Submissions', desc: 'Даалгаврын явц, үнэлгээ' },
  { name: 'Groups', desc: 'Ангийн хэсэг (бүлгүүд)' },
  { name: 'Leaders', desc: 'Хэсгийн ахлагчид' },
  { name: 'StudentData', desc: 'Сурагчийн хэсэг / ахлагчийн тэмдэглэгээ' },
  { name: 'Subjects', desc: 'Хичээлийн төрлүүд' },
  { name: 'AuditLog', desc: 'Үйлдлийн түүх' }
];

export const GoogleSheetsModal: React.FC<GoogleSheetsModalProps> = ({ isOpen, onClose }) => {
  const { currentUser, showToast, forceLogout } = useAuth();
  const settings = dataService.getSettings();
  const [url, setUrl] = useState(settings.gasWebAppUrl || '');
  const [tab, setTab] = useState<'connect' | 'guide'>('connect');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [, setTick] = useState(0);

  useEffect(() => dataService.subscribeSync(() => setTick(t => t + 1)), [isOpen]);
  useEffect(() => dataService.subscribe(() => setTick(t => t + 1)), []);

  if (!isOpen) return null;

  const connected = dataService.isSheetsMode();
  const status = dataService.getSyncStatus();

  const handleTest = async () => {
    setBusy(true);
    const r = await dataService.testGasConnection(url);
    setResult({ ok: r.success, text: r.message });
    setBusy(false);
  };

  const handleConnect = async () => {
    setBusy(true);
    setResult(null);
    const r = await dataService.connectSheets(url);
    setBusy(false);
    setResult({ ok: r.success, text: r.message });
    if (r.success) {
      showToast('success', 'Google Sheets холбогдлоо', 'Одоо users sheet (эхний tab)-д бүртгэлтэй нэр, нууц үгээрээ нэвтэрнэ үү.');
      forceLogout();
      onClose();
    }
  };

  const handleDisconnect = () => {
    if (!window.confirm('Google Sheets холболтыг салгаад демо горим руу шилжих үү? (Sheet-ийн өгөгдөл устахгүй)')) return;
    dataService.disconnectSheets();
    forceLogout();
    showToast('info', 'Демо горим руу шилжлээ');
    onClose();
  };

  const handleSyncNow = async () => {
    setBusy(true);
    const r = currentUser?.role === 'TEACHER'
      ? await dataService.syncUsers()
      : await dataService.syncNow();
    setBusy(false);
    setResult({ ok: r.success, text: r.message });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col border border-slate-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/80">
          <div className="flex items-center gap-2.5">
            <Database className="w-5 h-5 text-blue-600" />
            <div>
              <h3 className="font-bold text-slate-900 text-base">Google Sheets холболт</h3>
              <p className="text-xs text-slate-500">Бүх өгөгдөл таны Google Sheet-д хадгалагдана</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex border-b border-slate-100 text-xs font-semibold">
          {(['connect', 'guide'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-5 py-3 border-b-2 transition-colors ${tab === t ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
            >
              {t === 'connect' ? 'Холболт' : 'Тохируулах заавар'}
            </button>
          ))}
        </div>

        <div className="p-6 overflow-y-auto text-xs space-y-5">
          {tab === 'connect' && (
            <>
              <div className={`flex items-center gap-2 p-3 rounded-xl border font-semibold ${connected ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-amber-50 border-amber-200 text-amber-800'}`}>
                {connected ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                {connected ? 'Google Sheets горим идэвхтэй — бүх өөрчлөлт Sheet-д хадгалагдаж байна' : 'Демо горим — өгөгдөл зөвхөн энэ хөтөч дээр хадгалагдаж байна'}
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1.5">Apps Script Web App URL:</label>
                <input
                  value={url}
                  onChange={e => setUrl(e.target.value)}
                  placeholder="https://script.google.com/macros/s/.../exec"
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-mono text-[11px]"
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={handleConnect}
                  disabled={busy || !url.trim()}
                  className="flex items-center gap-1.5 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl disabled:opacity-50"
                >
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
                  {connected ? 'URL шинэчилж холбох' : 'Шалгаад холбох'}
                </button>
                <button onClick={handleTest} disabled={busy || !url.trim()} className="px-4 py-2.5 border border-slate-300 rounded-xl font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                  Холболт шалгах
                </button>
                {connected && (
                  <>
                    <button onClick={handleSyncNow} disabled={busy} className="flex items-center gap-1.5 px-4 py-2.5 border border-slate-300 rounded-xl font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                      <RefreshCw className={`w-4 h-4 ${busy ? 'animate-spin' : ''}`} /> Sync хийх
                    </button>
                    <button onClick={handleDisconnect} className="flex items-center gap-1.5 px-4 py-2.5 border border-rose-200 text-rose-700 rounded-xl font-semibold hover:bg-rose-50">
                      <Unlink className="w-4 h-4" /> Салгах
                    </button>
                  </>
                )}
              </div>

              {result && (
                <div className={`p-3 rounded-xl border leading-relaxed ${result.ok ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'}`}>
                  {result.text}
                </div>
              )}

              {connected && (
                <div className="grid grid-cols-2 gap-3 text-[11px]">
                  <Stat label="Сүүлийн синк" value={status.lastSyncAt ? new Date(status.lastSyncAt).toLocaleTimeString('mn-MN') : '—'} />
                  <Stat label="Хадгалагдаагүй өөрчлөлт" value={String(status.pending)} warn={status.pending > 0} />
                  {status.lastError && <div className="col-span-2 p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700">Сүүлийн алдаа: {status.lastError}</div>}
                </div>
              )}

              <a
                href={`https://docs.google.com/spreadsheets/d/${settings.sheetId || SHEET_ID}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-blue-600 hover:text-blue-800 font-semibold"
              >
                <ExternalLink className="w-3.5 h-3.5" /> Google Sheet нээх
              </a>
            </>
          )}

          {tab === 'guide' && (
            <>
              <ol className="list-decimal pl-5 space-y-2 leading-relaxed text-slate-700">
                <li>Google Sheet-ээ нээгээд <b>Extensions → Apps Script</b> сонгоно.</li>
                <li>Төслийн <code>apps-script/Code.gs</code>-ийн кодыг бүхлээр нь хуулж тавина (<code>appsscript.json</code>-г мөн оруулж болно).</li>
                <li>Функцийн жагсаалтаас <b>initAllSheets</b>-ийг сонгож <b>Run</b> дарна, зөвшөөрөл өгнө. Дараа нь <b>setupTriggers</b>-ийг ажиллуулж 5 минут тутмын болон <code>onEdit</code> автомат синк триггер үүсгэнэ.</li>
                <li><b>Deploy → New deployment → Web app</b>: Execute as = <b>Me</b>, Who has access = <b>Anyone</b>.</li>
                <li>Гарсан <b>/exec</b> URL-ийг дээрх "Холболт" таб-д оруулж холбоно. Код өөрчилсөн бол <b>Manage deployments → Edit → New version</b> сонгох ёстой.</li>
              </ol>
              <div>
                <div className="font-bold text-slate-800 mb-2">Sheet-ийн бүтэц</div>
                <div className="border border-slate-200 rounded-xl divide-y divide-slate-100">
                  {TABS.map(t => (
                    <div key={t.name} className="flex gap-3 px-3 py-2">
                      <span className="font-mono font-semibold text-slate-800 w-36 shrink-0">{t.name}</span>
                      <span className="text-slate-500">{t.desc}</span>
                    </div>
                  ))}
                </div>
              </div>
              <p className="text-slate-500 leading-relaxed">
                Нууц үгийг энгийн текстээр эсвэл SHA-256 хэшээр бичиж болно. Нууц үгийн баганыг <b>Format → Number → Plain text</b> болговол
                "0123" шиг тэгээр эхэлсэн нууц үг алдагдахгүй.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

const Stat: React.FC<{ label: string; value: string; warn?: boolean }> = ({ label, value, warn }) => (
  <div className={`p-3 rounded-xl border ${warn ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-200'}`}>
    <div className="text-slate-500">{label}</div>
    <div className="font-bold text-slate-900 text-sm">{value}</div>
  </div>
);
