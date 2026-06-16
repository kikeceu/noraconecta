import { UsersRepository } from './users.repository';
import { AppError } from '../../middleware/error-handler';
import { User } from '@prisma/client';

export interface PaginatedUsersResponse {
  data: User[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export class UsersService {
  constructor(private readonly usersRepository: UsersRepository) {}

  async findByPhone(phone: string): Promise<User | null> {
    return this.usersRepository.findByPhone(phone);
  }

  async findOrCreateByPhone(phone: string, name?: string): Promise<User> {
    const existing = await this.usersRepository.findByPhone(phone);

    if (existing) {
      return existing;
    }

    const effectiveName = name?.trim() || phone;

    return this.usersRepository.create({
      phone,
      name: effectiveName,
    });
  }

  async isBlocked(phone: string): Promise<boolean> {
    const user = await this.usersRepository.findByPhone(phone);

    if (!user) {
      return false;
    }

    return user.status === 'BLOCKED';
  }

  async list(page: number = 1, limit: number = 20): Promise<PaginatedUsersResponse> {
    const validPage = Math.max(1, page);
    const validLimit = Math.min(100, Math.max(1, limit));
    const skip = (validPage - 1) * validLimit;

    const { users, total } = await this.usersRepository.findAll(skip, validLimit);

    return {
      data: users,
      pagination: {
        page: validPage,
        limit: validLimit,
        total,
        totalPages: Math.ceil(total / validLimit),
      },
    };
  }

  async getById(id: string): Promise<User> {
    const user = await this.usersRepository.findById(id);

    if (!user) {
      throw new AppError('User not found', 404);
    }

    return user;
  }

  async block(id: string): Promise<User> {
    const user = await this.usersRepository.findById(id);

    if (!user) {
      throw new AppError('User not found', 404);
    }

    if (user.status === 'BLOCKED') {
      throw new AppError('User is already blocked', 409);
    }

    return this.usersRepository.updateStatus(id, 'BLOCKED');
  }

  async unblock(id: string): Promise<User> {
    const user = await this.usersRepository.findById(id);

    if (!user) {
      throw new AppError('User not found', 404);
    }

    if (user.status === 'ACTIVE') {
      throw new AppError('User is already active', 409);
    }

    return this.usersRepository.updateStatus(id, 'ACTIVE');
  }

  async updateName(id: string, name: string): Promise<User> {
    return this.usersRepository.updateName(id, name);
  }
}
