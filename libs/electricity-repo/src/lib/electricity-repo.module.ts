import { Module } from '@nestjs/common';
import { ElectricityRepository } from './electricity.repository';

@Module({
  controllers: [],
  providers: [ElectricityRepository],
  exports: [ElectricityRepository],
})
export class ElectricityRepoModule {}
