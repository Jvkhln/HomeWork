import React, { useState } from 'react';
import { ShieldCheck, Search, Filter } from 'lucide-react';
import { dataService } from '../services/dataService';

export const AuditLogView: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterAction, setFilterAction] = useState('ALL');

  const logs = dataService.getAuditLogs();

  const filteredLogs = logs.filter(log => {
    const matchesSearch =
      log.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.details.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.targetId.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesAction = filterAction === 'ALL' || log.action === filterAction;
    return matchesSearch && matchesAction;
  });

  const actions = Array.from(new Set(logs.map(l => l.action)));

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
      <div className="p-5 border-b border-slate-200">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-blue-600" />
              <h3 className="font-bold text-slate-900 text-sm sm:text-base">
                Системийн үйлдлийн бүртгэл (Audit Log)
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Өгөгдөл өөрчилсөн бүх хэрэглэгч, огноо, үйлдэл болон дэлгэрэнгүй тэмдэглэл.
            </p>
          </div>

          <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-3 py-1 rounded-lg">
            Нийт {logs.length} бичилт
          </span>
        </div>

        {/* Search & Action Filter */}
        <div className="flex flex-col sm:flex-row gap-2.5">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Хэрэглэгчийн нэр, үйлдэл, дэлгэрэнгүйгээр хайх..."
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <select
            value={filterAction}
            onChange={(e) => setFilterAction(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700"
          >
            <option value="ALL">Бүх үйлдлүүд</option>
            {actions.map(a => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 text-[11px] uppercase tracking-wider">
            <tr>
              <th className="py-2.5 px-4">Цаг хугацаа</th>
              <th className="py-2.5 px-4">Хэрэглэгч</th>
              <th className="py-2.5 px-4">Үйлдэл</th>
              <th className="py-2.5 px-4">Бай (Target)</th>
              <th className="py-2.5 px-4">Дэлгэрэнгүй тайлбар</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-700">
            {filteredLogs.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-slate-400">
                  Тохирох бүртгэл олдсонгүй.
                </td>
              </tr>
            ) : (
              filteredLogs.map((log) => (
                <tr key={log.logId} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-2.5 px-4 whitespace-nowrap font-mono text-[11px] text-slate-500">
                    {log.timestamp}
                  </td>
                  <td className="py-2.5 px-4 whitespace-nowrap font-semibold text-slate-900">
                    {log.userName}
                  </td>
                  <td className="py-2.5 px-4 whitespace-nowrap">
                    <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                      {log.action}
                    </span>
                  </td>
                  <td className="py-2.5 px-4 whitespace-nowrap text-slate-500 font-mono text-[11px]">
                    {log.targetType}:{log.targetId}
                  </td>
                  <td className="py-2.5 px-4 text-slate-600">
                    {log.details}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
