import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { getConfig, updateConfig } from '../../lib/admin-api';
import { brand } from '../../lib/brand';
import type { SystemConfig } from '../../types/admin';

interface ConfigGroup {
  title: string;
  description: string;
  keys: ConfigField[];
}

interface ConfigField {
  key: string;
  label: string;
  type: 'number' | 'toggle' | 'text';
  value: string;
}

const CONFIG_GROUPS: ConfigGroup[] = [
  {
    title: 'Matching: Pesos del algoritmo',
    description:
      'Pesos que determinan la importancia de cada factor en el score de recomendación. Deben sumar 1.0',
    keys: [
      { key: 'MATCHING_WEIGHT_COMPLIANCE', label: 'Peso: Cumplimiento', type: 'number', value: '' },
      { key: 'MATCHING_WEIGHT_RESPONSE_RATE', label: 'Peso: Tasa de respuesta', type: 'number', value: '' },
      { key: 'MATCHING_WEIGHT_QUALITY_RATING', label: 'Peso: Calificación de calidad', type: 'number', value: '' },
      { key: 'MATCHING_WEIGHT_RECOMMENDATION', label: 'Peso: Recomendación', type: 'number', value: '' },
      { key: 'MATCHING_WEIGHT_DISTRIBUTION', label: 'Peso: Distribución equitativa', type: 'number', value: '' },
      { key: 'MATCHING_WEIGHT_PLAN', label: 'Peso: Plan del profesional', type: 'number', value: '' },
    ],
  },
  {
    title: 'Matching: Penalizaciones y bonificaciones',
    description:
      'Valores que penalizan o bonifican el score según el comportamiento del profesional',
    keys: [
      { key: 'MATCHING_COMPLIANCE_PENALTY', label: 'Penalización por incumplimiento', type: 'number', value: '' },
      { key: 'MATCHING_RESPONSE_PENALTY', label: 'Penalización por no respuesta', type: 'number', value: '' },
      { key: 'MATCHING_REJECTION_PENALTY', label: 'Penalización por rechazo', type: 'number', value: '' },
      { key: 'MATCHING_BADGE_BONUS', label: 'Bonus por badge de excelencia', type: 'number', value: '' },
      { key: 'MATCHING_DISTRIBUTION_DAILY_BONUS', label: 'Bonus diario por distribución', type: 'number', value: '' },
      { key: 'MATCHING_TENDENCY_WEIGHT', label: 'Peso de tendencia de reputación', type: 'number', value: '' },
    ],
  },
  {
    title: 'Matching: Límites y timeouts',
    description: 'Reglas operativas del motor de matching',
    keys: [
      { key: 'MATCHING_MAX_ACTIVE_REQUESTS', label: 'Pedidos activos máximos por profesional', type: 'number', value: '' },
      { key: 'MATCHING_REPUTATION_DECAY_DAYS', label: 'Días de decay de penalizaciones', type: 'number', value: '' },
      { key: 'PROFESSIONAL_RESPONSE_TIMEOUT_HOURS', label: 'Timeout de respuesta del profesional (horas)', type: 'number', value: '' },
    ],
  },
  {
    title: 'Sistema general',
    description: 'Parámetros generales de la plataforma',
    keys: [
      { key: 'TRIAL_REQUESTS_LIMIT', label: 'Límite de pedidos en período de prueba', type: 'number', value: '' },
      { key: 'BADGE_MIN_COMPLETED_REQUESTS', label: 'Pedidos mínimos para badge de excelencia', type: 'number', value: '' },
    ],
  },
];

export function SettingsPage() {
  const [, setConfigs] = useState<SystemConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState<string | null>(null);
  const [editedValues, setEditedValues] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    getConfig()
      .then((res) => {
        setConfigs(res.data);
        const map = new Map<string, string>();
        res.data.forEach((c) => map.set(c.key, c.value));
        setEditedValues(map);
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : 'Error al cargar configuración'),
      )
      .finally(() => setLoading(false));
  }, []);

  const getValue = (key: string): string => {
    return editedValues.get(key) ?? '';
  };

  const setValue = (key: string, value: string) => {
    setEditedValues((prev) => new Map(prev).set(key, value));
  };

  const handleSave = async (key: string) => {
    const value = editedValues.get(key);
    if (value === undefined) return;
    setSaving(key);
    try {
      await updateConfig(key, value);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setSaving(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 w-64 bg-gray-200 rounded" />
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-48 bg-gray-100 rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-black text-gray-900 tracking-tighter">
          Configuración del sistema
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Parámetros generales de la plataforma {brand.fullName}
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm">
          {error}
        </div>
      )}

      {/* Config sections */}
      {CONFIG_GROUPS.map((group) => (
        <div
          key={group.title}
          className="bg-white rounded-xl border border-gray-200 p-6"
        >
          <h2 className="text-sm font-semibold text-gray-900">{group.title}</h2>
          <p className="text-xs text-gray-500 mt-0.5 mb-5">{group.description}</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {group.keys.map((field) => (
              <div key={field.key}>
                <label className="block text-sm font-medium text-gray-900 mb-1.5">
                  {field.label}
                </label>
                <div className="flex gap-2">
                  <input
                    type={field.type}
                    value={getValue(field.key)}
                    onChange={(e) => setValue(field.key, e.target.value)}
                    className="flex-1 h-10 px-3 text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-green-700/40 focus:border-green-700"
                  />
                  <button
                    onClick={() => handleSave(field.key)}
                    disabled={saving === field.key}
                    className="px-3 py-2 text-xs font-medium rounded-lg bg-green-700 text-white hover:bg-green-800 disabled:opacity-50 transition-colors whitespace-nowrap cursor-pointer"
                  >
                    {saving === field.key ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      'Guardar'
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
