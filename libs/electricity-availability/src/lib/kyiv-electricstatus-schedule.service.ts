import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { addDays, differenceInHours, addMinutes, parse } from 'date-fns';

const ALL_GROUPS = [1, 2, 3, 4, 5, 6];
const DELAY_BETWEEN_REQUESTS_MS = 100;
const SCHEDULE_INACCURACY_MINUTES = 29;
const CACHE_REFRESH_MS = 1000 * 60 * 10; // 10 minutes
const CACHE_EXPIRATION_HOURS = 4;

/**
 * This is very simple implementation of the power schedule service.
 * It works with https://kyiv.electricstatus.click API which is not official
 * and (somehow) takes  data from Yasno schedule.
 * !It works only for Kyiv!
 */
@Injectable()
export class KyivElectricstatusScheduleService {
  private readonly logger = new Logger(KyivElectricstatusScheduleService.name);

  private readonly cache: {
    [groupId: number]:
      | {
          readonly timestamp: Date;
          readonly response: ScheduleResponse;
        }
      | undefined;
  } = {};

  constructor(private readonly httpService: HttpService) {
    this.refreshCache();
    setInterval(() => this.refreshCache(), CACHE_REFRESH_MS);
  }

  /**
   * This assumes no power now.
   */
  public async getNextEnableMoment(params: {
    readonly scheduleGroupId: number;
  }): Promise<{
    readonly enableMoment?: Date;
    readonly possibleEnableMoment?: Date;
  }> {
    const { scheduleGroupId } = params;
    const data = this.cache[scheduleGroupId]?.response;

    if (!data) {
      this.logger.warn(
        `No schedule data found in the cache for group ${scheduleGroupId}`
      );

      return {};
    }

    const nowOnServer = new Date();
    const tomorrowOnServer = addDays(nowOnServer, 1);
    const kyivHours = nowOnServer.toLocaleString('uk-UA', { timeZone: 'Europe/Kyiv', hour: '2-digit', minute: '2-digit', hour12: false });
    const now = this.scheduleMomentToDate({ moment: kyivHours, baseDate: nowOnServer });
    const tomorrow = addDays(now, 1);
    const severalMinutesAgo = addMinutes(now, -SCHEDULE_INACCURACY_MINUTES);
    const todayDayOfWeekInKyiv = this.weekDayInKyiv(nowOnServer);
    const tomorrowDayOfWeekInKyiv = this.weekDayInKyiv(tomorrowOnServer);
    const todayData = data[todayDayOfWeekInKyiv];
    const tomorrowData = data[tomorrowDayOfWeekInKyiv];

    this.logger.verbose(
      `getNextEnableMoment: nowOnServer: ${nowOnServer}, kyivHours: ${kyivHours}  , now: ${now}, tomorrowOnServer: ${tomorrowOnServer}, severalMinutesAgo: ${severalMinutesAgo}, todayDayOfWeek: ${todayDayOfWeekInKyiv}, tomorrowDayOfWeek: ${tomorrowDayOfWeekInKyiv}`
    );

    const enableMoments = [
      ...todayData.power_on.time.map(({ start }) =>
        this.scheduleMomentToDate({ moment: start, baseDate: now })
      ),
      ...(tomorrowData.power_on.time.length
        ? [
            this.scheduleMomentToDate({
              moment: tomorrowData.power_on.time[0].start,
              baseDate: tomorrow,
            }),
          ]
        : []),
    ];
    const possibleEnableMoments = [
      ...todayData.power_on_possible.time.map(({ start }) =>
        this.scheduleMomentToDate({ moment: start, baseDate: now })
      ),
      ...(tomorrowData.power_on_possible.time.length
        ? [
            this.scheduleMomentToDate({
              moment: tomorrowData.power_on_possible.time[0].start,
              baseDate: tomorrow,
            }),
          ]
        : []),
    ];

    this.logger.verbose(
      `enableMoments: ${enableMoments}, possibleEnableMoments: ${possibleEnableMoments}`
    );

    const nextEnableMoment = enableMoments.find(
      (date) => date && date > severalMinutesAgo
    );
    const nextPossibleEnableMoment = possibleEnableMoments.find(
      (date) => date && date > severalMinutesAgo
    );

    this.logger.verbose(
      `getNextEnableMoment: nextEnableMoment: ${nextEnableMoment}, nextPossibleEnableMoment: ${nextPossibleEnableMoment}`
    );

    if (
      nextEnableMoment &&
      nextPossibleEnableMoment &&
      nextPossibleEnableMoment > nextEnableMoment
    ) {
      return {
        enableMoment: nextEnableMoment,
      };
    }

    return {
      enableMoment: nextEnableMoment,
      possibleEnableMoment: nextPossibleEnableMoment,
    };
  }

  /**
   * This assumes power is available now.
   */
  public async getNextDisableMoment(params: {
    readonly scheduleGroupId: number;
  }): Promise<{
    readonly disableMoment?: Date;
    readonly possibleDisableMoment?: Date;
  }> {
    const { scheduleGroupId } = params;
    const data = this.cache[scheduleGroupId]?.response;

    if (!data) {
      this.logger.warn(
        `No schedule data found in the cache for group ${scheduleGroupId}`
      );

      return {};
    }

    const nowOnServer = new Date();
    const tomorrowOnServer = addDays(nowOnServer, 1);
    const kyivHours = nowOnServer.toLocaleString('uk-UA', { timeZone: 'Europe/Kyiv', hour: '2-digit', minute: '2-digit', hour12: false });
    const now = this.scheduleMomentToDate({ moment: kyivHours, baseDate: nowOnServer });
    const tomorrow = addDays(now, 1);
    const severalMinutesAgo = addMinutes(now, -SCHEDULE_INACCURACY_MINUTES);
    const todayDayOfWeekInKyiv = this.weekDayInKyiv(nowOnServer);
    const tomorrowDayOfWeekInKyiv = this.weekDayInKyiv(tomorrowOnServer);
    const todayData = data[todayDayOfWeekInKyiv];
    const tomorrowData = data[tomorrowDayOfWeekInKyiv];

    this.logger.verbose(
      `getNextEnableMoment: nowOnServer: ${nowOnServer}, kyivHours: ${kyivHours}  , now: ${now}, tomorrowOnServer: ${tomorrowOnServer}, severalMinutesAgo: ${severalMinutesAgo}, todayDayOfWeek: ${todayDayOfWeekInKyiv}, tomorrowDayOfWeek: ${tomorrowDayOfWeekInKyiv}`
    );

    const disableMoments = [
      ...todayData.power_off.time.map(({ start }) =>
        this.scheduleMomentToDate({ moment: start, baseDate: now })
      ),
      ...(tomorrowData.power_off.time.length
        ? [
            this.scheduleMomentToDate({
              moment: tomorrowData.power_off.time[0].start,
              baseDate: tomorrow,
            }),
          ]
        : []),
    ];
    const possibleDisableMoments = [
      ...todayData.power_on_possible.time.map(({ start }) =>
        this.scheduleMomentToDate({ moment: start, baseDate: now })
      ),
      ...(tomorrowData.power_on_possible.time.length
        ? [
            this.scheduleMomentToDate({
              moment: tomorrowData.power_on_possible.time[0].start,
              baseDate: tomorrow,
            }),
          ]
        : []),
    ];

    this.logger.verbose(
      `disableMoments: ${disableMoments}, possibleDisableMoments: ${possibleDisableMoments}`
    );

    const nextDisableMoment = disableMoments.find(
      (date) => date && date > severalMinutesAgo
    );
    const nextPossibleDisableMoment = possibleDisableMoments.find(
      (date) => date && date > severalMinutesAgo
    );

    this.logger.verbose(
      `getNextDisableMoment: nextDisableMoment: ${nextDisableMoment}, nextPossibleDisableMoment: ${nextPossibleDisableMoment}`
    );

    if (
      nextDisableMoment &&
      nextPossibleDisableMoment &&
      nextPossibleDisableMoment > nextDisableMoment
    ) {
      return {
        disableMoment: nextDisableMoment,
      };
    }

    return {
      disableMoment: nextDisableMoment,
      possibleDisableMoment: nextPossibleDisableMoment,
    };
  }

  private async refreshCache(): Promise<void> {
    for (const group of ALL_GROUPS) {
      const now = new Date();

      try {
        const httpRes = await firstValueFrom(
          this.httpService.get(
            `https://kyiv.electricstatus.click/group/${group}/week`
          )
        );
        const data: ScheduleResponse = httpRes.data;

        this.logger.verbose(
          `Got schedule data for group ${group}, refreshing the cache: ${JSON.stringify(
            data
          )}`
        );

        this.cache[group] = {
          timestamp: now,
          response: data,
        };
      } catch (e) {
        this.logger.error(
          `Failed to refresh cache for group ${group}: ${JSON.stringify(e)}`
        );

        const timeSinceLastUpdate = this.cache[group]?.timestamp;

        if (timeSinceLastUpdate) {
          const diff = differenceInHours(now, timeSinceLastUpdate);

          if (diff > CACHE_EXPIRATION_HOURS) {
            this.logger.warn(
              `Cache for group ${group} expired, removing it from cache`
            );

            delete this.cache[group];
          }
        }
      }

      await this.sleep({ ms: DELAY_BETWEEN_REQUESTS_MS });
    }
  }

  private weekDayInKyiv(d: Date): keyof ScheduleResponse {
    return d
      .toLocaleString('en-US', { weekday: 'long', timeZone: 'Europe/Kiev' })
      .toLowerCase() as keyof ScheduleResponse;
  }

  private scheduleMomentToDate(params: {
    readonly moment: string;
    readonly baseDate: Date;
  }): Date {
    return parse(params.moment, 'HH:mm', params.baseDate);
  }

  private async sleep(params: { readonly ms: number }): Promise<void> {
    return new Promise((r) => setTimeout(r, params.ms));
  }
}

interface ScheduleMoment {
  readonly start: string;
  readonly end: string;
}

interface ScheduleDay {
  readonly power_off: { readonly time: Array<ScheduleMoment> };
  readonly power_on: { readonly time: Array<ScheduleMoment> };
  readonly power_on_possible: { readonly time: Array<ScheduleMoment> };
}

interface ScheduleResponse {
  readonly monday: ScheduleDay;
  readonly tuesday: ScheduleDay;
  readonly wednesday: ScheduleDay;
  readonly thursday: ScheduleDay;
  readonly friday: ScheduleDay;
  readonly saturday: ScheduleDay;
  readonly sunday: ScheduleDay;
}
