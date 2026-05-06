import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { getConfig, updateConfig } from '../../lib/admin-api';
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
    title: 'Parámetros de Matching',
    description:
      'Configuración del algoritmo de asignación de profesionales a pedidos',
    keys: [
      { key: 'MATCHING_RADIUS_KM', label: 'Radio máximo de búsqueda (km)', type: 'number', value: '' },
      { key: 'MATCHING_RESPONSE_TIMEOUT_MIN', label: 'Tiempo máximo de respuesta (minutos)', type: 'number', value: '' },
      { key: 'MATCHING_MAX_PROFESSIONALS', label: 'Cantidad máxima de profesionales a notificar', type: 'number', value: '' },
      { key: 'MATCHING_REJECTION_PENALTY_PCT', label: 'Penalización por rechazo (% reducción score)', type: 'number', value: '' },
    ],
  },
  {
    title: 'Límites y restricciones',
    description: 'Reglas operativas para profesionales',
    keys: [
      { key: 'MAX_ACTIVE_REQUESTS_PER_PROFESSIONAL', label: 'Pedidos activos máximos por profesional', type: 'number', value: '' },
      { key: 'MAX_ESCALATIONS_BEFORE_SUSPENSION', label: 'Escaladas máximas antes de suspensión', type: 'number', value: '' },
      { key: 'MIN_RATING_FOR_REQUESTS', label: 'Calificación mínima para recibir pedidos', type: 'number', value: '' },
      { key: 'INACTIVITY_DAYS_THRESHOLD', label: 'Días de inactividad para marcar como inactivo', type: 'number', value: '' },
    ],
  },
  {
    title: 'Integraciones',
    description: 'Credenciales de servicios externos',
    keys: [
      { key: 'WHATSAPP_API_KEY', label: 'WhatsApp API Key', type: 'text', value: '' },
      { key: 'AWS_S3_BUCKET', label: 'AWS S3 Bucket', type: 'text', value: '' },
    ],
  },
];

const TOGGLE_KEYS = [
  { key: 'NOTIFY_WHATSAPP_NEW_REQUEST', label: 'Notificar nuevo pedido por WhatsApp' },
  { key: 'NOTIFY_EMAIL_NEW_REQUEST', label: 'Notificar nuevo pedido por email' },
  { key: 'NOTIFY_ESCALATION_ADMINS', label: 'Notificar escalada a administradores' },
  { key: 'NOTIFY_REMINDER_PENDING', label: 'Recordatorio de pedido pendiente' },
  { key: 'NOTIFY_DAILY_SUMMARY', label: 'Resumen diario de actividad' },
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
        <h1 className="text-2xl font-semibold text-gray-900">
          Configuración del sistema
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Parámetros generales de la plataforma NORA
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

      {/* Notification toggles */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-1">
          Notificaciones
        </h2>
        <p className="text-xs text-gray-500 mb-5">
          Control de notificaciones automáticas
        </p>

        <div className="space-y-3">
          {TOGGLE_KEYS.map((t) => {
            const isOn = getValue(t.key) === 'true';
            return (
              <div
                key={t.key}
                className="flex items-center justify-between py-2"
              >
                <span className="text-sm text-gray-700">{t.label}</span>
                <button
                  onClick={() => {
                    const newVal = isOn ? 'false' : 'true';
                    setValue(t.key, newVal);
                    handleSave(t.key);
                  }}
                  disabled={saving === t.key}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer ${
                    isOn ? 'bg-green-600' : 'bg-gray-200'
                  } disabled:opacity-50`}
                >
                  {saving === t.key ? (
                    <Loader2 className="w-3 h-3 text-white animate-spin ml-1" />
                  ) : (
                    <span
                      className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
                        isOn ? 'translate-x-[18px]' : 'translate-x-[3px]'
                      }`}
                    />
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
