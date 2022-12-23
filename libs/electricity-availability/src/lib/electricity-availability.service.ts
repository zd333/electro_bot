import { ElectricityRepository } from '@electrobot/electricity-repo';
import { Injectable, Logger } from '@nestjs/common';
import * as ping from 'ping';
import { Subject } from 'rxjs';
import { startOfToday, startOfYesterday } from 'date-fns';
import { convertToLocalTime, convertToTimeZone } from 'date-fns-timezone';
import { HistoryItem } from './history-item.type';
import { Place } from '@electrobot/domain';
import { PlaceRepository } from '@electrobot/place-repo';

const DEFAULT_TRESHOLD_MINUTES = 7;

@Injectable()
export class ElectricityAvailabilityService {
  private readonly logger = new Logger(ElectricityAvailabilityService.name);
  private readonly _availabilityChange$ = new Subject<{
    readonly placeId: string;
  }>();
  private isCheckingPlaceAvailability: Record<string, boolean> = {};

  public readonly availabilityChange$ =
    this._availabilityChange$.asObservable();

  constructor(
    private readonly electricityRepository: ElectricityRepository,
    private readonly placeRepository: PlaceRepository
  ) {}

  public async checkAndSaveElectricityAvailabilityStateOfAllPlaces(): Promise<void> {
    const places = await this.placeRepository.getAllPlaces();
    const jobs = places.map((place) =>
      this.checkAndSavePlaceElectricityAvailability({ place })
    );

    await Promise.all(jobs);
  }

  public async getLatestPlaceAvailability(params: {
    readonly placeId: string;
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
  public async getPlaceStats(params: { readonly place: Place }): Promise<{
    readonly history: {
      readonly today?: Array<HistoryItem>;
      readonly yesterday?: Array<HistoryItem>;
    };
    readonly lastStateBeforeToday?: boolean;
    readonly lastStateBeforeYesterday?: boolean;
  }> {
    const { place } = params;
    const now = new Date();
    const todayStart = convertToLocalTime(startOfToday(), {
      timeZone: place.timezone,
    });
    const yesterdayStart = convertToLocalTime(startOfYesterday(), {
      timeZone: place.timezone,
    });

    const todayData = (
      await this.electricityRepository.getLatestAvailability({
        placeId: place.id,
        from: todayStart,
        till: now,
      })
    ).map((item) => ({
      ...item,
      time: convertToTimeZone(item.time, { timeZone: place.timezone }),
    }));
    const todayHistory = this.availabilityDataToHistory({
      start: todayStart,
      end: now,
      sortedAvailabilityData: todayData,
    });
    const beforeTodayRes =
      await this.electricityRepository.getLatestAvailability({
        placeId: place.id,
        till: todayStart,
        limit: 1,
      });
    const lastStateBeforeToday =
      beforeTodayRes.length > 0 ? beforeTodayRes[0].isAvailable : undefined;

    const yesterdayData = (
      await this.electricityRepository.getLatestAvailability({
        placeId: place.id,
        from: yesterdayStart,
        till: todayStart,
      })
    ).map((item) => ({
      ...item,
      time: convertToTimeZone(item.time, { timeZone: place.timezone }),
    }));
    const yesterdayHistory = this.availabilityDataToHistory({
      start: yesterdayStart,
      end: todayStart,
      sortedAvailabilityData: yesterdayData,
    });
    const beforeYesterdayRes =
      await this.electricityRepository.getLatestAvailability({
        placeId: place.id,
        till: yesterdayStart,
        limit: 1,
      });
    const lastStateBeforeYesterday =
      beforeYesterdayRes.length > 0
        ? beforeYesterdayRes[0].isAvailable
        : undefined;

    return {
      history: {
        today: todayHistory,
        yesterday: yesterdayHistory,
      },
      lastStateBeforeToday,
      lastStateBeforeYesterday,
    };
  }

  public async checkAndSavePlaceElectricityAvailability(params: {
    readonly place: Place;
  }): Promise<void> {
    const { place } = params;

    this.logger.verbose(`Starting availability check of ${place.name}`);

    const isChecking = !!this.isCheckingPlaceAvailability[place.id];

    if (isChecking) {
      this.logger.log(
        `Availability check of ${place.name} is in progress when next check was launched, skipping next check`
      );

      return;
    }

    this.isCheckingPlaceAvailability[place.id] = true;

    try {
      let alive = false;
      let currentTime = Date.now();
      const tresholdMinutes =
        place.unavailabilityTresholdMinutes ?? DEFAULT_TRESHOLD_MINUTES;
      const tresholdMilliseconds = tresholdMinutes * 60 * 1000;
      const finishTime = currentTime + tresholdMilliseconds;

      while (!alive && currentTime < finishTime) {
        const res = await ping.promise.probe(place.host);

        alive = res.alive;

        if (!alive) {
          await this.sleep({ ms: 1 * 1000 }); // 1s
        }

        currentTime = Date.now();
      }

      const [latest] = await this.electricityRepository.getLatestAvailability({
        placeId: place.id,
        limit: 1,
      });

      if (latest?.isAvailable === alive) {
        this.isCheckingPlaceAvailability[place.id] = false;

        return;
      }

      await this.electricityRepository.saveAvailability({
        placeId: place.id,
        isAvailable: alive,
      });

      this._availabilityChange$.next({ placeId: place.id });

      this.logger.verbose(
        `Availability state of ${place.name} changed from ${latest?.isAvailable} to ${alive}, saving`
      );
    } catch (e) {
      //
    }

    this.isCheckingPlaceAvailability[place.id] = false;
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
    new Promise((r) => setTimeout(r, params.ms));
  }
}
