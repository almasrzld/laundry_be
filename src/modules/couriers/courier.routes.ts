import { Router } from 'express';
import { CourierController } from './courier.controller';
import { authMiddleware, optionalAuthMiddleware } from '../../middleware/auth.middleware';

const courierRoutes = Router();
const courierController = new CourierController();

courierRoutes.get('/', optionalAuthMiddleware, courierController.getCouriers);
courierRoutes.get('/summary', optionalAuthMiddleware, courierController.getCourierSummary);
courierRoutes.get('/tasks', optionalAuthMiddleware, courierController.getCourierTasks);
courierRoutes.get('/transactions', optionalAuthMiddleware, courierController.getCourierTransactions);
courierRoutes.patch('/tasks/:id/status', authMiddleware, courierController.updateTaskStatus);

export default courierRoutes;
