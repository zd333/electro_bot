import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import {
  addDays,
  format,
  parse,
  differenceInHours,
  differenceInMinutes,
} from 'date-fns';

const ALL_GROUPS = [1, 2, 3, 4, 5, 6];
const DELAY_BETWEEN_REQUESTS_MS = 100;
const NEXT_AVAILABILITY_CHANGE_MIN_DIFFERENCE_MINUTES = 29;
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

  public async getNextScheduledMoments(params: {
    readonly scheduleGroupId: number;
  }): Promise<{
    readonly enableMoment?: Date;
    readonly possibleEnableMoment?: Date;
    readonly disableMoment?: Date;
    readonly possibleDisableMoment?: Date;
  }> {
    const data = this.cache[params.scheduleGroupId]?.response;

    if (!data) {
      this.logger.warn(
        `No schedule data found in the cache for group ${params.scheduleGroupId}`
      );

      return {};
    }

    const now = new Date();
    const todayDayOfWeek = format(
      now,
      'EEEE'
    ).toLowerCase() as keyof ScheduleResponse;
    const tomorrowDayOfWeek = format(
      addDays(now, 1),
      'EEEE'
    ).toLowerCase() as keyof ScheduleResponse;
    const todayData = data[todayDayOfWeek];
    const tomorrowData = data[tomorrowDayOfWeek];

    let nextEnableMoment: Date | undefined = todayData.power_on
      .map(({ time: { start} }) => parse(start, 'HH:mm', now))
      .find(
        (date) =>
          differenceInMinutes(date, now) >
          NEXT_AVAILABILITY_CHANGE_MIN_DIFFERENCE_MINUTES
      );

    if (!nextEnableMoment && tomorrowData.power_on.length) {
      nextEnableMoment = parse(tomorrowData.power_on[0].time.start, 'HH:mm', now);
    }

    let nextPossibleEnableMoment: Date | undefined = todayData.power_on_possible
      .map(({ time: { start } }) => parse(start, 'HH:mm', now))
      .find(
        (date) =>
          differenceInMinutes(date, now) >
          NEXT_AVAILABILITY_CHANGE_MIN_DIFFERENCE_MINUTES
      );

    if (!nextPossibleEnableMoment && tomorrowData.power_on_possible.length) {
      nextPossibleEnableMoment = parse(
        tomorrowData.power_on_possible[0].time.start,
        'HH:mm',
        now
      );
    }

    let nextDisableMoment: Date | undefined = todayData.power_off
      .map(({ time: { start } }) => parse(start, 'HH:mm', now))
      .find(
        (date) =>
          differenceInMinutes(date, now) >
          NEXT_AVAILABILITY_CHANGE_MIN_DIFFERENCE_MINUTES
      );

    if (!nextDisableMoment && tomorrowData.power_off.length) {
      nextDisableMoment = parse(tomorrowData.power_off[0].time.start, 'HH:mm', now);
    }

    let nextPossibleDisableMoment: Date | undefined =
      todayData.power_on_possible
        .map(({ time: { end } }) => parse(end, 'HH:mm', now))
        .find(
          (date) =>
            differenceInMinutes(date, now) >
            NEXT_AVAILABILITY_CHANGE_MIN_DIFFERENCE_MINUTES
        );

    if (!nextPossibleDisableMoment && tomorrowData.power_on_possible.length) {
      nextPossibleDisableMoment = parse(
        tomorrowData.power_on_possible[0].time.end,
        'HH:mm',
        now
      );
    }

    if (
      nextEnableMoment &&
      nextPossibleEnableMoment &&
      nextPossibleEnableMoment > nextEnableMoment
    ) {
      nextPossibleEnableMoment = undefined;
    }

    if (
      nextDisableMoment &&
      nextPossibleDisableMoment &&
      nextPossibleDisableMoment > nextDisableMoment
    ) {
      nextPossibleDisableMoment = undefined;
    }

    return {
      enableMoment: nextEnableMoment,
      possibleEnableMoment: nextPossibleEnableMoment,
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

  private async sleep(params: { readonly ms: number }): Promise<void> {
    return new Promise((r) => setTimeout(r, params.ms));
  }
}

interface ScheduleMoment {
  readonly time: {
    // This is time of the day in 24h format in Kyiv timezone (e.g. "04:00" or "22:00")
    readonly start: string;
    readonly end: string;
  };
}

interface ScheduleDay {
  readonly power_off: Array<ScheduleMoment>;
  readonly power_on: Array<ScheduleMoment>;
  readonly power_on_possible: Array<ScheduleMoment>;
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
