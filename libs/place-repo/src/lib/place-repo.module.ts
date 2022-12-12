import { Module } from '@nestjs/common';
import { PlaceRepository } from './place-repo.service';

@Module({
  controllers: [],
  providers: [PlaceRepository],
  exports: [PlaceRepository],
})
export class PlaceRepoModule {}
