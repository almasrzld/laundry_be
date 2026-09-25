import { Router } from 'express';
import { AuthController } from './auth.controller';
import { authMiddleware } from '../../middleware/auth.middleware';

const router = Router();
const controller = new AuthController();

router.post('/login', controller.login);
router.post('/register', controller.register);
router.get('/me', authMiddleware, controller.me);

// Lupa Password via Pertanyaan Keamanan (Khusus Role Pelanggan)
router.post('/forgot-password/check', controller.checkForgotPassword);
router.post('/forgot-password/verify', controller.verifySecurityQuestions);
router.post('/forgot-password/reset', controller.resetPassword);

export default router;
