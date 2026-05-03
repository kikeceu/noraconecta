import { useState, useEffect } from 'react';
import { getPlans, updatePlan } from '../../lib/admin-api';
import { useAuth } from '../../context/AuthContext';
import type { Plan } from '../../types/admin';

const PLAN_COLORS: Record<string, string> = {
  Básico: 'bg-gray-50',
  Profesional: 'bg-amber-50',
  Premium: 'bg-emerald-50',
};

export function PlansPage() {
  const { isSuperAdmin } = useAuth();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editPlan, setEditPlan] = useState<Plan | null>(null);
  const [editForm, setEditForm] = useState({ monthlyPrice: '', annualDiscountPct: '' });
  const [editLoading, setEditLoading] = useState(false);

  useEffect(() => {
    getPlans()
      .then((res) => setPlans(res.data))
      .catch((err) => setError(err instanceof Error ? err.message : 'Error al cargar'))
      .finally(() => setLoading(false));
  }, []);

  const openEdit = (plan: Plan) => {
    setEditPlan(plan);
    setEditForm({
      monthlyPrice: String(plan.monthlyPrice),
      annualDiscountPct: String(plan.annualDiscountPct),
    });
  };

  const handleSave = async () => {
    if (!editPlan) return;
    setEditLoading(true);
    try {
      await updatePlan(editPlan.id, {
        monthlyPrice: Number(editForm.monthlyPrice),
        annualDiscountPct: Number(editForm.annualDiscountPct),
      });
      const res = await getPlans();
      setPlans(res.data);
      setEditPlan(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al actualizar');
    } finally {
      setEditLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 w-48 bg-gray-200 rounded" />
        <div className="grid grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-48 bg-gray-100 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Planes</h1>
        <p className="text-sm text-gray-500 mt-1">
          Configuración de planes de suscripción para profesionales
        </p>
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

            {isSuperAdmin() && (
              <button
                onClick={() => openEdit(plan)}
                className="mt-3 w-full py-1.5 text-xs font-medium rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Editar precio
              </button>
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

      {/* Edit plan modal */}
      {editPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="fixed inset-0 bg-gray-900/40"
            onClick={() => setEditPlan(null)}
          />
          <div className="relative bg-white rounded-2xl border border-gray-200 shadow-xl w-full max-w-sm p-6 mx-4">
            <h3 className="text-lg font-semibold text-gray-900">
              Editar plan — {editPlan.name}
            </h3>

            <div className="mt-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1.5">
                  Precio mensual ($)
                </label>
                <input
                  type="number"
                  min="0"
                  value={editForm.monthlyPrice}
                  onChange={(e) =>
                    setEditForm({ ...editForm, monthlyPrice: e.target.value })
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
                  value={editForm.annualDiscountPct}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      annualDiscountPct: e.target.value,
                    })
                  }
                  className="w-full h-10 px-3 text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-green-700/40 focus:border-green-700"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-100">
              <button
                onClick={() => setEditPlan(null)}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={editLoading}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-green-700 text-white hover:bg-green-800 disabled:opacity-50"
              >
                {editLoading ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
