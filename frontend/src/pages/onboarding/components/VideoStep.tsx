import { FileUploadInfo } from '../../../types/onboarding';
import { FileUploadZone } from './FileUploadZone';

interface VideoStepProps {
  video: FileUploadInfo;
  onFile: (file: File) => void;
  onBack: () => void;
  onNext: () => void;
}

export function VideoStep({ video, onFile, onBack, onNext }: VideoStepProps) {
  return (
    <div className="flex min-h-full flex-col">
      <div className="flex-1 overflow-auto px-4 py-5">
        <div className="rounded-2xl bg-white p-6 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
          <div className="mb-3 flex items-center gap-2">
            <h2 className="text-[18px] font-medium text-[#111827]" style={{ fontFamily: 'DM Sans' }}>
              Video de presentacion
            </h2>
            <span
              className="rounded px-2 py-0.5 text-[12px] font-medium text-[#D97706]"
              style={{ fontFamily: 'DM Sans', backgroundColor: '#FEF3C7' }}
            >
              Opcional
            </span>
          </div>
          <p className="mb-5 text-[14px] leading-relaxed text-[#6B7280]" style={{ fontFamily: 'DM Sans' }}>
            Graba un video breve presentandote. Esto genera mas confianza en los clientes.
          </p>
          <FileUploadZone
            label="Video"
            state={video}
            accept="video/mp4,video/quicktime"
            onChange={onFile}
          />
          <p className="mt-3 text-center text-[12px] text-[#9CA3AF]" style={{ fontFamily: 'DM Sans' }}>
            Formatos: MP4, MOV. Max 30 segundos
          </p>
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
            {video.state === 'loaded' ? 'Continuar' : 'Omitir'}
          </button>
        </div>
      </div>
    </div>
  );
}
