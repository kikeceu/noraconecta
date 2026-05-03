import type { PanelMembershipData } from '../../../types/panel';

interface ProfessionalMembershipProps {
  membership: PanelMembershipData;
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl bg-white border border-[#E5E7EB] p-5 ${className}`}>
      {children}
    </div>
  );
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h3
      className="text-xs font-semibold uppercase tracking-wide text-[#6B7280] mb-3 pb-2 border-b border-[#F3F4F6]"
      style={{ fontFamily: 'DM Sans' }}
    >
      {children}
    </h3>
  );
}

export function ProfessionalMembership({ membership }: ProfessionalMembershipProps) {
  const hasActiveMembership = membership.activeMembership !== null;
  const trialRemaining = Math.max(0, membership.trialRequestsLimit - membership.trialRequestsUsed);

  return (
    <div className="max-w-3xl space-y-5">
      <h1
        className="text-2xl font-bold text-[#111827]"
        style={{ fontFamily: 'DM Sans' }}
      >
        Mi Membresía
      </h1>

      {hasActiveMembership && membership.activeMembership ? (
        <>
          <Card>
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

            <div className="grid grid-cols-2 gap-3">
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
          </Card>

          <Card>
            <SectionHeader>Tus Beneficios</SectionHeader>
            <div className="divide-y divide-[#F3F4F6]">
              {BENEFITS.map((benefit) => (
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
          </Card>
        </>
      ) : trialRemaining > 0 ? (
        <Card>
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <h2
              className="text-xl font-bold text-[#111827]"
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
            className="text-sm text-[#6B7280] mb-3"
            style={{ fontFamily: 'DM Sans' }}
          >
            Te quedan{' '}
            <span className="font-semibold text-[#111827]">
              {trialRemaining} de {membership.trialRequestsLimit}
            </span>{' '}
            pedidos gratuitos.
          </p>

          <div className="w-full h-2 rounded-full bg-[#E5E7EB] overflow-hidden">
            <div
              className="h-full rounded-full bg-[#0B6E4F] transition-all"
              style={{
                width: `${(membership.trialRequestsUsed / membership.trialRequestsLimit) * 100}%`,
              }}
            />
          </div>

          <p
            className="mt-4 text-xs text-[#6B7280]"
            style={{ fontFamily: 'DM Sans' }}
          >
            Cuando termines tus pedidos de prueba, necesitarás activar una membresía para seguir
            recibiendo solicitudes.
          </p>
        </Card>
      ) : (
        <Card>
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

          <button
            type="button"
            className="mt-4 w-full flex items-center justify-center gap-2 rounded-lg bg-[#25D366] py-3 text-sm font-medium text-white transition-opacity hover:opacity-90"
            style={{ fontFamily: 'DM Sans', minHeight: '44px' }}
            onClick={() => window.open('https://wa.me/5491123456789', '_blank')}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z" />
            </svg>
            Enviar comprobante por WhatsApp
          </button>
        </Card>
      )}

      {hasActiveMembership && membership.activeMembership && (
        <Card>
          <SectionHeader>Precio</SectionHeader>
          <div className="flex items-baseline gap-1">
            <span
              className="text-2xl font-bold text-[#111827]"
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
        </Card>
      )}
    </div>
  );
}

const BENEFITS = [
  'Pedidos ilimitados',
  'Perfil destacado en búsquedas',
  'Soporte prioritario por WhatsApp',
  'Estadísticas de rendimiento',
  'Badge de confianza NORA',
];

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('es-AR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}
