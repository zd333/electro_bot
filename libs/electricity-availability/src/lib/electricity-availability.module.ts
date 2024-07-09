import { ElectricityRepoModule } from '@electrobot/electricity-repo';
import { PlaceRepoModule } from '@electrobot/place-repo';
import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ElectricityAvailabilityService } from './electricity-availability.service';
import { KyivElectricstatusScheduleService } from './kyiv-electricstatus-schedule.service';

@Module({
  imports: [HttpModule, ElectricityRepoModule, PlaceRepoModule],
  controllers: [],
  providers: [
    ElectricityAvailabilityService,
    KyivElectricstatusScheduleService,
  ],
  exports: [ElectricityAvailabilityService, KyivElectricstatusScheduleService],
})
export class ElectricityAvailabilityModule {}
