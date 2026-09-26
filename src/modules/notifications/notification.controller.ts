import { Response } from 'express';
import { NotificationService } from './notification.service';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';
import { sendSuccess, sendError } from '../../utils/response.util';
import { CryptoUtil } from '../../utils/crypto.util';

import { notificationEvents } from './notification.events';

export class NotificationController {
  private notificationService: NotificationService;

  constructor(notificationService?: NotificationService) {
    this.notificationService = notificationService || new NotificationService();
  }

  private resolveAuthUser(req: AuthenticatedRequest): {
    userId: number | null;
    roleCode: string;
  } {
    const user = req.user;
    let userId: number | null = null;
    if (user?.id) {
      userId = CryptoUtil.decryptId(user.id) ?? (typeof user.id === 'number' ? user.id : parseInt(String(user.id), 10) || null);
    }
    const roleCode = user?.role_code || user?.role || '';
    return { userId, roleCode };
  }

  getNotifications = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { userId, roleCode } = this.resolveAuthUser(req);
      const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 50;

      const notifications = await this.notificationService.getNotifications({
        userId,
        roleCode,
        limit,
      });

      sendSuccess(res, notifications, 'Daftar notifikasi berhasil diambil');
    } catch (error: any) {
      sendError(res, error.message || 'Gagal mengambil data notifikasi', 500);
    }
  };

  getUnreadCount = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { userId, roleCode } = this.resolveAuthUser(req);
      const count = await this.notificationService.getUnreadCount({
        userId,
        roleCode,
      });

      sendSuccess(res, { unread_count: count }, 'Jumlah notifikasi belum dibaca');
    } catch (error: any) {
      sendError(res, error.message || 'Gagal menghitung notifikasi belum dibaca', 500);
    }
  };

  markAsRead = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      if (!id) {
        sendError(res, 'ID notifikasi diperlukan', 400);
        return;
      }

      await this.notificationService.markAsRead(id);
      sendSuccess(res, { success: true }, 'Notifikasi ditandai sebagai telah dibaca');
    } catch (error: any) {
      sendError(res, error.message || 'Gagal menandai notifikasi', 500);
    }
  };

  markAllAsRead = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { userId, roleCode } = this.resolveAuthUser(req);
      await this.notificationService.markAllAsRead({
        userId,
        roleCode,
      });

      sendSuccess(res, { success: true }, 'Semua notifikasi ditandai sebagai telah dibaca');
    } catch (error: any) {
      sendError(res, error.message || 'Gagal menandai semua notifikasi', 500);
    }
  };

  streamNotifications = (req: AuthenticatedRequest, res: Response): void => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    if (typeof (res as any).flushHeaders === 'function') {
      (res as any).flushHeaders();
    }

    res.write(`data: ${JSON.stringify({ type: 'connected' })}\n\n`);

    const onNotification = (payload: any) => {
      res.write(`data: ${JSON.stringify({ type: 'notification_update', payload })}\n\n`);
    };

    notificationEvents.on('notification', onNotification);

    const keepAlive = setInterval(() => {
      res.write(': keepalive\n\n');
    }, 25000);

    req.on('close', () => {
      clearInterval(keepAlive);
      notificationEvents.off('notification', onNotification);
    });
  };
}
