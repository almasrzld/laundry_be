import { Router } from 'express';
import { NotificationController } from './notification.controller';
import { authMiddleware } from '../../middleware/auth.middleware';

const router = Router();
const notificationController = new NotificationController();

// Semua rute notifikasi membutuhkan autentikasi
router.use(authMiddleware);

router.get('/', notificationController.getNotifications);
router.get('/stream', notificationController.streamNotifications);
router.get('/unread-count', notificationController.getUnreadCount);
router.patch('/read-all', notificationController.markAllAsRead);
router.patch('/:id/read', notificationController.markAsRead);

export default router;
