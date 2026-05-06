import { useState, useEffect } from 'react';
import { Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { getUsers, blockUser, unblockUser } from '../../lib/admin-api';
import { useAuth } from '../../context/AuthContext';
import { ConfirmDialog } from '../../components/admin/ConfirmDialog';
import type { User } from '../../types/admin';

export function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [confirmUser, setConfirmUser] = useState<User | null>(null);
  const { isSuperAdmin } = useAuth();

  const fetchData = (page = 1) => {
    setLoading(true);
    getUsers({ page, limit: 20 })
      .then((res) => {
        setUsers(res.data);
        setPagination(res.pagination);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Error al cargar'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchData();
  }, []);

  const executeToggleBlock = async (user: User) => {
    setActionLoading(user.id);
    setConfirmUser(null);
    try {
      if (user.status === 'BLOCKED') {
        await unblockUser(user.id);
      } else {
        await blockUser(user.id);
      }
      fetchData(pagination.page);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cambiar estado');
    } finally {
      setActionLoading(null);
    }
  };

  const filtered = users.filter((u) => {
    if (statusFilter && u.status !== statusFilter) return false;
    if (
      search &&
      !u.phone.includes(search) &&
      !u.name.toLowerCase().includes(search.toLowerCase())
    )
      return false;
    return true;
  });

  const activeCount = users.filter((u) => u.status === 'ACTIVE').length;
  const blockedCount = users.filter((u) => u.status === 'BLOCKED').length;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Usuarios</h1>
        <p className="text-sm text-gray-500 mt-1">
          Clientes registrados en la plataforma
        </p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por teléfono o nombre"
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
          <option value="ACTIVE">Activo</option>
          <option value="BLOCKED">Bloqueado</option>
        </select>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">
                  Teléfono
                </th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">
                  Nombre
                </th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">
                  Fecha registro
                </th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">
                  Estado
                </th>
                {isSuperAdmin() && (
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">
                    Acciones
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading
                ? [...Array(5)].map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      {[...Array(5)].map((_, j) => (
                        <td key={j} className="px-4 py-3">
                          <div className="h-4 bg-gray-100 rounded w-3/4" />
                        </td>
                      ))}
                    </tr>
                  ))
                : filtered.map((u) => (
                    <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-sm font-mono text-gray-900">
                        {u.phone}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {u.name}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {new Date(u.createdAt).toLocaleDateString('es-AR')}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            u.status === 'ACTIVE'
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-red-50 text-red-700'
                          }`}
                        >
                          {u.status === 'ACTIVE' ? 'Activo' : 'Bloqueado'}
                        </span>
                      </td>
                      {isSuperAdmin() && (
                        <td className="px-4 py-3">
                          <button
                            onClick={() => setConfirmUser(u)}
                            disabled={actionLoading === u.id}
                            className={`text-xs font-medium px-2.5 py-1 rounded-md border transition-colors disabled:opacity-50 cursor-pointer ${
                              u.status === 'BLOCKED'
                                ? 'text-green-700 border-green-300 hover:bg-green-50'
                                : 'text-red-600 border-red-300 hover:bg-red-50'
                            }`}
                          >
                            {actionLoading === u.id
                              ? '...'
                              : u.status === 'BLOCKED'
                                ? 'Desbloquear'
                                : 'Bloquear'}
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-12 text-center text-sm text-gray-500"
                  >
                    {error ? (
                      <span className="text-red-600">{error}</span>
                    ) : (
                      'No se encontraron usuarios'
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Footer metrics */}
        <div className="flex items-center gap-8 px-4 py-3 border-t border-gray-200 bg-gray-50/50">
          <div>
            <span className="text-sm font-mono font-semibold text-gray-900">
              {pagination.total}
            </span>
            <span className="text-xs text-gray-500 ml-1.5">Total registrados</span>
          </div>
          <div>
            <span className="text-sm font-mono font-semibold text-gray-900">
              {activeCount}
            </span>
            <span className="text-xs text-gray-500 ml-1.5">Activos</span>
          </div>
          <div>
            <span className="text-sm font-mono font-semibold text-red-600">
              {blockedCount}
            </span>
            <span className="text-xs text-gray-500 ml-1.5">Bloqueados</span>
          </div>
        </div>

        {pagination.total > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
            <span className="text-xs text-gray-500">
              Mostrando {(pagination.page - 1) * pagination.limit + 1}–
              {Math.min(pagination.page * pagination.limit, pagination.total)}{' '}
              de {pagination.total} usuarios
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

      <ConfirmDialog
        open={!!confirmUser}
        title={confirmUser?.status === 'BLOCKED' ? 'Desbloquear usuario' : 'Bloquear usuario'}
        description={
          confirmUser
            ? `¿Estás seguro de que querés ${confirmUser.status === 'BLOCKED' ? 'desbloquear' : 'bloquear'} a ${confirmUser.name} (${confirmUser.phone})?`
            : ''
        }
        confirmLabel={confirmUser?.status === 'BLOCKED' ? 'Desbloquear' : 'Bloquear'}
        variant="danger"
        loading={confirmUser ? actionLoading === confirmUser.id : false}
        onConfirm={() => confirmUser && executeToggleBlock(confirmUser)}
        onCancel={() => setConfirmUser(null)}
      />
    </div>
  );
}
