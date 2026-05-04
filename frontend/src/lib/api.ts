import { BotResponse } from '../types/chat';

const API_BASE = '/api';

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
): Promise<BotResponse> {
  const res = await fetch(`${API_BASE}/bot/message`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, text, role, imageUrls, audioUrl }),
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
  } | null;
}

export async function getRequest(id: string): Promise<RequestData> {
  const res = await fetch(`${API_BASE}/requests/${id}`);

  if (!res.ok) {
    throw new Error('Failed to fetch request');
  }

  const json = await res.json();
  return json.data as RequestData;
}
