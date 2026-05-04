import { Router } from 'express';
import { requestsController } from './requests.controller';
import { requireAuth } from '../../middleware/require-auth';

const router = Router();

router.post('/', (req, res, next) => {
  void requestsController.create(req, res, next);
});

router.post('/:id/accept', (req, res, next) => {
  void requestsController.accept(req, res, next);
});

router.post('/:id/reject', (req, res, next) => {
  void requestsController.reject(req, res, next);
});

router.post('/:id/cancel', (req, res, next) => {
  void requestsController.cancel(req, res, next);
});

router.post('/:id/mark-completed', (req, res, next) => {
  void requestsController.markCompleted(req, res, next);
});

router.post('/:id/confirm-completion', (req, res, next) => {
  void requestsController.confirmCompletion(req, res, next);
});

router.post('/:id/report-noncompliance', (req, res, next) => {
  void requestsController.reportNoncompliance(req, res, next);
});

router.post('/:id/submit-feedback', (req, res, next) => {
  void requestsController.submitFeedback(req, res, next);
});

router.get('/', requireAuth, (req, res, next) => {
  void requestsController.list(req, res, next);
});

router.get('/:id', (req, res, next) => {
  void requestsController.getById(req, res, next);
});

export default router;
