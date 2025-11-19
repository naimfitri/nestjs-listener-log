import { Injectable, Logger, Optional } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ActivityLog } from './activity.entity';
import { ClsService } from 'nestjs-cls';
import { ElasticsearchService } from '@nestjs/elasticsearch';
import { ACTIVITY_LOG_EVENT } from 'nestjs-session-log';
import type { ActivityLogPayload } from 'nestjs-session-log';

@Injectable()
export class ActivityLogListener {
  private readonly logger = new Logger(ActivityLogListener.name);

  constructor(
    @InjectRepository(ActivityLog)
    private readonly logRepository: Repository<ActivityLog>,
    private readonly clsService: ClsService,
    private readonly elasticsearchService: ElasticsearchService,
  ) { }

  @OnEvent(ACTIVITY_LOG_EVENT)
  async handleLogEvent(payload: ActivityLogPayload) {
    this.logger.log(`Caught log event! User: ${payload.userId}, URL: ${payload.url}`);

    // Save to Database
    try {
      await this.clsService.run(async () => {
        this.clsService.set('userId', payload.userId);
        const newLog = this.logRepository.create(payload);
        await this.logRepository.save(newLog);
      });
      this.logger.log('Saved to MariaDB');
    } catch (e) {
      this.logger.error('Failed to save activity log to MariaDB', e);
    }

    //Save to Elasticsearch (commented out until ES is properly configured)
    try {
      if (this.elasticsearchService) {
        await this.elasticsearchService.index({
          index: 'activity-logs',
          body: {
            ...payload,
            timestamp: new Date().toISOString(),
          },
        });

        this.logger.log('Saved to Elasticsearch');
      }
    } catch (e) {
      this.logger.warn('Elasticsearch not available, skipping ES save');
    }
  }
}
