import { getToken } from './auth.js';

const API_URL = process.env.NORA_API_URL || 'https://api.noraconecta.com';

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  params?: Record<string, string | undefined>,
): Promise<T> {
  const token = await getToken();

  const url = new URL(`${API_URL}${path}`);
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined) url.searchParams.set(k, v);
    });
  }

  const res = await fetch(url.toString(), {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error || `NORA API error: ${res.status}`);
  }

  return res.json() as Promise<T>;
}

export const noraGet = <T>(path: string, params?: Record<string, string | undefined>) =>
  request<T>('GET', path, undefined, params);

export const noraPost = <T>(path: string, body?: unknown) =>
  request<T>('POST', path, body);

export const noraPatch = <T>(path: string, body?: unknown) =>
  request<T>('PATCH', path, body);

export const noraDelete = <T>(path: string) =>
  request<T>('DELETE', path);
