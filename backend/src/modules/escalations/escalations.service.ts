import { EscalationsRepository, EscalationFilters } from './escalations.repository';
import { AppError } from '../../middleware/error-handler';
import { Escalation, EscalationStatus } from '@prisma/client';
import { Prisma } from '@prisma/client';

export interface PaginatedEscalationsResponse {
  data: Escalation[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

const VALID_STATUS_TRANSITIONS: Record<EscalationStatus, EscalationStatus[]> = {
  OPEN: ['IN_REVIEW', 'RESOLVED'],
  IN_REVIEW: ['RESOLVED'],
  RESOLVED: [],
};

function logAlert(type: string, escalationId: string): void {
  // eslint-disable-next-line no-console
  console.log(`[ALERT] ${type}: escalation=${escalationId}`);
}

export class EscalationsService {
  constructor(
    private readonly escalationsRepository: EscalationsRepository,
  ) {}

  async create(
    requestId: string,
    reportedBy: string,
    professionalId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<Escalation> {
    const escalation = await this.escalationsRepository.create(
      { requestId, reportedBy, professionalId },
      tx,
    );

    logAlert('ESCALATION_CREATED', escalation.id);

    return escalation;
  }

  async list(
    page: number = 1,
    limit: number = 20,
    status?: EscalationStatus,
    professionalId?: string,
  ): Promise<PaginatedEscalationsResponse> {
    const validPage = Math.max(1, page);
    const validLimit = Math.min(100, Math.max(1, limit));
    const skip = (validPage - 1) * validLimit;

    const filters: EscalationFilters = {};

    if (status) {
      filters.status = status;
    }

    if (professionalId) {
      filters.professionalId = professionalId;
    }

    const { escalations, total } =
      await this.escalationsRepository.findAll(skip, validLimit, filters);

    return {
      data: escalations,
      pagination: {
        page: validPage,
        limit: validLimit,
        total,
        totalPages: Math.ceil(total / validLimit),
      },
    };
  }

  async getById(id: string): Promise<Escalation> {
    const escalation = await this.escalationsRepository.findById(id);

    if (!escalation) {
      throw new AppError('Escalation not found', 404);
    }

    return escalation;
  }

  async updateStatus(
    id: string,
    newStatus: EscalationStatus,
  ): Promise<Escalation> {
    const escalation = await this.escalationsRepository.findById(id);

    if (!escalation) {
      throw new AppError('Escalation not found', 404);
    }

    const allowed = VALID_STATUS_TRANSITIONS[escalation.status];

    if (!allowed.includes(newStatus)) {
      throw new AppError(
        `Cannot transition escalation from ${escalation.status} to ${newStatus}. Allowed: ${allowed.join(', ') || 'none'}`,
        400,
      );
    }

    return this.escalationsRepository.updateStatus(id, newStatus);
  }

  async resolve(
    id: string,
    resolution: string,
    resolvedBy?: string,
  ): Promise<Escalation> {
    const escalation = await this.escalationsRepository.findById(id);

    if (!escalation) {
      throw new AppError('Escalation not found', 404);
    }

    if (escalation.status === 'RESOLVED') {
      throw new AppError('Escalation is already resolved', 409);
    }

    if (!resolution || !resolution.trim()) {
      throw new AppError('Resolution text is required', 400);
    }

    return this.escalationsRepository.resolve(id, resolution.trim(), resolvedBy);
  }
}
