import { NlpService } from '../nlp.service';
import { FlowContext, FlowHandler, FlowStepResult } from './types';
import prisma from '../../../lib/prisma';

const nlpService = new NlpService();

export class UserRequestFlow implements FlowHandler {
  readonly flowName = 'USER_REQUEST';

  getInitialStep(): string {
    return 'INIT';
  }

  async handleStep(step: string, context: FlowContext): Promise<FlowStepResult> {
    const { session, message } = context;
    const tempData = (session.tempData as Record<string, unknown>) || {};

    switch (step) {
      case 'INIT':
        return this.handleInit(message, tempData);
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
      default:
        return this.handleInit(message, tempData);
    }
  }

  private async handleInit(
    message: { text?: string; phone: string },
    tempData: Record<string, unknown>,
  ): Promise<FlowStepResult> {
    const existingName = tempData.name as string | undefined;

    if (existingName) {
      return {
        response: { text: `Hola ${existingName}! Que tipo de servicio necesitas?` },
        nextStep: 'ASK_SERVICE',
        tempData,
      };
    }

    const inputName = message.text?.trim();
    if (!inputName || inputName.length === 0) {
      const user = await prisma.user.findUnique({ where: { phone: message.phone } });

      if (user) {
        tempData.name = user.name;
        tempData.userId = user.id;

        if (user.status === 'BLOCKED') {
          return {
            response: { text: 'Lo sentimos, tu cuenta no puede realizar pedidos en este momento.' },
            nextStep: null,
            tempData,
          };
        }

        const activeRequest = await prisma.request.findFirst({
          where: {
            userId: user.id,
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

        return {
          response: {
            text: `Hola ${user.name}! Que tipo de servicio necesitas?`,
          },
          nextStep: 'ASK_SERVICE',
          tempData,
        };
      }

      return {
        response: { text: 'Hola, soy NORA. Cual es tu nombre?' },
        nextStep: 'INIT',
        tempData,
      };
    }

    tempData.name = inputName;
    return {
      response: {
        text: `Hola ${inputName}! Que tipo de servicio necesitas?`,
      },
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
    }

    const inputText = message.text?.trim().toLowerCase();

    if (inputText === 'listo' || (inputText !== 'listo' && !message.audioUrl)) {
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
      return {
        response: {
          text: 'Buscando el profesional ideal... te aviso cuando confirme.',
        },
        nextStep: 'SEARCHING',
        tempData,
      };
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
