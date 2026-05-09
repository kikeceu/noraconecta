import { useEffect, useState } from 'react';
import { CheckCircle, Star, ThumbsUp, Shield } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
} from 'recharts';
import type { PanelData, PanelTab, WeeklyActivityItem, RatingEvolutionItem } from '../../../types/panel';
import { getPanelStats } from '../../../lib/panel-api';
import { PanelCard } from './PanelCard';

interface ProfessionalDashboardProps {
  data: PanelData;
  onTabChange: (tab: PanelTab) => void;
  sessionToken: string;
}

function MetricCard({
  icon: Icon,
  value,
  label,
  color = '#0B6E4F',
}: {
  icon: typeof CheckCircle;
  value: string;
  label: string;
  color?: string;
}) {
  return (
    <PanelCard>
      <div className="flex flex-col items-start gap-2">
        <div
          className="flex items-center justify-center w-10 h-10 rounded-full shrink-0"
          style={{ backgroundColor: `${color}13` }}
        >
          <Icon className="w-6 h-6" style={{ color }} />
        </div>
        <div className="min-w-0 w-full">
          <p
            className="text-3xl lg:text-4xl font-bold text-[#111827]"
            style={{ fontFamily: 'JetBrains Mono' }}
          >
            {value}
          </p>
          <p
            className="text-xs font-semibold uppercase tracking-widest text-[#6B7280] mt-1"
            style={{ fontFamily: 'DM Sans' }}
          >
            {label}
          </p>
        </div>
      </div>
    </PanelCard>
  );
}

function ProgressBar({ value }: { value: number }) {
  const pct = Math.min(100, Math.max(0, (value / 5) * 100));
  return (
    <div className="w-full h-2 bg-[#F3F4F6] rounded-full overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{ width: `${pct}%`, backgroundColor: '#0B6E4F' }}
      />
    </div>
  );
}

function RatingBreakdown({
  punctuality,
  quality,
  communication,
  priceFairness,
}: {
  punctuality: number;
  quality: number;
  communication: number;
  priceFairness: number;
}) {
  const items = [
    { label: 'Puntualidad', value: punctuality },
    { label: 'Calidad', value: quality },
    { label: 'Comunicación', value: communication },
    { label: 'Precio justo', value: priceFairness },
  ];

  return (
    <PanelCard>
      <h3
        className="text-lg font-semibold text-[#111827] mb-4"
        style={{ fontFamily: 'DM Sans' }}
      >
        Desglose de calificaciones
      </h3>
      <div className="space-y-4">
        {items.map((item) => (
          <div key={item.label} className="flex items-center gap-3">
            <span
              className="w-24 text-xs text-[#6B7280] shrink-0"
              style={{ fontFamily: 'DM Sans' }}
            >
              {item.label}
            </span>
            <ProgressBar value={item.value} />
            <span
              className="w-8 text-right text-sm font-bold text-[#111827] shrink-0"
              style={{ fontFamily: 'JetBrains Mono' }}
            >
              {item.value.toFixed(1)}
            </span>
          </div>
        ))}
      </div>
    </PanelCard>
  );
}

function formatShortDate(dateStr: string): string {
  const parts = dateStr.split('-');
  return `${parts[2]}/${parts[1]}`;
}

function ActivityCharts({ sessionToken }: { sessionToken: string }) {
  const [rangeDays, setRangeDays] = useState<7 | 30 | 90>(7);
  const [weeklyActivity, setWeeklyActivity] = useState<WeeklyActivityItem[] | null>(null);
  const [ratingEvolution, setRatingEvolution] = useState<RatingEvolutionItem[] | null>(null);
  const [weekCount, setWeekCount] = useState(8);

  useEffect(() => {
    setWeeklyActivity(null);
    setRatingEvolution(null);

    getPanelStats(sessionToken, rangeDays)
      .then((res) => {
        setWeeklyActivity(res.data.weeklyActivity);
        setRatingEvolution(res.data.ratingEvolution);
        setWeekCount(res.data.weekCount);
      })
      .catch(() => {});
  }, [sessionToken, rangeDays]);

  const RANGE_OPTIONS: { label: string; value: 7 | 30 | 90 }[] = [
    { label: '7 días', value: 7 },
    { label: '30 días', value: 30 },
    { label: '90 días', value: 90 },
  ];

  if (!weeklyActivity || !ratingEvolution) {
    return (
      <>
        <div className="space-y-6">
          <div className="flex items-center gap-2">
            {RANGE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setRangeDays(opt.value)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                  rangeDays === opt.value
                    ? 'bg-[#0B6E4F] text-white'
                    : 'bg-[#F3F4F6] text-[#374151] hover:bg-[#E5E7EB]'
                }`}
                style={{ fontFamily: 'DM Sans' }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        <div className="h-[228px] animate-pulse rounded-2xl bg-[#F3F4F6]" />
        <div className="h-[228px] animate-pulse rounded-2xl bg-[#F3F4F6]" />
      </>
    );
  }

  return (
    <>
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          {RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setRangeDays(opt.value)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                rangeDays === opt.value
                  ? 'bg-[#0B6E4F] text-white'
                  : 'bg-[#F3F4F6] text-[#374151] hover:bg-[#E5E7EB]'
              }`}
              style={{ fontFamily: 'DM Sans' }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <PanelCard>
        <h3 className="text-sm font-semibold uppercase tracking-widest text-[#6B7280] mb-4">
          Actividad — últimos {rangeDays} días
        </h3>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={weeklyActivity}>
            <XAxis dataKey="date" tickFormatter={formatShortDate} tick={{ fontSize: 11 }} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={24} />
            <Tooltip />
            <Bar dataKey="completed" name="Completados" fill="#0B6E4F" radius={[4, 4, 0, 0]} />
            <Bar dataKey="cancelled" name="Cancelados" fill="#DC2626" radius={[4, 4, 0, 0]} />
            <Bar dataKey="notFulfilled" name="No cumplidos" fill="#D97706" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </PanelCard>

      <PanelCard>
        <h3 className="text-sm font-semibold uppercase tracking-widest text-[#6B7280] mb-4">
          Calificación promedio — últimas {weekCount} semanas
        </h3>
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={ratingEvolution}>
            <XAxis dataKey="weekLabel" tick={{ fontSize: 11 }} />
            <YAxis domain={[0, 5]} ticks={[0, 1, 2, 3, 4, 5]} tick={{ fontSize: 11 }} width={24} />
            <Tooltip />
            <Line
              type="monotone"
              dataKey="averageRating"
              name="Calificación"
              stroke="#0B6E4F"
              strokeWidth={2}
              dot={{ r: 4, fill: '#0B6E4F' }}
              connectNulls={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </PanelCard>
    </>
  );
}

export function ProfessionalDashboard({ data, onTabChange, sessionToken }: ProfessionalDashboardProps) {
  const { professional, membership, reputation } = data;

  let membershipBadge: { text: string; color: string; bg: string } | null = null;

  if (membership.activeMembership) {
    membershipBadge = {
      text: 'Membresía activa',
      color: '#065F46',
      bg: '#D1FAE5',
    };
  } else if (membership.trialRequestsUsed > 0 || membership.trialRequestsLimit > 0) {
    membershipBadge = {
      text: `Trial — ${membership.trialRequestsUsed}/${membership.trialRequestsLimit} pedidos usados`,
      color: '#92400E',
      bg: '#FEF3C7',
    };
  } else {
    membershipBadge = {
      text: 'Sin membresía activa',
      color: '#374151',
      bg: '#F3F4F6',
    };
  }

  const formatRating = (val: number): string => {
    if (reputation.totalRated === 0) return '—';
    return val.toFixed(1);
  };

  return (
    <div className="max-w-5xl space-y-8">
      <div>
        <h1
          className="text-4xl font-bold text-[#111827]"
          style={{ fontFamily: 'DM Sans' }}
        >
          Hola, {professional.name}
        </h1>
        {membershipBadge && (
          <span
            className="inline-block mt-2 text-xs font-medium px-3 py-1 rounded-full"
            style={{ color: membershipBadge.color, backgroundColor: membershipBadge.bg, fontFamily: 'DM Sans' }}
          >
            {membershipBadge.text}
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          icon={CheckCircle}
          value={String(reputation.completedRequests)}
          label="Trabajos completados"
          color="#059669"
        />
        <MetricCard
          icon={Star}
          value={formatRating(reputation.averageRating)}
          label="Calificación promedio"
          color="#F59E0B"
        />
        <MetricCard
          icon={ThumbsUp}
          value={`${reputation.wouldRecommendPct}%`}
          label="% Recomendación"
          color="#2563EB"
        />
        <MetricCard
          icon={Shield}
          value={`${reputation.complianceScore}%`}
          label="Score de cumplimiento"
          color="#0B6E4F"
        />
      </div>

      <ActivityCharts sessionToken={sessionToken} />

      {reputation.totalRated > 0 ? (
        <RatingBreakdown
          punctuality={reputation.averagePunctuality}
          quality={reputation.averageQuality}
          communication={reputation.averageCommunication}
          priceFairness={reputation.averagePriceFairness}
        />
      ) : (
        <PanelCard>
          <p
            className="text-sm text-[#9CA3AF]"
            style={{ fontFamily: 'DM Sans' }}
          >
            Aún no recibiste calificaciones
          </p>
        </PanelCard>
      )}

      <div className="flex flex-wrap gap-4">
        <button
          onClick={() => onTabChange('pending')}
          className="flex items-center gap-3 px-6 py-4 rounded-2xl bg-white border border-[#E5E7EB] shadow-sm hover:border-[#0B6E4F] hover:bg-[#F0FDF4] transition-colors cursor-pointer"
        >
          <ClockIcon />
          <span
            className="text-sm font-semibold text-[#374151]"
            style={{ fontFamily: 'DM Sans' }}
          >
            Ver pedidos pendientes
          </span>
        </button>
        <button
          onClick={() => onTabChange('in-progress')}
          className="flex items-center gap-3 px-6 py-4 rounded-2xl bg-white border border-[#E5E7EB] shadow-sm hover:border-[#0B6E4F] hover:bg-[#F0FDF4] transition-colors cursor-pointer"
        >
          <ActivityIcon />
          <span
            className="text-sm font-semibold text-[#374151]"
            style={{ fontFamily: 'DM Sans' }}
          >
            Ver en curso
          </span>
        </button>
      </div>
    </div>
  );
}

function ClockIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0B6E4F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function ActivityIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0B6E4F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  );
}
