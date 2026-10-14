import { Request, Response } from 'express';
import { ActivityLogService } from './activity-log.service';
import { ActivityLogMain, ActivityLogSecondary } from './activity-log.helper';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';
import { sendSuccess, sendError } from '../../utils/response.util';

export class ActivityLogController {
  private service: ActivityLogService;

  constructor(service?: ActivityLogService) {
    this.service = service || new ActivityLogService();
  }

  /**
   * GET /api/activity-logs
   * Mengambil daftar log aktivitas dengan filter tipe (main/secondary), tanggal awal, tanggal akhir, dan search
   */
  getActivityLogs = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const type = (req.query.type as string) || 'main';
      const startDate = req.query.start_date as string || req.query.startDate as string;
      const endDate = req.query.end_date as string || req.query.endDate as string;
      const search = req.query.search as string;
      const page = parseInt(String(req.query.page || '1'), 10);
      const limit = parseInt(String(req.query.limit || '20'), 10);

      const result = await this.service.getActivityLogs({
        type,
        startDate,
        endDate,
        search,
        page,
        limit,
      });

      sendSuccess(res, result, 'Daftar log aktivitas berhasil diambil');
    } catch (error: any) {
      sendError(res, error.message || 'Gagal mengambil data log aktivitas', 500);
    }
  };

  /**
   * POST /api/activity-logs
   * Menerima log aktivitas kustom dari Web atau Mobile client
   */
  logClientActivity = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { activity, type = 'main', payload = [] } = req.body;
      if (!activity || typeof activity !== 'string') {
        sendError(res, 'Aktivitas (activity) wajib disertakan', 400);
        return;
      }

      const logType = type === 'secondary' ? 'secondary' : 'main';
      if (logType === 'secondary') {
        await ActivityLogSecondary(req, activity.trim(), payload);
      } else {
        await ActivityLogMain(req, activity.trim(), payload);
      }

      sendSuccess(res, { success: true }, 'Log aktivitas berhasil dicatat', 201);
    } catch (error: any) {
      sendError(res, error.message || 'Gagal mencatat log aktivitas', 500);
    }
  };

  /**
   * POST /api/activity-logs/mobile
   * Endpoint khusus untuk mencatat log aktivitas dari aplikasi Mobile Flutter
   * Otomatis menyeragamkan format dengan akhiran " - Mobile"
   */
  logMobileActivity = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { activity, type = 'main', payload = [] } = req.body;
      if (!activity || typeof activity !== 'string') {
        sendError(res, 'Aktivitas (activity) wajib disertakan', 400);
        return;
      }

      // Tandai request sebagai mobile
      if (!req.headers['x-platform']) {
        req.headers['x-platform'] = 'mobile';
      }

      const trimmed = activity.trim();
      const formattedActivity = trimmed.toLowerCase().endsWith('- mobile')
        ? trimmed
        : `${trimmed} - Mobile`;

      const logType = type === 'secondary' ? 'secondary' : 'main';
      if (logType === 'secondary') {
        await ActivityLogSecondary(req, formattedActivity, payload);
      } else {
        await ActivityLogMain(req, formattedActivity, payload);
      }

      sendSuccess(res, { success: true, activity: formattedActivity }, 'Log aktivitas mobile berhasil dicatat', 201);
    } catch (error: any) {
      sendError(res, error.message || 'Gagal mencatat log aktivitas mobile', 500);
    }
  };
}
