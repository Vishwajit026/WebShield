import React from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { ScoreTrendPoint } from '../types/api';

interface ScoreTrendChartProps {
  data: ScoreTrendPoint[];
}

export const ScoreTrendChart: React.FC<ScoreTrendChartProps> = ({ data }) => {
  if (!data || data.length < 2) {
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-slate-900/60 border border-slate-800 rounded-xl text-center">
        <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-slate-500 mb-3">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z"
            />
          </svg>
        </div>
        <p className="text-sm font-medium text-slate-300">Not enough scan history for a trend yet</p>
        <p className="text-xs text-slate-500 mt-1">
          Perform at least two scans to view your security score progression over time.
        </p>
      </div>
    );
  }

  const chartData = data.map((point, index) => {
    const date = new Date(point.completedAt);
    const label = `${date.getMonth() + 1}/${date.getDate()}`;
    return {
      name: `#${index + 1} (${label})`,
      score: point.score,
      target: point.hostname || point.targetUrl,
      date: date.toLocaleDateString(),
    };
  });

  return (
    <div className="w-full h-64 bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Security Score Progression
        </h4>
        <span className="text-xs text-emerald-400 font-medium">
          {data.length} Scans Evaluated
        </span>
      </div>
      <div className="w-full h-48">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="scoreGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
            <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} />
            <YAxis domain={[0, 100]} stroke="#64748b" fontSize={11} tickLine={false} />
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const p = payload[0].payload;
                  return (
                    <div className="bg-slate-900 border border-slate-700 p-2.5 rounded-lg shadow-xl text-xs">
                      <p className="font-semibold text-slate-200">{p.target}</p>
                      <p className="text-slate-400">{p.date}</p>
                      <p className="text-emerald-400 font-bold mt-1">Score: {p.score} / 100</p>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Area
              type="monotone"
              dataKey="score"
              stroke="#10b981"
              strokeWidth={2.5}
              fillOpacity={1}
              fill="url(#scoreGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
