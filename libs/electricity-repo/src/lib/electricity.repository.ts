import { Injectable } from '@nestjs/common';
import { InjectKnex, Knex } from 'nestjs-knex';

@Injectable()
export class ElectricityRepository {
  constructor(@InjectKnex() private readonly knex: Knex) {}

  public async getLatestAvailability(params: {
    readonly numberOfLatestEvents: number;
  }): Promise<
    Array<{
      readonly time: Date;
      readonly isAvailable: boolean;
    }>
  > {
    const queryRes = await this.knex
      .select<
        Array<{ readonly is_available: boolean; readonly created_at: Date }>
      >('*')
      .from('availability')
      .limit(params.numberOfLatestEvents)
      .offset(0)
      .orderBy('created_at', 'desc');

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
