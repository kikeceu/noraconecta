import { NlpService } from '../nlp.service';
import { FlowContext, FlowHandler, FlowStepResult, SavedLocation } from './types';
import { RequestsService } from '../../requests/requests.service';
import { PaymentsService } from '../../payments/payments.service';
import { LocationsRepository } from '../../locations/locations.repository';
import { ConfigRepository } from '../../config/config.repository';
import { NotificationService } from '../../notifications/notification.service';
import { handleCancelConfirmation } from './cancel-flow.helper';
import { resolveOption, resolveOptionWithFallback, generateOffTopicResponse } from './option-resolver.helper';
import { BOT_PAYLOADS } from '../constants/bot-payloads';
import { callLLM, transcribeAudio } from '../../../lib/llm-client';
import { reverseGeocode } from '../../../lib/nominatim-client';
import prisma from '../../../lib/prisma';
import { promptService } from '../../prompts/prompt.service';

const nlpService = new NlpService();

async function generateClarificationQuestions(
  description: string,
  categoryName: string,
): Promise<string | null> {
  const prompt = await promptService.getPrompt('clarification_questions', { categoryName, description });

  const response = await callLLM(prompt);
  const trimmed = response.trim();
  return trimmed === 'NO_QUESTIONS' ? null : trimmed;
}

async function generateTechnicalBrief(
  description: string,
  categoryName: string,
  clarificationAnswer: string | null,
): Promise<string> {
  const prompt = await promptService.getPrompt('technical_brief', {
    categoryName,
    description,
    clarificationAnswer: clarificationAnswer ? `Respuesta adicional del usuario: "${clarificationAnswer}"` : '',
  });

  return callLLM(prompt);
}

async function extractName(input: string): Promise<string> {
  const prompt = await promptService.getPrompt('extract_name', { input });
  try {
    const response = await callLLM(prompt);
    return response.trim() || input.trim();
  } catch {
    return input.trim();
  }
}

type DescriptionValidation = 'VALID' | 'INVALID' | 'UNCERTAIN';

async function validateDescription(description: string, categoryName: string): Promise<DescriptionValidation> {
  const prompt = await promptService.getPrompt('validate_description_match', { categoryName, description });

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
    private readonly notificationService: NotificationService,
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
    if (step === 'INIT' && (message.text || message.buttonPayload)) {
      const payload = (message.buttonPayload || message.text || '').trim();
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

    // Cancel intent interceptor: fires before handleInit when user has no active session
    // and writes a cancellation intent (e.g. "quiero cancelar el pedido")
    if (step === 'INIT') {
      const cancelAliases = ['cancelar', 'quiero cancelar', 'cancelar pedido', 'cancel'];
      const inputNormalized = (message.text || '').toLowerCase().trim();
      if (cancelAliases.some((c) => inputNormalized.includes(c))) {
        const userId = tempData.userId as string;
        if (userId) {
          const activeRequest = await prisma.request.findFirst({
            where: {
              userId,
              status: { in: ['CREATED', 'ASSIGNED', 'ACCEPTED'] },
            },
            select: {
              id: true,
              category: { select: { name: true } },
            },
          });
          if (activeRequest) {
            const categoryName = activeRequest.category?.name || 'el servicio';
            return {
              response: {
                text: `¿Confirmás que querés cancelar tu pedido de ${categoryName}?`,
                options: ['Sí, cancelar', 'No, seguir con el pedido'],
              },
              nextStep: 'CANCEL_CONFIRMATION',
              tempData: { ...tempData, requestId: activeRequest.id, categoryName },
            };
          }
        }
      }
    }

    switch (step) {
      case 'INIT':
        return this.handleInit(tempData);
      case 'ASK_NAME':
        return this.handleAskName(message, tempData);
      case 'ASK_SERVICE':
        return this.handleAskService(message, tempData);
      case 'ASK_SAVED_LOCATION':
        return this.handleAskSavedLocation(message, tempData);
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

      case 'CLARIFICATION':
        return this.handleClarification(message, tempData);
      case 'CONFIRM':
        return this.handleConfirm(message, tempData);
      case 'WAITING_CONSENT':
        return this.handleWaitingConsent(message, tempData);
      case 'WAITING':
        return this.handleWaiting(tempData);
      case 'CANCEL_CONFIRMATION':
        return handleCancelConfirmation(context, this.requestsService, this.notificationService);
      case 'POST_CANCEL':
        return this.handlePostCancel(message, tempData);
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
        tempData: { _clearTempData: true },
      };
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return {
        response: { text: 'Error interno. Intenta de nuevo mas tarde.' },
        nextStep: null,
        tempData: { _clearTempData: true },
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
      let statusText: string;

      switch (activeRequest.status) {
        case 'CREATED':
          statusText =
            'Estamos buscando un profesional para tu pedido. Te avisamos en cuanto confirmemos uno.';
          break;
        case 'ASSIGNED':
          statusText =
            'Ya asignamos un profesional para tu pedido, está por confirmar. Te avisamos en breve.';
          break;
        case 'ACCEPTED':
          statusText =
            'Tu profesional ya aceptó el pedido y está coordinando la visita con vos.';
          break;
        default:
          statusText = 'Tenés un pedido en curso. Te avisamos cuando haya novedades.';
      }

      return {
        response: { text: statusText },
        nextStep: null,
        tempData,
      };
    }

    const hasName = currentName && currentName !== phone;

    if (hasName) {
      return this.handleAskService({}, tempData);
    }

    const extractedServiceName = tempData._extractedServiceName as string | undefined;
    const extractedZoneName = tempData._extractedZoneName as string | undefined;

    if (extractedServiceName || extractedZoneName) {
      let contextText = '';
      if (extractedServiceName && extractedZoneName) {
        contextText = `Entendí que necesitás un ${extractedServiceName} en ${extractedZoneName}.`;
      } else if (extractedServiceName) {
        contextText = `Entendí que necesitás un ${extractedServiceName}.`;
      } else if (extractedZoneName) {
        contextText = `Entendí que estás en ${extractedZoneName}.`;
      }

      return {
        response: {
          text: `¡Perfecto! ${contextText} ¿Me decís tu nombre para continuar?`,
        },
        nextStep: 'ASK_NAME',
        tempData,
      };
    }

    return {
      response: { text: `¡Hola! Soy ${process.env.APP_NAME ?? 'NORA'} 👋 Te conecto con el profesional del hogar que necesitás, cerca tuyo. ¿Cómo te llamás?` },
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
        response: { text: `¡Hola! Soy ${process.env.APP_NAME ?? 'NORA'} 👋 Te conecto con el profesional del hogar que necesitás, cerca tuyo. ¿Cómo te llamás?` },
        nextStep: 'ASK_NAME',
        tempData,
      };
    }

    const extractedName = await extractName(inputName);

    if (!extractedName || extractedName.length > 40 || extractedName.includes('.')) {
      return {
        response: { text: '¡Ups! No reconocí tu nombre. ¿Me decís cómo te llamás?' },
        nextStep: 'ASK_NAME',
        tempData,
      };
    }

    if (userId) {
      await prisma.user.update({ where: { id: userId }, data: { name: extractedName } });
    }

    tempData.name = extractedName;
    tempData._isNewUser = true;

    return this.handleAskService({}, tempData);
  }

  private async resolveExtractedServiceZone(extracted: {
    serviceName: string | null;
    zoneName: string | null;
  }): Promise<{
    categoryId?: string;
    categoryName?: string;
    geoNodeId?: string;
    geoNodeName?: string;
    serviceNotFound?: boolean;
    zoneNotFound?: boolean;
  }> {
    const result: {
      categoryId?: string;
      categoryName?: string;
      geoNodeId?: string;
      geoNodeName?: string;
      serviceNotFound?: boolean;
      zoneNotFound?: boolean;
    } = {};

    if (extracted.serviceName) {
      const categories = await prisma.category.findMany({ where: { isActive: true } });
      const normalizedInput = extracted.serviceName
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');

      const match = categories.find((c) => {
        const normalizedName = c.name
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '');
        return normalizedName.includes(normalizedInput) || normalizedInput.includes(normalizedName);
      });

      if (match) {
        result.categoryId = match.id;
        result.categoryName = match.name;
      } else {
        result.serviceNotFound = true;
      }
    }

    if (extracted.zoneName) {
      const countries = await this.locationsRepository.findAllCountries();
      const country = countries[0];

      if (country) {
        const provinces = await this.locationsRepository.findActiveChildNodes(country.id);
        const province = provinces.length === 1 ? provinces[0] : null;

        if (province) {
          const geoNode = await this.locationsRepository.findChildNodeByName(
            province.id,
            extracted.zoneName,
          );

          if (geoNode) {
            result.geoNodeId = geoNode.id;
            result.geoNodeName = geoNode.name;
          } else {
            result.zoneNotFound = true;
          }
        } else {
          result.zoneNotFound = true;
        }
      } else {
        result.zoneNotFound = true;
      }
    }

    return result;
  }

  private async handleAskService(
    message: { text?: string },
    tempData: Record<string, unknown>,
  ): Promise<FlowStepResult> {
    const extractedServiceName = tempData._extractedServiceName as string | null | undefined;
    const extractedZoneName = tempData._extractedZoneName as string | null | undefined;

    if (extractedServiceName || extractedZoneName) {
      delete tempData._extractedServiceName;
      delete tempData._extractedZoneName;

      const resolved = await this.resolveExtractedServiceZone({
        serviceName: extractedServiceName || null,
        zoneName: extractedZoneName || null,
      });

      console.log('[AUT-308] hints:', extractedServiceName, extractedZoneName);
      console.log('[AUT-308] resolved:', JSON.stringify(resolved));

      const userName = tempData.name as string | undefined;
      const lastGreetingAt = tempData.lastGreetingAt as string | undefined;
      const alreadyGreetedToday = lastGreetingAt
        ? new Date(lastGreetingAt).toDateString() === new Date().toDateString()
        : false;

      let greeting = '';
      if (userName && !alreadyGreetedToday) {
        greeting = `¡Qué bueno volver a verte, ${userName}! `;
        tempData.lastGreetingAt = new Date().toISOString();
      }

      if (resolved.categoryId && resolved.geoNodeId) {
        tempData.categoryId = resolved.categoryId;
        tempData.categoryName = resolved.categoryName;
        tempData.geoNodeId = resolved.geoNodeId;
        tempData.geoNodeName = resolved.geoNodeName;
        return this.proceedAfterService(tempData);
      }

      if (resolved.categoryId && resolved.zoneNotFound) {
        tempData.categoryId = resolved.categoryId;
        tempData.categoryName = resolved.categoryName;
        return {
          response: {
            text: `${greeting}Por el momento no tenemos cobertura en ${extractedZoneName}. ¿En qué zona necesitás el servicio de ${resolved.categoryName}? Compartí tu ubicación o escribí "no" para elegir manualmente.`,
          },
          nextStep: 'ASK_LOCATION',
          tempData,
        };
      }

      if (resolved.categoryId && !extractedZoneName) {
        tempData.categoryId = resolved.categoryId;
        tempData.categoryName = resolved.categoryName;
        return this.proceedAfterService(tempData);
      }

      const categories = await prisma.category.findMany({
        where: { isActive: true },
        orderBy: { name: 'asc' },
      });
      tempData._availableCategories = categories.map((c) => ({ id: c.id, name: c.name }));
      tempData._categoryListed = true;
      const list = categories.map((c, i) => `${i + 1}. ${c.name}`).join('\n');

      let infoText = '';
      if (resolved.serviceNotFound && resolved.zoneNotFound) {
        infoText = `Por el momento no contamos con ${extractedServiceName} ni tenemos cobertura en ${extractedZoneName}. Puedo ayudarte con alguno de estos servicios:\n\n`;
      } else {
        infoText = `Por el momento no contamos con ${extractedServiceName} en nuestra red. Puedo ayudarte con alguno de estos servicios:\n\n`;
      }

      if (resolved.geoNodeId) {
	tempData.geoNodeId = resolved.geoNodeId;
	tempData.geoNodeName = resolved.geoNodeName;
      }

      return {
        response: {
          text: `${infoText}${list}\n\nResponde con el numero.`,
        },
        nextStep: 'ASK_SERVICE',
        tempData,
      };
    }

    const config = await this.configRepository.findByKey('USER_SERVICE_SELECTION_MODE');
    const useList = !config || config.value !== 'FREE_TEXT';
    if (useList) return this.handleAskServiceList(message, tempData);
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
          tempData: { _clearTempData: true },
        };
      }

      tempData._availableCategories = categories.map((c) => ({ id: c.id, name: c.name }));
      tempData._categoryListed = true;

      const list = categories.map((c, i) => `${i + 1}. ${c.name}`).join('\n');

      const userName = tempData.name as string | undefined;
      const isNewUser = !!tempData._isNewUser;
      delete tempData._isNewUser;

      let greeting = '';
      if (userName) {
        if (isNewUser) {
          greeting = `¡Hola, ${userName}! ¿Qué servicio estás buscando?\n\n`;
        } else {
          const lastGreetingAt = tempData.lastGreetingAt as string | undefined;
          const alreadyGreetedToday = lastGreetingAt
            ? new Date(lastGreetingAt).toDateString() === new Date().toDateString()
            : false;
          if (!alreadyGreetedToday) {
            greeting = `¡Qué bueno volver a verte, ${userName}! ¿Qué servicio estás buscando?\n\n`;
            tempData.lastGreetingAt = new Date().toISOString();
          }
        }
      }

      return {
        response: {
          text: `${greeting}${list}\n\nResponde con el numero.`,
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
      const nlpResult = await nlpService.resolveCategory(inputText);
      if (nlpResult.match) {
        tempData.categoryId = nlpResult.match.id;
        tempData.categoryName = nlpResult.match.name;
        return this.proceedAfterService(tempData);
      }

      const list = availableCategories.map((c, i) => `${i + 1}. ${c.name}`).join('\n');
      return {
        response: {
          text: `Ese servicio aún no está disponible en NORA. Por ahora ofrecemos:\n\n${list}\n\n¿Alguno de estos te sirve? Respondé con el número.`,
        },
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
    const categoryName = tempData.categoryName as string;

    if (tempData.geoNodeId) {
      const zoneName = tempData.geoNodeName as string;
      const userId = tempData.userId as string;
      const user = await prisma.user.findUnique({ where: { id: userId } });
      const allSavedLocations = (user?.savedLocations as unknown as SavedLocation[]) || [];

      const matchingLocations = allSavedLocations.filter(
        (loc) => loc.geoNodeId === tempData.geoNodeId,
      );

      if (matchingLocations.length === 0) {
        return {
          response: {
            text: `¡Perfecto! Un servicio de ${categoryName} en ${zoneName}. Contame qué te está pasando — podés escribirlo o mandarme un audio.`,
          },
          nextStep: 'ASK_DESCRIPTION',
          tempData,
        };
      }

      tempData._savedLocations = matchingLocations;

      if (matchingLocations.length === 1) {
        const loc = matchingLocations[0];
        return {
          response: {
            text: `¡Perfecto! Un servicio de ${categoryName} en ${zoneName}. ¿Es para ${loc.address}?\n1. Sí\n2. No, es otra ubicación`,
          },
          nextStep: 'ASK_SAVED_LOCATION',
          tempData,
        };
      }

      const list = matchingLocations.map((loc, i) => `${i + 1}. ${loc.address}`).join('\n');
      const otherOptionNumber = matchingLocations.length + 1;
      return {
        response: {
          text: `¡Perfecto! Un servicio de ${categoryName} en ${zoneName}. ¿Para qué dirección es?\n\n${list}\n${otherOptionNumber}. Otra ubicación`,
        },
        nextStep: 'ASK_SAVED_LOCATION',
        tempData,
      };
    }

    const userId = tempData.userId as string;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    const savedLocations = (user?.savedLocations as unknown as SavedLocation[]) || [];

    if (savedLocations.length === 0) {
      return this.startLocationFlow(tempData);
    }

    tempData._savedLocations = savedLocations;

    if (savedLocations.length === 1) {
      const loc = savedLocations[0];

      return {
        response: {
          text: `¡Perfecto! Un servicio de ${categoryName}. ¿Es para ${loc.address}?\n1. Sí\n2. No, es otra ubicación`,
        },
        nextStep: 'ASK_SAVED_LOCATION',
        tempData,
      };
    }

    const list = savedLocations.map((loc, i) => `${i + 1}. ${loc.address}`).join('\n');
    const otherOptionNumber = savedLocations.length + 1;

    return {
      response: {
        text: `¡Perfecto! Un servicio de ${categoryName}. ¿Para qué dirección es el servicio?\n\n${list}\n${otherOptionNumber}. Otra ubicación`,
      },
      nextStep: 'ASK_SAVED_LOCATION',
      tempData,
    };
  }

  private async handleAskSavedLocation(
    message: { text?: string },
    tempData: Record<string, unknown>,
  ): Promise<FlowStepResult> {
    const savedLocations = (tempData._savedLocations as SavedLocation[]) || [];
    const inputText = message.text?.trim() || '';

    if (savedLocations.length === 1) {
      const resolved = await resolveOptionWithFallback('ASK_SAVED_LOCATION_SINGLE', inputText.toLowerCase());

      if (resolved === 'YES') {
        return this.applySavedLocation(tempData, savedLocations[0]);
      }

      if (resolved === 'NO') {
        return this.startLocationFlow(tempData);
      }

      const loc = savedLocations[0];
      return {
        response: {
          text: `¿Es para ${loc.address}?\n1. Sí\n2. No, es otra ubicación`,
        },
        nextStep: 'ASK_SAVED_LOCATION',
        tempData,
      };
    }

    const number = parseInt(inputText, 10);
    const otherOptionNumber = savedLocations.length + 1;

    if (!isNaN(number) && number >= 1 && number <= savedLocations.length) {
      return this.applySavedLocation(tempData, savedLocations[number - 1]);
    }

    if (number === otherOptionNumber) {
      return this.startLocationFlow(tempData);
    }

    const list = savedLocations.map((loc, i) => `${i + 1}. ${loc.address}`).join('\n');

    return {
      response: {
        text: `Elegí una opción:\n\n${list}\n${otherOptionNumber}. Otra ubicación`,
      },
      nextStep: 'ASK_SAVED_LOCATION',
      tempData,
    };
  }

  private applySavedLocation(
    tempData: Record<string, unknown>,
    loc: SavedLocation,
  ): FlowStepResult {
    tempData.geoNodeId = loc.geoNodeId;
    tempData.geoNodeName = loc.zoneName;
    tempData.userLatitude = loc.lat;
    tempData.userLongitude = loc.lng;
    tempData._reusedSavedAddress = loc.address;

    const categoryName = tempData.categoryName as string;
    const zoneName = loc.zoneName || 'tu zona';
    const locationText = loc.address ? `, ${loc.address}` : '';

    return {
      response: {
	text: `Entendido: ${categoryName} en ${zoneName}${locationText}. Describí el problema. Podés escribirlo o mandar un audio.`,
      },
      nextStep: 'ASK_DESCRIPTION',
      tempData,
    };
  }

  private startLocationFlow(
    tempData: Record<string, unknown>,
  ): FlowStepResult {
    return {
      response: {
        text: 'Para encontrarte al profesional más cercano, compartí tu ubicación por WhatsApp. Si no podés, escribí "no".',
      },
      nextStep: 'ASK_LOCATION',
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
        tempData: { _clearTempData: true },
      };
    }

    const provinces = await this.locationsRepository.findActiveChildNodes(countryId);

    if (provinces.length === 0) {
      return {
        response: { text: 'No hay provincias habilitadas por el momento. Intenta mas tarde.' },
        nextStep: null,
        tempData: { _clearTempData: true },
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
          tempData: { _clearTempData: true },
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
          tempData: { _clearTempData: true },
        };
      }

      const provinces = await this.locationsRepository.findActiveChildNodes(countryId);

      if (provinces.length === 0) {
        return {
          response: { text: 'No hay provincias habilitadas. Intenta mas tarde.' },
          nextStep: null,
          tempData: { _clearTempData: true },
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
        tempData: { _clearTempData: true },
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
          tempData: { _clearTempData: true },
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
      response: {         text: `Zona: ${selected.name}. Describí el problema. Podés escribirlo o mandar un audio.` },
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
        text: `Zona: ${nlpResult.match.name}. Describí el problema. Podés escribirlo o mandar un audio.`,
      },
      nextStep: 'ASK_DESCRIPTION',
      tempData,
    };
  }

  private async handleAskDescription(
    message: { text?: string; audioUrl?: string },
    tempData: Record<string, unknown>,
  ): Promise<FlowStepResult> {
    let description = message.text?.trim();

    if (message.audioUrl && !description) {
      try {
        const transcription = await transcribeAudio(message.audioUrl);
        if (transcription) {
          description = transcription;
          tempData.descriptionAudioUrl = message.audioUrl;
        }
      } catch (err) {
        console.error('[UserRequestFlow] Audio transcription failed:', err);
        return {
          response: { text: 'No pude procesar el audio. ¿Podés escribirme el problema?' },
          nextStep: 'ASK_DESCRIPTION',
          tempData,
        };
      }
    }

    if (!description) {
      return {
        response: { text: 'Describí el problema. Podés escribirlo o mandar un audio.' },
        nextStep: 'ASK_DESCRIPTION',
        tempData,
      };
    }

    const categoryName = tempData.categoryName as string;

    const wordCount = description.split(/\s+/).length;
    if (wordCount <= 8) {
      const stepContext = `El usuario está describiendo un problema de ${categoryName} que necesita resolver en su hogar. Se le pidió que describa brevemente el problema.`;
      const offTopic = await generateOffTopicResponse(description, stepContext);
      if (offTopic) {
        return {
          response: { text: offTopic },
          nextStep: 'ASK_DESCRIPTION',
          tempData,
        };
      }
    }

    tempData.description = description;

    const validation = await validateDescription(description, categoryName);

    if (validation === 'INVALID') {
      return {
        response: {
          text: `Lo que describís no parece relacionado con un servicio de ${categoryName}. ¿Qué querés hacer?\n1. Cambiar el servicio\n2. Reformular la descripción`,
        },
        nextStep: 'DESCRIPTION_MISMATCH',
        tempData: { ...tempData, _mismatchType: 'INVALID' },
      };
    }

    if (validation === 'UNCERTAIN') {
      return {
        response: {
          text: `Solo para confirmar: ¿tu problema está relacionado con un servicio de ${categoryName}?\n1. Sí, es correcto\n2. Quiero cambiar el servicio`,
        },
        nextStep: 'DESCRIPTION_MISMATCH',
        tempData: { ...tempData, _mismatchType: 'UNCERTAIN', _uncertainDescription: description },
      };
    }

    // VALID → continue normally
    return this.handleClarification({ text: undefined }, tempData);
  }

  private async handleAskLocation(
    message: { text?: string; location?: { latitude: number; longitude: number } },
    tempData: Record<string, unknown>,
  ): Promise<FlowStepResult> {
    const categoryName = tempData.categoryName as string;

    if (message.location) {
      tempData.userLatitude = message.location.latitude;
      tempData.userLongitude = message.location.longitude;

      const geocodeResult = await reverseGeocode(message.location.latitude, message.location.longitude);

      if (geocodeResult.departmentName) {
        const provinceId = await this.resolveMendozaProvinceId(tempData.phone as string);

        if (provinceId) {
          const geoNode = await this.locationsRepository.findChildNodeByName(provinceId, geocodeResult.departmentName);

          if (geoNode) {
            tempData.geoNodeId = geoNode.id;
            tempData.geoNodeName = geoNode.name;
            tempData.clientNeighborhood = geocodeResult.neighborhood ?? undefined;
            tempData.clientPostalCode = geocodeResult.postalCode ?? undefined;

            return {
              response: {
                text: `Ubicación: ${geoNode.name}. Entendido: ${categoryName} en ${geoNode.name}. Describí el problema. Podés escribirlo o mandar un audio.`,
              },
              nextStep: 'ASK_DESCRIPTION',
              tempData,
            };
          }
        }
      }

      // Nominatim failed or couldn't resolve GeoNode -> fall back to manual zone flow, keep GPS coords
      return this.proceedToProvinceStep(tempData);
    }

    // Any text = user doesn't want to share GPS -> fall back to manual zone flow
    if (message.text) {
      tempData.userLatitude = undefined;
      tempData.userLongitude = undefined;

      return this.proceedToProvinceStep(tempData);
    }

    // No text nor location -> ask again
    return {
      response: {
        text: 'Para encontrarte al profesional más cercano, compartí tu ubicación por WhatsApp. Si no podés, escribí "no".',
      },
      nextStep: 'ASK_LOCATION',
      tempData,
    };
  }

  private async resolveMendozaProvinceId(phone: string): Promise<string | null> {
    const countryId = await this.resolveCountryId(phone);
    if (!countryId) return null;

    const provinces = await this.locationsRepository.findActiveChildNodes(countryId);
    if (provinces.length === 1) return provinces[0].id;

    return null;
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

      console.log('[ASK_PHOTOS] photoUrls en tempData:', JSON.stringify(tempData.photoUrls));

      if (mergedPhotos.length >= 3) {
        if (tempData.descriptionAudioUrl) {
          tempData.audioUrl = (tempData.descriptionAudioUrl as string) || tempData.audioUrl;
        }
        const confirmText = this.buildConfirmation(tempData);
        return {
          response: { text: confirmText },
          nextStep: 'CONFIRM',
          tempData,
        };
      }

      return {
        response: { text: `Recibí ${mergedPhotos.length}/3 foto(s). Podés enviar más o escribí "no" para continuar.` },
        nextStep: 'ASK_PHOTOS',
        tempData,
      };
    }

    const inputText = message.text?.trim().toLowerCase();

    if (inputText === 'continuar' || !!inputText) {
      if (tempData.descriptionAudioUrl) {
        tempData.audioUrl = (tempData.descriptionAudioUrl as string) || tempData.audioUrl;
      }
      const existingPhotos = (tempData.photoUrls as string[]) || [];
      if (existingPhotos.length === 0) {
        delete tempData.photoUrls;
      }
      const confirmText = this.buildConfirmation(tempData);
      return {
        response: { text: confirmText },
        nextStep: 'CONFIRM',
        tempData,
      };
    }

    return {
      response: { text: '' },
      nextStep: 'ASK_PHOTOS',
      tempData,
    };
  }

  private async handleClarification(
    message: { text?: string; audioUrl?: string },
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

        // NO_QUESTIONS — description is already sufficient
        tempData._descriptionIsComplete = true;
      } catch {
        // LLM error — non-blocking, proceed to technical brief
      }
    } else {
      let answer = message.text?.trim();
      if (!answer && message.audioUrl) {
        try {
          answer = await transcribeAudio(message.audioUrl);
        } catch (err) {
          console.error('[UserRequestFlow] Clarification audio transcription failed:', err);
        }
      }
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
      response: { text: 'Listo. ¿Querés enviar fotos del problema? Hasta 3. Escribí "no" para continuar.' },
      nextStep: 'ASK_PHOTOS',
      tempData,
    };
  }

  private async handleDescriptionMismatch(
    message: { text?: string; buttonPayload?: string },
    tempData: Record<string, unknown>,
  ): Promise<FlowStepResult> {
    const inputText = (message.buttonPayload || message.text?.trim() || '').toLowerCase();
    const categoryName = tempData.categoryName as string;

    if (!message.text?.trim()) {
      const phone = tempData.phone as string;
      const mismatchType = tempData._mismatchType as string;

      if (mismatchType === 'UNCERTAIN') {
        await this.notificationService.notifyUserConfirmService(phone, categoryName);
      } else {
        await this.notificationService.notifyUserDescriptionMismatch(phone, categoryName);
      }

      return {
        response: { text: '' },
        nextStep: 'DESCRIPTION_MISMATCH',
        tempData,
      };
    }

    const mismatchContext = tempData._mismatchType === 'UNCERTAIN' ? 'CONFIRM_SERVICE' : 'DESCRIPTION_MISMATCH';
    const resolved = await resolveOptionWithFallback(mismatchContext, inputText);

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

    if (resolved === 'SI_CORRECTO') {
      return this.handleClarification({ text: undefined }, tempData);
    }

    if (!resolved) {
      const stepContext = `Se le preguntó al usuario si quiere cambiar el servicio o reformular la descripción, porque lo que describió no parece relacionado con ${categoryName}.`;
      const offTopic = await generateOffTopicResponse(inputText, stepContext);
      if (offTopic) {
        return {
          response: { text: offTopic },
          nextStep: 'DESCRIPTION_MISMATCH',
          tempData,
        };
      }
    }

    return {
      response: {
        text: `Describí el problema relacionado con ${categoryName}. Podés escribirlo o mandar un audio.`,
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

    let text = `*Resumen del pedido:*\n\n`;
    text += `*Nombre:* ${name}\n`;
    text += `*Servicio:* ${category}\n`;
    text += `*Zona:* ${zone}\n`;
    const reusedAddress = tempData._reusedSavedAddress as string | undefined;
    if (reusedAddress) {
      text += `*Dirección:* ${reusedAddress}\n`;
    }
    text += `*Problema:* ${description}\n`;

    if (photos.length > 0) {
      text += `*Fotos:* ${photos.length} adjunta(s)\n`;
    }

    text += `\n¿Confirmo la búsqueda? Si aceptás, te aviso cuando un profesional confirme.\n1. Sí\n2. No`;
    return text;
  }

  private async handleConfirm(
    message: { text?: string; buttonPayload?: string },
    tempData: Record<string, unknown>,
  ): Promise<FlowStepResult> {
    const inputText = (message.buttonPayload || message.text?.trim() || '').toLowerCase();
    const resolved = inputText ? resolveOption('CONFIRM', inputText) : null;

    if (resolved === 'YES') {
      try {
        console.log('[CONFIRM] photoUrls al crear request:', JSON.stringify((tempData.photoUrls as string[]) || []));
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
          clientAddress: tempData._reusedSavedAddress as string | undefined,
          clientNeighborhood: tempData.clientNeighborhood as string | undefined,
          clientPostalCode: tempData.clientPostalCode as string | undefined,
        });

        tempData.requestId = request.id;

        // Matching found a professional -> normal flow
        if (request.status === 'ASSIGNED') {
          return {
            response: {
              text: '',
              requestId: request.id,
            },
            nextStep: null,
            tempData: { _clearTempData: true },
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
                `Puede demorar hasta 24hs.`,
              options: ['Sí', 'No'],
              requestId: request.id,
            },
            nextStep: 'WAITING_CONSENT',
            tempData,
          };
        }

        // No match and no trial-exhausted professionals -> close
        await prisma.request.update({
  	   where: { id: request.id },
           data: { status: 'NO_RESPONSE' },
        });

        return {
          response: {
            text: 'En este momento no hay profesionales disponibles en tu zona para este servicio. Podés volver a intentarlo más tarde.',
            requestId: request.id,
          },   
          nextStep: null,
          tempData: { _clearTempData: true },
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
        response: { text: 'Entendido, cancelé el pedido.\n1. Iniciar un nuevo pedido\n2. Por ahora no, gracias' },
        nextStep: 'POST_CANCEL',
        tempData,
      };
    }

    return {
      response: { text: '¿Confirmá la búsqueda?\n1. Sí\n2. No', options: ['Si', 'No'] },
      nextStep: 'CONFIRM',
      tempData,
    };
  }

  private async handleWaitingConsent(
    message: { text?: string; buttonPayload?: string },
    tempData: Record<string, unknown>,
  ): Promise<FlowStepResult> {
    const inputText = (message.buttonPayload || message.text?.trim() || '').toLowerCase();
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
        tempData: { _clearTempData: true },
      };
    }

    if (!resolved && inputText) {
      const categoryName = (tempData.categoryName as string) || 'el servicio';
      const zoneName = (tempData.geoNodeName as string) || 'tu zona';
      const stepContext = `No hay profesionales disponibles para ${categoryName} en ${zoneName}. Se le preguntó al usuario si quiere que le avisemos cuando aparezca uno.`;
      const offTopic = await generateOffTopicResponse(inputText, stepContext);
      if (offTopic) {
        return {
          response: { text: offTopic },
          nextStep: 'WAITING_CONSENT',
          tempData,
        };
      }
    }

    return {
      response: {
      text:
        `En este momento no encontré un profesional disponible para tu pedido. ` +
        `Estoy buscando opciones — si aparece alguien, ¿querés que te avise? ` +
        `Puede demorar hasta 24hs.`,
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
      tempData: { _clearTempData: true },
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
      tempData: { _clearTempData: true },
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
      tempData: { _clearTempData: true },
    };
  }

  private async handleConfirmoVisitaUser(): Promise<FlowStepResult> {
    return {
      response: {
        text: '¡Perfecto! Te esperamos. Cualquier cambio avisanos.',
      },
      nextStep: null,
      tempData: { _clearTempData: true },
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
        tempData: { _clearTempData: true },
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
        tempData: { _clearTempData: true },
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
        tempData: { _clearTempData: true },
      };
    }
  }

  private async handleSeguirEsperando(): Promise<FlowStepResult> {
    return {
      response: {
        text: 'Perfecto, seguimos buscando. Te avisamos en cuanto encontremos otro profesional disponible.',
      },
      nextStep: null,
      tempData: { _clearTempData: true },
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
        tempData: { _clearTempData: true },
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
        tempData: { _clearTempData: true },
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
      tempData: { _clearTempData: true },
    };
  }

  private async handlePostCancel(
    message: { text?: string; buttonPayload?: string },
    tempData: Record<string, unknown>,
  ): Promise<FlowStepResult> {
    const input = (message.buttonPayload || message.text?.trim() || '');
    const resolved = await resolveOptionWithFallback('POST_CANCEL', input);

    if (resolved === 'NEW_REQUEST') {
      delete tempData.geoNodeId;
      delete tempData.geoNodeName;
      delete tempData.userLatitude;
      delete tempData.userLongitude;
      delete tempData._reusedSavedAddress;
      delete tempData.categoryId;
      delete tempData.categoryName;
      return this.handleAskService({}, tempData);
    }

    if (resolved === 'NO') {
      return {
        response: { text: '¡Perfecto! Cuando necesites algo, acá estoy 👋' },
        nextStep: null,
        tempData: { _clearTempData: true },
      };
    }

    return {
      response: { text: 'Elegí una opción:\n1. Iniciar un nuevo pedido\n2. Por ahora no, gracias' },
      nextStep: 'POST_CANCEL',
      tempData,
    };
  }
}
