export interface UploadResponseDto {
  url: string;
  fileName: string;
  fileId: string;
  provider: 'imagekit' | 's3' | 'local';
  size: number;
  mimeType: string;
}
