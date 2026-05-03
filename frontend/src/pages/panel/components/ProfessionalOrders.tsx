import { useEffect, useState } from 'react';
import type { PanelOrder, OrderStatus } from '../../../types/panel';
import { getPanelOrders } from '../../../lib/panel-api';

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
};

const FILTER_CHIPS = [
  { key: 'all', label: 'Todos' },
  { key: 'COMPLETED', label: 'Completados' },
  { key: 'ACCEPTED', label: 'En curso' },
  { key: 'CANCELLED', label: 'Cancelados' },
  { key: 'NOT_FULFILLED', label: 'No cumplidos' },
] as const;

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl bg-white border border-[#E5E7EB] p-5 ${className}`}>
      {children}
    </div>
  );
}

export function ProfessionalOrders({ sessionToken }: ProfessionalOrdersProps) {
  const [orders, setOrders] = useState<PanelOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 0 });

  useEffect(() => {
    loadOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionToken]);

  async function loadOrders(page: number = 1) {
    setLoading(true);
    setError(null);
    try {
      const res = await getPanelOrders(sessionToken, page, 50);
      setOrders(res.data);
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
    if (filter !== 'all' && order.status !== filter) return false;
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
    completed: orders.filter((o) => o.status === 'COMPLETED').length,
    pending: orders.filter((o) => o.status === 'ACCEPTED' || o.status === 'ASSIGNED').length,
    problem: orders.filter((o) => o.status === 'CANCELLED' || o.status === 'NOT_FULFILLED').length,
  };

  if (loading) {
    return (
      <div className="max-w-5xl space-y-5">
        <h1 className="text-2xl font-bold text-[#111827]" style={{ fontFamily: 'DM Sans' }}>Mis Pedidos</h1>
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
        <h1 className="text-2xl font-bold text-[#111827]" style={{ fontFamily: 'DM Sans' }}>Mis Pedidos</h1>
        <Card>
          <p className="text-sm text-[#DC2626]" style={{ fontFamily: 'DM Sans' }}>{error}</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-5xl space-y-5">
      <h1 className="text-2xl font-bold text-[#111827]" style={{ fontFamily: 'DM Sans' }}>
        Mis Pedidos
      </h1>

      {orders.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center py-10">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
              <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
            </svg>
            <h3 className="mt-3 text-base font-semibold text-[#111827]" style={{ fontFamily: 'DM Sans' }}>
              Todavía no tenés pedidos
            </h3>
            <p className="mt-1 text-sm text-[#6B7280]" style={{ fontFamily: 'DM Sans' }}>
              Cuando un cliente solicite tu servicio, los pedidos aparecerán acá.
            </p>
          </div>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard label="Total de pedidos" value={stats.total} color="#111827" />
            <StatCard label="Completados" value={stats.completed} color="#059669" />
            <StatCard label="Pendientes" value={stats.pending} color="#2563EB" />
            <StatCard label="Cancelados / No cumplidos" value={stats.problem} color="#DC2626" />
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
                className={`rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${
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
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F3F4F6]">
                  {filteredOrders.map((order) => {
                    const status = STATUS_CONFIG[order.status] || STATUS_CONFIG.CREATED;
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
                  className="px-3 py-1.5 rounded-lg border border-[#E5E7EB] text-sm text-[#374151] disabled:opacity-40 hover:bg-[#F9FAFB]"
                  style={{ fontFamily: 'DM Sans' }}
                >
                  Anterior
                </button>
                <button
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => loadOrders(pagination.page + 1)}
                  className="px-3 py-1.5 rounded-lg border border-[#E5E7EB] text-sm text-[#374151] disabled:opacity-40 hover:bg-[#F9FAFB]"
                  style={{ fontFamily: 'DM Sans' }}
                >
                  Siguiente
                </button>
              </div>
            </div>
          )}
        </>
      )}
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
