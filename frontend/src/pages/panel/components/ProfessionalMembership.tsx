import { useEffect, useState } from 'react';
import type { PanelMembershipData } from '../../../types/panel';
import { getPanelStats } from '../../../lib/panel-api';
import { PanelCard } from './PanelCard';
import { brand } from '../../../lib/brand';

interface ProfessionalMembershipProps {
  membership: PanelMembershipData;
  sessionToken: string;
  professionalId: string;
  discount?: { active: boolean; discountPct: number; expiresAt: string | null } | null;
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h3
      className="text-xs font-semibold uppercase tracking-widest text-[#6B7280] mb-3 pb-2 border-b border-[#F3F4F6]"
      style={{ fontFamily: 'DM Sans' }}
    >
      {children}
    </h3>
  );
}

export function ProfessionalMembership({ membership, sessionToken, professionalId, discount }: ProfessionalMembershipProps) {
  const hasActiveMembership = membership.activeMembership !== null;
  const trialRemaining = Math.max(0, membership.trialRequestsLimit - membership.trialRequestsUsed);

  const [rangeDays, setRangeDays] = useState<7 | 30 | 90>(30);
  const [totalEarnings, setTotalEarnings] = useState<number | null>(null);
  const [loadingEarnings, setLoadingEarnings] = useState(false);
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    setLoadingEarnings(true);
    setTotalEarnings(null);
    getPanelStats(sessionToken, rangeDays)
      .then((res) => setTotalEarnings(res.data.totalEarnings))
      .catch(() => setTotalEarnings(0))
      .finally(() => setLoadingEarnings(false));
  }, [sessionToken, rangeDays]);

  useEffect(() => {
    if (!discount?.active || !discount.expiresAt) {
      setTimeLeft('');
      return;
    }

    const updateTimer = () => {
      const diff = new Date(discount.expiresAt!).getTime() - Date.now();
      if (diff <= 0) {
        setTimeLeft('');
        return;
      }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [discount]);

  return (
    <>
    <div className="max-w-5xl space-y-8">
      <h1
        className="text-3xl font-bold text-[#111827]"
        style={{ fontFamily: 'DM Sans' }}
      >
        Mi Membresía
      </h1>

      <PanelCard>
        <div className="flex items-center justify-between mb-4">
          <h3
            className="text-sm font-semibold uppercase tracking-widest text-[#6B7280]"
            style={{ fontFamily: 'DM Sans' }}
          >
            Lo que generaste con {brand.name}
          </h3>
          <div className="flex gap-1">
            {([7, 30, 90] as const).map((d) => (
              <button
                key={d}
                onClick={() => setRangeDays(d)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                  rangeDays === d
                    ? 'bg-[#0B6E4F] text-white'
                    : 'bg-[#F3F4F6] text-[#374151] hover:bg-[#E5E7EB]'
                }`}
                style={{ fontFamily: 'DM Sans' }}
              >
                {d}d
              </button>
            ))}
          </div>
        </div>

        {loadingEarnings ? (
          <div className="h-12 animate-pulse rounded-lg bg-[#F3F4F6]" />
        ) : (
          <div>
            <p
              className="text-4xl font-bold text-[#0B6E4F]"
              style={{ fontFamily: 'JetBrains Mono' }}
            >
              ${(totalEarnings ?? 0).toLocaleString('es-AR')}
            </p>
            <p
              className="text-xs text-[#6B7280] mt-1"
              style={{ fontFamily: 'DM Sans' }}
            >
              {totalEarnings === 0
                ? 'Aún no hay trabajos con precio registrado en este período.'
                : `Basado en los precios reportados por tus clientes en los últimos ${rangeDays} días.`}
            </p>
          </div>
        )}
      </PanelCard>

      {!hasActiveMembership && discount?.active && timeLeft && (
        <div
          className="rounded-2xl p-5 text-center"
          style={{ background: 'linear-gradient(135deg, #052e1c 0%, #0B6E4F 100%)' }}
        >
          <p
            className="text-xs font-semibold uppercase tracking-widest text-[#A7F3D0] mb-1"
            style={{ fontFamily: 'DM Sans' }}
          >
            ⚡ Oferta por tiempo limitado
          </p>
          <p
            className="text-4xl font-bold text-white mb-1"
            style={{ fontFamily: 'JetBrains Mono' }}
          >
            {discount.discountPct}% OFF
          </p>
          <p
            className="text-xs text-[#A7F3D0] mb-3"
            style={{ fontFamily: 'DM Sans' }}
          >
            en tu primer mes de membresía
          </p>
          <p
            className="text-2xl font-bold text-white mb-4"
            style={{ fontFamily: 'JetBrains Mono' }}
          >
            {timeLeft}
          </p>
          <a
            href={`${import.meta.env.VITE_APP_URL}/planes?pro=${professionalId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full rounded-lg bg-white py-2.5 text-sm font-bold text-[#0B6E4F] hover:opacity-90 transition-opacity cursor-pointer text-center"
            style={{ fontFamily: 'DM Sans' }}
          >
            Aprovechar oferta
          </a>
        </div>
      )}

      {hasActiveMembership && membership.activeMembership ? (
        <>
          <PanelCard>
            <SectionHeader>Plan Actual</SectionHeader>

            <div className="flex flex-wrap items-center gap-3 mb-4">
              <h2
                className="text-xl font-bold text-[#111827]"
                style={{ fontFamily: 'DM Sans' }}
              >
                {membership.activeMembership.plan.name}
              </h2>
              <span
                className="inline-flex rounded-full px-3 py-1 text-xs font-medium"
                style={{
                  backgroundColor: '#EFF6FF',
                  color: '#2563EB',
                  fontFamily: 'DM Sans',
                }}
              >
                {membership.activeMembership.type === 'MONTHLY' ? 'Mensual' : 'Anual'}
              </span>
              <span
                className="inline-flex rounded-full px-3 py-1 text-xs font-medium"
                style={{
                  backgroundColor: '#ECFDF5',
                  color: '#059669',
                  fontFamily: 'DM Sans',
                }}
              >
                Activo
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <span
                  className="text-xs text-[#6B7280] block"
                  style={{ fontFamily: 'DM Sans' }}
                >
                  Fecha de inicio
                </span>
                <span
                  className="text-sm font-medium text-[#111827]"
                  style={{ fontFamily: 'DM Sans' }}
                >
                  {formatDate(membership.activeMembership.startDate)}
                </span>
              </div>
              <div>
                <span
                  className="text-xs text-[#6B7280] block"
                  style={{ fontFamily: 'DM Sans' }}
                >
                  Próximo vencimiento
                </span>
                <span
                  className="text-sm font-medium text-[#111827]"
                  style={{ fontFamily: 'DM Sans' }}
                >
                  {formatDate(membership.activeMembership.endDate)}
                </span>
              </div>
              <div>
                <span
                  className="text-xs text-[#6B7280] block"
                  style={{ fontFamily: 'DM Sans' }}
                >
                  Tipo de facturación
                </span>
                <span
                  className="text-sm font-medium text-[#111827]"
                  style={{ fontFamily: 'DM Sans' }}
                >
                  {membership.activeMembership.type === 'MONTHLY' ? 'Mensual' : 'Anual'}
                </span>
              </div>
              <div>
                <span
                  className="text-xs text-[#6B7280] block"
                  style={{ fontFamily: 'DM Sans' }}
                >
                  Renovación automática
                </span>
                <span
                  className="text-sm font-medium text-[#111827] inline-flex items-center gap-1"
                  style={{ fontFamily: 'DM Sans' }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  Activada
                </span>
              </div>
            </div>

            <p
              className="mt-4 text-xs text-[#6B7280]"
              style={{ fontFamily: 'DM Sans' }}
            >
              Tu membresía se renueva automáticamente cada{' '}
              {membership.activeMembership.type === 'MONTHLY' ? 'mes' : 'año'}. Podés cancelar
              cuando quieras.
            </p>
          </PanelCard>

          <PanelCard>
            <SectionHeader>Tus Beneficios</SectionHeader>
            <div className="divide-y divide-[#F3F4F6]">
              {(membership.activeMembership?.plan?.features?.length
                ? membership.activeMembership.plan.features as string[]
                : BENEFITS
              ).map((benefit) => (
                <div key={benefit} className="flex items-center gap-3 py-2.5">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                    <circle cx="12" cy="12" r="10" />
                    <path d="m9 12 2 2 4-4" />
                  </svg>
                  <span
                    className="text-sm text-[#111827]"
                    style={{ fontFamily: 'DM Sans' }}
                  >
                    {benefit}
                  </span>
                </div>
              ))}
            </div>
          </PanelCard>
        </>
      ) : trialRemaining > 0 ? (
        <PanelCard>
          <div className="min-h-[200px] flex flex-col justify-center">
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <h2
              className="text-2xl font-bold text-[#111827]"
              style={{ fontFamily: 'DM Sans' }}
            >
              Plan de prueba
            </h2>
            <span
              className="inline-flex rounded-full px-3 py-1 text-xs font-medium"
              style={{
                backgroundColor: '#FFFBEB',
                color: '#D97706',
                fontFamily: 'DM Sans',
              }}
            >
              En prueba
            </span>
          </div>

          <p
            className="text-base text-[#6B7280] mb-3"
            style={{ fontFamily: 'DM Sans' }}
          >
            Te quedan{' '}
            <span className="text-2xl font-bold text-[#111827]" style={{ fontFamily: 'JetBrains Mono' }}>
              {trialRemaining}
            </span>{' '}
            de{' '}
            <span className="text-2xl font-bold text-[#111827]" style={{ fontFamily: 'JetBrains Mono' }}>
              {membership.trialRequestsLimit}
            </span>{' '}
            pedidos gratuitos.
          </p>

          <div className="w-full h-3 rounded-full bg-[#E5E7EB] overflow-hidden">
            <div
              className="h-full rounded-full bg-[#0B6E4F] transition-all"
              style={{
                width: `${(membership.trialRequestsUsed / membership.trialRequestsLimit) * 100}%`,
              }}
            />
          </div>

          <a
            href={`${import.meta.env.VITE_APP_URL}/planes?pro=${professionalId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-5 w-full flex items-center justify-center rounded-2xl py-4 text-base font-bold text-white transition-opacity hover:opacity-90 cursor-pointer"
            style={{
              background: 'linear-gradient(135deg, #0B6E4F 0%, #059669 100%)',
              fontFamily: 'DM Sans',
              minHeight: '56px',
              boxShadow: '0 4px 14px rgba(11, 110, 79, 0.35)',
            }}
          >
            Activar mi membresía ahora
          </a>

          <p
            className="mt-4 text-xs text-[#6B7280]"
            style={{ fontFamily: 'DM Sans' }}
          >
            Cuando termines tus pedidos de prueba, necesitarás activar una membresía para seguir
            recibiendo solicitudes.
          </p>
          </div>
        </PanelCard>
      ) : (
        <PanelCard>
          <div className="flex items-start gap-3 mb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#FEF3C7] shrink-0">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </div>
            <div>
              <h2
                className="text-base font-semibold text-[#111827]"
                style={{ fontFamily: 'DM Sans' }}
              >
                Tu período de prueba finalizó
              </h2>
              <p
                className="mt-1 text-sm text-[#6B7280]"
                style={{ fontFamily: 'DM Sans' }}
              >
                Para seguir recibiendo pedidos, activá tu suscripción.
              </p>
            </div>
          </div>

          <div className="rounded-lg border border-[#A7F3D0] bg-[#F0FDF4] p-4">
            <p
              className="text-sm font-medium text-[#0B6E4F] mb-2"
              style={{ fontFamily: 'DM Sans' }}
            >
              Transferí el importe a nuestro alias de pago:
            </p>
            <div className="rounded-md border border-[#A7F3D0] bg-white px-3 py-2.5">
              <code
                className="text-base font-medium text-[#0B6E4F]"
                style={{ fontFamily: 'JetBrains Mono' }}
              >
                nora.conecta.mp
              </code>
            </div>
            <p
              className="mt-2 text-xs text-[#6B7280]"
              style={{ fontFamily: 'DM Sans' }}
            >
              Una vez realizado el pago, envianos el comprobante por WhatsApp y activaremos tu
              cuenta.
            </p>
          </div>

          <a
            href={`${import.meta.env.VITE_APP_URL}/planes?pro=${professionalId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 w-full flex items-center justify-center rounded-2xl py-4 text-base font-bold text-white transition-opacity hover:opacity-90 cursor-pointer"
            style={{
              background: 'linear-gradient(135deg, #0B6E4F 0%, #059669 100%)',
              fontFamily: 'DM Sans',
              minHeight: '56px',
              boxShadow: '0 4px 14px rgba(11, 110, 79, 0.35)',
            }}
          >
            Activar mi membresía ahora
          </a>
        </PanelCard>
      )}

      {hasActiveMembership && membership.activeMembership && (
        <PanelCard>
          <SectionHeader>Precio</SectionHeader>
          <div className="flex items-baseline gap-1">
            <span
              className="text-4xl font-bold text-[#111827]"
              style={{ fontFamily: 'JetBrains Mono' }}
            >
              ${membership.activeMembership.plan.monthlyPrice.toLocaleString('es-AR')}
            </span>
            <span
              className="text-sm text-[#6B7280]"
              style={{ fontFamily: 'DM Sans' }}
            >
              / mes
            </span>
          </div>
          {membership.activeMembership.type === 'ANNUAL' &&
            membership.activeMembership.plan.annualDiscountPct > 0 && (
              <p
                className="mt-1 text-xs text-[#059669]"
                style={{ fontFamily: 'DM Sans' }}
              >
                {membership.activeMembership.plan.annualDiscountPct}% de descuento por plan anual
              </p>
            )}
        </PanelCard>
      )}
    </div>
    </>
  );
}

const BENEFITS = [
  'Pedidos ilimitados',
  'Panel de gestión de pedidos',
  'Historial, reputación y perfil verificado',
  'Estadísticas de ganancias',
  'Prioridad frente a profesionales sin membresía',
];

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('es-AR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}
