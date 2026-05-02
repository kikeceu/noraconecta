import { randomUUID } from 'crypto';
import {
  ProfessionalsRepository,
  ProfessionalFilters,
} from './professionals.repository';
import { AppError } from '../../middleware/error-handler';
import { Professional, ProfessionalStatus } from '@prisma/client';

const VERIFICATION_TOKEN_TTL_HOURS = 72;
const SESSION_TOKEN_TTL_DAYS = 30;

const BASE_URL = process.env.PUBLIC_URL || 'http://localhost:3000';

export interface PaginatedProfessionalsResponse {
  data: Professional[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export type VerificationStageTwoInput = {
  dniNumber?: string;
  dniFrontUrl?: string;
  dniBackUrl?: string;
  cuil?: string;
  criminalRecordUrl?: string;
  references?: string;
  presentationVideoUrl?: string;
};

function canReceiveRequests(professional: Professional): boolean {
  return professional.status === 'ACTIVE';
}

function notifyProfessionalPendingReview(professional: Professional): void {
  // TODO: Replace with proper notification system (event bus, webhook, etc.)
  // eslint-disable-next-line no-console
  console.log(
    `[NOTIFICATION] PROFESSIONAL_PENDING_REVIEW: ${professional.id} - ${professional.name}`,
  );
}

export class ProfessionalsService {
  constructor(private readonly professionalsRepository: ProfessionalsRepository) {}

  async register(
    phone: string,
    name: string,
    categoryId: string,
  ): Promise<{ professional: Professional; verificationUrl: string }> {
    const trimmedPhone = phone.trim();
    const trimmedName = name.trim();

    if (!trimmedPhone) {
      throw new AppError('Phone is required', 400);
    }

    if (!trimmedName) {
      throw new AppError('Name is required', 400);
    }

    if (!categoryId) {
      throw new AppError('Category is required', 400);
    }

    const existingByPhone = await this.professionalsRepository.findByPhone(trimmedPhone);

    if (existingByPhone) {
      throw new AppError('A professional with this phone already exists', 409);
    }

    const verificationToken = randomUUID();
    const verificationTokenExp = new Date(
      Date.now() + VERIFICATION_TOKEN_TTL_HOURS * 60 * 60 * 1000,
    );

    const professional = await this.professionalsRepository.create({
      phone: trimmedPhone,
      name: trimmedName,
      categoryId,
      verificationToken,
      verificationTokenExp,
    });

    const verificationUrl = `${BASE_URL}/professionals/verify/${verificationToken}`;

    return { professional, verificationUrl };
  }

  async getVerificationTokenStatus(token: string): Promise<{
    valid: boolean;
    professionalName?: string;
  }> {
    if (!token) {
      throw new AppError('Verification token is required', 400);
    }

    const professional = await this.professionalsRepository.findByVerificationToken(token);

    if (!professional) {
      throw new AppError('Verification token not found', 404);
    }

    if (professional.verificationTokenUsed) {
      throw new AppError('Verification token has already been used', 400);
    }

    if (new Date() > professional.verificationTokenExp) {
      throw new AppError('Verification token has expired', 400);
    }

    return {
      valid: true,
      professionalName: professional.name,
    };
  }

  async submitVerification(
    token: string,
    data: VerificationStageTwoInput,
  ): Promise<Professional> {
    if (!token) {
      throw new AppError('Verification token is required', 400);
    }

    const professional = await this.professionalsRepository.findByVerificationToken(token);

    if (!professional) {
      throw new AppError('Verification token not found', 404);
    }

    if (professional.verificationTokenUsed) {
      throw new AppError('Verification token has already been used', 400);
    }

    if (new Date() > professional.verificationTokenExp) {
      throw new AppError('Verification token has expired', 400);
    }

    const updated = await this.professionalsRepository.update(professional.id, {
      ...data,
      status: 'UNDER_REVIEW',
      verificationTokenUsed: true,
    });

    notifyProfessionalPendingReview(updated);

    return updated;
  }

  async approve(id: string): Promise<Professional> {
    const professional = await this.professionalsRepository.findById(id);

    if (!professional) {
      throw new AppError('Professional not found', 404);
    }

    if (professional.status !== 'UNDER_REVIEW') {
      throw new AppError(
        `Cannot approve a professional with status ${professional.status}. Expected UNDER_REVIEW`,
        400,
      );
    }

    return this.professionalsRepository.updateStatus(id, 'ACTIVE');
  }

  async reject(id: string, reason?: string): Promise<Professional> {
    const professional = await this.professionalsRepository.findById(id);

    if (!professional) {
      throw new AppError('Professional not found', 404);
    }

    if (professional.status !== 'UNDER_REVIEW') {
      throw new AppError(
        `Cannot reject a professional with status ${professional.status}. Expected UNDER_REVIEW`,
        400,
      );
    }

    // eslint-disable-next-line no-console
    console.log(`[REJECTION] Professional ${id} rejected. Reason: ${reason || 'N/A'}`);

    return this.professionalsRepository.updateStatus(id, 'REJECTED');
  }

  async suspend(id: string): Promise<Professional> {
    const professional = await this.professionalsRepository.findById(id);

    if (!professional) {
      throw new AppError('Professional not found', 404);
    }

    if (professional.status === 'SUSPENDED') {
      throw new AppError('Professional is already suspended', 409);
    }

    return this.professionalsRepository.updateStatus(id, 'SUSPENDED');
  }

  async reactivate(id: string): Promise<Professional> {
    const professional = await this.professionalsRepository.findById(id);

    if (!professional) {
      throw new AppError('Professional not found', 404);
    }

    if (professional.status !== 'SUSPENDED') {
      throw new AppError(
        `Cannot reactivate a professional with status ${professional.status}. Expected SUSPENDED`,
        400,
      );
    }

    return this.professionalsRepository.updateStatus(id, 'ACTIVE');
  }

  async setBadge(id: string, hasBadge: boolean): Promise<Professional> {
    const professional = await this.professionalsRepository.findById(id);

    if (!professional) {
      throw new AppError('Professional not found', 404);
    }

    if (professional.hasBadge === hasBadge) {
      throw new AppError(
        `Badge is already ${hasBadge ? 'enabled' : 'disabled'}`,
        409,
      );
    }

    return this.professionalsRepository.setBadge(id, hasBadge);
  }

  async generateSessionToken(id: string): Promise<{
    professional: Professional;
    sessionToken: string;
  }> {
    const professional = await this.professionalsRepository.findById(id);

    if (!professional) {
      throw new AppError('Professional not found', 404);
    }

    if (professional.status !== 'ACTIVE') {
      throw new AppError(
        `Cannot generate session token for a professional with status ${professional.status}. Expected ACTIVE`,
        400,
      );
    }

    const sessionToken = randomUUID();
    const sessionTokenExp = new Date(
      Date.now() + SESSION_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
    );

    const updated = await this.professionalsRepository.setSessionToken(
      id,
      sessionToken,
      sessionTokenExp,
    );

    return { professional: updated, sessionToken };
  }

  async getSessionByToken(token: string): Promise<Professional> {
    if (!token) {
      throw new AppError('Session token is required', 400);
    }

    const professional = await this.professionalsRepository.findBySessionToken(token);

    if (!professional) {
      throw new AppError('Session token not found', 404);
    }

    if (!professional.sessionTokenExp || new Date() > professional.sessionTokenExp) {
      throw new AppError('Session token has expired', 401);
    }

    return professional;
  }

  async getById(id: string): Promise<Professional> {
    const professional = await this.professionalsRepository.findById(id);

    if (!professional) {
      throw new AppError('Professional not found', 404);
    }

    return professional;
  }

  async list(
    page: number = 1,
    limit: number = 20,
    status?: string,
    categoryId?: string,
  ): Promise<PaginatedProfessionalsResponse> {
    const validPage = Math.max(1, page);
    const validLimit = Math.min(100, Math.max(1, limit));
    const skip = (validPage - 1) * validLimit;

    const filters: ProfessionalFilters = {};

    if (status) {
      const validStatuses: ProfessionalStatus[] = [
        'PENDING',
        'UNDER_REVIEW',
        'ACTIVE',
        'OBSERVATION',
        'SUSPENDED',
        'PAUSED',
        'REJECTED',
      ];

      if (!validStatuses.includes(status as ProfessionalStatus)) {
        throw new AppError(`Invalid status filter: ${status}`, 400);
      }

      filters.status = status as ProfessionalStatus;
    }

    if (categoryId) {
      filters.categoryId = categoryId;
    }

    const { professionals, total } = await this.professionalsRepository.findAll(
      skip,
      validLimit,
      filters,
    );

    return {
      data: professionals,
      pagination: {
        page: validPage,
        limit: validLimit,
        total,
        totalPages: Math.ceil(total / validLimit),
      },
    };
  }

  async getActiveCandidates(
    categoryId: string,
    geoNodeId: string,
  ): Promise<Professional[]> {
    if (!categoryId) {
      throw new AppError('Category is required', 400);
    }

    if (!geoNodeId) {
      throw new AppError('Geo node is required', 400);
    }

    const candidates = await this.professionalsRepository.findActiveCandidates(
      categoryId,
      geoNodeId,
    );

    return candidates.filter(canReceiveRequests);
  }
}
