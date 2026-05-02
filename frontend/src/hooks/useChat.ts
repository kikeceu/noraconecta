import { useState, useCallback, useRef } from 'react';
import { Message, SimulatedPhone, BotResponse } from '../types/chat';
import { sendMessage, resetSession } from '../lib/api';

export function useChat(initialPhone: SimulatedPhone) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedPhone, setSelectedPhone] = useState<SimulatedPhone>(initialPhone);
  const [isLoading, setIsLoading] = useState(false);
  const [session, setSession] = useState<{ flow?: string; step?: string }>({});
  const messageIdRef = useRef(0);

  const addMessage = useCallback((sender: 'user' | 'nora', text: string) => {
    const now = new Date();
    const timestamp = now.toLocaleTimeString('es-AR', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });

    messageIdRef.current += 1;
    const newMsg: Message = {
      id: `msg-${messageIdRef.current}`,
      sender,
      text,
      timestamp,
    };

    setMessages((prev) => [...prev, newMsg]);
    return newMsg;
  }, []);

  const send = useCallback(
    async (text: string) => {
      addMessage('user', text);
      setIsLoading(true);

      try {
        const response: BotResponse = await sendMessage(
          selectedPhone.phone,
          text,
          selectedPhone.role,
        );

        addMessage('nora', response.text);

        setSession({
          flow: response.flow,
          step: response.step,
        });
      } catch {
        addMessage('nora', 'Error de conexion con el servidor. Intenta de nuevo.');
      } finally {
        setIsLoading(false);
      }
    },
    [selectedPhone, addMessage],
  );

  const changePhone = useCallback(
    (phone: SimulatedPhone) => {
      setSelectedPhone(phone);
      setMessages([]);
      setSession({});
    },
    [],
  );

  const reset = useCallback(async () => {
    setIsLoading(true);
    try {
      await resetSession(selectedPhone.phone);
      setMessages([]);
      setSession({});
    } catch {
      // silently fail reset
    } finally {
      setIsLoading(false);
    }
  }, [selectedPhone]);

  return {
    messages,
    isLoading,
    session,
    selectedPhone,
    send,
    changePhone,
    reset,
  };
}
