import { useState } from 'react';
import { ChatHeader } from '../components/chat/ChatHeader';
import { MessageList } from '../components/chat/MessageList';
import { ChatInput } from '../components/chat/ChatInput';
import { EmptyState } from '../components/chat/EmptyState';
import { TypingIndicator } from '../components/chat/TypingIndicator';
import { useChat } from '../hooks/useChat';

export function SimulatorPage() {
  const [phone, setPhone] = useState('+54 261 ');
  const [role, setRole] = useState<'USER' | 'PROFESSIONAL'>('USER');

  const {
    messages,
    isLoading,
    session,
    send,
    changePhone,
    changeRole,
    reset,
  } = useChat(phone, role);

  const hasMessages = messages.length > 0;

  const handlePhoneChange = (newPhone: string) => {
    setPhone(newPhone);
    changePhone(newPhone);
  };

  const handleRoleChange = (newRole: 'USER' | 'PROFESSIONAL') => {
    setRole(newRole);
    changeRole(newRole);
  };

  return (
    <div className="flex h-dvh flex-col bg-bedrock">
      <ChatHeader
        phone={phone}
        role={role}
        session={session}
        onPhoneChange={handlePhoneChange}
        onRoleChange={handleRoleChange}
        onReset={reset}
      />

      {hasMessages ? (
        <MessageList messages={messages} />
      ) : (
        <EmptyState phoneSelected />
      )}

      {isLoading && !hasMessages && (
        <div className="flex flex-1 items-start justify-center px-5 pt-8">
          <div className="w-full max-w-[720px]">
            <TypingIndicator />
          </div>
        </div>
      )}

      {isLoading && hasMessages && (
        <div className="px-5">
          <div className="mx-auto max-w-[720px]">
            <TypingIndicator />
          </div>
        </div>
      )}

      <ChatInput onSend={send} disabled={isLoading} />
    </div>
  );
}
