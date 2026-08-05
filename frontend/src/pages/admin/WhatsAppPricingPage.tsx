import { useState, useEffect } from 'react';
import {
  getConfig,
  updateConfig,
  getWhatsAppTemplates,
  updateWhatsAppTemplate,
} from '../../lib/admin-api';
import type {
  WhatsAppTemplate,
  SystemConfig,
} from '../../types/admin';

const CATEGORY_BADGE: Record<string, string> = {
  utility: 'bg-[#ECFDF5] text-[#059669]',
  marketing: 'bg-orange-50 text-orange-700',
  authentication: 'bg-blue-50 text-blue-700',
};

const CATEGORY_LABELS: Record<string, string> = {
  utility: 'Utilidad',
  marketing: 'Marketing',
  authentication: 'Autenticación',
};

const PRICING_CATEGORIES = [
  { key: 'WHATSAPP_SERVICE_CONVERSATION_COST_USD', label: 'Conversación de servicio', description: 'Mensajes de servicio (no templates)' },
  { key: 'WHATSAPP_UTILITY_CONVERSATION_COST_USD', label: 'Utilidad', description: 'Confirmaciones, actualizaciones de cuenta, etc.' },
  { key: 'WHATSAPP_MARKETING_CONVERSATION_COST_USD', label: 'Marketing', description: 'Promociones, ofertas, etc.' },
  { key: 'WHATSAPP_AUTHENTICATION_CONVERSATION_COST_USD', label: 'Autenticación', description: 'OTPs, verificación de identidad, etc.' },
];

export function WhatsAppPricingPage() {
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);
  const [categoryPrices, setCategoryPrices] = useState<Record<string, string>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [editingTemplate, setEditingTemplate] = useState<string | null>(null);
  const [editCategory, setEditCategory] = useState('');
  const [savingTemplate, setSavingTemplate] = useState<string | null>(null);

  const fetchData = () => {
    setLoading(true);
    setError('');

    Promise.all([getWhatsAppTemplates(), getConfig()])
      .then(([tRes, cRes]) => {
        setTemplates(tRes.data);
        const prices: Record<string, string> = {};
        for (const cat of PRICING_CATEGORIES) {
          const config = cRes.data.find(
            (c: SystemConfig) => c.key === cat.key,
          );
          prices[cat.key] = config?.value ?? '0';
        }
        setCategoryPrices(prices);
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : 'Error al cargar datos'),
      )
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchData();
  }, []);

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  const handleSaveCategoryPrice = async (key: string) => {
    const value = categoryPrices[key];
    if (!value.trim()) return;
    setSavingKey(key);
    setError('');
    try {
      await updateConfig(key, value);
      showSuccess('Precio de categoría actualizado');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Error al guardar precio',
      );
    } finally {
      setSavingKey(null);
    }
  };

  const startEdit = (template: WhatsAppTemplate) => {
    setEditingTemplate(template.name);
    setEditCategory(template.category);
  };

  const cancelEdit = () => {
    setEditingTemplate(null);
    setEditCategory('');
  };

  const handleSaveTemplate = async (name: string) => {
    setSavingTemplate(name);
    setError('');
    try {
      await updateWhatsAppTemplate(name, {
        category: editCategory,
      });
      setTemplates((prev) =>
        prev.map((t) =>
          t.name === name
            ? { ...t, category: editCategory }
            : t,
        ),
      );
      cancelEdit();
      showSuccess('Template actualizado');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Error al guardar template',
      );
    } finally {
      setSavingTemplate(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-black text-gray-900 tracking-tighter">
          Precios WhatsApp
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Configuración de costos por categoría de conversación (Meta factura por categoría, no por template)
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm">
          {error}
        </div>
      )}

      {successMsg && (
        <div className="bg-[#ECFDF5] border border-[#A7F3D0] text-[#065F46] rounded-xl p-4 text-sm">
          {successMsg}
        </div>
      )}

      {/* Category pricing cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {loading
          ? PRICING_CATEGORIES.map((cat) => (
              <div key={cat.key} className="bg-white rounded-xl border border-gray-200 p-6 animate-pulse">
                <div className="h-5 bg-gray-100 rounded w-1/2 mb-2" />
                <div className="h-4 bg-gray-100 rounded w-3/4 mb-4" />
                <div className="h-10 bg-gray-100 rounded-lg w-48" />
              </div>
            ))
          : PRICING_CATEGORIES.map((cat) => {
              const isSaving = savingKey === cat.key;
              return (
                <div key={cat.key} className="bg-white rounded-xl border border-gray-200 p-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-1">
                    {cat.label}
                  </h2>
                  <p className="text-sm text-gray-500 mb-4">{cat.description}</p>
                  <div className="flex items-center gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">
                        Costo unitario (USD)
                      </label>
                      <input
                        type="number"
                        step="0.0001"
                        min="0"
                        value={categoryPrices[cat.key] ?? '0'}
                        onChange={(e) =>
                          setCategoryPrices((prev) => ({
                            ...prev,
                            [cat.key]: e.target.value,
                          }))
                        }
                        className="w-40 px-3 py-2 text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-green-700/40 focus:border-green-700"
                      />
                    </div>
                    <button
                      onClick={() => handleSaveCategoryPrice(cat.key)}
                      disabled={isSaving || !(categoryPrices[cat.key] ?? '').trim()}
                      className="mt-5 px-4 py-2 text-sm font-medium rounded-lg bg-green-700 text-white hover:bg-green-800 disabled:opacity-50 cursor-pointer"
                    >
                      {isSaving ? 'Guardando...' : 'Guardar'}
                    </button>
                  </div>
                </div>
              );
            })}
      </div>

      {/* Templates table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">
            Templates
          </h2>
        </div>

        <div className="hidden lg:block overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">
                  Template
                </th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">
                  Categoría
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
                      {[...Array(3)].map((_, j) => (
                        <td key={j} className="px-4 py-3">
                          <div className="h-4 bg-gray-100 rounded w-3/4" />
                        </td>
                      ))}
                    </tr>
                  ))
                : templates.map((template) => {
                    const isEditing = editingTemplate === template.name;
                    const isSaving = savingTemplate === template.name;

                    return (
                      <tr
                        key={template.name}
                        className="hover:bg-gray-50 transition-colors"
                      >
                        <td className="px-4 py-3 text-sm font-mono font-semibold text-gray-900 max-w-[300px] truncate">
                          {template.name}
                        </td>

                        <td className="px-4 py-3">
                          {isEditing ? (
                            <select
                              value={editCategory}
                              onChange={(e) => setEditCategory(e.target.value)}
                              className="text-sm rounded-lg border border-gray-200 px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-green-700/40 focus:border-green-700"
                            >
                              <option value="utility">Utilidad</option>
                              <option value="marketing">Marketing</option>
                              <option value="authentication">
                                Autenticación
                              </option>
                            </select>
                          ) : (
                            <span
                              className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                                CATEGORY_BADGE[template.category] ||
                                'bg-gray-50 text-gray-600'
                              }`}
                            >
                              {CATEGORY_LABELS[template.category] ||
                                template.category}
                            </span>
                          )}
                        </td>

                        <td className="px-4 py-3">
                          {isEditing ? (
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleSaveTemplate(template.name)}
                                disabled={isSaving}
                                className="text-sm text-green-700 hover:text-green-800 font-medium disabled:opacity-50 cursor-pointer"
                              >
                                {isSaving ? 'Guardando...' : 'Guardar'}
                              </button>
                              <button
                                onClick={cancelEdit}
                                disabled={isSaving}
                                className="text-sm text-gray-500 hover:text-gray-700 disabled:opacity-50 cursor-pointer"
                              >
                                Cancelar
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => startEdit(template)}
                              className="text-sm text-green-700 hover:text-green-800 font-medium cursor-pointer"
                            >
                              Editar
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
              {!loading && templates.length === 0 && (
                <tr>
                  <td
                    colSpan={3}
                    className="px-4 py-12 text-center text-sm text-gray-500"
                  >
                    No hay templates configurados
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="lg:hidden space-y-3 p-3">
          {loading
            ? [...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className="bg-white rounded-xl border border-gray-200 p-4 animate-pulse space-y-2"
                >
                  <div className="h-4 bg-gray-100 rounded w-1/2" />
                  <div className="h-3 bg-gray-100 rounded w-3/4" />
                </div>
              ))
            : templates.map((template) => {
                const isEditing = editingTemplate === template.name;
                const isSaving = savingTemplate === template.name;

                return (
                  <div
                    key={template.name}
                    className="bg-white rounded-xl border border-gray-200 p-4 space-y-3"
                  >
                    <p className="text-sm font-mono font-semibold text-gray-900 break-all">
                      {template.name}
                    </p>

                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">Categoría:</span>
                      {isEditing ? (
                        <select
                          value={editCategory}
                          onChange={(e) => setEditCategory(e.target.value)}
                          className="text-sm rounded-lg border border-gray-200 px-2 py-1 focus:outline-none focus:ring-2 focus:ring-green-700/40 focus:border-green-700"
                        >
                          <option value="utility">Utilidad</option>
                          <option value="marketing">Marketing</option>
                          <option value="authentication">Autenticación</option>
                        </select>
                      ) : (
                        <span
                          className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                            CATEGORY_BADGE[template.category] ||
                            'bg-gray-50 text-gray-600'
                          }`}
                        >
                          {CATEGORY_LABELS[template.category] ||
                            template.category}
                        </span>
                      )}
                    </div>

                    <div>
                      {isEditing ? (
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => handleSaveTemplate(template.name)}
                            disabled={isSaving}
                            className="text-sm text-green-700 hover:text-green-800 font-medium disabled:opacity-50 cursor-pointer"
                          >
                            {isSaving ? 'Guardando...' : 'Guardar'}
                          </button>
                          <button
                            onClick={cancelEdit}
                            disabled={isSaving}
                            className="text-sm text-gray-500 hover:text-gray-700 disabled:opacity-50 cursor-pointer"
                          >
                            Cancelar
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => startEdit(template)}
                          className="text-sm text-green-700 hover:text-green-800 font-medium cursor-pointer"
                        >
                          Editar
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}

          {!loading && templates.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-gray-500 bg-white rounded-xl border border-gray-200">
              No hay templates configurados
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
