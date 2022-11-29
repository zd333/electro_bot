import { ElectricityAvailabilityModule } from '@electrobot/electricity-availability';
import { UserRepoModule } from '@electrobot/user-repo';
import { Module } from '@nestjs/common';
import { BotService } from './bot.service';

@Module({
  imports: [ElectricityAvailabilityModule, UserRepoModule],
  providers: [BotService],
  exports: [BotService],
})
export class BotModule {}
