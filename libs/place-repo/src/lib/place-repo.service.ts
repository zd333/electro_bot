import { Injectable } from '@nestjs/common';
import { InjectKnex, Knex } from 'nestjs-knex';
import { Bot, Place } from '@electrobot/domain';
import { RepoPlace } from './repo-place.type';
import { RepoBot } from './repo-bot.type';

@Injectable()
export class PlaceRepository {
  constructor(@InjectKnex() private readonly knex: Knex) {}

  public async getAllPlaces(): Promise<Array<Place>> {
    const queryRes = await this.knex
      .select<Array<RepoPlace>>('*')
      .from('place');

    return queryRes.map(({ id, name, timezone, host, unavailability_treshold_minutes }) => ({
      id,
      name,
      timezone,
      host,
      unavailabilityTresholdMinutes: unavailability_treshold_minutes ?? undefined,
    }));
  }

  public async getAllPlaceBots(): Promise<Array<Bot>> {
    const queryRes = await this.knex.select<Array<RepoBot>>('*').from('bot');

    return queryRes.map(({ id, place_id, token, is_enabled }) => ({
      id,
      token,
      placeId: place_id,
      isEnabled: is_enabled,
    }));
  }
}
