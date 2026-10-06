import { Request, Response } from 'express';
import { CourierService } from './courier.service';
import { sendSuccess, sendError } from '../../utils/response.util';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';
import { isCourierRole } from '../../utils/role.util';
import { CryptoUtil } from '../../utils/crypto.util';

const resolveNumericUserId = (u: any): number | null => {
  if (!u) return null;
  const rawId = u.id_users ?? u.id;
  if (!rawId) return null;
  if (typeof rawId === 'string') {
    return CryptoUtil.decryptId(rawId) ?? (parseInt(rawId, 10) || null);
  }
  return Number(rawId) || null;
};

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
          userId = resolveNumericUserId(u);
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
          userId = resolveNumericUserId(u);
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

  requestWithdrawal = async (req: Request, res: Response): Promise<void> => {
    try {
      const user = (req as AuthenticatedRequest).user as any;
      if (!user) {
        sendError(res, 'Sesi login tidak valid. Silakan login kembali.', 401);
        return;
      }

      const userId = resolveNumericUserId(user) ?? (user.id_users ?? user.id);
      const { amount, bank_name, account_number, account_name, notes } = req.body;

      if (!amount || Number(amount) < 10000) {
        sendError(res, 'Minimal penarikan dana adalah Rp 10.000', 400);
        return;
      }

      if (!bank_name || !account_number || !account_name) {
        sendError(res, 'Nama bank, nomor rekening, dan nama pemilik rekening wajib diisi', 400);
        return;
      }

      const result = await this.courierService.requestWithdrawal(
        userId,
        Number(amount),
        bank_name,
        account_number,
        account_name,
        notes,
      );

      sendSuccess(res, result, 'Permintaan penarikan dana berhasil diajukan dan sedang diproses admin', 201);
    } catch (error: any) {
      sendError(res, error.message || 'Gagal mengajukan penarikan dana', 400);
    }
  };

  getCourierWithdrawals = async (req: Request, res: Response): Promise<void> => {
    try {
      const user = (req as AuthenticatedRequest).user as any;
      if (!user) {
        sendError(res, 'Sesi login tidak valid. Silakan login kembali.', 401);
        return;
      }

      const userId = resolveNumericUserId(user) ?? (user.id_users ?? user.id);
      const data = await this.courierService.getCourierWithdrawals(userId);
      sendSuccess(res, data, 'Daftar riwayat penarikan dana kurir berhasil diambil');
    } catch (error: any) {
      sendError(res, error.message || 'Gagal mengambil riwayat penarikan dana', 500);
    }
  };
}

