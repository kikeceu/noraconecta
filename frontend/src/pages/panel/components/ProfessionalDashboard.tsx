import { CheckCircle, Star, ThumbsUp, Shield } from 'lucide-react';
import type { PanelData, PanelTab } from '../../../types/panel';
import { PanelCard } from './PanelCard';

interface ProfessionalDashboardProps {
  data: PanelData;
  onTabChange: (tab: PanelTab) => void;
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
      <div className="flex items-start gap-4">
        <div
          className="flex items-center justify-center w-12 h-12 rounded-full shrink-0"
          style={{ backgroundColor: `${color}13` }}
        >
          <Icon className="w-6 h-6" style={{ color }} />
        </div>
        <div className="min-w-0">
          <p
            className="text-4xl font-bold text-[#111827]"
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

export function ProfessionalDashboard({ data, onTabChange }: ProfessionalDashboardProps) {
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
    <div className="max-w-4xl space-y-8">
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
