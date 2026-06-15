import prisma from '../../lib/prisma';
import { GeoNode, GeoLevel, Prisma } from '@prisma/client';

export type CreateCountryInput = {
  name: string;
};

export type CreateLevelInput = {
  countryId: string;
  level: number;
  name: string;
};

export type CreateNodeInput = {
  name: string;
  levelId: string;
  parentId: string;
};

const countryInclude = {
  geoLevels: { orderBy: { level: 'asc' as const } },
} satisfies Prisma.GeoNodeInclude;

const nodeDetailInclude = {
  level: true,
  parent: true,
  children: true,
} satisfies Prisma.GeoNodeInclude;

const leafNodeInclude = {
  level: true,
} satisfies Prisma.GeoNodeInclude;

const treeInclude = {
  level: true,
  children: {
    include: {
      level: true,
      children: {
        include: {
          level: true,
          children: {
            include: {
              level: true,
              children: {
                include: {
                  level: true,
                  children: {
                    include: {
                      level: true,
                      children: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
} satisfies Prisma.GeoNodeInclude;

export type CountryNode = Prisma.GeoNodeGetPayload<{ include: typeof countryInclude }>;
export type NodeDetail = Prisma.GeoNodeGetPayload<{ include: typeof nodeDetailInclude }>;
export type LeafNode = Prisma.GeoNodeGetPayload<{ include: typeof leafNodeInclude }>;
export type TreeNode = Prisma.GeoNodeGetPayload<{ include: typeof treeInclude }>;

export class LocationsRepository {
  async findAllCountries(): Promise<CountryNode[]> {
    return prisma.geoNode.findMany({
      where: { parentId: null },
      include: countryInclude,
      orderBy: { name: 'asc' },
    });
  }

  async findCountryById(id: string): Promise<CountryNode | null> {
    return prisma.geoNode.findFirst({
      where: { id, parentId: null },
      include: countryInclude,
    });
  }

  async findTreeByCountryId(countryId: string): Promise<TreeNode | null> {
    return prisma.geoNode.findUnique({
      where: { id: countryId },
      include: treeInclude,
    });
  }

  async findLeafNodes(): Promise<LeafNode[]> {
    return prisma.geoNode.findMany({
      where: {
        isActive: true,
        children: { none: {} },
      },
      include: leafNodeInclude,
      orderBy: { name: 'asc' },
    });
  }

  async findNodeById(id: string): Promise<NodeDetail | null> {
    return prisma.geoNode.findUnique({
      where: { id },
      include: nodeDetailInclude,
    });
  }

  async findLevelById(id: string): Promise<GeoLevel | null> {
    return prisma.geoLevel.findUnique({
      where: { id },
    });
  }

  async createCountry(data: CreateCountryInput): Promise<GeoNode> {
    return prisma.geoNode.create({
      data: {
        name: data.name,
        isActive: true,
      },
    });
  }

  async createLevels(levels: CreateLevelInput[]): Promise<void> {
    await prisma.geoLevel.createMany({
      data: levels,
    });
  }

  async createNode(data: CreateNodeInput): Promise<GeoNode> {
    return prisma.geoNode.create({
      data: {
        name: data.name,
        levelId: data.levelId,
        parentId: data.parentId,
        isActive: true,
      },
    });
  }

  async updateNodeName(id: string, name: string): Promise<GeoNode> {
    return prisma.geoNode.update({
      where: { id },
      data: { name },
    });
  }

  async toggleNodeActive(id: string, isActive: boolean): Promise<GeoNode> {
    return prisma.geoNode.update({
      where: { id },
      data: { isActive },
      include: { level: true },
    });
  }

  async deactivateDescendants(parentId: string): Promise<void> {
    const children = await prisma.geoNode.findMany({
      where: { parentId },
    });

    if (children.length === 0) return;

    await prisma.geoNode.updateMany({
      where: { parentId },
      data: { isActive: false },
    });

    for (const child of children) {
      await this.deactivateDescendants(child.id);
    }
  }

  async findActiveChildNodes(parentId: string): Promise<GeoNode[]> {
    return prisma.geoNode.findMany({
      where: {
        parentId,
        isActive: true,
      },
      orderBy: { name: 'asc' },
    });
  }

  async findActiveLeafNodeById(id: string): Promise<LeafNode | null> {
    return prisma.geoNode.findFirst({
      where: {
        id,
        isActive: true,
        children: { none: {} },
      },
      include: leafNodeInclude,
    });
  }

  async findChildNodeByName(parentId: string, name: string): Promise<GeoNode | null> {
    const normalized = name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

    const children = await prisma.geoNode.findMany({
      where: { parentId, isActive: true },
    });

    return (
      children.find((c) => {
        const childNormalized = c.name
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '');
        return childNormalized === normalized || childNormalized.includes(normalized) || normalized.includes(childNormalized);
      }) ?? null
    );
  }
}
