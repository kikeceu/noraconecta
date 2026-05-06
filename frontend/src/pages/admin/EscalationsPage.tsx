import { useState, useEffect } from 'react';
import { Search, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  getEscalations,
  changeEscalationStatus,
  resolveEscalation,
} from '../../lib/admin-api';
import { ConfirmDialog } from '../../components/admin/ConfirmDialog';
import type { Escalation, EscalationStatus } from '../../types/admin';

const STATUS_BADGE: Record<EscalationStatus, { label: string; className: string }> = {
  OPEN: { label: 'Abierta', className: 'bg-red-50 text-red-700 border border-red-200' },
  IN_REVIEW: { label: 'En revisión', className: 'bg-amber-50 text-amber-700 border border-amber-200' },
  RESOLVED: { label: 'Resuelta', className: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
};

export function EscalationsPage() {
  const [escalations, setEscalations] = useState<Escalation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [resolveModal, setResolveModal] = useState<Escalation | null>(null);
  const [resolution, setResolution] = useState('');
  const [confirmAction, setConfirmAction] = useState<Escalation | null>(null);
  const [confirmResolve, setConfirmResolve] = useState(false);

  const fetchData = (page = 1) => {
    setLoading(true);
    getEscalations({
      page,
      limit: 20,
      status: (statusFilter as EscalationStatus) || undefined,
    })
      .then((res) => {
        setEscalations(res.data);
        setPagination(res.pagination);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Error al cargar'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const executeStatusChange = async (id: string, status: EscalationStatus) => {
    setActionLoading(id);
    setConfirmAction(null);
    try {
      await changeEscalationStatus(id, status);
      fetchData(pagination.page);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cambiar estado');
    } finally {
      setActionLoading(null);
    }
  };

  const executeResolve = async () => {
    if (!resolveModal || !resolution.trim()) return;
    setActionLoading(resolveModal.id);
    try {
      await resolveEscalation(resolveModal.id, resolution.trim());
      setResolveModal(null);
      setResolution('');
      setConfirmResolve(false);
      fetchData(pagination.page);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al resolver');
    } finally {
      setActionLoading(null);
    }
  };

  const filtered = escalations.filter((e) => {
    if (
      search &&
      !e.id.toLowerCase().includes(search.toLowerCase()) &&
      !e.professional?.name?.toLowerCase().includes(search.toLowerCase()) &&
      !e.requestId.toLowerCase().includes(search.toLowerCase())
    )
      return false;
    return true;
  });

  const criticalCount = escalations.filter(
    (e) => e.status === 'OPEN',
  ).length;
  const inReviewCount = escalations.filter(
    (e) => e.status === 'IN_REVIEW',
  ).length;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Escaladas</h1>
        <p className="text-sm text-gray-500 mt-1">
          Incidentes y reclamos que requieren intervención del equipo
        </p>
      </div>

      {/* Filter bar */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por pedido o profesional"
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
          <option value="">Todas</option>
          <option value="OPEN">Abierta</option>
          <option value="IN_REVIEW">En revisión</option>
          <option value="RESOLVED">Resuelta</option>
        </select>
      </div>

      {/* Urgency summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-xl border-l-4 border-red-500 border border-gray-200 p-3">
          <p className="text-lg font-mono font-semibold text-red-600">
            {criticalCount}
          </p>
          <p className="text-xs text-gray-500">Abiertas</p>
        </div>
        <div className="bg-white rounded-xl border-l-4 border-amber-500 border border-gray-200 p-3">
          <p className="text-lg font-mono font-semibold text-amber-600">
            {inReviewCount}
          </p>
          <p className="text-xs text-gray-500">En revisión</p>
        </div>
        <div className="bg-white rounded-xl border-l-4 border-gray-300 border border-gray-200 p-3">
          <p className="text-lg font-mono font-semibold text-gray-600">
            {pagination.total}
          </p>
          <p className="text-xs text-gray-500">Total</p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">
                  ID
                </th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">
                  Pedido
                </th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">
                  Profesional
                </th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">
                  Motivo
                </th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">
                  Estado
                </th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">
                  Fecha
                </th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">
                  Acción
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
                : filtered.map((e) => (
                    <tr key={e.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-sm font-mono text-gray-900">
                        #{e.id.slice(-6)}
                      </td>
                      <td className="px-4 py-3 text-sm font-mono text-gray-600">
                        #{e.requestId.slice(-4)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {e.professional?.name || '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 max-w-[200px] truncate">
                        {e.request?.description || '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            STATUS_BADGE[e.status]?.className || 'bg-gray-50 text-gray-700'
                          }`}
                        >
                          {STATUS_BADGE[e.status]?.label || e.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">
                        {new Date(e.createdAt).toLocaleDateString('es-AR')}
                      </td>
                      <td className="px-4 py-3">
                        {e.status === 'OPEN' && (
                          <div className="flex gap-1.5">
                            <button
                              onClick={() => setConfirmAction(e)}
                              disabled={actionLoading === e.id}
                              className="text-xs font-medium px-2 py-1 rounded-md bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 disabled:opacity-50 transition-colors cursor-pointer"
                            >
                              Revisar
                            </button>
                            <button
                              onClick={() => setResolveModal(e)}
                              disabled={actionLoading === e.id}
                              className="text-xs font-medium px-2 py-1 rounded-md bg-green-700 text-white hover:bg-green-800 disabled:opacity-50 transition-colors cursor-pointer"
                            >
                              Resolver
                            </button>
                          </div>
                        )}
                        {e.status === 'IN_REVIEW' && (
                          <button
                            onClick={() => setResolveModal(e)}
                            disabled={actionLoading === e.id}
                            className="text-xs font-medium px-2 py-1 rounded-md bg-green-700 text-white hover:bg-green-800 disabled:opacity-50 transition-colors cursor-pointer"
                          >
                            Resolver
                          </button>
                        )}
                        {e.status === 'RESOLVED' && (
                          <span className="text-xs text-gray-400">—</span>
                        )}
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
                      'No se encontraron escaladas'
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {pagination.total > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
            <span className="text-xs text-gray-500">
              Mostrando {(pagination.page - 1) * pagination.limit + 1}–
              {Math.min(pagination.page * pagination.limit, pagination.total)}{' '}
              de {pagination.total} escaladas
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

      {/* Resolve modal */}
      {resolveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="fixed inset-0 bg-gray-900/40"
            onClick={() => setResolveModal(null)}
          />
          <div className="relative bg-white rounded-2xl border border-gray-200 shadow-xl w-full max-w-md p-6 mx-4">
            <h3 className="text-lg font-semibold text-gray-900">
              Resolver escalada
            </h3>
            <p className="text-sm text-gray-500 mt-1">
              #{resolveModal.id.slice(-6)} — {resolveModal.professional?.name}
            </p>
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-900 mb-1.5">
                Resolución
              </label>
              <textarea
                value={resolution}
                onChange={(e) => setResolution(e.target.value)}
                placeholder="Describí cómo se resolvió el incidente..."
                className="w-full h-24 px-3 py-2 text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-green-700/40 focus:border-green-700 resize-none"
              />
            </div>
            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-100">
              <button
                onClick={() => {
                  setResolveModal(null);
                  setResolution('');
                }}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 cursor-pointer transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => setConfirmResolve(true)}
                disabled={!resolution.trim()}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-green-700 text-white hover:bg-green-800 disabled:opacity-50 transition-colors cursor-pointer"
              >
                Resolver
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm status change to IN_REVIEW */}
      <ConfirmDialog
        open={!!confirmAction}
        title="Cambiar a En revisión"
        description={
          confirmAction
            ? `¿Estás seguro de que querés poner en revisión la escalada #${confirmAction.id.slice(-6)}?`
            : ''
        }
        confirmLabel="Poner en revisión"
        variant="warning"
        loading={confirmAction ? actionLoading === confirmAction.id : false}
        onConfirm={() => confirmAction && executeStatusChange(confirmAction.id, 'IN_REVIEW')}
        onCancel={() => setConfirmAction(null)}
      />

      {/* Confirm resolve */}
      <ConfirmDialog
        open={confirmResolve}
        title="Resolver escalada"
        description={
          resolveModal
            ? `¿Confirmás la resolución de la escalada #${resolveModal.id.slice(-6)}?`
            : ''
        }
        confirmLabel="Confirmar resolución"
        variant="success"
        loading={resolveModal ? actionLoading === resolveModal.id : false}
        onConfirm={executeResolve}
        onCancel={() => setConfirmResolve(false)}
      />
    </div>
  );
}
