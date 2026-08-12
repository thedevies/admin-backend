import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { StorageService } from './storage.service';
import { ImageKitProvider } from './providers/imagekit.provider';
import { S3Provider } from './providers/s3.provider';
import { LocalStorageProvider } from './providers/local.provider';
import { storageProviderFactory } from './storage.factory';

@Module({
  imports: [ConfigModule],
  providers: [
    ImageKitProvider,
    S3Provider,
    LocalStorageProvider,
    storageProviderFactory,
    StorageService,
  ],
  exports: [StorageService],
})
export class StorageModule {}
