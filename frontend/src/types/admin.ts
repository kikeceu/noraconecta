export type AdminRole = 'SUPERADMIN' | 'OPERATOR';

export type UserStatus = 'ACTIVE' | 'BLOCKED';

export type ProfessionalStatus =
  | 'PENDING'
  | 'UNDER_REVIEW'
  | 'ACTIVE'
  | 'OBSERVATION'
  | 'SUSPENDED'
  | 'PAUSED'
  | 'REJECTED';

export type RequestStatus =
  | 'CREATED'
  | 'ASSIGNED'
  | 'ACCEPTED'
  | 'CANCELLED'
  | 'NO_RESPONSE'
  | 'COMPLETED'
  | 'NOT_FULFILLED';

export type EscalationStatus = 'OPEN' | 'IN_REVIEW' | 'RESOLVED';

export type MembershipStatusKind = 'ACTIVE' | 'INACTIVE' | 'EXPIRED' | 'CANCELED';

export type LicenseStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export type MembershipType = 'MONTHLY' | 'ANNUAL';

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: AdminRole;
}

export interface LoginResponse {
  admin: AdminUser;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  isActive: boolean;
  requiresLicense: boolean;
  licenseLabel: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GeoNode {
  id: string;
  name: string;
  levelId: string | null;
  level?: GeoLevel | null;
  parentId: string | null;
  isActive: boolean;
  children?: GeoNode[];
  createdAt: string;
  updatedAt: string;
}

export interface GeoLevel {
  id: string;
  countryId: string;
  level: number;
  name: string;
}

export interface CountryResponse {
  id: string;
  name: string;
  levels: { id: string; level: number; name: string }[];
}

export interface User {
  id: string;
  phone: string;
  name: string;
  status: UserStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Professional {
  id: string;
  phone: string;
  name: string;
  status: ProfessionalStatus;
  categoryId: string;
  category?: Category;
  availability: string | null;
  dniNumber: string | null;
  dniFrontUrl: string | null;
  dniBackUrl: string | null;
  cuil: string | null;
  criminalRecordUrl: string | null;
  references: string | null;
  presentationVideoUrl: string | null;
  hasBadge: boolean;
  trialRequestsUsed: number;
  lastAssignedAt: string | null;
  declaredHasLicense: boolean | null;
  licenseUrl: string | null;
  licenseStatus: LicenseStatus | null;
  zones?: ProfessionalZone[];
  memberships?: Membership[];
  createdAt: string;
  updatedAt: string;
}

export interface ProfessionalReputationData {
  complianceScore: number;
  completedRequests: number;
  rejectedRequests: number;
  notFulfilledRequests: number;
  totalRequests: number;
  wouldRecommendPct: number;
  averageRating: number;
  averagePunctuality: number;
  averageQuality: number;
  averageCommunication: number;
  averagePriceFairness: number;
  totalRated: number;
}

export interface ProfessionalDetail {
  professional: Professional;
  reputation: ProfessionalReputationData;
}

export interface ProfessionalZone {
  id: string;
  professionalId: string;
  geoNodeId: string;
  geoNode: GeoNode;
}

export interface Plan {
  id: string;
  name: string;
  monthlyPrice: number;
  annualDiscountPct: number;
  isActive: boolean;
  features: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Membership {
  id: string;
  professionalId: string;
  planId: string;
  plan?: Plan;
  type: MembershipType;
  status: MembershipStatusKind;
  startDate: string;
  endDate: string;
  paymentRef: string | null;
  activatedBy: string | null;
  createdAt: string;
  updatedAt: string;
  professional?: Professional;
}

export interface RequestEvent {
  id: string;
  requestId: string;
  professionalId: string | null;
  type: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface RequestOrder {
  id: string;
  userId: string;
  categoryId: string;
  geoNodeId: string;
  description: string;
  photoUrls: string[];
  audioUrl: string | null;
  status: RequestStatus;
  assignedProfessionalId: string | null;
  assignedAt: string | null;
  acceptedAt: string | null;
  completedAt: string | null;
  assignmentTimeoutAt: string | null;
  createdAt: string;
  updatedAt: string;
  user?: User;
  category?: Category;
  geoNode?: GeoNode;
  assignedProfessional?: Professional;
  events?: RequestEvent[];
  feedback?: Feedback | null;
  escalation?: Escalation | null;
}

export interface Feedback {
  id: string;
  requestId: string;
  rating: number | null;
  punctualityRating: number | null;
  qualityRating: number | null;
  communicationRating: number | null;
  priceFairnessRating: number | null;
  wouldRecommend: boolean | null;
  userComment: string | null;
  ratedByUserAt: string | null;
  requestClarityRating: number | null;
  userAvailabilityRating: number | null;
  userTreatmentRating: number | null;
  wouldServeAgain: boolean | null;
  professionalComment: string | null;
  ratedByProfessionalAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Escalation {
  id: string;
  requestId: string;
  reportedBy: string;
  professionalId: string;
  status: EscalationStatus;
  resolution: string | null;
  resolvedBy: string | null;
  createdAt: string;
  updatedAt: string;
  request?: RequestOrder;
  user?: User;
  professional?: Professional;
}

export interface SystemConfig {
  key: string;
  value: string;
  updatedAt: string;
}

export interface DashboardMetrics {
  orders: {
    active: number;
    last24h: number;
    last7d: number;
    total: number;
  };
  acceptanceRate: number;
  coverageRate: number;
  avgAcceptanceTimeMinutes: number | null;
  professionals: {
    active: number;
    pending: number;
    suspended: number;
    total: number;
  };
  escalations: {
    open: number;
    total: number;
  };
  wouldRecommendPct: number;
  ordersByStatus: { status: string; count: number }[];
  ordersLast30Days: { date: string; count: number }[];
  professionalsByStatus: { status: string; count: number }[];
  unfulfilledDemand: { categoryName: string; geoNodeName: string; count: number }[];
}

export interface DemandInsights {
  byCategory: {
    categoryName: string;
    geoNodeName: string;
    count: number;
    lastDate: string;
  }[];
  total: number;
  totalCategories: number;
}

export interface PromptTemplate {
  key: string;
  content: string;
  defaultContent: string;
  description: string;
  variables: string[];
  isEditable: boolean;
  updatedAt: string;
}

export interface AggregatedLLMUsage {
  key: string;
  totalCalls: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCostUsd: number;
  avgDurationMs: number | null;
}

export interface LLMCosts {
  totalCost: number;
  avgCostPerRequest: number;
  byModel: AggregatedLLMUsage[];
  byPromptKey: AggregatedLLMUsage[];
  byProvider: AggregatedLLMUsage[];
  costsByDay: { date: string; totalCalls: number; totalCostUsd: number }[];
  associationBreakdown: {
    associated: { totalCalls: number; totalCostUsd: number };
    general: { totalCalls: number; totalCostUsd: number };
  };
}

export interface WhatsAppTemplateUsage {
  templateName: string;
  category: string;
  totalSent: number;
  totalCostUsd: number;
}

export interface WhatsAppCosts {
  templateUsage: WhatsAppTemplateUsage[];
  serviceConversations: {
    totalConversations: number;
    totalCostUsd: number;
  };
  avgCostPerRequest: number;
  costsByDay: {
    date: string;
    templateCostUsd: number;
    serviceCostUsd: number;
  }[];
}

export interface WhatsAppTemplate {
  name: string;
  category: string;
}

export interface ListResponse<T> {
  data: T[];
  pagination: Pagination;
}

export interface SingleResponse<T> {
  data: T;
}
