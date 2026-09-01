import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

interface FindingsChartProps {
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  infoCount: number;
}

export default function FindingsChart({
  criticalCount,
  highCount,
  mediumCount,
  lowCount,
  infoCount,
}: FindingsChartProps) {
  const total = criticalCount + highCount + mediumCount + lowCount + infoCount;

  const data = [
    { name: 'Critical', value: criticalCount, color: '#ef4444' },
    { name: 'High', value: highCount, color: '#f97316' },
    { name: 'Medium', value: mediumCount, color: '#eab308' },
    { name: 'Low', value: lowCount, color: '#38bdf8' },
    { name: 'Info', value: infoCount, color: '#94a3b8' },
  ].filter(item => item.value > 0);

  if (total === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-center p-4">
        <div className="w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-2">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <p className="text-sm font-medium text-slate-300">No findings detected</p>
        <p className="text-xs text-slate-500 mt-1 max-w-xs">
          No security issues were identified by the checks performed in this scan.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col md:flex-row items-center justify-between gap-6 py-2">
      {/* Donut Chart */}
      <div className="w-48 h-48 relative flex-shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const item = payload[0];
                  return (
                    <div className="bg-surface-800 border border-slate-700 px-3 py-1.5 rounded-lg shadow-xl text-xs">
                      <span className="font-semibold text-white">{item.name}: </span>
                      <span className="text-slate-300">{item.value} finding(s)</span>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={75}
              paddingAngle={3}
              dataKey="value"
              stroke="#0f172a"
              strokeWidth={2}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-2xl font-bold text-white tracking-tight">{total}</span>
          <span className="text-[11px] text-slate-400 uppercase tracking-wider">Total</span>
        </div>
      </div>

      {/* Legend & Breakdown List */}
      <div className="w-full space-y-2">
        <SeverityRow label="Critical" count={criticalCount} colorClass="text-red-400" dotClass="bg-red-500" total={total} />
        <SeverityRow label="High" count={highCount} colorClass="text-orange-400" dotClass="bg-orange-500" total={total} />
        <SeverityRow label="Medium" count={mediumCount} colorClass="text-yellow-400" dotClass="bg-yellow-500" total={total} />
        <SeverityRow label="Low" count={lowCount} colorClass="text-blue-400" dotClass="bg-blue-400" total={total} />
        <SeverityRow label="Info" count={infoCount} colorClass="text-slate-400" dotClass="bg-slate-400" total={total} />
      </div>
    </div>
  );
}

function SeverityRow({
  label,
  count,
  colorClass,
  dotClass,
  total,
}: {
  label: string;
  count: number;
  colorClass: string;
  dotClass: string;
  total: number;
}) {
  const percentage = total > 0 ? Math.round((count / total) * 100) : 0;

  return (
    <div className="flex items-center justify-between text-xs py-1 px-2.5 rounded bg-surface-800/60 border border-slate-800">
      <div className="flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full ${dotClass}`} />
        <span className="text-slate-300 font-medium">{label}</span>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-slate-500 text-[11px]">{percentage}%</span>
        <span className={`font-semibold ${colorClass} min-w-[20px] text-right`}>{count}</span>
      </div>
    </div>
  );
}
