import { useState, useEffect } from 'react';
import { getPrompts, updatePrompt, resetPrompt } from '../../lib/admin-api';
import { useAuth } from '../../context/AuthContext';
import { ConfirmDialog } from '../../components/admin/ConfirmDialog';
import type { PromptTemplate } from '../../types/admin';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-AR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function PromptsPage() {
  const { isSuperAdmin } = useAuth();
  const [prompts, setPrompts] = useState<PromptTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<PromptTemplate | null>(null);
  const [editContent, setEditContent] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [confirmReset, setConfirmReset] = useState<PromptTemplate | null>(null);

  const fetchData = () => {
    setLoading(true);
    setError('');
    getPrompts()
      .then((res) => setPrompts(res.data))
      .catch((err) => setError(err instanceof Error ? err.message : 'Error al cargar'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openEdit = (prompt: PromptTemplate) => {
    if (!prompt.isEditable) return;
    setEditingPrompt(prompt);
    setEditContent(prompt.content);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingPrompt(null);
    setEditContent('');
  };

  const handleSave = async () => {
    if (!editingPrompt || !editContent.trim()) return;
    setModalLoading(true);
    setError('');
    try {
      await updatePrompt(editingPrompt.key, editContent);
      closeModal();
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setModalLoading(false);
    }
  };

  const handleReset = async () => {
    if (!confirmReset) return;
    setActionLoading(confirmReset.key);
    setError('');
    try {
      await resetPrompt(confirmReset.key);
      setConfirmReset(null);
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al restaurar');
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-4xl font-black text-gray-900 tracking-tighter">
          Prompts IA
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Gestión de plantillas de lenguaje para el bot y coordinación
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm">
          {error}
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="hidden lg:block overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">
                  Identificador
                </th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">
                  Descripción
                </th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">
                  Variables
                </th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">
                  Lectura/Escritura
                </th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">
                  Última modificación
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
                      {[...Array(6)].map((_, j) => (
                        <td key={j} className="px-4 py-3">
                          <div className="h-4 bg-gray-100 rounded w-3/4" />
                        </td>
                      ))}
                    </tr>
                  ))
                : prompts.map((prompt) => (
                    <tr key={prompt.key} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-sm font-mono font-semibold text-gray-900 max-w-[200px] truncate">
                        {prompt.key}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500 max-w-[250px] truncate">
                        {prompt.description || '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {prompt.variables.length > 0
                            ? prompt.variables.map((v) => (
                                <span
                                  key={v}
                                  className="inline-flex rounded-full px-2 py-0.5 text-xs font-mono bg-[#ECFDF5] text-[#059669]"
                                >
                                  {`{{${v}}}`}
                                </span>
                              ))
                            : '—'}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {prompt.isEditable ? (
                          <span className="inline-flex rounded-full px-2 py-1 text-xs font-medium bg-[#ECFDF5] text-[#059669]">
                            Editable
                          </span>
                        ) : (
                          <span className="inline-flex rounded-full px-2 py-1 text-xs font-medium bg-amber-50 text-amber-700">
                            Solo lectura
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {formatDate(prompt.updatedAt)}
                      </td>
                      <td className="px-4 py-3">
                        {isSuperAdmin() && (
                          <button
                            onClick={() => openEdit(prompt)}
                            disabled={!prompt.isEditable}
                            className="text-sm text-green-700 hover:text-green-800 font-medium disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                          >
                            Editar
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
              {!loading && prompts.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-12 text-center text-sm text-gray-500"
                  >
                    No hay prompts configurados
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
            : prompts.map((prompt) => (
                <div
                  key={prompt.key}
                  className="bg-white rounded-xl border border-gray-200 p-4 space-y-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-mono font-semibold text-gray-900 break-all">
                      {prompt.key}
                    </p>
                    <span
                      className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${
                        prompt.isEditable
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-amber-50 text-amber-700'
                      }`}
                    >
                      {prompt.isEditable ? 'Editable' : 'Solo lectura'}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500">
                    {prompt.description || 'Sin descripción'}
                  </p>
                  <div>
                    {prompt.variables.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {prompt.variables.map((v) => (
                          <span
                            key={v}
                            className="inline-flex rounded-full px-2 py-0.5 text-xs font-mono bg-[#ECFDF5] text-[#059669]"
                          >
                            {`{{${v}}}`}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-gray-400">
                    {formatDate(prompt.updatedAt)}
                  </p>
                  <div>
                    {isSuperAdmin() && (
                      <button
                        onClick={() => openEdit(prompt)}
                        disabled={!prompt.isEditable}
                        className="text-sm text-green-700 hover:text-green-800 font-medium disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                      >
                        Editar
                      </button>
                    )}
                  </div>
                </div>
              ))}

          {!loading && prompts.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-gray-500 bg-white rounded-xl border border-gray-200">
              No hay prompts configurados
            </div>
          )}
        </div>
      </div>

      {showModal && editingPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-gray-900/40" onClick={closeModal} />
          <div className="relative bg-white rounded-2xl border border-gray-200 shadow-xl w-full max-w-2xl p-6 mx-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-gray-900">
              Editar prompt: {editingPrompt.key}
            </h3>

            <div className="mt-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1.5">
                  Contenido
                </label>
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  placeholder="Contenido del prompt..."
                  className="w-full h-60 px-3 py-2 text-sm font-mono rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-green-700/40 focus:border-green-700 resize-none"
                />
              </div>

              {editingPrompt.variables.length > 0 && (
                <div className="bg-[#ECFDF5] border border-[#A7F3D0] rounded-lg p-3">
                  <p className="text-sm text-[#065F46] font-medium mb-1.5">
                    Variables disponibles
                  </p>
                  <p className="text-xs text-[#059669] mb-1">
                    Usá <code className="text-xs font-mono bg-[#D1FAE5] px-1 rounded">{`{{nombreVariable}}`}</code> para insertar variables dinámicas en el contenido.
                  </p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {editingPrompt.variables.map((v) => (
                      <span
                        key={v}
                        className="inline-flex rounded-full px-2 py-0.5 text-xs font-mono bg-[#D1FAE5] text-[#059669]"
                      >
                        {`{{${v}}}`}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-between gap-3 mt-6 pt-4 border-t border-gray-100">
              <button
                onClick={() => setConfirmReset(editingPrompt)}
                disabled={modalLoading}
                className="px-4 py-2 text-sm text-red-600 hover:text-red-700 font-medium disabled:opacity-50 cursor-pointer"
              >
                Restaurar default
              </button>
              <div className="flex gap-3">
                <button
                  onClick={closeModal}
                  disabled={modalLoading}
                  className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSave}
                  disabled={!editContent.trim() || modalLoading}
                  className="px-4 py-2 text-sm font-medium rounded-lg bg-green-700 text-white hover:bg-green-800 disabled:opacity-50 cursor-pointer"
                >
                  {modalLoading ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmReset !== null}
        title="Restaurar valor por defecto"
        description={`¿Estás seguro de que querés restaurar el prompt "${confirmReset?.key}" a su contenido original? Esta acción no se puede deshacer.`}
        confirmLabel="Restaurar default"
        variant="danger"
        loading={confirmReset ? actionLoading === confirmReset.key : false}
        onConfirm={handleReset}
        onCancel={() => setConfirmReset(null)}
      />
    </div>
  );
}
