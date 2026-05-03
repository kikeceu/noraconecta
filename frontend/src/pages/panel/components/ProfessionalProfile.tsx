import type { PanelProfessional, ProfessionalStatus } from '../../../types/panel';

interface ProfessionalProfileProps {
  professional: PanelProfessional;
}

const STATUS_CONFIG: Record<ProfessionalStatus, { label: string; bg: string; text: string }> = {
  ACTIVE: { label: 'Activo', bg: '#ECFDF5', text: '#059669' },
  SUSPENDED: { label: 'Suspendido', bg: '#FEF2F2', text: '#DC2626' },
  OBSERVATION: { label: 'En observación', bg: '#FFFBEB', text: '#D97706' },
  PENDING: { label: 'Pendiente', bg: '#EFF6FF', text: '#2563EB' },
  UNDER_REVIEW: { label: 'En revisión', bg: '#EFF6FF', text: '#2563EB' },
  PAUSED: { label: 'Pausado', bg: '#F3F4F6', text: '#6B7280' },
  REJECTED: { label: 'Rechazado', bg: '#FEF2F2', text: '#DC2626' },
};

const DOCS: { key: string; label: string; url: string | null | undefined }[] = [
  { key: 'dniFront', label: 'DNI Frente.pdf', url: 'dniFrontUrl' },
  { key: 'dniBack', label: 'DNI Dorso.pdf', url: 'dniBackUrl' },
  { key: 'criminalRecord', label: 'Certificado de antecedentes.pdf', url: 'criminalRecordUrl' },
];

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

export function ProfessionalProfile({ professional }: ProfessionalProfileProps) {
  const status = STATUS_CONFIG[professional.status] || STATUS_CONFIG.PENDING;

  return (
    <div className="max-w-3xl space-y-5">
      <h1
        className="text-2xl font-bold text-[#111827]"
        style={{ fontFamily: 'DM Sans' }}
      >
        Mi Perfil
      </h1>

      <Card>
        <SectionHeader>Estado del Profesional</SectionHeader>

        <div className="flex flex-wrap items-center gap-3 mb-4">
          <span className="text-sm text-[#6B7280]" style={{ fontFamily: 'DM Sans' }}>
            Estado:
          </span>
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium"
            style={{
              backgroundColor: status.bg,
              color: status.text,
              fontFamily: 'DM Sans',
            }}
          >
            <span
              className="inline-block w-1.5 h-1.5 rounded-full"
              style={{ backgroundColor: status.text }}
            />
            {status.label}
          </span>

          {professional.hasBadge && (
            <span
              className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium"
              style={{
                backgroundColor: '#FEF3C7',
                color: '#92400E',
                fontFamily: 'DM Sans',
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
              Excelencia NORA
            </span>
          )}
        </div>

        <div>
          <span
            className="text-xs font-medium text-[#6B7280] block mb-2"
            style={{ fontFamily: 'DM Sans' }}
          >
            Disponibilidad
          </span>
          {professional.availability ? (
            <div className="flex flex-wrap gap-2">
              {professional.availability.split(',').map((slot) => (
                <span
                  key={slot}
                  className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs bg-[#F3F4F6] text-[#374151]"
                  style={{ fontFamily: 'DM Sans' }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                  {slot.trim()}
                </span>
              ))}
            </div>
          ) : (
            <p
              className="text-sm italic text-[#9CA3AF]"
              style={{ fontFamily: 'DM Sans' }}
            >
              No declaraste disponibilidad todavía
            </p>
          )}
        </div>
      </Card>

      <Card>
        <SectionHeader>Datos Personales</SectionHeader>
        <div className="divide-y divide-[#F3F4F6]">
          <FieldRow label="Nombre completo" value={professional.name} />
          <FieldRow label="Teléfono" value={professional.phone} />
          <FieldRow
            label="Rubro"
            value={professional.category?.name || '—'}
          />
          <FieldRow
            label="Zonas de cobertura"
            value={
              professional.zones.length > 0
                ? professional.zones.map((z) => z.name).join(', ')
                : '—'
            }
          />
          {professional.cuil && <FieldRow label="CUIL" value={professional.cuil} />}
        </div>
      </Card>

      <Card>
        <SectionHeader>Documentación Enviada</SectionHeader>
        <div className="divide-y divide-[#F3F4F6]">
          {DOCS.map((doc) => {
            const url = professional[doc.url as keyof PanelProfessional] as string | null;
            if (!url) return null;
            return (
              <div key={doc.key} className="flex items-center justify-between py-2.5">
                <div className="flex items-center gap-2.5 min-w-0">
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#6B7280"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="shrink-0"
                  >
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                  <span
                    className="text-sm text-[#111827] truncate"
                    style={{ fontFamily: 'DM Sans' }}
                  >
                    {doc.label}
                  </span>
                </div>
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium text-[#0B6E4F] hover:underline shrink-0 ml-4"
                  style={{ fontFamily: 'DM Sans' }}
                >
                  Ver
                </a>
              </div>
            );
          })}
          {professional.references && (
            <div className="py-3">
              <span
                className="text-xs font-medium text-[#6B7280] block mb-1"
                style={{ fontFamily: 'DM Sans' }}
              >
                Referencias
              </span>
              <p
                className="text-sm text-[#374151]"
                style={{ fontFamily: 'DM Sans' }}
              >
                {professional.references}
              </p>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

function FieldRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2.5">
      <span
        className="text-sm text-[#6B7280]"
        style={{ fontFamily: 'DM Sans' }}
      >
        {label}
      </span>
      <span
        className="text-sm font-medium text-[#111827] text-right ml-4"
        style={{ fontFamily: 'DM Sans' }}
      >
        {value}
      </span>
    </div>
  );
}
