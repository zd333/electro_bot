import { Injectable } from '@nestjs/common';
import { InjectKnex, Knex } from 'nestjs-knex';

@Injectable()
export class ElectricityRepository {
  constructor(@InjectKnex() private readonly knex: Knex) {}

  public async getLatestAvailability(): Promise<
    | {
        readonly time: Date;
        readonly isAvailable: boolean;
      }
    | undefined
  > {
    const queryRes = await this.knex
      .select<
        Array<{ readonly is_available: boolean; readonly created_at: Date }>
      >('*')
      .from('availability')
      .limit(1)
      .offset(0)
      .orderBy('created_at', 'desc');

    if (queryRes.length === 0) {
      return undefined;
    }

    const [latest] = queryRes;

    return {
      time: latest.created_at,
      isAvailable: latest.is_available,
    };
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
