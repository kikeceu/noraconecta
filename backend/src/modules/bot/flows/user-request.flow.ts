import { NlpService } from '../nlp.service';
import { FlowContext, FlowHandler, FlowStepResult } from './types';
import { RequestsService } from '../../requests/requests.service';
import { PaymentsService } from '../../payments/payments.service';
import { handleCancelConfirmation } from './cancel-flow.helper';
import prisma from '../../../lib/prisma';

const nlpService = new NlpService();

export class UserRequestFlow implements FlowHandler {
  readonly flowName = 'USER_REQUEST';

  constructor(
    private readonly requestsService: RequestsService,
    private readonly paymentsService: PaymentsService,
  ) {}

  getInitialStep(): string {
    return 'INIT';
  }

  async handleStep(step: string, context: FlowContext): Promise<FlowStepResult> {
    const { session, message } = context;
    const tempData = (session.tempData as Record<string, unknown>) || {};

    switch (step) {
      case 'INIT':
        return this.handleInit(tempData);
      case 'ASK_NAME':
        return this.handleAskName(message, tempData);
      case 'ASK_SERVICE':
        return this.handleAskService(message, tempData);
      case 'ASK_ZONE':
        return this.handleAskZone(message, tempData);
      case 'ASK_DESCRIPTION':
        return this.handleAskDescription(message, tempData);
      case 'ASK_PHOTOS':
        return this.handleAskPhotos(message, tempData);
      case 'ASK_AUDIO':
        return this.handleAskAudio(message, tempData);
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
      return {
        response: { text: `Hola ${currentName}! Que tipo de servicio necesitas?` },
        nextStep: 'ASK_SERVICE',
        tempData,
      };
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

    return {
      response: { text: `Hola ${inputName}! Que tipo de servicio necesitas?` },
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

    return {
      response: {
        text: `Entendido: ${nlpResult.match.name}. En que zona necesitas el servicio?`,
      },
      nextStep: 'ASK_ZONE',
      tempData,
    };
  }

  private async handleAskZone(
    message: { text?: string },
    tempData: Record<string, unknown>,
  ): Promise<FlowStepResult> {
    const inputText = message.text?.trim();

    if (!inputText) {
      return {
        response: { text: 'En que zona necesitas el servicio? (Ej: Maipu, Godoy Cruz, Capital)' },
        nextStep: 'ASK_ZONE',
        tempData,
      };
    }

    const nlpResult = await nlpService.resolveZone(inputText);

    if (!nlpResult.match) {
      return {
        response: { text: 'No encontre esa zona. Podrias indicarme otra? (Ej: Maipu, Godoy Cruz)' },
        nextStep: 'ASK_ZONE',
        tempData,
      };
    }

    tempData.geoNodeId = nlpResult.match.id;
    tempData.geoNodeName = nlpResult.match.name;

    return {
      response: { text: `Zona: ${nlpResult.match.name}. Contame brevemente el problema` },
      nextStep: 'ASK_DESCRIPTION',
      tempData,
    };
  }

  private async handleAskDescription(
    message: { text?: string },
    tempData: Record<string, unknown>,
  ): Promise<FlowStepResult> {
    const inputText = message.text?.trim();

    if (!inputText) {
      return {
        response: { text: 'Contame brevemente que problema tenes' },
        nextStep: 'ASK_DESCRIPTION',
        tempData,
      };
    }

    tempData.description = inputText;

    return {
      response: { text: 'Queres enviar fotos? (hasta 3) Escribi "listo" para continuar sin fotos' },
      nextStep: 'ASK_PHOTOS',
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
      return {
        response: {
          text: `Recibi ${newPhotos.length} foto(s). Total: ${mergedPhotos.length}/3. Escribi "listo" para continuar`,
        },
        nextStep: 'ASK_PHOTOS',
        tempData,
      };
    }

    const inputText = message.text?.trim().toLowerCase();

    if (inputText === 'listo') {
      return {
        response: { text: 'Queres enviar un audio con mas detalle? Escribi "listo" para continuar' },
        nextStep: 'ASK_AUDIO',
        tempData,
      };
    }

    return {
      response: { text: 'Queres enviar fotos? (hasta 3) Escribi "listo" para continuar sin fotos' },
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
      const confirmText = this.buildConfirmation(tempData);
      return {
        response: { text: confirmText, options: ['Si', 'No'] },
        nextStep: 'CONFIRM',
        tempData,
      };
    }

    const inputText = message.text?.trim().toLowerCase();

    if (inputText === 'listo' || !!inputText) {
      const confirmText = this.buildConfirmation(tempData);
      return {
        response: { text: confirmText, options: ['Si', 'No'] },
        nextStep: 'CONFIRM',
        tempData,
      };
    }

    return {
      response: {
        text: 'Queres enviar un audio con mas detalle? Escribi "listo" para continuar',
      },
      nextStep: 'ASK_AUDIO',
      tempData,
    };
  }

  private buildConfirmation(tempData: Record<string, unknown>): string {
    const name = tempData.name as string;
    const category = tempData.categoryName as string;
    const zone = tempData.geoNodeName as string;
    const description = tempData.description as string;
    const photos = (tempData.photoUrls as string[]) || [];
    const hasAudio = !!tempData.audioUrl;

    let text = `Resumen del pedido:\n\n`;
    text += `Nombre: ${name}\n`;
    text += `Servicio: ${category}\n`;
    text += `Zona: ${zone}\n`;
    text += `Problema: ${description}\n`;

    if (photos.length > 0) {
      text += `Fotos: ${photos.length} adjunta(s)\n`;
    }

    if (hasAudio) {
      text += `Audio: Si\n`;
    }

    text += `\nConfirmo la busqueda de un profesional? (Si / No)`;
    return text;
  }

  private async handleConfirm(
    message: { text?: string },
    tempData: Record<string, unknown>,
  ): Promise<FlowStepResult> {
    const inputText = message.text?.trim().toLowerCase();

    if (inputText === 'si' || inputText === 'sí') {
      try {
        const request = await this.requestsService.create({
          phone: tempData.phone as string,
          categoryId: tempData.categoryId as string,
          geoNodeId: tempData.geoNodeId as string,
          description: tempData.description as string,
          photoUrls: (tempData.photoUrls as string[]) || [],
          audioUrl: tempData.audioUrl as string | undefined,
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
                `Puede demorar hasta 24hs.`,
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

    if (inputText === 'no') {
      return {
        response: { text: 'Pedido cancelado. Cuando necesites algo, escribime.' },
        nextStep: null,
        tempData: {},
      };
    }

    return {
      response: { text: 'Confirma la busqueda? Responde Si o No', options: ['Si', 'No'] },
      nextStep: 'CONFIRM',
      tempData,
    };
  }

  private async handleWaitingConsent(
    message: { text?: string },
    tempData: Record<string, unknown>,
  ): Promise<FlowStepResult> {
    const inputText = message.text?.trim().toLowerCase();

    if (inputText === 'si' || inputText === 'sí') {
      return this.handleWaiting(tempData);
    }

    if (inputText === 'no') {
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
}
