import prisma from '../../lib/prisma';
import { User } from '@prisma/client';

export type CreateUserInput = {
  phone: string;
  name: string;
};

export class UsersRepository {
  async findByPhone(phone: string): Promise<User | null> {
    return prisma.user.findUnique({ where: { phone } });
  }

  async findById(id: string): Promise<User | null> {
    return prisma.user.findUnique({ where: { id } });
  }

  async findAll(skip: number, take: number): Promise<{ users: User[]; total: number }> {
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.user.count(),
    ]);

    return { users, total };
  }

  async create(data: CreateUserInput): Promise<User> {
    return prisma.user.create({ data });
  }

  async updateStatus(id: string, status: 'ACTIVE' | 'BLOCKED'): Promise<User> {
    return prisma.user.update({
      where: { id },
      data: { status },
    });
  }
}
