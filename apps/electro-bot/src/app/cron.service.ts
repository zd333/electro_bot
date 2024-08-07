import { NotificationBotService } from '@electrobot/bot';
import { ElectricityAvailabilityService } from '@electrobot/electricity-availability';
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class CronService {
  private readonly logger = new Logger(CronService.name);

  constructor(
    private readonly electricityAvailabilityService: ElectricityAvailabilityService,
    private readonly notificationBotService: NotificationBotService,
  ) {}

  // Every 2 minutes
  @Cron('0 */2 * * * *')
  public async checkElectricityAvailability(): Promise<void> {
    await this.electricityAvailabilityService.checkAndSaveElectricityAvailabilityStateOfAllPlaces();
  }

  // 10:00 every first day of the month
  @Cron('0 0 10 1 * *')
  public async notifyAllPlacesAboutPreviousMonthStats(): Promise<void> {
    this.logger.verbose('Notifying all places about previous month stats');

    await this.notificationBotService.notifyAllPlacesAboutPreviousMonthStats();
  }
}
