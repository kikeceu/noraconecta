import { WhatsAppRepository } from './whatsapp.repository';
import { registerTemplateUsageHandler, registerServiceConversationHandler } from '../../lib/whatsapp-adapter';
import { WhatsAppTemplate } from '@prisma/client';

export interface WhatsAppCostsResponse {
  templateUsage: {
    templateName: string;
    category: string;
    totalSent: number;
    totalCostUsd: number;
  }[];
  serviceConversations: {
    totalConversations: number;
    totalCostUsd: number;
  };
  avgCostPerRequest: number;
  costsByDay: {
    date: string;
    templateCostUsd: number;
    serviceCostUsd: number;
  }[];
}

export class WhatsAppUsageService {
  private _templateCatalogCache: Map<string, { category: string }> = new Map();
  private _categoryPrices: Record<string, number> = {};

  constructor(private readonly whatsAppRepository: WhatsAppRepository) {}

  async registerHandlers(categoryPrices: Record<string, number>): Promise<void> {
    this._categoryPrices = categoryPrices;

    const templates = await this.whatsAppRepository.findTemplateCatalog();
    for (const t of templates) {
      this._templateCatalogCache.set(t.name, { category: t.category });
    }

    registerTemplateUsageHandler((data) => {
      const catalog = this._templateCatalogCache.get(data.templateName) ?? { category: 'utility' };
      const costUsd = this._categoryPrices[catalog.category] ?? 0;
      void this.whatsAppRepository.createTemplateUsage({
        ...data,
        category: catalog.category,
        costUsd,
      }).catch(err => { console.error('[WhatsAppUsageService] Failed to log template usage:', err); });
    });

    registerServiceConversationHandler((data) => {
      void this.whatsAppRepository.createServiceConversation({
        ...data,
        costUsd: this._categoryPrices['service'] ?? 0,
      }).catch(err => { console.error('[WhatsAppUsageService] Failed to log service conversation:', err); });
    });
  }

  async getCosts(from?: Date, to?: Date): Promise<WhatsAppCostsResponse> {
    const [templateUsage, serviceConversations, avgCostPerRequest, costsByDay] = await Promise.all([
      this.whatsAppRepository.getTemplateUsageAggregated(from, to),
      this.whatsAppRepository.getServiceConversationTotal(from, to),
      this.whatsAppRepository.getAvgCostPerRequest(from, to),
      this.whatsAppRepository.getCostsByDay(from, to),
    ]);
    return { templateUsage, serviceConversations, avgCostPerRequest, costsByDay };
  }

  async getTemplateCatalog(): Promise<WhatsAppTemplate[]> {
    return this.whatsAppRepository.findTemplateCatalog();
  }

  async updateTemplate(name: string, data: { category?: string }): Promise<void> {
    await this.whatsAppRepository.updateTemplate(name, data);
    const existing = this._templateCatalogCache.get(name) ?? { category: 'utility' };
    this._templateCatalogCache.set(name, { ...existing, ...data });
  }
}
