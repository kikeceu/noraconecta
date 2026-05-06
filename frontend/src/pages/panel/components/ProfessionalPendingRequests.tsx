import { useEffect, useState, useCallback, useRef } from 'react';
import { Clock, MapPin, Wrench, Check, X, Inbox, Play, Pause } from 'lucide-react';
import type { PendingRequest } from '../../../types/panel';
import { getPendingRequests, acceptRequest, rejectRequest } from '../../../lib/panel-api';

interface ProfessionalPendingRequestsProps {
  sessionToken: string;
}

type ActionModal = {
  request: PendingRequest;
  action: 'accept' | 'reject';
} | null;

function getTimeRemaining(timeoutAt: string | null): string {
  if (!timeoutAt) return '--';
  const diff = new Date(timeoutAt).getTime() - Date.now();
  if (diff <= 0) return '0min';
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  if (hours > 0) return `${hours}h ${minutes}min`;
  return `${minutes}min`;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('es-AR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function ProfessionalPendingRequests({ sessionToken }: ProfessionalPendingRequestsProps) {
  const [requests, setRequests] = useState<PendingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<ActionModal>(null);
  const [acting, setActing] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [playingAudio, setPlayingAudio] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const res = await getPendingRequests(sessionToken);
      setRequests(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar pedidos pendientes');
    } finally {
      setLoading(false);
    }
  }, [sessionToken]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  function toggleAudio(url: string) {
    if (playingAudio === url) {
      audioRef.current?.pause();
      setPlayingAudio(null);
      return;
    }

    if (audioRef.current) {
      audioRef.current.pause();
    }

    const audio = new Audio(url);
    audioRef.current = audio;
    audio.onended = () => setPlayingAudio(null);
    audio.onerror = () => setPlayingAudio(null);
    audio.play().catch(() => setPlayingAudio(null));
    setPlayingAudio(url);
  }

  async function handleConfirm() {
    if (!modal) return;
    setActing(true);
    try {
      if (modal.action === 'accept') {
        await acceptRequest(modal.request.id);
      } else {
        await rejectRequest(modal.request.id);
      }
      setModal(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al procesar el pedido');
    } finally {
      setActing(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-8 w-8 animate-pulse rounded-full border-2 border-[#0B6E4F] border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-8 text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-red-50 mb-3">
          <X className="w-6 h-6 text-red-500" />
        </div>
        <p
          className="text-sm text-[#DC2626]"
          style={{ fontFamily: 'DM Sans' }}
        >
          {error}
        </p>
        <button
          onClick={() => { setLoading(true); load(); }}
          className="mt-3 text-sm font-medium text-[#0B6E4F] hover:underline"
          style={{ fontFamily: 'DM Sans' }}
        >
          Reintentar
        </button>
      </div>
    );
  }

  if (requests.length === 0) {
    return (
      <div className="py-16 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#F3F4F6] mb-4">
          <Inbox className="w-8 h-8 text-[#9CA3AF]" />
        </div>
        <p
          className="text-base font-medium text-[#374151]"
          style={{ fontFamily: 'DM Sans' }}
        >
          No tenés pedidos pendientes por responder
        </p>
        <p
          className="mt-1 text-sm text-[#6B7280]"
          style={{ fontFamily: 'DM Sans' }}
        >
          Cuando el motor de matching te asigne un pedido, aparecerá acá.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2
          className="text-lg font-bold text-[#111827]"
          style={{ fontFamily: 'DM Sans' }}
        >
          Pedidos pendientes
        </h2>
        <p
          className="mt-0.5 text-sm text-[#6B7280]"
          style={{ fontFamily: 'DM Sans' }}
        >
          {requests.length} {requests.length === 1 ? 'pedido por responder' : 'pedidos por responder'}
        </p>
      </div>

      <div className="space-y-3">
        {requests.map((req) => {
          const remaining = getTimeRemaining(req.assignmentTimeoutAt);
          const isUrgent = req.assignmentTimeoutAt
            && new Date(req.assignmentTimeoutAt).getTime() - now < 60 * 60 * 1000;

          return (
            <div
              key={req.id}
              className="bg-white rounded-xl border border-[#E5E7EB] p-4 md:p-5 shadow-sm"
            >
              <div className="flex flex-col gap-3">
                <div className="flex flex-wrap items-start gap-2 text-sm text-[#6B7280]">
                  <div className="flex items-center gap-1.5">
                    <Wrench className="w-4 h-4 text-[#0B6E4F]" />
                    <span style={{ fontFamily: 'DM Sans' }}>{req.category?.name ?? 'Sin rubro'}</span>
                  </div>
                  <span className="text-[#D1D5DB]">|</span>
                  <div className="flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-[#0B6E4F]" />
                    <span style={{ fontFamily: 'DM Sans' }}>{req.geoNode?.name ?? 'Sin zona'}</span>
                  </div>
                  <span className="text-[#D1D5DB]">|</span>
                  <span style={{ fontFamily: 'DM Sans' }}>{formatDate(req.createdAt)}</span>
                </div>

                <p
                  className="text-sm text-[#374151] leading-relaxed"
                  style={{ fontFamily: 'DM Sans' }}
                >
                  {req.description}
                </p>

                {(req.photoUrls.length > 0 || req.audioUrl) && (
                  <div className="flex flex-wrap items-center gap-2">
                    {req.photoUrls.map((url, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setLightboxUrl(url)}
                        className="size-16 overflow-hidden rounded-lg border border-[#E5E7EB] hover:opacity-80 transition-opacity"
                      >
                        <img
                          src={url}
                          alt={`Foto ${i + 1}`}
                          className="size-full object-cover"
                        />
                      </button>
                    ))}
                    {req.audioUrl && (
                      <button
                        type="button"
                        onClick={() => toggleAudio(req.audioUrl!)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-[#F3F4F6] px-3 py-2 text-sm font-medium text-[#374151] hover:bg-[#E5E7EB] transition-colors"
                        style={{ fontFamily: 'DM Sans' }}
                      >
                        {playingAudio === req.audioUrl ? (
                          <>
                            <Pause className="w-4 h-4 text-[#0B6E4F]" />
                            Pausar
                          </>
                        ) : (
                          <>
                            <Play className="w-4 h-4 text-[#0B6E4F]" />
                            Escuchar audio
                          </>
                        )}
                      </button>
                    )}
                  </div>
                )}

                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center gap-1.5">
                    <Clock className={`w-4 h-4 ${isUrgent ? 'text-[#DC2626]' : 'text-[#F59E0B]'}`} />
                    <span
                      className={`text-sm font-mono font-medium ${
                        isUrgent ? 'text-[#DC2626]' : 'text-[#92400E]'
                      }`}
                    >
                      {isUrgent ? 'Queda' : 'Te quedan'} {remaining}
                      {isUrgent ? ' — ¡respondé ya!' : ''}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setModal({ request: req, action: 'reject' })}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-sm font-medium text-[#DC2626] bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
                      style={{ fontFamily: 'DM Sans' }}
                      disabled={acting}
                    >
                      <X className="w-4 h-4" />
                      Rechazar
                    </button>
                    <button
                      onClick={() => setModal({ request: req, action: 'accept' })}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-sm font-medium text-white bg-[#0B6E4F] hover:bg-[#095C42] rounded-lg transition-colors"
                      style={{ fontFamily: 'DM Sans' }}
                      disabled={acting}
                    >
                      <Check className="w-4 h-4" />
                      Aceptar
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {lightboxUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setLightboxUrl(null)}
        >
          <img
            src={lightboxUrl}
            alt="Foto ampliada"
            className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain"
          />
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div
            className="fixed inset-0 bg-black/40"
            onClick={() => !acting && setModal(null)}
          />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h3
              className="text-base font-bold text-[#111827]"
              style={{ fontFamily: 'DM Sans' }}
            >
              {modal.action === 'accept'
                ? 'Confirmar aceptación'
                : 'Confirmar rechazo'}
            </h3>
            <p
              className="mt-2 text-sm text-[#374151]"
              style={{ fontFamily: 'DM Sans' }}
            >
{modal.action === 'accept'
                  ? `¿Estás seguro de que querés aceptar el pedido de ${modal.request.userName ?? 'este usuario'}?`
                  : `¿Estás seguro de que querés rechazar el pedido de ${modal.request.userName ?? 'este usuario'}?`}
            </p>

            <div className="mt-5 flex justify-end gap-3">
              <button
                onClick={() => setModal(null)}
                className="px-4 py-2 text-sm font-medium text-[#374151] bg-[#F3F4F6] hover:bg-[#E5E7EB] rounded-lg transition-colors"
                style={{ fontFamily: 'DM Sans' }}
                disabled={acting}
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirm}
                className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors disabled:opacity-50 ${
                  modal.action === 'accept'
                    ? 'bg-[#0B6E4F] hover:bg-[#095C42]'
                    : 'bg-[#DC2626] hover:bg-[#B91C1C]'
                }`}
                style={{ fontFamily: 'DM Sans' }}
                disabled={acting}
              >
                {acting
                  ? 'Procesando...'
                  : modal.action === 'accept'
                    ? 'Sí, aceptar'
                    : 'Sí, rechazar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
