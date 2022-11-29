import { ElectricityAvailabilityService } from '@electrobot/electricity-availability';
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class CronService {
  private readonly logger = new Logger(CronService.name);
  private isCheckingElectricityAvailability = false;

  constructor(
    private readonly electricityAvailabilityService: ElectricityAvailabilityService
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  public async checkElectricityAvailability(): Promise<void> {
    if (this.isCheckingElectricityAvailability) {
      this.logger.warn('Previous electricity check was in progress when new cron iteration started, skipping current one');

      return;
    }

    this.logger.verbose('Starting electricity check');
    this.isCheckingElectricityAvailability = true;
    await this.electricityAvailabilityService.checkAndSaveElectricityAvailabilityState();
    this.isCheckingElectricityAvailability = false;
    this.logger.verbose('Finished electricity check');
  }
}
