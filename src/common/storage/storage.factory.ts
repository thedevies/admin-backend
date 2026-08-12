import { ConfigService } from '@nestjs/config';
import { ImageKitProvider } from './providers/imagekit.provider';
import { S3Provider } from './providers/s3.provider';
import { LocalStorageProvider } from './providers/local.provider';

export const storageProviderFactory = {
  provide: 'STORAGE_PROVIDER_IMPLEMENTATION',
  useFactory: (
    configService: ConfigService,
    imageKitProvider: ImageKitProvider,
    s3Provider: S3Provider,
    localStorageProvider: LocalStorageProvider,
  ) => {
    const provider =
      configService.get<string>('storage.provider') || 'imagekit';
    if (provider === 's3') {
      return s3Provider;
    }

    const ikUrl = configService.get<string>('IMAGEKIT_URL_ENDPOINT');
    const isImageKitPlaceholder = !ikUrl || ikUrl.includes('your_imagekit_id');

    if (provider === 'local' || isImageKitPlaceholder) {
      return localStorageProvider;
    }

    return imageKitProvider;
  },
  inject: [ConfigService, ImageKitProvider, S3Provider, LocalStorageProvider],
};
