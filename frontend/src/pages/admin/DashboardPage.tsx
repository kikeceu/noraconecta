import { useState, useEffect } from 'react';
import {
  TrendingDown,
  AlertCircle,
  UserCheck,
  ShoppingBag,
  Percent,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { getDashboardMetrics, getGeoTree } from '../../lib/admin-api';
import { brand } from '../../lib/brand';
import type { DashboardMetrics } from '../../types/admin';

const ORDER_STATUS_LABEL: Record<string, string> = {
  CREATED: 'Creado',
  ASSIGNED: 'Asignado',
  ACCEPTED: 'Aceptado',
  COMPLETED: 'Completado',
  CANCELLED: 'Cancelado',
  NO_RESPONSE: 'Sin respuesta',
  PENDING_CONFIRMATION: 'Pend. confirmación',
};

const PROFESSIONAL_STATUS_LABEL: Record<string, string> = {
  ACTIVE: 'Activo',
  PENDING: 'Pendiente',
  UNDER_REVIEW: 'En revisión',
  OBSERVATION: 'En observación',
  SUSPENDED: 'Suspendido',
  PAUSED: 'Pausado',
  REJECTED: 'Rechazado',
};

const PROFESSIONAL_STATUS_COLOR: Record<string, string> = {
  ACTIVE: '#0B6E4F',
  PENDING: '#EF9F27',
  UNDER_REVIEW: '#378ADD',
  OBSERVATION: '#888780',
  SUSPENDED: '#E24B4A',
  PAUSED: '#B4B2A9',
  REJECTED: '#F09595',
};

function formatDayMonth(dateText: string): string {
  const [year, month, day] = dateText.split('-');
  if (!year || !month || !day) {
    return dateText;
  }

  return `${day}/${month}`;
}

export function DashboardPage() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [range, setRange] = useState<7 | 15 | 30>(30);
  const [selectedProvince, setSelectedProvince] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [geoTree, setGeoTree] = useState<{
    provinces: { id: string; name: string; departments: { id: string; name: string }[] }[];
  }>({ provinces: [] });

  useEffect(() => {
    getGeoTree()
      .then((res) => setGeoTree(res.data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    setError('');
    getDashboardMetrics(selectedDepartment || undefined)
      .then((res) => {
        setMetrics(res.data);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Error al cargar métricas');
      })
      .finally(() => setLoading(false));
  }, [selectedDepartment]);

  const handleProvinceChange = (provinceId: string) => {
    setSelectedProvince(provinceId);
    setSelectedDepartment('');
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 w-48 bg-gray-200 rounded" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 bg-gray-100 rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-6">
          <div className="h-[220px] bg-gray-100 rounded-lg animate-pulse" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="h-[220px] bg-gray-100 rounded-lg animate-pulse" />
            <div className="h-[220px] bg-gray-100 rounded-lg animate-pulse" />
          </div>
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

  const ordersByStatusWithCount = metrics.ordersByStatus.filter(
    (item) => item.count > 0,
  );

  const professionalsTotal = metrics.professionalsByStatus.reduce(
    (total, item) => total + item.count,
    0,
  );

  const ordersLastDaysByRange = metrics.ordersLast30Days.slice(-range);

  const cards = [
    {
      label: 'Pedidos activos',
      value: metrics.orders.active,
      subtitle: `${metrics.orders.last24h} en las últimas 24h`,
      icon: ShoppingBag,
      trend: null,
      color: 'text-blue-600 bg-blue-50',
      borderColor: 'border-t-blue-500' 
    },
    {
      label: 'Tasa de aceptación',
      value: `${metrics.acceptanceRate}%`,
      subtitle: `Cobertura: ${metrics.coverageRate}%`,
      icon: Percent,
      trend: null,
      color: 'text-green-600 bg-green-50',
      borderColor: 'border-t-blue-500' 
    },
    {
      label: 'Profesionales pendientes',
      value: metrics.professionals.pending,
      subtitle: `${metrics.professionals.active} activos de ${metrics.professionals.total}`,
      icon: UserCheck,
      trend: metrics.professionals.pending > 0 ? 'warning' : null,
      color: 'text-amber-600 bg-amber-50',
      borderColor: 'border-t-blue-500' 
    },
    {
      label: 'Escaladas abiertas',
      value: metrics.escalations.open,
      subtitle: `${metrics.escalations.total} totales`,
      icon: AlertCircle,
      trend: metrics.escalations.open > 0 ? 'error' : 'good',
      color: 'text-red-600 bg-red-50',
      borderColor: 'border-t-blue-500' 
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-black text-gray-900 tracking-tighter">Dashboard</h1>
        <p className="text-sm text-gray-600 mt-1">
          Panel de métricas operativas de {brand.fullName}
        </p>
      </div>

      {/* Geographic filter */}
      <div className="flex items-center gap-3 flex-wrap">
        <select
          value={selectedProvince}
          onChange={(e) => handleProvinceChange(e.target.value)}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#0B6E4F] focus:border-transparent"
        >
          <option value="">Todas las provincias</option>
          {geoTree.provinces.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>

        {selectedProvince && (
          <select
            value={selectedDepartment}
            onChange={(e) => setSelectedDepartment(e.target.value)}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#0B6E4F] focus:border-transparent"
          >
            <option value="">Todos los departamentos</option>
            {geoTree.provinces
              .find((p) => p.id === selectedProvince)
              ?.departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
          </select>
        )}

        {(selectedProvince || selectedDepartment) && (
          <button
            onClick={() => {
              setSelectedProvince('');
              setSelectedDepartment('');
            }}
            className="text-xs text-[#6B7280] hover:text-[#111827] cursor-pointer"
          >
            Limpiar filtro
          </button>
        )}
      </div>

      {/* Metrics cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card) => (
          <div
            key={card.label}
            className={`bg-white rounded-xl border border-gray-200 p-6 hover:shadow-sm transition-shadow border-t-2 ${card.borderColor}`}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-600">{card.label}</p>
                <p className="text-6xl font-black text-gray-900 mt-3 tracking-tighter">
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
            <p className="text-sm text-gray-600 mt-4">{card.subtitle}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="mb-5 flex items-center justify-between gap-4">
            <h3 className="text-base font-semibold text-gray-900">
              {`Pedidos - últimos ${range} días`}
            </h3>
            <div className="flex items-center gap-2">
              {[7, 15, 30].map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setRange(option as 7 | 15 | 30)}
                  className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
                    range === option
                      ? 'border-green-700 text-green-700'
                      : 'border-gray-300 text-gray-500 hover:border-gray-400 hover:text-gray-700'
                  }`}
                >
                  {option}d
                </button>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={ordersLastDaysByRange} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis
                dataKey="date"
                tickFormatter={formatDayMonth}
                tick={{ fontSize: 12, fill: '#6B7280' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 12, fill: '#6B7280' }}
                axisLine={false}
                tickLine={false}
                width={30}
              />
              <Tooltip
                labelFormatter={(value) => formatDayMonth(String(value))}
                formatter={(value) => [value, 'Pedidos']}
              />
              <Line
                type="monotone"
                dataKey="count"
                stroke="#0B6E4F"
                strokeWidth={2.5}
                dot={{ r: 3, fill: '#0B6E4F' }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-base font-semibold text-gray-900 mb-5">
              Pedidos por estado
            </h3>
            {ordersByStatusWithCount.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart
                  data={ordersByStatusWithCount}
                  layout="vertical"
                  margin={{ top: 4, right: 8, left: 8, bottom: 4 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" horizontal={false} />
                  <XAxis
                    type="number"
                    allowDecimals={false}
                    tick={{ fontSize: 12, fill: '#6B7280' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="status"
                    tickFormatter={(status) => ORDER_STATUS_LABEL[status] ?? status}
                    tick={{ fontSize: 12, fill: '#4B5563' }}
                    axisLine={false}
                    tickLine={false}
                    width={120}
                  />
                  <Tooltip
                    labelFormatter={(status) => ORDER_STATUS_LABEL[String(status)] ?? String(status)}
                    formatter={(value) => [value, 'Pedidos']}
                  />
                  <Bar dataKey="count" fill="#0B6E4F" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[220px] rounded-lg bg-gray-50 flex items-center justify-center text-sm text-gray-500">
                Sin datos
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-base font-semibold text-gray-900 mb-5">
              Profesionales por estado
            </h3>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={metrics.professionalsByStatus}
                  dataKey="count"
                  nameKey="status"
                  innerRadius={60}
                  outerRadius={95}
                  paddingAngle={2}
                  stroke="#FFFFFF"
                  strokeWidth={2}
                >
                  {metrics.professionalsByStatus.map((item) => (
                    <Cell
                      key={item.status}
                      fill={PROFESSIONAL_STATUS_COLOR[item.status] ?? '#B4B2A9'}
                    />
                  ))}
                </Pie>
                <Tooltip
                  labelFormatter={(status) =>
                    PROFESSIONAL_STATUS_LABEL[String(status)] ?? String(status)
                  }
                  formatter={(value) => [value, 'Profesionales']}
                />
              </PieChart>
            </ResponsiveContainer>

            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
              {metrics.professionalsByStatus.map((item) => (
                <div
                  key={item.status}
                  className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-block w-2.5 h-2.5 rounded-full"
                      style={{
                        backgroundColor: PROFESSIONAL_STATUS_COLOR[item.status] ?? '#B4B2A9',
                      }}
                    />
                    <span className="text-sm text-gray-700">
                      {PROFESSIONAL_STATUS_LABEL[item.status] ?? item.status}
                    </span>
                  </div>
                  <span className="text-sm font-medium text-gray-900">{item.count}</span>
                </div>
              ))}
            </div>

            {professionalsTotal === 0 && (
              <p className="mt-3 text-xs text-gray-500">Sin datos para el periodo seleccionado.</p>
            )}
          </div>
        </div>
      </div>

      {/* Secondary metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Acceptance & satisfaction */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-base font-semibold text-gray-900 mb-5">
            Rendimiento
          </h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Tasa de aceptación</span>
              <span className="text-sm font-semibold text-gray-900">
                {metrics.acceptanceRate}%
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Tasa de cobertura</span>
              <span className="text-sm font-semibold text-gray-900">
                {metrics.coverageRate}%
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">
                Tiempo promedio de aceptación
              </span>
              <span className="text-sm font-semibold text-gray-900">
                {metrics.avgAcceptanceTimeMinutes
                  ? `${metrics.avgAcceptanceTimeMinutes} min`
                  : '—'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">% Recomendaría</span>
              <span className="text-sm font-semibold text-gray-900">
                {metrics.wouldRecommendPct}%
              </span>
            </div>
          </div>
        </div>

        {/* Professionals by status */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-base font-semibold text-gray-900 mb-5">
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
      <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${color} transition-all`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
