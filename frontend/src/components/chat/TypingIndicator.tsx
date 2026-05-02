export function TypingIndicator() {
  return (
    <div className="flex justify-start">
      <div className="flex flex-col">
        <div className="flex items-center gap-1.5 rounded-[20px] rounded-bl-[6px] border border-border bg-elevated px-4 py-3">
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-emerald [animation-delay:0ms]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-emerald [animation-delay:150ms]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-emerald [animation-delay:300ms]" />
        </div>
        <span className="mt-1 font-mono text-[0.6875rem] text-zinc-muted">
          Procesando...
        </span>
      </div>
    </div>
  );
}
