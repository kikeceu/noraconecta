import { useState, useCallback, useRef, useEffect } from 'react';
import { Message, BotResponse } from '../types/chat';
import { sendMessage, resetSession, getRequest, RequestData } from '../lib/api';

const STATUS_MESSAGES: Record<string, string> = {
  ASSIGNED: 'Encontramos un profesional, esperando confirmación...',
  NO_RESPONSE: 'No encontramos profesionales disponibles en este momento.',
  CANCELLED: 'El pedido fue cancelado.',
};

const FINAL_STATUSES = new Set(['ACCEPTED', 'CANCELLED', 'COMPLETED', 'NO_RESPONSE']);

function getStatusMessage(data: RequestData): string | null {
  if (data.status === 'ACCEPTED' && data.assignedProfessional?.name) {
    return `✅ ¡${data.assignedProfessional.name} aceptó tu pedido! Podés contactarlo al ${data.assignedProfessional.phone}. Cualquier consulta podés escribirle directamente.`;
  }
  return STATUS_MESSAGES[data.status] ?? null;
}

export function useChat(initialPhone: string, initialRole: 'USER' | 'PROFESSIONAL') {
  const [messages, setMessages] = useState<Message[]>([]);
  const [phone, setPhone] = useState(initialPhone);
  const [role, setRole] = useState<'USER' | 'PROFESSIONAL'>(initialRole);
  const [isLoading, setIsLoading] = useState(false);
  const [session, setSession] = useState<{ flow?: string; step?: string }>({});
  const messageIdRef = useRef(0);
  const pollIntervalRef = useRef<number | null>(null);
  const lastStatusRef = useRef<string | null>(null);

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

  const stopPolling = useCallback(() => {
    if (pollIntervalRef.current !== null) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  }, []);

  const startPolling = useCallback(
    (requestId: string) => {
      stopPolling();
      lastStatusRef.current = null;

      const poll = async () => {
        try {
          const data = await getRequest(requestId);
          const newStatus = data.status;

          if (newStatus !== lastStatusRef.current) {
            lastStatusRef.current = newStatus;
            const statusMessage = getStatusMessage(data);

            if (statusMessage) {
              addMessage('nora', statusMessage);
            }

            if (FINAL_STATUSES.has(newStatus)) {
              stopPolling();
            }
          }
        } catch {
          // silently fail polling
        }
      };

      poll();
      pollIntervalRef.current = window.setInterval(poll, 5000);
    },
    [addMessage, stopPolling],
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

        if (response.requestId) {
          startPolling(response.requestId);
        }
      } catch {
        addMessage('nora', 'Error de conexion con el servidor. Intenta de nuevo.');
      } finally {
        setIsLoading(false);
      }
    },
    [phone, role, addMessage, startPolling],
  );

  const changePhone = useCallback(
    (newPhone: string) => {
      stopPolling();
      setPhone(newPhone);
      setMessages([]);
      setSession({});
    },
    [stopPolling],
  );

  const changeRole = useCallback(
    (newRole: 'USER' | 'PROFESSIONAL') => {
      stopPolling();
      setRole(newRole);
      setMessages([]);
      setSession({});
    },
    [stopPolling],
  );

  const reset = useCallback(async () => {
    stopPolling();
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
  }, [phone, stopPolling]);

  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, [stopPolling]);

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
