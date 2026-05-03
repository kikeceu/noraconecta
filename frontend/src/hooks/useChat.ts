import { useState, useCallback, useRef } from 'react';
import { Message, BotResponse } from '../types/chat';
import { sendMessage, resetSession } from '../lib/api';

export function useChat(initialPhone: string, initialRole: 'USER' | 'PROFESSIONAL') {
  const [messages, setMessages] = useState<Message[]>([]);
  const [phone, setPhone] = useState(initialPhone);
  const [role, setRole] = useState<'USER' | 'PROFESSIONAL'>(initialRole);
  const [isLoading, setIsLoading] = useState(false);
  const [session, setSession] = useState<{ flow?: string; step?: string }>({});
  const messageIdRef = useRef(0);

  const addMessage = useCallback(
    (
      sender: 'user' | 'nora',
      text: string,
      imageUrls?: string[],
      audioUrl?: string,
    ) => {
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
        imageUrls,
        audioUrl,
      };

      setMessages((prev) => [...prev, newMsg]);
      return newMsg;
    },
    [],
  );

  const send = useCallback(
    async (text: string, imageUrls?: string[], audioUrl?: string) => {
      addMessage('user', text, imageUrls, audioUrl);
      setIsLoading(true);

      try {
        const response: BotResponse = await sendMessage(
          phone,
          text,
          role,
          imageUrls,
          audioUrl,
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
    [phone, role, addMessage],
  );

  const changePhone = useCallback(
    (newPhone: string) => {
      setPhone(newPhone);
      setMessages([]);
      setSession({});
    },
    [],
  );

  const changeRole = useCallback(
    (newRole: 'USER' | 'PROFESSIONAL') => {
      setRole(newRole);
      setMessages([]);
      setSession({});
    },
    [],
  );

  const reset = useCallback(async () => {
    setIsLoading(true);
    try {
      await resetSession(phone);
      setMessages([]);
      setSession({});
    } catch {
      // silently fail reset
    } finally {
      setIsLoading(false);
    }
  }, [phone]);

  return {
    messages,
    isLoading,
    session,
    phone,
    role,
    send,
    changePhone,
    changeRole,
    reset,
  };
}
