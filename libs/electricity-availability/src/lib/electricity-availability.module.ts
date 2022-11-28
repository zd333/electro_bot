import { ElectricityRepoModule } from '@electrobot/electricity-repo';
import { Module } from '@nestjs/common';
import { ElectricityAvailabilityService } from './electricity-availability.service';

@Module({
  imports: [ElectricityRepoModule],
  controllers: [],
  providers: [ElectricityAvailabilityService],
  exports: [ElectricityAvailabilityService],
})
export class ElectricityAvailabilityModule {}
