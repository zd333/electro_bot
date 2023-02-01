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

  @Cron(CronExpression.EVERY_MINUTE)
  public async checkElectricityAvailability(): Promise<void> {
    await this.electricityAvailabilityService.checkAndSaveElectricityAvailabilityStateOfAllPlaces();
  }

  @Cron('0 0 10 1 * *')
  public async notifyAllPlacesAboutPreviousMonthStats(): Promise<void> {
    this.logger.verbose('Notifying all places about previous month stats');

    await this.notificationBotService.notifyAllPlacesAboutPreviousMonthStats();
  }
}
