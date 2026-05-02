import { ChatHeader } from '../components/chat/ChatHeader';
import { MessageList } from '../components/chat/MessageList';
import { ChatInput } from '../components/chat/ChatInput';
import { EmptyState } from '../components/chat/EmptyState';
import { TypingIndicator } from '../components/chat/TypingIndicator';
import { useChat } from '../hooks/useChat';
import { simulatedPhones } from '../data/mockData';

export function SimulatorPage() {
  const {
    messages,
    isLoading,
    session,
    selectedPhone,
    send,
    changePhone,
    reset,
  } = useChat(simulatedPhones[0]);

  const hasMessages = messages.length > 0;

  return (
    <div className="flex h-dvh flex-col bg-bedrock">
      <ChatHeader
        phones={simulatedPhones}
        selectedPhone={selectedPhone}
        session={session}
        onPhoneSelect={changePhone}
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
