import prisma from '../../lib/prisma';
import { Admin } from '@prisma/client';

export type CreateAdminInput = {
  email: string;
  passwordHash: string;
  name: string;
  role: 'SUPERADMIN' | 'OPERATOR';
};

export class AuthRepository {
  async findByEmail(email: string): Promise<Admin | null> {
    return prisma.admin.findUnique({ where: { email } });
  }

  async create(data: CreateAdminInput): Promise<Admin> {
    return prisma.admin.create({ data });
  }

  async count(): Promise<number> {
    return prisma.admin.count();
  }
}
