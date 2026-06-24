import { useParams } from 'react-router-dom';
import { useOnboarding } from './hooks/useOnboarding';
import { ProgressBar } from './components/ProgressBar';
import { WelcomeScreen } from './components/WelcomeScreen';
import { ErrorScreen } from './components/ErrorScreen';
import { PersonalDataStep } from './components/PersonalDataStep';
import { DniPhotoStep } from './components/DniPhotoStep';
import { CriminalRecordStep } from './components/CriminalRecordStep';
import { LicenseStep } from './components/LicenseStep';
import { ReferencesStep } from './components/ReferencesStep';
import { VideoStep } from './components/VideoStep';
import { ZonesStep } from './components/ZonesStep';
import { SummaryStep } from './components/SummaryStep';
import { ConfirmationScreen } from './components/ConfirmationScreen';

export function OnboardingPage() {
  const { token } = useParams<{ token: string }>();

  if (!token) {
    return <ErrorScreen variant="invalid" />;
  }

  return <OnboardingContent token={token} />;
}

function OnboardingContent({ token }: { token: string }) {
  const onboarding = useOnboarding(token);

  const renderContent = () => {
    switch (onboarding.step) {
      case 'loading':
        return (
          <div className="flex min-h-[100dvh] items-center justify-center bg-[#F9FAFB]">
            <div className="h-8 w-8 animate-pulse rounded-full border-2 border-[#0B6E4F] border-t-transparent" />
          </div>
        );
      case 'error':
        return <ErrorScreen variant={onboarding.errorVariant} />;
      case 'welcome':
        return (
          <>
            <ProgressBar currentStep={onboarding.step} />
            <WelcomeScreen
              professionalName={onboarding.professionalName}
              onStart={onboarding.handleStart}
            />
          </>
        );
      case 'personal-data':
        return (
          <>
            <ProgressBar currentStep={onboarding.step} />
            <PersonalDataStep
              dniNumber={onboarding.formData.dniNumber}
              cuil={onboarding.formData.cuil}
              onUpdate={onboarding.updateFormField}
              onNext={onboarding.goNext}
            />
          </>
        );
      case 'dni-photo':
        return (
          <>
            <ProgressBar currentStep={onboarding.step} />
            <DniPhotoStep
              dniFront={onboarding.dniFront}
              dniBack={onboarding.dniBack}
              onFrontFile={onboarding.handleDniFront}
              onBackFile={onboarding.handleDniBack}
              onBack={onboarding.goBack}
              onNext={onboarding.goNext}
            />
          </>
        );
      case 'criminal-record':
        return (
          <>
            <ProgressBar currentStep={onboarding.step} />
            <CriminalRecordStep
              criminalRecord={onboarding.criminalRecord}
              onFile={onboarding.handleCriminalRecord}
              onBack={onboarding.goBack}
              onNext={onboarding.goNext}
            />
          </>
        );
      case 'license':
        return (
          <>
            {!onboarding.isLicenseMode && <ProgressBar currentStep={onboarding.step} />}
            <LicenseStep
              licenseLabel={onboarding.licenseLabel ?? 'la credencial habilitante'}
              license={onboarding.license}
              onFile={onboarding.handleLicense}
              onBack={onboarding.goBack}
              onNext={onboarding.goNext}
              isLicenseMode={onboarding.isLicenseMode}
            />
          </>
        );
      case 'references':
        return (
          <>
            <ProgressBar currentStep={onboarding.step} />
            <ReferencesStep
              value={onboarding.formData.references}
              onChange={(v) => onboarding.updateFormField('references', v)}
              onBack={onboarding.goBack}
              onNext={onboarding.goNext}
            />
          </>
        );
      case 'video':
        return (
          <>
            <ProgressBar currentStep={onboarding.step} />
            <VideoStep
              video={onboarding.video}
              onFile={onboarding.handleVideo}
              onBack={onboarding.goBack}
              onNext={onboarding.goNext}
            />
          </>
        );
      case 'zones':
        return (
          <>
            <ProgressBar currentStep={onboarding.step} />
            <ZonesStep
              zones={onboarding.zones}
              selectedIds={onboarding.formData.zoneIds}
              onToggle={onboarding.handleToggleZone}
              onBack={onboarding.goBack}
              onNext={onboarding.goNext}
            />
          </>
        );
      case 'summary':
        return (
          <>
            <ProgressBar currentStep={onboarding.step} />
            <SummaryStep
              professionalName={onboarding.professionalName}
              data={onboarding.formData}
              files={{
                dniFront: onboarding.dniFront,
                dniBack: onboarding.dniBack,
                criminalRecord: onboarding.criminalRecord,
                video: onboarding.video,
                license: onboarding.license,
              }}
              zones={onboarding.selectedZoneNames}
              onBack={onboarding.goBack}
              onSubmit={onboarding.handleSubmit}
              isSubmitting={onboarding.isSubmitting}
            />
          </>
        );
      case 'confirmation':
        return (
          <>
            {!onboarding.isLicenseMode && <ProgressBar currentStep={onboarding.step} />}
            <ConfirmationScreen professionalName={onboarding.professionalName} />
          </>
        );
      default:
        return <ErrorScreen variant="invalid" />;
    }
  };

  return (
    <div className="mx-auto min-h-[100dvh] max-w-[480px] bg-[#F9FAFB] shadow-[0_0_20px_rgba(0,0,0,0.04)]">
      {renderContent()}
    </div>
  );
}
