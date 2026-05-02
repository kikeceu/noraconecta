import { SimulatedPhone } from '../../types/chat';
import { PhoneSelector } from './PhoneSelector';
import { SessionStatus } from './SessionStatus';
import { SessionState } from '../../types/chat';

interface ChatHeaderProps {
  readonly phones: readonly SimulatedPhone[];
  readonly selectedPhone: SimulatedPhone;
  readonly session: SessionState;
  readonly onPhoneSelect: (phone: SimulatedPhone) => void;
  readonly onReset: () => void;
}

export function ChatHeader({
  phones,
  selectedPhone,
  session,
  onPhoneSelect,
  onReset,
}: ChatHeaderProps) {
  return (
    <header className="sticky top-0 z-10 shrink-0 border-b border-border bg-surface">
      <div className="mx-auto flex h-[52px] max-w-[720px] items-center justify-between px-5">
        <h1 className="select-none text-[1rem] font-medium text-steel">
          NORA Simulator
        </h1>

        <PhoneSelector
          phones={phones}
          selected={selectedPhone}
          onSelect={onPhoneSelect}
        />

        <div className="flex items-center gap-2">
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
