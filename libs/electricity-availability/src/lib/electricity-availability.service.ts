import { ElectricityRepository } from '@electrobot/electricity-repo';
import { Injectable, Logger } from '@nestjs/common';
import * as ping from 'ping';

const HOST = '94.45.154.74';
const PING_RETRY_ATTEMPTS = 5;
@Injectable()
export class ElectricityAvailabilityService {
  private readonly logger = new Logger(ElectricityAvailabilityService.name);

  constructor(private readonly electricityRepository: ElectricityRepository) {}

  public async checkAndSaveElectricityAvailabilityState(): Promise<void> {
    let alive = false;
    let attempts = 0;

    while (!alive && attempts <= PING_RETRY_ATTEMPTS) {
      const res = await ping.promise.probe(HOST, {
        timeout: 5,
        deadline: 10,
      });

      alive = res.alive;
      attempts++;
    }

    const latest = await this.electricityRepository.getLatestAvailability();

    if (latest?.isAvailable === alive) {
      this.logger.verbose(
        `Current availability state (${alive}) haven't changed, skipping save`
      );

      return;
    }

    this.logger.verbose(
      `Availability state changed from ${latest?.isAvailable} to ${alive}, saving`
    );

    await this.electricityRepository.saveAvailability({ isAvailable: alive });
  }

  public async getLatestAvailability(): Promise<
    | {
        readonly time: Date;
        readonly isAvailable: boolean;
      }
    | undefined
  > {
    return this.electricityRepository.getLatestAvailability();
  }
}
