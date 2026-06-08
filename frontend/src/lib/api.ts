import { BotResponse } from '../types/chat';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

export interface PresignUploadResult {
  uploadUrl: string;
  publicUrl: string;
  key: string;
}

export async function presignUpload(
  folder: string,
  filename: string,
  contentType: string,
): Promise<PresignUploadResult> {
  const res = await fetch(`${API_BASE}/storage/presign-upload`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ folder, filename, contentType }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Upload presign failed' }));
    throw new Error(err.error || 'Upload presign failed');
  }

  const json = await res.json();
  return json.data as PresignUploadResult;
}

export async function uploadToR2(uploadUrl: string, blob: Blob, contentType: string): Promise<void> {
  const res = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body: blob,
  });

  if (!res.ok) {
    throw new Error('Upload to R2 failed');
  }
}

export async function sendMessage(
  phone: string,
  text: string,
  role: 'USER' | 'PROFESSIONAL',
  imageUrls?: string[],
  audioUrl?: string,
  location?: { latitude: number; longitude: number },
): Promise<BotResponse> {
  const body: Record<string, unknown> = { phone, text, role };
  if (imageUrls) body.imageUrls = imageUrls;
  if (audioUrl) body.audioUrl = audioUrl;
  if (location) body.location = location;

  const res = await fetch(`${API_BASE}/bot/message`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Network error' }));
    throw new Error(err.error || 'Request failed');
  }

  return res.json();
}

export async function resetSession(phone: string): Promise<void> {
  const res = await fetch(`${API_BASE}/bot/session/reset`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone }),
  });

  if (!res.ok) {
    throw new Error('Failed to reset session');
  }
}

export interface RequestData {
  id: string;
  status: string;
  assignedProfessional?: {
    name: string;
    phone: string;
  } | null;
  category?: {
    name: string;
  } | null;
  coordinationStatus?: string | null;
  scheduledAt?: string | null;
  clientAddress?: string | null;
  coordination?: {
    status: string;
    scheduledAt?: string | null;
    clientAddress?: string | null;
    hasLocation: boolean;
  } | null;
  reassignmentCount?: number;
  lastReassignmentReason?: 'PROFESSIONAL_CANCELLED' | 'TIMEOUT' | null;
}

export async function getRequest(id: string): Promise<RequestData> {
  const res = await fetch(`${API_BASE}/requests/${id}`);

  if (!res.ok) {
    throw new Error('Failed to fetch request');
  }

  const json = await res.json();
  return json.data as RequestData;
}

export async function rateProfessional(
  requestId: string,
  data: {
    rating: number;
    punctualityRating: number;
    qualityRating: number;
    communicationRating: number;
    priceFairnessRating: number;
    wouldRecommend: boolean;
    userComment?: string;
  },
): Promise<void> {
  const res = await fetch(`${API_BASE}/requests/${requestId}/rate-professional`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to rate professional' }));
    throw new Error(err.error || 'Failed to rate professional');
  }
}

export async function confirmRequest(
  requestId: string,
  satisfaction: 'SATISFIED' | 'PARTIAL' | 'UNSATISFIED',
  comment?: string,
): Promise<void> {
  const res = await fetch(`${API_BASE}/requests/${requestId}/confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ satisfaction, comment }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to confirm request' }));
    throw new Error(err.error || 'Failed to confirm request');
  }
}

export async function disputeRequest(requestId: string, reason?: string): Promise<void> {
  const res = await fetch(`${API_BASE}/requests/${requestId}/dispute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to dispute request' }));
    throw new Error(err.error || 'Failed to dispute request');
  }
}
