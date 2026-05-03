import { OnboardingFormData, FileUploadInfo } from '../../../types/onboarding';

interface SummaryStepProps {
  professionalName: string;
  data: OnboardingFormData;
  files: {
    dniFront: FileUploadInfo;
    dniBack: FileUploadInfo;
    criminalRecord: FileUploadInfo;
    video: FileUploadInfo;
  };
  zones: string[];
  onBack: () => void;
  onSubmit: () => void;
  isSubmitting: boolean;
}

function SectionBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-3 text-[13px] font-medium text-[#6B7280]" style={{ fontFamily: 'DM Sans' }}>
        {label}
      </h3>
      {children}
    </div>
  );
}

function DataRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="mb-2 flex flex-col">
      <span className="text-[13px] font-medium text-[#6B7280]" style={{ fontFamily: 'DM Sans' }}>
        {label}
      </span>
      <span className="text-[15px] text-[#111827]" style={{ fontFamily: 'JetBrains Mono' }}>
        {value}
      </span>
    </div>
  );
}

function FileStatusRow({ label, file }: { label: string; file: FileUploadInfo }) {
  if (file.state === 'loaded') {
    return (
      <div className="mb-2 flex items-center gap-2">
        {file.previewUrl && (
          <img src={file.previewUrl} alt={label} className="h-[30px] w-[40px] rounded object-cover" />
        )}
        <div>
          <span className="text-[13px] font-medium text-[#6B7280]" style={{ fontFamily: 'DM Sans' }}>
            {label}
          </span>
          <span className="ml-2 text-[13px] text-[#0B6E4F]" style={{ fontFamily: 'DM Sans' }}>
            Cargado
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-2 flex flex-col">
      <span className="text-[13px] font-medium text-[#6B7280]" style={{ fontFamily: 'DM Sans' }}>
        {label}
      </span>
      <span className="text-[15px] text-[#9CA3AF]" style={{ fontFamily: 'DM Sans' }}>
        No cargado
      </span>
    </div>
  );
}

function Divider() {
  return <div className="my-4 border-t border-[#E5E7EB]" />;
}

export function SummaryStep({
  professionalName,
  data,
  files,
  zones,
  onBack,
  onSubmit,
  isSubmitting,
}: SummaryStepProps) {
  return (
    <div className="flex min-h-full flex-col">
      <div className="flex-1 overflow-auto px-4 py-5">
        <div className="rounded-2xl bg-white p-6 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
          <h2 className="mb-1 text-[18px] font-medium text-[#111827]" style={{ fontFamily: 'DM Sans' }}>
            Revisa tus datos
          </h2>
          <p className="mb-5 text-[14px] text-[#6B7280]" style={{ fontFamily: 'DM Sans' }}>
            Verifica que todo este correcto antes de enviar.
          </p>

          <SectionBlock label="Datos personales">
            <DataRow label="Nombre" value={professionalName} />
            <DataRow label="DNI" value={data.dniNumber} />
            <DataRow label="CUIL" value={data.cuil} />
          </SectionBlock>

          <Divider />

          <SectionBlock label="Documentacion">
            <FileStatusRow label="DNI Frente" file={files.dniFront} />
            <FileStatusRow label="DNI Dorso" file={files.dniBack} />
            <FileStatusRow label="Antecedentes penales" file={files.criminalRecord} />
          </SectionBlock>

          <Divider />

          <SectionBlock label="Referencias">
            <p className="text-[15px] text-[#111827]" style={{ fontFamily: 'DM Sans' }}>
              {data.references || '—'}
            </p>
          </SectionBlock>

          <Divider />

          <SectionBlock label="Video">
            <FileStatusRow label="Video de presentacion" file={files.video} />
          </SectionBlock>

          <Divider />

          <SectionBlock label="Zonas de cobertura">
            <p className="text-[15px] text-[#111827]" style={{ fontFamily: 'DM Sans' }}>
              {zones.join(', ')}
            </p>
          </SectionBlock>
        </div>
      </div>

      <div className="sticky bottom-0 border-t border-[#E5E7EB] bg-white px-4 pb-[env(safe-area-inset-bottom,16px)] pt-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            disabled={isSubmitting}
            className="rounded-xl px-4 py-3 text-[14px] font-medium text-[#6B7280] transition-colors hover:text-[#111827] disabled:opacity-50"
            style={{ fontFamily: 'DM Sans' }}
          >
            Volver
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={isSubmitting}
            className="flex-1 rounded-xl py-3 text-center text-[16px] font-medium text-white transition-all active:translate-y-px disabled:cursor-not-allowed disabled:opacity-70"
            style={{
              fontFamily: 'DM Sans',
              backgroundColor: '#0B6E4F',
              minHeight: '48px',
            }}
          >
            {isSubmitting ? 'Enviando...' : 'Enviar'}
          </button>
        </div>
      </div>
    </div>
  );
}
