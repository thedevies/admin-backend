import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { StorageProvider } from '../storage.interface';
import { UploadResponseDto } from '../dto/upload-response.dto';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class LocalStorageProvider implements StorageProvider {
  private readonly uploadsRoot = path.join(process.cwd(), 'uploads');

  constructor() {
    if (!fs.existsSync(this.uploadsRoot)) {
      fs.mkdirSync(this.uploadsRoot, { recursive: true });
    }
  }

  private ensureFolderExists(folderPath: string) {
    const fullPath = path.join(this.uploadsRoot, folderPath);
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
    }
  }

  async uploadFile(
    file: Express.Multer.File,
    folder: string,
  ): Promise<UploadResponseDto> {
    try {
      this.ensureFolderExists(folder);
      const filePath = path.join(this.uploadsRoot, folder, file.originalname);
      fs.writeFileSync(filePath, file.buffer);

      const relativeUrl = `/uploads/${folder}/${file.originalname}`;

      return {
        url: relativeUrl,
        fileName: file.originalname,
        fileId: relativeUrl,
        provider: 'local',
        size: file.size,
        mimeType: file.mimetype,
      };
    } catch (error: any) {
      throw new InternalServerErrorException(
        `Local file upload failed: ${error?.message || error}`,
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
      this.ensureFolderExists(folder);
      const filePath = path.join(this.uploadsRoot, folder, fileName);
      fs.writeFileSync(filePath, buffer);

      const relativeUrl = `/uploads/${folder}/${fileName}`;

      return {
        url: relativeUrl,
        fileName: fileName,
        fileId: relativeUrl,
        provider: 'local',
        size: buffer.length,
        mimeType,
      };
    } catch (error: any) {
      throw new InternalServerErrorException(
        `Local buffer upload failed: ${error?.message || error}`,
      );
    }
  }

  async deleteFile(fileIdOrPath: string): Promise<void> {
    try {
      let relativePath = fileIdOrPath;
      if (fileIdOrPath.includes('/uploads/')) {
        relativePath = fileIdOrPath.substring(
          fileIdOrPath.indexOf('/uploads/') + 9,
        );
      }
      const fullPath = path.join(this.uploadsRoot, relativePath);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }
    } catch (error: any) {
      throw new InternalServerErrorException(
        `Local file deletion failed: ${error?.message || error}`,
      );
    }
  }
}
