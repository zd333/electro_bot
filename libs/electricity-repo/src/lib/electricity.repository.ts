import { Injectable } from '@nestjs/common';
import { InjectKnex, Knex } from 'nestjs-knex';
import type { Knex as RawKnex } from 'knex';

// TODO: update availability table: make place ID column reference after version 0.2.0 released

@Injectable()
export class ElectricityRepository {
  constructor(@InjectKnex() private readonly knex: Knex) {}

  public async getAvailability(params: {
    readonly placeId: string;
    readonly limit?: number;
    readonly from?: Date;
    readonly till?: Date;
    readonly orderBy?: 'asc' | 'desc'
  }): Promise<
    Array<{
      readonly time: Date;
      readonly isAvailable: boolean;
    }>
  > {
    const { placeId, limit, from, till, orderBy = 'desc' } = params;
    const whereBuilder = (builder: RawKnex.QueryBuilder) => {
      if (from) {
        builder.andWhere('created_at', '>=', from);
      }

      if (till) {
        builder.andWhere('created_at', '<', till);
      }
    };

    const query = limit
      ? this.knex
          .select<
            Array<{ readonly is_available: boolean; readonly created_at: Date }>
          >('*')
          .from('availability')
          .where(whereBuilder)
          .andWhere({ place_id: placeId })
          .limit(limit)
          .offset(0)
          .orderBy('created_at', orderBy)
      : this.knex
          .select<
            Array<{ readonly is_available: boolean; readonly created_at: Date }>
          >('*')
          .from('availability')
          .where(whereBuilder)
          .andWhere({ place_id: placeId })
          .orderBy('created_at', orderBy);
    const queryRes = await query;

    return queryRes.map((item) => ({
      time: item.created_at,
      isAvailable: item.is_available,
    }));
  }

  public async saveAvailability(params: {
    readonly placeId: string;
    readonly isAvailable: boolean;
  }): Promise<void> {
    await this.knex.table('availability').insert({
      place_id: params.placeId,
      is_available: params.isAvailable,
      created_at: new Date(),
    });
  }
}
