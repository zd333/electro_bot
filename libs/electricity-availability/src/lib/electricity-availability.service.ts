import { ElectricityRepository } from '@electrobot/electricity-repo';
import { Injectable, Logger } from '@nestjs/common';
import * as ping from 'ping';
import { Subject } from 'rxjs';
import {
  startOfToday,
  startOfYesterday,
} from 'date-fns';
import { convertToLocalTime, convertToTimeZone } from 'date-fns-timezone';
import { HistoryItem } from './history-item.type';

const HOST = process.env.HOST_TO_CHECK_AVAILABILITY as string;
const TRESHOLD_TIME = 4 * 60 * 1000; // 4 min

@Injectable()
export class ElectricityAvailabilityService {
  private readonly logger = new Logger(ElectricityAvailabilityService.name);
  private readonly _availabilityChange$ = new Subject<void>();

  public readonly availabilityChange$ =
    this._availabilityChange$.asObservable();

  constructor(private readonly electricityRepository: ElectricityRepository) {}

  public async checkAndSaveElectricityAvailabilityState(): Promise<void> {
    let alive = false;
    let currentTime = Date.now();
    const finishTime = currentTime + TRESHOLD_TIME;

    while (!alive && currentTime < finishTime) {
      const res = await ping.promise.probe(HOST);

      alive = res.alive;

      if (!alive) {
        await this.sleep({ ms: 30 * 1000 });
      }

      currentTime = Date.now();
    }

    const [latest] = await this.electricityRepository.getLatestAvailability({
      limit: 1,
    });

    if (latest?.isAvailable === alive) {

      return;
    }

    await this.electricityRepository.saveAvailability({ isAvailable: alive });

    this._availabilityChange$.next();

    this.logger.verbose(
      `Availability state changed from ${latest?.isAvailable} to ${alive}, saving`
    );
  }

  public async getLatestAvailability(params: {
    readonly limit?: number;
  }): Promise<
    Array<{
      readonly time: Date;
      readonly isAvailable: boolean;
    }>
  > {
    return this.electricityRepository.getLatestAvailability(params);
  }

  // TODO: refactor (make cleaner)
  public async getStats(params: { readonly timeZone: string }): Promise<{
    readonly history: {
      readonly today?: Array<HistoryItem>;
      readonly yesterday?: Array<HistoryItem>;
    };
  }> {
    const { timeZone } = params;
    this.logger.warn(timeZone);
    const now = new Date();
    this.logger.warn(now);
    const todayStart = convertToLocalTime(startOfToday(), { timeZone });
    const yesterdayStart = convertToLocalTime(startOfYesterday(), { timeZone });

    const todayData = (
      await this.electricityRepository.getLatestAvailability({
        from: todayStart,
        till: now,
      })
    ).map((item) => ({
      ...item,
      time: convertToTimeZone(item.time, { timeZone }),
    }));
    const todayHistory = this.availabilityDataToHistory({
      start: todayStart,
      end: now,
      sortedAvailabilityData: todayData,
    });

    const yesterdayData = (
      await this.electricityRepository.getLatestAvailability({
        from: yesterdayStart,
        till: todayStart,
      })
    ).map((item) => ({
      ...item,
      time: convertToTimeZone(item.time, { timeZone }),
    }));
    const yesterdayHistory = this.availabilityDataToHistory({
      start: yesterdayStart,
      end: todayStart,
      sortedAvailabilityData: yesterdayData,
    });

    // TODO: finish (stats)

    return {
      history: {
        today: todayHistory,
        yesterday: yesterdayHistory,
      },
    };
  }

  private availabilityDataToHistory(params: {
    readonly start: Date;
    readonly end: Date;
    readonly sortedAvailabilityData: Array<{
      readonly time: Date;
      readonly isAvailable: boolean;
    }>;
  }): Array<HistoryItem> {
    const { start, end, sortedAvailabilityData } = params;
    const fromOldest = [...sortedAvailabilityData].reverse();

    if (fromOldest.length === 0) {
      return [];
    }

    const first: HistoryItem = {
      start,
      end: fromOldest[0].time,
      isEnabled: !fromOldest[0].isAvailable,
    };
    const last: HistoryItem = {
      start: fromOldest[fromOldest.length - 1].time,
      end,
      isEnabled: fromOldest[fromOldest.length - 1].isAvailable,
    };

    if (fromOldest.length === 1) {
      return [first, last];
    }

    const middle = fromOldest.slice(0, -1).map((item, i) => ({
      start: item.time,
      end: fromOldest[i + 1].time,
      isEnabled: item.isAvailable,
    }));

    return [first, ...middle, last];
  }

  private async sleep(params: { readonly ms: number }): Promise<void> {
    new Promise(r => setTimeout(r, params.ms));
  }
}
