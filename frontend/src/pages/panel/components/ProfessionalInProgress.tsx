import { useEffect, useState } from 'react';
import { Inbox } from 'lucide-react';
import type { PanelOrder } from '../../../types/panel';
import { getPanelOrders, finishRequest, confirmVisitRequest } from '../../../lib/panel-api';

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-wide text-[#0B6E4F] mb-2" style={{ fontFamily: 'DM Sans' }}>
      {children}
    </p>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 py-1.5">
      <span className="text-xs text-[#6B7280] w-20 shrink-0" style={{ fontFamily: 'DM Sans' }}>{label}</span>
      <span className="text-sm text-[#111827] break-words" style={{ fontFamily: 'DM Sans' }}>{value}</span>
    </div>
  );
}

const COORDINATION_LABEL: Record<string, { label: string; color: string }> = {
  AWAITING_AVAILABILITY: { label: 'Coordinando horario con el usuario', color: '#2563EB' },
  AWAITING_CONFIRMATION: { label: 'Esperando tu confirmación de horario', color: '#2563EB' },
  AWAITING_USER_CONFIRMATION: { label: 'Esperando que el usuario acepte tu propuesta', color: '#2563EB' },
  AWAITING_LOCATION: { label: 'Esperando ubicación del usuario', color: '#2563EB' },
  SCHEDULED: { label: 'Visita confirmada', color: '#059669' },
};

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-xl bg-white border border-[#E5E7EB] p-4">
      <p className="text-xs text-[#6B7280]" style={{ fontFamily: 'DM Sans' }}>
        {label}
      </p>
      <p className="text-2xl font-bold mt-1" style={{ fontFamily: 'JetBrains Mono', color }}>
        {value}
      </p>
    </div>
  );
}

interface ProfessionalInProgressProps {
  sessionToken: string;
}

export function ProfessionalInProgress({ sessionToken }: ProfessionalInProgressProps) {
  const [orders, setOrders] = useState<PanelOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [finishOrderId, setFinishOrderId] = useState<string | null>(null);
  const [finishLoading, setFinishLoading] = useState(false);
  const [confirmVisitOrderId, setConfirmVisitOrderId] = useState<string | null>(null);
  const [proposingAlternative, setProposingAlternative] = useState(false);
  const [alternativeText, setAlternativeText] = useState('');
  const [confirmVisitLoading, setConfirmVisitLoading] = useState(false);
  const [viewAddressOrderId, setViewAddressOrderId] = useState<string | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  useEffect(() => {
    loadInProgress();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionToken]);

  async function loadInProgress() {
    setLoading(true);
    setError(null);
    try {
      const res = await getPanelOrders(sessionToken, 1, 50);
      const inProgress = res.data.filter(
        (o) => o.status === 'ACCEPTED' || o.status === 'PENDING_CONFIRMATION',
      );
      setOrders(inProgress);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar pedidos en curso');
    } finally {
      setLoading(false);
    }
  }

  const filteredOrders = orders.filter((order) => {
    if (search) {
      const q = search.toLowerCase();
      const categoryName = order.category?.name?.toLowerCase() || '';
      const zoneName = order.geoNode?.name?.toLowerCase() || '';
      return categoryName.includes(q) || zoneName.includes(q);
    }
    return true;
  });

  const stats = {
    total: orders.length,
    accepted: orders.filter((o) => o.status === 'ACCEPTED').length,
    awaitingConfirmation: orders.filter((o) => o.status === 'PENDING_CONFIRMATION').length,
  };

  if (loading) {
    return (
      <div className="max-w-5xl space-y-5">
        <h1 className="text-2xl font-bold text-[#111827]" style={{ fontFamily: 'DM Sans' }}>En curso</h1>
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-12 rounded-xl bg-white border border-[#E5E7EB] animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-5xl space-y-5">
        <h1 className="text-2xl font-bold text-[#111827]" style={{ fontFamily: 'DM Sans' }}>En curso</h1>
        <div className="rounded-xl bg-white border border-[#E5E7EB] p-5">
          <p className="text-sm text-[#DC2626]" style={{ fontFamily: 'DM Sans' }}>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl space-y-5">
      <h1 className="text-2xl font-bold text-[#111827]" style={{ fontFamily: 'DM Sans' }}>
        En curso
      </h1>

      {orders.length === 0 ? (
        <div className="rounded-xl bg-white border border-[#E5E7EB] p-5">
          <div className="flex flex-col items-center py-10">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#F3F4F6] mb-4">
              <Inbox className="w-8 h-8 text-[#9CA3AF]" />
            </div>
            <h3 className="text-base font-semibold text-[#111827]" style={{ fontFamily: 'DM Sans' }}>
              No tenés pedidos en curso
            </h3>
            <p className="mt-1 text-sm text-[#6B7280]" style={{ fontFamily: 'DM Sans' }}>
              Los pedidos que aceptes y estén en proceso de coordinación aparecerán acá.
            </p>
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <StatCard label="En curso" value={stats.total} color="#111827" />
            <StatCard label="Aceptados" value={stats.accepted} color="#2563EB" />
            <StatCard label="Esperando confirmación" value={stats.awaitingConfirmation} color="#B45309" />
          </div>

          <div className="relative">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              placeholder="Buscar por rubro o zona..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-lg border border-[#E5E7EB] bg-white text-sm text-[#111827] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#0B6E4F]/40 focus:border-[#0B6E4F]"
              style={{ fontFamily: 'DM Sans' }}
            />
          </div>

          <div className="rounded-xl bg-white border border-[#E5E7EB] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#E5E7EB]">
                    <th
                      className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[#6B7280]"
                      style={{ fontFamily: 'DM Sans' }}
                    >
                      Fecha
                    </th>
                    <th
                      className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[#6B7280]"
                      style={{ fontFamily: 'DM Sans' }}
                    >
                      Rubro
                    </th>
                    <th
                      className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[#6B7280]"
                      style={{ fontFamily: 'DM Sans' }}
                    >
                      Zona
                    </th>
                    <th
                      className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[#6B7280]"
                      style={{ fontFamily: 'DM Sans' }}
                    >
                      Estado
                    </th>
                    <th
                      className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-[#6B7280]"
                      style={{ fontFamily: 'DM Sans' }}
                    >
                      Acción
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F3F4F6]">
                  {filteredOrders.map((order) => {
                    const coordLabel = order.coordinationStatus
                      ? COORDINATION_LABEL[order.coordinationStatus]
                      : null;

                    return (
                      <tr key={order.id} className="hover:bg-[#F9FAFB] transition-colors">
                        <td
                          className="px-4 py-3 text-[#111827] whitespace-nowrap"
                          style={{ fontFamily: 'DM Sans' }}
                        >
                          {formatDate(order.createdAt)}
                        </td>
                        <td
                          className="px-4 py-3 text-[#374151]"
                          style={{ fontFamily: 'DM Sans' }}
                        >
                          {order.category?.name || '—'}
                        </td>
                        <td
                          className="px-4 py-3 text-[#374151]"
                          style={{ fontFamily: 'DM Sans' }}
                        >
                          {order.geoNode?.name || '—'}
                        </td>
                        <td className="px-4 py-3">
                          <div className="space-y-1">
                            {order.status === 'PENDING_CONFIRMATION' ? (
                              <span
                                className="inline-flex rounded-full px-2.5 py-1 text-xs font-medium"
                                style={{
                                  backgroundColor: '#FEF3C7',
                                  color: '#B45309',
                                  fontFamily: 'DM Sans',
                                }}
                              >
                                Esperando confirmación
                              </span>
                            ) : (
                              <span
                                className="inline-flex rounded-full px-2.5 py-1 text-xs font-medium"
                                style={{
                                  backgroundColor: '#EFF6FF',
                                  color: '#2563EB',
                                  fontFamily: 'DM Sans',
                                }}
                              >
                                Aceptado
                              </span>
                            )}
                            {coordLabel && (
                              <p
                                className="text-xs ml-0.5"
                                style={{ color: coordLabel.color, fontFamily: 'DM Sans' }}
                              >
                                {coordLabel.label}
                                {order.coordinationStatus === 'SCHEDULED' && order.scheduledAt && (
                                  <> · {formatScheduledDate(order.scheduledAt)}</>
                                )}
                              </p>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {order.coordinationStatus === 'AWAITING_CONFIRMATION' && (
                            <button
                              onClick={() => {
                                setConfirmVisitOrderId(order.id);
                                setProposingAlternative(false);
                                setAlternativeText('');
                              }}
                              disabled={confirmVisitLoading}
                              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-[#0B6E4F] text-white hover:bg-[#085D42] transition-colors disabled:opacity-50 cursor-pointer"
                              style={{ fontFamily: 'DM Sans' }}
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                                <line x1="16" y1="2" x2="16" y2="6" />
                                <line x1="8" y1="2" x2="8" y2="6" />
                                <line x1="3" y1="10" x2="21" y2="10" />
                              </svg>
                              Confirmar visita
                            </button>
                          )}
                          {order.coordinationStatus === 'AWAITING_LOCATION' && (
                            <span
                              className="inline-flex items-center gap-1 text-xs text-[#2563EB]"
                              style={{ fontFamily: 'DM Sans' }}
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="10" />
                                <polyline points="12 6 12 12 16 14" />
                              </svg>
                              Esperando ubicación
                            </span>
                          )}
                          {order.coordinationStatus === 'SCHEDULED' && (
                            <button
                              onClick={() => setViewAddressOrderId(order.id)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg border border-[#0B6E4F] text-[#0B6E4F] hover:bg-[#0B6E4F]/5 transition-colors cursor-pointer"
                              style={{ fontFamily: 'DM Sans' }}
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                <circle cx="12" cy="12" r="3" />
                              </svg>
                              Ver detalle
                            </button>
                          )}
                          {order.status === 'ACCEPTED' && order.coordinationStatus !== 'AWAITING_CONFIRMATION' && order.coordinationStatus !== 'AWAITING_LOCATION' && (
                            <button
                              onClick={() => setFinishOrderId(order.id)}
                              disabled={finishLoading}
                              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-[#0B6E4F] text-white hover:bg-[#085D42] transition-colors disabled:opacity-50 cursor-pointer"
                              style={{ fontFamily: 'DM Sans' }}
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                              Marcar finalizado
                            </button>
                          )}
                          {order.status === 'PENDING_CONFIRMATION' && (
                            <span
                              className="text-xs text-[#B45309]"
                              style={{ fontFamily: 'DM Sans' }}
                            >
                              Esperando confirmación
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {filteredOrders.length === 0 && search && (
              <div className="px-4 py-8 text-center text-sm text-[#6B7280]" style={{ fontFamily: 'DM Sans' }}>
                No se encontraron pedidos con ese filtro.
              </div>
            )}
          </div>
        </>
      )}

      {finishOrderId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="rounded-xl bg-white shadow-lg max-w-sm w-full mx-4 overflow-hidden">
            <div className="p-5 border-b border-[#E5E7EB] flex items-center justify-between">
              <h2
                className="text-base font-semibold text-[#111827]"
                style={{ fontFamily: 'DM Sans' }}
              >
                Marcar como finalizado
              </h2>
              <button
                onClick={() => setFinishOrderId(null)}
                disabled={finishLoading}
                className="p-1 rounded-md text-[#6B7280] hover:bg-[#F3F4F6] transition-colors cursor-pointer"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-sm text-[#374151]" style={{ fontFamily: 'DM Sans' }}>
                ¿Confirmás que el trabajo ya fue realizado?
              </p>
              <p className="text-xs text-[#6B7280]" style={{ fontFamily: 'DM Sans' }}>
                El usuario deberá confirmar si quedó conforme con el trabajo.
              </p>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setFinishOrderId(null)}
                  disabled={finishLoading}
                  className="flex-1 px-4 py-2.5 rounded-lg border border-[#E5E7EB] text-sm font-medium text-[#374151] hover:bg-[#F9FAFB] disabled:opacity-50 transition-colors cursor-pointer"
                  style={{ fontFamily: 'DM Sans' }}
                >
                  Cancelar
                </button>
                <button
                  onClick={async () => {
                    if (!finishOrderId) return;
                    setFinishLoading(true);
                    try {
                      await finishRequest(finishOrderId);
                      setFinishOrderId(null);
                      await loadInProgress();
                    } catch (err) {
                      setError(err instanceof Error ? err.message : 'Error al finalizar pedido');
                    } finally {
                      setFinishLoading(false);
                    }
                  }}
                  disabled={finishLoading}
                  className="flex-1 px-4 py-2.5 rounded-lg bg-[#0B6E4F] text-white text-sm font-medium hover:bg-[#085D42] disabled:opacity-50 transition-colors cursor-pointer"
                  style={{ fontFamily: 'DM Sans' }}
                >
                  {finishLoading ? 'Enviando...' : 'Sí, finalizar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {confirmVisitOrderId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="rounded-xl bg-white shadow-lg max-w-sm w-full mx-4 overflow-hidden">
            <div className="p-5 border-b border-[#E5E7EB] flex items-center justify-between">
              <h2
                className="text-base font-semibold text-[#111827]"
                style={{ fontFamily: 'DM Sans' }}
              >
                Confirmar visita
              </h2>
              <button
                onClick={() => {
                  setConfirmVisitOrderId(null);
                  setProposingAlternative(false);
                }}
                disabled={confirmVisitLoading}
                className="p-1 rounded-md text-[#6B7280] hover:bg-[#F3F4F6] transition-colors cursor-pointer"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div className="p-5 space-y-4">
              {(() => {
                const order = orders.find((o) => o.id === confirmVisitOrderId);
                const availability = order?.clientAvailability || 'No especificada';
                return (
                  <div className="bg-[#F9FAFB] rounded-lg p-3 border border-[#E5E7EB]">
                    <p className="text-xs text-[#6B7280] mb-1" style={{ fontFamily: 'DM Sans' }}>
                      Disponibilidad del usuario
                    </p>
                    <p className="text-sm text-[#111827]" style={{ fontFamily: 'DM Sans' }}>
                      {availability}
                    </p>
                  </div>
                );
              })()}

              {!proposingAlternative ? (
                <div className="space-y-3">
                  <button
                    onClick={async () => {
                      const order = orders.find((o) => o.id === confirmVisitOrderId);
                      const availability = order?.clientAvailability || '';
                      if (!availability) return;
                      setConfirmVisitLoading(true);
                      try {
                        await confirmVisitRequest(confirmVisitOrderId!, availability);
                        setProposingAlternative(false);
                        await loadInProgress();
                        setConfirmVisitOrderId(null);
                      } catch (err) {
                        setError(err instanceof Error ? err.message : 'Error al confirmar visita');
                      } finally {
                        setConfirmVisitLoading(false);
                      }
                    }}
                    disabled={confirmVisitLoading}
                    className="w-full px-4 py-2.5 rounded-lg bg-[#0B6E4F] text-white text-sm font-medium hover:bg-[#085D42] disabled:opacity-50 transition-colors cursor-pointer"
                    style={{ fontFamily: 'DM Sans' }}
                  >
                    Confirmo ese horario
                  </button>
                   <button
                    onClick={() => {
                      setProposingAlternative(true);
                      const order = orders.find((o) => o.id === confirmVisitOrderId);
                      setAlternativeText(order?.clientAvailability || '');
                    }}
                    disabled={confirmVisitLoading}
                    className="w-full px-4 py-2.5 rounded-lg border border-[#E5E7EB] text-sm font-medium text-[#374151] hover:bg-[#F9FAFB] disabled:opacity-50 transition-colors cursor-pointer"
                    style={{ fontFamily: 'DM Sans' }}
                  >
                    Proponer otro horario
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <label className="block text-xs font-medium text-[#374151]" style={{ fontFamily: 'DM Sans' }}>
                      ¿Qué horario proponés?
                    </label>
                    <input
                      type="text"
                      value={alternativeText}
                      onChange={(e) => setAlternativeText(e.target.value)}
                      placeholder="Ej: 20/06 17:00"
                      className="w-full px-3 py-2 rounded-lg border border-[#E5E7EB] text-sm text-[#111827] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#0B6E4F] focus:border-transparent"
                      style={{ fontFamily: 'DM Sans' }}
                    />
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        setProposingAlternative(false);
                        setAlternativeText('');
                      }}
                      disabled={confirmVisitLoading}
                      className="flex-1 px-4 py-2.5 rounded-lg border border-[#E5E7EB] text-sm font-medium text-[#374151] hover:bg-[#F9FAFB] disabled:opacity-50 transition-colors cursor-pointer"
                      style={{ fontFamily: 'DM Sans' }}
                    >
                      Volver
                    </button>
                    <button
                      onClick={async () => {
                        if (!confirmVisitOrderId || !alternativeText.trim()) return;
                        setConfirmVisitLoading(true);
                        try {
                          await confirmVisitRequest(confirmVisitOrderId, alternativeText.trim());
                          setProposingAlternative(false);
                          setAlternativeText('');
                          await loadInProgress();
                          setConfirmVisitOrderId(null);
                        } catch (err) {
                          setError(err instanceof Error ? err.message : 'Error al confirmar visita');
                        } finally {
                          setConfirmVisitLoading(false);
                        }
                      }}
                      disabled={confirmVisitLoading || !alternativeText.trim()}
                      className="flex-1 px-4 py-2.5 rounded-lg bg-[#0B6E4F] text-white text-sm font-medium hover:bg-[#085D42] disabled:opacity-50 transition-colors cursor-pointer"
                      style={{ fontFamily: 'DM Sans' }}
                    >
                      {confirmVisitLoading ? 'Enviando...' : 'Enviar propuesta'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {viewAddressOrderId && (() => {
        const order = orders.find((o) => o.id === viewAddressOrderId);
        const address = order?.clientAddress || 'No especificada';
        const lat = order?.clientLatitude;
        const lng = order?.clientLongitude;
        const mapsUrl = lat != null && lng != null
          ? `https://maps.google.com/?q=${lat},${lng}`
          : null;
        const scheduledAt = order?.scheduledAt ? new Date(order.scheduledAt) : null;
        const scheduleText = scheduledAt
          ? formatScheduledDate(order!.scheduledAt!)
          : null;
        const photos = order?.photoUrls?.length ? order.photoUrls : null;
        const audio = order?.audioUrl || null;
        const hasMedia = photos != null || audio != null;

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 md:p-0">
            <div className="rounded-xl bg-white shadow-xl w-full md:max-w-[600px] max-h-[95vh] md:max-h-[80vh] overflow-hidden flex flex-col">
              <div className="p-5 border-b border-[#E5E7EB] flex items-center justify-between shrink-0">
                <h2
                  className="text-base font-semibold text-[#111827]"
                  style={{ fontFamily: 'DM Sans' }}
                >
                  Detalle de la visita
                </h2>
                <button
                  onClick={() => setViewAddressOrderId(null)}
                  className="p-1 rounded-md text-[#6B7280] hover:bg-[#F3F4F6] transition-colors cursor-pointer"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>

              <div className="p-5 space-y-5 overflow-y-auto flex-1">
                <section>
                  <SectionLabel>Cliente</SectionLabel>
                  <div className="bg-[#F9FAFB] rounded-lg p-3 border border-[#E5E7EB]">
                    <InfoRow label="Nombre" value={order?.userName || '—'} />
                    <InfoRow label="Teléfono" value={order?.userPhone || '—'} />
                  </div>
                </section>

                <section>
                  <SectionLabel>Pedido</SectionLabel>
                  <div className="bg-[#F9FAFB] rounded-lg p-3 border border-[#E5E7EB]">
                    <InfoRow label="Descripción" value={order?.description || '—'} />
                    <InfoRow label="Rubro" value={order?.category?.name || '—'} />
                    <InfoRow label="Zona" value={order?.geoNode?.name || '—'} />
                  </div>
                </section>

                <section>
                  <SectionLabel>Visita</SectionLabel>
                  <div className="bg-[#F9FAFB] rounded-lg p-3 border border-[#E5E7EB]">
                    {scheduleText && <InfoRow label="Día y hora" value={scheduleText} />}
                    <InfoRow label="Dirección" value={address} />
                  </div>
                  {mapsUrl ? (
                    <a
                      href={mapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#0B6E4F] text-white text-sm font-medium hover:bg-[#085D42] transition-colors cursor-pointer"
                      style={{ fontFamily: 'DM Sans' }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                        <circle cx="12" cy="10" r="3" />
                      </svg>
                      Abrir en Google Maps
                    </a>
                  ) : (
                    <p className="mt-3 text-xs text-[#9CA3AF] text-center" style={{ fontFamily: 'DM Sans' }}>
                      El usuario no compartió su ubicación
                    </p>
                  )}
                </section>

                {hasMedia && (
                  <section>
                    <SectionLabel>Multimedia</SectionLabel>
                    <div className="bg-[#F9FAFB] rounded-lg p-3 border border-[#E5E7EB] space-y-3">
                      {photos && (
                        <div>
                          <p className="text-xs text-[#6B7280] mb-2" style={{ fontFamily: 'DM Sans' }}>Fotos</p>
                          <div className="grid grid-cols-3 gap-2">
                            {photos.map((url, i) => (
                              <button
                                key={i}
                                onClick={() => setLightboxUrl(url)}
                                className="aspect-square rounded-lg overflow-hidden border border-[#E5E7EB] hover:ring-2 hover:ring-[#0B6E4F]/40 transition-all cursor-pointer"
                              >
                                <img
                                  src={url}
                                  alt={`Foto ${i + 1}`}
                                  className="w-full h-full object-cover"
                                  loading="lazy"
                                />
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {audio && (
                        <div>
                          <p className="text-xs text-[#6B7280] mb-2" style={{ fontFamily: 'DM Sans' }}>Audio</p>
                          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                          <audio controls className="w-full h-10">
                            <source src={audio} />
                            Tu navegador no soporta reproducción de audio.
                          </audio>
                        </div>
                      )}
                    </div>
                  </section>
                )}

                <button
                  onClick={() => setViewAddressOrderId(null)}
                  className="w-full px-4 py-2.5 rounded-lg border border-[#E5E7EB] text-sm font-medium text-[#374151] hover:bg-[#F9FAFB] transition-colors cursor-pointer"
                  style={{ fontFamily: 'DM Sans' }}
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {lightboxUrl && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4 cursor-pointer"
          onClick={() => setLightboxUrl(null)}
        >
          <button
            onClick={() => setLightboxUrl(null)}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors cursor-pointer"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
          <img
            src={lightboxUrl}
            alt="Foto en tamaño completo"
            className="max-w-full max-h-[90vh] rounded-lg object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}

function formatScheduledDate(dateStr: string): string {
  const date = new Date(dateStr);
  const dayNames = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  const day = dayNames[date.getDay()];
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${day} ${date.getDate()}/${date.getMonth() + 1} a las ${hours}:${minutes}hs`;
}
