import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Search, ChevronLeft, ChevronRight, X } from 'lucide-react';
import {
  getProfessionals,
  getGeoTree,
  adminCreateProfessional,
  getCategories,
  getDepartments,
  getProfessionalsWithPendingChanges,
} from '../../lib/admin-api';
import { useAuth } from '../../context/AuthContext';
import { resolveHostContext } from '../../lib/host';
import type { Professional, ProfessionalStatus, Category } from '../../types/admin';

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
  { value: 'HAS_PENDING_CHANGES', label: 'Con cambios pendientes' },
];

const DAY_NAMES: Record<number, string> = {
  0: 'Domingo',
  1: 'Lunes',
  2: 'Martes',
  3: 'Miércoles',
  4: 'Jueves',
  5: 'Viernes',
  6: 'Sábado',
};

export function ProfessionalsPage() {
  const { isSuperAdmin } = useAuth();
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [provinceFilter, setProvinceFilter] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [pendingChangesIds, setPendingChangesIds] = useState<string[]>([]);
  const [geoTree, setGeoTree] = useState<{
    provinces: { id: string; name: string; departments: { id: string; name: string }[] }[];
  }>({ provinces: [] });
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [createStep, setCreateStep] = useState<1 | 2>(1);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({
    phone: '',
    name: '',
    categoryId: '',
    zoneIds: [] as string[],
    selectedDays: [] as number[],
    timeSlots: {} as Record<number, { from: string; to: string }>,
  });
  const [sameSchedule, setSameSchedule] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);

  const fetchData = (page = 1) => {
    setLoading(true);
    getProfessionals({
      page,
      limit: 20,
      status: statusFilter === 'HAS_PENDING_CHANGES' ? undefined : (statusFilter || undefined),
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
    getGeoTree()
      .then((res) => setGeoTree(res.data))
      .catch((err) => { console.error('Failed to load geo tree', err); });
    getProfessionalsWithPendingChanges()
      .then((res) => setPendingChangesIds(res.data))
      .catch(() => {});
  }, []);

  const availableDepartments = provinceFilter
    ? (geoTree.provinces.find((p) => p.id === provinceFilter)?.departments ?? [])
    : geoTree.provinces.flatMap((p) => p.departments);

  const handleProvinceChange = (provinceId: string) => {
    setProvinceFilter(provinceId);
    setDepartmentFilter('');
  };

  const openCreateModal = useCallback(() => {
    setCreateStep(1);
    setCreateForm({ phone: '', name: '', categoryId: '', zoneIds: [], selectedDays: [], timeSlots: {} });
    setSameSchedule(false);
    setCreateError('');
    setShowCreateModal(true);
    Promise.all([
      getCategories(),
      getDepartments(),
    ])
      .then(([catRes, depRes]) => {
        setCategories(catRes.data.filter((c) => c.isActive));
        setDepartments(depRes.data);
      })
      .catch((err) => {
        console.error('Failed to load form data', err);
      });
  }, []);

  const toggleZone = (zoneId: string) => {
    setCreateForm((prev) => ({
      ...prev,
      zoneIds: prev.zoneIds.includes(zoneId)
        ? prev.zoneIds.filter((id) => id !== zoneId)
        : [...prev.zoneIds, zoneId],
    }));
  };

  const handleAdminCreate = async () => {
    setCreateLoading(true);
    setCreateError('');
    try {
      const slots = createForm.selectedDays
        .filter((day) => createForm.timeSlots[day]?.from && createForm.timeSlots[day]?.to)
        .map((day) => ({
          day,
          from: createForm.timeSlots[day].from,
          to: createForm.timeSlots[day].to,
        }));

      const availability = slots.length
        ? slots.map((s) => `${DAY_NAMES[s.day]}: ${s.from} a ${s.to}`).join(', ')
        : undefined;

      const availabilityStructured = slots.length ? { slots } : undefined;

      await adminCreateProfessional({
        phone: createForm.phone,
        name: createForm.name,
        categoryId: createForm.categoryId,
        zoneIds: createForm.zoneIds,
        ...(availability && { availability }),
        ...(availabilityStructured && { availabilityStructured }),
      });
      setShowCreateModal(false);
      fetchData();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Error al crear profesional');
    } finally {
      setCreateLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, departmentFilter, provinceFilter]);

  const filtered = professionals.filter(
    (p) => {
      if (statusFilter === 'HAS_PENDING_CHANGES') {
        if (!pendingChangesIds.includes(p.id)) return false;
      }
      if (!search) return true;
      return (
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.phone?.toLowerCase().includes(search.toLowerCase()) ||
        p.dniNumber?.includes(search)
      );
    },
  );

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black text-gray-900 tracking-tighter">Profesionales</h1>
          <p className="text-sm text-gray-500 mt-1">
            Gestión de profesionales registrados en la plataforma
          </p>
        </div>
        {isSuperAdmin() && (
          <button
            onClick={openCreateModal}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-green-700 text-white hover:bg-green-800 cursor-pointer shrink-0"
          >
            Nuevo profesional
          </button>
        )}
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
          value={provinceFilter}
          onChange={(e) => handleProvinceChange(e.target.value)}
          className="h-9 px-3 text-sm rounded-lg border border-gray-200 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-700/40"
        >
          <option value="">Todas las provincias</option>
          {geoTree.provinces.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>

        <select
          value={departmentFilter}
          onChange={(e) => setDepartmentFilter(e.target.value)}
          className="h-9 px-3 text-sm rounded-lg border border-gray-200 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-700/40"
        >
          <option value="">Todos los departamentos</option>
          {availableDepartments.map((d) => (
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
                  Categoría
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
                      {[...Array(8)].map((_, j) => (
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
                        {pendingChangesIds.includes(p.id) && (
                          <span title="Tiene cambios sensibles pendientes de revisión" className="ml-2 inline-flex items-center">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                              <line x1="12" y1="9" x2="12" y2="13"/>
                              <line x1="12" y1="17" x2="12.01" y2="17"/>
                            </svg>
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm font-mono text-gray-600">
                        {p.dniNumber || '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {p.zones?.[0]?.geoNode?.name || '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {p.category?.name || '—'}
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
                    colSpan={8}
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
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-semibold text-gray-900">{p.name}</p>
                      {pendingChangesIds.includes(p.id) && (
                        <span title="Tiene cambios sensibles pendientes de revisión" className="inline-flex items-center">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                            <line x1="12" y1="9" x2="12" y2="13"/>
                            <line x1="12" y1="17" x2="12.01" y2="17"/>
                          </svg>
                        </span>
                      )}
                    </div>
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
                      <span className="text-gray-500">Categoría:</span>{' '}
                      {p.category?.name || '—'}
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

      {/* Create professional modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="fixed inset-0 bg-gray-900/40"
            onClick={() => {
              setShowCreateModal(false);
              setCreateStep(1);
            }}
          />
          <div className="relative bg-white rounded-2xl border border-gray-200 shadow-xl w-full max-w-md p-6 mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Nuevo profesional</h3>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setCreateStep(1);
                }}
                className="p-1 rounded-md text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Step indicator */}
            <div className="flex gap-2 mt-4">
              <div
                className={`flex-1 h-1 rounded-full ${
                  createStep === 1 ? 'bg-green-700' : createStep === 2 ? 'bg-green-300' : 'bg-gray-200'
                }`}
              />
              <div
                className={`flex-1 h-1 rounded-full ${
                  createStep === 2 ? 'bg-green-700' : 'bg-gray-200'
                }`}
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {createStep === 1 ? 'Paso 1: Datos básicos' : 'Paso 2: Disponibilidad'}
            </p>

            {createStep === 1 && (
              <div className="mt-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1.5">
                    Nombre completo
                  </label>
                  <input
                    type="text"
                    value={createForm.name}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, name: e.target.value })
                    }
                    placeholder="Nombre del profesional"
                    className="w-full h-10 px-3 text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-green-700/40 focus:border-green-700"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1.5">
                    Teléfono
                  </label>
                  <input
                    type="text"
                    value={createForm.phone}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, phone: e.target.value })
                    }
                    placeholder="5492612345678"
                    className="w-full h-10 px-3 text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-green-700/40 focus:border-green-700"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1.5">
                    Categoría
                  </label>
                  <select
                    value={createForm.categoryId}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, categoryId: e.target.value })
                    }
                    className="w-full h-10 px-3 text-sm rounded-lg border border-gray-200 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-700/40 focus:border-green-700"
                  >
                    <option value="">Seleccionar categoría</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1.5">
                    Zonas
                  </label>
                  <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-lg p-2 space-y-1">
                    {departments.length === 0 && (
                      <p className="text-sm text-gray-400 p-2">Cargando zonas...</p>
                    )}
                    {departments.map((d) => (
                      <label
                        key={d.id}
                        className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-gray-50 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={createForm.zoneIds.includes(d.id)}
                          onChange={() => toggleZone(d.id)}
                          className="w-4 h-4 rounded border-gray-300 text-green-700 focus:ring-green-700/40 cursor-pointer"
                        />
                        <span className="text-sm text-gray-700">{d.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {createStep === 2 && (
              <div className="mt-4 space-y-4">
                <p className="text-sm text-gray-600">
                  Seleccioná los días y horarios de trabajo del profesional (opcional).
                </p>

                <div className="space-y-2">
                  {[1, 2, 3, 4, 5, 6, 0].map((day) => (
                    <label
                      key={day}
                      className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={createForm.selectedDays.includes(day)}
                        onChange={() => {
                          const days = createForm.selectedDays.includes(day)
                            ? createForm.selectedDays.filter((d) => d !== day)
                            : [...createForm.selectedDays, day];
                          setCreateForm({ ...createForm, selectedDays: days });
                        }}
                        className="rounded border-gray-300 text-green-700 cursor-pointer"
                      />
                      {DAY_NAMES[day]}
                    </label>
                  ))}
                </div>

                {createForm.selectedDays.length > 0 && (
                  <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={sameSchedule}
                      onChange={() => setSameSchedule(!sameSchedule)}
                      className="rounded border-gray-300 text-green-700 cursor-pointer"
                    />
                    Mismo horario para todos los días
                  </label>
                )}

                {!sameSchedule &&
                  createForm.selectedDays
                    .sort((a, b) => (a === 0 ? 1 : b === 0 ? -1 : a - b))
                    .map((day) => (
                      <div key={day} className="flex items-center gap-3">
                        <span className="text-sm text-gray-600 w-24">{DAY_NAMES[day]}</span>
                        <input
                          type="time"
                          value={createForm.timeSlots[day]?.from || ''}
                          onChange={(e) =>
                            setCreateForm({
                              ...createForm,
                              timeSlots: {
                                ...createForm.timeSlots,
                                [day]: { ...createForm.timeSlots[day], from: e.target.value },
                              },
                            })
                          }
                          className="border border-gray-200 rounded-lg px-2 py-1 text-sm"
                        />
                        <span className="text-sm text-gray-400">a</span>
                        <input
                          type="time"
                          value={createForm.timeSlots[day]?.to || ''}
                          onChange={(e) =>
                            setCreateForm({
                              ...createForm,
                              timeSlots: {
                                ...createForm.timeSlots,
                                [day]: { ...createForm.timeSlots[day], to: e.target.value },
                              },
                            })
                          }
                          className="border border-gray-200 rounded-lg px-2 py-1 text-sm"
                        />
                      </div>
                    ))}

                {sameSchedule && createForm.selectedDays.length > 0 && (
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-gray-600 w-24">Horario</span>
                    <input
                      type="time"
                      value={
                        createForm.timeSlots[createForm.selectedDays[0]]?.from || ''
                      }
                      onChange={(e) => {
                        const newTimeSlots = { ...createForm.timeSlots };
                        for (const day of createForm.selectedDays) {
                          newTimeSlots[day] = {
                            ...newTimeSlots[day],
                            from: e.target.value,
                          };
                        }
                        setCreateForm({ ...createForm, timeSlots: newTimeSlots });
                      }}
                      className="border border-gray-200 rounded-lg px-2 py-1 text-sm"
                    />
                    <span className="text-sm text-gray-400">a</span>
                    <input
                      type="time"
                      value={
                        createForm.timeSlots[createForm.selectedDays[0]]?.to || ''
                      }
                      onChange={(e) => {
                        const newTimeSlots = { ...createForm.timeSlots };
                        for (const day of createForm.selectedDays) {
                          newTimeSlots[day] = {
                            ...newTimeSlots[day],
                            to: e.target.value,
                          };
                        }
                        setCreateForm({ ...createForm, timeSlots: newTimeSlots });
                      }}
                      className="border border-gray-200 rounded-lg px-2 py-1 text-sm"
                    />
                  </div>
                )}
              </div>
            )}

            {createError && (
              <p className="mt-3 text-sm text-red-600">{createError}</p>
            )}

            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-100">
              {createStep === 1 && (
                <>
                  <button
                    onClick={() => {
                      setShowCreateModal(false);
                      setCreateStep(1);
                    }}
                    className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => setCreateStep(2)}
                    disabled={
                      !createForm.name.trim() ||
                      !createForm.phone.trim() ||
                      !createForm.categoryId ||
                      createForm.zoneIds.length === 0
                    }
                    className="px-4 py-2 text-sm font-medium rounded-lg bg-green-700 text-white hover:bg-green-800 disabled:opacity-50 cursor-pointer"
                  >
                    Siguiente →
                  </button>
                </>
              )}

              {createStep === 2 && (
                <>
                  <button
                    onClick={() => setCreateStep(1)}
                    className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 cursor-pointer"
                  >
                    ← Volver
                  </button>
                  <button
                    onClick={handleAdminCreate}
                    disabled={createLoading}
                    className="px-4 py-2 text-sm font-medium rounded-lg bg-green-700 text-white hover:bg-green-800 disabled:opacity-50 cursor-pointer"
                  >
                    {createLoading ? 'Creando...' : 'Crear profesional'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
