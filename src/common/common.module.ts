import { Module } from '@nestjs/common';

import { PrismaModule } from 'src/prisma/prisma.module';
import { CommonController } from './common.controller';
import { CommonService } from './common.service';
import { CommonQueryService } from './services/common-query.service';
import { BackgroundTaskQueue } from './services/background-task-queue.service';

@Module({
  imports: [PrismaModule],
  controllers: [CommonController],
  providers: [CommonService, CommonQueryService, BackgroundTaskQueue],
  exports: [CommonService, CommonQueryService, BackgroundTaskQueue],
})
export class CommonModule {}
