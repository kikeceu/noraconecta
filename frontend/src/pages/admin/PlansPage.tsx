import { useState, useEffect } from 'react';
import {
  getPlans,
  createPlan,
  updatePlan,
  deactivatePlan,
} from '../../lib/admin-api';
import { useAuth } from '../../context/AuthContext';
import type { Plan } from '../../types/admin';

const PLAN_COLORS: Record<string, string> = {
  Básico: 'bg-gray-50',
  Profesional: 'bg-amber-50',
  Premium: 'bg-emerald-50',
};

type PlanForm = {
  name: string;
  monthlyPrice: string;
  annualDiscountPct: string;
  isActive: boolean;
  features: string[];
};

const emptyForm: PlanForm = {
  name: '',
  monthlyPrice: '',
  annualDiscountPct: '0',
  isActive: true,
  features: [],
};

function planToForm(plan: Plan): PlanForm {
  return {
    name: plan.name,
    monthlyPrice: String(plan.monthlyPrice),
    annualDiscountPct: String(plan.annualDiscountPct),
    isActive: plan.isActive,
    features: Array.isArray(plan.features) ? [...plan.features] : [],
  };
}

export function PlansPage() {
  const { isSuperAdmin } = useAuth();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalMode, setModalMode] = useState<'create' | 'edit' | null>(null);
  const [editPlanId, setEditPlanId] = useState<string | null>(null);
  const [form, setForm] = useState<PlanForm>(emptyForm);
  const [newFeature, setNewFeature] = useState('');
  const [saving, setSaving] = useState(false);
  const [deactivating, setDeactivating] = useState<string | null>(null);
  const [confirmDeactivate, setConfirmDeactivate] = useState<string | null>(
    null,
  );

  useEffect(() => {
    getPlans()
      .then((res) => setPlans(res.data))
      .catch((err) =>
        setError(err instanceof Error ? err.message : 'Error al cargar'),
      )
      .finally(() => setLoading(false));
  }, []);

  const openCreate = () => {
    setModalMode('create');
    setEditPlanId(null);
    setForm(emptyForm);
  };

  const openEdit = (plan: Plan) => {
    setModalMode('edit');
    setEditPlanId(plan.id);
    setForm(planToForm(plan));
  };

  const closeModal = () => {
    setModalMode(null);
    setEditPlanId(null);
    setForm(emptyForm);
    setNewFeature('');
  };

  const addFeature = () => {
    const trimmed = newFeature.trim();
    if (trimmed && !form.features.includes(trimmed)) {
      setForm({ ...form, features: [...form.features, trimmed] });
      setNewFeature('');
    }
  };

  const removeFeature = (index: number) => {
    setForm({ ...form, features: form.features.filter((_, i) => i !== index) });
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      setError('El nombre del plan es obligatorio');
      return;
    }
    if (!form.monthlyPrice || Number(form.monthlyPrice) < 0) {
      setError('El precio mensual debe ser un número no negativo');
      return;
    }
    const discount = Number(form.annualDiscountPct);
    if (discount < 0 || discount > 100) {
      setError('El descuento anual debe estar entre 0 y 100');
      return;
    }
    setSaving(true);
    setError('');
    try {
      if (modalMode === 'create') {
        await createPlan({
          name: form.name.trim(),
          monthlyPrice: Number(form.monthlyPrice),
          annualDiscountPct: discount,
          features: form.features,
        });
      } else if (editPlanId) {
        await updatePlan(editPlanId, {
          name: form.name.trim(),
          monthlyPrice: Number(form.monthlyPrice),
          annualDiscountPct: discount,
          isActive: form.isActive,
          features: form.features,
        });
      }
      const res = await getPlans();
      setPlans(res.data);
      closeModal();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Error al guardar',
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async (id: string) => {
    setDeactivating(id);
    setError('');
    try {
      await deactivatePlan(id);
      const res = await getPlans();
      setPlans(res.data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Error al desactivar',
      );
    } finally {
      setDeactivating(null);
      setConfirmDeactivate(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 w-48 bg-gray-200 rounded" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-48 bg-gray-100 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-black text-gray-900 tracking-tighter">
            Planes
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Configuración de planes de suscripción para profesionales
          </p>
        </div>
        {isSuperAdmin() && (
          <button
            onClick={openCreate}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-green-700 text-white hover:bg-green-800 transition-colors cursor-pointer"
          >
            Crear plan
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm">
          {error}
        </div>
      )}

      {/* Plan cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {plans.map((plan) => (
          <div
            key={plan.id}
            className={`bg-white rounded-xl border border-gray-200 p-5 hover:shadow-sm transition-shadow ${
              PLAN_COLORS[plan.name] || ''
            }`}
          >
            <div className="flex items-start justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-900">
                Plan {plan.name}
              </h3>
              <span
                className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                  plan.isActive
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'bg-gray-50 text-gray-500'
                }`}
              >
                {plan.isActive ? 'Activo' : 'Inactivo'}
              </span>
            </div>

            <p className="text-2xl font-mono font-semibold text-green-700 mb-3">
              ${plan.monthlyPrice.toLocaleString('es-AR')}
              <span className="text-sm font-normal text-gray-400">/mes</span>
            </p>

            {plan.annualDiscountPct > 0 && (
              <p className="text-xs font-medium text-amber-600 mb-3">
                {plan.annualDiscountPct}% desc. pago anual
              </p>
            )}

            {plan.features && plan.features.length > 0 && (
              <ul className="space-y-1 mb-3">
                {plan.features.map((f, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-1.5 text-xs text-gray-600"
                  >
                    <span className="text-green-600 mt-0.5 shrink-0">✓</span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            )}

            {isSuperAdmin() && (
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => openEdit(plan)}
                  className="flex-1 py-1.5 text-xs font-medium rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
                >
                  Editar
                </button>
                <button
                  onClick={() => setConfirmDeactivate(plan.id)}
                  disabled={deactivating === plan.id}
                  className="py-1.5 px-3 text-xs font-medium rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors cursor-pointer disabled:opacity-50"
                >
                  {deactivating === plan.id
                    ? '...'
                    : 'Desactivar'}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Recent memberships placeholder */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-sm font-semibold text-gray-900 mb-1">
          Membresías activas recientes
        </h2>
        <p className="text-xs text-gray-500 mb-4">
          Últimas suscripciones de profesionales a planes
        </p>
        <p className="text-sm text-gray-400 text-center py-8">
          Las membresías se consultan desde el detalle de cada profesional
        </p>
      </div>

      {/* Create / Edit modal */}
      {modalMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="fixed inset-0 bg-gray-900/40"
            onClick={closeModal}
          />
          <div className="relative bg-white rounded-2xl border border-gray-200 shadow-xl w-full max-w-md p-6 mx-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-gray-900">
              {modalMode === 'create' ? 'Crear plan' : 'Editar plan'}
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
                  placeholder="Ej: Profesional Plus"
                  className="w-full h-10 px-3 text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-green-700/40 focus:border-green-700"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1.5">
                  Precio mensual ($)
                </label>
                <input
                  type="number"
                  min="0"
                  value={form.monthlyPrice}
                  onChange={(e) =>
                    setForm({ ...form, monthlyPrice: e.target.value })
                  }
                  className="w-full h-10 px-3 text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-green-700/40 focus:border-green-700"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1.5">
                  Descuento anual (%)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={form.annualDiscountPct}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      annualDiscountPct: e.target.value,
                    })
                  }
                  className="w-full h-10 px-3 text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-green-700/40 focus:border-green-700"
                />
              </div>

              {modalMode === 'edit' && (
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-gray-900">
                    Activo
                  </label>
                  <button
                    onClick={() =>
                      setForm({ ...form, isActive: !form.isActive })
                    }
                    className={`relative w-10 h-5 rounded-full transition-colors cursor-pointer ${
                      form.isActive ? 'bg-green-600' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${
                        form.isActive ? 'left-5' : 'left-0.5'
                      }`}
                    />
                  </button>
                </div>
              )}

              {/* Features */}
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1.5">
                  Beneficios del plan
                </label>
                <div className="space-y-2 mb-2">
                  {form.features.map((f, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="flex-1 text-sm text-gray-700">
                        ✓ {f}
                      </span>
                      <button
                        onClick={() => removeFeature(i)}
                        className="text-red-500 text-xs cursor-pointer hover:text-red-700"
                      >
                        Eliminar
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newFeature}
                    onChange={(e) => setNewFeature(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addFeature();
                      }
                    }}
                    placeholder="Ej: Hasta 10 pedidos por mes"
                    className="flex-1 h-10 px-3 text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-green-700/40 focus:border-green-700"
                  />
                  <button
                    onClick={addFeature}
                    className="px-3 py-2 text-xs font-medium rounded-lg bg-green-700 text-white hover:bg-green-800 cursor-pointer"
                  >
                    Agregar
                  </button>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-100">
              <button
                onClick={closeModal}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-green-700 text-white hover:bg-green-800 disabled:opacity-50 cursor-pointer"
              >
                {saving
                  ? 'Guardando...'
                  : modalMode === 'create'
                    ? 'Crear plan'
                    : 'Guardar cambios'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm deactivate modal */}
      {confirmDeactivate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="fixed inset-0 bg-gray-900/40"
            onClick={() => setConfirmDeactivate(null)}
          />
          <div className="relative bg-white rounded-2xl border border-gray-200 shadow-xl w-full max-w-sm p-6 mx-4">
            <h3 className="text-lg font-semibold text-gray-900">
              Desactivar plan
            </h3>
            <p className="text-sm text-gray-600 mt-2">
              El plan se marcará como inactivo. No se eliminará de la base de
              datos. Las membresías existentes no se verán afectadas.
            </p>
            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-100">
              <button
                onClick={() => setConfirmDeactivate(null)}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDeactivate(confirmDeactivate)}
                disabled={deactivating === confirmDeactivate}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 cursor-pointer"
              >
                {deactivating === confirmDeactivate
                  ? 'Desactivando...'
                  : 'Desactivar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
