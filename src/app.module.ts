import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ActivityModule } from './listener/activity.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { SearchModule } from './search/search.module';
import { ActivityLog } from './listener/activity.entity';
import { LogModule } from 'nestjs-session-log';
import { EventEmitterModule } from '@nestjs/event-emitter';

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
    ActivityModule
  ],
  controllers: [AppController],
  providers: [
    AppService,
  ],
})
export class AppModule { }
