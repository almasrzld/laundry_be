import { Request, Response } from 'express';
import { OrderService } from './order.service';
import { sendSuccess, sendError } from '../../utils/response.util';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';
import { getPicId } from '../../utils/user-code.util';
import { CryptoUtil } from '../../utils/crypto.util';
import { isCustomerRole, isCourierRole } from '../../utils/role.util';

export class OrderController {
  private orderService: OrderService;

  constructor(orderService?: OrderService) {
    this.orderService = orderService || new OrderService();
  }

  getOrders = async (req: Request, res: Response): Promise<void> => {
    try {
      const type = req.query.type as 'active' | 'history' | undefined;
      const user = (req as AuthenticatedRequest).user;

      let targetUserId: string | number | undefined = undefined;

      if (user) {
        const roleCode = user.role_code || user.role || '';
        const isCustomer = await isCustomerRole(roleCode);
        const isCourier = await isCourierRole(roleCode);
        if (isCustomer || isCourier) {
          // Customer & Kurir hanya boleh melihat daftar pesanannya sendiri
          targetUserId = user.id;
        } else {
          // Staf / Admin dapat melihat semua pesanan atau menyaring berdasarkan user_id jika ada
          targetUserId = (req.query.user_id || req.query.users_id) as string | undefined;
        }
      } else {
        // Akses tanpa login tidak diizinkan melihat pesanan
        sendSuccess(res, [], 'Daftar pesanan kosong');
        return;
      }

      const orders = await this.orderService.getOrders(type, targetUserId);
      sendSuccess(res, orders, 'Daftar pesanan berhasil diambil');
    } catch (error: any) {
      sendError(res, error.message || 'Gagal mengambil daftar pesanan', 500);
    }
  };

  getOrderById = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const user = (req as AuthenticatedRequest).user;

      if (!user) {
        sendError(res, 'Akses tidak diizinkan, silakan login terlebih dahulu', 401);
        return;
      }

      const order = await this.orderService.getOrderById(id);
      if (!order) {
        sendError(res, 'Pesanan tidak ditemukan', 404);
        return;
      }

      const roleCode = user.role_code || user.role || '';
      const isCustomer = await isCustomerRole(roleCode);
      if (isCustomer) {
        const orderUserId = Number(order.users_id ?? (order.user_id ? CryptoUtil.decryptId(order.user_id) : null));
        const currentUserId = Number(CryptoUtil.decryptId(user.id) ?? user.id);
        if (orderUserId && currentUserId && orderUserId !== currentUserId) {
          sendError(res, 'Anda tidak memiliki akses ke pesanan ini', 403);
          return;
        }
      }

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
      const user = req.user;
      if (user) {
        const roleCode = user.role_code || user.role || '';
        const isCustomer = await isCustomerRole(roleCode);
        if (isCustomer) {
          const existingOrder = await this.orderService.getOrderById(id);
          const orderUserId = Number(existingOrder?.users_id ?? (existingOrder?.user_id ? CryptoUtil.decryptId(existingOrder.user_id) : null));
          const currentUserId = Number(CryptoUtil.decryptId(user.id) ?? user.id);
          if (orderUserId && currentUserId && orderUserId !== currentUserId) {
            sendError(res, 'Anda tidak memiliki hak untuk mengubah pesanan ini', 403);
            return;
          }
        }
      }

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

  submitRating = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { rating, review, tip_amount } = req.body;
      const numRating = Number(rating);
      if (!rating || isNaN(numRating) || numRating < 1 || numRating > 5) {
        sendError(res, 'Rating wajib bernilai antara 1 sampai 5 bintang', 400);
        return;
      }

      const numTip = tip_amount ? Math.max(0, Number(tip_amount)) : 0;
      const rawUserId = req.user?.id ?? (req.user as any)?.id_users;
      const decryptedUserId = rawUserId
        ? (CryptoUtil.decryptId(rawUserId) ?? (typeof rawUserId === 'number' ? rawUserId : parseInt(String(rawUserId), 10) || null))
        : null;

      if (!decryptedUserId) {
        sendError(res, 'Sesi autentikasi tidak valid atau pengguna tidak ditemukan', 401);
        return;
      }

      const success = await this.orderService.submitRating(id, {
        rating: numRating,
        review: review ? String(review).trim() : undefined,
        tip_amount: numTip,
        userId: Number(decryptedUserId),
      });

      sendSuccess(res, { success }, 'Terima kasih atas penilaian dan ulasan Anda!');
    } catch (error: any) {
      sendError(res, error.message || 'Gagal menyimpan ulasan pesanan', 400);
    }
  };
}
