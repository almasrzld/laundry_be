import { Request, Response } from 'express';
import { PaymentService } from './payment.service';
import { sendSuccess, sendError } from '../../utils/response.util';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';
import { CryptoUtil } from '../../utils/crypto.util';
import { ActivityLogMain } from '../activity-logs/activity-log.helper';

export class PaymentController {
  private paymentService: PaymentService;

  constructor(paymentService?: PaymentService) {
    this.paymentService = paymentService || new PaymentService();
  }

  /**
   * POST /api/payments/xendit/create
   */
  createPayment = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { order_id, payment_method, phone } = req.body;
      if (!order_id) {
        sendError(res, 'order_id wajib disertakan', 400);
        return;
      }

      const result = await this.paymentService.createPayment(order_id, payment_method, phone);
      ActivityLogMain(
        req,
        `Menyiapkan Pembayaran Pesanan #${result?.invoice_no || order_id} (${result?.payment_method || payment_method || 'Online'})`,
        req.body
      );
      sendSuccess(res, result, 'Pembayaran berhasil disiapkan', 201);
    } catch (error: any) {
      sendError(res, error.message || 'Gagal menyiapkan pembayaran digital', 400);
    }
  };

  /**
   * POST /api/payments/xendit/create-qr
   */
  createQrisPayment = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { order_id } = req.body;
      if (!order_id) {
        sendError(res, 'order_id wajib disertakan', 400);
        return;
      }

      const result = await this.paymentService.createQrisPayment(order_id);
      ActivityLogMain(
        req,
        `Membuat Dynamic QRIS Pembayaran Pesanan #${result?.invoice_no || order_id}`,
        req.body
      );
      sendSuccess(res, result, 'Dynamic QRIS berhasil dibuat', 201);
    } catch (error: any) {
      sendError(res, error.message || 'Gagal membuat Dynamic QRIS', 400);
    }
  };

  /**
   * POST /api/payments/xendit/create-topup-qr
   */
  createTopupQrisPayment = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { amount } = req.body;
      const userId = req.user?.id;
      if (!userId) {
        sendError(res, 'Pengguna belum terotentikasi', 401);
        return;
      }
      if (!amount || Number(amount) < 10000) {
        sendError(res, 'Minimal nominal pengisian saldo adalah Rp 10.000', 400);
        return;
      }

      const result = await this.paymentService.createTopupQrisPayment(userId, Number(amount));
      ActivityLogMain(
        req,
        `Membuat Dynamic QRIS Top-Up Saldo LaundryPay Sebesar Rp ${Number(amount).toLocaleString('id-ID')}`,
        req.body
      );
      sendSuccess(res, result, 'Dynamic QRIS Top-Up berhasil dibuat', 201);
    } catch (error: any) {
      sendError(res, error.message || 'Gagal membuat Dynamic QRIS Top-Up', 400);
    }
  };

  /**
   * POST /api/payments/xendit/simulate
   * Khusus pengujian sandbox & development
   */
  simulatePayment = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { order_id } = req.body;
      if (!order_id) {
        sendError(res, 'order_id wajib disertakan', 400);
        return;
      }

      const result = await this.paymentService.simulatePayment(order_id);
      ActivityLogMain(req, `Melakukan Simulasi Pembayaran Sandbox untuk Pesanan #${order_id}`, req.body);
      sendSuccess(res, result, 'Simulasi pembayaran Sandbox berhasil diproses');
    } catch (error: any) {
      sendError(res, error.message || 'Gagal melakukan simulasi pembayaran', 400);
    }
  };

  /**
   * GET /api/payments/xendit/status/:orderId
   */
  getPaymentStatus = async (req: Request, res: Response): Promise<void> => {
    try {
      const { orderId } = req.params;
      const result = await this.paymentService.getPaymentStatus(orderId);
      sendSuccess(res, result, 'Status pembayaran berhasil diambil');
    } catch (error: any) {
      sendError(res, error.message || 'Gagal memeriksa status pembayaran', 400);
    }
  };

  /**
   * POST /api/payments/proof
   * Upload Bukti Pembayaran Manual (JPG/JPEG/PNG) yang di-convert ke WebP <= 1MB
   */
  uploadPaymentProof = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const orderId = req.body.order_id;
      if (!orderId) {
        sendError(res, 'order_id wajib disertakan', 400);
        return;
      }

      if (!req.file) {
        sendError(res, 'File bukti pembayaran wajib diunggah', 400);
        return;
      }

      const userId = req.user?.id;
      const result = await this.paymentService.uploadPaymentProof(orderId, req.file, userId);
      ActivityLogMain(
        req,
        `Mengunggah Bukti Pembayaran Manual untuk Pesanan #${result?.invoice_no || orderId}`,
        { order_id: orderId, file_size_kb: result?.file_size_kb }
      );
      sendSuccess(res, result, 'Bukti pembayaran berhasil diunggah dan sedang diverifikasi admin', 201);
    } catch (error: any) {
      sendError(res, error.message || 'Gagal mengunggah bukti pembayaran', 400);
    }
  };

  /**
   * POST /api/payments/confirm
   * Konfirmasi manual pembayaran oleh Admin / Kasir
   */
  confirmManualPayment = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { order_id } = req.body;
      if (!order_id) {
        sendError(res, 'order_id wajib disertakan', 400);
        return;
      }

      const adminId = typeof req.user?.id === 'string'
        ? (CryptoUtil.decryptId(req.user.id) || parseInt(req.user.id, 10))
        : (req.user?.id || 1);
      const result = await this.paymentService.confirmManualPayment(order_id, adminId);
      ActivityLogMain(
        req,
        `Admin Mengonfirmasi Lunas Pembayaran Pesanan #${result?.invoice_no || order_id}`,
        { order_id, status: 'PAID' }
      );
      sendSuccess(res, result, 'Pembayaran berhasil dikonfirmasi Lunas');
    } catch (error: any) {
      sendError(res, error.message || 'Gagal mengonfirmasi pembayaran', 400);
    }
  };

  /**
   * POST /api/payments/pay-with-laundrypay
   * Bayar pesanan yang sudah ditimbang menggunakan Saldo LaundryPay
   */
  payWithLaundryPay = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { order_id } = req.body;
      const userId = req.user?.id;
      if (!order_id) {
        sendError(res, 'order_id wajib disertakan', 400);
        return;
      }

      const result = await this.paymentService.payWithLaundryPay(order_id, userId);
      ActivityLogMain(
        req,
        `Membayar Pesanan #${result?.invoice_no || order_id} Menggunakan Saldo LaundryPay`,
        { order_id, balance_after: result?.balance_after }
      );
      sendSuccess(res, result, 'Pembayaran dengan Saldo LaundryPay berhasil', 200);
    } catch (error: any) {
      sendError(res, error.message || 'Gagal memproses pembayaran Saldo LaundryPay', 400);
    }
  };

  /**
   * POST /api/payments/switch-method
   * Ganti metode pembayaran pesanan (misal ke Tunai / COD)
   */
  switchPaymentMethod = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { order_id, payment_method } = req.body;
      if (!order_id || !payment_method) {
        sendError(res, 'order_id dan payment_method wajib disertakan', 400);
        return;
      }

      const result = await this.paymentService.switchPaymentMethod(order_id, payment_method);
      ActivityLogMain(
        req,
        `Mengubah Metode Pembayaran Pesanan #${result?.invoice_no || order_id} Menjadi: ${payment_method}`,
        req.body
      );
      sendSuccess(res, result, 'Metode pembayaran pesanan berhasil diubah', 200);
    } catch (error: any) {
      sendError(res, error.message || 'Gagal mengubah metode pembayaran', 400);
    }
  };

  /**
   * POST /api/webhooks/xendit
   */
  handleWebhook = async (req: Request, res: Response): Promise<void> => {
    try {
      const token = req.headers['x-callback-token'] as string | undefined;
      const result = await this.paymentService.handleXenditWebhook(req.body, token);
      res.status(200).json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  };
}
