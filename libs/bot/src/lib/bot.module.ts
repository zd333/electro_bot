import { ElectricityAvailabilityModule } from '@electrobot/electricity-availability';
import { PlaceRepoModule } from '@electrobot/place-repo';
import { UserRepoModule } from '@electrobot/user-repo';
import { Module } from '@nestjs/common';
import { NotificationBotService } from './notification-bot.service';

@Module({
  imports: [ElectricityAvailabilityModule, UserRepoModule, PlaceRepoModule],
  providers: [NotificationBotService],
  exports: [NotificationBotService],
})
export class BotModule {}
