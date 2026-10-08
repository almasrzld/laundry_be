import { Router } from 'express';
import { ActivityLogController } from './activity-log.controller';
import { authMiddleware, optionalAuthMiddleware } from '../../middleware/auth.middleware';

const router = Router();
const controller = new ActivityLogController();

// GET /api/activity-logs (Membutuhkan autentikasi)
router.get('/', authMiddleware, controller.getActivityLogs);

// POST /api/activity-logs (Bisa menggunakan auth token atau optional untuk mobile/web client tracking)
router.post('/', optionalAuthMiddleware, controller.logClientActivity);

// POST /api/activity-logs/mobile (Dedicated endpoint khusus log aktivitas mobile)
router.post('/mobile', optionalAuthMiddleware, controller.logMobileActivity);

export default router;
