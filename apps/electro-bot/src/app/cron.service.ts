import { ElectricityAvailabilityService } from '@electrobot/electricity-availability';
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

@Injectable()
export class CronService {
  private readonly logger = new Logger(CronService.name);

  constructor(
    private readonly electricityAvailabilityService: ElectricityAvailabilityService
  ) {
    this.checkElectricityAvailability();
  }

  @Cron('* */5 * * * *')
  public async checkElectricityAvailability(): Promise<void> {
    this.logger.verbose('Running electricity check');

    await this.electricityAvailabilityService.checkAndSaveElectricityAvailabilityState();
  }
}
