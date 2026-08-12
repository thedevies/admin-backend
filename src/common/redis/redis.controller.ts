import { Controller, Get } from '@nestjs/common';
import { CacheService } from '../cache/cache.service';

@Controller('redis')
export class RedisController {
  constructor(private readonly cacheService: CacheService) {}

  @Get('test')
  async redisTest() {
    await this.cacheService.set('test:key', { message: 'Hello Redis' }, 60);

    const data = await this.cacheService.get('test:key');

    return {
      success: true,
      data,
    };
  }
}
