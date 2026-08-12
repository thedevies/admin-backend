import { Global, Module } from '@nestjs/common';
import { RedisProvider } from './redis.provider';
import { RedisService } from './redis.service';
import { RedisController } from './redis.controller';

@Global()
@Module({
  controllers: [RedisController],
  providers: [RedisProvider, RedisService],
  exports: [RedisService],
})
export class RedisModule {}
