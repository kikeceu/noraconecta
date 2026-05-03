import { NlpService } from '../nlp.service';
import { FlowContext, FlowHandler, FlowStepResult } from './types';
import { ProfessionalsService } from '../../professionals/professionals.service';
import { ProfessionalsRepository } from '../../professionals/professionals.repository';

const nlpService = new NlpService();

export class ProfessionalRegisterFlow implements FlowHandler {
  readonly flowName = 'PROFESSIONAL_REGISTER';

  constructor(
    private readonly professionalsService: ProfessionalsService,
    private readonly professionalsRepository: ProfessionalsRepository,
  ) {}

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
      case 'ASK_ZONES':
        return this.handleAskZones(message, tempData);
      case 'ASK_AVAILABILITY':
        return this.handleAskAvailability(message, tempData);
      case 'SEND_LINK':
        return this.handleSendLink();
      default:
        return this.handleAskName(message, tempData);
    }
  }

  private async handleAskName(
    message: { text?: string },
    tempData: Record<string, unknown>,
  ): Promise<FlowStepResult> {
    const alreadyAsked = tempData._nameAsked === true;

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

    return {
      response: { text: 'Cual es tu oficio principal?' },
      nextStep: 'ASK_SERVICE',
      tempData,
    };
  }

  private async handleAskService(
    message: { text?: string },
    tempData: Record<string, unknown>,
  ): Promise<FlowStepResult> {
    const inputText = message.text?.trim();

    if (!inputText) {
      return {
        response: { text: 'Cual es tu oficio principal? (Ej: plomero, electricista, pintor)' },
        nextStep: 'ASK_SERVICE',
        tempData,
      };
    }

    const nlpResult = await nlpService.resolveCategory(inputText);

    if (!nlpResult.match) {
      return {
        response: {
          text: 'No encontre esa categoria. Podrias ser mas especifico? (Ej: plomero, gasista, albanil)',
        },
        nextStep: 'ASK_SERVICE',
        tempData,
      };
    }

    tempData.categoryId = nlpResult.match.id;
    tempData.categoryName = nlpResult.match.name;

    return {
      response: {
        text: `Entendido: ${nlpResult.match.name}. En que zonas trabajas? Podes indicar varias separadas por coma o "y".`,
      },
      nextStep: 'ASK_ZONES',
      tempData,
    };
  }

  private async handleAskZones(
    message: { text?: string },
    tempData: Record<string, unknown>,
  ): Promise<FlowStepResult> {
    const inputText = message.text?.trim();

    if (!inputText) {
      return {
        response: {
          text: 'En que zonas trabajas? Podes indicar varias separadas por coma o "y". (Ej: Maipu, Godoy Cruz y Capital)',
        },
        nextStep: 'ASK_ZONES',
        tempData,
      };
    }

    const zoneNames = inputText
      .replace(/\s+y\s+/gi, ',')
      .replace(/\s+e\s+/gi, ',')
      .split(',')
      .map((z) => z.trim())
      .filter((z) => z.length > 0);

    const resolvedZones: string[] = [];
    const zoneIds: string[] = [];
    const notFoundZones: string[] = [];

    for (const zoneName of zoneNames) {
      const nlpResult = await nlpService.resolveZone(zoneName);

      if (nlpResult.match) {
        resolvedZones.push(nlpResult.match.name);
        zoneIds.push(nlpResult.match.id);
      } else {
        notFoundZones.push(zoneName);
      }
    }

    if (resolvedZones.length === 0) {
      return {
        response: {
          text: 'No encontre ninguna de las zonas indicadas. Podrias probar con otros nombres? (Ej: Maipu, Godoy Cruz)',
        },
        nextStep: 'ASK_ZONES',
        tempData,
      };
    }

    tempData.zones = resolvedZones;
    tempData.zoneIds = zoneIds;

    let response = `Zonas registradas: ${resolvedZones.join(', ')}.`;
    if (notFoundZones.length > 0) {
      response += ` (No encontre: ${notFoundZones.join(', ')})`;
    }
    response += ` Cuales son tus horarios de disponibilidad general?`;

    return {
      response: { text: response },
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

      console.log('[ProfessionalRegisterFlow] handleAskAvailability: registering professional', { phone, name, categoryId });

      const { professional, verificationUrl } = await this.professionalsService.register(
        phone,
        name,
        categoryId,
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
