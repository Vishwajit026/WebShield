interface ScoreGaugeProps {
  score: number | null | undefined;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

function getScoreInterpretation(score: number | null | undefined) {
  if (score === null || score === undefined) {
    return {
      grade: 'N/A',
      textColor: 'text-slate-400',
      strokeColor: '#64748b',
      bgColor: 'bg-slate-800/40',
      badgeBg: 'bg-slate-500/10 border-slate-500/30 text-slate-400',
    };
  }

  if (score >= 90) {
    return {
      grade: 'Excellent',
      textColor: 'text-emerald-400',
      strokeColor: '#34d399',
      bgColor: 'bg-emerald-500/10',
      badgeBg: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
    };
  }
  if (score >= 75) {
    return {
      grade: 'Good',
      textColor: 'text-sky-400',
      strokeColor: '#38bdf8',
      bgColor: 'bg-sky-500/10',
      badgeBg: 'bg-sky-500/10 border-sky-500/30 text-sky-400',
    };
  }
  if (score >= 50) {
    return {
      grade: 'Moderate',
      textColor: 'text-amber-400',
      strokeColor: '#fbbf24',
      bgColor: 'bg-amber-500/10',
      badgeBg: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
    };
  }
  if (score >= 25) {
    return {
      grade: 'Poor',
      textColor: 'text-orange-400',
      strokeColor: '#fb923c',
      bgColor: 'bg-orange-500/10',
      badgeBg: 'bg-orange-500/10 border-orange-500/30 text-orange-400',
    };
  }
  return {
    grade: 'Critical',
    textColor: 'text-red-400',
    strokeColor: '#f87171',
    bgColor: 'bg-red-500/10',
    badgeBg: 'bg-red-500/10 border-red-500/30 text-red-400',
  };
}

export default function ScoreGauge({
  score,
  size = 'md',
  showLabel = true,
}: ScoreGaugeProps) {
  const config = getScoreInterpretation(score);
  const normalizedScore = score ?? 0;

  // Dimensions
  const dimensionMap = {
    sm: { width: 80, stroke: 6, textSize: 'text-lg', labelSize: 'text-[10px]' },
    md: { width: 120, stroke: 8, textSize: 'text-3xl', labelSize: 'text-xs' },
    lg: { width: 160, stroke: 10, textSize: 'text-4xl', labelSize: 'text-sm' },
  };

  const { width, stroke, textSize, labelSize } = dimensionMap[size];
  const radius = (width - stroke * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (normalizedScore / 100) * circumference;

  return (
    <div className="inline-flex flex-col items-center justify-center">
      <div className="relative inline-flex items-center justify-center">
        <svg width={width} height={width} className="transform -rotate-90">
          {/* Background circle */}
          <circle
            cx={width / 2}
            cy={width / 2}
            r={radius}
            stroke="currentColor"
            strokeWidth={stroke}
            fill="transparent"
            className="text-slate-800"
          />
          {/* Progress circle */}
          <circle
            cx={width / 2}
            cy={width / 2}
            r={radius}
            stroke={config.strokeColor}
            strokeWidth={stroke}
            strokeDasharray={circumference}
            strokeDashoffset={score !== null && score !== undefined ? offset : circumference}
            strokeLinecap="round"
            fill="transparent"
            className="transition-all duration-700 ease-out"
          />
        </svg>

        {/* Center score readout */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className={`font-bold tracking-tight ${textSize} ${config.textColor}`}>
            {score !== null && score !== undefined ? score : '—'}
          </span>
          <span className={`text-slate-500 font-medium ${labelSize}`}>/ 100</span>
        </div>
      </div>

      {showLabel && (
        <span
          className={`mt-2.5 px-2.5 py-0.5 rounded-full border text-xs font-semibold tracking-wide ${config.badgeBg}`}
        >
          {config.grade}
        </span>
      )}
    </div>
  );
}
