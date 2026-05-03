import { OnboardingStep, getStepInfo, TOTAL_STEPS } from '../../../types/onboarding';

interface ProgressBarProps {
  currentStep: OnboardingStep;
}

export function ProgressBar({ currentStep }: ProgressBarProps) {
  const stepInfo = getStepInfo(currentStep);

  if (!stepInfo || currentStep === 'loading' || currentStep === 'error' || currentStep === 'confirmation') {
    if (currentStep === 'confirmation') {
      return (
        <div className="sticky top-0 z-10 bg-white">
          <div className="h-1 w-full bg-[#0B6E4F]" />
          <div className="border-b border-[#E5E7EB] px-4 py-2">
            <p className="font-medium text-[13px] text-[#0B6E4F]" style={{ fontFamily: 'DM Sans' }}>
              ¡Completado!
            </p>
          </div>
        </div>
      );
    }
    return null;
  }

  const progressPercent = (stepInfo.number / TOTAL_STEPS) * 100;

  return (
    <div className="sticky top-0 z-10 bg-white">
      <div className="h-1 w-full bg-[#E5E7EB]">
        <div
          className="h-full bg-[#0B6E4F] transition-all duration-300 ease-out"
          style={{ width: `${progressPercent}%` }}
        />
      </div>
      <div className="border-b border-[#E5E7EB] px-4 py-2">
        <p className="text-[13px] text-[#6B7280]" style={{ fontFamily: 'DM Sans' }}>
          Paso {stepInfo.number} de {TOTAL_STEPS}
          {currentStep !== 'welcome' && ` · ${stepInfo.label}`}
        </p>
      </div>
    </div>
  );
}
