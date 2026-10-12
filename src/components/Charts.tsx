import React, { useState } from 'react';

interface BarData {
  name: string;
  short?: string;
  rate: number; // 0 to 100
  secondaryRate?: number;
}

export const WeeklyBarChart: React.FC<{
  data: BarData[];
  height?: number;
  title?: string;
}> = ({ data, height = 200, title }) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  return (
    <div className="w-full flex flex-col">
      {title && <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">{title}</h4>}
      <div className="relative flex items-end justify-between gap-3 pt-6 pb-2" style={{ height: `${height}px` }}>
        {/* Background grid lines */}
        <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-40">
          <div className="border-b border-dashed border-slate-200 w-full" />
          <div className="border-b border-dashed border-slate-200 w-full" />
          <div className="border-b border-dashed border-slate-200 w-full" />
        </div>

        {data.map((item, idx) => {
          const isHovered = hoveredIdx === idx;
          const barHeight = Math.max(8, (item.rate / 100) * (height - 30));
          return (
            <div
              key={idx}
              className="relative flex-1 flex flex-col items-center justify-end h-full group cursor-pointer z-10"
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
            >
              {/* Tooltip */}
              {isHovered && (
                <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[11px] font-medium px-2 py-1 rounded shadow-lg whitespace-nowrap z-20 pointer-events-none animate-fadeIn">
                  {item.name}: <span className="text-blue-400 font-bold">{item.rate}%</span> гүйцэтгэл
                </div>
              )}

              {/* Bar */}
              <div
                className={`w-full max-w-[40px] rounded-t transition-all duration-300 ${
                  isHovered
                    ? 'bg-blue-600 shadow-md'
                    : item.rate >= 80
                    ? 'bg-blue-500'
                    : item.rate >= 60
                    ? 'bg-indigo-400'
                    : 'bg-amber-400'
                }`}
                style={{ height: `${barHeight}px` }}
              />

              {/* X Axis Label */}
              <span className={`text-[11px] mt-2 font-medium ${isHovered ? 'text-blue-600 font-semibold' : 'text-slate-500'}`}>
                {item.short || item.name}
              </span>
            </div>
          );
        })}
      </div>
      <div className="flex justify-between text-[11px] text-slate-400 border-t border-slate-100 pt-1 px-1">
        <span>0%</span>
        <span>50%</span>
        <span>100%</span>
      </div>
    </div>
  );
};

export const SubjectProgressBarChart: React.FC<{
  data: { subjectName: string; completionRate: number; completed: number; totalAssigned: number }[];
}> = ({ data }) => {
  return (
    <div className="space-y-3.5">
      {data.map((item, idx) => {
        const rate = Math.min(100, Math.max(0, item.completionRate));
        return (
          <div key={idx} className="space-y-1">
            <div className="flex justify-between items-center text-xs">
              <span className="font-medium text-slate-800">{item.subjectName}</span>
              <div className="flex items-center gap-2">
                <span className="text-slate-400 text-[11px]">{item.completed}/{item.totalAssigned} гүйцэтгэсэн</span>
                <span className={`font-semibold ${rate >= 80 ? 'text-emerald-600' : rate >= 60 ? 'text-blue-600' : 'text-amber-600'}`}>
                  {rate}%
                </span>
              </div>
            </div>
            <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  rate >= 80 ? 'bg-emerald-500' : rate >= 60 ? 'bg-blue-500' : 'bg-amber-500'
                }`}
                style={{ width: `${rate}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};

export const StatusDonutChart: React.FC<{
  done: number;
  late: number;
  inProgress: number;
  notDone: number;
  submitted: number;
}> = ({ done, late, inProgress, notDone, submitted }) => {
  const excellentCount = done;
  const averageCount = inProgress + late;
  const notDoneCount = notDone;
  const total = excellentCount + averageCount + notDoneCount + submitted;

  if (total === 0) {
    return (
      <div className="h-44 flex items-center justify-center text-slate-400 text-xs">
        Төлөвийн өгөгдөл алга
      </div>
    );
  }

  const items = [
    { label: 'Маш сайн', count: excellentCount, color: '#10b981' }, // emerald-500
    { label: 'Дунд', count: averageCount, color: '#f59e0b' },     // amber-500
    { label: 'Хийгээгүй', count: notDoneCount, color: '#f43f5e' }, // rose-500
    { label: 'Шалгуулах', count: submitted, color: '#3b82f6' },   // blue-500
  ].filter(i => i.count > 0);

  // SVG circular calculations
  const size = 130;
  const strokeWidth = 18;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  let accumulatedPercent = 0;

  return (
    <div className="flex flex-col sm:flex-row items-center gap-6 justify-center">
      <div className="relative w-[130px] h-[130px] flex-shrink-0">
        <svg width={size} height={size} className="rotate-[-90deg]">
          {items.map((item, i) => {
            const percent = item.count / total;
            const strokeDasharray = `${percent * circumference} ${circumference}`;
            const strokeDashoffset = -accumulatedPercent * circumference;
            accumulatedPercent += percent;
            return (
              <circle
                key={i}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={item.color}
                strokeWidth={strokeWidth}
                strokeDasharray={strokeDasharray}
                strokeDashoffset={strokeDashoffset}
                className="transition-all duration-500"
              />
            );
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-extrabold text-slate-800">{total}</span>
          <span className="text-[10px] text-slate-400 uppercase tracking-wider">Нийт</span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 text-xs w-full max-w-[200px]">
        {items.map((item, i) => {
          const pct = Math.round((item.count / total) * 100);
          return (
            <div key={i} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                <span className="text-slate-600">{item.label}</span>
              </div>
              <div className="font-semibold text-slate-800">
                {item.count} <span className="text-slate-400 text-[10px]">({pct}%)</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
