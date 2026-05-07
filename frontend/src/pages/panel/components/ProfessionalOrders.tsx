import { useEffect, useState } from 'react';
import type { PanelOrder, OrderStatus } from '../../../types/panel';
import { getPanelOrders, rateUser } from '../../../lib/panel-api';

interface ProfessionalOrdersProps {
  sessionToken: string;
}

const STATUS_CONFIG: Record<OrderStatus, { label: string; bg: string; text: string }> = {
  COMPLETED: { label: 'Completado', bg: '#ECFDF5', text: '#059669' },
  ACCEPTED: { label: 'Aceptado', bg: '#EFF6FF', text: '#2563EB' },
  ASSIGNED: { label: 'Asignado', bg: '#EFF6FF', text: '#2563EB' },
  CREATED: { label: 'Creado', bg: '#F3F4F6', text: '#6B7280' },
  CANCELLED: { label: 'Cancelado', bg: '#FEF2F2', text: '#DC2626' },
  NO_RESPONSE: { label: 'Sin respuesta', bg: '#FFFBEB', text: '#D97706' },
  NOT_FULFILLED: { label: 'No cumplido', bg: '#FFFBEB', text: '#D97706' },
  PENDING_CONFIRMATION: { label: 'Esperando confirmación', bg: '#FEF3C7', text: '#B45309' },
};

const FILTER_CHIPS = [
  { key: 'all', label: 'Todos' },
  { key: 'COMPLETED', label: 'Completados' },
  { key: 'CANCELLED', label: 'Cancelados' },
  { key: 'NOT_FULFILLED', label: 'No cumplidos' },
  { key: 'NO_RESPONSE', label: 'Sin respuesta' },
] as const;

const TERMINAL_EVENT_TYPES = ['CANCELLED', 'COMPLETED', 'NOT_FULFILLED', 'NO_RESPONSE'];

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl bg-white border border-[#E5E7EB] p-5 ${className}`}>
      {children}
    </div>
  );
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

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function ProfessionalOrders({ sessionToken }: ProfessionalOrdersProps) {
  const [orders, setOrders] = useState<PanelOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 0 });
  const [ratingOrderId, setRatingOrderId] = useState<string | null>(null);
  const [ratingLoading, setRatingLoading] = useState(false);
  const [ratingSuccess, setRatingSuccess] = useState<string | null>(null);

  useEffect(() => {
    loadOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionToken]);

  async function loadOrders(page: number = 1) {
    setLoading(true);
    setError(null);
    try {
      const res = await getPanelOrders(sessionToken, page, 50);
      const terminalOrders = res.data.filter(
        (o) => o.professionalEventType && TERMINAL_EVENT_TYPES.includes(o.professionalEventType),
      );
      setOrders(terminalOrders);
      setPagination({
        page: res.pagination.page,
        total: res.pagination.total,
        totalPages: res.pagination.totalPages,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar pedidos');
    } finally {
      setLoading(false);
    }
  }

  const filteredOrders = orders.filter((order) => {
    if (filter !== 'all' && order.professionalEventType !== filter) return false;
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
    completed: orders.filter((o) => o.professionalEventType === 'COMPLETED').length,
    cancelled: orders.filter((o) => o.professionalEventType === 'CANCELLED').length,
    notFulfilled: orders.filter((o) => o.professionalEventType === 'NOT_FULFILLED').length,
    noResponse: orders.filter((o) => o.professionalEventType === 'NO_RESPONSE').length,
  };

  if (loading) {
    return (
      <div className="max-w-5xl space-y-5">
        <h1 className="text-2xl font-bold text-[#111827]" style={{ fontFamily: 'DM Sans' }}>Historial</h1>
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-12 rounded-xl bg-white border border-[#E5E7EB] animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-5xl space-y-5">
        <h1 className="text-2xl font-bold text-[#111827]" style={{ fontFamily: 'DM Sans' }}>Historial</h1>
        <Card>
          <p className="text-sm text-[#DC2626]" style={{ fontFamily: 'DM Sans' }}>{error}</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-5xl space-y-5">
      <h1 className="text-2xl font-bold text-[#111827]" style={{ fontFamily: 'DM Sans' }}>
        Historial
      </h1>

      {orders.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center py-10">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
              <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
            </svg>
            <h3 className="mt-3 text-base font-semibold text-[#111827]" style={{ fontFamily: 'DM Sans' }}>
              Todavía no tenés historial
            </h3>
            <p className="mt-1 text-sm text-[#6B7280]" style={{ fontFamily: 'DM Sans' }}>
              Los pedidos completados, cancelados o no cumplidos aparecerán acá.
            </p>
          </div>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard label="Total" value={stats.total} color="#111827" />
            <StatCard label="Completados" value={stats.completed} color="#059669" />
            <StatCard label="Cancelados" value={stats.cancelled} color="#DC2626" />
            <StatCard label="No cumplidos" value={stats.notFulfilled + stats.noResponse} color="#D97706" />
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
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
          </div>

          <div className="flex flex-wrap gap-2">
            {FILTER_CHIPS.map((chip) => (
              <button
                key={chip.key}
                onClick={() => setFilter(chip.key)}
                className={`rounded-full px-4 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                  filter === chip.key
                    ? 'bg-[#0B6E4F] text-white'
                    : 'bg-[#F3F4F6] text-[#374151] hover:bg-[#E5E7EB]'
                }`}
                style={{ fontFamily: 'DM Sans' }}
              >
                {chip.label}
              </button>
            ))}
          </div>

          <Card className="overflow-hidden !p-0">
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
                      className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-[#6B7280]"
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
                    const statusKey = (order.professionalEventType || order.status) as OrderStatus;
                    const status = STATUS_CONFIG[statusKey] || STATUS_CONFIG.CREATED;
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
                        <td className="px-4 py-3 text-right">
                          <span
                            className="inline-flex rounded-full px-2.5 py-1 text-xs font-medium"
                            style={{
                              backgroundColor: status.bg,
                              color: status.text,
                              fontFamily: 'DM Sans',
                            }}
                          >
                            {status.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {order.professionalEventType === 'COMPLETED' && !order.ratedByProfessional && (
                            <button
                              onClick={() => setRatingOrderId(order.id)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-[#0B6E4F] text-white hover:bg-[#085D42] transition-colors cursor-pointer"
                              style={{ fontFamily: 'DM Sans' }}
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                              </svg>
                              Calificar
                            </button>
                          )}
                          {order.ratedByProfessional && (
                            <span
                              className="text-xs text-[#6B7280]"
                              style={{ fontFamily: 'DM Sans' }}
                            >
                              Calificado
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {filteredOrders.length === 0 && (
              <div className="px-4 py-8 text-center text-sm text-[#6B7280]" style={{ fontFamily: 'DM Sans' }}>
                No se encontraron pedidos con ese filtro.
              </div>
            )}
          </Card>

          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-[#6B7280]" style={{ fontFamily: 'DM Sans' }}>
                Mostrando {filteredOrders.length} de {pagination.total} pedidos
              </span>
              <div className="flex gap-2">
                <button
                  disabled={pagination.page <= 1}
                  onClick={() => loadOrders(pagination.page - 1)}
                  className="px-3 py-1.5 rounded-lg border border-[#E5E7EB] text-sm text-[#374151] disabled:opacity-40 hover:bg-[#F9FAFB] cursor-pointer"
                  style={{ fontFamily: 'DM Sans' }}
                >
                  Anterior
                </button>
                <button
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => loadOrders(pagination.page + 1)}
                  className="px-3 py-1.5 rounded-lg border border-[#E5E7EB] text-sm text-[#374151] disabled:opacity-40 hover:bg-[#F9FAFB] cursor-pointer"
                  style={{ fontFamily: 'DM Sans' }}
                >
                  Siguiente
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {ratingOrderId && (
        <RateUserModal
          requestId={ratingOrderId}
          isLoading={ratingLoading}
          onRate={async (data) => {
            setRatingLoading(true);
            try {
              await rateUser(ratingOrderId, data);
              setRatingSuccess('¡Gracias por calificar al usuario!');
              setRatingOrderId(null);
              await loadOrders();
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Error al calificar');
            } finally {
              setRatingLoading(false);
            }
          }}
          onClose={() => setRatingOrderId(null)}
        />
      )}

      {ratingSuccess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="rounded-xl bg-white p-6 shadow-lg max-w-sm w-full mx-4 text-center">
            <svg
              className="mx-auto w-12 h-12 text-[#0B6E4F] mb-3"
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
            <p className="text-sm font-medium text-[#111827]" style={{ fontFamily: 'DM Sans' }}>
              {ratingSuccess}
            </p>
            <button
              onClick={() => setRatingSuccess(null)}
              className="mt-4 px-4 py-2 text-sm font-medium rounded-lg bg-[#0B6E4F] text-white hover:bg-[#085D42] transition-colors cursor-pointer"
              style={{ fontFamily: 'DM Sans' }}
            >
              Aceptar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function RateUserModal({
  requestId: _requestId,
  isLoading,
  onRate,
  onClose,
}: {
  requestId: string;
  isLoading: boolean;
  onRate: (data: {
    requestClarityRating: number;
    userAvailabilityRating: number;
    userTreatmentRating: number;
    wouldServeAgain: boolean;
    professionalComment?: string;
  }) => void;
  onClose: () => void;
}) {
  const [clarity, setClarity] = useState(0);
  const [availability, setAvailability] = useState(0);
  const [treatment, setTreatment] = useState(0);
  const [wouldServeAgain, setWouldServeAgain] = useState(true);
  const [comment, setComment] = useState('');
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);

  const handleSubmit = () => {
    onRate({
      requestClarityRating: clarity,
      userAvailabilityRating: availability,
      userTreatmentRating: treatment,
      wouldServeAgain,
      professionalComment: comment || undefined,
    });
  };

  const allRated = clarity > 0 && availability > 0 && treatment > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="rounded-xl bg-white shadow-lg max-w-md w-full mx-4 overflow-hidden">
        <div className="p-5 border-b border-[#E5E7EB] flex items-center justify-between">
          <h2
            className="text-base font-semibold text-[#111827]"
            style={{ fontFamily: 'DM Sans' }}
          >
            Calificar al usuario
          </h2>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="p-1 rounded-md text-[#6B7280] hover:bg-[#F3F4F6] transition-colors cursor-pointer"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="p-5 space-y-4">
          {step === 1 && (
            <div>
              <p
                className="text-sm text-[#374151] mb-3"
                style={{ fontFamily: 'DM Sans' }}
              >
                ¿El usuario describió bien el problema? (1-5)
              </p>
              <StarRating value={clarity} onChange={(v) => { setClarity(v); setStep(2); }} />
            </div>
          )}

          {step === 2 && (
            <div>
              <p
                className="text-sm text-[#374151] mb-3"
                style={{ fontFamily: 'DM Sans' }}
              >
                ¿Estaba disponible cuando llegaste? (1-5)
              </p>
              <StarRating value={availability} onChange={(v) => { setAvailability(v); setStep(3); }} />
            </div>
          )}

          {step === 3 && (
            <div>
              <p
                className="text-sm text-[#374151] mb-3"
                style={{ fontFamily: 'DM Sans' }}
              >
                ¿Fue respetuoso? (1-5)
              </p>
              <StarRating value={treatment} onChange={(v) => { setTreatment(v); setStep(4); }} />
            </div>
          )}

          {step === 4 && (
            <div>
              <p
                className="text-sm text-[#374151] mb-3"
                style={{ fontFamily: 'DM Sans' }}
              >
                ¿Volverías a atenderlo?
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => { setWouldServeAgain(true); setStep(5); }}
                  className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                    wouldServeAgain
                      ? 'bg-[#0B6E4F] text-white'
                      : 'border border-[#E5E7EB] text-[#374151] hover:bg-[#F9FAFB]'
                  }`}
                  style={{ fontFamily: 'DM Sans' }}
                >
                  Sí
                </button>
                <button
                  onClick={() => { setWouldServeAgain(false); setStep(5); }}
                  className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                    !wouldServeAgain
                      ? 'bg-red-600 text-white'
                      : 'border border-[#E5E7EB] text-[#374151] hover:bg-[#F9FAFB]'
                  }`}
                  style={{ fontFamily: 'DM Sans' }}
                >
                  No
                </button>
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-4">
              <div>
                <label
                  className="text-sm text-[#374151] mb-1.5 block"
                  style={{ fontFamily: 'DM Sans' }}
                >
                  Comentario (opcional, máx 300 caracteres)
                </label>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value.substring(0, 300))}
                  placeholder="Dejá un comentario..."
                  rows={3}
                  className="w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm text-[#111827] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#0B6E4F]/40 focus:border-[#0B6E4F] resize-none"
                  style={{ fontFamily: 'DM Sans' }}
                />
                <p
                  className="text-xs text-[#9CA3AF] mt-1 text-right"
                  style={{ fontFamily: 'DM Sans' }}
                >
                  {comment.length}/300
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setStep(4)}
                  disabled={isLoading}
                  className="flex-1 px-4 py-2.5 rounded-lg border border-[#E5E7EB] text-sm font-medium text-[#374151] hover:bg-[#F9FAFB] disabled:opacity-50 transition-colors cursor-pointer"
                  style={{ fontFamily: 'DM Sans' }}
                >
                  Volver
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={isLoading || !allRated}
                  className="flex-1 px-4 py-2.5 rounded-lg bg-[#0B6E4F] text-white text-sm font-medium hover:bg-[#085D42] disabled:opacity-50 transition-colors cursor-pointer"
                  style={{ fontFamily: 'DM Sans' }}
                >
                  {isLoading ? 'Enviando...' : 'Enviar calificación'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex justify-center gap-2">
      {Array.from({ length: 5 }, (_, i) => {
        const star = i + 1;
        const filled = star <= value;
        return (
          <button
            key={star}
            onClick={() => onChange(star)}
            className="p-1 transition-transform hover:scale-110 cursor-pointer"
          >
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill={filled ? '#F59E0B' : '#E5E7EB'}
              stroke={filled ? '#F59E0B' : '#E5E7EB'}
              strokeWidth="1"
            >
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
          </button>
        );
      })}
    </div>
  );
}
