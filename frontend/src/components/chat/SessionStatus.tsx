import { SessionState } from '../../types/chat';

interface SessionStatusProps {
  readonly session: SessionState;
}

export function SessionStatus({ session }: SessionStatusProps) {
  const hasFlow = !!session.flow;

  return (
    <div className="flex shrink-0 items-center gap-2 rounded-lg border border-border bg-elevated px-3 py-1.5">
      <span
        className={`block h-1.5 w-1.5 rounded-full ${
          hasFlow ? 'bg-emerald' : 'bg-iron'
        }`}
      />
      <span className="font-mono text-[0.6875rem] text-zinc-muted">
        {hasFlow
          ? `${session.flow} \u00b7 ${session.step}`
          : '\u2014 \u00b7 \u2014'}
      </span>
    </div>
  );
}
