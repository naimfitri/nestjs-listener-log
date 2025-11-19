import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { BroadcastlistenerModule } from './broadcastlistener/broadcastlistener.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { SearchModule } from './search/search.module';
import { ActivityLog } from './broadcastlistener/activity.entity';
import { LogModule, ActivityLogInterceptor } from 'nestjs-session-log';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { APP_INTERCEPTOR } from '@nestjs/core';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    TypeOrmModule.forRoot({
      type: 'mariadb',
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT || ''),
      username: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      entities: [ActivityLog],
      synchronize: true,
      timezone: '+08:00',
    }),
    SearchModule,
    EventEmitterModule.forRoot(),
    LogModule.forRoot({
      redis: {
        host: process.env.REDIS_HOST || '',
        port: parseInt(process.env.REDIS_PORT || ''),
      },
      broadcast: true,
    }),
    BroadcastlistenerModule
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Note: ActivityLogInterceptor not needed in listener app
    // Only producer apps need the interceptor
  ],
})
export class AppModule { }
