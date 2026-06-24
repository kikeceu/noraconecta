import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { getMembershipDiscountConfig, setMembershipDiscount } from '../../lib/admin-api';

export function PromotionsPage() {
  const [discount, setDiscount] = useState<{
    active: boolean;
    discountPct: number;
    expiresAt: string | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [discountPct, setDiscountPct] = useState('');
  const [durationHours, setDurationHours] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    getMembershipDiscountConfig()
      .then((res) => {
        setDiscount(res.data);
        if (res.data.discountPct) setDiscountPct(String(res.data.discountPct));
      })
      .catch(() => setError('Error al cargar la promoción'))
      .finally(() => setLoading(false));
  }, []);

  const handleActivate = async () => {
    const pct = parseInt(discountPct, 10);
    const hours = parseInt(durationHours, 10);
    if (!pct || pct < 1 || pct > 100) { setError('El porcentaje debe ser entre 1 y 100'); return; }
    if (!hours || hours < 1) { setError('La duración debe ser al menos 1 hora'); return; }
    setSaving(true); setError('');
    try {
      await setMembershipDiscount({ active: true, discountPct: pct, durationHours: hours });
      const res = await getMembershipDiscountConfig();
      setDiscount(res.data);
      setDurationHours('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al activar');
    } finally { setSaving(false); }
  };

  const handleDeactivate = async () => {
    setSaving(true); setError('');
    try {
      await setMembershipDiscount({ active: false });
      const res = await getMembershipDiscountConfig();
      setDiscount(res.data);
      setDiscountPct('');
      setDurationHours('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al desactivar');
    } finally { setSaving(false); }
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 w-64 bg-gray-200 rounded" />
        <div className="h-48 bg-gray-100 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-black text-gray-900 tracking-tighter">Promociones</h1>
        <p className="text-sm text-gray-500 mt-1">
          Activá descuentos por tiempo limitado para incentivar la contratación de membresías.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm">
          {error}
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-sm font-semibold text-gray-900">Descuento en membresía</h2>
        <p className="text-xs text-gray-500 mt-0.5 mb-5">
          Solo puede haber una promoción activa a la vez. Al activar una nueva, la anterior se reemplaza automáticamente.
        </p>

        {/* Estado actual */}
        {discount && (
          <div className={`mb-6 px-4 py-3 rounded-lg text-sm font-medium ${
            discount.active
              ? 'bg-green-50 text-green-700 border border-green-200'
              : 'bg-gray-50 text-gray-500 border border-gray-200'
          }`}>
            {discount.active && discount.expiresAt
              ? `✅ Promo activa — ${discount.discountPct}% OFF — vence el ${new Date(discount.expiresAt).toLocaleString('es-AR')}`
              : '⚪ Sin promoción activa'}
          </div>
        )}

        {discount?.active ? (
          /* Promo activa — solo mostrar botón desactivar */
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Para modificar la promoción, primero desactivá la actual y luego activá una nueva.
            </p>
            <button
              onClick={handleDeactivate}
              disabled={saving}
              className="px-4 py-2 text-sm font-medium rounded-lg border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50 transition-colors cursor-pointer"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin inline" /> : 'Desactivar promoción activa'}
            </button>
          </div>
        ) : (
          /* Sin promo activa — mostrar formulario */
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1.5">
                  Porcentaje de descuento (%)
                </label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={discountPct}
                  onChange={(e) => setDiscountPct(e.target.value)}
                  placeholder="Ej: 20"
                  className="w-full h-10 px-3 text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-green-700/40 focus:border-green-700"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1.5">
                  Duración (horas)
                </label>
                <input
                  type="number"
                  min="1"
                  value={durationHours}
                  onChange={(e) => setDurationHours(e.target.value)}
                  placeholder="Ej: 48"
                  className="w-full h-10 px-3 text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-green-700/40 focus:border-green-700"
                />
              </div>
            </div>
            <button
              onClick={handleActivate}
              disabled={saving}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-green-700 text-white hover:bg-green-800 disabled:opacity-50 transition-colors cursor-pointer"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin inline" /> : 'Activar promoción'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
