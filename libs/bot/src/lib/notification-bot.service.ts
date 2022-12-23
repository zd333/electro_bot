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
import { Bot, Place, VERSION } from '@electrobot/domain';
import { PlaceRepository } from '@electrobot/place-repo';

const MIN_SUSPICIOUS_DISABLE_TIME_IN_MINUTES = 45;

const EMOJ_UA = Emoji.get(Emoji.emoji['flag-ua']);
const EMOJ_POOP = Emoji.get(Emoji.emoji['poop']);
const EMOJ_BULB = Emoji.get(Emoji.emoji['bulb']);
const EMOJ_MOON = Emoji.get(Emoji.emoji['new_moon_with_face']);
const EMOJ_HALF_MOON = Emoji.get(Emoji.emoji['waning_crescent_moon']);
const EMOJ_KISS = Emoji.get(Emoji.emoji['kiss']);
const EMOJ_KISS_HEART = Emoji.get(Emoji.emoji['kissing_heart']);

const MSG_DISABLED_REASON = `Причина вимкнення - йо#ана русня!${EMOJ_POOP}`;
const MSG_DISABLED_REGULAR_SUFFIX =
  'Скеруй лють до русні підтримавши українську армію!\n' +
  'Ось один із зручних способів зробити донат: @Donate1024Bot.';
const MSG_DISABLED_SUSPICIOUS_TIME_SUFFIX =
  'Увага! Контроль наявності світла відбувається за допомогою перевірки Інтернет зв‘язку!\n' +
  'У разі проблем з Інтернетом бот може видавати невірну інформацію (повідомляти про відключення світла, коли світло насправді є)!';

const MSG_LAUNCH_DOC_LINK = '<a href="https://zd333.github.io/electro_bot/doc/launch-bot-for-my-place.html">Як ти можеш запустити такого бота для власної локації без всякого програмування</a>';

const RESP_START = (params: { readonly place: string, readonly listedBotsMessage: string }) =>
  `Привіт! Цей бот допомогає моніторити ситуацію зі світлом (електроенергією) в ${params.place}.\n\n` +
  `${MSG_LAUNCH_DOC_LINK}\n\n` +
  params.listedBotsMessage +
  `За допомогою команди /current ти завжди можеш дізнатися чи є зараз в кварталі світло і як довго це триває.\n\n` +
  `Команда /subscribe дозволяє підписатися на сповіщення щодо зміни ситуації (відключення/включення).\n\n` +
  `За допомогою команди /stats можна переглянути статистику (звіт по включенням/` +
  `відключенням за поточну і попередню добу, сумарний час наявності/відсутності світла).\n\n` +
  `Контроль наявності світла відбувається за допомогою перевірки Інтернет зв‘язку з провайдером ${params.place}, тому в разі проблем з Інтернетом бот може видавати невірну інформацію.\n\n` +
  `${EMOJ_KISS_HEART} Обіймаю, назавжди ваш @oleksandr_changli\n\n` +
  `https://www.instagram.com/oleksandr_changli/\n\n` +
  `${EMOJ_UA}${EMOJ_UA}${EMOJ_UA}`;
const RESP_NO_CURRENT_INFO = (params: { readonly place: string }) =>
  `Нажаль, наразі інформація щодо наявності світла в ${params.place} відсутня.`;
const RESP_CURRENTLY_AVAILABLE = (params: {
  readonly when: string;
  readonly howLong: string;
  readonly place: string;
}) =>
  `${EMOJ_BULB} Наразі все добре - світло в ${params.place} є!\nВключення відбулося ${params.when}.\n` +
  `Світло є вже ${params.howLong}.\nСлава Україні! ${EMOJ_UA}${EMOJ_UA}${EMOJ_UA}`;
const RESP_CURRENTLY_UNAVAILABLE = (params: {
  readonly when: string;
  readonly howLong: string;
  readonly place: string;
}) =>
  `${EMOJ_MOON} Нажаль, наразі світла в ${params.place} нема.\nВимкнення відбулося ${params.when}.\n` +
  `Світло відсутнє вже ${params.howLong}.\n\n${MSG_DISABLED_REASON}\n\n${MSG_DISABLED_REGULAR_SUFFIX}`;
const RESP_SUBSCRIPTION_CREATED = (params: { readonly place: string }) =>
  `Підписка створена - ти будеш отримувати повідомлення кожного разу після зміни ситуації зі світлом в ${params.place}.\n` +
  `Ти завжди можеш відписатися за допомогою команди /unsubscribe.`;
const RESP_SUBSCRIPTION_ALREADY_EXISTS = (params: { readonly place: string }) =>
  `Підписка вже створена і ти вже отримуєш повідомлення кожного разу після зміни ситуації зі світлом в ${params.place}.\n` +
  `Ти завжди можеш відписатися за допомогою команди /unsubscribe.`;
const RESP_UNSUBSCRIBED = (params: { readonly place: string }) =>
  `Підписка скасована - ти більше не будеш отримувати повідомлення щодо зміни ситуації зі світлом в ${params.place}.`;
const RESP_WAS_NOT_SUBSCRIBED = (params: { readonly place: string }) =>
  `Підписка і так відсутня, ти зараз не отримуєш повідомлення щодо зміни ситуації зі світлом в ${params.place}.`;
const RESP_ABOUT = (params: { readonly listedBotsMessage: string }) =>
  `Версія ${VERSION}\n\n` +
  `${MSG_LAUNCH_DOC_LINK}\n\n` +
  params.listedBotsMessage +
  `Якщо тобі подобається цей бот - можеш подякувати донатом на підтримку української армії @Donate1024Bot.\n\n` +
  `${EMOJ_KISS_HEART} Обіймаю, назавжди ваш @oleksandr_changli\n\n` +
  `https://www.instagram.com/oleksandr_changli/`;
const RESP_ENABLED_SHORT = (params: {
  readonly when: string;
  readonly place: string;
}) =>
  `${EMOJ_BULB} ${params.when}\nЮхууу, світло в ${params.place} включили!\n\nСлава Україні! ${EMOJ_UA}${EMOJ_UA}${EMOJ_UA}`;
const RESP_DISABLED_SHORT = (params: {
  readonly when: string;
  readonly place: string;
}) =>
  `${EMOJ_MOON} ${params.when}\nЙой, світло в ${params} вимкнено!\n\n${MSG_DISABLED_REASON}\n\n${MSG_DISABLED_REGULAR_SUFFIX}`;
const RESP_ENABLED_DETAILED = (params: {
  readonly when: string;
  readonly howLong: string;
  readonly place: string;
}) =>
  `${EMOJ_BULB} ${params.when}\nЮхууу, світло в ${params.place} включили!\nСвітло було відсутнє ${params.howLong}.\n\n` +
  `Слава Україні! ${EMOJ_UA}${EMOJ_UA}${EMOJ_UA}`;
const RESP_DISABLED_DETAILED = (params: {
  readonly when: string;
  readonly howLong: string;
  readonly place: string;
}) =>
  `${EMOJ_MOON} ${params.when}\nЙой, світло в ${params.place} вимкнено!\n` +
  `Ми насолоджувалися світлом ${params.howLong}.\n\n${MSG_DISABLED_REASON}\n\n${MSG_DISABLED_REGULAR_SUFFIX}`;
  const RESP_DISABLED_SUSPICIOUS = (params: {
    readonly when: string;
    readonly place: string;
  }) =>
    `${EMOJ_HALF_MOON} ${params.when}\nКарамба, можливо світло в ${params.place} вимкнено!\n\n` +
    MSG_DISABLED_SUSPICIOUS_TIME_SUFFIX;

@Injectable()
export class NotificationBotService {
  private readonly logger = new Logger(NotificationBotService.name);
  private places: Record<string, Place> = {};
  private placeBots: Record<
    string,
    {
      readonly bot: Bot;
      readonly telegramBot: TelegramBot;
    }
  > = {};
  private isRefreshingPlacesAndBots = false;

  constructor(
    private readonly electricityAvailabilityService: ElectricityAvailabilityService,
    private readonly userRepository: UserRepository,
    private readonly placeRepository: PlaceRepository
  ) {
    this.refreshAllPlacesAndBots();

    const refreshRate = 30 * 60 * 1000; // 30 min

    setInterval(() => this.refreshAllPlacesAndBots(), refreshRate);

    this.electricityAvailabilityService.availabilityChange$.subscribe(
      ({ placeId }) => {
        this.notifyAllPlaceSubscribersAboutElectricityAvailabilityChange({
          placeId,
        });
      }
    );
  }

  private async handleStartCommand(params: {
    readonly msg: TelegramBot.Message;
    readonly place: Place;
    readonly bot: Bot;
    readonly telegramBot: TelegramBot;
  }): Promise<void> {
    const { msg, place, telegramBot } = params;

    if (this.isGroup({ chatId: msg.chat.id })) {
      this.logger.warn(`Skipping group message: ${JSON.stringify(msg)}`);

      return;
    }

    await this.userRepository.saveUserAction({
      placeId: place.id,
      chatId: msg.chat.id,
      command: 'start',
    });

    this.logger.verbose(`Handling message: ${JSON.stringify(msg)}`);

    const listedBotsMessage = await this.composeListedBotsMessage();

    telegramBot.sendMessage(msg.chat.id, RESP_START({ place: place.name, listedBotsMessage }), { parse_mode: 'HTML'});
  }

  private async handleCurrentCommand(params: {
    readonly msg: TelegramBot.Message;
    readonly place: Place;
    readonly bot: Bot;
    readonly telegramBot: TelegramBot;
  }): Promise<void> {
    const { msg, place, telegramBot } = params;

    if (this.isGroup({ chatId: msg.chat.id })) {
      this.logger.warn(`Skipping group message: ${JSON.stringify(msg)}`);

      return;
    }

    await this.userRepository.saveUserAction({
      placeId: place.id,
      chatId: msg.chat.id,
      command: 'current',
    });

    this.logger.verbose(`Handling message: ${JSON.stringify(msg)}`);

    const [latest] =
      await this.electricityAvailabilityService.getLatestPlaceAvailability({
        placeId: place.id,
        limit: 1,
      });

    if (!latest) {
      telegramBot.sendMessage(
        msg.chat.id,
        RESP_NO_CURRENT_INFO({ place: place.name }),
        { parse_mode: 'HTML'}
      );

      return;
    }

    const changeTime = convertToTimeZone(latest.time, {
      timeZone: place.timezone,
    });
    const now = convertToTimeZone(new Date(), { timeZone: place.timezone });
    const when = format(changeTime, 'd MMMM о HH:mm', { locale: uk });
    const howLong = formatDistance(now, changeTime, {
      locale: uk,
      includeSeconds: false,
    });
    const response = latest.isAvailable
      ? RESP_CURRENTLY_AVAILABLE({ when, howLong, place: place.name })
      : RESP_CURRENTLY_UNAVAILABLE({ when, howLong, place: place.name });

    telegramBot.sendMessage(msg.chat.id, response, { parse_mode: 'HTML'});
  }

  private async handleSubscribeCommand(params: {
    readonly msg: TelegramBot.Message;
    readonly place: Place;
    readonly bot: Bot;
    readonly telegramBot: TelegramBot;
  }): Promise<void> {
    const { msg, place, telegramBot } = params;

    if (this.isGroup({ chatId: msg.chat.id })) {
      this.logger.warn(`Skipping group message: ${JSON.stringify(msg)}`);

      return;
    }

    await this.userRepository.saveUserAction({
      placeId: place.id,
      chatId: msg.chat.id,
      command: 'subscribe',
    });

    this.logger.verbose(`Handling message: ${JSON.stringify(msg)}`);

    const added = await this.userRepository.addUserSubscription({
      placeId: place.id,
      chatId: msg.chat.id,
    });
    const response = added
      ? RESP_SUBSCRIPTION_CREATED({ place: place.name })
      : RESP_SUBSCRIPTION_ALREADY_EXISTS({ place: place.name });

    telegramBot.sendMessage(msg.chat.id, response, { parse_mode: 'HTML'});
  }

  private async handleUnsubscribeCommand(params: {
    readonly msg: TelegramBot.Message;
    readonly place: Place;
    readonly bot: Bot;
    readonly telegramBot: TelegramBot;
  }): Promise<void> {
    const { msg, place, telegramBot } = params;

    if (this.isGroup({ chatId: msg.chat.id })) {
      this.logger.warn(`Skipping group message: ${JSON.stringify(msg)}`);

      return;
    }

    await this.userRepository.saveUserAction({
      placeId: place.id,
      chatId: msg.chat.id,
      command: 'unsubscribe',
    });

    this.logger.verbose(`Handling message: ${JSON.stringify(msg)}`);

    const removed = await this.userRepository.removeUserSubscription({
      placeId: place.id,
      chatId: msg.chat.id,
    });
    const response = removed
      ? RESP_UNSUBSCRIBED({ place: place.name })
      : RESP_WAS_NOT_SUBSCRIBED({ place: place.name });

    telegramBot.sendMessage(msg.chat.id, response, { parse_mode: 'HTML'});
  }

  // TODO: refactor (make cleaner)
  private async handleStatsCommand(params: {
    readonly msg: TelegramBot.Message;
    readonly place: Place;
    readonly bot: Bot;
    readonly telegramBot: TelegramBot;
  }): Promise<void> {
    const { msg, place, telegramBot } = params;

    if (this.isGroup({ chatId: msg.chat.id })) {
      this.logger.warn(`Skipping group message: ${JSON.stringify(msg)}`);

      return;
    }

    await this.userRepository.saveUserAction({
      placeId: place.id,
      chatId: msg.chat.id,
      command: 'stats',
    });

    this.logger.verbose(`Handling message: ${JSON.stringify(msg)}`);

    const stats = await this.electricityAvailabilityService.getPlaceStats({
      place,
    });

    let response = '';

    if ((
      !!stats.history.yesterday?.length &&
      stats.history.yesterday?.length > 1
    ) || stats.lastStateBeforeYesterday !== undefined) {
      response += `${EMOJ_KISS} Вчора:`;

      if (
        !!stats.history.yesterday?.length &&
        stats.history.yesterday?.length > 1
      ) {
        const yesterday = stats.history.yesterday;

        const baseDate = new Date();
        let baseDatePlusAvailable = new Date();
        let baseDatePluesUnavailable = new Date();

        yesterday.forEach(({ start, end, isEnabled }, i) => {
          const s = i === 0 ? convertToTimeZone(start, { timeZone: place.timezone }) : start;
          const e = i === (yesterday.length - 1) ? convertToTimeZone(end, { timeZone: place.timezone }) : end;
          const durationInMinutes = differenceInMinutes(s, e);

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
      } else {
        response += stats.lastStateBeforeYesterday ? ' постійно зі світлом' : ' взагалі без світла';
      }
    }

    if ((!!stats.history.today?.length && stats.history.today?.length > 1) || stats.lastStateBeforeToday !== undefined) {
      if (response.length > 0) {
        response += '\n\n';
      }

      response += `${EMOJ_KISS_HEART} Сьогодні:`;

      if (!!stats.history.today?.length && stats.history.today?.length > 1) {
        const today = stats.history.today;

        const baseDate = new Date();
        let baseDatePlusAvailable = new Date();
        let baseDatePluesUnavailable = new Date();

        today.forEach(({ start, end, isEnabled }, i) => {
          const s = i === 0 ? convertToTimeZone(start, { timeZone: place.timezone }) : start;
          const e = i === (today.length - 1) ? convertToTimeZone(end, { timeZone: place.timezone }) : end;
          const durationInMinutes = differenceInMinutes(s, e);

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
      } else {
        response += stats.lastStateBeforeToday ? ' постійно зі світлом' : ' взагалі без світла';
      }
    }

    if (response === '') {
      response = 'Наразі інформація відсутня.';
    }

    response += `\n\n${MSG_DISABLED_REGULAR_SUFFIX}`;

    telegramBot.sendMessage(msg.chat.id, response, { parse_mode: 'HTML'});
  }

  private async handleAboutCommand(params: {
    readonly msg: TelegramBot.Message;
    readonly place: Place;
    readonly bot: Bot;
    readonly telegramBot: TelegramBot;
  }): Promise<void> {
    const { msg, place, telegramBot } = params;

    if (this.isGroup({ chatId: msg.chat.id })) {
      this.logger.warn(`Skipping group message: ${JSON.stringify(msg)}`);

      return;
    }

    await this.userRepository.saveUserAction({
      placeId: place.id,
      chatId: msg.chat.id,
      command: 'about',
    });

    const listedBotsMessage = await this.composeListedBotsMessage();

    telegramBot.sendMessage(msg.chat.id, RESP_ABOUT({ listedBotsMessage }), { parse_mode: 'HTML'});
  }

  private async notifyAllPlaceSubscribersAboutElectricityAvailabilityChange(params: {
    readonly placeId: string;
  }): Promise<void> {
    const { placeId } = params;

    const place = this.places[placeId];

    if (!place) {
      this.logger.error(
        `Place ${placeId} not fount in memory cache - skipping subscriber notification`
      );

      return;
    }

    const botEntry = this.placeBots[placeId];

    if (!botEntry) {
      this.logger.log(
        `No bot for ${place.name} - no subscriber notification performed`
      );

      return;
    }

    if (!botEntry.bot.isEnabled) {
      this.logger.log(
        `Bot for ${place.name} is disabled - skipping subscriber notification`
      );

      return;
    }

    const subscribers = await this.userRepository.getAllPlaceUserSubscriptions({
      placeId,
    });

    this.logger.verbose(
      `Notifying all ${subscribers.length} subscribers of ${place.name} about electricity availability change`
    );

    const [latest, previous] =
      await this.electricityAvailabilityService.getLatestPlaceAvailability({
        placeId,
        limit: 2,
      });

    if (!latest) {
      this.logger.error(
        `Electricity availability changed event, however no availability data in the repo for ${place.name}`
      );

      return;
    }

    const latestTime = convertToTimeZone(latest.time, {
      timeZone: place.timezone,
    });
    const when = format(latestTime, 'HH:mm dd.MM', { locale: uk });
    let response: string;

    if (!previous) {
      response = latest.isAvailable
        ? RESP_ENABLED_SHORT({ when, place: place.name })
        : RESP_DISABLED_SHORT({ when, place: place.name });
    } else {
      const previousTime = convertToTimeZone(previous.time, {
        timeZone: place.timezone,
      });
      const howLong = formatDistance(latestTime, previousTime, {
        locale: uk,
        includeSeconds: false,
      });
      const diffInMinutes = Math.abs(differenceInMinutes(previousTime, latestTime));

      response = latest.isAvailable
        ? RESP_ENABLED_DETAILED({ when, howLong, place: place.name })
        : diffInMinutes <= MIN_SUSPICIOUS_DISABLE_TIME_IN_MINUTES
        ? RESP_DISABLED_SUSPICIOUS({ when, place: place.name })
        : RESP_DISABLED_DETAILED({ when, howLong, place: place.name });
    }

    subscribers.forEach(({ chatId }) => {
      try {
        botEntry.telegramBot.sendMessage(chatId, response, { parse_mode: 'HTML'});
      } catch (e) {
        this.logger.error(
          `Failed to send notification to ${chatId} chat ID: ${JSON.stringify(
            e
          )}`
        );
      }
    });

    this.logger.verbose(
      `Finished notifying all ${subscribers.length} subscribers of ${place.name} about electricity availability change`
    );
  }

  private isGroup(params: { readonly chatId: number }): boolean {
    return params.chatId < 0;
  }

  private async refreshAllPlacesAndBots(): Promise<void> {
    if (this.isRefreshingPlacesAndBots) {
      return;
    }

    this.isRefreshingPlacesAndBots = true;
    try {
      const places = await this.placeRepository.getAllPlaces();

      this.places = places.reduce<Record<string, Place>>(
        (res, place) => ({
          ...res,
          [place.id]: place,
        }),
        {}
      );

      const placeBots = await this.placeRepository.getAllPlaceBots();

      placeBots.forEach((bot) => {
        if (this.placeBots[bot.placeId]) {
          // Already created, rewrite bot data (to apply enabled/disabled), but keep same Telegram bot instance
          this.placeBots[bot.placeId] = {
            ...this.placeBots[bot.placeId],
            bot,
          };

          return;
        }

        const place = this.places[bot.placeId];

        if (!place) {
          this.logger.error(
            `Place ${bot.placeId} not fount in memory cache - can not create notification bot`
          );

          return;
        }

        this.createBot({ place, bot });
      });
    } catch (e) {
      //
    }

    this.isRefreshingPlacesAndBots = false;
  }

  private createBot(params: {
    readonly place: Place;
    readonly bot: Bot;
  }): void {
    const { place, bot } = params;
    const telegramBot = new TelegramBot(bot.token, { polling: true });

    this.placeBots[bot.placeId] = {
      bot,
      telegramBot,
    };

    // Matches /start
    telegramBot.onText(/\/start/, (msg) =>
      this.handleStartCommand({ msg, place, bot, telegramBot })
    );

    // Matches /current
    telegramBot.onText(/\/current/, (msg) =>
      this.handleCurrentCommand({ msg, place, bot, telegramBot })
    );

    // Matches /subscribe
    telegramBot.onText(/\/subscribe/, (msg) =>
      this.handleSubscribeCommand({ msg, place, bot, telegramBot })
    );

    // Matches /unsubscribe
    telegramBot.onText(/\/unsubscribe/, (msg) =>
      this.handleUnsubscribeCommand({ msg, place, bot, telegramBot })
    );

    // Matches /stop
    telegramBot.onText(/\/stop/, (msg) =>
      this.handleUnsubscribeCommand({ msg, place, bot, telegramBot })
    );

    // Matches /stats
    telegramBot.onText(/\/stats/, (msg) =>
      this.handleStatsCommand({ msg, place, bot, telegramBot })
    );

    // Matches /about
    telegramBot.onText(/\/about/, (msg) =>
      this.handleAboutCommand({ msg, place, bot, telegramBot })
    );
  }

  private async composeListedBotsMessage(): Promise<string> {
    const stats = await this.placeRepository.getListedPlaceBotStats();

    if (stats.length === 0) {
      return '';
    }

    let res = 'Існуючі боти:\n';

    stats.forEach(({ placeName, botName, numberOfUsers }) => {
      res += `${placeName} - ${numberOfUsers} користувачів @${botName}\n`;
    });

    return res + '\n';
  }
}
