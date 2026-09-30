import { Request, Response } from 'express';
import { PaymentService } from './payment.service';
import { sendSuccess, sendError } from '../../utils/response.util';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';
import { CryptoUtil } from '../../utils/crypto.util';

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
      sendSuccess(res, result, 'Pembayaran Xendit berhasil disiapkan', 201);
    } catch (error: any) {
      sendError(res, error.message || 'Gagal membuat pembayaran Xendit', 400);
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
      sendSuccess(res, result, 'Dynamic QRIS Xendit berhasil dibuat', 201);
    } catch (error: any) {
      sendError(res, error.message || 'Gagal membuat Dynamic QRIS Xendit', 400);
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
      sendSuccess(res, result, 'Pembayaran berhasil dikonfirmasi Lunas');
    } catch (error: any) {
      sendError(res, error.message || 'Gagal mengonfirmasi pembayaran', 400);
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
