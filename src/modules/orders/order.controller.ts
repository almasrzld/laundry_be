import { Request, Response } from 'express';
import { OrderService } from './order.service';
import { sendSuccess, sendError } from '../../utils/response.util';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';
import { getPicId } from '../../utils/user-code.util';
import { CryptoUtil } from '../../utils/crypto.util';
import { isCustomerRole, isCourierRole } from '../../utils/role.util';
import { ActivityLogMain, ActivityLogSecondary } from '../activity-logs/activity-log.helper';

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

      ActivityLogSecondary(req, `Melihat Detail Pesanan #${order.invoice_no || id}`, [id]);
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
        delivery_fee,
        discount,
        voucher_code,
        points_redeemed,
        pickup_address,
        delivery_address,
        notes,
        order_statuses_id,
        status,
        payment_method,
        payment_method_code,
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
          quantity: (quantity !== undefined && quantity !== null && !isNaN(Number(quantity))) ? Number(quantity) : 0,
          unit: unit || 'kg',
          price_per_unit: parseInt(price_per_unit, 10),
          delivery_fee: delivery_fee !== undefined ? Number(delivery_fee) : 0,
          discount: discount !== undefined ? Number(discount) : 0,
          voucher_code: voucher_code ? String(voucher_code).trim() : undefined,
          points_redeemed: points_redeemed !== undefined ? Number(points_redeemed) : 0,
          payment_method: payment_method ? String(payment_method).trim() : undefined,
          payment_method_code: payment_method_code ? String(payment_method_code).trim() : undefined,
          pickup_address,
          delivery_address,
          notes,
          order_statuses_id,
          status,
        },
        picId
      );

      ActivityLogMain(req, `Membuat Pesanan Laundry #${newOrder?.invoice_no || ''} (${service_name})`, req.body);
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

      const existingOrder = await this.orderService.getOrderById(id).catch(() => null);

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

      const invoiceNo = updated?.invoice_no || existingOrder?.invoice_no || id;
      let loggedSpecificAction = false;

      // 1. Catat log Penimbangan (Weighing) jika berat dimasukkan / diubah
      const oldQty = Number(existingOrder?.quantity) || 0;
      const newQty = quantity !== undefined ? parseFloat(quantity) : Number(updated?.quantity) || 0;
      if (newQty > 0 && (oldQty <= 0 || newQty !== oldQty)) {
        const grandTotal = Math.max(
          0,
          (newQty * Number(updated.price_per_unit || existingOrder?.price_per_unit || 0)) +
            Number(updated.delivery_fee || existingOrder?.delivery_fee || 0) -
            Number(updated.discount || existingOrder?.discount || 0)
        );
        ActivityLogMain(
          req,
          `Menimbang Cucian Pesanan #${invoiceNo}: ${newQty} ${updated.unit || unit || 'kg'} (Total Rp ${grandTotal.toLocaleString('id-ID')})`,
          {
            invoice_no: invoiceNo,
            quantity: newQty,
            unit: updated.unit || unit || 'kg',
            grand_total: grandTotal,
          }
        );
        loggedSpecificAction = true;
      }

      // 2. Catat log Penugasan Kurir jika kurir dipilih / diubah
      const oldCourier = (existingOrder?.courier_name || '').trim();
      const newCourier = (courier_name !== undefined ? courier_name : updated?.courier_name || '').trim();
      if (newCourier && newCourier !== oldCourier) {
        ActivityLogMain(
          req,
          `Menugaskan Kurir "${newCourier}" untuk Pesanan #${invoiceNo}`,
          {
            invoice_no: invoiceNo,
            courier_name: newCourier,
            courier_phone: courier_phone || updated.courier_phone || '',
          }
        );
        loggedSpecificAction = true;
      }

      // 3. Catat log Perubahan Status Cucian jika status berubah
      const oldStatus = (existingOrder?.status || '').trim();
      const newStatus = (updated?.status || status || '').trim();
      if (newStatus && newStatus.toLowerCase() !== oldStatus.toLowerCase()) {
        ActivityLogMain(
          req,
          `Mengubah Status Pesanan #${invoiceNo} Menjadi: ${newStatus}`,
          {
            invoice_no: invoiceNo,
            old_status: oldStatus,
            new_status: newStatus,
          }
        );
        loggedSpecificAction = true;
      }

      // 4. Jika bukan salah satu tindakan spesifik di atas, catat log pembaruan umum
      if (!loggedSpecificAction) {
        ActivityLogMain(req, `Memperbarui Data Pesanan #${invoiceNo}`, req.body);
      }

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

      const existingOrder = await this.orderService.getOrderById(id).catch(() => null);
      const invoiceNo = existingOrder?.invoice_no || id;

      const picId = getPicId(req);
      const result = await this.orderService.updateOrderStatus(id, targetStatus, picId || undefined);

      const updatedOrder = await this.orderService.getOrderById(id).catch(() => null);
      const statusLabel = updatedOrder?.status || status || String(targetStatus);

      ActivityLogMain(
        req,
        `Mengubah Status Pesanan #${invoiceNo} Menjadi: ${statusLabel}`,
        {
          invoice_no: invoiceNo,
          old_status: existingOrder?.status,
          new_status: statusLabel,
          order_statuses_id: updatedOrder?.order_statuses_id || order_statuses_id,
        }
      );

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

      const ratedOrder = await this.orderService.getOrderById(id).catch(() => null);
      const invoiceNo = ratedOrder?.invoice_no || (CryptoUtil.decryptId(id) ? `#${CryptoUtil.decryptId(id)}` : id);

      ActivityLogMain(req, `Memberikan Ulasan Bintang ${numRating} untuk Pesanan #${invoiceNo}`, { invoice_no: invoiceNo, rating: numRating, review, tip_amount: numTip });
      sendSuccess(res, { success }, 'Terima kasih atas penilaian dan ulasan Anda!');
    } catch (error: any) {
      sendError(res, error.message || 'Gagal menyimpan ulasan pesanan', 400);
    }
  };

  applyPromo = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { code } = req.body;
      const user = req.user;
      if (!user) {
        sendError(res, 'Sesi autentikasi tidak valid', 401);
        return;
      }
      if (!code || !String(code).trim()) {
        sendError(res, 'Kode promo / voucher wajib diisi', 400);
        return;
      }
      const updatedOrder = await this.orderService.applyPromo(id, String(code).trim(), user.id);
      const invoiceNo = updatedOrder?.invoice_no || (CryptoUtil.decryptId(id) ? `#${CryptoUtil.decryptId(id)}` : id);
      ActivityLogSecondary(req, `Menggunakan Voucher Promo "${code}" pada Pesanan #${invoiceNo}`, { invoice_no: invoiceNo, code });
      sendSuccess(res, updatedOrder, 'Promo voucher berhasil dipasang ke pesanan');
    } catch (error: any) {
      sendError(res, error.message || 'Gagal memasang voucher promo', 400);
    }
  };

  removePromo = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const user = req.user;
      if (!user) {
        sendError(res, 'Sesi autentikasi tidak valid', 401);
        return;
      }
      const updatedOrder = await this.orderService.removePromo(id, user.id);
      const invoiceNo = updatedOrder?.invoice_no || (CryptoUtil.decryptId(id) ? `#${CryptoUtil.decryptId(id)}` : id);
      ActivityLogSecondary(req, `Menghapus Voucher Promo dari Pesanan #${invoiceNo}`, { invoice_no: invoiceNo });
      sendSuccess(res, updatedOrder, 'Promo voucher berhasil dihapus dari pesanan');
    } catch (error: any) {
      sendError(res, error.message || 'Gagal menghapus voucher promo', 400);
    }
  };
}
