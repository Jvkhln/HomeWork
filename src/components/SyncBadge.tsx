import React, { useEffect, useState } from 'react';
import { CheckCircle2, CloudOff, Loader2, AlertTriangle } from 'lucide-react';
import { dataService } from '../services/dataService';

/** Google Sheet-д хадгалагдаж буй төлвийг үргэлж харуулна (найдвартай байдлын санал хүсэлт). */
export const SyncBadge: React.FC = () => {
  const [, setTick] = useState(0);
  useEffect(() => dataService.subscribeSync(() => setTick(t => t + 1)), []);
  if (!dataService.isSheetsMode()) return null;
  const s = dataService.getSyncStatus();

  let cls = 'bg-emerald-50 text-emerald-700 border-emerald-200';
  let icon = <CheckCircle2 className="w-3.5 h-3.5" />;
  let text = 'Sheet-д хадгалагдсан';
  if (s.syncing) {
    cls = 'bg-blue-50 text-blue-700 border-blue-200';
    icon = <Loader2 className="w-3.5 h-3.5 animate-spin" />;
    text = 'Хадгалж байна...';
  } else if (s.pending > 0 && s.lastError) {
    cls = 'bg-rose-50 text-rose-700 border-rose-200';
    icon = <CloudOff className="w-3.5 h-3.5" />;
    text = `${s.pending} өөрчлөлт хадгалагдаагүй — дахин оролдож байна`;
  } else if (s.pending > 0) {
    cls = 'bg-amber-50 text-amber-700 border-amber-200';
    icon = <AlertTriangle className="w-3.5 h-3.5" />;
    text = `${s.pending} өөрчлөлт хүлээгдэж байна`;
  } else if (s.lastError) {
    cls = 'bg-amber-50 text-amber-700 border-amber-200';
    icon = <AlertTriangle className="w-3.5 h-3.5" />;
    text = 'Sheet-тэй холбогдож чадсангүй';
  }
  return (
    <span title={s.lastError || (s.lastSyncAt ? `Сүүлийн синк: ${new Date(s.lastSyncAt).toLocaleTimeString('mn-MN')}` : '')} className={`hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${cls}`}>
      {icon}
      {text}
    </span>
  );
};
