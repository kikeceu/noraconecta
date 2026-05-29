import { FlowContext, FlowHandler, FlowStepResult } from './types';
import { ProfessionalsService } from '../../professionals/professionals.service';
import { ProfessionalsRepository } from '../../professionals/professionals.repository';
import { LocationsRepository } from '../../locations/locations.repository';
import prisma from '../../../lib/prisma';

export class ProfessionalRegisterFlow implements FlowHandler {
  readonly flowName = 'PROFESSIONAL_REGISTER';

  constructor(
    private readonly professionalsService: ProfessionalsService,
    private readonly professionalsRepository: ProfessionalsRepository,
    private readonly locationsRepository: LocationsRepository,
  ) {}

  private readonly COUNTRY_PHONE_PREFIXES: { prefix: string; countryId: string }[] = [
    { prefix: '54', countryId: 'cmoojlpis0000mc7g7kxf8z1q' },
    { prefix: '51', countryId: 'cmopxb2ts0002mcqak2883mvh' },
  ];

  private detectCountryId(phone: string): string | null {
    const normalized = phone.replace(/^\+/, '');

    for (const { prefix, countryId } of this.COUNTRY_PHONE_PREFIXES) {
      if (normalized.startsWith(prefix)) {
        return countryId;
      }
    }

    return null;
  }

  getInitialStep(): string {
    return 'ASK_NAME';
  }

  async handleStep(step: string, context: FlowContext): Promise<FlowStepResult> {
    const { session, message } = context;
    const tempData = (session.tempData as Record<string, unknown>) || {};

    switch (step) {
      case 'ASK_NAME':
        return this.handleAskName(message, tempData);
      case 'ASK_SERVICE':
        return this.handleAskService(message, tempData);
      case 'ASK_PROVINCE':
        return this.handleAskProvince(message, tempData);
      case 'ASK_ZONES':
        return this.handleAskZones(message, tempData);
      case 'ASK_LOCATION':
        return this.handleAskLocation(message, tempData);
      case 'ASK_AVAILABILITY':
        return this.handleAskAvailability(message, tempData);
      case 'SEND_LINK':
        return this.handleSendLink();
      default:
        return this.handleAskName(message, tempData);
    }
  }

  private async handleAskName(
    message: { text?: string; phone?: string },
    tempData: Record<string, unknown>,
  ): Promise<FlowStepResult> {
    const alreadyAsked = tempData._nameAsked === true;

    if (!tempData.phone) {
      tempData.phone = message.phone;
    }

    if (!alreadyAsked) {
      tempData._nameAsked = true;
      return {
        response: {
          text: 'Hola! Para registrarte como profesional necesito algunos datos. Cual es tu nombre completo?',
        },
        nextStep: 'ASK_NAME',
        tempData,
      };
    }

    const inputName = message.text?.trim();

    if (!inputName) {
      return {
        response: { text: 'Cual es tu nombre completo?' },
        nextStep: 'ASK_NAME',
        tempData,
      };
    }

    tempData.name = inputName;

    return this.handleAskService({}, tempData);
  }

  private async handleAskService(
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
          text: `Cual es tu oficio principal?\n\n${list}\n\nResponde con el numero.`,
        },
        nextStep: 'ASK_SERVICE',
        tempData,
      };
    }

    const inputText = message.text?.trim() || '';
    const availableCategories = tempData._availableCategories as { id: string; name: string }[];
    const number = parseInt(inputText, 10);

    if (isNaN(number) || number < 1 || number > availableCategories.length) {
      const list = availableCategories.map((c, i) => `${i + 1}. ${c.name}`).join('\n');
      return {
        response: {
          text: `Elegi un numero entre 1 y ${availableCategories.length}:\n\n${list}`,
        },
        nextStep: 'ASK_SERVICE',
        tempData,
      };
    }

    const selected = availableCategories[number - 1];
    tempData.categoryId = selected.id;
    tempData.categoryName = selected.name;

    const phone = tempData.phone as string;
    const countryId = this.detectCountryId(phone);

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

    tempData._countryId = countryId;
    tempData._availableProvinces = provinces.map((p) => ({ id: p.id, name: p.name }));
    tempData._provinceListed = true;

    const list = provinces.map((p, i) => `${i + 1}. ${p.name}`).join('\n');

    return {
      response: {
        text: `Entendido, sos ${selected.name}. En que provincia trabajas?\n\n${list}\n\nResponde con el numero.`,
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
      const countryId = this.detectCountryId(phone);

      if (!countryId) {
        return {
          response: { text: 'No pude detectar tu pais. Contacta a soporte.' },
          nextStep: null,
          tempData,
        };
      }

      tempData._countryId = countryId;

      const provinces = await this.locationsRepository.findActiveChildNodes(countryId);

      if (provinces.length === 0) {
        return {
          response: { text: 'No hay provincias habilitadas por el momento. Intenta mas tarde.' },
          nextStep: null,
          tempData,
        };
      }

      tempData._availableProvinces = provinces.map((p) => ({ id: p.id, name: p.name }));
      tempData._provinceListed = true;

      const list = provinces.map((p, i) => `${i + 1}. ${p.name}`).join('\n');

      return {
        response: {
          text: `En que provincia trabajas?\n\n${list}\n\nResponde con el numero.`,
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
        response: { text: `No entendi la respuesta. Elegi un numero entre 1 y ${availableProvinces.length}:\n\n${list}` },
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
        response: { text: 'No hay zonas habilitadas en esa provincia por el momento. Intenta mas tarde.' },
        nextStep: null,
        tempData,
      };
    }

    tempData._availableZones = zones.map((z) => ({ id: z.id, name: z.name }));
    tempData._zonesListed = true;

    const list = zones.map((z, i) => `${i + 1}. ${z.name}`).join('\n');

    return {
      response: {
        text: `Provincia seleccionada: ${selected.name}. En que zonas trabajas?\n\n${list}\n\nResponde con los numeros separados por coma. Podes elegir mas de una. (Ej: 1, 3)`,
      },
      nextStep: 'ASK_ZONES',
      tempData,
    };
  }

  private async handleAskZones(
    message: { text?: string },
    tempData: Record<string, unknown>,
  ): Promise<FlowStepResult> {

    if (!tempData._zonesListed) {
      const provinceId = tempData._provinceId as string;
      const zones = await this.locationsRepository.findActiveChildNodes(provinceId);

      if (zones.length === 0) {
        return {
          response: { text: 'No hay zonas habilitadas en esa provincia por el momento. Intenta mas tarde.' },
          nextStep: null,
          tempData,
        };
      }

      tempData._availableZones = zones.map((z) => ({ id: z.id, name: z.name }));
      tempData._zonesListed = true;

      const list = zones.map((z, i) => `${i + 1}. ${z.name}`).join('\n');

      return {
        response: {
          text: `En que zonas de ${tempData._provinceName} trabajas?\n\n${list}\n\nResponde con los numeros separados por coma. Podes elegir mas de una. (Ej: 1, 3)`,
        },
        nextStep: 'ASK_ZONES',
        tempData,
      };
    }

    const inputText = message.text?.trim() || '';
    const availableZones = tempData._availableZones as { id: string; name: string }[];

    const numbers = inputText
      .split(/[\s,]+/)
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => !isNaN(n));

    if (numbers.length === 0) {
      const list = availableZones.map((z, i) => `${i + 1}. ${z.name}`).join('\n');
      return {
        response: { text: `No entendi la respuesta. Indica los numeros de las zonas:\n\n${list}` },
        nextStep: 'ASK_ZONES',
        tempData,
      };
    }

    const selected = numbers
      .filter((n) => n >= 1 && n <= availableZones.length)
      .map((n) => availableZones[n - 1]);

    const invalid = numbers.filter((n) => n < 1 || n > availableZones.length);

    if (selected.length === 0) {
      const list = availableZones.map((z, i) => `${i + 1}. ${z.name}`).join('\n');
      return {
        response: { text: `Esos numeros no corresponden a ninguna zona. Elegi entre las opciones:\n\n${list}` },
        nextStep: 'ASK_ZONES',
        tempData,
      };
    }

    tempData.zones = selected.map((z) => z.name);
    tempData.zoneIds = selected.map((z) => z.id);

    let responseText = `Zonas registradas: ${selected.map((z) => z.name).join(', ')}.`;
    if (invalid.length > 0) {
      responseText += ` (Numeros no reconocidos: ${invalid.join(', ')})`;
    }
    responseText += ' Para poder asignarte pedidos cercanos, comparti tu ubicacion por WhatsApp.';

    return {
      response: { text: responseText },
      nextStep: 'ASK_LOCATION',
      tempData,
    };
  }

  private async handleAskLocation(
    message: { location?: { latitude: number; longitude: number } },
    tempData: Record<string, unknown>,
  ): Promise<FlowStepResult> {
    if (!message.location) {
      return {
        response: {
          text: 'Necesito que compartas tu ubicacion para asignarte pedidos cercanos. Envia el pin desde WhatsApp con el boton de ubicacion.',
        },
        nextStep: 'ASK_LOCATION',
        tempData,
      };
    }

    tempData.latitude = message.location.latitude;
    tempData.longitude = message.location.longitude;

    return {
      response: {
        text: 'Perfecto. Cuales son tus horarios de disponibilidad general? (Ej: Lunes a Viernes de 8 a 18)',
      },
      nextStep: 'ASK_AVAILABILITY',
      tempData,
    };
  }

  private async handleAskAvailability(
    message: { text?: string },
    tempData: Record<string, unknown>,
  ): Promise<FlowStepResult> {
    const inputText = message.text?.trim();

    if (!inputText) {
      return {
        response: {
          text: 'Cuales son tus horarios de disponibilidad general? (Ej: Lunes a Viernes de 8 a 18)',
        },
        nextStep: 'ASK_AVAILABILITY',
        tempData,
      };
    }

    tempData.availability = inputText;

    try {
      const phone = tempData.phone as string;
      const name = tempData.name as string;
      const categoryId = tempData.categoryId as string;
      const zoneIds = (tempData.zoneIds as string[]) || [];
      const availability = inputText;
      const latitude = tempData.latitude as number | undefined;
      const longitude = tempData.longitude as number | undefined;

      console.log('[ProfessionalRegisterFlow] handleAskAvailability: registering professional', { phone, name, categoryId });

      const { professional, verificationUrl } = await this.professionalsService.register(
        phone,
        name,
        categoryId,
        latitude,
        longitude,
      );

      for (const zoneId of zoneIds) {
        await this.professionalsRepository.addZone(professional.id, zoneId);
      }

      await this.professionalsRepository.update(professional.id, { availability });

      console.log('[ProfessionalRegisterFlow] handleAskAvailability: professional created', { professionalId: professional.id, verificationToken: professional.verificationToken });

      tempData.verificationUrl = verificationUrl;

      return {
        response: {
          text: `Perfecto! Para completar tu registro necesito verificar tu identidad. Accede a este enlace:\n\n${verificationUrl}`,
        },
        nextStep: 'SEND_LINK',
        tempData,
      };
    } catch (err) {
      console.error('[ProfessionalRegisterFlow] handleAskAvailability: registration failed', err);

      const errorMessage = err instanceof Error ? err.message : 'Error al registrar';

      return {
        response: { text: `No se pudo completar el registro: ${errorMessage}. Intenta de nuevo mas tarde.` },
        nextStep: null,
        tempData,
      };
    }
  }

  private async handleSendLink(): Promise<FlowStepResult> {
    return {
      response: {
        text: 'Una vez que completes el registro, te confirmaremos por este medio. Gracias!',
      },
      nextStep: null,
      tempData: {},
    };
  }
}
