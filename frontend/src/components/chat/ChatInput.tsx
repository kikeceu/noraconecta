import { useState, useRef, FormEvent } from 'react';

interface ChatInputProps {
  readonly onSend: (text: string) => void;
  readonly disabled: boolean;
}

export function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [text, setText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setText('');
    inputRef.current?.focus();
  };

  return (
    <footer className="sticky bottom-0 z-10 shrink-0 border-t border-border bg-surface">
      <div className="mx-auto flex max-w-[720px] items-center gap-2 px-5 py-2.5">
        <button
          type="button"
          disabled={disabled}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-iron transition-colors hover:bg-hover hover:text-zinc-muted disabled:opacity-40"
          title="Adjuntar imagen"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </button>

        <button
          type="button"
          disabled={disabled}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-iron transition-colors hover:bg-hover hover:text-zinc-muted disabled:opacity-40"
          title="Adjuntar audio"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
          </svg>
        </button>

        <form onSubmit={handleSubmit} className="flex flex-1 items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={disabled}
            placeholder={disabled ? 'NORA esta escribiendo...' : 'Escribi un mensaje...'}
            className="h-9 flex-1 rounded-xl border border-border bg-elevated px-4 text-[0.9375rem] text-steel outline-none transition-colors placeholder:text-iron focus:border-emerald/50 disabled:opacity-50"
          />

          <button
            type="submit"
            disabled={disabled || !text.trim()}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald text-[#09090b] transition-all hover:bg-emerald-depth active:scale-95 disabled:bg-iron disabled:text-surface"
            title="Enviar"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </button>
        </form>
      </div>
    </footer>
  );
}
