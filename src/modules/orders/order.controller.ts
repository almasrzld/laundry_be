import { Request, Response } from 'express';
import { OrderService } from './order.service';
import { sendSuccess, sendError } from '../../utils/response.util';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';
import { getPicId } from '../../utils/user-code.util';

export class OrderController {
  private orderService: OrderService;

  constructor(orderService?: OrderService) {
    this.orderService = orderService || new OrderService();
  }

  getOrders = async (req: Request, res: Response): Promise<void> => {
    try {
      const type = req.query.type as 'active' | 'history' | undefined;
      const orders = await this.orderService.getOrders(type);
      sendSuccess(res, orders, 'Daftar pesanan berhasil diambil');
    } catch (error: any) {
      sendError(res, error.message || 'Gagal mengambil daftar pesanan', 500);
    }
  };

  getOrderById = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const order = await this.orderService.getOrderById(id);
      sendSuccess(res, order, 'Detail pesanan berhasil diambil');
    } catch (error: any) {
      sendError(res, error.message || 'Pesanan tidak ditemukan', 404);
    }
  };

  createOrder = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const {
        service_name,
        service_type,
        quantity,
        unit,
        price_per_unit,
        pickup_address,
        delivery_address,
        notes,
        order_statuses_id,
        status,
      } = req.body;

      if (!service_name || !price_per_unit || !pickup_address) {
        sendError(res, 'Layanan, harga, dan alamat penjemputan wajib diisi', 400);
        return;
      }

      const userId = req.user?.id;
      if (!userId) {
        sendError(res, 'Sesi autentikasi tidak valid', 401);
        return;
      }

      const picId = getPicId(req);
      const newOrder = await this.orderService.createOrder(
        {
          user_id: String(userId),
          service_name,
          service_type,
          quantity: parseFloat(quantity) || 1.0,
          unit: unit || 'kg',
          price_per_unit: parseInt(price_per_unit, 10),
          pickup_address,
          delivery_address,
          notes,
          order_statuses_id,
          status,
        },
        picId
      );

      sendSuccess(res, newOrder, 'Pesanan laundry berhasil dibuat dan dijadwalkan', 201);
    } catch (error: any) {
      sendError(res, error.message || 'Gagal membuat pesanan', 400);
    }
  };

  updateOrder = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const {
        service_name,
        service_type,
        quantity,
        unit,
        price_per_unit,
        pickup_address,
        delivery_address,
        courier_name,
        courier_phone,
        notes,
        status,
        order_statuses_id,
      } = req.body;

      const picId = getPicId(req);
      const updated = await this.orderService.updateOrder(
        id,
        {
          service_name,
          service_type,
          quantity: quantity !== undefined ? parseFloat(quantity) : undefined,
          unit,
          price_per_unit: price_per_unit !== undefined ? parseInt(price_per_unit, 10) : undefined,
          pickup_address,
          delivery_address,
          courier_name,
          courier_phone,
          notes,
          status,
          order_statuses_id,
        },
        picId || undefined
      );

      sendSuccess(res, updated, 'Data pesanan berhasil diperbarui');
    } catch (error: any) {
      sendError(res, error.message || 'Gagal memperbarui data pesanan', 400);
    }
  };

  updateStatus = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { status, order_statuses_id } = req.body;
      const targetStatus = order_statuses_id || status;
      if (!targetStatus) {
        sendError(res, 'Status baru wajib disertakan', 400);
        return;
      }

      const picId = getPicId(req);
      const result = await this.orderService.updateOrderStatus(id, targetStatus, picId || undefined);
      sendSuccess(res, result, 'Status pesanan berhasil diperbarui');
    } catch (error: any) {
      sendError(res, error.message || 'Gagal memperbarui status pesanan', 400);
    }
  };
}
