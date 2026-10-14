import { Request, Response } from 'express';
import { CourierService } from './courier.service';
import { sendSuccess, sendError } from '../../utils/response.util';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';
import { isCourierRole, isAdminOrStaffRole } from '../../utils/role.util';
import { CryptoUtil } from '../../utils/crypto.util';
import { ActivityLogMain } from '../activity-logs/activity-log.helper';
import { query } from '../../config/database';

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

  private async resolveAuthUser(req: Request): Promise<{
    userId: number | null;
    userName: string | null;
    userPhone: string | null;
    roleCode: string | null;
    isCourier: boolean;
    isAdmin: boolean;
    balance: number;
  }> {
    const user = (req as AuthenticatedRequest).user as any;
    if (!user) {
      return {
        userId: null,
        userName: null,
        userPhone: null,
        roleCode: null,
        isCourier: false,
        isAdmin: false,
        balance: 0,
      };
    }

    const userId = resolveNumericUserId(user);
    let userName = user.name || user.name_users || null;
    let userPhone = user.phone || null;
    let roleCode = user.role_code || user.role || null;
    let balance = 0;

    // Ambil data user terkini dari database
    if (userId) {
      const dbUsers = await query<any>(
        'SELECT id_users, name_users, phone, role_code, laundry_pay_balance FROM users WHERE id_users = ? AND deleted_at IS NULL LIMIT 1',
        [userId]
      );
      if (dbUsers && dbUsers.length > 0) {
        userName = dbUsers[0].name_users || userName;
        userPhone = dbUsers[0].phone || userPhone;
        roleCode = dbUsers[0].role_code || roleCode;
        balance = Number(dbUsers[0].laundry_pay_balance) || 0;
      }
    }

    const isCourier = await isCourierRole(roleCode);
    const isAdmin = await isAdminOrStaffRole(roleCode);

    return { userId, userName, userPhone, roleCode, isCourier, isAdmin, balance };
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
      const auth = await this.resolveAuthUser(req);
      let courierName = (req.query.courier_name as string) || null;
      let courierPhone = (req.query.courier_phone as string) || null;
      let userId: number | null = null;
      let isPersonalView = false;

      if (auth.isCourier) {
        // Kurir: hanya melihat ringkasan tugas, tips, dan saldo miliknya sendiri
        courierName = auth.userName;
        courierPhone = auth.userPhone;
        userId = auth.userId;
        isPersonalView = true;
      } else if (!courierName && !courierPhone) {
        // Pengguna non-kurir (misal admin/customer di mobile app) yang membuka halaman ringkasan personal
        isPersonalView = true;
        userId = auth.userId;
      }

      const summary = await this.courierService.getCourierSummary({
        courierName,
        courierPhone,
        userId,
        isPersonalView,
      });
      sendSuccess(res, summary, 'Ringkasan kurir dan tips berhasil diambil');
    } catch (error: any) {
      sendError(res, error.message || 'Gagal mengambil ringkasan kurir', 500);
    }
  };

  getCourierTasks = async (req: Request, res: Response): Promise<void> => {
    try {
      const auth = await this.resolveAuthUser(req);
      const statusFilter = req.query.status as 'active' | 'history' | 'all' | undefined;

      let courierName = (req.query.courier_name as string) || null;
      let courierPhone = (req.query.courier_phone as string) || null;
      let isPersonalView = false;

      if (auth.isCourier) {
        // Kurir: hanya melihat daftar tugas miliknya sendiri
        courierName = auth.userName;
        courierPhone = auth.userPhone;
        isPersonalView = true;
      } else if (!courierName && !courierPhone) {
        // Pengguna non-kurir di mobile app: tidak boleh melihat tugas kurir lain
        isPersonalView = true;
      }

      const tasks = await this.courierService.getCourierTasks({
        courierName,
        courierPhone,
        statusFilter: statusFilter || 'all',
        isPersonalView,
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
      const auth = await this.resolveAuthUser(req);

      if (!status) {
        sendError(res, 'Status baru harus diisi', 400);
        return;
      }

      const result = await this.courierService.updateTaskStatus(
        id,
        status,
        auth.userId || undefined,
        auth.isCourier ? { id_users: auth.userId, name: auth.userName, phone: auth.userPhone } : undefined
      );

      const courierName = auth.userName || 'Kurir';
      const decTaskId = CryptoUtil.decryptId(id);
      ActivityLogMain(
        req,
        `Kurir (${courierName}) Mengubah Status Tugas Pengantaran/Penjemputan ID ${decTaskId || id} Menjadi: ${status}`,
        { task_id: decTaskId || id, status, courier_name: courierName }
      );

      sendSuccess(res, result, 'Status tugas kurir berhasil diperbarui');
    } catch (error: any) {
      sendError(res, error.message || 'Gagal memperbarui status tugas kurir', 400);
    }
  };

  getCourierTransactions = async (req: Request, res: Response): Promise<void> => {
    try {
      const auth = await this.resolveAuthUser(req);
      let courierName = (req.query.courier_name as string) || null;
      let courierPhone = (req.query.courier_phone as string) || null;
      let userId: number | null = null;
      const category = (req.query.category as string) || null;
      const limit = req.query.limit ? Number(req.query.limit) : undefined;

      if (auth.isCourier) {
        courierName = auth.userName;
        courierPhone = auth.userPhone;
        userId = auth.userId;
      } else if (auth.userId) {
        userId = auth.userId;
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
      const auth = await this.resolveAuthUser(req);
      if (!auth.userId) {
        sendError(res, 'Sesi login tidak valid. Silakan login kembali.', 401);
        return;
      }

      const { amount, bank_name, account_number, account_name, notes } = req.body;

      if (!amount || Number(amount) < 10000) {
        sendError(res, 'Minimal penarikan dana adalah Rp 10.000', 400);
        return;
      }

      if (auth.balance < Number(amount)) {
        sendError(
          res,
          `Saldo LaundryPay Anda tidak mencukupi (Saldo: Rp ${auth.balance.toLocaleString('id-ID')}).`,
          400
        );
        return;
      }

      if (!bank_name || !account_number || !account_name) {
        sendError(res, 'Nama bank, nomor rekening, dan nama pemilik rekening wajib diisi', 400);
        return;
      }

      const result = await this.courierService.requestWithdrawal(
        auth.userId,
        Number(amount),
        bank_name,
        account_number,
        account_name,
        notes,
      );

      ActivityLogMain(
        req,
        `Kurir (${auth.userName || 'Kurir'}) Mengajukan Penarikan Dana Rp ${Number(amount).toLocaleString('id-ID')} ke Rekening ${bank_name} (${account_number} a.n ${account_name})`,
        { amount: Number(amount), bank_name, account_number, account_name, notes }
      );

      sendSuccess(res, result, 'Permintaan penarikan dana berhasil diajukan dan sedang diproses admin', 201);
    } catch (error: any) {
      sendError(res, error.message || 'Gagal mengajukan penarikan dana', 400);
    }
  };

  getCourierWithdrawals = async (req: Request, res: Response): Promise<void> => {
    try {
      const auth = await this.resolveAuthUser(req);
      if (!auth.userId) {
        sendError(res, 'Sesi login tidak valid. Silakan login kembali.', 401);
        return;
      }

      const data = await this.courierService.getCourierWithdrawals(auth.userId);
      sendSuccess(res, data, 'Daftar riwayat penarikan dana kurir berhasil diambil');
    } catch (error: any) {
      sendError(res, error.message || 'Gagal mengambil riwayat penarikan dana', 500);
    }
  };
}

