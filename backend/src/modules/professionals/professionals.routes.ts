import { Router } from 'express';
import { professionalsController } from './professionals.controller';
import { requireAuth } from '../../middleware/require-auth';
import { requireSuperAdmin } from '../../middleware/require-super-admin';

const router = Router();

// No auth — bot/web calls
router.post('/register', (req, res, next) => {
  void professionalsController.register(req, res, next);
});

router.get('/verify/:token', (req, res, next) => {
  void professionalsController.getVerificationToken(req, res, next);
});

router.post('/verify/:token', (req, res, next) => {
  void professionalsController.verify(req, res, next);
});

router.get('/session/:token', (req, res, next) => {
  void professionalsController.getSessionByToken(req, res, next);
});

router.get('/session/:token/panel', (req, res, next) => {
  void professionalsController.getPanelData(req, res, next);
});

router.get('/session/:token/orders', (req, res, next) => {
  void professionalsController.getPanelOrders(req, res, next);
});

router.get('/session/:token/pending-requests', (req, res, next) => {
  void professionalsController.getPendingRequests(req, res, next);
});

router.get('/session/:token/stats', (req, res, next) => {
  void professionalsController.getActivityStats(req, res, next);
});

router.get('/session/:sessionToken/earnings', (req, res, next) => {
  void professionalsController.getEarnings(req, res, next);
});

// Auth required — OPERATOR+
router.get('/', requireAuth, (req, res, next) => {
  void professionalsController.list(req, res, next);
});

router.get('/departments', requireAuth, (req, res, next) => {
  void professionalsController.listDepartments(req, res, next);
});

router.get('/:id', requireAuth, (req, res, next) => {
  void professionalsController.getById(req, res, next);
});

// Auth required — SUPERADMIN only
router.post('/:id/approve', requireSuperAdmin, (req, res, next) => {
  void professionalsController.approve(req, res, next);
});

router.post('/:id/reject', requireSuperAdmin, (req, res, next) => {
  void professionalsController.reject(req, res, next);
});

router.post('/:id/suspend', requireSuperAdmin, (req, res, next) => {
  void professionalsController.suspend(req, res, next);
});

router.post('/:id/reactivate', requireSuperAdmin, (req, res, next) => {
  void professionalsController.reactivate(req, res, next);
});

router.patch('/:id/badge', requireSuperAdmin, (req, res, next) => {
  void professionalsController.setBadge(req, res, next);
});

router.post('/:id/generate-session', requireSuperAdmin, (req, res, next) => {
  void professionalsController.generateSession(req, res, next);
});

export default router;
