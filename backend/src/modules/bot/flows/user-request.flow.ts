import { NlpService } from '../nlp.service';
import { FlowContext, FlowHandler, FlowStepResult } from './types';
import { RequestsService } from '../../requests/requests.service';
import { PaymentsService } from '../../payments/payments.service';
import { LocationsRepository } from '../../locations/locations.repository';
import { ConfigRepository } from '../../config/config.repository';
import { handleCancelConfirmation } from './cancel-flow.helper';
import { resolveOption, resolveOptionWithFallback } from './option-resolver.helper';
import { BOT_PAYLOADS } from '../constants/bot-payloads';
import { callLLM } from '../../../lib/llm-client';
import prisma from '../../../lib/prisma';

const nlpService = new NlpService();

async function generateClarificationQuestions(
  description: string,
  categoryName: string,
): Promise<string | null> {
  const prompt = `Sos un asistente experto en servicios del hogar en Argentina.
El usuario necesita un ${categoryName} y describió su problema asi: "${description}".

Tu tarea: determinar si falta informacion CLAVE que el profesional necesitaria saber antes de llegar.
Si falta info importante, formula UNA sola pregunta corta y directa en español rioplatense.
Si ya tenes suficiente informacion, responde exactamente: NO_QUESTIONS

Ejemplos de buenas preguntas:
- "El corte de luz es en todo el depto o solo en un ambiente?"
- "La perdida es constante o intermitente?"
- "Tenes acceso al medidor de gas?"

Responde SOLO la pregunta o NO_QUESTIONS. Sin explicaciones.`;

  const response = await callLLM(prompt);
  const trimmed = response.trim();
  return trimmed === 'NO_QUESTIONS' ? null : trimmed;
}

async function generateTechnicalBrief(
  description: string,
  categoryName: string,
  clarificationAnswer: string | null,
): Promise<string> {
  const prompt = `Sos un asistente experto en servicios del hogar en Argentina.
Genera un brief tecnico CORTO (maximo 3 lineas) para un profesional ${categoryName} que va a atender este pedido.

Descripcion del usuario: "${description}"
${clarificationAnswer ? `Respuesta adicional del usuario: "${clarificationAnswer}"` : ''}

El brief debe incluir:
- Que es el problema en terminos tecnicos
- Detalles relevantes para el profesional
- Nivel de urgencia si aplica

Responde solo el brief, sin saludos ni explicaciones.`;

  return callLLM(prompt);
}

type DescriptionValidation = 'VALID' | 'INVALID' | 'UNCERTAIN';

async function validateDescription(description: string, categoryName: string): Promise<DescriptionValidation> {
  const prompt = `Sos un validador de servicios del hogar en Argentina.

Servicio solicitado: ${categoryName}
Descripcion: "${description}"

Analiza si la descripcion tiene relacion con el servicio:
- INVALIDO: el problema describe CLARAMENTE un oficio completamente distinto (ej: pedir electricista y describir perdida de agua, pedir pintor y describir problema de gas)
- INCIERTO: hay ambiguedad razonable, podria relacionarse con el servicio pero no es claro
- VALIDO: la descripcion tiene relacion directa o indirecta con el servicio

Responde SOLO con una palabra: VALIDO, INVALIDO o INCIERTO`;

  try {
    const response = await callLLM(prompt);
    const trimmed = response.trim().toUpperCase();
    if (trimmed.includes('INVALIDO')) return 'INVALID';
    if (trimmed.includes('INCIERTO')) return 'UNCERTAIN';
    return 'VALID';
  } catch {
    return 'VALID';
  }
}

export class UserRequestFlow implements FlowHandler {
  readonly flowName = 'USER_REQUEST';

  constructor(
    private readonly requestsService: RequestsService,
    private readonly paymentsService: PaymentsService,
    private readonly locationsRepository: LocationsRepository,
    private readonly configRepository: ConfigRepository,
  ) {}

  private readonly PHONE_PREFIX_TO_COUNTRY: Record<string, string> = {
    '54': 'Argentina',
    '51': 'Perú',
  };

  private async resolveCountryId(phone: string): Promise<string | null> {
    const normalized = phone.replace(/^\+/, '');

    let matchedCountryName: string | null = null;

    for (const [prefix, countryName] of Object.entries(this.PHONE_PREFIX_TO_COUNTRY)) {
      if (normalized.startsWith(prefix)) {
        matchedCountryName = countryName;
        break;
      }
    }

    if (!matchedCountryName) return null;

    const countryNode = await prisma.geoNode.findFirst({
      where: {
        parentId: null,
        name: matchedCountryName,
        isActive: true,
      },
      select: { id: true },
    });

    return countryNode?.id ?? null;
  }

  getInitialStep(): string {
    return 'INIT';
  }

  async handleStep(step: string, context: FlowContext): Promise<FlowStepResult> {
    const { session, message } = context;
    const tempData = (session.tempData as Record<string, unknown>) || {};

    // Handle button payloads that arrive when user has no active flow context
    if (step === 'INIT' && message.text) {
      const payload = message.text.trim();
      switch (payload) {
        case BOT_PAYLOADS.NOTIFY_WHEN_AVAILABLE:
          return this.handleNotifyWhenAvailable(tempData);
        case BOT_PAYLOADS.NO_NOTIFY:
          return this.handleNoNotify(tempData);
        case BOT_PAYLOADS.CONFIRMO_VISITA_USER:
          return this.handleConfirmoVisitaUser();
        case BOT_PAYLOADS.CANCELAR_VISITA:
          return this.handleCancelarVisita(tempData);
        case BOT_PAYLOADS.SEGUIR_ESPERANDO:
          return this.handleSeguirEsperando();
        case BOT_PAYLOADS.CANCELAR_PEDIDO:
          return this.handleCancelarPedido(tempData);
      }
    }

    switch (step) {
      case 'INIT':
        return this.handleInit(tempData);
      case 'ASK_NAME':
        return this.handleAskName(message, tempData);
      case 'ASK_SERVICE':
        return this.handleAskService(message, tempData);
      case 'ASK_PROVINCE':
        return this.handleAskProvince(message, tempData);
      case 'ASK_ZONE':
        return this.handleAskZone(message, tempData);
      case 'ASK_DESCRIPTION':
        return this.handleAskDescription(message, tempData);
      case 'DESCRIPTION_MISMATCH':
        return this.handleDescriptionMismatch(message, tempData);
      case 'ASK_LOCATION':
        return this.handleAskLocation(message, tempData);
      case 'ASK_PHOTOS':
        return this.handleAskPhotos(message, tempData);
      case 'ASK_AUDIO':
        return this.handleAskAudio(message, tempData);
      case 'CLARIFICATION':
        return this.handleClarification(message, tempData);
      case 'CONFIRM':
        return this.handleConfirm(message, tempData);
      case 'SEARCHING':
        return this.handleSearching();
      case 'WAITING_CONSENT':
        return this.handleWaitingConsent(message, tempData);
      case 'WAITING':
        return this.handleWaiting(tempData);
      case 'CANCEL_CONFIRMATION':
        return handleCancelConfirmation(context, this.requestsService);
      default:
        return this.handleInit(tempData);
    }
  }

  private async handleInit(
    tempData: Record<string, unknown>,
  ): Promise<FlowStepResult> {
    const userId = tempData.userId as string;
    const currentName = tempData.name as string;
    const phone = tempData.phone as string;

    if (!userId) {
      return {
        response: { text: 'Error interno. Intenta de nuevo mas tarde.' },
        nextStep: null,
        tempData,
      };
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return {
        response: { text: 'Error interno. Intenta de nuevo mas tarde.' },
        nextStep: null,
        tempData,
      };
    }

    if (user.status === 'BLOCKED') {
      return {
        response: { text: 'Lo sentimos, tu cuenta no puede realizar pedidos en este momento.' },
        nextStep: null,
        tempData,
      };
    }

    const activeRequest = await prisma.request.findFirst({
      where: {
        userId,
        status: { in: ['CREATED', 'ASSIGNED', 'ACCEPTED'] },
      },
    });

    if (activeRequest) {
      return {
        response: {
          text: 'Ya tenes un pedido en curso. Te avisamos cuando tengamos novedades.',
        },
        nextStep: null,
        tempData,
      };
    }

    const hasName = currentName && currentName !== phone;

    if (hasName) {
      return this.handleAskService({}, tempData);
    }

    return {
      response: { text: `Hola, soy ${process.env.APP_NAME ?? 'NORA'}. Cual es tu nombre?` },
      nextStep: 'ASK_NAME',
      tempData,
    };
  }

  private async handleAskName(
    message: { text?: string },
    tempData: Record<string, unknown>,
  ): Promise<FlowStepResult> {
    const userId = tempData.userId as string;
    const inputName = message.text?.trim();

    if (!inputName) {
      return {
        response: { text: `Hola, soy ${process.env.APP_NAME ?? 'NORA'}. Cual es tu nombre?` },
        nextStep: 'ASK_NAME',
        tempData,
      };
    }

    if (userId) {
      await prisma.user.update({ where: { id: userId }, data: { name: inputName } });
    }

    tempData.name = inputName;

    return this.handleAskService({}, tempData);
  }

  private async handleAskService(
    message: { text?: string },
    tempData: Record<string, unknown>,
  ): Promise<FlowStepResult> {
    const config = await this.configRepository.findByKey('USER_SERVICE_SELECTION_MODE');
    const useList = !config || config.value !== 'FREE_TEXT';

    if (useList) {
      return this.handleAskServiceList(message, tempData);
    }

    return this.handleAskServiceFreeText(message, tempData);
  }

  private async handleAskServiceList(
    message: { text?: string },
    tempData: Record<string, unknown>,
  ): Promise<FlowStepResult> {
    if (!tempData._categoryListed) {
      const categories = await prisma.category.findMany({
        where: { isActive: true },
        orderBy: { name: 'asc' },
      });

      if (categories.length === 0) {
        return {
          response: { text: 'No hay categorias disponibles por el momento.' },
          nextStep: null,
          tempData,
        };
      }

      tempData._availableCategories = categories.map((c) => ({ id: c.id, name: c.name }));
      tempData._categoryListed = true;

      const list = categories.map((c, i) => `${i + 1}. ${c.name}`).join('\n');

      return {
        response: {
          text: `¿Que tipo de servicio necesitas?\n\n${list}\n\nResponde con el numero.`,
        },
        nextStep: 'ASK_SERVICE',
        tempData,
      };
    }

    const inputText = message.text?.trim();

    if (!inputText) {
      const available = tempData._availableCategories as { id: string; name: string }[];
      const list = available.map((c, i) => `${i + 1}. ${c.name}`).join('\n');
      return {
        response: {
          text: `¿Que tipo de servicio necesitas?\n\n${list}\n\nResponde con el numero.`,
        },
        nextStep: 'ASK_SERVICE',
        tempData,
      };
    }

    const availableCategories = tempData._availableCategories as { id: string; name: string }[];
    const number = parseInt(inputText, 10);

    if (isNaN(number) || number < 1 || number > availableCategories.length) {
      const list = availableCategories.map((c, i) => `${i + 1}. ${c.name}`).join('\n');
      return {
        response: { text: `Elegi un numero entre 1 y ${availableCategories.length}:\n\n${list}` },
        nextStep: 'ASK_SERVICE',
        tempData,
      };
    }

    const selected = availableCategories[number - 1];
    tempData.categoryId = selected.id;
    tempData.categoryName = selected.name;

    return this.proceedAfterService(tempData);
  }

  private async handleAskServiceFreeText(
    message: { text?: string },
    tempData: Record<string, unknown>,
  ): Promise<FlowStepResult> {
    const inputText = message.text?.trim();

    if (!inputText) {
      return {
        response: {
          text: 'Que tipo de servicio necesitas? (Ej: plomeria, electricidad, limpieza)',
        },
        nextStep: 'ASK_SERVICE',
        tempData,
      };
    }

    const nlpResult = await nlpService.resolveCategory(inputText);

    if (!nlpResult.match) {
      return {
        response: {
          text: 'No encontre esa categoria. Podrias ser mas especifico? (Ej: plomeria, electricidad, pintura)',
        },
        nextStep: 'ASK_SERVICE',
        tempData,
      };
    }

    tempData.categoryId = nlpResult.match.id;
    tempData.categoryName = nlpResult.match.name;

    return this.proceedAfterService(tempData);
  }

  private async proceedAfterService(
    tempData: Record<string, unknown>,
  ): Promise<FlowStepResult> {
    if (tempData.geoNodeId) {
      const categoryName = tempData.categoryName as string;
      const zoneName = tempData.geoNodeName as string;
      return {
        response: {
          text: `Entendido: ${categoryName} en ${zoneName}. Contame brevemente el problema.`,
        },
        nextStep: 'ASK_DESCRIPTION',
        tempData,
      };
    }

    const zoneMode = await this.configRepository.findByKey('USER_ZONE_SELECTION_MODE');
    const useZoneList = !zoneMode || zoneMode.value !== 'FREE_TEXT';

    if (useZoneList) {
      return this.proceedToProvinceStep(tempData);
    }

    const categoryName = tempData.categoryName as string;

    return {
      response: {
        text: `Entendido: ${categoryName}. ¿En qué zona necesitás el servicio? (Ej: Maipú, Godoy Cruz, Capital)`,
      },
      nextStep: 'ASK_ZONE',
      tempData,
    };
  }

  private async proceedToProvinceStep(
    tempData: Record<string, unknown>,
  ): Promise<FlowStepResult> {
    const phone = tempData.phone as string;
    const categoryName = tempData.categoryName as string;
    const countryId = await this.resolveCountryId(phone);

    if (!countryId) {
      return {
        response: { text: 'No pude detectar tu pais. Contacta a soporte.' },
        nextStep: null,
        tempData,
      };
    }

    const provinces = await this.locationsRepository.findActiveChildNodes(countryId);

    if (provinces.length === 0) {
      return {
        response: { text: 'No hay provincias habilitadas por el momento. Intenta mas tarde.' },
        nextStep: null,
        tempData,
      };
    }

    if (provinces.length === 1) {
      const province = provinces[0];
      tempData._provinceId = province.id;
      tempData._provinceName = province.name;
      tempData._countryId = countryId;

      const zones = await this.locationsRepository.findActiveChildNodes(province.id);

      if (zones.length === 0) {
        return {
          response: { text: 'No hay zonas habilitadas por el momento. Intenta mas tarde.' },
          nextStep: null,
          tempData,
        };
      }

      tempData._availableZones = zones.map((z) => ({ id: z.id, name: z.name }));
      tempData._zonesListed = true;

      const list = zones.map((z, i) => `${i + 1}. ${z.name}`).join('\n');

      return {
        response: {
          text: `Entendido: ${categoryName}. ¿En qué departamento de ${province.name} necesitás el servicio?\n\n${list}\n\nResponde con el numero.`,
        },
        nextStep: 'ASK_ZONE',
        tempData,
      };
    }

    tempData._countryId = countryId;
    tempData._availableProvinces = provinces.map((p) => ({ id: p.id, name: p.name }));
    tempData._provinceListed = true;

    const list = provinces.map((p, i) => `${i + 1}. ${p.name}`).join('\n');

    return {
      response: {
        text: `Entendido: ${categoryName}. En que provincia necesitas el servicio?\n\n${list}\n\nResponde con el numero.`,
      },
      nextStep: 'ASK_PROVINCE',
      tempData,
    };
  }

  private async handleAskProvince(
    message: { text?: string },
    tempData: Record<string, unknown>,
  ): Promise<FlowStepResult> {
    if (!tempData._provinceListed) {
      const phone = tempData.phone as string;
      const countryId = await this.resolveCountryId(phone);

      if (!countryId) {
        return {
          response: { text: 'No pude detectar tu pais. Contacta a soporte.' },
          nextStep: null,
          tempData,
        };
      }

      const provinces = await this.locationsRepository.findActiveChildNodes(countryId);

      if (provinces.length === 0) {
        return {
          response: { text: 'No hay provincias habilitadas. Intenta mas tarde.' },
          nextStep: null,
          tempData,
        };
      }

      tempData._availableProvinces = provinces.map((p) => ({ id: p.id, name: p.name }));
      tempData._provinceListed = true;

      const list = provinces.map((p, i) => `${i + 1}. ${p.name}`).join('\n');

      return {
        response: {
          text: `En que provincia necesitas el servicio?\n\n${list}\n\nResponde con el numero.`,
        },
        nextStep: 'ASK_PROVINCE',
        tempData,
      };
    }

    const inputText = message.text?.trim() || '';
    const availableProvinces = tempData._availableProvinces as { id: string; name: string }[];
    const number = parseInt(inputText, 10);

    if (isNaN(number) || number < 1 || number > availableProvinces.length) {
      const list = availableProvinces.map((p, i) => `${i + 1}. ${p.name}`).join('\n');
      return {
        response: { text: `Elegi un numero entre 1 y ${availableProvinces.length}:\n\n${list}` },
        nextStep: 'ASK_PROVINCE',
        tempData,
      };
    }

    const selected = availableProvinces[number - 1];
    tempData._provinceId = selected.id;
    tempData._provinceName = selected.name;

    const zones = await this.locationsRepository.findActiveChildNodes(selected.id);

    if (zones.length === 0) {
      return {
        response: { text: 'No hay zonas habilitadas en esa provincia. Intenta mas tarde.' },
        nextStep: null,
        tempData,
      };
    }

    tempData._availableZones = zones.map((z) => ({ id: z.id, name: z.name }));
    tempData._zonesListed = true;

    const list = zones.map((z, i) => `${i + 1}. ${z.name}`).join('\n');

    return {
      response: {
        text: `Provincia: ${selected.name}. En que zona exactamente?\n\n${list}\n\nResponde con el numero.`,
      },
      nextStep: 'ASK_ZONE',
      tempData,
    };
  }

  private async handleAskZone(
    message: { text?: string },
    tempData: Record<string, unknown>,
  ): Promise<FlowStepResult> {
    const zoneMode = await this.configRepository.findByKey('USER_ZONE_SELECTION_MODE');
    const useZoneList = !zoneMode || zoneMode.value !== 'FREE_TEXT';

    if (useZoneList) {
      return this.handleAskZoneList(message, tempData);
    }

    return this.handleAskZoneFreeText(message, tempData);
  }

  private async handleAskZoneList(
    message: { text?: string },
    tempData: Record<string, unknown>,
  ): Promise<FlowStepResult> {
    if (!tempData._zonesListed) {
      const provinceId = tempData._provinceId as string;
      const zones = await this.locationsRepository.findActiveChildNodes(provinceId);

      if (zones.length === 0) {
        return {
          response: { text: 'No hay zonas habilitadas en esa provincia. Intenta mas tarde.' },
          nextStep: null,
          tempData,
        };
      }

      tempData._availableZones = zones.map((z) => ({ id: z.id, name: z.name }));
      tempData._zonesListed = true;

      const list = zones.map((z, i) => `${i + 1}. ${z.name}`).join('\n');

      return {
        response: {
          text: `En que zona de ${tempData._provinceName} necesitas el servicio?\n\n${list}\n\nResponde con el numero.`,
        },
        nextStep: 'ASK_ZONE',
        tempData,
      };
    }

    const inputText = message.text?.trim() || '';
    const availableZones = tempData._availableZones as { id: string; name: string }[];
    const number = parseInt(inputText, 10);

    if (isNaN(number) || number < 1 || number > availableZones.length) {
      const list = availableZones.map((z, i) => `${i + 1}. ${z.name}`).join('\n');
      return {
        response: { text: `Elegi un numero entre 1 y ${availableZones.length}:\n\n${list}` },
        nextStep: 'ASK_ZONE',
        tempData,
      };
    }

    const selected = availableZones[number - 1];
    tempData.geoNodeId = selected.id;
    tempData.geoNodeName = selected.name;

    return {
      response: { text: `Zona: ${selected.name}. Contame brevemente el problema.` },
      nextStep: 'ASK_DESCRIPTION',
      tempData,
    };
  }

  private async handleAskZoneFreeText(
    message: { text?: string },
    tempData: Record<string, unknown>,
  ): Promise<FlowStepResult> {
    const inputText = message.text?.trim();

    if (!inputText) {
      return {
        response: {
          text: '¿En qué zona necesitás el servicio? (Ej: Maipú, Godoy Cruz, Capital)',
        },
        nextStep: 'ASK_ZONE',
        tempData,
      };
    }

    const nlpResult = await nlpService.resolveZone(inputText);

    if (!nlpResult.match) {
      return {
        response: {
          text: 'No encontré esa zona. ¿Podés indicarme otra? (Ej: Maipú, Godoy Cruz)',
        },
        nextStep: 'ASK_ZONE',
        tempData,
      };
    }

    tempData.geoNodeId = nlpResult.match.id;
    tempData.geoNodeName = nlpResult.match.name;

    return {
      response: {
        text: `Zona: ${nlpResult.match.name}. Contame brevemente el problema.`,
      },
      nextStep: 'ASK_DESCRIPTION',
      tempData,
    };
  }

  private async handleAskDescription(
    message: { text?: string },
    tempData: Record<string, unknown>,
  ): Promise<FlowStepResult> {
    const description = message.text?.trim();

    if (!description) {
      return {
        response: { text: 'Por favor contame brevemente el problema.' },
        nextStep: 'ASK_DESCRIPTION',
        tempData,
      };
    }

    const categoryName = tempData.categoryName as string;

    tempData.description = description;

    const validation = await validateDescription(description, categoryName);

    if (validation === 'INVALID') {
      return {
        response: {
          text: `Lo que describís no parece relacionado con un servicio de ${categoryName}. ¿Qué querés hacer?\n1. Cambiar el servicio\n2. Reformular la descripción`,
        },
        nextStep: 'DESCRIPTION_MISMATCH',
        tempData,
      };
    }

    if (validation === 'UNCERTAIN') {
      return {
        response: {
          text: `Solo para confirmar: ¿tu problema está relacionado con un servicio de ${categoryName}?\n1. Sí, es correcto\n2. Quiero cambiar el servicio`,
        },
        nextStep: 'DESCRIPTION_MISMATCH',
        tempData: { ...tempData, _uncertainDescription: description },
      };
    }

    // VALID → continue normally
    return this.handleClarification({ text: undefined }, tempData);
  }

  private async handleAskLocation(
    message: { text?: string; location?: { latitude: number; longitude: number } },
    tempData: Record<string, unknown>,
  ): Promise<FlowStepResult> {
    if (message.location) {
      tempData.userLatitude = message.location.latitude;
      tempData.userLongitude = message.location.longitude;

      return {
        response: { text: 'Gracias. Queres enviar fotos? (hasta 3) Escribi "continuar" para seguir sin fotos' },
        nextStep: 'ASK_PHOTOS',
        tempData,
      };
    }

    // Any text = user doesn't want to share location → advance
    if (message.text) {
      tempData.userLatitude = undefined;
      tempData.userLongitude = undefined;

      return {
        response: { text: 'Perfecto. Continuamos sin ubicacion. Queres enviar fotos? (hasta 3) Escribi "continuar" para seguir sin fotos' },
        nextStep: 'ASK_PHOTOS',
        tempData,
      };
    }

    // No text nor location → ask again
    return {
      response: {
        text: 'Para encontrarte al profesional mas cercano, comparti tu ubicacion por WhatsApp. Si no podes compartirla, escribi "omitir".',
      },
      nextStep: 'ASK_LOCATION',
      tempData,
    };
  }

  private async handleAskPhotos(
    message: { text?: string; imageUrls?: string[] },
    tempData: Record<string, unknown>,
  ): Promise<FlowStepResult> {
    const photos = (tempData.photoUrls as string[]) || [];
    const newPhotos = message.imageUrls || [];
    const mergedPhotos = [...photos, ...newPhotos].slice(0, 3);

    if (newPhotos.length > 0) {
      tempData.photoUrls = mergedPhotos;

      if (mergedPhotos.length >= 3) {
        return {
          response: { text: 'Recibi 3 fotos. ¿Querés enviar un audio con más detalle? Escribí "continuar" para seguir sin audio.' },
          nextStep: 'ASK_AUDIO',
          tempData,
        };
      }

      return {
        response: { text: `Recibi ${mergedPhotos.length}/3 foto(s). Podés enviar más o escribí "continuar" para seguir.` },
        nextStep: 'ASK_PHOTOS',
        tempData,
      };
    }

    const inputText = message.text?.trim().toLowerCase();

    if (inputText === 'continuar' || !!inputText) {
      return {
        response: { text: '¿Querés enviar un audio con más detalle? Escribí "continuar" para seguir sin audio.' },
        nextStep: 'ASK_AUDIO',
        tempData,
      };
    }

    return {
      response: { text: '' },
      nextStep: 'ASK_PHOTOS',
      tempData,
    };
  }

  private async handleAskAudio(
    message: { text?: string; audioUrl?: string },
    tempData: Record<string, unknown>,
  ): Promise<FlowStepResult> {
    if (message.audioUrl) {
      tempData.audioUrl = message.audioUrl;
    }

    const inputText = message.text?.trim().toLowerCase();

    if (inputText === 'continuar' || !!inputText || message.audioUrl) {
      const confirmText = this.buildConfirmation(tempData);
      return {
        response: { text: confirmText },
        nextStep: 'CONFIRM',
        tempData,
      };
    }

    return {
      response: { text: '¿Querés enviar un audio con más detalle? Escribí "continuar" para seguir sin audio.' },
      nextStep: 'ASK_AUDIO',
      tempData,
    };
  }

  private async handleClarification(
    message: { text?: string },
    tempData: Record<string, unknown>,
  ): Promise<FlowStepResult> {
    const description = tempData.description as string;
    const categoryName = tempData.categoryName as string;

    if (!tempData._clarificationAsked) {
      try {
        const question = await generateClarificationQuestions(
          description,
          categoryName,
        );

        if (question) {
          tempData._clarificationAsked = true;
          tempData._clarificationQuestion = question;

          return {
            response: { text: `Antes de buscar un profesional, necesito una consulta: ${question}` },
            nextStep: 'CLARIFICATION',
            tempData,
          };
        }
      } catch {
        // LLM error — non-blocking, proceed to technical brief
      }
    } else {
      const answer = message.text?.trim();
      if (answer) {
        tempData.clarificationAnswer = answer;
      }
    }

    try {
      const clarificationAnswer = (tempData.clarificationAnswer as string) || null;
      const technicalBrief = await generateTechnicalBrief(
        description,
        categoryName,
        clarificationAnswer,
      );

      tempData.technicalBrief = technicalBrief;
    } catch {
      // LLM error — non-blocking, proceed without technical brief
    }

    return {
      response: {
        text: 'Para encontrarte al profesional mas cercano, comparti tu ubicacion por WhatsApp (usa el boton de ubicacion). Si no podes compartirla, escribi "omitir".',
      },
      nextStep: 'ASK_LOCATION',
      tempData,
    };
  }

  private async handleDescriptionMismatch(
    message: { text?: string },
    tempData: Record<string, unknown>,
  ): Promise<FlowStepResult> {
    const inputText = message.text?.trim().toLowerCase() || '';
    const categoryName = tempData.categoryName as string;

    const resolved = await resolveOptionWithFallback('DESCRIPTION_MISMATCH', inputText);

    if (resolved === 'CHANGE_SERVICE') {
      return this.handleAskService(message, {
        ...tempData,
        categoryId: undefined,
        categoryName: undefined,
        _uncertainDescription: undefined,
        _categoryListed: undefined,
        _availableCategories: undefined,
      });
    }

    return {
      response: {
        text: `Contame brevemente el problema relacionado con ${categoryName}.`,
      },
      nextStep: 'ASK_DESCRIPTION',
      tempData: { ...tempData, _uncertainDescription: undefined },
    };
  }

  private buildConfirmation(tempData: Record<string, unknown>): string {
    const name = tempData.name as string;
    const category = tempData.categoryName as string;
    const zone = tempData.geoNodeName as string;
    const description = tempData.description as string;
    const photos = (tempData.photoUrls as string[]) || [];
    const hasAudio = !!tempData.audioUrl;

    let text = `*Resumen del pedido:*\n\n`;
    text += `*Nombre:* ${name}\n`;
    text += `*Servicio:* ${category}\n`;
    text += `*Zona:* ${zone}\n`;
    text += `*Problema:* ${description}\n`;

    if (photos.length > 0) {
      text += `*Fotos:* ${photos.length} adjunta(s)\n`;
    }

    if (hasAudio) {
      text += `*Audio:* Sí\n`;
    }

    text += `\n¿Confirmo la búsqueda de un profesional?\n1. Sí\n2. No`;
    return text;
  }

  private async handleConfirm(
    message: { text?: string },
    tempData: Record<string, unknown>,
  ): Promise<FlowStepResult> {
    const inputText = message.text?.trim().toLowerCase();
    const resolved = inputText ? resolveOption('CONFIRM', inputText) : null;

    if (resolved === 'YES') {
      try {
        const request = await this.requestsService.create({
          phone: tempData.phone as string,
          categoryId: tempData.categoryId as string,
          geoNodeId: tempData.geoNodeId as string,
          description: tempData.description as string,
          photoUrls: (tempData.photoUrls as string[]) || [],
          audioUrl: tempData.audioUrl as string | undefined,
          userLatitude: tempData.userLatitude as number | undefined,
          userLongitude: tempData.userLongitude as number | undefined,
          technicalBrief: tempData.technicalBrief as string | undefined,
        });

        tempData.requestId = request.id;

        // Matching found a professional -> normal flow
        if (request.status === 'ASSIGNED') {
          return {
            response: {
              text: 'Buscando el profesional ideal... te aviso cuando confirme.',
              requestId: request.id,
            },
            nextStep: 'SEARCHING',
            tempData,
          };
        }

        // No match found -> check for trial-exhausted professionals
        const trialCheck =
          await this.requestsService.checkTrialExhaustedForWaiting(
            tempData.categoryId as string,
            tempData.geoNodeId as string,
          );

        if (trialCheck.hasTrialExhausted) {
          return {
            response: {
              text:
                `En este momento no encontré un profesional disponible para tu pedido. ` +
                `Estoy buscando opciones — si aparece alguien, ¿querés que te avise? ` +
                `Puede demorar hasta 24hs.\n1. Sí\n2. No`,
              options: ['Sí', 'No'],
              requestId: request.id,
            },
            nextStep: 'WAITING_CONSENT',
            tempData,
          };
        }

        // No match and no trial-exhausted professionals -> close
        return {
          response: {
            text: 'En este momento no hay profesionales disponibles en tu zona para este servicio. Podés volver a intentarlo más tarde.',
            requestId: request.id,
          },
          nextStep: null,
          tempData: {},
        };
      } catch (err) {
        console.error('[UserRequestFlow] handleConfirm: create failed', err);

        const message = err instanceof Error ? err.message : 'Error al crear el pedido';

        return {
          response: { text: `No se pudo crear el pedido: ${message}. Intenta de nuevo.` },
          nextStep: null,
          tempData,
        };
      }
    }

    if (resolved === 'NO') {
      return {
        response: { text: 'Pedido cancelado. Cuando necesites algo, escribime.' },
        nextStep: null,
        tempData: {},
      };
    }

    return {
      response: { text: '¿Confirmá la búsqueda?\n1. Sí\n2. No', options: ['Si', 'No'] },
      nextStep: 'CONFIRM',
      tempData,
    };
  }

  private async handleWaitingConsent(
    message: { text?: string },
    tempData: Record<string, unknown>,
  ): Promise<FlowStepResult> {
    const inputText = message.text?.trim().toLowerCase();
    const resolved = inputText ? await resolveOptionWithFallback('WAITING_CONSENT', inputText) : null;

    if (resolved === 'YES') {
      return this.handleWaiting(tempData);
    }

    if (resolved === 'NO') {
      const requestId = tempData.requestId as string;

      if (requestId) {
        try {
          await this.requestsService.cancel(requestId);
        } catch (err) {
          console.error(
            '[UserRequestFlow] handleWaitingConsent: cancel failed',
            err,
          );
        }
      }

      return {
        response: { text: 'Entendido. Podés volver a buscar cuando quieras.' },
        nextStep: null,
        tempData: {},
      };
    }

    return {
      response: {
      text:
        `En este momento no encontré un profesional disponible para tu pedido. ` +
        `Estoy buscando opciones — si aparece alguien, ¿querés que te avise? ` +
        `Puede demorar hasta 24hs.\n1. Sí\n2. No`,
      options: ['Sí', 'No'],
      },
      nextStep: 'WAITING_CONSENT',
      tempData,
    };
  }

  private async handleWaiting(
    tempData: Record<string, unknown>,
  ): Promise<FlowStepResult> {
    const requestId = tempData.requestId as string;
    const categoryId = tempData.categoryId as string;
    const geoNodeId = tempData.geoNodeId as string;
    const categoryName = tempData.categoryName as string;
    const zoneName = tempData.geoNodeName as string;

    try {
      // Set waiting fields on request
      await this.requestsService.update(requestId, {
        status: 'NO_RESPONSE',
        waitingUserConsent: true,
        waitingActivationSince: new Date(),
        assignmentTimeoutAt: null,
      });

      // Get trial-exhausted professionals and notify them with payment links
      const exhausted =
        await this.requestsService.getTrialExhaustedProfessionals(
          categoryId,
          geoNodeId,
        );

      if (exhausted.length > 0) {
        const professionalIds = exhausted.map((p) => p.id);

        void this.paymentsService.notifyTrialExhaustedProfessionals(
          professionalIds,
          categoryName,
          zoneName,
        );
      }
    } catch (err) {
      console.error('[UserRequestFlow] handleWaiting: failed', err);
    }

    return {
      response: {
        text:
          `Perfecto, te aviso en cuanto encuentre a alguien. ` +
          `Si en 24hs no apareció nadie, te lo hago saber.`,
        requestId,
      },
      nextStep: null,
      tempData: {},
    };
  }

  private async handleSearching(): Promise<FlowStepResult> {
    return {
      response: {
        text: 'Buscando el profesional ideal... te aviso cuando confirme.',
      },
      nextStep: null,
      tempData: {},
    };
  }

  private async handleNotifyWhenAvailable(
    tempData: Record<string, unknown>,
  ): Promise<FlowStepResult> {
    const userId = tempData.userId as string | undefined;

    if (userId) {
      const request = await prisma.request.findFirst({
        where: {
          userId,
          status: { in: ['NO_RESPONSE', 'CREATED'] },
        },
        orderBy: { createdAt: 'desc' },
      });

      if (request) {
        try {
          await prisma.request.update({
            where: { id: request.id },
            data: {
              waitingUserConsent: true,
              waitingActivationSince: new Date(),
            },
          });
        } catch (err) {
          console.error('[UserRequestFlow] handleNotifyWhenAvailable: update failed', err);
        }
      }
    }

    return {
      response: {
        text: 'Perfecto, te avisamos en cuanto encontremos un profesional disponible para tu pedido.',
      },
      nextStep: null,
      tempData: {},
    };
  }

  private async handleNoNotify(
    tempData: Record<string, unknown>,
  ): Promise<FlowStepResult> {
    const userId = tempData.userId as string | undefined;

    if (userId) {
      const request = await prisma.request.findFirst({
        where: {
          userId,
          status: { in: ['CREATED', 'ASSIGNED'] },
        },
        orderBy: { createdAt: 'desc' },
      });

      if (request) {
        try {
          await this.requestsService.cancel(request.id);
        } catch (err) {
          console.error('[UserRequestFlow] handleNoNotify: cancel failed', err);
        }
      }
    }

    return {
      response: {
        text: 'Entendido, no te molestamos más por este pedido. Si necesitás ayuda en otro momento, escribinos cuando quieras.',
      },
      nextStep: null,
      tempData: {},
    };
  }

  private async handleConfirmoVisitaUser(): Promise<FlowStepResult> {
    return {
      response: {
        text: '¡Perfecto! Te esperamos. Cualquier cambio avisanos.',
      },
      nextStep: null,
      tempData: {},
    };
  }

  private async handleCancelarVisita(
    tempData: Record<string, unknown>,
  ): Promise<FlowStepResult> {
    const userId = tempData.userId as string | undefined;

    if (!userId) {
      return {
        response: { text: 'No pude identificar tu cuenta. Escribinos para ayudarte.' },
        nextStep: null,
        tempData: {},
      };
    }

    const request = await prisma.request.findFirst({
      where: {
        userId,
        status: 'ACCEPTED',
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!request) {
      return {
        response: { text: 'No encontré una visita activa para cancelar.' },
        nextStep: null,
        tempData: {},
      };
    }

    try {
      const result = await this.requestsService.cancelByUser(request.id);

      const newTempData: Record<string, unknown> = {};

      if (result.shouldNotifyProfessional && result.professionalPhone && result.professionalMessage) {
        newTempData.pendingNotification = {
          targetPhone: result.professionalPhone,
          targetRole: 'PROFESSIONAL',
          message: result.professionalMessage,
          flow: null,
          step: null,
          tempData: {},
        };
      }

      return {
        response: {
          text: 'Tu visita fue cancelada. Le avisamos al profesional. Si necesitás programar otra, escribinos cuando quieras.',
        },
        nextStep: null,
        tempData: newTempData,
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'No se pudo cancelar la visita';
      return {
        response: { text: errorMessage },
        nextStep: null,
        tempData: {},
      };
    }
  }

  private async handleSeguirEsperando(): Promise<FlowStepResult> {
    return {
      response: {
        text: 'Perfecto, seguimos buscando. Te avisamos en cuanto encontremos otro profesional disponible.',
      },
      nextStep: null,
      tempData: {},
    };
  }

  private async handleCancelarPedido(
    tempData: Record<string, unknown>,
  ): Promise<FlowStepResult> {
    const userId = tempData.userId as string | undefined;

    if (!userId) {
      return {
        response: { text: 'No pude identificar tu cuenta. Escribinos para ayudarte.' },
        nextStep: null,
        tempData: {},
      };
    }

    const request = await prisma.request.findFirst({
      where: {
        userId,
        status: { in: ['CREATED', 'ASSIGNED', 'ACCEPTED', 'NO_RESPONSE'] },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!request) {
      return {
        response: { text: 'No encontré un pedido activo para cancelar.' },
        nextStep: null,
        tempData: {},
      };
    }

    try {
      if (['CREATED', 'ASSIGNED', 'ACCEPTED'].includes(request.status)) {
        await this.requestsService.cancelByUser(request.id);
      } else {
        // NO_RESPONSE status — direct update
        await prisma.request.update({
          where: { id: request.id },
          data: { status: 'CANCELLED' },
        });
      }
    } catch (err) {
      console.error('[UserRequestFlow] handleCancelarPedido: cancel failed', err);
    }

    return {
      response: {
        text: 'Entendido, cancelamos tu pedido. Si necesitás ayuda en otro momento, escribinos cuando quieras.',
      },
      nextStep: null,
      tempData: {},
    };
  }
}
