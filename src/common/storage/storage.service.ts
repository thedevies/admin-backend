import {
  Injectable,
  Inject,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import type { StorageProvider } from './storage.interface';
import { UploadResponseDto } from './dto/upload-response.dto';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';

@Injectable()
export class StorageService {
  constructor(
    @Inject('STORAGE_PROVIDER_IMPLEMENTATION')
    private readonly provider: StorageProvider,
  ) {}

  private validateFile(
    mimeType: string,
    size: number,
    expectedType: 'image' | 'pdf',
    maxSize?: number,
    originalName?: string,
  ) {
    const allowedImageTypes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/webp',
    ];
    const allowedPdfTypes = ['application/pdf'];

    const allowedImageExts = ['.jpg', '.jpeg', '.png', '.webp'];
    const allowedPdfExts = ['.pdf'];

    const dangerousExts = [
      '.exe',
      '.bat',
      '.sh',
      '.js',
      '.ts',
      '.msi',
      '.jar',
      '.php',
      '.py',
      '.cmd',
      '.com',
      '.scr',
      '.vbs',
      '.wsf',
      '.cpl',
      '.gadget',
      '.html',
      '.htm',
    ];

    if (originalName) {
      const ext = path.extname(originalName).toLowerCase();
      if (dangerousExts.includes(ext) || ext.includes('\0')) {
        throw new BadRequestException(
          'Executable or dangerous files are strictly rejected.',
        );
      }
      if (expectedType === 'image' && !allowedImageExts.includes(ext)) {
        throw new BadRequestException(
          'Invalid file extension for image. Allowed: .jpg, .jpeg, .png, .webp',
        );
      }
      if (expectedType === 'pdf' && !allowedPdfExts.includes(ext)) {
        throw new BadRequestException(
          'Invalid file extension for document. Allowed: .pdf',
        );
      }
    }

    if (expectedType === 'image') {
      if (!allowedImageTypes.includes(mimeType.toLowerCase())) {
        throw new BadRequestException(
          'Invalid file type. Only JPG, JPEG, PNG, and WEBP images are allowed.',
        );
      }
      const limit = maxSize || 5 * 1024 * 1024; // Default 5MB
      if (size > limit) {
        throw new BadRequestException(
          `File too large. Maximum size allowed is ${limit / (1024 * 1024)}MB.`,
        );
      }
    } else if (expectedType === 'pdf') {
      if (!allowedPdfTypes.includes(mimeType.toLowerCase())) {
        throw new BadRequestException(
          'Invalid file type. Only PDF documents are allowed.',
        );
      }
      const limit = maxSize || 10 * 1024 * 1024; // Default 10MB
      if (size > limit) {
        throw new BadRequestException(
          `File too large. Maximum size allowed is ${limit / (1024 * 1024)}MB.`,
        );
      }
    }
  }

  private generateUniqueFileName(originalName: string): string {
    const ext = path.extname(originalName).toLowerCase();
    const uuid = uuidv4();
    const timestamp = Date.now();
    return `${uuid}-${timestamp}${ext}`;
  }

  async uploadPhoto(
    file: Express.Multer.File,
    folder: string = 'users/gallery',
    maxSize?: number,
  ): Promise<UploadResponseDto> {
    if (!file || !file.buffer) {
      throw new BadRequestException('File buffer is required for upload');
    }

    this.validateFile(
      file.mimetype,
      file.size,
      'image',
      maxSize,
      file.originalname,
    );
    const uniqueName = this.generateUniqueFileName(file.originalname);

    const fileToUpload = {
      ...file,
      originalname: uniqueName,
    };

    try {
      return await this.provider.uploadFile(fileToUpload, folder);
    } catch (error: any) {
      throw new InternalServerErrorException(
        `Upload failed: ${error?.message || error}`,
      );
    }
  }

  async uploadBiodata(
    file: Express.Multer.File,
    folder: string = 'documents/biodata',
    maxSize?: number,
  ): Promise<UploadResponseDto> {
    if (!file || !file.buffer) {
      throw new BadRequestException('File buffer is required for upload');
    }

    this.validateFile(
      file.mimetype,
      file.size,
      'pdf',
      maxSize,
      file.originalname,
    );
    const uniqueName = this.generateUniqueFileName(file.originalname);

    const fileToUpload = {
      ...file,
      originalname: uniqueName,
    };

    try {
      return await this.provider.uploadFile(fileToUpload, folder);
    } catch (error: any) {
      throw new InternalServerErrorException(
        `Upload failed: ${error?.message || error}`,
      );
    }
  }

  async uploadBuffer(
    buffer: Buffer,
    fileName: string,
    mimeType: string,
    folder: string,
    maxSize?: number,
  ): Promise<UploadResponseDto> {
    if (!buffer) {
      throw new BadRequestException('Buffer is required for upload');
    }

    const fileType =
      mimeType.toLowerCase() === 'application/pdf' ? 'pdf' : 'image';
    this.validateFile(mimeType, buffer.length, fileType, maxSize, fileName);

    const uniqueName = this.generateUniqueFileName(fileName);

    try {
      return await this.provider.uploadBuffer(
        buffer,
        uniqueName,
        mimeType,
        folder,
      );
    } catch (error: any) {
      throw new InternalServerErrorException(
        `Upload failed: ${error?.message || error}`,
      );
    }
  }

  async delete(urlOrPath: string): Promise<void> {
    if (!urlOrPath) {
      throw new BadRequestException(
        'File URL or path is required for deletion',
      );
    }

    try {
      await this.provider.deleteFile(urlOrPath);
    } catch (error: any) {
      throw new InternalServerErrorException(
        `File deletion failed: ${error?.message || error}`,
      );
    }
  }
}
