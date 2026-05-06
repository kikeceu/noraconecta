import { useState, useEffect } from 'react';
import {
  getCategories,
  createCategory,
  updateCategory,
  toggleCategory,
} from '../../lib/admin-api';
import { useAuth } from '../../context/AuthContext';
import type { Category } from '../../types/admin';

export function CategoriesPage() {
  const { isSuperAdmin } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [form, setForm] = useState({ name: '', description: '' });
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [modalLoading, setModalLoading] = useState(false);

  const fetchData = () => {
    setLoading(true);
    getCategories()
      .then((res) => setCategories(res.data))
      .catch((err) => setError(err instanceof Error ? err.message : 'Error al cargar'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openCreate = () => {
    setEditingCategory(null);
    setForm({ name: '', description: '' });
    setShowModal(true);
  };

  const openEdit = (cat: Category) => {
    setEditingCategory(cat);
    setForm({ name: cat.name, description: cat.description || '' });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setModalLoading(true);
    try {
      if (editingCategory) {
        await updateCategory(editingCategory.id, {
          name: form.name.trim(),
          description: form.description.trim() || undefined,
        });
      } else {
        await createCategory({
          name: form.name.trim(),
          description: form.description.trim() || undefined,
        });
      }
      setShowModal(false);
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setModalLoading(false);
    }
  };

  const handleToggle = async (id: string) => {
    if (!isSuperAdmin()) return;
    setActionLoading(id);
    try {
      await toggleCategory(id);
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cambiar estado');
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Categorías</h1>
          <p className="text-sm text-gray-500 mt-1">
            Tipos de servicios disponibles en la plataforma
          </p>
        </div>
        {isSuperAdmin() && (
          <button
            onClick={openCreate}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-green-700 text-white hover:bg-green-800 transition-colors cursor-pointer"
          >
            Crear categoría
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm">
          {error}
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">
                  Nombre
                </th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">
                  Descripción
                </th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">
                  Estado
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
                      {[...Array(4)].map((_, j) => (
                        <td key={j} className="px-4 py-3">
                          <div className="h-4 bg-gray-100 rounded w-3/4" />
                        </td>
                      ))}
                    </tr>
                  ))
                : categories.map((cat) => (
                    <tr key={cat.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-sm font-semibold text-gray-900">
                        {cat.name}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500 max-w-[300px] truncate">
                        {cat.description || '—'}
                      </td>
                      <td className="px-4 py-3">
                        {isSuperAdmin() ? (
                          <button
                            onClick={() => handleToggle(cat.id)}
                            disabled={actionLoading === cat.id}
                            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer ${
                              cat.isActive ? 'bg-green-600' : 'bg-gray-200'
                            } disabled:opacity-50`}
                          >
                            <span
                              className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
                                cat.isActive
                                  ? 'translate-x-[18px]'
                                  : 'translate-x-[3px]'
                              }`}
                            />
                          </button>
                        ) : (
                          <span
                            className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              cat.isActive
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-gray-50 text-gray-500'
                            }`}
                          >
                            {cat.isActive ? 'Activo' : 'Inactivo'}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {isSuperAdmin() && (
                          <button
                            onClick={() => openEdit(cat)}
                            className="text-sm text-green-700 hover:text-green-800 font-medium cursor-pointer"
                          >
                            Editar
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
              {!loading && categories.length === 0 && (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-12 text-center text-sm text-gray-500"
                  >
                    No hay categorías configuradas
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create/Edit modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="fixed inset-0 bg-gray-900/40"
            onClick={() => setShowModal(false)}
          />
          <div className="relative bg-white rounded-2xl border border-gray-200 shadow-xl w-full max-w-md p-6 mx-4">
            <h3 className="text-lg font-semibold text-gray-900">
              {editingCategory ? 'Editar categoría' : 'Crear categoría'}
            </h3>

            <div className="mt-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1.5">
                  Nombre
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Nombre de la categoría"
                  className="w-full h-10 px-3 text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-green-700/40 focus:border-green-700"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1.5">
                  Descripción
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                  placeholder="Descripción del servicio"
                  className="w-full h-20 px-3 py-2 text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-green-700/40 focus:border-green-700 resize-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-100">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={!form.name.trim() || modalLoading}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-green-700 text-white hover:bg-green-800 disabled:opacity-50 cursor-pointer"
              >
                {modalLoading
                  ? 'Guardando...'
                  : editingCategory
                    ? 'Guardar cambios'
                    : 'Crear categoría'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
