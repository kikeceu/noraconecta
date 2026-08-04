import { useEffect, useState } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from 'recharts';
import { getLLMCosts } from '../../lib/admin-api';
import type { LLMCosts } from '../../types/admin';

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysAgoStr(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function formatCostUsd(value: number): string {
  return `$${value.toFixed(6)} USD`;
}

function pctOf(value: number, total: number): string {
  if (!total) return '0%';
  return `${((value / total) * 100).toFixed(1)}%`;
}

function costBadge(cost: number): string {
  if (cost < 0.001) {
    return 'bg-green-100 text-green-700';
  }
  if (cost < 0.01) {
    return 'bg-yellow-100 text-yellow-700';
  }
  return 'bg-red-100 text-red-700';
}

export function LLMCostsPage() {
  const [data, setData] = useState<LLMCosts | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [from, setFrom] = useState<string>(() => daysAgoStr(30));
  const [to, setTo] = useState<string>(() => todayStr());

  useEffect(() => {
    setError(null);
    setData(null);
    getLLMCosts({ from, to: `${to}T23:59:59` })
      .then((res) => setData(res.data))
      .catch((err: Error) => setError(err.message));
  }, [from, to]);

  const totalCalls = data
    ? data.byModel.reduce((sum, m) => sum + m.totalCalls, 0)
    : 0;

  const periodDays = Math.max(
    1,
    Math.round(
      (new Date(to).getTime() - new Date(from).getTime()) /
        (1000 * 60 * 60 * 24),
    ),
  );
  const monthlyProjection = data
    ? (data.totalCost / periodDays) * 30
    : 0;

  const sortedByPromptKey = data
    ? [...data.byPromptKey].sort(
        (a, b) => b.totalCostUsd - a.totalCostUsd,
      )
    : [];

  const sortedByModel = data
    ? [...data.byModel].sort(
        (a, b) => b.totalCostUsd - a.totalCostUsd,
      )
    : [];

  if (error) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-red-500">
        {error}
      </div>
    );
  }

  if (!data) {
    return <div className="p-8 text-gray-500">Cargando...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Costos LLM</h1>
          <p className="text-sm text-gray-600 mt-1">
            Consumo y costo de llamadas a modelos de lenguaje
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">Desde</label>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
          />
          <label className="text-sm text-gray-600">Hasta</label>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 border-t-2 border-t-indigo-500 p-6">
          <p className="text-sm text-gray-600">Costo total</p>
          <p className="text-2xl font-bold text-gray-900 mt-2">
            {formatCostUsd(data.totalCost)}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 border-t-2 border-t-indigo-500 p-6">
          <p className="text-sm text-gray-600">Costo promedio por pedido</p>
          <p className="text-2xl font-bold text-gray-900 mt-2">
            {formatCostUsd(data.avgCostPerRequest)}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 border-t-2 border-t-indigo-500 p-6">
          <p className="text-sm text-gray-600">Total llamadas</p>
          <p className="text-2xl font-bold text-gray-900 mt-2">
            {totalCalls.toLocaleString('es-AR')}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 border-t-2 border-t-indigo-500 p-6">
          <p className="text-sm text-gray-600">Proyección mensual</p>
          <p className="text-2xl font-bold text-gray-900 mt-2">
            {formatCostUsd(monthlyProjection)}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Basado en {periodDays} días
          </p>
        </div>
      </div>

      {data.costsByDay.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-base font-semibold text-gray-900 mb-5">
            Tendencia diaria
          </h3>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart
              data={data.costsByDay}
              margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#E5E7EB"
                vertical={false}
              />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: '#6B7280' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                yAxisId="left"
                tick={{ fontSize: 12, fill: '#6B7280' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: number) => `$${v.toFixed(4)}`}
                width={70}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fontSize: 12, fill: '#6B7280' }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
                width={30}
              />
              <Tooltip
                formatter={(value, name) => {
                  const num = Number(value);
                  if (name === 'totalCostUsd') return [formatCostUsd(num), 'Costo USD'];
                  return [num, 'Llamadas'] as [number, string];
                }}
              />
              <Legend />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="totalCostUsd"
                name="Costo USD"
                stroke="#6366F1"
                strokeWidth={2}
                dot={false}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="totalCalls"
                name="Llamadas"
                stroke="#F97316"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-base font-semibold text-gray-900 mb-3">
            Asociadas a pedidos
          </h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Llamadas</span>
              <span className="font-medium text-gray-900">
                {data.associationBreakdown.associated.totalCalls.toLocaleString(
                  'es-AR',
                )}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Costo</span>
              <span className="font-medium text-gray-900">
                {formatCostUsd(data.associationBreakdown.associated.totalCostUsd)}
              </span>
            </div>
            <div className="flex justify-between border-t border-gray-100 pt-2">
              <span className="text-gray-600">% del total</span>
              <span className="font-semibold text-indigo-600">
                {pctOf(
                  data.associationBreakdown.associated.totalCostUsd,
                  data.totalCost,
                )}
              </span>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-base font-semibold text-gray-900 mb-3">
            Llamadas generales
          </h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Llamadas</span>
              <span className="font-medium text-gray-900">
                {data.associationBreakdown.general.totalCalls.toLocaleString(
                  'es-AR',
                )}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Costo</span>
              <span className="font-medium text-gray-900">
                {formatCostUsd(data.associationBreakdown.general.totalCostUsd)}
              </span>
            </div>
            <div className="flex justify-between border-t border-gray-100 pt-2">
              <span className="text-gray-600">% del total</span>
              <span className="font-semibold text-gray-600">
                {pctOf(
                  data.associationBreakdown.general.totalCostUsd,
                  data.totalCost,
                )}
              </span>
            </div>
          </div>
        </div>
      </div>

      {sortedByPromptKey.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-base font-semibold text-gray-900">
              Por prompt key
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Prompt Key
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Llamadas
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Tokens input
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Tokens output
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Costo total
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Latencia prom. (ms)
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sortedByPromptKey.map((item) => (
                  <tr key={item.key} className="hover:bg-gray-50">
                    <td className="px-6 py-4 font-medium text-gray-900">
                      {item.key}
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                      {item.totalCalls.toLocaleString('es-AR')}
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                      {item.totalInputTokens.toLocaleString('es-AR')}
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                      {item.totalOutputTokens.toLocaleString('es-AR')}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${costBadge(item.totalCostUsd)}`}
                      >
                        {formatCostUsd(item.totalCostUsd)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-500">
                      {item.avgDurationMs != null
                        ? `${Math.round(item.avgDurationMs)}`
                        : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {sortedByModel.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-base font-semibold text-gray-900">
              Por modelo
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Modelo
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Llamadas
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Costo total
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    % del total
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sortedByModel.map((item) => (
                  <tr key={item.key} className="hover:bg-gray-50">
                    <td className="px-6 py-4 font-medium text-gray-900">
                      {item.key}
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                      {item.totalCalls.toLocaleString('es-AR')}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${costBadge(item.totalCostUsd)}`}
                      >
                        {formatCostUsd(item.totalCostUsd)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                      {pctOf(item.totalCostUsd, data.totalCost)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
