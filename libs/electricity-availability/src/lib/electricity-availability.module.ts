import { ElectricityRepoModule } from '@electrobot/electricity-repo';
import { PlaceRepoModule } from '@electrobot/place-repo';
import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ElectricityAvailabilityService } from './electricity-availability.service';

@Module({
  imports: [HttpModule, ElectricityRepoModule, PlaceRepoModule],
  controllers: [],
  providers: [ElectricityAvailabilityService],
  exports: [ElectricityAvailabilityService],
})
export class ElectricityAvailabilityModule {}
