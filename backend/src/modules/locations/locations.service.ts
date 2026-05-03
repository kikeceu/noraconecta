import {
  LocationsRepository,
  LeafNode as LeafNodeDb,
  CountryNode,
} from './locations.repository';
import { AppError } from '../../middleware/error-handler';
import { GeoNode } from '@prisma/client';

export interface CountryResponse {
  id: string;
  name: string;
  levels: Array<{
    id: string;
    level: number;
    name: string;
  }>;
}

export interface LeafNodeResponse {
  id: string;
  name: string;
  level: string;
}

export interface CreateCountryRequest {
  name: string;
  levels: Array<{
    level: number;
    name: string;
  }>;
}

export interface CreateNodeRequest {
  name: string;
  levelId: string;
  parentId: string;
}

export class LocationsService {
  constructor(private readonly locationsRepository: LocationsRepository) {}

  async listCountries(): Promise<CountryResponse[]> {
    const countries = await this.locationsRepository.findAllCountries();
    return countries.map((c) => this.toCountryResponse(c));
  }

  async getTree(countryId: string): Promise<object> {
    const tree = await this.locationsRepository.findTreeByCountryId(countryId);

    if (!tree) {
      throw new AppError('Country not found', 404);
    }

    return tree;
  }

  async getLeafNodes(): Promise<LeafNodeResponse[]> {
    const nodes = await this.locationsRepository.findLeafNodes();
    return nodes.map((n) => this.toLeafNodeResponse(n));
  }

  async getActiveLeafNodeById(id: string): Promise<GeoNode> {
    const node = await this.locationsRepository.findActiveLeafNodeById(id);

    if (!node) {
      throw new AppError('Active leaf node not found', 404);
    }

    return node;
  }

  async createCountry(data: CreateCountryRequest): Promise<CountryResponse> {
    if (!data.name || data.name.trim().length === 0) {
      throw new AppError('Country name is required', 400);
    }

    if (data.levels.length === 0) {
      throw new AppError('At least one level is required', 400);
    }

    const levelsSorted = [...data.levels].sort((a, b) => a.level - b.level);

    for (let i = 0; i < levelsSorted.length; i++) {
      if (levelsSorted[i].level !== i + 1) {
        throw new AppError(
          'Level numbers must be sequential starting from 1',
          400,
        );
      }
      if (!levelsSorted[i].name || levelsSorted[i].name.trim().length === 0) {
        throw new AppError(`Level ${levelsSorted[i].level} name is required`, 400);
      }
    }

    const country = await this.locationsRepository.createCountry({
      name: data.name.trim(),
    });

    await this.locationsRepository.createLevels(
      levelsSorted.map((l) => ({
        countryId: country.id,
        level: l.level,
        name: l.name.trim(),
      })),
    );

    const createdCountry = await this.locationsRepository.findCountryById(country.id);

    if (!createdCountry) {
      throw new AppError('Country created but could not be retrieved', 500);
    }

    return this.toCountryResponse(createdCountry);
  }

  async createNode(data: CreateNodeRequest): Promise<GeoNode> {
    if (!data.name || data.name.trim().length === 0) {
      throw new AppError('Node name is required', 400);
    }

    const level = await this.locationsRepository.findLevelById(data.levelId);

    if (!level) {
      throw new AppError('Level not found', 404);
    }

    const parent = await this.locationsRepository.findNodeById(data.parentId);

    if (!parent) {
      throw new AppError('Parent node not found', 404);
    }

    if (!parent.isActive) {
      throw new AppError(
        'Cannot create a node under an inactive parent',
        422,
      );
    }

    const node = await this.locationsRepository.createNode({
      name: data.name.trim(),
      levelId: data.levelId,
      parentId: data.parentId,
    });

    return node;
  }

  async toggleNode(id: string): Promise<{ id: string; isActive: boolean }> {
    const node = await this.locationsRepository.findNodeById(id);

    if (!node) {
      throw new AppError('Node not found', 404);
    }

    if (node.parentId === null) {
      throw new AppError(
        'Cannot toggle a country node directly. Manage countries through /locations/countries',
        422,
      );
    }

    const newState = !node.isActive;

    if (newState) {
      if (node.parent && !node.parent.isActive) {
        throw new AppError(
          'Cannot activate a node whose parent is inactive',
          422,
        );
      }
    } else {
      await this.locationsRepository.deactivateDescendants(id);
    }

    const updated = await this.locationsRepository.toggleNodeActive(id, newState);

    return { id: updated.id, isActive: updated.isActive };
  }

  async updateNode(id: string, name: string): Promise<GeoNode> {
    if (!name || name.trim().length === 0) {
      throw new AppError('Node name is required', 400);
    }

    const node = await this.locationsRepository.findNodeById(id);

    if (!node) {
      throw new AppError('Node not found', 404);
    }

    return this.locationsRepository.updateNodeName(id, name.trim());
  }

  private toCountryResponse(country: CountryNode): CountryResponse {
    return {
      id: country.id,
      name: country.name,
      levels: country.geoLevels.map((l) => ({
        id: l.id,
        level: l.level,
        name: l.name,
      })),
    };
  }

  private toLeafNodeResponse(node: LeafNodeDb): LeafNodeResponse {
    return {
      id: node.id,
      name: node.name,
      level: node.level?.name ?? '',
    };
  }
}
