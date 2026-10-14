import { Response } from 'express';
import { UserService } from './user.service';
import { sendSuccess, sendError } from '../../utils/response.util';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';
import { getPicId } from '../../utils/user-code.util';
import { ActivityLogMain, ActivityLogSecondary } from '../activity-logs/activity-log.helper';

export class UserController {
  private userService: UserService;

  constructor(userService?: UserService) {
    this.userService = userService || new UserService();
  }

  getProfile = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        sendError(res, 'Sesi autentikasi tidak valid', 401);
        return;
      }
      const profile = await this.userService.getProfile(String(userId));
      if (!profile) {
        sendError(res, 'Profil tidak ditemukan', 404);
        return;
      }
      ActivityLogSecondary(req, 'Mengambil Data Profil Pengguna', []);
      sendSuccess(res, profile, 'Data profil berhasil diambil');
    } catch (error: any) {
      sendError(res, error.message || 'Gagal mengambil data profil', 500);
    }
  };

  getAddresses = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        sendError(res, 'Sesi autentikasi tidak valid', 401);
        return;
      }
      const addresses = await this.userService.getAddresses(String(userId));
      ActivityLogSecondary(req, 'Mengambil Daftar Alamat Pengguna', []);
      sendSuccess(res, addresses, 'Daftar alamat berhasil diambil');
    } catch (error: any) {
      sendError(res, error.message || 'Gagal mengambil daftar alamat', 500);
    }
  };

  addAddress = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        sendError(res, 'Sesi autentikasi tidak valid', 401);
        return;
      }
      const picId = getPicId(req);
      const newAddr = await this.userService.addAddress(String(userId), req.body, picId);
      ActivityLogMain(
        req,
        `Menambahkan Alamat Baru: ${req.body.address_label || req.body.address || 'Alamat Penjemputan'}`,
        req.body
      );
      sendSuccess(res, newAddr, 'Alamat penjemputan berhasil ditambahkan', 201);
    } catch (error: any) {
      sendError(res, error.message || 'Gagal menambahkan alamat', 400);
    }
  };

  updateAddress = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const addressId = req.params.id;
      const picId = getPicId(req);
      await this.userService.updateAddress(addressId, req.body, picId);
      ActivityLogMain(req, `Memperbarui Alamat ID ${addressId}`, req.body);
      sendSuccess(res, null, 'Alamat penjemputan berhasil diperbarui');
    } catch (error: any) {
      sendError(res, error.message || 'Gagal memperbarui alamat', 400);
    }
  };

  deleteAddress = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const addressId = req.params.id;
      const picId = getPicId(req);
      await this.userService.deleteAddress(addressId, picId);
      ActivityLogMain(req, `Menghapus Alamat ID ${addressId}`, { id: addressId });
      sendSuccess(res, null, 'Alamat berhasil dihapus');
    } catch (error: any) {
      sendError(res, error.message || 'Gagal menghapus alamat', 400);
    }
  };

  updateProfile = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        sendError(res, 'Sesi autentikasi tidak valid', 401);
        return;
      }
      const picId = getPicId(req);
      await this.userService.updateProfile(String(userId), req.body, picId);
      ActivityLogMain(req, 'Memperbarui Data Profil Akun', req.body);
      sendSuccess(res, null, 'Profil berhasil diperbarui');
    } catch (error: any) {
      sendError(res, error.message || 'Gagal memperbarui profil', 400);
    }
  };

  changePassword = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        sendError(res, 'Sesi autentikasi tidak valid', 401);
        return;
      }
      const { old_password, new_password, question_1, answer_1, question_2, answer_2 } = req.body;
      const picId = getPicId(req);

      const securityQuestions =
        question_1 && answer_1 && question_2 && answer_2
          ? { question_1, answer_1, question_2, answer_2 }
          : undefined;

      await this.userService.changePassword(String(userId), old_password, new_password, picId, securityQuestions);
      ActivityLogMain(req, 'Mengubah Password / Pertanyaan Keamanan Akun', []);
      sendSuccess(res, null, 'Password berhasil diperbarui');
    } catch (error: any) {
      sendError(res, error.message || 'Gagal memperbarui password', 400);
    }
  };

  getPointHistories = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        sendError(res, 'Sesi autentikasi tidak valid', 401);
        return;
      }
      const list = await this.userService.getPointHistories(String(userId));
      ActivityLogSecondary(req, 'Mengambil Riwayat Poin Reward', []);
      sendSuccess(res, list, 'Riwayat poin reward berhasil diambil');
    } catch (error: any) {
      sendError(res, error.message || 'Gagal mengambil riwayat poin', 400);
    }
  };

  redeemPoints = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        sendError(res, 'Sesi autentikasi tidak valid', 401);
        return;
      }
      const { points, code_voucher, code, title, subtitle, description, discount_amount, min_order_amount, promos_id } = req.body;
      const result = await this.userService.redeemPoints(String(userId), {
        points: Number(points),
        code_voucher: code_voucher || code,
        title,
        subtitle: subtitle || description,
        discount_amount: discount_amount ? Number(discount_amount) : undefined,
        min_order_amount: min_order_amount ? Number(min_order_amount) : undefined,
        promos_id,
      });
      ActivityLogMain(
        req,
        `Menukarkan ${Number(points)} Poin Reward untuk Voucher "${code_voucher || code || title}"`,
        req.body
      );
      sendSuccess(res, result, result.message);
    } catch (error: any) {
      sendError(res, error.message || 'Gagal menukarkan poin', 400);
    }
  };

  getUserVouchers = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        sendError(res, 'Sesi autentikasi tidak valid', 401);
        return;
      }
      const activeOnly = req.query.active_only === 'true' || req.query.status === 'active';
      const vouchers = await this.userService.getUserVouchers(String(userId), activeOnly);
      ActivityLogSecondary(req, 'Mengambil Daftar Voucher Milik Pengguna', [activeOnly]);
      sendSuccess(res, vouchers, 'Daftar voucher berhasil diambil');
    } catch (error: any) {
      sendError(res, error.message || 'Gagal mengambil daftar voucher', 500);
    }
  };

  verifyUserVoucher = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        sendError(res, 'Sesi autentikasi tidak valid', 401);
        return;
      }
      const code = (req.body.code || req.body.code_voucher || req.query.code) as string;
      const voucher = await this.userService.verifyUserVoucher(String(userId), code);
      ActivityLogSecondary(req, `Memverifikasi Voucher "${code}"`, { code });
      sendSuccess(res, voucher, 'Voucher valid & siap digunakan');
    } catch (error: any) {
      sendError(res, error.message || 'Kode voucher tidak valid atau belum Anda tukarkan.', 400);
    }
  };

  getWalletTransactions = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        sendError(res, 'Sesi autentikasi tidak valid', 401);
        return;
      }
      const limit = req.query.limit ? Number(req.query.limit) : 50;
      const list = await this.userService.getWalletTransactions(String(userId), limit);
      ActivityLogSecondary(req, 'Mengambil Riwayat Mutasi Saldo LaundryPay', [limit]);
      sendSuccess(res, list, 'Riwayat mutasi saldo LaundryPay berhasil diambil');
    } catch (error: any) {
      sendError(res, error.message || 'Gagal mengambil riwayat transaksi', 400);
    }
  };

  topupWallet = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        sendError(res, 'Sesi autentikasi tidak valid', 401);
        return;
      }
      const { amount, payment_method, notes } = req.body;
      const file = req.file;
      const result = await this.userService.topupWallet(
        String(userId),
        Number(amount),
        payment_method,
        notes,
        file
      );
      ActivityLogMain(
        req,
        `Mengajukan Top-Up Saldo LaundryPay Sebesar Rp ${Number(amount || 0).toLocaleString('id-ID')} (${payment_method || 'Transfer Bank'})`,
        { amount, payment_method, notes }
      );
      sendSuccess(res, result, 'Pengajuan pengisian saldo LaundryPay berhasil dikirim dan sedang menunggu verifikasi admin');
    } catch (error: any) {
      sendError(res, error.message || 'Gagal mengajukan top-up saldo', 400);
    }
  };
}



