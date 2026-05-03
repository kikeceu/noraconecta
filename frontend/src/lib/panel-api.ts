import type { PanelData, PanelOrdersResponse } from '../types/panel';

const API_BASE = '/api';

async function request<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`);

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
