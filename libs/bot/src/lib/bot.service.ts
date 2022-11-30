import { ElectricityAvailabilityService } from '@electrobot/electricity-availability';
import { UserRepository } from '@electrobot/user-repo';
import { Injectable, Logger } from '@nestjs/common';
import { addMinutes, differenceInMinutes, format, formatDistance } from 'date-fns';
import { convertToTimeZone } from 'date-fns-timezone';
import { uk } from 'date-fns/locale';
import * as TelegramBot from 'node-telegram-bot-api';
import * as Emoji from 'node-emoji';

const TIME_ZONE = process.env.PLACE_TIMEZONE as string;
const PLACE = process.env.PLACE_NAME as string;

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

    // Matches /start
    this.telegramBot.onText(/\/start/, (msg) => this.handleStartCommand(msg));

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

    // Matches /stop
    this.telegramBot.onText(/\/stop/, (msg) =>
      this.handleUnsubscribeCommand(msg)
    );

    // Matches /stats
    this.telegramBot.onText(/\/stats/, (msg) => this.handleStatsCommand(msg));

    // Matches /about
    this.telegramBot.onText(/\/about/, (msg) => this.handleAboutCommand(msg));

    this.electricityAvailabilityService.availabilityChange$.subscribe(() => {
      this.notifyAllSubscribersAboutElectricityAvailabilityChange();
    });
  }

  private async handleStartCommand(msg: TelegramBot.Message): Promise<void> {
    this.logger.verbose(`Handling message: ${JSON.stringify(msg)}`);

    const response = `Привіт! Цей бот допомогає моніторити ситуацію зі світлом (електроенергією) в ${PLACE}.\n\nЗа допомогою команди /current ти завжди можеш дізнатися чи є зараз в кварталі світло і як довго це триває.\n\nКоманда /subscribe дозволяє підписатися на сповіщення щодо зміни ситуації (відключення/включення).\n\nЗа допомогою команди /stats можна переглянути статистику (звіт по включенням/відключенням за поточну і попередню добу, сумарний час наявності/відсутності світла).\n${Emoji.get(
      Emoji.emoji['flag-ua']
    )}${Emoji.get(Emoji.emoji['flag-ua'])}${Emoji.get(Emoji.emoji['flag-ua'])}`;

    this.telegramBot.sendMessage(msg.chat.id, response);

    const tmpResponse =
      'Бот поки що працює в тестовому режимі, тому ми заздалегідь просимо пробачити можливі помилки і глюки.\nЗ часом вони всі будуть виправлені.';

    this.telegramBot.sendMessage(msg.chat.id, tmpResponse);

    if (msg.from?.language_code !== 'ru') {
      return;
    }

    const fuckRussiansResponse = `Доречі, ми помітили, що у тебе в Telegram встановлена російська мова${Emoji.get(
      Emoji.emoji['poop']
    )}.\nЗакликаємо натомість перейти на солов‘їну, адже українська мова - найкраща!${Emoji.get(
      Emoji.emoji['flag-ua']
    )}${Emoji.get(Emoji.emoji['flag-ua'])}${Emoji.get(Emoji.emoji['flag-ua'])}`;

    this.telegramBot.sendMessage(msg.chat.id, fuckRussiansResponse);
  }

  private async handleCurrentCommand(msg: TelegramBot.Message): Promise<void> {
    this.logger.verbose(`Handling message: ${JSON.stringify(msg)}`);

    const [latest] =
      await this.electricityAvailabilityService.getLatestAvailability({
        limit: 1,
      });

    if (!latest) {
      this.telegramBot.sendMessage(
        msg.chat.id,
        `Нажаль, наразі інформація щодо наявності світла в ${PLACE} відсутня.`
      );

      return;
    }

    const changeTime = convertToTimeZone(latest.time, { timeZone: TIME_ZONE });
    const now = convertToTimeZone(new Date(), { timeZone: TIME_ZONE });
    const when = format(changeTime, 'd MMMM о HH:mm', { locale: uk });
    const howLong = formatDistance(now, changeTime, {
      locale: uk,
      includeSeconds: false,
    });
    const response = latest.isAvailable
      ? `${Emoji.get(
          Emoji.emoji['bulb']
        )} Наразі все добре - світло в ${PLACE} є!\nВключення відбулося ${when}.\nСвітло є вже ${howLong}.\nСлава Україні! ${Emoji.get(
          Emoji.emoji['flag-ua']
        )}${Emoji.get(Emoji.emoji['flag-ua'])}${Emoji.get(
          Emoji.emoji['flag-ua']
        )}`
      : `${Emoji.get(
          Emoji.emoji['new_moon_with_face']
        )} Нажаль, наразі світла в ${PLACE} нема.\nВідключення відбулося ${when}.\nСвітло відсутнє вже ${howLong}.\nПричина вимкнення - йо#ана русня! ${Emoji.get(
          Emoji.emoji['poop']
        )}`;

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
      ? `Підписка створена - ти будеш отримувати повідомлення кожного разу після зміни ситуації зі світлом в ${PLACE}.\nТи завжди можеш відписатися за допомогою команди /unsubscribe.`
      : `Підписка вже створена і ти вже отримуєш повідомлення кожного разу після зміни ситуації зі світлом в ${PLACE}.\nТи завжди можеш відписатися за допомогою команди /unsubscribe.`;

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
      ? `Підписка скасована - ти більше не будеш отримувати повідомлення щодо зміни ситуації зі світлом в ${PLACE}.`
      : `Підписка і так відсутня, ти зараз не отримуєш повідомлення щодо зміни ситуації зі світлом в ${PLACE}.`;

    this.telegramBot.sendMessage(msg.chat.id, response);
  }

  // TODO: refactor (make cleaner)
  private async handleStatsCommand(msg: TelegramBot.Message): Promise<void> {
    this.logger.verbose(`Handling message: ${JSON.stringify(msg)}`);

    const stats = await this.electricityAvailabilityService.getStats({
      timeZone: TIME_ZONE,
    });

    let response = '';

    if (!!stats.history.yesterday?.length && stats.history.yesterday?.length > 1) {
      if (response.length > 0) {
        response += '\n\n';
      }

      response += `${Emoji.get(Emoji.emoji['kiss'])} Вчора:`;

      const yesterday = stats.history.yesterday;

      const baseDate = new Date();
      let baseDatePlusAvailable = new Date();
      let baseDatePluesUnavailable = new Date();

      yesterday.forEach(({ start, end, isEnabled }) => {
        const durationInMinutes = differenceInMinutes(start, end);

        if (isEnabled) {
          baseDatePlusAvailable = addMinutes(baseDatePlusAvailable, durationInMinutes);
        } else {
          baseDatePluesUnavailable = addMinutes(baseDatePluesUnavailable, durationInMinutes);
        }
      });

      const howLongAvailable = formatDistance(baseDatePlusAvailable, baseDate, {
        locale: uk,
        includeSeconds: false,
      });
      const howLongUnavailable = formatDistance(baseDatePluesUnavailable, baseDate, {
        locale: uk,
        includeSeconds: false,
      });

      response = `${response}\nЗі світлом: ${howLongAvailable}\nБез світла: ${howLongUnavailable}`;

      yesterday.forEach(({ start, end, isEnabled }, i) => {
        const emoji = isEnabled
          ? Emoji.get(Emoji.emoji['bulb'])
          : Emoji.get(Emoji.emoji['new_moon_with_face']);
        const s = format(start, 'HH:mm', { locale: uk });
        const e = format(end, 'HH:mm', { locale: uk });
        const entry =
          i === 0
            ? `${emoji} до ${e}`
            : i === (yesterday.length - 1)
            ? `${emoji} з ${s}`
            : `${emoji} ${s}-${e}`;

        response = `${response}\n${entry}`;
      });
    }

    if (!!stats.history.today?.length && stats.history.today?.length > 1) {
      if (response.length > 0) {
        response += '\n\n';
      }

      response += `${Emoji.get(Emoji.emoji['kissing_heart'])} Сьогодні:`;

      const today = stats.history.today;

      const baseDate = new Date();
      let baseDatePlusAvailable = new Date();
      let baseDatePluesUnavailable = new Date();

      today.forEach(({ start, end, isEnabled }) => {
        const durationInMinutes = differenceInMinutes(start, end);

        if (isEnabled) {
          baseDatePlusAvailable = addMinutes(baseDatePlusAvailable, durationInMinutes);
        } else {
          baseDatePluesUnavailable = addMinutes(baseDatePluesUnavailable, durationInMinutes);
        }
      });

      const howLongAvailable = formatDistance(baseDatePlusAvailable, baseDate, {
        locale: uk,
        includeSeconds: false,
      });
      const howLongUnavailable = formatDistance(baseDatePluesUnavailable, baseDate, {
        locale: uk,
        includeSeconds: false,
      });

      response = `${response}\nЗі світлом: ${howLongAvailable}\nБез світла: ${howLongUnavailable}`;


      today.forEach(({ start, end, isEnabled }, i) => {
        const emoji = isEnabled
          ? Emoji.get(Emoji.emoji['bulb'])
          : Emoji.get(Emoji.emoji['new_moon_with_face']);
        const s = format(start, 'HH:mm', { locale: uk });
        const e = format(end, 'HH:mm', { locale: uk });
        const entry =
          i === 0
            ? `${emoji} до ${e}`
            : i === (today.length - 1)
            ? `${emoji} з ${s}`
            : `${emoji} ${s}-${e}`;

            response = `${response}\n${entry}`;
      });
    }

    if (response === '') {
      response = 'Наразі інформація відсутня.';
    }

    this.telegramBot.sendMessage(msg.chat.id, response);
  }

  private async handleAboutCommand(msg: TelegramBot.Message): Promise<void> {
    const response = `${Emoji.get(Emoji.emoji['kissing_heart'])} Обіймаю, навіки ваш @oleksandr_changli\nБажано автора зайвий раз не турбувати, дякую`;

    this.telegramBot.sendMessage(msg.chat.id, response);
  }

  private async notifyAllSubscribersAboutElectricityAvailabilityChange(): Promise<void> {
    const subscribers = await this.userRepository.getAllUserSubscriptions();

    this.logger.verbose(
      `Notifying all ${subscribers.length} subscribers about electricity availability change`
    );

    const [latest, previous] =
      await this.electricityAvailabilityService.getLatestAvailability({
        limit: 2,
      });

    if (!latest) {
      this.logger.error(
        'Electricity availability changed event, however no availability data in the repo'
      );

      return;
    }

    const latestTime = convertToTimeZone(latest.time, {
      timeZone: TIME_ZONE,
    });
    const when = format(latestTime, 'd.MM HH:mm', { locale: uk });
    let response: string;

    if (!previous) {
      response = latest.isAvailable
        ? `${Emoji.get(Emoji.emoji['bulb']
          )} ${when}\nУра, світло в ${PLACE} включили!\nСлава Україні! ${Emoji.get(
            Emoji.emoji['flag-ua']
          )}${Emoji.get(Emoji.emoji['flag-ua'])}${Emoji.get(
            Emoji.emoji['flag-ua']
          )}`
        : `${Emoji.get(
            Emoji.emoji['new_moon_with_face']
          )} ${when}\nУвага, світло в ${PLACE} вимкнено.\nПричина вимкнення - йо#ана русня! ${Emoji.get(
            Emoji.emoji['poop']
          )}`;
    } else {
      const previousTime = convertToTimeZone(previous.time, {
        timeZone: TIME_ZONE,
      });
      const howLong = formatDistance(latestTime, previousTime, {
        locale: uk,
        includeSeconds: false,
      });

      response = latest.isAvailable
        ? `${Emoji.get(
            Emoji.emoji['bulb']
          )} ${when}\nУра, світло в ${PLACE} включили!\nСвітло було відсутнє ${howLong}.\nСлава Україні! ${Emoji.get(
            Emoji.emoji['flag-ua']
          )}${Emoji.get(Emoji.emoji['flag-ua'])}${Emoji.get(
            Emoji.emoji['flag-ua']
          )}`
        : `${Emoji.get(
            Emoji.emoji['new_moon_with_face']
          )} ${when}\nУвага, світло в ${PLACE} вимкнено.\nДо вимкнення світло було доступне ${howLong}.\nПричина вимкнення - йо#ана русня! ${Emoji.get(
            Emoji.emoji['poop']
          )}`;
    }

    subscribers.forEach(({ chatId }) => {
      this.telegramBot.sendMessage(chatId, response);
    });

    this.logger.verbose(
      `Finished notifying all ${subscribers.length} subscribers about electricity availability change`
    );
  }
}
