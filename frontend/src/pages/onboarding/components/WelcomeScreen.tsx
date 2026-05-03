interface WelcomeScreenProps {
  professionalName: string;
  onStart: () => void;
}

export function WelcomeScreen({ professionalName, onStart }: WelcomeScreenProps) {
  return (
    <div className="flex min-h-full flex-col">
      <div className="flex flex-1 flex-col items-center justify-center px-6">
        <div className="w-full max-w-sm text-center">
          <div className="mx-auto mb-6 h-1 w-16 rounded-full bg-[#0B6E4F]" />
          <h1
            className="mb-3 text-[28px] font-bold leading-tight text-[#111827]"
            style={{ fontFamily: 'Outfit' }}
          >
            Hola, {professionalName}
          </h1>
          <p
            className="text-[15px] leading-relaxed text-[#6B7280]"
            style={{ fontFamily: 'DM Sans' }}
          >
            Completá tus datos para activar tu perfil profesional en NORA.
          </p>
        </div>
      </div>
      <div className="sticky bottom-0 border-t border-[#E5E7EB] bg-white px-4 pb-[env(safe-area-inset-bottom,16px)] pt-4">
        <button
          type="button"
          onClick={onStart}
          className="w-full rounded-xl py-3 text-center text-[16px] font-medium text-white transition-all active:translate-y-px"
          style={{ fontFamily: 'DM Sans', backgroundColor: '#0B6E4F', minHeight: '48px' }}
        >
          Comenzar
        </button>
      </div>
    </div>
  );
}
