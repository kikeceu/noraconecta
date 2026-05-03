import { OnboardingStep } from '../../../types/onboarding';

interface BottomBarProps {
  currentStep: OnboardingStep;
  onBack?: () => void;
  onNext?: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
  showBack?: boolean;
}

export function BottomBar({
  currentStep,
  onBack,
  onNext,
  nextLabel = 'Continuar',
  nextDisabled = false,
  showBack = true,
}: BottomBarProps) {
  if (currentStep === 'loading' || currentStep === 'error' || currentStep === 'confirmation') {
    return null;
  }

  return (
    <div className="sticky bottom-0 z-10 border-t border-[#E5E7EB] bg-white px-4 pb-[env(safe-area-inset-bottom,16px)] pt-4">
      <div className="flex items-center gap-3">
        {showBack && onBack && (
          <button
            type="button"
            onClick={onBack}
            className="rounded-xl px-4 py-3 text-[14px] font-medium text-[#6B7280] transition-colors hover:text-[#111827]"
            style={{ fontFamily: 'DM Sans' }}
          >
            Volver
          </button>
        )}
        <button
          type="button"
          onClick={onNext}
          disabled={nextDisabled}
          className="flex-1 rounded-xl py-3 text-center text-[16px] font-medium text-white transition-all active:translate-y-px disabled:cursor-not-allowed"
          style={{
            fontFamily: 'DM Sans',
            backgroundColor: nextDisabled ? '#9CA3AF' : '#0B6E4F',
            minHeight: '48px',
          }}
        >
          {nextLabel}
        </button>
      </div>
    </div>
  );
}
