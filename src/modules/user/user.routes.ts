import { Router } from 'express';
import { UserController } from './user.controller';
import { authMiddleware } from '../../middleware/auth.middleware';

const router = Router();
const controller = new UserController();

router.get('/profile', authMiddleware, controller.getProfile);
router.put('/profile', authMiddleware, controller.updateProfile);
router.put('/change-password', authMiddleware, controller.changePassword);
router.get('/addresses', authMiddleware, controller.getAddresses);
router.post('/addresses', authMiddleware, controller.addAddress);
router.put('/addresses/:id', authMiddleware, controller.updateAddress);
router.delete('/addresses/:id', authMiddleware, controller.deleteAddress);

export default router;
