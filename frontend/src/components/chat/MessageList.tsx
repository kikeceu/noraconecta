import { Message } from '../../types/chat';
import { MessageBubble } from './MessageBubble';
import { useEffect, useRef } from 'react';

interface MessageListProps {
  readonly messages: readonly Message[];
}

export function MessageList({ messages }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="flex-1 overflow-y-auto px-5 py-4">
      <div className="mx-auto max-w-[720px]">
        <div className="flex flex-col gap-4">
          {messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} />
          ))}
        </div>
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
