import { ElectricityAvailabilityModule } from '@electrobot/electricity-availability';
import { Module } from '@nestjs/common';
import { BotService } from './bot.service';

@Module({
  imports: [ElectricityAvailabilityModule],
  providers: [BotService],
  exports: [BotService],
})
export class BotModule {}
