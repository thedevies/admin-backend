import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StorageProvider } from '../storage.interface';
import { UploadResponseDto } from '../dto/upload-response.dto';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';

@Injectable()
export class S3Provider implements StorageProvider {
  private readonly s3: S3Client;

  constructor(private readonly configService: ConfigService) {
    const region =
      this.configService.get<string>('storage.s3.region') || 'us-east-1';
    const accessKeyId =
      this.configService.get<string>('storage.s3.accessKeyId') || '';
    const secretAccessKey =
      this.configService.get<string>('storage.s3.secretAccessKey') || '';

    this.s3 = new S3Client({
      region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });
  }

  async uploadFile(
    file: Express.Multer.File,
    folder: string,
  ): Promise<UploadResponseDto> {
    const bucket = this.configService.get<string>('storage.s3.bucket');
    if (!bucket) {
      throw new InternalServerErrorException(
        'AWS S3 bucket configuration is missing',
      );
    }

    const region =
      this.configService.get<string>('storage.s3.region') || 'us-east-1';
    const key = folder ? `${folder}/${file.originalname}` : file.originalname;

    try {
      const command = new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
      });

      await this.s3.send(command);

      const url = `https://${bucket}.s3.${region}.amazonaws.com/${key}`;

      return {
        url,
        fileName: file.originalname,
        fileId: key,
        provider: 's3',
        size: file.size,
        mimeType: file.mimetype,
      };
    } catch (error: any) {
      throw new InternalServerErrorException(
        `S3 upload failed: ${error?.message || error}`,
      );
    }
  }

  async uploadBuffer(
    buffer: Buffer,
    fileName: string,
    mimeType: string,
    folder: string,
  ): Promise<UploadResponseDto> {
    const bucket = this.configService.get<string>('storage.s3.bucket');
    if (!bucket) {
      throw new InternalServerErrorException(
        'AWS S3 bucket configuration is missing',
      );
    }

    const region =
      this.configService.get<string>('storage.s3.region') || 'us-east-1';
    const key = folder ? `${folder}/${fileName}` : fileName;

    try {
      const command = new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: buffer,
        ContentType: mimeType,
      });

      await this.s3.send(command);

      const url = `https://${bucket}.s3.${region}.amazonaws.com/${key}`;

      return {
        url,
        fileName,
        fileId: key,
        provider: 's3',
        size: buffer.length,
        mimeType,
      };
    } catch (error: any) {
      throw new InternalServerErrorException(
        `S3 buffer upload failed: ${error?.message || error}`,
      );
    }
  }

  async deleteFile(fileIdOrPath: string): Promise<void> {
    const bucket = this.configService.get<string>('storage.s3.bucket');
    if (!bucket) {
      throw new InternalServerErrorException(
        'AWS S3 bucket configuration is missing',
      );
    }

    try {
      let key = fileIdOrPath;

      // If the passed argument is a full URL, extract the path/key part
      if (fileIdOrPath.includes('://')) {
        try {
          const parsedUrl = new URL(fileIdOrPath);
          // Remove the leading slash to get the S3 Key
          key = parsedUrl.pathname.startsWith('/')
            ? parsedUrl.pathname.substring(1)
            : parsedUrl.pathname;
        } catch {
          // If URL parsing fails, fallback to keeping the string as is
        }
      }

      const command = new DeleteObjectCommand({
        Bucket: bucket,
        Key: key,
      });

      await this.s3.send(command);
    } catch (error: any) {
      throw new InternalServerErrorException(
        `S3 file deletion failed: ${error?.message || error}`,
      );
    }
  }
}
