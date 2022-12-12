import { ElectricityRepoModule } from '@electrobot/electricity-repo';
import { PlaceRepoModule } from '@electrobot/place-repo';
import { Module } from '@nestjs/common';
import { ElectricityAvailabilityService } from './electricity-availability.service';

@Module({
  imports: [ElectricityRepoModule, PlaceRepoModule],
  controllers: [],
  providers: [ElectricityAvailabilityService],
  exports: [ElectricityAvailabilityService],
})
export class ElectricityAvailabilityModule {}
