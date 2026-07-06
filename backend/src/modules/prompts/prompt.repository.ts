import prisma from '../../lib/prisma';

export class PromptRepository {
  async findByKey(key: string): Promise<{ content: string; defaultContent: string; isEditable: boolean } | null> {
    return prisma.promptTemplate.findUnique({ where: { key } });
  }

  async findAll(): Promise<{ key: string; content: string; defaultContent: string; description: string; variables: string[]; isEditable: boolean; updatedAt: Date }[]> {
    return prisma.promptTemplate.findMany({ orderBy: { key: 'asc' } });
  }

  async update(key: string, content: string): Promise<void> {
    await prisma.promptTemplate.update({ where: { key }, data: { content } });
  }

  async resetToDefault(key: string): Promise<void> {
    const record = await prisma.promptTemplate.findUnique({ where: { key } });
    if (record) {
      await prisma.promptTemplate.update({ where: { key }, data: { content: record.defaultContent } });
    }
  }
}

export const promptRepository = new PromptRepository();
