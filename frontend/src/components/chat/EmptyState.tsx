import { brand } from '../../lib/brand';

interface EmptyStateProps {
  readonly phoneSelected: boolean;
}

export function EmptyState({ phoneSelected }: EmptyStateProps) {
  return (
    <div className="flex flex-1 items-center justify-center px-5">
      <div className="flex max-w-[320px] flex-col items-center text-center">
        <svg
          className="mb-6 h-12 w-12 text-iron"
          fill="none"
          viewBox="0 0 48 48"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M8 12h24a4 4 0 014 4v12a4 4 0 01-4 4H20l-6 6v-6H8a4 4 0 01-4-4V16a4 4 0 014-4z"
          />
        </svg>
        <h2 className="mb-2 text-[1.0625rem] font-medium text-steel">
          Sin mensajes aun
        </h2>
        <p className="text-[0.8125rem] leading-relaxed text-zinc-muted">
          {phoneSelected
            ? `Escribi un mensaje para simular una conversacion con ${brand.name}`
            : 'Selecciona un telefono y empeza a escribir para simular una conversacion'}
        </p>
      </div>
    </div>
  );
}
