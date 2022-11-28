import { BotModule } from '@electrobot/bot';
import { ElectricityAvailabilityModule } from '@electrobot/electricity-availability';
import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { KnexModule } from 'nestjs-knex';
import { CronService } from './cron.service';

@Module({
  imports: [
    ElectricityAvailabilityModule,
    BotModule,
    ScheduleModule.forRoot(),
    KnexModule.forRoot({
      config: {
        client: 'pg',
        connection: {
          host: process.env.DB_HOST,
          port: Number(process.env.DB_PORT),
          user: process.env.DB_USER,
          password: process.env.DB_PASSWORD,
          database: process.env.DB_NAME,
        },
      },
    }),
  ],
  providers: [CronService],
})
export class AppModule {}
