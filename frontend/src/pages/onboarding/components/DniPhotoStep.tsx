import { FileUploadInfo } from '../../../types/onboarding';
import { FileUploadZone } from './FileUploadZone';

interface DniPhotoStepProps {
  dniFront: FileUploadInfo;
  dniBack: FileUploadInfo;
  onFrontFile: (file: File) => void;
  onBackFile: (file: File) => void;
  onBack: () => void;
  onNext: () => void;
}

export function DniPhotoStep({
  dniFront,
  dniBack,
  onFrontFile,
  onBackFile,
  onBack,
  onNext,
}: DniPhotoStepProps) {
  const canContinue = dniFront.state === 'loaded' && dniBack.state === 'loaded';

  return (
    <div className="flex min-h-full flex-col">
      <div className="flex-1 overflow-auto px-4 py-5">
        <div className="rounded-2xl bg-white p-6 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
          <div className="flex flex-col gap-4">
            <FileUploadZone
              label="Frente del DNI"
              state={dniFront}
              accept="image/jpeg,image/png,image/webp"
              onChange={onFrontFile}
            />
            <FileUploadZone
              label="Dorso del DNI"
              state={dniBack}
              accept="image/jpeg,image/png,image/webp"
              onChange={onBackFile}
            />
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
