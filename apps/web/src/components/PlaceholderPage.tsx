interface PlaceholderPageProps {
  title: string;
  phase: string;
  description: string;
}

export default function PlaceholderPage({ title, phase, description }: PlaceholderPageProps) {
  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4">
      <div className="max-w-lg w-full text-center">
        {/* Phase badge */}
        <div className="inline-flex items-center gap-2 badge-blue mb-6 text-sm">
          <span className="w-1.5 h-1.5 rounded-full bg-shield-400" />
          Coming in {phase}
        </div>

        <h1 className="text-3xl font-bold text-white mb-4">{title}</h1>

        <div className="card p-6 text-left">
          <p className="text-slate-400 text-sm leading-relaxed">{description}</p>
        </div>

        <p className="mt-8 text-xs text-slate-600 font-mono">
          WebShield — Phase 1 Foundation
        </p>
      </div>
    </div>
  );
}
