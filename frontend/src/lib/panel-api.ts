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
