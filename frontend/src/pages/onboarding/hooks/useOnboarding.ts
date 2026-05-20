import { useState, useCallback, useEffect, useRef } from 'react';
import {
  OnboardingStep,
  OnboardingFormData,
  FileUploadInfo,
  ZoneOption,
  TokenValidationResponse,
  ErrorVariant,
} from '../../../types/onboarding';
import { validateToken, submitVerification, uploadFile } from '../../../lib/onboarding-api';

const STORAGE_KEY_PREFIX = 'nora_onboarding_';

function emptyUploadState(): FileUploadInfo {
  return { state: 'empty' };
}

function initialFormData(): OnboardingFormData {
  return {
    dniNumber: '',
    cuil: '',
    dniFrontUrl: '',
    dniBackUrl: '',
    criminalRecordUrl: '',
    references: '',
    presentationVideoUrl: '',
    zoneIds: [],
  };
}

const STEPS_ORDER: OnboardingStep[] = [
  'welcome',
  'personal-data',
  'dni-photo',
  'criminal-record',
  'references',
  'video',
  'zones',
  'summary',
];

export function useOnboarding(token: string) {
  const [step, setStep] = useState<OnboardingStep>('loading');
  const [errorVariant, setErrorVariant] = useState<ErrorVariant>('invalid');
  const [errorMessage, setErrorMessage] = useState('');
  const [professionalName, setProfessionalName] = useState('');
  const [zones, setZones] = useState<ZoneOption[]>([]);
  const [formData, setFormData] = useState<OnboardingFormData>(initialFormData);
  const [dniFront, setDniFront] = useState<FileUploadInfo>(emptyUploadState);
  const [dniBack, setDniBack] = useState<FileUploadInfo>(emptyUploadState);
  const [criminalRecord, setCriminalRecord] = useState<FileUploadInfo>(emptyUploadState);
  const [video, setVideo] = useState<FileUploadInfo>(emptyUploadState);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const tokenRef = useRef(token);

  const clearStorage = useCallback(() => {
    try {
      localStorage.removeItem(`${STORAGE_KEY_PREFIX}${tokenRef.current}`);
      localStorage.removeItem(`${STORAGE_KEY_PREFIX}${tokenRef.current}_formData`);
    } catch {
      // ignore
    }
  }, []);

  const persistFormData = useCallback((data: OnboardingFormData) => {
    try {
      localStorage.setItem(`${STORAGE_KEY_PREFIX}${tokenRef.current}_formData`, JSON.stringify(data));
    } catch {
      // ignore
    }
  }, []);

  const restoreFormData = useCallback((): OnboardingFormData | null => {
    try {
      const stored = localStorage.getItem(`${STORAGE_KEY_PREFIX}${tokenRef.current}_formData`);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      try {
        const data: TokenValidationResponse = await validateToken(token);

        if (!data.valid) {
          setStep('error');
          setErrorVariant('invalid');
          return;
        }

    setProfessionalName(data.professionalName || '');
    setZones(data.zones || []);

    const restored = restoreFormData();
    if (restored) {
      setFormData(restored);
    }

    const apiZoneIds = (data.zones || []).map((z) => z.id);
    setFormData((prev) => {
      if (prev.zoneIds.length === 0) {
        return { ...prev, zoneIds: apiZoneIds };
      }
      return prev;
    });

    setStep('welcome');
      } catch (err) {
        setStep('error');
        const message = (err instanceof Error ? err.message : '').toLowerCase();

        if (message.includes('expired')) {
          setErrorVariant('expired');
          setErrorMessage(err instanceof Error ? err.message : '');
        } else if (message.includes('already been used')) {
          setErrorVariant('used');
          setErrorMessage(err instanceof Error ? err.message : '');
        } else {
          setErrorVariant('invalid');
          setErrorMessage(err instanceof Error ? err.message : '');
        }
      }
    };

    init();
  }, [token, restoreFormData]);

  const updateFormField = useCallback(
    (field: keyof OnboardingFormData, value: string) => {
      setFormData((prev) => {
        const next = { ...prev, [field]: value };
        persistFormData(next);
        return next;
      });
    },
    [persistFormData],
  );

  const handleFileUpload = useCallback(
    async (
      setter: (info: FileUploadInfo) => void,
      folder: string,
      file: File,
    ) => {
      const previewUrl = URL.createObjectURL(file);
      setter({
        state: 'uploading',
        filename: file.name,
        file,
        previewUrl,
      });

      try {
        const { publicUrl } = await uploadFile(folder, file);
        setter({
          state: 'loaded',
          publicUrl,
          filename: file.name,
          previewUrl,
        });
        return publicUrl;
      } catch (err) {
        setter({
          state: 'error',
          error: err instanceof Error ? err.message : 'Error al subir',
          filename: file.name,
          previewUrl,
        });
        return null;
      }
    },
    [],
  );

  const handleDniFront = useCallback(
    (file: File) => {
      handleFileUpload(setDniFront, 'verification', file).then((url) => {
        if (url) updateFormField('dniFrontUrl', url);
      });
    },
    [handleFileUpload, updateFormField],
  );

  const handleDniBack = useCallback(
    (file: File) => {
      handleFileUpload(setDniBack, 'verification', file).then((url) => {
        if (url) updateFormField('dniBackUrl', url);
      });
    },
    [handleFileUpload, updateFormField],
  );

  const handleCriminalRecord = useCallback(
    (file: File) => {
      handleFileUpload(setCriminalRecord, 'verification', file).then((url) => {
        if (url) updateFormField('criminalRecordUrl', url);
      });
    },
    [handleFileUpload, updateFormField],
  );

  const handleVideo = useCallback(
    (file: File) => {
      handleFileUpload(setVideo, 'verification', file).then((url) => {
        if (url) updateFormField('presentationVideoUrl', url);
      });
    },
    [handleFileUpload, updateFormField],
  );

  const handleToggleZone = useCallback(
    (zoneId: string) => {
      setFormData((prev) => {
        const nextIds = prev.zoneIds.includes(zoneId)
          ? prev.zoneIds.filter((id) => id !== zoneId)
          : [...prev.zoneIds, zoneId];
        const next = { ...prev, zoneIds: nextIds };
        persistFormData(next);
        return next;
      });
    },
    [persistFormData],
  );

  const goToStep = useCallback((nextStep: OnboardingStep) => {
    setStep(nextStep);
    window.scrollTo(0, 0);
  }, []);

  const goNext = useCallback(() => {
    const currentIdx = STEPS_ORDER.indexOf(step);
    if (currentIdx >= 0 && currentIdx < STEPS_ORDER.length - 1) {
      goToStep(STEPS_ORDER[currentIdx + 1]);
    }
  }, [step, goToStep]);

  const goBack = useCallback(() => {
    const currentIdx = STEPS_ORDER.indexOf(step);
    if (currentIdx > 0) {
      goToStep(STEPS_ORDER[currentIdx - 1]);
    }
  }, [step, goToStep]);

  const handleSubmit = useCallback(async () => {
    setIsSubmitting(true);
    try {
      await submitVerification(token, formData);
      clearStorage();
      setStep('confirmation');
    } catch (err) {
      setErrorVariant('invalid');
      setErrorMessage(err instanceof Error ? err.message : 'Error al enviar');
      setStep('error');
    } finally {
      setIsSubmitting(false);
    }
  }, [token, formData, clearStorage]);

  const handleStart = useCallback(() => {
    goNext();
  }, [goNext]);

  const selectedZoneNames = formData.zoneIds
    .map((id) => zones.find((z) => z.id === id)?.name)
    .filter((n): n is string => !!n);

  return {
    step,
    errorVariant,
    errorMessage,
    professionalName,
    zones,
    formData,
    updateFormField,
    dniFront,
    dniBack,
    criminalRecord,
    video,
    handleDniFront,
    handleDniBack,
    handleCriminalRecord,
    handleVideo,
    handleToggleZone,
    goNext,
    goBack,
    handleSubmit,
    handleStart,
    isSubmitting,
    selectedZoneNames,
  };
}
