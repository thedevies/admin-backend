import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaService } from './prisma.service';
import { CacheModule } from '../common/cache/cache.module';

@Global()
@Module({
  imports: [ConfigModule, CacheModule],
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
