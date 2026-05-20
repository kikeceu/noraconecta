import { useState, useEffect } from 'react';
import { Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { getRequests } from '../../lib/admin-api';
import type { RequestOrder, RequestStatus } from '../../types/admin';

const STATUS_BADGE: Record<RequestStatus, { label: string; className: string }> = {
  CREATED: { label: 'Creado', className: 'bg-gray-50 text-gray-700' },
  ASSIGNED: { label: 'Asignado', className: 'bg-blue-50 text-blue-700' },
  ACCEPTED: { label: 'En progreso', className: 'bg-emerald-50 text-emerald-700' },
  CANCELLED: { label: 'Cancelado', className: 'bg-red-50 text-red-700' },
  NO_RESPONSE: { label: 'Sin respuesta', className: 'bg-amber-50 text-amber-700' },
  COMPLETED: { label: 'Completado', className: 'bg-gray-50 text-gray-700' },
  NOT_FULFILLED: { label: 'No cumplido', className: 'bg-red-50 text-red-700' },
};

const TIMELINE_ORDER: RequestStatus[] = ['CREATED', 'ASSIGNED', 'ACCEPTED', 'COMPLETED'];

export function OrdersPage() {
  const [orders, setOrders] = useState<RequestOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });

  const fetchData = (page = 1) => {
    setLoading(true);
    getRequests({ page, limit: 20 })
      .then((res) => {
        setOrders(res.data);
        setPagination(res.pagination);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Error al cargar'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filtered = orders.filter((o) => {
    if (statusFilter && o.status !== statusFilter) return false;
    if (
      search &&
      !o.id.toLowerCase().includes(search.toLowerCase()) &&
      !o.description.toLowerCase().includes(search.toLowerCase())
    )
      return false;
    return true;
  });

  function getTimelineColor(step: RequestStatus, current: RequestStatus): string {
    const currentIdx = TIMELINE_ORDER.indexOf(current);
    const stepIdx = TIMELINE_ORDER.indexOf(step);
    if (current === 'CANCELLED' || current === 'NOT_FULFILLED') return 'bg-red-300';
    if (stepIdx <= currentIdx) return 'bg-green-500';
    return 'bg-gray-200';
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-4xl font-black text-gray-900 tracking-tighter">Pedidos</h1>
        <p className="text-sm text-gray-500 mt-1">
          Solicitudes de servicio en la plataforma
        </p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar pedido por ID o descripción"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-9 pl-9 pr-3 text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-green-700/40 focus:border-green-700"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-9 px-3 text-sm rounded-lg border border-gray-200 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-700/40"
        >
          <option value="">Todos</option>
          <option value="CREATED">Creado</option>
          <option value="ASSIGNED">Asignado</option>
          <option value="ACCEPTED">En progreso</option>
          <option value="COMPLETED">Completado</option>
          <option value="CANCELLED">Cancelado</option>
          <option value="NO_RESPONSE">Sin respuesta</option>
          <option value="NOT_FULFILLED">No cumplido</option>
        </select>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="hidden lg:block overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">
                  ID
                </th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">
                  Cliente
                </th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">
                  Profesional
                </th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">
                  Servicio
                </th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">
                  Estado
                </th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">
                  Fecha
                </th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">
                  Timeline
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading
                ? [...Array(5)].map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      {[...Array(7)].map((_, j) => (
                        <td key={j} className="px-4 py-3">
                          <div className="h-4 bg-gray-100 rounded w-3/4" />
                        </td>
                      ))}
                    </tr>
                  ))
                : filtered.map((o) => (
                    <tr key={o.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-sm font-mono text-gray-900">
                        #{o.id.slice(-4)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {o.user?.name || '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {o.assignedProfessional?.name || '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {o.category?.name || '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            STATUS_BADGE[o.status]?.className || 'bg-gray-50 text-gray-700'
                          }`}
                        >
                          {STATUS_BADGE[o.status]?.label || o.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">
                        {new Date(o.createdAt).toLocaleDateString('es-AR')}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          {TIMELINE_ORDER.map((step, idx) => (
                            <div key={step} className="flex items-center gap-1.5">
                              <div
                                className={`w-2 h-2 rounded-full ${getTimelineColor(step, o.status)} ${
                                  step === o.status && !['CANCELLED', 'NOT_FULFILLED'].includes(o.status)
                                    ? 'ring-2 ring-green-200'
                                    : ''
                                }`}
                              />
                              {idx < TIMELINE_ORDER.length - 1 && (
                                <div
                                  className={`w-4 h-0.5 rounded ${
                                    getTimelineColor(
                                      TIMELINE_ORDER[idx + 1],
                                      o.status,
                                    ).replace('bg-green-500', 'bg-green-300').replace('bg-', 'bg-')
                                  }`}
                                />
                              )}
                            </div>
                          ))}
                          {(o.status === 'CANCELLED' || o.status === 'NOT_FULFILLED') && (
                            <div className="w-2 h-2 rounded-full bg-red-500" />
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-12 text-center text-sm text-gray-500"
                  >
                    {error ? (
                      <span className="text-red-600">{error}</span>
                    ) : (
                      'No se encontraron pedidos'
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="lg:hidden space-y-3 p-3">
          {loading
            ? [...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className="bg-white rounded-xl border border-gray-200 p-4 animate-pulse space-y-2"
                >
                  <div className="h-4 bg-gray-100 rounded w-1/2" />
                  <div className="h-3 bg-gray-100 rounded w-3/4" />
                  <div className="h-3 bg-gray-100 rounded w-2/3" />
                </div>
              ))
            : filtered.map((o) => (
                <div key={o.id} className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-semibold font-mono text-gray-900">#{o.id.slice(-4)}</p>
                    <span
                      className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${
                        STATUS_BADGE[o.status]?.className || 'bg-gray-50 text-gray-700'
                      }`}
                    >
                      {STATUS_BADGE[o.status]?.label || o.status}
                    </span>
                  </div>
                  <div className="space-y-1.5 text-sm text-gray-600">
                    <p>
                      <span className="text-gray-500">Categoría:</span> {o.category?.name || '—'}
                    </p>
                    <p>
                      <span className="text-gray-500">Usuario:</span>{' '}
                      <span className="font-mono">{o.user?.phone || '—'}</span>
                    </p>
                    <p>
                      <span className="text-gray-500">Zona:</span> {o.geoNode?.name || '—'}
                    </p>
                    <p>
                      <span className="text-gray-500">Fecha:</span>{' '}
                      {new Date(o.createdAt).toLocaleDateString('es-AR')}
                    </p>
                  </div>
                </div>
              ))}

          {!loading && filtered.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-gray-500 bg-white rounded-xl border border-gray-200">
              {error ? <span className="text-red-600">{error}</span> : 'No se encontraron pedidos'}
            </div>
          )}
        </div>

        {pagination.total > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
            <span className="text-xs text-gray-500">
              Mostrando {(pagination.page - 1) * pagination.limit + 1}–
              {Math.min(pagination.page * pagination.limit, pagination.total)}{' '}
              de {pagination.total} pedidos
            </span>
            <div className="flex gap-1">
              <button
                onClick={() => fetchData(pagination.page - 1)}
                disabled={pagination.page <= 1}
                className="p-1.5 rounded-md text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => fetchData(pagination.page + 1)}
                disabled={pagination.page >= pagination.totalPages}
                className="p-1.5 rounded-md text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
