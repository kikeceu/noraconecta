import { CategoriesRepository } from './categories.repository';
import { AppError } from '../../middleware/error-handler';
import { Category } from '@prisma/client';

const MAX_LEVENSHTEIN_DISTANCE = 3;

function generateSlug(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function levenshteinDistance(a: string, b: string): number {
  const aLen = a.length;
  const bLen = b.length;

  if (aLen === 0) return bLen;
  if (bLen === 0) return aLen;

  let prevRow = Array.from({ length: bLen + 1 }, (_, i) => i);
  let currRow = new Array<number>(bLen + 1);

  for (let i = 1; i <= aLen; i++) {
    currRow[0] = i;

    for (let j = 1; j <= bLen; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      currRow[j] = Math.min(
        prevRow[j] + 1,
        currRow[j - 1] + 1,
        prevRow[j - 1] + cost,
      );
    }

    const temp = prevRow;
    prevRow = currRow;
    currRow = temp;
  }

  return prevRow[bLen];
}

export class CategoriesService {
  constructor(private readonly categoriesRepository: CategoriesRepository) {}

  async getAll(): Promise<Category[]> {
    return this.categoriesRepository.findAll();
  }

  async getActive(): Promise<Category[]> {
    return this.categoriesRepository.findAllActive();
  }

  async getById(id: string): Promise<Category> {
    const category = await this.categoriesRepository.findById(id);

    if (!category) {
      throw new AppError('Category not found', 404);
    }

    return category;
  }

  async create(
    name: string,
    description?: string,
    requiresLicense?: boolean,
    licenseLabel?: string,
  ): Promise<Category> {
    const trimmedName = name.trim();

    if (!trimmedName) {
      throw new AppError('Category name is required', 400);
    }

    const existingName = await this.categoriesRepository.findByName(trimmedName);

    if (existingName) {
      throw new AppError('A category with this name already exists', 409);
    }

    const slug = generateSlug(trimmedName);

    if (!slug) {
      throw new AppError('Could not generate a valid slug from the provided name', 400);
    }

    const existingSlug = await this.categoriesRepository.findBySlug(slug);

    if (existingSlug) {
      throw new AppError('A category with this slug already exists', 409);
    }

    return this.categoriesRepository.create({
      name: trimmedName,
      slug,
      description: description?.trim() || undefined,
      requiresLicense: requiresLicense ?? undefined,
      licenseLabel: licenseLabel?.trim() || undefined,
    });
  }

  async update(
    id: string,
    name?: string,
    description?: string,
    requiresLicense?: boolean,
    licenseLabel?: string,
  ): Promise<Category> {
    const category = await this.categoriesRepository.findById(id);

    if (!category) {
      throw new AppError('Category not found', 404);
    }

    const data: {
      name?: string;
      description?: string;
      requiresLicense?: boolean;
      licenseLabel?: string | null;
    } = {};

    if (name !== undefined) {
      const trimmedName = name.trim();

      if (!trimmedName) {
        throw new AppError('Category name cannot be empty', 400);
      }

      if (trimmedName !== category.name) {
        const existingName = await this.categoriesRepository.findByName(trimmedName);

        if (existingName && existingName.id !== id) {
          throw new AppError('A category with this name already exists', 409);
        }
      }

      data.name = trimmedName;
    }

    if (description !== undefined) {
      data.description = description.trim() || '';
    }

    if (requiresLicense !== undefined) {
      data.requiresLicense = requiresLicense;
    }

    if (licenseLabel !== undefined) {
      data.licenseLabel = licenseLabel.trim() || null;
    }

    return this.categoriesRepository.update(id, data);
  }

  async toggle(id: string): Promise<{ id: string; isActive: boolean }> {
    const category = await this.categoriesRepository.findById(id);

    if (!category) {
      throw new AppError('Category not found', 404);
    }

    const newState = !category.isActive;
    const updated = await this.categoriesRepository.toggleActive(id, newState);

    return { id: updated.id, isActive: updated.isActive };
  }

  async findBySlugOrName(query: string): Promise<Category | null> {
    const normalized = query.trim().toLowerCase();

    if (!normalized) {
      return null;
    }

    const bySlug = await this.categoriesRepository.findBySlug(normalized);

    if (bySlug && bySlug.isActive) {
      return bySlug;
    }

    const byName = await this.categoriesRepository.findByName(normalized);

    if (byName && byName.isActive) {
      return byName;
    }

    const activeCategories = await this.categoriesRepository.findAllActive();
    let bestMatch: Category | null = null;
    let bestDistance = MAX_LEVENSHTEIN_DISTANCE + 1;

    for (const cat of activeCategories) {
      const nameDist = levenshteinDistance(
        normalized,
        cat.name.toLowerCase(),
      );

      if (nameDist < bestDistance) {
        bestDistance = nameDist;
        bestMatch = cat;
      }

      const slugDist = levenshteinDistance(
        normalized,
        cat.slug.toLowerCase(),
      );

      if (slugDist < bestDistance) {
        bestDistance = slugDist;
        bestMatch = cat;
      }
    }

    if (bestDistance <= MAX_LEVENSHTEIN_DISTANCE && bestMatch) {
      return bestMatch;
    }

    return null;
  }
}
