import { BotRole } from '@prisma/client';
import { BotRepository } from '../modules/bot/bot.repository';

export async function shouldUseTemplate(
  phone: string,
  role: BotRole,
  botRepository: BotRepository,
): Promise<boolean> {
  const withinWindow = await botRepository.isWithin24hWindow(phone, role);
  return !withinWindow;
}
