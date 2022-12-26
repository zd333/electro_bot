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
import { Bot, Place } from '@electrobot/domain';
import { PlaceRepository } from '@electrobot/place-repo';
import {
  EMOJ_BULB,
  EMOJ_KISS,
  EMOJ_KISS_HEART,
  EMOJ_MOON,
  MSG_DISABLED_REGULAR_SUFFIX,
  RESP_ABOUT,
  RESP_CURRENTLY_AVAILABLE,
  RESP_CURRENTLY_UNAVAILABLE,
  RESP_DISABLED_DETAILED,
  RESP_DISABLED_SHORT,
  RESP_DISABLED_SUSPICIOUS,
  RESP_ENABLED_DETAILED,
  RESP_ENABLED_SHORT,
  RESP_NO_CURRENT_INFO,
  RESP_START,
  RESP_SUBSCRIPTION_ALREADY_EXISTS,
  RESP_SUBSCRIPTION_CREATED,
  RESP_UNSUBSCRIBED,
  RESP_WAS_NOT_SUBSCRIBED,
} from './messages.constant';

const MIN_SUSPICIOUS_DISABLE_TIME_IN_MINUTES = 45;

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

    telegramBot.sendMessage(
      msg.chat.id,
      RESP_START({ place: place.name, listedBotsMessage }),
      { parse_mode: 'HTML' }
    );
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
        { parse_mode: 'HTML' }
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

    telegramBot.sendMessage(msg.chat.id, response, { parse_mode: 'HTML' });
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

    telegramBot.sendMessage(msg.chat.id, response, { parse_mode: 'HTML' });
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

    telegramBot.sendMessage(msg.chat.id, response, { parse_mode: 'HTML' });
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

    const stats =
      await this.electricityAvailabilityService.getTodayAndYesterdayStats({
        place,
      });

    let response = '';

    if (
      (!!stats.history.yesterday?.length &&
        stats.history.yesterday?.length > 1) ||
      stats.lastStateBeforeYesterday !== undefined
    ) {
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
          const s =
            i === 0
              ? convertToTimeZone(start, { timeZone: place.timezone })
              : start;
          const e =
            i === yesterday.length - 1
              ? convertToTimeZone(end, { timeZone: place.timezone })
              : end;
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

        const howLongAvailable = formatDistance(
          baseDatePlusAvailable,
          baseDate,
          {
            locale: uk,
            includeSeconds: false,
          }
        );
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
        response += stats.lastStateBeforeYesterday
          ? ' постійно зі світлом'
          : ' взагалі без світла';
      }
    }

    if (
      (!!stats.history.today?.length && stats.history.today?.length > 1) ||
      stats.lastStateBeforeToday !== undefined
    ) {
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
          const s =
            i === 0
              ? convertToTimeZone(start, { timeZone: place.timezone })
              : start;
          const e =
            i === today.length - 1
              ? convertToTimeZone(end, { timeZone: place.timezone })
              : end;
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

        const howLongAvailable = formatDistance(
          baseDatePlusAvailable,
          baseDate,
          {
            locale: uk,
            includeSeconds: false,
          }
        );
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
        response += stats.lastStateBeforeToday
          ? ' постійно зі світлом'
          : ' взагалі без світла';
      }
    }

    if (response === '') {
      response = 'Наразі інформація відсутня.';
    }

    response += `\n\n${MSG_DISABLED_REGULAR_SUFFIX}`;

    telegramBot.sendMessage(msg.chat.id, response, { parse_mode: 'HTML' });
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

    telegramBot.sendMessage(msg.chat.id, RESP_ABOUT({ listedBotsMessage }), {
      parse_mode: 'HTML',
    });
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

    const [latest, previous] =
      await this.electricityAvailabilityService.getLatestPlaceAvailability({
        placeId,
        limit: 2,
      });

    if (!latest) {
      this.logger.error(
        `Electricity availability changed event, however no availability data in the repo for ${placeId}`
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
      const diffInMinutes = Math.abs(
        differenceInMinutes(previousTime, latestTime)
      );

      response = latest.isAvailable
        ? RESP_ENABLED_DETAILED({ when, howLong, place: place.name })
        : diffInMinutes <= MIN_SUSPICIOUS_DISABLE_TIME_IN_MINUTES
        ? RESP_DISABLED_SUSPICIOUS({ when, place: place.name })
        : RESP_DISABLED_DETAILED({ when, howLong, place: place.name });
    }

    this.notifyAllPlaceSubscribers({
      place,
      msg: response,
    });
  }

  private async notifyAllPlaceSubscribers(params: {
    readonly place: Place;
    readonly msg: string;
  }): Promise<void> {
    const { place, msg } = params;
    const botEntry = this.placeBots[place.id];

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
      placeId: place.id,
    });

    this.logger.verbose(
      `Notifying all ${subscribers.length} subscribers of ${place.name}`
    );

    subscribers.forEach(({ chatId }) => {
      try {
        botEntry.telegramBot.sendMessage(chatId, params.msg, {
          parse_mode: 'HTML',
        });
      } catch (e) {
        this.logger.error(
          `Failed to send notification to ${chatId} chat ID: ${JSON.stringify(
            e
          )}`
        );
      }
    });

    this.logger.verbose(
      `Finished notifying all ${subscribers.length} subscribers of ${place.name}`
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

    const totalUsers = stats.reduce<number>(
      (res, { numberOfUsers }) => res + Number(numberOfUsers),
      0
    );

    let res = `Наразі сервісом користуються ${totalUsers} користувачів у ${stats.length} ботах:\n`;

    stats.forEach(({ placeName, botName, numberOfUsers }) => {
      res += `@${botName}\n${placeName} - ${numberOfUsers} користувачів\n`;
    });

    return res + '\n';
  }
}
