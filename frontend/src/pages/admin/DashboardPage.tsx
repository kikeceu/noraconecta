import { useState, useEffect } from 'react';
import {
  TrendingDown,
  AlertCircle,
  UserCheck,
  ShoppingBag,
  Percent,
} from 'lucide-react';
import { getDashboardMetrics } from '../../lib/admin-api';
import type { DashboardMetrics } from '../../types/admin';

export function DashboardPage() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    getDashboardMetrics()
      .then((res) => {
        setMetrics(res.data);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Error al cargar métricas');
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 w-48 bg-gray-200 rounded" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 bg-gray-100 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm">
        {error}
      </div>
    );
  }

  if (!metrics) return null;

  const cards = [
    {
      label: 'Pedidos activos',
      value: metrics.orders.active,
      subtitle: `${metrics.orders.last24h} en las últimas 24h`,
      icon: ShoppingBag,
      trend: null,
      color: 'text-blue-600 bg-blue-50',
    },
    {
      label: 'Tasa de aceptación',
      value: `${metrics.acceptanceRate}%`,
      subtitle: `Cobertura: ${metrics.coverageRate}%`,
      icon: Percent,
      trend: null,
      color: 'text-green-600 bg-green-50',
    },
    {
      label: 'Profesionales pendientes',
      value: metrics.professionals.pending,
      subtitle: `${metrics.professionals.active} activos de ${metrics.professionals.total}`,
      icon: UserCheck,
      trend: metrics.professionals.pending > 0 ? 'warning' : null,
      color: 'text-amber-600 bg-amber-50',
    },
    {
      label: 'Escaladas abiertas',
      value: metrics.escalations.open,
      subtitle: `${metrics.escalations.total} totales`,
      icon: AlertCircle,
      trend: metrics.escalations.open > 0 ? 'error' : 'good',
      color: 'text-red-600 bg-red-50',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">
          Panel de métricas operativas de NORA
        </p>
      </div>

      {/* Metrics cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card) => (
          <div
            key={card.label}
            className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-sm transition-shadow"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-500">{card.label}</p>
                <p className="text-2xl font-mono font-medium text-gray-900 mt-1">
                  {card.value}
                </p>
                {card.trend === 'warning' && (
                  <div className="flex items-center gap-1 mt-1.5 text-xs text-amber-600">
                    <AlertCircle className="w-3 h-3" />
                    Requieren atención
                  </div>
                )}
                {card.trend === 'error' && (
                  <div className="flex items-center gap-1 mt-1.5 text-xs text-red-600">
                    <AlertCircle className="w-3 h-3" />
                    Urgente
                  </div>
                )}
                {card.trend === 'good' && (
                  <div className="flex items-center gap-1 mt-1.5 text-xs text-green-600">
                    <TrendingDown className="w-3 h-3" />
                    Todo resuelto
                  </div>
                )}
              </div>
              <div className={`p-2.5 rounded-lg ${card.color}`}>
                <card.icon className="w-5 h-5" />
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-3">{card.subtitle}</p>
          </div>
        ))}
      </div>

      {/* Secondary metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Acceptance & satisfaction */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">
            Rendimiento
          </h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">Tasa de aceptación</span>
              <span className="text-sm font-mono font-medium text-gray-900">
                {metrics.acceptanceRate}%
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">Tasa de cobertura</span>
              <span className="text-sm font-mono font-medium text-gray-900">
                {metrics.coverageRate}%
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">
                Tiempo promedio de aceptación
              </span>
              <span className="text-sm font-mono font-medium text-gray-900">
                {metrics.avgAcceptanceTimeMinutes
                  ? `${metrics.avgAcceptanceTimeMinutes} min`
                  : '—'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">% Recomendaría</span>
              <span className="text-sm font-mono font-medium text-gray-900">
                {metrics.wouldRecommendPct}%
              </span>
            </div>
          </div>
        </div>

        {/* Professionals by status */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">
            Profesionales por estado
          </h3>
          <div className="space-y-3">
            <StatusBar
              label="Activos"
              count={metrics.professionals.active}
              total={metrics.professionals.total}
              color="bg-green-600"
            />
            <StatusBar
              label="Pendientes"
              count={metrics.professionals.pending}
              total={metrics.professionals.total}
              color="bg-amber-500"
            />
            <StatusBar
              label="Suspendidos"
              count={metrics.professionals.suspended}
              total={metrics.professionals.total}
              color="bg-red-500"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusBar({
  label,
  count,
  total,
  color,
}: {
  label: string;
  count: number;
  total: number;
  color: string;
}) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-gray-600">{label}</span>
        <span className="font-mono font-medium text-gray-900">{count}</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${color} transition-all`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
