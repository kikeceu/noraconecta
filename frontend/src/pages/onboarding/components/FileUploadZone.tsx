import { useRef, useCallback } from 'react';
import { FileUploadInfo } from '../../../types/onboarding';

interface FileUploadZoneProps {
  label: string;
  state: FileUploadInfo;
  accept: string;
  onChange: (file: File) => void;
}

export function FileUploadZone({ label, state, accept, onChange }: FileUploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleClick = useCallback(() => {
    if (state.state === 'empty' || state.state === 'error') {
      inputRef.current?.click();
    }
  }, [state.state]);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        onChange(file);
        e.target.value = '';
      }
    },
    [onChange],
  );

  const renderContent = () => {
    switch (state.state) {
      case 'loaded': {
        const isImage = state.file?.type?.startsWith('image/');

        return (
          <div className="flex items-center gap-3">
            {isImage && state.previewUrl ? (
              <img
                src={state.previewUrl}
                alt={label}
                className="h-[50px] w-[80px] rounded-md object-cover"
              />
            ) : (
              <div className="flex h-[50px] w-[50px] flex-shrink-0 items-center justify-center rounded-md bg-[#FEF2F2]">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                  <polyline points="10 9 9 9 8 9" />
                </svg>
              </div>
            )}
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[#0B6E4F]">
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 12 12"
                    fill="none"
                    stroke="white"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M2 6l2.5 2.5L10 3" />
                  </svg>
                </div>
                <span
                  className="text-[13px] text-[#0B6E4F]"
                  style={{ fontFamily: 'DM Sans' }}
                >
                  Cargado
                </span>
              </div>
              <span className="mt-0.5 text-[12px] text-[#9CA3AF]" style={{ fontFamily: 'DM Sans' }}>
                {state.filename}
              </span>
            </div>
          </div>
        );
      }

      case 'uploading':
        return (
          <div className="flex flex-col items-center gap-2">
            <div className="h-6 w-6 animate-pulse rounded-full border-2 border-[#0B6E4F] border-t-transparent" />
            <span className="text-[14px] text-[#6B7280]" style={{ fontFamily: 'DM Sans' }}>
              Subiendo...
            </span>
          </div>
        );

      case 'error':
        return (
          <div className="flex flex-col items-center gap-2">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
            <span className="text-[13px] text-[#DC2626]" style={{ fontFamily: 'DM Sans' }}>
              {state.error || 'Error al cargar'}
            </span>
            <span className="text-[12px] text-[#6B7280]" style={{ fontFamily: 'DM Sans' }}>
              Tocá para reintentar
            </span>
          </div>
        );

      case 'empty':
      default:
        return (
          <div className="flex flex-col items-center gap-2">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            <span className="text-[14px] text-[#6B7280]" style={{ fontFamily: 'DM Sans' }}>
              Tocá para subir
            </span>
          </div>
        );
    }
  };

  const borderStyle = (() => {
    switch (state.state) {
      case 'loaded':
        return 'border-solid border-[1.5px] border-[#0B6E4F] bg-[#ECFDF5]';
      case 'error':
        return 'border-solid border-[1.5px] border-[#DC2626] bg-[#FEF2F2]';
      case 'uploading':
        return 'border-dashed border-2 border-[#0B6E4F]';
      default:
        return 'border-dashed border-2 border-[#E5E7EB]';
    }
  })();

  return (
    <div>
      <label
        className="mb-2 block text-[14px] font-medium text-[#111827]"
        style={{ fontFamily: 'DM Sans' }}
      >
        {label}
      </label>
      <button
        type="button"
        onClick={handleClick}
        disabled={state.state === 'uploading'}
        className={`flex min-h-[120px] w-full cursor-pointer items-center justify-center rounded-xl p-4 transition-colors ${borderStyle} ${state.state === 'uploading' ? 'cursor-not-allowed opacity-60' : state.state === 'loaded' ? 'cursor-default' : 'hover:border-[#0B6E4F]'}`}
      >
        {renderContent()}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  );
}
