import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { getProfessionals, getDepartments } from '../../lib/admin-api';
import { resolveHostContext } from '../../lib/host';
import type { Professional, ProfessionalStatus } from '../../types/admin';

const STATUS_BADGE: Record<ProfessionalStatus, { label: string; className: string }> = {
  PENDING: { label: 'Pendiente', className: 'bg-amber-50 text-amber-700' },
  UNDER_REVIEW: { label: 'En revisión', className: 'bg-blue-50 text-blue-700' },
  ACTIVE: { label: 'Activo', className: 'bg-emerald-50 text-emerald-700' },
  OBSERVATION: { label: 'Observación', className: 'bg-amber-50 text-amber-700' },
  SUSPENDED: { label: 'Suspendido', className: 'bg-red-50 text-red-700' },
  PAUSED: { label: 'Pausado', className: 'bg-gray-50 text-gray-700' },
  REJECTED: { label: 'Rechazado', className: 'bg-red-50 text-red-700' },
};

function adminPath(path: string): string {
  const base = resolveHostContext() === 'admin' ? '' : '/admin';
  return `${base}${path}`;
}

const STATUS_FILTERS: Array<{ value: string; label: string }> = [
  { value: '', label: 'Todos los estados' },
  { value: 'PENDING', label: 'Pendiente' },
  { value: 'UNDER_REVIEW', label: 'En revisión' },
  { value: 'ACTIVE', label: 'Activo' },
  { value: 'OBSERVATION', label: 'Observación' },
  { value: 'SUSPENDED', label: 'Suspendido' },
  { value: 'REJECTED', label: 'Rechazado' },
];

export function ProfessionalsPage() {
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });

  const fetchData = (page = 1) => {
    setLoading(true);
    getProfessionals({
      page,
      limit: 20,
      status: statusFilter || undefined,
      departmentId: departmentFilter || undefined,
    })
      .then((res) => {
        setProfessionals(res.data);
        setPagination(res.pagination);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Error al cargar'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    getDepartments().then((res) => setDepartments(res.data)).catch((err) => { console.error('Failed to load departments', err); });
  }, []);

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, departmentFilter]);

  const filtered = professionals.filter(
    (p) =>
      !search ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.phone?.toLowerCase().includes(search.toLowerCase()) ||
      p.dniNumber?.includes(search),
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-4xl font-black text-gray-900 tracking-tighter">Profesionales</h1>
        <p className="text-sm text-gray-500 mt-1">
          Gestión de profesionales registrados en la plataforma
        </p>
      </div>

      {/* Filter bar */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por nombre, teléfono o DNI"
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
          {STATUS_FILTERS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
        <select
          value={departmentFilter}
          onChange={(e) => setDepartmentFilter(e.target.value)}
          className="h-9 px-3 text-sm rounded-lg border border-gray-200 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-700/40"
        >
          <option value="">Todos los departamentos</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </div>

      {/* Table / mobile cards */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="hidden lg:block overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">
                  Nombre
                </th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">
                  DNI
                </th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">
                  Zona
                </th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">
                  Teléfono
                </th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">
                  Estado
                </th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">
                  Fecha registro
                </th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">
                  Acciones
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
                : filtered.map((p) => (
                    <tr
                      key={p.id}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">
                        {p.name}
                      </td>
                      <td className="px-4 py-3 text-sm font-mono text-gray-600">
                        {p.dniNumber || '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {p.zones?.[0]?.geoNode?.name || '—'}
                      </td>
                      <td className="px-4 py-3 text-sm font-mono text-gray-600">
                        {p.phone || '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            STATUS_BADGE[p.status]?.className || 'bg-gray-50 text-gray-700'
                          }`}
                        >
                          {STATUS_BADGE[p.status]?.label || p.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {new Date(p.createdAt).toLocaleDateString('es-AR')}
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          to={adminPath(`/professionals/${p.id}`)}
                          className="text-sm text-green-700 hover:text-green-800 font-medium cursor-pointer"
                        >
                          Ver detalle
                        </Link>
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
                      'No se encontraron profesionales'
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
            : filtered.map((p) => (
                <div key={p.id} className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-semibold text-gray-900">{p.name}</p>
                    <span
                      className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${
                        STATUS_BADGE[p.status]?.className || 'bg-gray-50 text-gray-700'
                      }`}
                    >
                      {STATUS_BADGE[p.status]?.label || p.status}
                    </span>
                  </div>
                  <div className="space-y-1.5 text-sm text-gray-600">
                    <p>
                      <span className="text-gray-500">Zona:</span>{' '}
                      {p.zones?.[0]?.geoNode?.name || '—'}
                    </p>
                    <p>
                      <span className="text-gray-500">Teléfono:</span> {p.phone || '—'}
                    </p>
                    <p>
                      <span className="text-gray-500">DNI:</span>{' '}
                      <span className="font-mono">{p.dniNumber || '—'}</span>
                    </p>
                    <p>
                      <span className="text-gray-500">Registro:</span>{' '}
                      {new Date(p.createdAt).toLocaleDateString('es-AR')}
                    </p>
                  </div>
                  <Link
                    to={adminPath(`/professionals/${p.id}`)}
                    className="inline-flex text-sm text-green-700 hover:text-green-800 font-medium cursor-pointer"
                  >
                    Ver detalle
                  </Link>
                </div>
              ))}

          {!loading && filtered.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-gray-500 bg-white rounded-xl border border-gray-200">
              {error ? <span className="text-red-600">{error}</span> : 'No se encontraron profesionales'}
            </div>
          )}
        </div>

        {/* Pagination */}
        {pagination.total > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
            <span className="text-xs text-gray-500">
              Mostrando {(pagination.page - 1) * pagination.limit + 1}–
              {Math.min(pagination.page * pagination.limit, pagination.total)}{' '}
              de {pagination.total} profesionales
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
