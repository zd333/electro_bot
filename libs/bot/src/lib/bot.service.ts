import { ElectricityAvailabilityService } from '@electrobot/electricity-availability';
import { UserRepository } from '@electrobot/user-repo';
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
    private readonly electricityAvailabilityService: ElectricityAvailabilityService,
    private readonly userRepository: UserRepository
  ) {
    const token = process.env.TELEGRAM_TOKEN as string;

    this.telegramBot = new TelegramBot(token, { polling: true });

    // Matches /current
    this.telegramBot.onText(/\/current/, (msg) =>
      this.handleCurrentCommand(msg)
    );

    // Matches /subscribe
    this.telegramBot.onText(/\/subscribe/, (msg) =>
      this.handleSubscribeCommand(msg)
    );

    // Matches /unsubscribe
    this.telegramBot.onText(/\/unsubscribe/, (msg) =>
      this.handleUnsubscribeCommand(msg)
    );

    this.electricityAvailabilityService.availabilityChange$.subscribe(() =>
      this.notifyAllSubscribersAboutElectricityAvailabilityChange()
    );
  }

  private async handleCurrentCommand(msg: TelegramBot.Message): Promise<void> {
    this.logger.verbose(`Handling message: ${JSON.stringify(msg)}`);

    const [latest] =
      await this.electricityAvailabilityService.getLatestAvailability({
        numberOfLatestEvents: 1,
      });

    if (!latest) {
      this.telegramBot.sendMessage(
        msg.chat.id,
        'Нажаль, наразі інформація щодо наявності світла в УК відсутня.'
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
      ? `Наразі все добре - світло в УК є! Включення відбулося ${when}. Світло є вже ${howLong}. Слава Україні!`
      : `Нажаль, наразі світла в УК нема. Відключення відбулося ${when}. Світла нема вже ${howLong}. Причина вимкнення - йо&ана русня!`;

    this.telegramBot.sendMessage(msg.chat.id, response);
  }

  private async handleSubscribeCommand(
    msg: TelegramBot.Message
  ): Promise<void> {
    this.logger.verbose(`Handling message: ${JSON.stringify(msg)}`);

    const added = await this.userRepository.addUserSubscription({
      chatId: msg.chat.id,
    });
    const response = added
      ? 'Підписка створена - ви будете отримувати повідомлення кожного разу після зміни ситуації зі світлом в УК. Ви завжди можете відписатися за допомогою команди /unsubscribe. Слава Україні!'
      : 'Ви вже підписані і отримуєте повідомлення кожного разу після зміни ситуації зі світлом в УК. Ви завжди можете відписатися за допомогою команди /unsubscribe. Слава Україні!';

    this.telegramBot.sendMessage(msg.chat.id, response);
  }

  private async handleUnsubscribeCommand(
    msg: TelegramBot.Message
  ): Promise<void> {
    this.logger.verbose(`Handling message: ${JSON.stringify(msg)}`);

    const removed = await this.userRepository.removeUserSubscription({
      chatId: msg.chat.id,
    });
    const response = removed
      ? 'Ви відписалися і більше не будете отримувати повідомлення щодо зміни ситуації зі світлом в УК. Слава Україні!'
      : 'Ви не були підписані і не отримуєте повідомлення щодо зміни ситуації зі світлом в УК. Слава Україні!';

    this.telegramBot.sendMessage(msg.chat.id, response);
  }

  private async notifyAllSubscribersAboutElectricityAvailabilityChange(): Promise<void> {
    const subscribers = await this.userRepository.getAllUserSubscriptions();

    this.logger.verbose(
      `Notifying all ${subscribers.length} subscribers about electricity availability change`
    );

    const [latest, previous] =
      await this.electricityAvailabilityService.getLatestAvailability({
        numberOfLatestEvents: 2,
      });

    if (!latest) {
      this.logger.error(
        'Electricity availability changed event, however no availability data in the repo'
      );

      return;
    }

    let response: string;

    if (!previous) {
      response = latest.isAvailable
        ? `Ура, світло в УК включили! Слава Україні!`
        : `Увага, світло в УК вимкнено. Причина вимкнення - йо&ана русня!`;
    } else {
      const latestTime = convertToTimeZone(latest.time, {
        timeZone: TIME_ZONE,
      });
      const previousTime = convertToTimeZone(latest.time, {
        timeZone: TIME_ZONE,
      });
      const howLong = formatDistance(latestTime, previousTime, {
        locale: uk,
        includeSeconds: false,
      });

      response = latest.isAvailable
        ? `Ура, світло в УК включили! Світло було відсутнє протягом ${howLong}. Слава Україні!`
        : `Увага, світло в УК вимкнено. До вимкнення світло було доступне протягом ${howLong}. Причина вимкнення - йо&ана русня!`;
    }

    subscribers.forEach(({ chatId }) => {
      this.telegramBot.sendMessage(chatId, response);
    });

    this.logger.verbose(
      `Finished notifying all ${subscribers.length} subscribers about electricity availability change`
    );
  }
}
