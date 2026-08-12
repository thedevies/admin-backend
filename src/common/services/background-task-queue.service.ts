import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class BackgroundTaskQueue implements OnModuleDestroy {
  private readonly logger = new Logger(BackgroundTaskQueue.name);
  private queue: (() => Promise<void>)[] = [];
  private activeCount = 0;
  private readonly maxConcurrency: number;
  private isShuttingDown = false;

  constructor(private readonly configService: ConfigService) {
    const configuredConcurrency =
      this.configService.get<string>('QUEUE_CONCURRENCY');
    this.maxConcurrency = configuredConcurrency
      ? parseInt(configuredConcurrency, 10)
      : 5;
    if (isNaN(this.maxConcurrency)) {
      this.maxConcurrency = 5;
    }
  }

  async onModuleDestroy(): Promise<void> {
    this.isShuttingDown = true;
    this.logger.log('Shutting down BackgroundTaskQueue...');

    // Clear pending tasks to prevent them from starting
    this.queue = [];

    if (this.activeCount > 0) {
      this.logger.log(
        `Waiting for ${this.activeCount} active background tasks to complete...`,
      );
      await new Promise<void>((resolve) => {
        const interval = setInterval(() => {
          if (this.activeCount === 0) {
            clearInterval(interval);
            resolve();
          }
        }, 50);
      });
    }
    this.logger.log('BackgroundTaskQueue stopped.');
  }

  push(task: () => Promise<void>) {
    if (this.isShuttingDown) {
      this.logger.warn('Queue is shutting down. Task rejected.');
      return;
    }
    this.queue.push(task);
    this.logger.log(
      `Task added to background queue. Queue size: ${this.queue.length}`,
    );
    this.processNext();
  }

  private processNext() {
    if (
      this.isShuttingDown ||
      this.activeCount >= this.maxConcurrency ||
      this.queue.length === 0
    ) {
      return;
    }

    const task = this.queue.shift();
    if (!task) return;

    this.activeCount++;
    task()
      .catch((err) => {
        this.logger.error(
          'Background task failed',
          err instanceof Error ? err.stack : String(err),
        );
      })
      .finally(() => {
        this.activeCount--;
        this.processNext();
      });
  }
}
