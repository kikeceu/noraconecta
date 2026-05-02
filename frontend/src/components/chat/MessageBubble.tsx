import { Message } from '../../types/chat';

interface MessageBubbleProps {
  readonly message: Message;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.sender === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className="flex max-w-[70%] flex-col">
        <div
          className={`rounded-[20px] px-4 py-2.5 text-sm leading-relaxed ${
            isUser
              ? 'rounded-br-[6px] bg-emerald text-[#09090b]'
              : 'rounded-bl-[6px] border border-border bg-elevated text-steel'
          }`}
        >
          {message.text}
        </div>
        <span
          className={`mt-1 font-mono text-[0.6875rem] text-zinc-muted ${
            isUser ? 'text-right' : 'text-left'
          }`}
        >
          {message.timestamp}
        </span>
      </div>
    </div>
  );
}
