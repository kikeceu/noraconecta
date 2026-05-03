import type { PanelReputation } from '../../../types/panel';

interface ProfessionalReputationProps {
  reputation: PanelReputation;
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl bg-white border border-[#E5E7EB] p-5 ${className}`}>
      {children}
    </div>
  );
}

export function ProfessionalReputation({ reputation }: ProfessionalReputationProps) {
  const { complianceScore, completedRequests, rejectedRequests, notFulfilledRequests, totalRequests, wouldRecommendPct } = reputation;

  const circumference = 2 * Math.PI * 54;
  const strokeDashoffset = circumference - (complianceScore / 100) * circumference;

  return (
    <div className="max-w-3xl space-y-5">
      <h1
        className="text-2xl font-bold text-[#111827]"
        style={{ fontFamily: 'DM Sans' }}
      >
        Mi Reputación
      </h1>

      <Card>
        <div className="flex flex-col md:flex-row items-center gap-6">
          <div className="relative flex items-center justify-center shrink-0">
            <svg width="128" height="128" viewBox="0 0 128 128">
              <circle
                cx="64"
                cy="64"
                r="54"
                fill="none"
                stroke="#E5E7EB"
                strokeWidth="8"
              />
              <circle
                cx="64"
                cy="64"
                r="54"
                fill="none"
                stroke="#0B6E4F"
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                transform="rotate(-90 64 64)"
                style={{ transition: 'stroke-dashoffset 0.6s ease' }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span
                className="text-3xl font-bold text-[#111827]"
                style={{ fontFamily: 'JetBrains Mono' }}
              >
                {complianceScore}%
              </span>
            </div>
          </div>

          <div className="flex-1 space-y-3 w-full">
            <div className="flex items-center gap-3 py-2 border-b border-[#F3F4F6]">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <div>
                <span
                  className="text-lg font-bold text-[#059669]"
                  style={{ fontFamily: 'JetBrains Mono' }}
                >
                  {completedRequests}
                </span>
                <span
                  className="text-sm text-[#6B7280] ml-2"
                  style={{ fontFamily: 'DM Sans' }}
                >
                  Pedidos completados de {totalRequests} totales
                </span>
              </div>
            </div>
            <div className="flex items-center gap-3 py-2 border-b border-[#F3F4F6]">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
              <div>
                <span
                  className="text-lg font-bold text-[#DC2626]"
                  style={{ fontFamily: 'JetBrains Mono' }}
                >
                  {rejectedRequests}
                </span>
                <span
                  className="text-sm text-[#6B7280] ml-2"
                  style={{ fontFamily: 'DM Sans' }}
                >
                  Pedidos rechazados
                </span>
              </div>
            </div>
            <div className="flex items-center gap-3 py-2">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              <div>
                <span
                  className="text-lg font-bold text-[#D97706]"
                  style={{ fontFamily: 'JetBrains Mono' }}
                >
                  {notFulfilledRequests}
                </span>
                <span
                  className="text-sm text-[#6B7280] ml-2"
                  style={{ fontFamily: 'DM Sans' }}
                >
                  Pedidos no cumplidos
                </span>
              </div>
            </div>
          </div>
        </div>

        <p
          className="mt-4 text-xs text-[#6B7280] text-center"
          style={{ fontFamily: 'DM Sans' }}
        >
          Score de cumplimiento
        </p>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <p
            className="text-2xl font-bold text-[#0B6E4F]"
            style={{ fontFamily: 'JetBrains Mono' }}
          >
            {wouldRecommendPct}%
          </p>
          <p
            className="text-xs text-[#6B7280] mt-1"
            style={{ fontFamily: 'DM Sans' }}
          >
            Clientes que te recomendarían
          </p>
        </Card>

        <Card>
          <p
            className="text-2xl font-bold text-[#111827]"
            style={{ fontFamily: 'JetBrains Mono' }}
          >
            {totalRequests > 0
              ? Math.round((completedRequests / totalRequests) * 100)
              : 0}%
          </p>
          <p
            className="text-xs text-[#6B7280] mt-1"
            style={{ fontFamily: 'DM Sans' }}
          >
            Tasa de aceptación
          </p>
        </Card>

        <Card>
          <p
            className="text-2xl font-bold text-[#111827]"
            style={{ fontFamily: 'JetBrains Mono' }}
          >
            {totalRequests > 0 ? Math.round(totalRequests / 6) : 0}
          </p>
          <p
            className="text-xs text-[#6B7280] mt-1"
            style={{ fontFamily: 'DM Sans' }}
          >
            Pedidos promedio por mes
          </p>
        </Card>
      </div>

      <Card className="!border-[#A7F3D0] !bg-[#F0FDF4]">
        <div className="flex items-start gap-3">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0B6E4F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5">
            <path d="M9 18V5l12-2v13" />
            <circle cx="6" cy="18" r="3" />
            <circle cx="18" cy="16" r="3" />
          </svg>
          <div>
            <h3
              className="text-sm font-semibold text-[#0B6E4F]"
              style={{ fontFamily: 'DM Sans' }}
            >
              Consejos para mejorar tu reputación
            </h3>
            <ul className="mt-2 space-y-1.5">
              <li
                className="flex items-start gap-2 text-xs text-[#374151]"
                style={{ fontFamily: 'DM Sans' }}
              >
                <span className="text-[#0B6E4F] mt-0.5">•</span>
                Respondé los pedidos rápido para mantener tu tasa de respuesta alta.
              </li>
              <li
                className="flex items-start gap-2 text-xs text-[#374151]"
                style={{ fontFamily: 'DM Sans' }}
              >
                <span className="text-[#0B6E4F] mt-0.5">•</span>
                Si no podés tomar un pedido, rechazalo indicando el motivo. Un rechazo justificado no afecta tu score.
              </li>
              <li
                className="flex items-start gap-2 text-xs text-[#374151]"
                style={{ fontFamily: 'DM Sans' }}
              >
                <span className="text-[#0B6E4F] mt-0.5">•</span>
                Completá todos los pedidos que aceptes. Los no cumplidos son lo que más afecta tu reputación.
              </li>
            </ul>
          </div>
        </div>
      </Card>
    </div>
  );
}
