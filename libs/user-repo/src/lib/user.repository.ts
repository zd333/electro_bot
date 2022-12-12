import { Injectable } from '@nestjs/common';
import { InjectKnex, Knex } from 'nestjs-knex';

@Injectable()
export class UserRepository {
  constructor(@InjectKnex() private readonly knex: Knex) {}

  public async addUserSubscription(params: {
    readonly placeId: string;
    readonly chatId: number;
  }): Promise<boolean> {
    const queryRes = await this.knex
      .select<Array<{ readonly chat_id: number; readonly created_at: Date }>>(
        '*'
      )
      .from('subscription')
      .where({
        place_id: params.placeId,
        chat_id: params.chatId,
      });

    if (queryRes.length > 0) {
      // Already subscribed

      return false;
    }

    await this.knex.table('subscription').insert({
      place_id: params.placeId,
      chat_id: params.chatId,
      created_at: new Date(),
    });

    return true;
  }

  public async removeUserSubscription(params: {
    readonly placeId: string;
    readonly chatId: number;
  }): Promise<boolean> {
    const numDeleted = await this.knex.table('subscription').del().where({
      place_id: params.placeId,
      chat_id: params.chatId,
    });

    return !!numDeleted;
  }

  public async getAllPlaceUserSubscriptions(params: {
    readonly placeId: string;
  }): Promise<
    Array<{
      readonly chatId: number;
    }>
  > {
    const queryRes = await this.knex
      .select<Array<{ readonly chat_id: number; readonly created_at: Date }>>(
        '*'
      )
      .from('subscription')
      .where({
        place_id: params.placeId,
      });

    return queryRes.map(({ chat_id: chatId }) => ({ chatId }));
  }
}
