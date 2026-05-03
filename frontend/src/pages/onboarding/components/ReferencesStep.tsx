interface ReferencesStepProps {
  value: string;
  onChange: (value: string) => void;
  onBack: () => void;
  onNext: () => void;
}

export function ReferencesStep({ value, onChange, onBack, onNext }: ReferencesStepProps) {
  return (
    <div className="flex min-h-full flex-col">
      <div className="flex-1 overflow-auto px-4 py-5">
        <div className="rounded-2xl bg-white p-6 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
          <div className="mb-3 flex items-center gap-2">
            <h2
              className="text-[18px] font-medium text-[#111827]"
              style={{ fontFamily: 'DM Sans' }}
            >
              Referencias laborales
            </h2>
            <span
              className="rounded px-2 py-0.5 text-[12px] font-medium text-[#D97706]"
              style={{ fontFamily: 'DM Sans', backgroundColor: '#FEF3C7' }}
            >
              Opcional
            </span>
          </div>
          <p
            className="mb-5 text-[14px] leading-relaxed text-[#6B7280]"
            style={{ fontFamily: 'DM Sans' }}
          >
            Contanos sobre tu experiencia laboral previa. Esto nos ayuda a conocer tu perfil.
          </p>
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Ej: Trabajé 3 años como electricista en..."
            className="w-full resize-y rounded-lg border-[1.5px] border-[#E5E7EB] px-3 py-3.5 text-[15px] text-[#111827] outline-none transition-colors placeholder:text-[#9CA3AF] focus:border-[#0B6E4F]"
            style={{
              fontFamily: 'DM Sans',
              minHeight: '140px',
            }}
            rows={5}
          />
        </div>
      </div>

      <div className="sticky bottom-0 border-t border-[#E5E7EB] bg-white px-4 pb-[env(safe-area-inset-bottom,16px)] pt-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="rounded-xl px-4 py-3 text-[14px] font-medium text-[#6B7280] transition-colors hover:text-[#111827]"
            style={{ fontFamily: 'DM Sans' }}
          >
            Volver
          </button>
          <button
            type="button"
            onClick={onNext}
            className="flex-1 rounded-xl py-3 text-center text-[16px] font-medium text-white transition-all active:translate-y-px"
            style={{ fontFamily: 'DM Sans', backgroundColor: '#0B6E4F', minHeight: '48px' }}
          >
            Continuar
          </button>
        </div>
      </div>
    </div>
  );
}
