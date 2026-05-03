import { PhoneSelector } from './PhoneSelector';
import { SessionStatus } from './SessionStatus';
import { SessionState } from '../../types/chat';

interface ChatHeaderProps {
  readonly phone: string;
  readonly role: 'USER' | 'PROFESSIONAL';
  readonly session: SessionState;
  readonly onPhoneChange: (phone: string) => void;
  readonly onRoleChange: (role: 'USER' | 'PROFESSIONAL') => void;
  readonly onReset: () => void;
}

export function ChatHeader({
  phone,
  role,
  session,
  onPhoneChange,
  onRoleChange,
  onReset,
}: ChatHeaderProps) {
  return (
    <header className="sticky top-0 z-10 shrink-0 border-b border-border bg-surface">
      <div className="mx-auto flex h-[52px] max-w-[720px] items-center justify-between gap-2 px-5">
        <h1 className="select-none shrink-0 font-mono text-[0.75rem] text-zinc-muted">
          NORA
        </h1>

        <PhoneSelector
          phone={phone}
          role={role}
          onPhoneChange={onPhoneChange}
          onRoleChange={onRoleChange}
        />

        <div className="flex shrink-0 items-center gap-2">
          <SessionStatus session={session} />
          <button
            onClick={onReset}
            className="select-none rounded-lg border border-border bg-elevated px-2.5 py-1.5 font-mono text-[0.6875rem] text-iron transition-colors hover:border-red-500/30 hover:text-red-400 active:scale-95"
            title="Reset session"
          >
            Reset
          </button>
        </div>
      </div>
    </header>
  );
}
