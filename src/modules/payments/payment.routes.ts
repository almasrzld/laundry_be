import { Router } from 'express';
import { PaymentController } from './payment.controller';
import { authMiddleware } from '../../middleware/auth.middleware';
import { uploadPaymentProofMiddleware } from '../../middleware/upload.middleware';

const router = Router();
const controller = new PaymentController();

// Private Endpoints (Memerlukan Token Pengguna)
router.post('/proof', authMiddleware, uploadPaymentProofMiddleware, controller.uploadPaymentProof);
router.post('/confirm', authMiddleware, controller.confirmManualPayment);
router.get('/status/:orderId', authMiddleware, controller.getPaymentStatus);

// Xendit Endpoints
router.post('/xendit/create', authMiddleware, controller.createPayment);
router.post('/xendit/create-qr', authMiddleware, controller.createQrisPayment);
router.post('/xendit/simulate', authMiddleware, controller.simulatePayment);
router.get('/xendit/status/:orderId', authMiddleware, controller.getPaymentStatus);

// Public Webhook Endpoint (Untuk menerima notifikasi dari server Xendit)
router.post('/webhooks/xendit', controller.handleWebhook);

export default router;
