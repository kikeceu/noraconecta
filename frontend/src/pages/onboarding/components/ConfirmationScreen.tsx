interface ConfirmationScreenProps {
  professionalName: string;
}

export function ConfirmationScreen({ professionalName }: ConfirmationScreenProps) {
  return (
    <div className="flex min-h-[100dvh] flex-col bg-gradient-to-b from-[#ECFDF5] to-[#F9FAFB]">
      <div className="flex flex-1 flex-col items-center justify-center px-6">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#0B6E4F]">
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 16l7 7L26 9" />
          </svg>
        </div>

        <h1 className="mt-6 text-[28px] font-bold text-[#111827]" style={{ fontFamily: 'Outfit' }}>
          Listo, {professionalName}!
        </h1>

        <p
          className="mt-3 max-w-xs text-center text-[15px] leading-relaxed text-[#6B7280]"
          style={{ fontFamily: 'DM Sans' }}
        >
          Tu documentacion fue enviada. Nuestro equipo va a revisar tu perfil y te avisaremos por WhatsApp cuando este aprobado. Este proceso puede tardar hasta 48 horas.
        </p>
      </div>

      <div className="sticky bottom-0 bg-transparent px-4 pb-[env(safe-area-inset-bottom,16px)] pt-4">
        <button
          type="button"
          onClick={() => window.close()}
          className="w-full rounded-xl py-3 text-center text-[15px] font-medium text-[#6B7280] transition-colors hover:text-[#111827]"
          style={{ fontFamily: 'DM Sans' }}
        >
          Cerrar
        </button>
      </div>
    </div>
  );
}
