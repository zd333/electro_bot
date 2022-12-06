import { ElectricityAvailabilityService } from '@electrobot/electricity-availability';
import { UserRepository } from '@electrobot/user-repo';
import { Injectable, Logger } from '@nestjs/common';
import {
  addMinutes,
  differenceInMinutes,
  format,
  formatDistance,
} from 'date-fns';
import { convertToTimeZone } from 'date-fns-timezone';
import { uk } from 'date-fns/locale';
import * as TelegramBot from 'node-telegram-bot-api';
import * as Emoji from 'node-emoji';

const TIME_ZONE = process.env.PLACE_TIMEZONE as string;
const PLACE = process.env.PLACE_NAME as string;

const EMOJ_UA = Emoji.get(Emoji.emoji['flag-ua']);
const EMOJ_POOP = Emoji.get(Emoji.emoji['poop']);
const EMOJ_BULB = Emoji.get(Emoji.emoji['bulb']);
const EMOJ_MOON = Emoji.get(Emoji.emoji['new_moon_with_face']);
const EMOJ_KISS = Emoji.get(Emoji.emoji['kiss']);
const EMOJ_KISS_HEART = Emoji.get(Emoji.emoji['kissing_heart']);

const MSG_DISABLED_REASON = `Причина вимкнення - йо#ана русня!${EMOJ_POOP}`;
const MSG_DISABLED_SUFFIX = 'Скеруй лють до русні підтримавши українську армію!\nОсь один із зручних способів зробити донат: @Donate1024Bot.';

const RESP_START = `Привіт! Цей бот допомогає моніторити ситуацію зі світлом (електроенергією) в ${PLACE}.\n\nЗа допомогою команди /current ти завжди можеш дізнатися чи є зараз в кварталі світло і як довго це триває.\n\nКоманда /subscribe дозволяє підписатися на сповіщення щодо зміни ситуації (відключення/включення).\n\nЗа допомогою команди /stats можна переглянути статистику (звіт по включенням/відключенням за поточну і попередню добу, сумарний час наявності/відсутності світла).\n${EMOJ_UA}${EMOJ_UA}${EMOJ_UA}`;
const RESP_START_SECOND_TEST_MODE =
  'Бот поки що працює в тестовому режимі, тому ми заздалегідь просимо пробачити можливі помилки і глюки.\nЗ часом вони всі будуть виправлені.';
const RESP_FUCK_RU = `Доречі, ми помітили, що у тебе в Telegram встановлена російська мова${EMOJ_POOP}.\nЗакликаємо натомість перейти на солов‘їну, адже українська мова - найкраща!${EMOJ_UA}${EMOJ_UA}${EMOJ_UA}`;
const RESP_NO_CURRENT_INFO = `Нажаль, наразі інформація щодо наявності світла в ${PLACE} відсутня.`;
const RESP_CURRENTLY_AVAILABLE = (params: {
  readonly when: string;
  readonly howLong: string;
}) =>
  `${EMOJ_BULB} Наразі все добре - світло в ${PLACE} є!\nВключення відбулося ${params.when}.\nСвітло є вже ${params.howLong}.\nСлава Україні! ${EMOJ_UA}${EMOJ_UA}${EMOJ_UA}`;
const RESP_CURRENTLY_UNAVAILABLE = (params: {
  readonly when: string;
  readonly howLong: string;
}) =>
  `${EMOJ_MOON} Нажаль, наразі світла в ${PLACE} нема.\nВимкнення відбулося ${params.when}.\nСвітло відсутнє вже ${params.howLong}.\n\n${MSG_DISABLED_REASON}\n\n${MSG_DISABLED_SUFFIX}`;
const RESP_SUBSCRIPTION_CREATED = `Підписка створена - ти будеш отримувати повідомлення кожного разу після зміни ситуації зі світлом в ${PLACE}.\nТи завжди можеш відписатися за допомогою команди /unsubscribe.`;
const RESP_SUBSCRIPTION_ALREADY_EXISTS = `Підписка вже створена і ти вже отримуєш повідомлення кожного разу після зміни ситуації зі світлом в ${PLACE}.\nТи завжди можеш відписатися за допомогою команди /unsubscribe.`;
const RESP_UNSUBSCRIBED = `Підписка скасована - ти більше не будеш отримувати повідомлення щодо зміни ситуації зі світлом в ${PLACE}.`;
const RESP_WAS_NOT_SUBSCRIBED = `Підписка і так відсутня, ти зараз не отримуєш повідомлення щодо зміни ситуації зі світлом в ${PLACE}.`;
const RESP_ABOUT = `Якщо вам подобається цей бот - можете подякувати донатом на підтримку української армії @Donate1024Bot.\n\n${EMOJ_KISS_HEART} Обіймаю, назавжди ваш @oleksandr_changli\n\nhttps://github.com/zd333/electro_bot\n\nhttps://www.instagram.com/oleksandr_changli/`;
const RESP_ENABLED_SHORT = (params: { readonly when: string }) =>
  `${EMOJ_BULB} ${params.when}\nЮхууу, світло в ${PLACE} включили!\n\nСлава Україні! ${EMOJ_UA}${EMOJ_UA}${EMOJ_UA}`;
const RESP_DISABLED_SHORT = (params: { readonly when: string }) =>
  `${EMOJ_MOON} ${params.when}\nЙой, світло в ${PLACE} вимкнено!\n\n${MSG_DISABLED_REASON}\n\n${MSG_DISABLED_SUFFIX}`;
const RESP_ENABLED_DETAILED = (params: {
  readonly when: string;
  readonly howLong: string;
}) =>
  `${EMOJ_BULB} ${params.when}\nЮхууу, світло в ${PLACE} включили!\nСвітло було відсутнє ${params.howLong}.\n\nСлава Україні! ${EMOJ_UA}${EMOJ_UA}${EMOJ_UA}`;
const RESP_DISABLED_DETAILED = (params: {
  readonly when: string;
  readonly howLong: string;
}) =>
  `${EMOJ_MOON} ${params.when}\nЙой, світло в ${PLACE} вимкнено!\nМи насолоджувалися світлом ${params.howLong}.\n\n${MSG_DISABLED_REASON}\n\n${MSG_DISABLED_SUFFIX}`;

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

    this.telegramBot.sendMessage(msg.chat.id, RESP_START);
    this.telegramBot.sendMessage(msg.chat.id, RESP_START_SECOND_TEST_MODE);

    if (msg.from?.language_code !== 'ru') {
      return;
    }

    this.telegramBot.sendMessage(msg.chat.id, RESP_FUCK_RU);
  }

  private async handleCurrentCommand(msg: TelegramBot.Message): Promise<void> {
    this.logger.verbose(`Handling message: ${JSON.stringify(msg)}`);

    const [latest] =
      await this.electricityAvailabilityService.getLatestAvailability({
        limit: 1,
      });

    if (!latest) {
      this.telegramBot.sendMessage(msg.chat.id, RESP_NO_CURRENT_INFO);

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
      ? RESP_CURRENTLY_AVAILABLE({ when, howLong })
      : RESP_CURRENTLY_UNAVAILABLE({ when, howLong });

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
      ? RESP_SUBSCRIPTION_CREATED
      : RESP_SUBSCRIPTION_ALREADY_EXISTS;

    this.telegramBot.sendMessage(msg.chat.id, response);
  }

  private async handleUnsubscribeCommand(
    msg: TelegramBot.Message
  ): Promise<void> {
    this.logger.verbose(`Handling message: ${JSON.stringify(msg)}`);

    const removed = await this.userRepository.removeUserSubscription({
      chatId: msg.chat.id,
    });
    const response = removed ? RESP_UNSUBSCRIBED : RESP_WAS_NOT_SUBSCRIBED;

    this.telegramBot.sendMessage(msg.chat.id, response);
  }

  // TODO: refactor (make cleaner)
  private async handleStatsCommand(msg: TelegramBot.Message): Promise<void> {
    this.logger.verbose(`Handling message: ${JSON.stringify(msg)}`);

    const stats = await this.electricityAvailabilityService.getStats({
      timeZone: TIME_ZONE,
    });

    let response = '';

    if (
      !!stats.history.yesterday?.length &&
      stats.history.yesterday?.length > 1
    ) {
      if (response.length > 0) {
        response += '\n\n';
      }

      response += `${EMOJ_KISS} Вчора:`;

      const yesterday = stats.history.yesterday;

      const baseDate = new Date();
      let baseDatePlusAvailable = new Date();
      let baseDatePluesUnavailable = new Date();

      yesterday.forEach(({ start, end, isEnabled }) => {
        const durationInMinutes = differenceInMinutes(start, end);

        if (isEnabled) {
          baseDatePlusAvailable = addMinutes(
            baseDatePlusAvailable,
            durationInMinutes
          );
        } else {
          baseDatePluesUnavailable = addMinutes(
            baseDatePluesUnavailable,
            durationInMinutes
          );
        }
      });

      const howLongAvailable = formatDistance(baseDatePlusAvailable, baseDate, {
        locale: uk,
        includeSeconds: false,
      });
      const howLongUnavailable = formatDistance(
        baseDatePluesUnavailable,
        baseDate,
        {
          locale: uk,
          includeSeconds: false,
        }
      );

      response = `${response}\nЗі світлом: ${howLongAvailable}\nБез світла: ${howLongUnavailable}`;

      yesterday.forEach(({ start, end, isEnabled }, i) => {
        const emoji = isEnabled ? EMOJ_BULB : EMOJ_MOON;
        const s = format(start, 'HH:mm', { locale: uk });
        const e = format(end, 'HH:mm', { locale: uk });
        const duration = formatDistance(end, start, {
          locale: uk,
          includeSeconds: false,
        });
        const entry =
          i === 0
            ? `${emoji} до ${e}`
            : i === yesterday.length - 1
            ? `${emoji} з ${s}`
            : `${emoji} ${s}-${e} (${duration})`;

        response = `${response}\n${entry}`;
      });
    }

    if (!!stats.history.today?.length && stats.history.today?.length > 1) {
      if (response.length > 0) {
        response += '\n\n';
      }

      response += `${EMOJ_KISS_HEART} Сьогодні:`;

      const today = stats.history.today;

      const baseDate = new Date();
      let baseDatePlusAvailable = new Date();
      let baseDatePluesUnavailable = new Date();

      today.forEach(({ start, end, isEnabled }) => {
        const durationInMinutes = differenceInMinutes(start, end);

        if (isEnabled) {
          baseDatePlusAvailable = addMinutes(
            baseDatePlusAvailable,
            durationInMinutes
          );
        } else {
          baseDatePluesUnavailable = addMinutes(
            baseDatePluesUnavailable,
            durationInMinutes
          );
        }
      });

      const howLongAvailable = formatDistance(baseDatePlusAvailable, baseDate, {
        locale: uk,
        includeSeconds: false,
      });
      const howLongUnavailable = formatDistance(
        baseDatePluesUnavailable,
        baseDate,
        {
          locale: uk,
          includeSeconds: false,
        }
      );

      response = `${response}\nЗі світлом: ${howLongAvailable}\nБез світла: ${howLongUnavailable}`;

      today.forEach(({ start, end, isEnabled }, i) => {
        const emoji = isEnabled ? EMOJ_BULB : EMOJ_MOON;
        const s = format(start, 'HH:mm', { locale: uk });
        const e = format(end, 'HH:mm', { locale: uk });
        const duration = formatDistance(end, start, {
          locale: uk,
          includeSeconds: false,
        });
        const entry =
          i === 0
            ? `${emoji} до ${e}`
            : i === today.length - 1
            ? `${emoji} з ${s}`
            : `${emoji} ${s}-${e} (${duration})`;

        response = `${response}\n${entry}`;
      });
    }

    if (response === '') {
      response = 'Наразі інформація відсутня.';
    }

    response += `\n\n${MSG_DISABLED_SUFFIX}`;

    this.telegramBot.sendMessage(msg.chat.id, response);
  }

  private async handleAboutCommand(msg: TelegramBot.Message): Promise<void> {
    this.telegramBot.sendMessage(msg.chat.id, RESP_ABOUT);
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
    const when = format(latestTime, 'HH:mm dd.MM', { locale: uk });
    let response: string;

    if (!previous) {
      response = latest.isAvailable
        ? RESP_ENABLED_SHORT({ when })
        : RESP_DISABLED_SHORT({ when });
    } else {
      const previousTime = convertToTimeZone(previous.time, {
        timeZone: TIME_ZONE,
      });
      const howLong = formatDistance(latestTime, previousTime, {
        locale: uk,
        includeSeconds: false,
      });

      response = latest.isAvailable
        ? RESP_ENABLED_DETAILED({ when, howLong })
        : RESP_DISABLED_DETAILED({ when, howLong });
    }

    subscribers.forEach(({ chatId }) => {
      try {
        this.telegramBot.sendMessage(chatId, response);
      } catch (e) {
        this.logger.error(
          `Failed to send notification to ${chatId} chat ID: ${JSON.stringify(
            e
          )}`
        );
      }
    });

    this.logger.verbose(
      `Finished notifying all ${subscribers.length} subscribers about electricity availability change`
    );
  }
}
