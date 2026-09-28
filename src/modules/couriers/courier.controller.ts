import { Request, Response } from 'express';
import { CourierService } from './courier.service';
import { sendSuccess, sendError } from '../../utils/response.util';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';
import { isCourierRole } from '../../utils/role.util';

export class CourierController {
  private courierService: CourierService;

  constructor(courierService?: CourierService) {
    this.courierService = courierService || new CourierService();
  }

  getCouriers = async (req: Request, res: Response): Promise<void> => {
    try {
      const couriers = await this.courierService.getCouriers();
      sendSuccess(res, couriers, 'Daftar kurir dan performa tips berhasil diambil');
    } catch (error: any) {
      sendError(res, error.message || 'Gagal mengambil data kurir', 500);
    }
  };

  getCourierSummary = async (req: Request, res: Response): Promise<void> => {
    try {
      const user = (req as AuthenticatedRequest).user;
      let courierName = (req.query.courier_name as string) || null;
      let courierPhone = (req.query.courier_phone as string) || null;
      let userId: number | null = null;

      if (user) {
        const u = user as any;
        const isCour = await isCourierRole(u.role_code || u.role);
        if (isCour) {
          courierName = u.name || u.name_users || courierName;
          courierPhone = u.phone || courierPhone;
          userId = Number(u.id ?? u.id_users) || null;
        }
      }

      const summary = await this.courierService.getCourierSummary({
        courierName,
        courierPhone,
        userId,
      });
      sendSuccess(res, summary, 'Ringkasan kurir dan tips berhasil diambil');
    } catch (error: any) {
      sendError(res, error.message || 'Gagal mengambil ringkasan kurir', 500);
    }
  };

  getCourierTasks = async (req: Request, res: Response): Promise<void> => {
    try {
      const user = (req as AuthenticatedRequest).user;
      const statusFilter = req.query.status as 'active' | 'history' | 'all' | undefined;

      let courierName = (req.query.courier_name as string) || null;
      let courierPhone = (req.query.courier_phone as string) || null;

      // Jika user yang login adalah kurir, otomatis filter ke tugas miliknya sendiri
      if (user) {
        const u = user as any;
        const isCour = await isCourierRole(u.role_code || u.role);
        if (isCour) {
          courierName = u.name || u.name_users || courierName;
          courierPhone = u.phone || courierPhone;
        }
      }

      const tasks = await this.courierService.getCourierTasks({
        courierName,
        courierPhone,
        statusFilter: statusFilter || 'all',
      });

      sendSuccess(res, tasks, 'Daftar tugas kurir berhasil diambil');
    } catch (error: any) {
      sendError(res, error.message || 'Gagal mengambil tugas kurir', 500);
    }
  };

  updateTaskStatus = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { status } = req.body;
      const user = (req as AuthenticatedRequest).user;

      if (!status) {
        sendError(res, 'Status baru harus diisi', 400);
        return;
      }

      const u = user as any;
      const isCour = u ? await isCourierRole(u.role_code || u.role) : false;

      const result = await this.courierService.updateTaskStatus(
        id,
        status,
        u ? Number(u.id_users ?? u.id) : undefined,
        isCour ? u : undefined
      );

      sendSuccess(res, result, 'Status tugas kurir berhasil diperbarui');
    } catch (error: any) {
      sendError(res, error.message || 'Gagal memperbarui status tugas kurir', 400);
    }
  };

  getCourierTransactions = async (req: Request, res: Response): Promise<void> => {
    try {
      const user = (req as AuthenticatedRequest).user;
      let courierName = (req.query.courier_name as string) || null;
      let courierPhone = (req.query.courier_phone as string) || null;
      let userId: number | null = null;
      const category = (req.query.category as string) || null;
      const limit = req.query.limit ? Number(req.query.limit) : undefined;

      if (user) {
        const u = user as any;
        const isCour = await isCourierRole(u.role_code || u.role);
        if (isCour) {
          courierName = u.name || u.name_users || courierName;
          courierPhone = u.phone || courierPhone;
          userId = Number(u.id ?? u.id_users) || null;
        }
      }

      const transactions = await this.courierService.getCourierTransactions({
        userId,
        courierName,
        courierPhone,
        category,
        limit,
      });

      sendSuccess(res, transactions, 'Riwayat transaksi saldo dan tips kurir berhasil diambil');
    } catch (error: any) {
      sendError(res, error.message || 'Gagal mengambil riwayat transaksi kurir', 500);
    }
  };
}

