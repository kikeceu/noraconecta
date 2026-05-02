import { Request, Response, NextFunction } from 'express';
import { StorageService } from './storage.service';

interface PresignUploadBody {
  folder: string;
  filename: string;
  contentType: string;
}

export class StorageController {
  constructor(private readonly storageService: StorageService) {}

  async presignUpload(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { folder, filename, contentType } = req.body as PresignUploadBody;

      if (!folder || !filename || !contentType) {
        res.status(400).json({
          error: 'folder, filename and contentType are required',
          statusCode: 400,
        });
        return;
      }

      const result = await this.storageService.generatePresignedUpload(
        folder,
        filename,
        contentType,
      );

      res.status(200).json({ data: result });
    } catch (err) {
      next(err);
    }
  }
}
