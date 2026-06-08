import { presignUpload, uploadToR2 } from './api';
import { TokenValidationResponse, OnboardingFormData } from '../types/onboarding';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

async function handleResponse<T>(res: Response): Promise<T> {
  const json = await res.json();

  if (!res.ok) {
    throw new Error(json.error || 'Request failed');
  }

  return json.data as T;
}

export async function validateToken(token: string): Promise<TokenValidationResponse> {
  const res = await fetch(`${API_BASE}/professionals/verify/${encodeURIComponent(token)}`);

  return handleResponse<TokenValidationResponse>(res);
}

export async function submitVerification(
  token: string,
  data: OnboardingFormData,
): Promise<{ status: string }> {
  const res = await fetch(`${API_BASE}/professionals/verify/${encodeURIComponent(token)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      dniNumber: data.dniNumber,
      cuil: data.cuil,
      dniFrontUrl: data.dniFrontUrl,
      dniBackUrl: data.dniBackUrl,
      criminalRecordUrl: data.criminalRecordUrl || undefined,
      references: data.references || undefined,
      presentationVideoUrl: data.presentationVideoUrl || undefined,
      zoneIds: data.zoneIds,
    }),
  });

  return handleResponse<{ status: string }>(res);
}

export async function uploadFile(
  folder: string,
  file: File,
): Promise<{ publicUrl: string }> {
  const { uploadUrl, publicUrl } = await presignUpload(
    folder,
    file.name,
    file.type,
  );

  await uploadToR2(uploadUrl, file, file.type);

  return { publicUrl };
}
