import type {
  LoginResponse,
  DashboardMetrics,
  Category,
  CountryResponse,
  GeoNode,
  User,
  Professional,
  ProfessionalDetail,
  Plan,
  Membership,
  RequestOrder,
  Escalation,
  SystemConfig,
  ListResponse,
  SingleResponse,
  EscalationStatus,
} from '../types/admin';

const BASE = import.meta.env.VITE_API_URL || '/api';

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };

  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers,
    credentials: 'include',
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed with status ${res.status}`);
  }

  return res.json();
}

function buildQuery(params: Record<string, string | number | undefined>): string {
  const entries = Object.entries(params).filter(
    ([, v]) => v !== undefined && v !== '',
  );
  if (entries.length === 0) return '';
  return '?' + new URLSearchParams(
    entries.map(([k, v]) => [k, String(v)]),
  ).toString();
}

// Auth
export function login(email: string, password: string): Promise<LoginResponse> {
  return request<LoginResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export function logout(): Promise<{ ok: true }> {
  return request<{ ok: true }>('/auth/logout', {
    method: 'POST',
  });
}

export function getMe(): Promise<{ admin: LoginResponse['admin'] }> {
  return request<{ admin: LoginResponse['admin'] }>('/auth/me');
}

// Dashboard
export function getDashboardMetrics(geoNodeId?: string): Promise<SingleResponse<DashboardMetrics>> {
  const query = geoNodeId ? `?geoNodeId=${geoNodeId}` : '';
  return request<SingleResponse<DashboardMetrics>>(`/admin/metrics${query}`);
}

export function getGeoTree(): Promise<{
  data: {
    provinces: { id: string; name: string; departments: { id: string; name: string }[] }[];
  };
}> {
  return request('/admin/geo-tree');
}

// Categories
export function getCategories(): Promise<ListResponse<Category>> {
  return request<ListResponse<Category>>('/categories');
}

export function createCategory(data: {
  name: string;
  description?: string;
}): Promise<SingleResponse<Category>> {
  return request<SingleResponse<Category>>('/categories', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updateCategory(
  id: string,
  data: { name?: string; description?: string },
): Promise<SingleResponse<Category>> {
  return request<SingleResponse<Category>>(`/categories/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export function toggleCategory(
  id: string,
): Promise<SingleResponse<{ id: string; isActive: boolean }>> {
  return request<SingleResponse<{ id: string; isActive: boolean }>>(
    `/categories/${id}/toggle`,
    { method: 'PATCH' },
  );
}

// Locations (Zones)
export function getCountries(): Promise<ListResponse<CountryResponse>> {
  return request<ListResponse<CountryResponse>>('/locations/countries');
}

export function getLocationTree(
  countryId: string,
): Promise<SingleResponse<GeoNode>> {
  return request<SingleResponse<GeoNode>>(`/locations/tree/${countryId}`);
}

export function createCountry(data: {
  name: string;
  levels: { level: number; name: string }[];
}): Promise<SingleResponse<CountryResponse>> {
  return request<SingleResponse<CountryResponse>>('/locations/countries', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function createGeoNode(data: {
  name: string;
  levelId: string;
  parentId: string;
}): Promise<SingleResponse<GeoNode>> {
  return request<SingleResponse<GeoNode>>('/locations/nodes', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function toggleGeoNode(
  id: string,
): Promise<SingleResponse<{ id: string; isActive: boolean }>> {
  return request<SingleResponse<{ id: string; isActive: boolean }>>(
    `/locations/nodes/${id}/toggle`,
    { method: 'PATCH' },
  );
}

export function updateGeoNode(
  id: string,
  name: string,
): Promise<SingleResponse<GeoNode>> {
  return request<SingleResponse<GeoNode>>(`/locations/nodes/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ name }),
  });
}

// Users
export function getUsers(
  params?: { page?: number; limit?: number },
): Promise<ListResponse<User>> {
  return request<ListResponse<User>>(`/users${buildQuery(params || {})}`);
}

export function getUser(id: string): Promise<SingleResponse<User>> {
  return request<SingleResponse<User>>(`/users/${id}`);
}

export function blockUser(id: string): Promise<SingleResponse<User>> {
  return request<SingleResponse<User>>(`/users/${id}/block`, {
    method: 'PATCH',
  });
}

export function unblockUser(id: string): Promise<SingleResponse<User>> {
  return request<SingleResponse<User>>(`/users/${id}/unblock`, {
    method: 'PATCH',
  });
}

// Professionals
export function getProfessionals(params?: {
  page?: number;
  limit?: number;
  status?: string;
  categoryId?: string;
  departmentId?: string;
}): Promise<ListResponse<Professional>> {
  return request<ListResponse<Professional>>(
    `/professionals${buildQuery(params || {})}`,
  );
}

export function getDepartments(): Promise<{ data: { id: string; name: string }[] }> {
  return request('/professionals/departments');
}

export function getProfessional(
  id: string,
): Promise<SingleResponse<ProfessionalDetail>> {
  return request<SingleResponse<ProfessionalDetail>>(`/professionals/${id}`);
}

export function approveProfessional(
  id: string,
): Promise<SingleResponse<Professional>> {
  return request<SingleResponse<Professional>>(`/professionals/${id}/approve`, {
    method: 'POST',
  });
}

export function rejectProfessional(
  id: string,
  reason?: string,
): Promise<SingleResponse<Professional>> {
  return request<SingleResponse<Professional>>(`/professionals/${id}/reject`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

export function suspendProfessional(
  id: string,
): Promise<SingleResponse<Professional>> {
  return request<SingleResponse<Professional>>(
    `/professionals/${id}/suspend`,
    { method: 'POST' },
  );
}

export function reactivateProfessional(
  id: string,
): Promise<SingleResponse<Professional>> {
  return request<SingleResponse<Professional>>(
    `/professionals/${id}/reactivate`,
    { method: 'POST' },
  );
}

export function toggleProfessionalBadge(
  id: string,
  hasBadge: boolean,
): Promise<SingleResponse<Professional>> {
  return request<SingleResponse<Professional>>(`/professionals/${id}/badge`, {
    method: 'PATCH',
    body: JSON.stringify({ hasBadge }),
  });
}

export function generateSession(
  id: string,
): Promise<SingleResponse<{ professional: Professional; sessionToken: string; panelUrl: string }>> {
  return request<SingleResponse<{ professional: Professional; sessionToken: string; panelUrl: string }>>(
    `/professionals/${id}/generate-session`,
    { method: 'POST' },
  );
}

// Memberships
export function getMembership(
  professionalId: string,
): Promise<SingleResponse<{ canReceiveRequests: boolean; activeMembership: Membership | null; trialRequestsUsed: number; trialRequestsLimit: number }>> {
  return request<
    SingleResponse<{
      canReceiveRequests: boolean;
      activeMembership: Membership | null;
      trialRequestsUsed: number;
      trialRequestsLimit: number;
    }>
  >(`/professionals/${professionalId}/membership`);
}

export function activateMembership(
  professionalId: string,
  planId: string,
  type: string,
): Promise<SingleResponse<Membership>> {
  return request<SingleResponse<Membership>>(
    `/professionals/${professionalId}/membership`,
    {
      method: 'POST',
      body: JSON.stringify({ planId, type }),
    },
  );
}

// Plans
export function getPlans(): Promise<ListResponse<Plan>> {
  return request<ListResponse<Plan>>('/plans');
}

export function updatePlan(
  id: string,
  data: { monthlyPrice?: number; annualDiscountPct?: number },
): Promise<SingleResponse<Plan>> {
  return request<SingleResponse<Plan>>(`/plans/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export function getPaymentLink(
  professionalId: string,
  planId: string,
): Promise<SingleResponse<{ url: string }>> {
  return request<SingleResponse<{ url: string }>>('/payments/link', {
    method: 'POST',
    body: JSON.stringify({ professionalId, planId }),
  });
}

// Requests (Orders)
export function getRequests(params?: {
  page?: number;
  limit?: number;
}): Promise<ListResponse<RequestOrder>> {
  return request<ListResponse<RequestOrder>>(
    `/requests${buildQuery(params || {})}`,
  );
}

export function getRequest(
  id: string,
): Promise<SingleResponse<RequestOrder>> {
  return request<SingleResponse<RequestOrder>>(`/requests/${id}`);
}

// Escalations
export function getEscalations(params?: {
  page?: number;
  limit?: number;
  status?: EscalationStatus;
  professionalId?: string;
}): Promise<ListResponse<Escalation>> {
  return request<ListResponse<Escalation>>(
    `/escalations${buildQuery(params || {})}`,
  );
}

export function getEscalation(
  id: string,
): Promise<SingleResponse<Escalation>> {
  return request<SingleResponse<Escalation>>(`/escalations/${id}`);
}

export function changeEscalationStatus(
  id: string,
  status: EscalationStatus,
): Promise<SingleResponse<Escalation>> {
  return request<SingleResponse<Escalation>>(`/escalations/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

export function resolveEscalation(
  id: string,
  resolution: string,
): Promise<SingleResponse<Escalation>> {
  return request<SingleResponse<Escalation>>(`/escalations/${id}/resolve`, {
    method: 'PATCH',
    body: JSON.stringify({ resolution }),
  });
}

// Config
export function getConfig(): Promise<ListResponse<SystemConfig>> {
  return request<ListResponse<SystemConfig>>('/config');
}

export function updateConfig(
  key: string,
  value: string,
): Promise<SingleResponse<SystemConfig>> {
  return request<SingleResponse<SystemConfig>>(`/config/${key}`, {
    method: 'PATCH',
    body: JSON.stringify({ value }),
  });
}
