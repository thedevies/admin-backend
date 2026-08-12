import { memoryStorage } from 'multer';
import { BadRequestException } from '@nestjs/common';
import * as path from 'path';

export const createMulterOptions = (
  folder?: string,
  maxSize = 5 * 1024 * 1024, // 5MB default
) => {
  return {
    storage: memoryStorage(),

    limits: {
      fileSize: maxSize,
    },

    fileFilter: (req: any, file: any, callback: any) => {
      const allowedImageMimes = [
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/webp',
      ];
      const allowedDocMimes = ['application/pdf'];
      const allowedImageExts = ['.jpg', '.jpeg', '.png', '.webp'];
      const allowedDocExts = ['.pdf'];

      const fileExt = path.extname(file.originalname).toLowerCase();
      const mimeType = file.mimetype.toLowerCase();

      // Block executable and dangerous file extensions
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

      if (dangerousExts.includes(fileExt) || fileExt.includes('\0')) {
        return callback(
          new BadRequestException(
            'Executable or dangerous files are strictly rejected.',
          ),
          false,
        );
      }

      if (folder === 'biodata') {
        const isAllowedMime =
          allowedImageMimes.includes(mimeType) ||
          allowedDocMimes.includes(mimeType);
        const isAllowedExt =
          allowedImageExts.includes(fileExt) ||
          allowedDocExts.includes(fileExt);

        if (!isAllowedMime || !isAllowedExt) {
          return callback(
            new BadRequestException(
              'Invalid file type. Only PDF, JPG, JPEG, PNG, and WEBP files are allowed for biodata.',
            ),
            false,
          );
        }
      } else {
        // default/other folders are restricted to image uploads only
        const isAllowedMime = allowedImageMimes.includes(mimeType);
        const isAllowedExt = allowedImageExts.includes(fileExt);

        if (!isAllowedMime || !isAllowedExt) {
          return callback(
            new BadRequestException(
              'Invalid file type. Only JPG, JPEG, PNG, and WEBP images are allowed.',
            ),
            false,
          );
        }
      }

      callback(null, true);
    },
  };
};
