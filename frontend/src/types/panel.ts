export interface PanelProfessional {
  id: string;
  name: string;
  phone: string;
  status: ProfessionalStatus;
  category: { id: string; name: string } | null;
  zones: { id: string; name: string }[];
  availability: string | null;
  hasBadge: boolean;
  dniFrontUrl: string | null;
  dniBackUrl: string | null;
  criminalRecordUrl: string | null;
  cuil: string | null;
  references: string | null;
  presentationVideoUrl: string | null;
}

export type ProfessionalStatus =
  | 'PENDING'
  | 'UNDER_REVIEW'
  | 'ACTIVE'
  | 'OBSERVATION'
  | 'SUSPENDED'
  | 'PAUSED'
  | 'REJECTED';

export interface PanelMembershipData {
  activeMembership: {
    id: string;
    planId: string;
    type: 'MONTHLY' | 'ANNUAL';
    status: 'ACTIVE' | 'INACTIVE' | 'EXPIRED';
    startDate: string;
    endDate: string;
    paymentRef: string | null;
    plan: {
      id: string;
      name: string;
      monthlyPrice: number;
      annualDiscountPct: number;
    };
  } | null;
  trialRequestsUsed: number;
  trialRequestsLimit: number;
}

export interface PanelReputation {
  complianceScore: number;
  completedRequests: number;
  rejectedRequests: number;
  notFulfilledRequests: number;
  totalRequests: number;
  wouldRecommendPct: number;
}

export interface PanelData {
  professional: PanelProfessional;
  membership: PanelMembershipData;
  reputation: PanelReputation;
}

export interface PanelOrder {
  id: string;
  createdAt: string;
  status: OrderStatus;
  category: { id: string; name: string } | null;
  geoNode: { id: string; name: string } | null;
}

export type OrderStatus =
  | 'CREATED'
  | 'ASSIGNED'
  | 'ACCEPTED'
  | 'CANCELLED'
  | 'NO_RESPONSE'
  | 'COMPLETED'
  | 'NOT_FULFILLED';

export interface PanelOrdersResponse {
  data: PanelOrder[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export type PanelTab = 'profile' | 'membership' | 'orders' | 'reputation';
