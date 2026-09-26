import { NotificationRepository, NotificationEntity } from './notification.repository';
import { CryptoUtil } from '../../utils/crypto.util';

export class NotificationService {
  private notificationRepository: NotificationRepository;

  constructor(notificationRepository?: NotificationRepository) {
    this.notificationRepository = notificationRepository || new NotificationRepository();
  }

  private formatNotification(n: NotificationEntity): NotificationEntity {
    const rawId = Number(n.id_notifications ?? n.id);
    const rawUserId = n.users_id ? Number(n.users_id) : null;
    const rawOrderId = n.orders_id ? Number(n.orders_id) : null;

    let parsedData = n.data;
    if (typeof n.data === 'string') {
      try {
        parsedData = JSON.parse(n.data);
      } catch (_) {}
    }

    return {
      ...n,
      id_notifications: rawId,
      id: CryptoUtil.encryptId(rawId) ?? String(rawId),
      users_id: rawUserId,
      user_id: rawUserId ? (CryptoUtil.encryptId(rawUserId) ?? String(rawUserId)) : null,
      orders_id: rawOrderId,
      order_id: rawOrderId ? (CryptoUtil.encryptId(rawOrderId) ?? String(rawOrderId)) : null,
      is_read: Boolean(n.is_read),
      data: parsedData,
    };
  }

  async getNotifications(options: {
    userId?: number | null;
    roleCode?: string | null;
    limit?: number;
  }): Promise<NotificationEntity[]> {
    const list = await this.notificationRepository.findAll(options);
    return list.map((item) => this.formatNotification(item));
  }

  async getUnreadCount(options: {
    userId?: number | null;
    roleCode?: string | null;
  }): Promise<number> {
    return await this.notificationRepository.getUnreadCount(options);
  }

  async markAsRead(id: string | number): Promise<boolean> {
    return await this.notificationRepository.markAsRead(id);
  }

  async markAllAsRead(options: {
    userId?: number | null;
    roleCode?: string | null;
  }): Promise<boolean> {
    return await this.notificationRepository.markAllAsRead(options);
  }

  async createNotification(data: {
    users_id?: number | string | null;
    orders_id?: number | string | null;
    title: string;
    message: string;
    type?: string;
    target_role?: string | null;
    data?: any;
    created_pic?: number | null;
  }): Promise<number> {
    return await this.notificationRepository.create(data);
  }

  // 1. Notifikasi Pesanan Baru Masuk (Ditujukan ke Tim Operasional yang memiliki izin kelola pesanan)
  async notifyOrderCreated(order: {
    id_orders?: number;
    id?: number | string;
    invoice_no?: string;
    service_name?: string;
    users_id?: number | string | null;
    customer_name?: string;
    pickup_address?: string;
  }, creatorPic?: number | null): Promise<void> {
    const rawOrderId = order.id_orders || CryptoUtil.decryptId(order.id);
    const invoiceNo = order.invoice_no || 'Baru';
    const customer = order.customer_name || 'Pelanggan';
    const service = order.service_name || 'Laundry';

    await this.notificationRepository.create({
      orders_id: rawOrderId,
      title: 'Pesanan Baru Masuk',
      message: `Pesanan #${invoiceNo} (${service}) dari ${customer} berhasil dibuat dan siap diproses.`,
      type: 'order_created',
      target_role: 'staff',
      data: {
        invoice_no: invoiceNo,
        service_name: service,
        customer_name: customer,
        pickup_address: order.pickup_address,
      },
      created_pic: creatorPic || null,
    });
  }

  // 2. Notifikasi Kurir Ditugaskan (Ditujukan langsung ke akun Pelanggan & Kurir via users_id)
  async notifyCourierAssigned(params: {
    order: {
      id_orders?: number | string;
      id?: number | string;
      invoice_no?: string;
      users_id?: number | string | null;
      user_id?: number | string | null;
      customer_name?: string;
      pickup_address?: string;
    };
    courierName: string;
    courierPhone?: string;
    courierUserId?: number | string | null;
    creatorPic?: number | null;
  }): Promise<void> {
    const { order, courierName, courierPhone, courierUserId, creatorPic } = params;
    const rawOrderId = order.id_orders ? (CryptoUtil.decryptId(order.id_orders) ?? Number(order.id_orders)) : CryptoUtil.decryptId(order.id);
    const rawCustomerUserId = order.users_id ? (CryptoUtil.decryptId(order.users_id) ?? Number(order.users_id)) : (order.user_id ? CryptoUtil.decryptId(order.user_id) : null);
    const invoiceNo = order.invoice_no || '';

    // Notifikasi langsung untuk akun Pelanggan (via users_id)
    if (rawCustomerUserId) {
      await this.notificationRepository.create({
        users_id: rawCustomerUserId,
        orders_id: rawOrderId,
        title: 'Kurir Telah Ditugaskan',
        message: `Kurir ${courierName}${courierPhone ? ` (${courierPhone})` : ''} telah ditugaskan untuk pesanan #${invoiceNo} Anda.`,
        type: 'courier_assigned',
        target_role: null,
        data: {
          invoice_no: invoiceNo,
          courier_name: courierName,
          courier_phone: courierPhone,
        },
        created_pic: creatorPic || null,
      });
    }

    // Notifikasi langsung untuk akun Kurir Bertugas (via users_id)
    const rawCourierUserId = courierUserId ? (CryptoUtil.decryptId(courierUserId) ?? Number(courierUserId)) : null;
    if (rawCourierUserId) {
      await this.notificationRepository.create({
        users_id: rawCourierUserId,
        orders_id: rawOrderId,
        title: 'Tugas Penjemputan / Pengantaran Baru',
        message: `Anda ditugaskan menangani pesanan #${invoiceNo} (${order.customer_name || 'Pelanggan'} - ${order.pickup_address || 'Alamat Penjemputan'}).`,
        type: 'courier_assigned',
        target_role: null,
        data: {
          invoice_no: invoiceNo,
          customer_name: order.customer_name,
          pickup_address: order.pickup_address,
        },
        created_pic: creatorPic || null,
      });
    }
  }

  // 3. Notifikasi Cucian Siap Diantar / Selesai (Ditujukan langsung ke Pelanggan via users_id)
  async notifyOrderStatusReady(params: {
    order: {
      id_orders?: number | string;
      id?: number | string;
      invoice_no?: string;
      users_id?: number | string | null;
      user_id?: number | string | null;
    };
    statusName: string;
    creatorPic?: number | null;
  }): Promise<void> {
    const { order, statusName, creatorPic } = params;
    const rawOrderId = order.id_orders ? (CryptoUtil.decryptId(order.id_orders) ?? Number(order.id_orders)) : CryptoUtil.decryptId(order.id);
    const rawCustomerUserId = order.users_id ? (CryptoUtil.decryptId(order.users_id) ?? Number(order.users_id)) : (order.user_id ? CryptoUtil.decryptId(order.user_id) : null);
    const invoiceNo = order.invoice_no || '';

    if (rawCustomerUserId) {
      const isCompleted = statusName.toLowerCase().includes('selesai');
      const title = isCompleted ? 'Pesanan Laundry Selesai' : 'Cucian Anda Siap Diantar / Diambil!';
      const message = isCompleted
        ? `Pesanan #${invoiceNo} telah selesai. Terima kasih telah mempercayai Almas Laundry!`
        : `Hore! Cucian #${invoiceNo} Anda telah selesai diproses (${statusName}) dan siap diantar/diambil.`;

      await this.notificationRepository.create({
        users_id: rawCustomerUserId,
        orders_id: rawOrderId,
        title,
        message,
        type: isCompleted ? 'order_completed' : 'order_ready',
        target_role: null,
        data: {
          invoice_no: invoiceNo,
          status_name: statusName,
        },
        created_pic: creatorPic || null,
      });
    }
  }
}
