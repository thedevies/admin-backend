import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import ImageKit from 'imagekit';

import { StorageProvider } from '../storage.interface';
import { UploadResponseDto } from '../dto/upload-response.dto';

@Injectable()
export class ImageKitProvider implements StorageProvider {
  private readonly imagekit: ImageKit;

  constructor(private readonly configService: ConfigService) {
    this.imagekit = new ImageKit({
      publicKey: this.configService.getOrThrow<string>('IMAGEKIT_PUBLIC_KEY'),
      privateKey: this.configService.getOrThrow<string>('IMAGEKIT_PRIVATE_KEY'),
      urlEndpoint: this.configService.getOrThrow<string>(
        'IMAGEKIT_URL_ENDPOINT',
      ),
    });
  }

  async uploadFile(
    file: Express.Multer.File,
    folder: string,
  ): Promise<UploadResponseDto> {
    try {
      const response = await this.imagekit.upload({
        file: `data:${file.mimetype};base64,${file.buffer.toString('base64')}`,
        fileName: file.originalname,
        folder,
      });

      return {
        url: response.url,
        fileName: response.name,
        fileId: response.fileId,
        provider: 'imagekit',
        size: response.size,
        mimeType: file.mimetype,
      };
    } catch (error: any) {
      throw new InternalServerErrorException(
        `ImageKit upload failed: ${error.message}`,
      );
    }
  }

  async uploadBuffer(
    buffer: Buffer,
    fileName: string,
    mimeType: string,
    folder: string,
  ): Promise<UploadResponseDto> {
    try {
      const response = await this.imagekit.upload({
        file: `data:${mimeType};base64,${buffer.toString('base64')}`,
        fileName,
        folder,
      });

      return {
        url: response.url,
        fileName: response.name,
        fileId: response.fileId,
        provider: 'imagekit',
        size: response.size,
        mimeType,
      };
    } catch (error: any) {
      throw new InternalServerErrorException(
        `ImageKit upload failed: ${error.message}`,
      );
    }
  }

  async deleteFile(fileId: string): Promise<void> {
    try {
      await this.imagekit.deleteFile(fileId);
    } catch (error: any) {
      throw new InternalServerErrorException(
        `ImageKit delete failed: ${error.message}`,
      );
    }
  }
}
