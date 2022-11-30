import { Injectable } from '@nestjs/common';
import { InjectKnex, Knex } from 'nestjs-knex';
import type { Knex as RawKnex } from 'knex';

@Injectable()
export class ElectricityRepository {
  constructor(@InjectKnex() private readonly knex: Knex) {}

  public async getLatestAvailability(params: {
    readonly limit?: number;
    readonly from?: Date;
    readonly till?: Date;
  }): Promise<
    Array<{
      readonly time: Date;
      readonly isAvailable: boolean;
    }>
  > {
    const { limit, from, till } = params;
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
          .limit(limit)
          .offset(0)
          .orderBy('created_at', 'desc')
      : this.knex
          .select<
            Array<{ readonly is_available: boolean; readonly created_at: Date }>
          >('*')
          .from('availability')
          .where(whereBuilder)
          .orderBy('created_at', 'desc');
    const queryRes = await query;

    return queryRes.map((item) => ({
      time: item.created_at,
      isAvailable: item.is_available,
    }));
  }

  public async saveAvailability(params: {
    readonly isAvailable: boolean;
  }): Promise<void> {
    await this.knex.table('availability').insert({
      is_available: params.isAvailable,
      created_at: new Date(),
    });
  }
}
