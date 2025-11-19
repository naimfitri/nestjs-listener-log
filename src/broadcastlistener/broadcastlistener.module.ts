import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ActivityLog } from './activity.entity';
import { ActivityLogListener } from './activity.listener';
import { ClsModule } from 'nestjs-cls';
import { SearchModule } from '../search/search.module';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([ActivityLog]),
    ClsModule,
    SearchModule,
  ],
  providers: [ActivityLogListener],
})
export class BroadcastlistenerModule {}
