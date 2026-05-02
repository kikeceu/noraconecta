import prisma from '../../lib/prisma';
import { Category } from '@prisma/client';

export type CreateCategoryInput = {
  name: string;
  slug: string;
  description?: string;
};

export type UpdateCategoryInput = {
  name?: string;
  description?: string;
};

export class CategoriesRepository {
  async findAll(): Promise<Category[]> {
    return prisma.category.findMany({ orderBy: { name: 'asc' } });
  }

  async findAllActive(): Promise<Category[]> {
    return prisma.category.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  async findById(id: string): Promise<Category | null> {
    return prisma.category.findUnique({ where: { id } });
  }

  async findByName(name: string): Promise<Category | null> {
    return prisma.category.findUnique({ where: { name } });
  }

  async findBySlug(slug: string): Promise<Category | null> {
    return prisma.category.findUnique({ where: { slug } });
  }

  async create(data: CreateCategoryInput): Promise<Category> {
    return prisma.category.create({ data });
  }

  async update(id: string, data: UpdateCategoryInput): Promise<Category> {
    return prisma.category.update({ where: { id }, data });
  }

  async toggleActive(id: string, isActive: boolean): Promise<Category> {
    return prisma.category.update({
      where: { id },
      data: { isActive },
    });
  }
}
