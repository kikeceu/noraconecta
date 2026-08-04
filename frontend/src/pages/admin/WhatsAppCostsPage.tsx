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
import { Loader2, Check } from 'lucide-react';
import {
  getWhatsAppCosts,
  getWhatsAppTemplates,
  updateWhatsAppTemplate,
} from '../../lib/admin-api';
import type {
  WhatsAppCosts,
  WhatsAppTemplate,
} from '../../types/admin';

type TemplateRow = {
  templateName: string;
  category: string;
  totalSent: number;
  totalCostUsd: number;
  unitCostUsd: number;
};

type SaveState = 'idle' | 'saving' | 'saved';

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysAgoStr(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function formatCostUsd(value: number): string {
  return `$${value.toFixed(4)} USD`;
}

export function WhatsAppCostsPage() {
  const [data, setData] = useState<WhatsAppCosts | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [from, setFrom] = useState<string>(() => daysAgoStr(30));
  const [to, setTo] = useState<string>(() => todayStr());
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [editingCost, setEditingCost] = useState<string | null>(null);
  const [saveStates, setSaveStates] = useState<Record<string, SaveState>>({});

  const fetchCosts = () => {
    setError(null);
    setData(null);
    getWhatsAppCosts({ from, to: `${to}T23:59:59` })
      .then((res) => setData(res.data))
      .catch((err: Error) => setError(err.message));
  };

  useEffect(() => {
    fetchCosts();
  }, [from, to]);

  useEffect(() => {
    getWhatsAppTemplates()
      .then((res) => setTemplates(res.data))
      .catch(() => setTemplates([]));
  }, []);

  const templateCatalog = new Map(
    templates.map((t) => [t.name, t]),
  );

  const rows: TemplateRow[] = (data?.templateUsage ?? [])
    .map((u) => {
      const catalogEntry = templateCatalog.get(u.templateName);
      return {
        templateName: u.templateName,
        category: u.category,
        totalSent: u.totalSent,
        totalCostUsd: u.totalCostUsd,
        unitCostUsd: catalogEntry?.costUsd ?? 0,
      };
    })
    .sort((a, b) => b.totalCostUsd - a.totalCostUsd);

  const totalTemplateSent = rows.reduce(
    (sum, r) => sum + r.totalSent,
    0,
  );
  const totalTemplateCost = rows.reduce(
    (sum, r) => sum + r.totalCostUsd,
    0,
  );

  const utilityRows = rows.filter((r) => r.category === 'utility');
  const marketingRows = rows.filter((r) => r.category === 'marketing');
  const utilityTotalSent = utilityRows.reduce(
    (sum, r) => sum + r.totalSent,
    0,
  );
  const utilityTotalCost = utilityRows.reduce(
    (sum, r) => sum + r.totalCostUsd,
    0,
  );
  const marketingTotalSent = marketingRows.reduce(
    (sum, r) => sum + r.totalSent,
    0,
  );
  const marketingTotalCost = marketingRows.reduce(
    (sum, r) => sum + r.totalCostUsd,
    0,
  );

  const handleCategoryChange = (templateName: string, category: string) => {
    setSaveStates((prev) => ({ ...prev, [templateName]: 'saving' }));
    setEditingCategory(null);
    updateWhatsAppTemplate(templateName, { category })
      .then(() => {
        setSaveStates((prev) => ({ ...prev, [templateName]: 'saved' }));
        setTimeout(() => {
          setSaveStates((prev) => ({ ...prev, [templateName]: 'idle' }));
        }, 2000);
        getWhatsAppTemplates()
          .then((res) => {
            setTemplates(res.data);
            fetchCosts();
          })
          .catch(() => {
            setSaveStates((prev) => ({ ...prev, [templateName]: 'saved' }));
            setTimeout(() => {
              setSaveStates((prev) => ({ ...prev, [templateName]: 'idle' }));
            }, 2000);
          });
      })
      .catch(() => {
        setSaveStates((prev) => ({ ...prev, [templateName]: 'idle' }));
      });
  };

  const handleCostChange = (
    templateName: string,
    costUsd: number,
  ) => {
    setSaveStates((prev) => ({ ...prev, [templateName]: 'saving' }));
    setEditingCost(null);
    updateWhatsAppTemplate(templateName, { costUsd })
      .then(() => {
        setSaveStates((prev) => ({ ...prev, [templateName]: 'saved' }));
        setTimeout(() => {
          setSaveStates((prev) => ({ ...prev, [templateName]: 'idle' }));
        }, 2000);
        getWhatsAppTemplates()
          .then((res) => {
            setTemplates(res.data);
            fetchCosts();
          })
          .catch(() => {
            setSaveStates((prev) => ({ ...prev, [templateName]: 'saved' }));
            setTimeout(() => {
              setSaveStates((prev) => ({ ...prev, [templateName]: 'idle' }));
            }, 2000);
          });
      })
      .catch(() => {
        setSaveStates((prev) => ({ ...prev, [templateName]: 'idle' }));
      });
  };

  const renderSaveIndicator = (key: string) => {
    const state = saveStates[key];
    if (state === 'saving') {
      return <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-400" />;
    }
    if (state === 'saved') {
      return <Check className="w-3.5 h-3.5 text-green-500" />;
    }
    return null;
  };

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
          <h1 className="text-2xl font-bold text-gray-900">
            Costos WhatsApp
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            Consumo y costo de mensajes WhatsApp
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

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 border-t-2 border-t-green-500 p-6">
          <p className="text-sm text-gray-600">Total templates enviados</p>
          <p className="text-2xl font-bold text-gray-900 mt-2">
            {totalTemplateSent.toLocaleString('es-AR')}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 border-t-2 border-t-green-500 p-6">
          <p className="text-sm text-gray-600">Costo total templates</p>
          <p className="text-2xl font-bold text-gray-900 mt-2">
            {formatCostUsd(totalTemplateCost)}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 border-t-2 border-t-green-500 p-6">
          <p className="text-sm text-gray-600">Conversaciones de servicio</p>
          <p className="text-2xl font-bold text-gray-900 mt-2">
            {data.serviceConversations.totalConversations.toLocaleString(
              'es-AR',
            )}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 border-t-2 border-t-green-500 p-6">
          <p className="text-sm text-gray-600">Costo total servicio</p>
          <p className="text-2xl font-bold text-gray-900 mt-2">
            {formatCostUsd(data.serviceConversations.totalCostUsd)}
          </p>
          {data.serviceConversations.totalCostUsd === 0 && (
            <p className="text-xs text-gray-400 mt-1">desde octubre 2026</p>
          )}
        </div>
        <div className="bg-white rounded-xl border border-gray-200 border-t-2 border-t-green-500 p-6">
          <p className="text-sm text-gray-600">Costo promedio por pedido</p>
          <p className="text-2xl font-bold text-gray-900 mt-2">
            {formatCostUsd(data.avgCostPerRequest)}
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
                tick={{ fontSize: 12, fill: '#6B7280' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: number) => `$${v.toFixed(2)}`}
                width={60}
              />
              <Tooltip
                formatter={(value, name) => {
                  const num = Number(value);
                  if (name === 'templateCostUsd')
                    return [formatCostUsd(num), 'Templates'];
                  return [formatCostUsd(num), 'Servicio'];
                }}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="templateCostUsd"
                name="Templates"
                stroke="#22C55E"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="serviceCostUsd"
                name="Servicio"
                stroke="#3B82F6"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 border-t-2 border-t-green-500 p-6">
          <h3 className="text-base font-semibold text-gray-900 mb-3">
            Categoría utility
          </h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Total envíos</span>
              <span className="font-medium text-gray-900">
                {utilityTotalSent.toLocaleString('es-AR')}
              </span>
            </div>
            <div className="flex justify-between border-t border-gray-100 pt-2">
              <span className="text-gray-600">Costo total</span>
              <span className="font-semibold text-green-600">
                {formatCostUsd(utilityTotalCost)}
              </span>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 border-t-2 border-t-orange-400 p-6">
          <h3 className="text-base font-semibold text-gray-900 mb-3">
            Categoría marketing
          </h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Total envíos</span>
              <span className="font-medium text-gray-900">
                {marketingTotalSent.toLocaleString('es-AR')}
              </span>
            </div>
            <div className="flex justify-between border-t border-gray-100 pt-2">
              <span className="text-gray-600">Costo total</span>
              <span className="font-semibold text-orange-600">
                {formatCostUsd(marketingTotalCost)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {rows.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-base font-semibold text-gray-900">
              Templates
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Template
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Categoría
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Envíos
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Costo unitario
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Costo total
                  </th>
                  <th className="w-8 px-3 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((row) => (
                  <tr key={row.templateName} className="hover:bg-gray-50">
                    <td className="px-6 py-4 font-medium text-gray-900 max-w-[280px] truncate">
                      {row.templateName}
                    </td>
                    <td className="px-6 py-4">
                      {editingCategory === row.templateName ? (
                        <select
                          value={row.category}
                          onChange={(e) =>
                            handleCategoryChange(
                              row.templateName,
                              e.target.value,
                            )
                          }
                          onBlur={() => setEditingCategory(null)}
                          autoFocus
                          className="border border-gray-300 rounded px-2 py-1 text-sm"
                        >
                          <option value="utility">utility</option>
                          <option value="marketing">marketing</option>
                          <option value="authentication">authentication</option>
                        </select>
                      ) : (
                        <button
                          onClick={() =>
                            setEditingCategory(row.templateName)
                          }
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold cursor-pointer ${
                            row.category === 'marketing'
                              ? 'bg-orange-100 text-orange-700'
                              : 'bg-green-100 text-green-700'
                          }`}
                        >
                          {row.category}
                        </button>
                      )}
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                      {row.totalSent.toLocaleString('es-AR')}
                    </td>
                    <td className="px-6 py-4">
                      {editingCost === row.templateName ? (
                        <input
                          type="number"
                          step="0.0001"
                          min="0"
                          defaultValue={row.unitCostUsd}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              handleCostChange(
                                row.templateName,
                                Number(e.currentTarget.value),
                              );
                            }
                            if (e.key === 'Escape') {
                              setEditingCost(null);
                            }
                          }}
                          onBlur={(e) => {
                            handleCostChange(
                              row.templateName,
                              Number(e.target.value),
                            );
                          }}
                          autoFocus
                          className="border border-gray-300 rounded px-2 py-1 text-sm w-24"
                        />
                      ) : (
                        <button
                          onClick={() => setEditingCost(row.templateName)}
                          className="text-gray-600 cursor-pointer hover:text-gray-900"
                        >
                          {formatCostUsd(row.unitCostUsd)}
                        </button>
                      )}
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                      {formatCostUsd(row.totalCostUsd)}
                    </td>
                    <td className="px-3 py-4">
                      {renderSaveIndicator(row.templateName)}
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
