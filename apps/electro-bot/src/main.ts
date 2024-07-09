/**
 * This is not a production server yet!
 * This is only a minimal backend to get started.
 */

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app/app.module';
import { LogLevel } from '@nestjs/common';

async function bootstrap() {
  const logLevel = (process.env.LOG_LEVEL || 'error')
    .split(',')
    .map((level: LogLevel[number]) => level.trim()) as Array<LogLevel>;

  await NestFactory.createApplicationContext(AppModule, {
    logger: logLevel,
  });
}
bootstrap();
