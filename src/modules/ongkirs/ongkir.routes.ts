import { Router } from 'express';
import { OngkirController } from './ongkir.controller';
import { authMiddleware } from '../../middleware/auth.middleware';

const router = Router();
const controller = new OngkirController();

router.get('/', controller.getOngkirs);
router.get('/next-code', controller.getNextCode);
router.get('/preview-tiers', controller.getTiersPreview);
router.get('/calculate', controller.calculateOngkir);
router.post('/calculate', controller.calculateOngkir);
router.get('/:id', controller.getOngkirById);
router.post('/', authMiddleware, controller.createOngkir);
router.put('/:id', authMiddleware, controller.updateOngkir);
router.delete('/:id', authMiddleware, controller.deleteOngkir);

export default router;
