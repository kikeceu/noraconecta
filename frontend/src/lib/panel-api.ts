import type { PanelData, PanelOrdersResponse, PendingRequestsResponse } from '../types/panel';

const API_BASE = '/api';

async function request<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`);

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed with status ${res.status}`);
  }

  return res.json();
}

async function postRequest<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { method: 'POST' });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed with status ${res.status}`);
  }

  return res.json();
}

export async function getPanelData(sessionToken: string): Promise<PanelData> {
  const res = await request<{ data: PanelData }>(
    `/professionals/session/${encodeURIComponent(sessionToken)}/panel`,
  );
  return res.data;
}

export async function getPanelOrders(
  sessionToken: string,
  page: number = 1,
  limit: number = 20,
): Promise<PanelOrdersResponse> {
  const res = await request<PanelOrdersResponse>(
    `/professionals/session/${encodeURIComponent(sessionToken)}/orders?page=${page}&limit=${limit}`,
  );
  return res;
}

export async function getPendingRequests(
  sessionToken: string,
): Promise<PendingRequestsResponse> {
  const res = await request<PendingRequestsResponse>(
    `/professionals/session/${encodeURIComponent(sessionToken)}/pending-requests`,
  );
  return res;
}

export async function acceptRequest(requestId: string): Promise<{ id: string; status: string }> {
  const res = await postRequest<{ data: { id: string; status: string } }>(
    `/requests/${encodeURIComponent(requestId)}/accept`,
  );
  return res.data;
}

export async function rejectRequest(requestId: string): Promise<{ id: string; status: string }> {
  const res = await postRequest<{ data: { id: string; status: string } }>(
    `/requests/${encodeURIComponent(requestId)}/reject`,
  );
  return res.data;
}

export async function rateUser(
  requestId: string,
  data: {
    requestClarityRating: number;
    userAvailabilityRating: number;
    userTreatmentRating: number;
    wouldServeAgain: boolean;
    professionalComment?: string;
  },
): Promise<void> {
  const res = await fetch(`/api/requests/${encodeURIComponent(requestId)}/rate-user`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Failed to rate user`);
  }
}

export async function finishRequest(requestId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/requests/${requestId}/finish`, {
    method: 'POST',
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to finish request' }));
    throw new Error(err.error || 'Failed to finish request');
  }
}

export async function sendBotMessage(
  phone: string,
  text: string,
  role: 'USER' | 'PROFESSIONAL',
): Promise<void> {
  const res = await fetch(`${API_BASE}/bot/message`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, text, role }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to send message' }));
    throw new Error(err.error || 'Failed to send message');
  }
}

export async function cancelByProfessionalRequest(
  requestId: string,
  professionalId: string,
): Promise<void> {
  const res = await fetch(`${API_BASE}/requests/${requestId}/cancel-by-professional`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ professionalId }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to cancel request' }));
    throw new Error(err.error || 'Failed to cancel request');
  }
}

export async function confirmVisitRequest(
  requestId: string,
  scheduleText: string,
): Promise<void> {
  const res = await fetch(`${API_BASE}/requests/${requestId}/confirm-visit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scheduleText }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to confirm visit' }));
    throw new Error(err.error || 'Failed to confirm visit');
  }
}

export async function confirmScheduleRequest(
  requestId: string,
  scheduleText: string,
  proposedAt: string | null,
): Promise<void> {
  const res = await fetch(`${API_BASE}/requests/${requestId}/confirm-schedule`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scheduleText, proposedAt }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to confirm schedule' }));
    throw new Error(err.error || 'Failed to confirm schedule');
  }
}
