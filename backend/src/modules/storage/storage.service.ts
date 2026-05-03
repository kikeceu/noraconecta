import { R2Client, PresignedUploadResult } from '../../lib/r2-client';
import { AppError } from '../../middleware/error-handler';

const VALID_CONTENT_TYPES: Record<string, string[]> = {
  'request-photos': ['image/jpeg', 'image/png', 'image/webp'],
  'request-audio': [
    'audio/webm',
    'audio/mp4',
    'audio/mpeg',
    'audio/ogg',
    'audio/wav',
    'audio/webm;codecs=opus',
  ],
  verification: [
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/pdf',
    'video/mp4',
    'video/quicktime',
  ],
};

export class StorageService {
  constructor(private readonly r2Client: R2Client) {}

  generatePresignedUpload(
    folder: string,
    filename: string,
    contentType: string,
  ): Promise<PresignedUploadResult> {
    this.validateFolder(folder);
    this.validateContentType(folder, contentType);

    return this.r2Client.generatePresignedUpload(folder, filename, contentType);
  }

  private validateFolder(folder: string): void {
    const allowedFolders = Object.keys(VALID_CONTENT_TYPES);

    if (!folder || !allowedFolders.includes(folder)) {
      throw new AppError(
        `Invalid folder. Allowed: ${allowedFolders.join(', ')}`,
        400,
      );
    }
  }

  private validateContentType(folder: string, contentType: string): void {
    const allowed = VALID_CONTENT_TYPES[folder];

    if (!contentType) {
      throw new AppError('Content type is required', 400);
    }

    if (!allowed.includes(contentType)) {
      throw new AppError(
        `Invalid content type '${contentType}' for folder '${folder}'. Allowed: ${allowed.join(', ')}`,
        400,
      );
    }
  }
}
