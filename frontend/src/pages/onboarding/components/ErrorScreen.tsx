import { ErrorVariant } from '../../../types/onboarding';

interface ErrorScreenProps {
  variant: ErrorVariant;
}

const errorConfig: Record<ErrorVariant, { heading: string; description: string; showAction: boolean }> = {
  expired: {
    heading: 'El enlace expiró',
    description:
      'El enlace de verificación ya no es válido. Solicitá uno nuevo desde WhatsApp para continuar con tu registro.',
    showAction: true,
  },
  used: {
    heading: 'Este enlace ya fue utilizado',
    description:
      'Los datos de este perfil ya fueron enviados anteriormente. Si necesitás hacer cambios, contactanos por WhatsApp.',
    showAction: false,
  },
  invalid: {
    heading: 'Enlace no válido',
    description:
      'El enlace que abriste no es válido. Verificá que la dirección sea correcta o solicitá uno nuevo.',
    showAction: true,
  },
};

export function ErrorScreen({ variant }: ErrorScreenProps) {
  const config = errorConfig[variant];
  const isAmber = variant === 'expired';

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-[#F9FAFB] px-6">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
        <div className="flex flex-col items-center text-center">
          <div
            className="flex h-14 w-14 items-center justify-center rounded-full"
            style={{ backgroundColor: isAmber ? '#FEF3C7' : '#FEF2F2' }}
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke={isAmber ? '#D97706' : '#DC2626'}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {isAmber ? (
                <>
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </>
              ) : (
                <>
                  <circle cx="12" cy="12" r="10" />
                  <line x1="15" y1="9" x2="9" y2="15" />
                  <line x1="9" y1="9" x2="15" y2="15" />
                </>
              )}
            </svg>
          </div>

          <h2
            className="mt-4 text-[22px] font-bold text-[#111827]"
            style={{ fontFamily: 'Outfit' }}
          >
            {config.heading}
          </h2>

          <p
            className="mt-2 text-[15px] leading-relaxed text-[#6B7280]"
            style={{ fontFamily: 'DM Sans' }}
          >
            {config.description}
          </p>

          {config.showAction && (
            <button
              type="button"
              className="mt-5 w-full rounded-xl border border-[#E5E7EB] py-3 text-[14px] font-medium text-[#6B7280] transition-colors hover:bg-gray-50"
              style={{ fontFamily: 'DM Sans', minHeight: '44px' }}
              onClick={() => window.open('https://wa.me/5491123456789', '_blank')}
            >
              Ir a WhatsApp
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
