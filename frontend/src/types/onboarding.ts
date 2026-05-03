export interface TokenValidationResponse {
  valid: boolean;
  professionalName?: string;
  zones?: ZoneOption[];
}

export interface ZoneOption {
  id: string;
  name: string;
}

export type UploadState = 'empty' | 'uploading' | 'loaded' | 'error';

export interface FileUploadInfo {
  state: UploadState;
  publicUrl?: string;
  error?: string;
  previewUrl?: string;
  filename?: string;
  file?: File;
}

export interface OnboardingFormData {
  dniNumber: string;
  cuil: string;
  dniFrontUrl: string;
  dniBackUrl: string;
  criminalRecordUrl: string;
  references: string;
  presentationVideoUrl: string;
  zoneIds: string[];
}

export type OnboardingStep =
  | 'loading'
  | 'error'
  | 'welcome'
  | 'personal-data'
  | 'dni-photo'
  | 'criminal-record'
  | 'references'
  | 'video'
  | 'zones'
  | 'summary'
  | 'confirmation';

export type ErrorVariant = 'expired' | 'used' | 'invalid';

export const STEPS: { key: OnboardingStep; label: string; number: number }[] = [
  { key: 'welcome', label: 'Bienvenida', number: 1 },
  { key: 'personal-data', label: 'Datos personales', number: 2 },
  { key: 'dni-photo', label: 'Foto del DNI', number: 3 },
  { key: 'criminal-record', label: 'Antecedentes penales', number: 4 },
  { key: 'references', label: 'Referencias', number: 5 },
  { key: 'video', label: 'Video de presentación', number: 6 },
  { key: 'zones', label: 'Zonas de cobertura', number: 7 },
  { key: 'summary', label: 'Resumen', number: 8 },
];

export const TOTAL_STEPS = STEPS.length;

export function getStepInfo(step: OnboardingStep) {
  return STEPS.find((s) => s.key === step);
}
