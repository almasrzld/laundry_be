import { Router } from 'express';
import { OutletController } from './outlet.controller';
import { authMiddleware } from '../../middleware/auth.middleware';

const router = Router();
const controller = new OutletController();

router.get('/', controller.getOutlets);
router.get('/:id', controller.getOutletById);
router.post('/', authMiddleware, controller.createOutlet);
router.put('/:id', authMiddleware, controller.updateOutlet);
router.delete('/:id', authMiddleware, controller.deleteOutlet);

export default router;
