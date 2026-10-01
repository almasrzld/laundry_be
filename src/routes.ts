import { Router } from 'express';
import authRoutes from './modules/auth/auth.routes';
import serviceRoutes from './modules/services/service.routes';
import orderRoutes from './modules/orders/order.routes';
import promoRoutes from './modules/promos/promo.routes';
import userRoutes from './modules/user/user.routes';
import systemRoutes from './modules/system/system.routes';
import iconRoutes from './modules/icons/icon.routes';
import unitRoutes from './modules/units/unit.routes';
import serviceCategoryRoutes from './modules/service-categories/service-category.routes';
import perfumeRoutes from './modules/perfumes/perfume.routes';
import shelfTypeRoutes from './modules/shelf-types/shelf-type.routes';
import storageShelfRoutes from './modules/storage-shelves/storage-shelf.routes';
import paymentMethodRoutes from './modules/payment-methods/payment-method.routes';
import orderStatusRoutes from './modules/order-statuses/order-status.routes';
import notificationRoutes from './modules/notifications/notification.routes';
import courierRoutes from './modules/couriers/courier.routes';
import paymentRoutes from './modules/payments/payment.routes';
import ongkirRoutes from './modules/ongkirs/ongkir.routes';
import outletRoutes from './modules/outlets/outlet.routes';
import { sendSuccess } from './utils/response.util';

const apiRouter = Router();

// Health check endpoint
apiRouter.get('/health', (req, res) => {
  sendSuccess(res, {
    status: 'online',
    app: 'Almas Laundry REST API (Express TS)',
    timestamp: new Date().toISOString(),
  }, 'API Backend Almas Laundry is healthy and running');
});

// Modular Feature Routes (Standalone)
apiRouter.use('/auth', authRoutes);
apiRouter.use('/services', serviceRoutes);
apiRouter.use('/orders', orderRoutes);
apiRouter.use('/payments', paymentRoutes);
apiRouter.use('/webhooks/xendit', paymentRoutes);
apiRouter.use('/couriers', courierRoutes);
apiRouter.use('/notifications', notificationRoutes);
apiRouter.use('/promos', promoRoutes);
apiRouter.use('/user', userRoutes);
apiRouter.use('/system', systemRoutes);
apiRouter.use('/icons', iconRoutes);
apiRouter.use('/storage-shelves', storageShelfRoutes);
apiRouter.use('/shelves', storageShelfRoutes);
apiRouter.use('/ongkirs', ongkirRoutes);
apiRouter.use('/outlets', outletRoutes);

// Modular Master Data Routes
apiRouter.use('/master/icons', iconRoutes);
apiRouter.use('/master/units', unitRoutes);
apiRouter.use('/master/service-categories', serviceCategoryRoutes);
apiRouter.use('/master/perfumes', perfumeRoutes);
apiRouter.use('/master/shelf-types', shelfTypeRoutes);
apiRouter.use('/master/payment-methods', paymentMethodRoutes);
apiRouter.use('/master/order-statuses', orderStatusRoutes);
apiRouter.use('/master/ongkirs', ongkirRoutes);
apiRouter.use('/master/outlets', outletRoutes);

apiRouter.use('/units', unitRoutes);
apiRouter.use('/service-categories', serviceCategoryRoutes);
apiRouter.use('/perfumes', perfumeRoutes);
apiRouter.use('/shelf-types', shelfTypeRoutes);
apiRouter.use('/payment-methods', paymentMethodRoutes);
apiRouter.use('/order-statuses', orderStatusRoutes);

export default apiRouter;

