import { UploadResponseDto } from './dto/upload-response.dto';

export interface StorageProvider {
  uploadFile(
    file: Express.Multer.File,
    folder: string,
  ): Promise<UploadResponseDto>;
  uploadBuffer(
    buffer: Buffer,
    fileName: string,
    mimeType: string,
    folder: string,
  ): Promise<UploadResponseDto>;
  deleteFile(fileIdOrPath: string): Promise<void>;
}
