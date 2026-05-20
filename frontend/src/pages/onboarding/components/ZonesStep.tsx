import { ZoneOption } from '../../../types/onboarding';

interface ZonesStepProps {
  zones: ZoneOption[];
  selectedIds: string[];
  onToggle: (zoneId: string) => void;
  onBack: () => void;
  onNext: () => void;
}

export function ZonesStep({ zones, selectedIds, onToggle, onBack, onNext }: ZonesStepProps) {
  const canContinue = selectedIds.length > 0;

  return (
    <div className="flex min-h-full flex-col">
      <div className="flex-1 overflow-auto px-4 py-5">
        <div className="rounded-2xl bg-white p-6 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
          <h2 className="mb-1 text-[18px] font-medium text-[#111827]" style={{ fontFamily: 'DM Sans' }}>
            Tus zonas de cobertura
          </h2>
          <p className="mb-5 text-[14px] leading-relaxed text-[#6B7280]" style={{ fontFamily: 'DM Sans' }}>
            Estas son las zonas que registraste. Podés modificarlas si es necesario.
          </p>

          <div className="flex flex-col gap-3">
            {zones.map((zone) => {
              const isChecked = selectedIds.includes(zone.id);
              return (
                <button
                  key={zone.id}
                  type="button"
                  onClick={() => onToggle(zone.id)}
                  className="flex items-center gap-3 rounded-lg py-2 text-left transition-colors hover:bg-gray-50"
                  style={{ minHeight: '44px' }}
                >
                  <div
                    className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded transition-colors"
                    style={{
                      backgroundColor: isChecked ? '#0B6E4F' : 'white',
                      border: isChecked ? 'none' : '1.5px solid #E5E7EB',
                    }}
                  >
                    {isChecked && (
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M2 6l2.5 2.5L10 3" />
                      </svg>
                    )}
                  </div>
                  <span className="text-[15px] text-[#111827]" style={{ fontFamily: 'DM Sans' }}>
                    {zone.name}
                  </span>
                </button>
              );
            })}
          </div>
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
            disabled={!canContinue}
            className="flex-1 rounded-xl py-3 text-center text-[16px] font-medium text-white transition-all active:translate-y-px disabled:cursor-not-allowed"
            style={{
              fontFamily: 'DM Sans',
              backgroundColor: canContinue ? '#0B6E4F' : '#9CA3AF',
              minHeight: '48px',
            }}
          >
            Continuar
          </button>
        </div>
      </div>
    </div>
  );
}
