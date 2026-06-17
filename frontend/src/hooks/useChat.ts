import { useState, useCallback, useRef, useEffect } from 'react';
import { Message, BotResponse } from '../types/chat';
import { sendMessage, resetSession, getRequest, RequestData, rateProfessional, confirmRequest, disputeRequest } from '../lib/api';

type RatingStep =
  | 'ASK_OVERALL'
  | 'ASK_PUNCTUALITY'
  | 'ASK_QUALITY'
  | 'ASK_COMMUNICATION'
  | 'ASK_PRICE'
  | 'ASK_RECOMMEND'
  | 'ASK_COMMENT'
  | 'DONE';

type ConfirmationStep =
  | 'ASK_SATISFACTION'
  | 'ASK_COMMENT'
  | 'DONE';

interface RatingState {
  step: RatingStep;
  professionalName: string;
  requestId: string;
  overall: number;
  punctuality: number;
  quality: number;
  communication: number;
  priceFairness: number;
  wouldRecommend: boolean;
  comment: string;
}

interface ConfirmationState {
  step: ConfirmationStep;
  professionalName: string;
  requestId: string;
  satisfaction: 'SATISFIED' | 'PARTIAL' | 'UNSATISFIED' | null;
  comment: string;
}

interface ScheduleConfirmationState {
  requestId: string;
  professionalName: string;
  scheduledAt: string;
}

const STATUS_MESSAGES: Record<string, string> = {
  NO_RESPONSE: 'No encontramos profesionales disponibles en este momento.',
  CANCELLED: 'El pedido fue cancelado.',
};

const REASSIGNMENT_MESSAGES: Record<string, string> = {
  PROFESSIONAL_CANCELLED:
    'Lamentablemente el profesional canceló. Estamos buscando uno nuevo.',
  TIMEOUT:
    'El profesional no respondió a tiempo. Estamos buscando uno nuevo.',
};

const FINAL_STATUSES = new Set(['CANCELLED', 'COMPLETED', 'NOT_FULFILLED', 'NO_RESPONSE']);

function validateRating(value: string): number | null {
  const num = parseInt(value.trim(), 10);
  if (Number.isFinite(num) && num >= 1 && num <= 5) return num;
  return null;
}

function getStatusMessage(data: RequestData): string | null {
  if (data.status === 'PENDING_CONFIRMATION' && data.assignedProfessional?.name) {
    const name = data.assignedProfessional.name;
    return `El profesional ${name} indicó que finalizó el trabajo.\n¿Cómo quedó?\n\nRespondé: "conforme", "con observaciones" o "no conforme"`;
  }
  if (data.coordinationStatus === 'AWAITING_USER_CONFIRMATION' && data.assignedProfessional?.name) {
    const name = data.assignedProfessional.name;
    const scheduledAt = data.scheduledAt || data.coordination?.scheduledAt;
    if (scheduledAt) {
      const d = new Date(scheduledAt);
      const dayNames = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
      const dayName = dayNames[d.getDay()];
      const hours = d.getHours().toString().padStart(2, '0');
      const minutes = d.getMinutes().toString().padStart(2, '0');
      return `${name} no puede en ese horario. Propone el ${dayName} a las ${hours}:${minutes}. ¿Te viene bien? (Sí / No)`;
    }
    return `${name} propone otro horario. ¿Te viene bien? (Sí / No)`;
  }
  if (data.coordinationStatus === 'AWAITING_LOCATION') {
    const name = data.assignedProfessional?.name || 'El profesional';
    return `${name} ya confirmó el horario. Para que pueda encontrarte, respondé con tu dirección exacta (calle, número, piso/depto, referencia de acceso) y compartí tu ubicación.`;
  }
  if (data.coordinationStatus === 'SCHEDULED' && data.scheduledAt && data.assignedProfessional?.name) {
    const d = new Date(data.scheduledAt);
    const dayNames = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
    const dayName = dayNames[d.getDay()];
    const hours = d.getHours().toString().padStart(2, '0');
    const minutes = d.getMinutes().toString().padStart(2, '0');
    return `¡Todo listo! ${data.assignedProfessional.name} ya tiene tus datos. La visita quedó coordinada para el ${dayName} a las ${hours}:${minutes}.`;
  }
  if (data.status === 'ACCEPTED' && data.coordinationStatus === 'AWAITING_AVAILABILITY' && data.assignedProfessional?.name) {
    const categoryName = data.category?.name || 'el servicio';
    return `¡Buenas noticias! ${data.assignedProfessional.name} aceptó tu pedido de ${categoryName}. 🎉 ¿Qué día y horario te viene bien para la visita? Si necesitás cancelar, escribí "cancelar".`;
  }
  if (data.status === 'ASSIGNED') {
    if ((data.reassignmentCount ?? 0) > 0) {
      return 'Estamos buscando un nuevo profesional para tu pedido. Te avisamos cuando confirme.';
    }
    return 'Encontramos un profesional, esperando confirmación...';
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
  const simulatorPollRef = useRef<number | null>(null);
  const lastStatusRef = useRef<string | null>(null);
  const lastCoordinationRef = useRef<string | null>(null);
  const lastReassignmentCountRef = useRef<number>(0);
  const ratingRef = useRef<RatingState | null>(null);
  const confirmationRef = useRef<ConfirmationState | null>(null);
  const scheduleConfirmationRef = useRef<ScheduleConfirmationState | null>(null);
  const activeRequestIdRef = useRef<string | null>(null);

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
    if (simulatorPollRef.current !== null) {
      clearInterval(simulatorPollRef.current);
      simulatorPollRef.current = null;
    }
    activeRequestIdRef.current = null;
    scheduleConfirmationRef.current = null;
    lastReassignmentCountRef.current = 0;
  }, []);

  const startPolling = useCallback(
    (requestId: string) => {
      stopPolling();
      activeRequestIdRef.current = requestId;

      const initialize = async () => {
        try {
          const data = await getRequest(requestId);
          lastStatusRef.current = data.status;
          lastCoordinationRef.current = data.coordinationStatus || null;
          lastReassignmentCountRef.current = data.reassignmentCount ?? 0;
        } catch {
          // silently fail, refs will be set on next poll
        }
      };

      const poll = async () => {
        try {
          const data = await getRequest(requestId);
          const newStatus = data.status;
          const newCoordination = data.coordinationStatus || null;
          const newReassignmentCount = data.reassignmentCount ?? 0;

          const statusChanged = newStatus !== lastStatusRef.current;
          const coordinationChanged = newCoordination !== lastCoordinationRef.current;
          const reassignmentCountIncreased =
            newReassignmentCount > lastReassignmentCountRef.current;

          lastReassignmentCountRef.current = newReassignmentCount;

          if (statusChanged || coordinationChanged) {
            lastStatusRef.current = newStatus;
            lastCoordinationRef.current = newCoordination;

            if (newCoordination === 'AWAITING_USER_CONFIRMATION' && data.assignedProfessional?.name) {
              scheduleConfirmationRef.current = {
                requestId,
                professionalName: data.assignedProfessional.name,
                scheduledAt: data.scheduledAt || '',
              };
            } else if (newCoordination !== 'AWAITING_USER_CONFIRMATION' && scheduleConfirmationRef.current) {
              scheduleConfirmationRef.current = null;
            }

            if (reassignmentCountIncreased && data.lastReassignmentReason) {
              const reassignmentMsg =
                REASSIGNMENT_MESSAGES[data.lastReassignmentReason];
              if (reassignmentMsg) {
                addMessage('nora', reassignmentMsg);
              }
            }

            const statusMessage = getStatusMessage(data);
            const showedReassignmentContext =
              reassignmentCountIncreased && !!data.lastReassignmentReason;

            if (statusMessage && newStatus !== 'COMPLETED' && !showedReassignmentContext) {
              addMessage('nora', statusMessage);
            }

            if (newStatus === 'PENDING_CONFIRMATION' && data.assignedProfessional?.name) {
              startConfirmationFlow(requestId, data.assignedProfessional.name);
              return;
            }

            if (newStatus === 'COMPLETED') {
              stopPolling();
              return;
            }

            if (FINAL_STATUSES.has(newStatus)) {
              stopPolling();
            }
          }
        } catch {
          // silently fail polling
        }
      };

      initialize().then(() => {
        pollIntervalRef.current = window.setInterval(poll, 5000);
      });
    },
    [addMessage, stopPolling],
  );

  const addMessageRef = useRef(addMessage);
  useEffect(() => {
    addMessageRef.current = addMessage;
  }, [addMessage]);

  const startSimulatorPolling = useCallback(
    (targetPhone: string, targetRole: 'USER' | 'PROFESSIONAL') => {
      if (simulatorPollRef.current !== null) {
        clearInterval(simulatorPollRef.current);
        simulatorPollRef.current = null;
      }

      simulatorPollRef.current = window.setInterval(async () => {
        try {
          const res = await fetch(
            `/api/simulator/messages?phone=${encodeURIComponent(targetPhone)}&role=${targetRole}`,
          );
          if (!res.ok) return;
          const data = (await res.json()) as { messages?: Array<{ content: string }> };
          if (data.messages && data.messages.length > 0) {
            data.messages.forEach((msg) => {
              addMessageRef.current('nora', msg.content);
            });
          }
        } catch {
          // silently fail
        }
      }, 2000);
    },
    [addMessage],
  );

  const handleRatingResponse = useCallback(
    async (text: string) => {
      const rating = ratingRef.current;
      if (!rating) return false;

      const nextStep = (step: RatingStep): void => {
        rating.step = step;
      };

      switch (rating.step) {
        case 'ASK_OVERALL': {
          const val = validateRating(text);
          if (val === null) {
            addMessage('nora', 'Por favor, respondé con un número del 1 al 5.');
            return true;
          }
          rating.overall = val;
          nextStep('ASK_PUNCTUALITY');
          addMessage('nora', '¿Llegó a tiempo o en el horario acordado? (1-5)');
          return true;
        }

        case 'ASK_PUNCTUALITY': {
          const val = validateRating(text);
          if (val === null) {
            addMessage('nora', 'Por favor, respondé con un número del 1 al 5.');
            return true;
          }
          rating.punctuality = val;
          nextStep('ASK_QUALITY');
          addMessage('nora', '¿Resolvió el problema correctamente? (1-5)');
          return true;
        }

        case 'ASK_QUALITY': {
          const val = validateRating(text);
          if (val === null) {
            addMessage('nora', 'Por favor, respondé con un número del 1 al 5.');
            return true;
          }
          rating.quality = val;
          nextStep('ASK_COMMUNICATION');
          addMessage('nora', '¿Fue amable y claro? (1-5)');
          return true;
        }

        case 'ASK_COMMUNICATION': {
          const val = validateRating(text);
          if (val === null) {
            addMessage('nora', 'Por favor, respondé con un número del 1 al 5.');
            return true;
          }
          rating.communication = val;
          nextStep('ASK_PRICE');
          addMessage('nora', '¿Cobró lo acordado sin sorpresas? (1-5)');
          return true;
        }

        case 'ASK_PRICE': {
          const val = validateRating(text);
          if (val === null) {
            addMessage('nora', 'Por favor, respondé con un número del 1 al 5.');
            return true;
          }
          rating.priceFairness = val;
          nextStep('ASK_RECOMMEND');
          addMessage('nora', '¿Lo recomendarías a otros? (respondé "sí" o "no")');
          return true;
        }

        case 'ASK_RECOMMEND': {
          const lower = text.trim().toLowerCase();
          if (lower === 'si' || lower === 'sí') {
            rating.wouldRecommend = true;
          } else if (lower === 'no') {
            rating.wouldRecommend = false;
          } else {
            addMessage('nora', 'Por favor, respondé "sí" o "no".');
            return true;
          }
          nextStep('ASK_COMMENT');
          addMessage(
            'nora',
            '¿Querés dejar algún comentario? Escribilo o escribí "no" para saltar.',
          );
          return true;
        }

        case 'ASK_COMMENT': {
          const lower = text.trim().toLowerCase();
          if (lower !== 'no') {
            rating.comment = text.trim().substring(0, 300);
          }
          nextStep('DONE');

          setIsLoading(true);
          try {
            await rateProfessional(rating.requestId, {
              rating: rating.overall,
              punctualityRating: rating.punctuality,
              qualityRating: rating.quality,
              communicationRating: rating.communication,
              priceFairnessRating: rating.priceFairness,
              wouldRecommend: rating.wouldRecommend,
              userComment: rating.comment || undefined,
            });

            addMessage(
              'nora',
              '¡Gracias por tu calificación! Ayudás a otros usuarios a elegir mejor.',
            );
          } catch {
            addMessage('nora', 'Hubo un error al enviar la calificación. Intentá de nuevo más tarde.');
          } finally {
            setIsLoading(false);
            ratingRef.current = null;
          }
          return true;
        }

        default:
          return false;
      }
    },
    [addMessage],
  );

  const startConfirmationFlow = useCallback(
    (requestId: string, professionalName: string) => {
      confirmationRef.current = {
        step: 'ASK_SATISFACTION',
        professionalName,
        requestId,
        satisfaction: null,
        comment: '',
      };
    },
    [],
  );

  const handleConfirmationResponse = useCallback(
    async (text: string) => {
      const confirmation = confirmationRef.current;
      if (!confirmation) return false;

      const trimmed = text.trim().toLowerCase();

      switch (confirmation.step) {
        case 'ASK_SATISFACTION': {
          if (trimmed === 'conforme') {
            confirmation.satisfaction = 'SATISFIED';
            confirmation.step = 'DONE';
            setIsLoading(true);
            try {
              await confirmRequest(confirmation.requestId, 'SATISFIED');
              addMessage('nora', '¡Gracias por confirmar!');
            } catch {
              addMessage('nora', 'Hubo un error. Intentá de nuevo más tarde.');
            } finally {
              setIsLoading(false);
              confirmationRef.current = null;
            }
            return true;
          }

          if (trimmed === 'con observaciones') {
            confirmation.satisfaction = 'PARTIAL';
            confirmation.step = 'ASK_COMMENT';
            addMessage(
              'nora',
              '¿Querés dejar un comentario antes de calificar? Escribilo o respondé "no" para saltar.',
            );
            return true;
          }

          if (trimmed === 'no conforme') {
            confirmation.satisfaction = 'UNSATISFIED';
            confirmation.step = 'DONE';
            setIsLoading(true);
            try {
              await disputeRequest(confirmation.requestId);
              addMessage(
                'nora',
                'Gracias por avisar. Creamos un reclamo automático y revisaremos el caso.',
              );
            } catch {
              addMessage('nora', 'Hubo un error. Intentá de nuevo más tarde.');
            } finally {
              setIsLoading(false);
              confirmationRef.current = null;
            }
            return true;
          }

          addMessage('nora', 'Por favor, respondé: "conforme", "con observaciones" o "no conforme".');
          return true;
        }

        case 'ASK_COMMENT': {
          if (trimmed !== 'no') {
            confirmation.comment = text.trim().substring(0, 300);
          }
          confirmation.step = 'DONE';

          setIsLoading(true);
          try {
            await confirmRequest(
              confirmation.requestId,
              confirmation.satisfaction!,
              confirmation.comment || undefined,
            );
            addMessage('nora', '¡Gracias por confirmar!');
          } catch {
            addMessage('nora', 'Hubo un error. Intentá de nuevo más tarde.');
          } finally {
            setIsLoading(false);
            confirmationRef.current = null;
          }
          return true;
        }

        default:
          return false;
      }
    },
    [addMessage],
  );

  const handleScheduleConfirmationResponse = useCallback(
    async (text: string) => {
      const confirmation = scheduleConfirmationRef.current;
      if (!confirmation) return false;

      const trimmed = text.trim().toLowerCase();

      if (trimmed === 'si' || trimmed === 'sí') {
        scheduleConfirmationRef.current = null;
        setIsLoading(true);
        try {
          const response: BotResponse = await sendMessage(phone, 'Sí', role);
          addMessage('nora', response.text);
          setSession({ flow: response.flow, step: response.step });
          if (pollIntervalRef.current !== null && activeRequestIdRef.current) {
            const data = await getRequest(activeRequestIdRef.current);
            lastStatusRef.current = data.status;
            lastCoordinationRef.current = data.coordinationStatus || null;
          }
        } catch {
          addMessage('nora', 'Error de conexion con el servidor. Intenta de nuevo.');
        } finally {
          setIsLoading(false);
        }
        return true;
      }

      if (trimmed === 'no') {
        scheduleConfirmationRef.current = null;
        setIsLoading(true);
        try {
          const response: BotResponse = await sendMessage(phone, 'No', role);
          addMessage('nora', response.text);
          setSession({ flow: response.flow, step: response.step });
          if (pollIntervalRef.current !== null && activeRequestIdRef.current) {
            const data = await getRequest(activeRequestIdRef.current);
            lastStatusRef.current = data.status;
            lastCoordinationRef.current = data.coordinationStatus || null;
          }
        } catch {
          addMessage('nora', 'Error de conexion con el servidor. Intenta de nuevo.');
        } finally {
          setIsLoading(false);
        }
        return true;
      }

      addMessage('nora', 'Por favor, respondé "Sí" o "No".');
      return true;
    },
    [phone, role, addMessage],
  );

  const send = useCallback(
    async (text: string, imageUrls?: string[], audioUrl?: string) => {
      addMessage('user', text, imageUrls, audioUrl);

      if (ratingRef.current) {
        setIsLoading(true);
        try {
          await handleRatingResponse(text);
        } finally {
          setIsLoading(false);
        }
        return;
      }

      if (confirmationRef.current) {
        setIsLoading(true);
        try {
          await handleConfirmationResponse(text);
        } finally {
          setIsLoading(false);
        }
        return;
      }

      if (scheduleConfirmationRef.current) {
        setIsLoading(true);
        try {
          const handled = await handleScheduleConfirmationResponse(text);
          if (handled) {
            setIsLoading(false);
            return;
          }
        } catch {
          // fall through to normal send
        } finally {
          setIsLoading(false);
        }
      }

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
        } else if (pollIntervalRef.current !== null && activeRequestIdRef.current) {
          try {
            const data = await getRequest(activeRequestIdRef.current);
            lastStatusRef.current = data.status;
            lastCoordinationRef.current = data.coordinationStatus || null;
            lastReassignmentCountRef.current = data.reassignmentCount ?? 0;
          } catch {
            // silently sync refs to prevent duplicate messages
          }
        }
      } catch {
        addMessage('nora', 'Error de conexion con el servidor. Intenta de nuevo.');
      } finally {
        setIsLoading(false);
      }
    },
    [phone, role, addMessage, startPolling, handleRatingResponse, handleConfirmationResponse, handleScheduleConfirmationResponse],
  );

  const sendLocation = useCallback(
    async () => {
      const text = '📍 Ubicación compartida';
      addMessage('user', text);

      if (ratingRef.current || confirmationRef.current || scheduleConfirmationRef.current) {
        return;
      }

      setIsLoading(true);

      try {
        const response: BotResponse = await sendMessage(
          phone,
          text,
          role,
          undefined,
          undefined,
          { latitude: -32.8908, longitude: -68.8272 },
        );

        addMessage('nora', response.text);

        setSession({
          flow: response.flow,
          step: response.step,
        });

        if (response.requestId) {
          startPolling(response.requestId);
        } else if (pollIntervalRef.current !== null && activeRequestIdRef.current) {
          try {
            const data = await getRequest(activeRequestIdRef.current);
            lastStatusRef.current = data.status;
            lastCoordinationRef.current = data.coordinationStatus || null;
            lastReassignmentCountRef.current = data.reassignmentCount ?? 0;
          } catch {
            // silently sync refs to prevent duplicate messages
          }
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

  useEffect(() => {
    startSimulatorPolling(phone, role);
    return () => {
      if (simulatorPollRef.current !== null) {
        clearInterval(simulatorPollRef.current);
        simulatorPollRef.current = null;
      }
    };
  }, [phone, role, startSimulatorPolling]);

  return {
    messages,
    isLoading,
    session,
    phone,
    role,
    send,
    sendLocation,
    changePhone,
    changeRole,
    reset,
  };
}
