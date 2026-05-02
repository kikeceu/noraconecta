import { BotResponse } from '../types/chat';

const API_BASE = '/api';

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
