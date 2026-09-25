import { Response } from 'express';
import { UserService } from './user.service';
import { sendSuccess, sendError } from '../../utils/response.util';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';
import { getPicId } from '../../utils/user-code.util';

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
      sendSuccess(res, newAddr, 'Alamat penjemputan berhasil ditambahkan', 201);
    } catch (error: any) {
      sendError(res, error.message || 'Gagal menambahkan alamat', 400);
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
      sendSuccess(res, null, 'Password berhasil diperbarui');
    } catch (error: any) {
      sendError(res, error.message || 'Gagal memperbarui password', 400);
    }
  };
}
