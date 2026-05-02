import { Router } from 'express';
import { StorageController } from './storage.controller';
import { StorageService } from './storage.service';
import { R2Client } from '../../lib/r2-client';

const r2Client = new R2Client();
const storageService = new StorageService(r2Client);
const storageController = new StorageController(storageService);

const router = Router();

router.post('/presign-upload', (req, res, next) => {
  void storageController.presignUpload(req, res, next);
});

export default router;
