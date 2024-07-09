import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { addDays, format, parse } from 'date-fns';

/**
 * This is very simple implementation of the power schedule service.
 * It works with https://kyiv.electricstatus.click API which is not official
 * and (somehow) takes  data from Yasno schedule.
 * !It works only for Kyiv!
 */
@Injectable()
export class KyivElectricstatusScheduleService {
  private readonly logger = new Logger(KyivElectricstatusScheduleService.name);

  constructor(private readonly httpService: HttpService) {}

  async getScheduledEnableAvailabilityMoment(params: {
    readonly scheduleGroupId: number;
  }): Promise<
    | undefined
    | {
        readonly enableMoment?: Date;
        readonly possibleEnableMoment?: Date;
      }
  > {
    const httpRes = await firstValueFrom(
      this.httpService.get(
        `https://kyiv.electricstatus.click/group/${params.scheduleGroupId}/week`
      )
    );
    const data: ScheduleResponse = httpRes.data;

    this.logger.verbose('Got schedule data', data);

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
      .map(({ start }) => parse(start, 'HH:mm', now))
      .find((date) => date > now);

    if (!nextEnableMoment && tomorrowData.power_on.length) {
      nextEnableMoment = parse(tomorrowData.power_on[0].start, 'HH:mm', now);
    }

    let nextPossibleEnableMoment: Date | undefined = todayData.power_on_possible
      .map(({ start }) => parse(start, 'HH:mm', now))
      .find((date) => date > now);

    if (!nextPossibleEnableMoment && tomorrowData.power_on_possible.length) {
      nextPossibleEnableMoment = parse(
        tomorrowData.power_on_possible[0].start,
        'HH:mm',
        now
      );
    }

    if (!nextEnableMoment && !nextPossibleEnableMoment) {
      return undefined;
    }

    if (!nextEnableMoment) {
      return { possibleEnableMoment: nextPossibleEnableMoment };
    }

    if (
      !nextPossibleEnableMoment ||
      nextPossibleEnableMoment > nextEnableMoment
    ) {
      return { enableMoment: nextEnableMoment };
    }

    return {
      enableMoment: nextEnableMoment,
      possibleEnableMoment: nextPossibleEnableMoment,
    };
  }
}

interface ScheduleMoment {
  // This is time of the day in 24h format in Kyiv timezone (e.g. "04:00" or "22:00")
  readonly start: string;
  readonly end: string;
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
