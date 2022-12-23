import { Injectable } from '@nestjs/common';
import { InjectKnex, Knex } from 'nestjs-knex';
import { Bot, BotStats, Place } from '@electrobot/domain';
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

    return queryRes.map(({ id, bot_name, place_id, token, is_enabled, is_publically_listed }) => ({
      id,
      botName: bot_name ?? undefined,
      token,
      placeId: place_id,
      isEnabled: is_enabled,
      isPublicallyListed: is_publically_listed ?? undefined,
    }));
  }

  public async getListedPlaceBotStats(): Promise<Array<BotStats>> {
    return await this.knex
      .select<Array<BotStats>>(
        'count(DISTINCT user_action.chat_id) as numberOfUsers',
        'MIN(place.name) as placeName',
        'MIN(bot.bot_name) as botName',
      )
      .from('user_action')
      .innerJoin('place', 'place.id', '=', 'user_action.place_id')
      .innerJoin('bot', 'place.id', '=', 'bot.place_id')
      .whereNotNull('bot.bot_name')
      .andWhere({
        'bot.is_publically_listed': true,
      })
      .groupBy('user_action.place_id')
      .orderBy('numberOfUsers', 'desc');
  }
}
