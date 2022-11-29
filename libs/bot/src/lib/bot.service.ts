import { ElectricityAvailabilityService } from '@electrobot/electricity-availability';
import { Injectable, Logger } from '@nestjs/common';
import { format, formatDistance } from 'date-fns';
import { convertToTimeZone } from 'date-fns-timezone';
import { uk } from 'date-fns/locale';
import * as TelegramBot from 'node-telegram-bot-api';

const TIME_ZONE = 'Europe/Kiev';

@Injectable()
export class BotService {
  private readonly logger = new Logger(BotService.name);
  private readonly telegramBot: TelegramBot;

  constructor(
    private readonly electricityAvailabilityService: ElectricityAvailabilityService
  ) {
    const token = process.env.TELEGRAM_TOKEN as string;

    this.telegramBot = new TelegramBot(token, { polling: true });

    // Matches /current
    this.telegramBot.onText(/\/current/, (msg) =>
      this.handleCurrentCommand(msg)
    );
  }

  private async handleCurrentCommand(msg: TelegramBot.Message): Promise<void> {
    this.logger.verbose(`Handling message: ${JSON.stringify(msg)}`);
    const latest =
      await this.electricityAvailabilityService.getLatestAvailability();

    if (!latest) {
      this.telegramBot.sendMessage(
        msg.chat.id,
        'Нажаль, наразі інформація щодо наявності світла (електроенергії) відсутня.'
      );

      return;
    }

    const changeTime = convertToTimeZone(latest.time, { timeZone: TIME_ZONE });
    const now = convertToTimeZone(new Date(), { timeZone: TIME_ZONE });
    const when = format(changeTime, 'd MMMM HH:mm', { locale: uk });
    const howLong = formatDistance(now, changeTime, {
      locale: uk,
      includeSeconds: false,
    });
    const response = latest.isAvailable
      ? `Наразі все добре - світло (електроенерія) є! Включення відбулося ${when}. Світло є вже ${howLong}.`
      : `Нажаль, наразі світла нема (електроенергія відсутня). Відключення відбулося ${when}. Світла нема вже ${howLong}.`;

    this.telegramBot.sendMessage(msg.chat.id, response);
  }
}
