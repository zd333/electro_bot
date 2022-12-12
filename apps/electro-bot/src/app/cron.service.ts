import { ElectricityAvailabilityService } from '@electrobot/electricity-availability';
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class CronService {
  private readonly logger = new Logger(CronService.name);

  constructor(
    private readonly electricityAvailabilityService: ElectricityAvailabilityService
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  public async checkElectricityAvailability(): Promise<void> {
    await this.electricityAvailabilityService.checkAndSaveElectricityAvailabilityStateOfAllPlaces();
  }
}
