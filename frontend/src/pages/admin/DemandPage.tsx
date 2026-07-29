import { useEffect, useState } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts';
import { AlertTriangle } from 'lucide-react';
import { getDemandInsights } from '../../lib/admin-api';
import type { DemandInsights } from '../../types/admin';

export function DemandPage() {
  const [data, setData] = useState<DemandInsights | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getDemandInsights()
      .then((res) => setData(res.data))
      .catch((err: Error) => setError(err.message));
  }, []);

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
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Demanda sin cobertura</h1>
        <p className="text-sm text-gray-600 mt-1">
          Servicios solicitados sin profesionales disponibles
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 border-t-2 border-t-orange-400 p-6">
          <p className="text-sm text-gray-600">Total pedidos sin cubrir</p>
          <p className="text-4xl font-bold text-gray-900 mt-2">{data.total}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 border-t-2 border-t-orange-400 p-6">
          <p className="text-sm text-gray-600">Categorías afectadas</p>
          <p className="text-4xl font-bold text-gray-900 mt-2">{data.totalCategories}</p>
        </div>
      </div>

      {data.byCategory.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-500">
          <AlertTriangle className="w-8 h-8 mx-auto mb-3 text-gray-300" />
          No hay demanda sin cobertura registrada.
        </div>
      ) : (
        <>
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-base font-semibold text-gray-900 mb-5">
              Top categorías con más demanda insatisfecha
            </h3>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart
                data={data.byCategory.slice(0, 10)}
                margin={{ top: 8, right: 8, left: 0, bottom: 50 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
                <XAxis
                  dataKey="categoryName"
                  tick={{ fontSize: 11, fill: '#6B7280' }}
                  interval={0}
                  angle={-20}
                  textAnchor="end"
                  height={50}
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
                  formatter={(value) => [value, 'Pedidos sin cubrir']}
                  labelFormatter={(label, payload) => {
                    const item = payload?.[0]?.payload as
                      | { geoNodeName?: string }
                      | undefined;
                    return item?.geoNodeName
                      ? `${label} en ${item.geoNodeName}`
                      : String(label);
                  }}
                />
                <Bar dataKey="count" fill="#F97316" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Categoría
                    </th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Zona
                    </th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Pedidos
                    </th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Última solicitud
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.byCategory.map((item, index) => (
                    <tr
                      key={`${item.categoryName}-${item.geoNodeName}-${index}`}
                      className="hover:bg-gray-50"
                    >
                      <td className="px-6 py-4 font-medium text-gray-900">
                        {item.categoryName}
                      </td>
                      <td className="px-6 py-4 text-gray-600">{item.geoNodeName}</td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-semibold text-orange-700">
                          {item.count}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-500">
                        {item.lastDate
                          ? new Date(item.lastDate).toLocaleDateString('es-AR')
                          : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
