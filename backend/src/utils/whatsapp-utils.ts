import { BotRepository } from '../modules/bot/bot.repository';

export async function shouldUseTemplate(
  phone: string,
  botRepository: BotRepository,
): Promise<boolean> {
  const withinWindow = await botRepository.isWithin24hWindow(phone);
  return !withinWindow;
}
