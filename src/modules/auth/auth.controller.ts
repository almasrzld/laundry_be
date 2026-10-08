import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { sendSuccess, sendError } from '../../utils/response.util';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';
import { ActivityLogMain, ActivityLogSecondary } from '../activity-logs/activity-log.helper';

export class AuthController {
  private authService: AuthService;

  constructor(authService?: AuthService) {
    this.authService = authService || new AuthService();
  }

  login = async (req: Request, res: Response): Promise<void> => {
    try {
      const { email, password } = req.body;
      if (!email) {
        sendError(res, 'Email wajib diisi', 400);
        return;
      }

      const result = await this.authService.login(email, password);
      (req as any).user = result.user;
      ActivityLogMain(req, `User ${result.user?.name || email} Berhasil Masuk (Login)`, {
        user_id: result.user?.id,
        email: result.user?.email,
        role: result.user?.role_code || (result.user as any)?.role,
      });
      sendSuccess(res, result, 'Login berhasil');
    } catch (error: any) {
      ActivityLogSecondary(req, `Percobaan Login Gagal untuk email: ${req.body?.email}`, { error: error.message });
      const statusCode = error.statusCode || 400;
      sendError(res, error.message || 'Gagal melakukan login', statusCode, error.errorPayload);
    }
  };

  register = async (req: Request, res: Response): Promise<void> => {
    try {
      const { name, email, phone, password } = req.body;
      if (!name || !email || !phone) {
        sendError(res, 'Nama, email, dan nomor telepon wajib diisi', 400);
        return;
      }

      const result = await this.authService.register({ name, email, phone, password });
      (req as any).user = result.user;
      ActivityLogMain(req, `Pendaftaran Akun Baru: ${name} (${email})`, { email, phone });
      sendSuccess(res, result, 'Pendaftaran akun berhasil', 201);
    } catch (error: any) {
      sendError(res, error.message || 'Gagal melakukan pendaftaran', 400);
    }
  };

  me = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        sendError(res, 'Sesi tidak valid', 401);
        return;
      }

      const user = await this.authService.getMe(String(userId));
      if (!user) {
        sendError(res, 'Pengguna tidak ditemukan', 404);
        return;
      }

      sendSuccess(res, user, 'Data profil berhasil diambil');
    } catch (error: any) {
      sendError(res, error.message || 'Gagal mengambil data profil', 500);
    }
  };

  logout = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      ActivityLogMain(req, `User ${req.user?.name || 'Pengguna'} Keluar dari Sistem (Logout)`, []);
      if (userId) {
        await this.authService.logout(String(userId));
      }
      sendSuccess(res, null, 'Logout berhasil');
    } catch (error: any) {
      sendError(res, error.message || 'Gagal logout', 500);
    }
  };

  checkForgotPassword = async (req: Request, res: Response): Promise<void> => {
    try {
      const { identifier } = req.body;
      ActivityLogSecondary(req, `Permintaan Lupa Password untuk identitas: ${identifier}`, []);
      const result = await this.authService.initForgotPassword(identifier);
      sendSuccess(res, result, 'Identitas pengguna ditemukan');
    } catch (error: any) {
      sendError(res, error.message || 'Gagal memeriksa identitas pengguna', 400);
    }
  };

  verifySecurityQuestions = async (req: Request, res: Response): Promise<void> => {
    try {
      const { session_token, answer_1, answer_2 } = req.body;
      const result = await this.authService.verifySecurityQuestions(session_token, answer_1, answer_2);
      ActivityLogSecondary(req, 'Verifikasi Pertanyaan Keamanan Berhasil', []);
      sendSuccess(res, result, 'Verifikasi pertanyaan keamanan berhasil');
    } catch (error: any) {
      sendError(res, error.message || 'Gagal memverifikasi pertanyaan keamanan', 400);
    }
  };

  resetPassword = async (req: Request, res: Response): Promise<void> => {
    try {
      const { reset_token, new_password } = req.body;
      const result = await this.authService.resetPasswordWithToken(reset_token, new_password);
      ActivityLogMain(req, 'Reset Password Berhasil', []);
      sendSuccess(res, result, 'Kata sandi berhasil direset');
    } catch (error: any) {
      sendError(res, error.message || 'Gagal mereset kata sandi', 400);
    }
  };
}

