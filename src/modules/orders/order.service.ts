import { OrderRepository, OrderEntity, TimelineStepEntity } from './order.repository';
import { CryptoUtil } from '../../utils/crypto.util';
import { InvoiceGeneratorUtil } from '../../utils/invoice-generator.util';
import { NotificationService } from '../notifications/notification.service';
import { UserRepository } from '../user/user.repository';

export class OrderService {
  private orderRepository: OrderRepository;
  private notificationService: NotificationService;

  constructor(orderRepository?: OrderRepository, notificationService?: NotificationService) {
    this.orderRepository = orderRepository || new OrderRepository();
    this.notificationService = notificationService || new NotificationService();
  }

  private formatTimeline(t: TimelineStepEntity): TimelineStepEntity {
    const rawId = Number(t.id_order_timelines ?? t.id);
    const rawOrderId = Number(t.orders_id ?? t.order_id);
    const rawStatusId = t.order_statuses_id ? Number(t.order_statuses_id) : null;
    return {
      ...t,
      id_order_timelines: rawId,
      id: CryptoUtil.encryptId(rawId) ?? String(rawId),
      orders_id: rawOrderId,
      order_id: CryptoUtil.encryptId(rawOrderId) ?? String(rawOrderId),
      order_statuses_id: rawStatusId,
      status_id: rawStatusId ? (CryptoUtil.encryptId(rawStatusId) ?? String(rawStatusId)) : null,
    };
  }

  private formatOrder(o: OrderEntity): OrderEntity & {
    status_id?: string | null;
    order_status?: {
      id: string;
      name: string;
      code: string;
      step_order: number;
      color_hex?: string | null;
      badge_variant?: string | null;
    } | null;
  } {
    const rawId = Number(o.id_orders ?? o.id);
    const rawUserId = o.users_id || o.user_id ? Number(o.users_id ?? o.user_id) : null;
    const rawStatusId = o.order_statuses_id ? Number(o.order_statuses_id) : null;

    const encryptedStatusId = rawStatusId ? (CryptoUtil.encryptId(rawStatusId) ?? String(rawStatusId)) : null;

    const orderStatusObj = rawStatusId
      ? {
          id: encryptedStatusId || String(rawStatusId),
          name: o.status_name || o.status,
          code: o.status_code || '',
          step_order: o.status_step_order || 1,
          color_hex: o.status_color_hex || '#0284c7',
          badge_variant: o.status_badge_variant || 'info',
        }
      : null;

    return {
      ...o,
      id_orders: rawId,
      id: CryptoUtil.encryptId(rawId) ?? String(rawId),
      users_id: rawUserId ?? undefined,
      user_id: rawUserId ? (CryptoUtil.encryptId(rawUserId) ?? String(rawUserId)) : undefined,
      order_statuses_id: rawStatusId,
      status_id: encryptedStatusId,
      status: o.status_name || o.status,
      order_status: orderStatusObj,
      timeline: o.timeline ? o.timeline.map((t) => this.formatTimeline(t)) : [],
    };
  }

  async getOrders(filter?: 'active' | 'history', userId?: string | number): Promise<OrderEntity[]> {
    const list = await this.orderRepository.findAll(filter, userId);
    return list.map((o) => this.formatOrder(o));
  }

  async getOrderById(id: string): Promise<OrderEntity | null> {
    const order = await this.orderRepository.findById(id);
    if (!order) {
      throw new Error('Pesanan laundry tidak ditemukan');
    }
    return this.formatOrder(order);
  }

  async createOrder(
    data: {
      user_id?: string;
      users_id?: string | number;
      service_name: string;
      service_type?: string;
      order_statuses_id?: string | number;
      status?: string;
      quantity: number;
      unit?: string;
      price_per_unit: number;
      delivery_fee?: number;
      discount?: number;
      pickup_address: string;
      delivery_address?: string;
      courier_name?: string;
      courier_phone?: string;
      notes?: string;
      order_date?: string | Date;
      estimated_completion_date?: string | Date;
    },
    creatorPic?: number | null
  ): Promise<OrderEntity> {
    const now = new Date(data.order_date || Date.now());
    const invoiceNo = await InvoiceGeneratorUtil.generateInvoiceNo({ date: now });
    const rawUserId = data.users_id || data.user_id;

    const newOrder: OrderEntity = {
      invoice_no: invoiceNo,
      users_id: rawUserId,
      user_id: rawUserId,
      service_name: data.service_name,
      service_type: data.service_type || 'Kiloan',
      order_date: now.toISOString(),
      estimated_completion_date: data.estimated_completion_date
        ? new Date(data.estimated_completion_date).toISOString()
        : new Date(now.getTime() + 48 * 3600 * 1000).toISOString(),
      status: data.status || '',
      order_statuses_id: data.order_statuses_id || null,
      quantity: Number(data.quantity) || 1.0,
      unit: data.unit || 'kg',
      price_per_unit: Number(data.price_per_unit) || 0,
      delivery_fee: Number(data.delivery_fee) || 0,
      discount: Number(data.discount) || 0,
      pickup_address: data.pickup_address,
      delivery_address: data.delivery_address || data.pickup_address,
      courier_name: data.courier_name || '',
      courier_phone: data.courier_phone || '',
      notes: data.notes || '',
    };

    const created = await this.orderRepository.create(newOrder, creatorPic || undefined);

    // 1. Trigger Notifikasi: Pesanan Baru Masuk (Ditujukan ke Admin & Kasir)
    try {
      await this.notificationService.notifyOrderCreated({
        id_orders: Number(created.id_orders || created.id),
        invoice_no: created.invoice_no,
        service_name: created.service_name,
        users_id: created.users_id,
        pickup_address: created.pickup_address,
      }, creatorPic || null);
    } catch (notifErr) {
      console.warn('[Notification Warning] Gagal membuat notifikasi pesanan baru:', notifErr);
    }

    return this.formatOrder(created);
  }

  async updateOrder(
    id: string,
    data: Partial<OrderEntity> & { courier_user_id?: string | number; courier_users_id?: string | number },
    updatePic?: number
  ): Promise<OrderEntity> {
    const existingOrder = await this.orderRepository.findById(id);
    const updated = await this.orderRepository.updateOrder(id, data, updatePic);
    if (!updated) {
      throw new Error('Pesanan tidak ditemukan atau gagal diperbarui');
    }

    // 2. Trigger Notifikasi: Penugasan Kurir (Ke Pelanggan & Kurir)
    try {
      const isCourierAssigned =
        Boolean(data.courier_name && data.courier_name.trim().length > 0) &&
        (existingOrder?.courier_name !== data.courier_name || existingOrder?.courier_phone !== data.courier_phone);

      if (isCourierAssigned) {
        await this.notificationService.notifyCourierAssigned({
          order: updated,
          courierName: data.courier_name!,
          courierPhone: data.courier_phone,
          courierUserId: data.courier_users_id || data.courier_user_id || null,
          creatorPic: updatePic || null,
        });
      }
    } catch (notifErr) {
      console.warn('[Notification Warning] Gagal membuat notifikasi penugasan kurir:', notifErr);
    }

    // 3. Trigger Notifikasi: Status Cucian Selesai / Siap Diantar (Ke Pelanggan)
    try {
      const newStatus = updated.status || '';
      const oldStatus = existingOrder?.status || '';
      const isReadyOrCompleted =
        newStatus.toLowerCase().includes('siap diantar') ||
        newStatus.toLowerCase().includes('selesai') ||
        newStatus.toLowerCase().includes('antar');

      if (isReadyOrCompleted && newStatus !== oldStatus) {
        await this.notificationService.notifyOrderStatusReady({
          order: updated,
          statusName: newStatus,
          creatorPic: updatePic || null,
        });
      }
    } catch (notifErr) {
      console.warn('[Notification Warning] Gagal membuat notifikasi status siap/selesai:', notifErr);
    }

    // 4. Trigger Reward Points: Otomatis jika status Pesanan Selesai
    await this.awardRewardPointsIfCompleted(updated, existingOrder?.status);

    return this.formatOrder(updated);
  }

  async updateOrderStatus(
    id: string,
    newStatusOrId: string | number,
    updatePic?: number
  ): Promise<{ success: boolean; message: string }> {
    const existingOrder = await this.orderRepository.findById(id);
    const success = await this.orderRepository.updateStatus(id, newStatusOrId, updatePic);
    if (!success) {
      throw new Error('Gagal memperbarui status pesanan');
    }

    // 3. Trigger Notifikasi: Status Cucian Selesai / Siap Diantar (Ke Pelanggan)
    try {
      const updatedOrder = await this.orderRepository.findById(id);
      if (updatedOrder) {
        const newStatus = updatedOrder.status || '';
        const oldStatus = existingOrder?.status || '';
        const isReadyOrCompleted =
          newStatus.toLowerCase().includes('siap diantar') ||
          newStatus.toLowerCase().includes('selesai') ||
          newStatus.toLowerCase().includes('antar');

        if (isReadyOrCompleted && newStatus !== oldStatus) {
          await this.notificationService.notifyOrderStatusReady({
            order: updatedOrder,
            statusName: newStatus,
            creatorPic: updatePic || null,
          });
        }

        // 4. Trigger Reward Points: Otomatis jika status Pesanan Selesai
        await this.awardRewardPointsIfCompleted(updatedOrder, existingOrder?.status);
      }
    } catch (notifErr) {
      console.warn('[Notification Warning] Gagal membuat notifikasi status siap/selesai:', notifErr);
    }

    return { success: true, message: `Status pesanan berhasil diperbarui` };
  }

  private async awardRewardPointsIfCompleted(order: OrderEntity, previousStatus?: string): Promise<void> {
    try {
      const currentStatus = (order.status || '').toLowerCase();
      const prevStatus = (previousStatus || '').toLowerCase();
      const isCompleted = currentStatus.includes('selesai');
      const wasAlreadyCompleted = prevStatus.includes('selesai');

      if (!isCompleted || wasAlreadyCompleted) return;

      const rawUserId = order.users_id || order.user_id;
      if (!rawUserId) return;

      const numericOrderId = order.id_orders || order.id;

      // Hitung total belanja pesanan: (qty * price) + delivery - discount
      const totalAmount = Math.max(
        0,
        Math.round(
          (Number(order.quantity) || 1) * (Number(order.price_per_unit) || 0) +
          (Number(order.delivery_fee) || 0) -
          (Number(order.discount) || 0)
        )
      );

      // Formula Reward: 1 Poin per Rp 1.000 (minimal 5 poin per pesanan selesai)
      const earnedPoints = Math.max(5, Math.floor(totalAmount / 1000));

      const userRepository = new UserRepository();
      await userRepository.addRewardPoints(
        rawUserId,
        earnedPoints,
        numericOrderId,
        `Reward Pesanan #${order.invoice_no} (+${earnedPoints} Poin)`,
        `Pesanan ${order.service_name} telah selesai. Poin reward otomatis ditambahkan ke akun Anda!`
      );
    } catch (e: any) {
      console.warn('[Reward Points Warning] Gagal memberikan poin reward otomatis:', e.message);
    }
  }
}
