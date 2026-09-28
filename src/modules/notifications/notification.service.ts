import { NotificationRepository, NotificationEntity } from './notification.repository';
import { CryptoUtil } from '../../utils/crypto.util';
import { query } from '../../config/database';

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
    customer_name?: string | null;
    pickup_address?: string;
  }, creatorPic?: number | null): Promise<void> {
    const rawOrderId = order.id_orders || CryptoUtil.decryptId(order.id);
    const invoiceNo = order.invoice_no || '';
    const customer = order.customer_name;
    const service = order.service_name || '';

    const message = customer
      ? `Pesanan #${invoiceNo} (${service}) dari ${customer} berhasil dibuat dan siap diproses.`
      : `Pesanan #${invoiceNo} (${service}) berhasil dibuat dan siap diproses.`;

    await this.notificationRepository.create({
      orders_id: rawOrderId,
      title: 'Pesanan Baru Masuk',
      message,
      type: 'order_created',
      target_role: 'staff',
      data: {
        invoice_no: invoiceNo,
        service_name: service,
        customer_name: customer ?? null,
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
      customer_name?: string | null;
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
        message: courierPhone 
          ? `Kurir ${courierName} (${courierPhone}) telah ditugaskan untuk pesanan #${invoiceNo} Anda.`
          : `Kurir ${courierName} telah ditugaskan untuk pesanan #${invoiceNo} Anda.`,
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
      const details = [order.customer_name, order.pickup_address].filter(Boolean).join(' - ');
      const message = details 
        ? `Anda ditugaskan menangani pesanan #${invoiceNo} (${details}).`
        : `Anda ditugaskan menangani pesanan #${invoiceNo}.`;

      await this.notificationRepository.create({
        users_id: rawCourierUserId,
        orders_id: rawOrderId,
        title: 'Tugas Penjemputan / Pengantaran Baru',
        message,
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

  // 3. Notifikasi Perubahan Status Pesanan (Ditujukan langsung ke Pelanggan via users_id)
  async notifyOrderStatusChanged(params: {
    order: {
      id_orders?: number | string;
      id?: number | string;
      invoice_no?: string;
      users_id?: number | string | null;
      user_id?: number | string | null;
    };
    statusName: string;
    previousStatus?: string;
    creatorPic?: number | null;
  }): Promise<void> {
    const { order, statusName, previousStatus, creatorPic } = params;
    const rawOrderId = order.id_orders ? (CryptoUtil.decryptId(order.id_orders) ?? Number(order.id_orders)) : CryptoUtil.decryptId(order.id);
    const rawCustomerUserId = order.users_id ? (CryptoUtil.decryptId(order.users_id) ?? Number(order.users_id)) : (order.user_id ? CryptoUtil.decryptId(order.user_id) : null);
    const invoiceNo = order.invoice_no || '';

    if (!rawCustomerUserId) return;

    const lower = statusName.toLowerCase();
    let title = `Update Pesanan #${invoiceNo}`;
    let message = `Status pesanan #${invoiceNo} Anda kini: ${statusName}`;
    let type = 'order_status_updated';

    if (lower.includes('selesai')) {
      title = 'Pesanan Laundry Selesai';
      message = `Pesanan #${invoiceNo} telah selesai. Terima kasih telah mempercayai Almas Laundry!`;
      type = 'order_completed';
    } else if (lower.includes('siap diantar') || lower.includes('siap diambil')) {
      title = 'Cucian Anda Siap Diantar / Diambil!';
      message = `Hore! Cucian #${invoiceNo} Anda telah selesai diproses (${statusName}) dan siap diantar/diambil.`;
      type = 'order_ready';
    } else if (lower.includes('cuci')) {
      title = 'Pakaian Sedang Dicuci';
      message = `Pakaian pesanan #${invoiceNo} sedang dalam tahap pencucian higienis.`;
      type = 'order_processing';
    } else if (lower.includes('setrika') || lower.includes('lipat')) {
      title = 'Pakaian Sedang Disetrika & Dirapikan';
      message = `Pakaian pesanan #${invoiceNo} sedang disetrika uap dan dirapikan.`;
      type = 'order_processing';
    } else if (lower.includes('antar') || lower.includes('kirim')) {
      title = 'Cucian Sedang Diantar ke Lokasi Anda';
      message = `Kurir sedang menuju alamat Anda untuk mengantarkan pesanan #${invoiceNo}.`;
      type = 'courier_assigned';
    } else if (lower.includes('jemput')) {
      title = 'Kurir Sedang Menjemput Pakaian';
      message = `Kurir sedang menuju alamat Anda untuk menjemput pakaian #${invoiceNo}.`;
      type = 'courier_assigned';
    }

    await this.notificationRepository.create({
      users_id: rawCustomerUserId,
      orders_id: rawOrderId,
      title,
      message,
      type,
      target_role: null,
      data: {
        invoice_no: invoiceNo,
        status_name: statusName,
        previous_status: previousStatus,
      },
      created_pic: creatorPic || null,
    });

    // 3b. Notifikasi ke Kurir Bertugas jika ada kurir yang ditugaskan pada pesanan ini
    const courierName = (order as any).courier_name;
    const courierPhone = (order as any).courier_phone;
    if (courierName && String(courierName).trim().length > 0) {
      try {
        const cleanPhone = (courierPhone || '').replace(/[^0-9]/g, '');
        const courierUsers = await query<any>(
          `SELECT id_users FROM users WHERE (LOWER(name_users) = LOWER(?) OR (phone IS NOT NULL AND phone != '' AND REPLACE(REPLACE(phone, '-', ''), ' ', '') = ?)) AND deleted_at IS NULL LIMIT 1`,
          [courierName.trim(), cleanPhone]
        );
        if (courierUsers && courierUsers.length > 0) {
          const courierUserId = Number(courierUsers[0].id_users);
          // Hindari duplikasi jika customer_id sama dengan courier_id
          if (courierUserId !== rawCustomerUserId) {
            await this.notificationRepository.create({
              users_id: courierUserId,
              orders_id: rawOrderId,
              title: `Pembaruan Tugas Pesanan #${invoiceNo}`,
              message: `Status pesanan #${invoiceNo} yang Anda tangani kini diperbarui menjadi: ${statusName}`,
              type: 'courier_assigned',
              target_role: null,
              data: {
                invoice_no: invoiceNo,
                status_name: statusName,
                previous_status: previousStatus,
              },
              created_pic: creatorPic || null,
            });
          }
        }
      } catch (err) {
        console.warn('[Notification Warning] Gagal membuat notifikasi untuk kurir bertugas:', err);
      }
    }
  }

  // Notifikasi Cucian Siap Diantar / Selesai (Legacy fallback)
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
    return this.notifyOrderStatusChanged(params);
  }

  // Notifikasi Tips Masuk ke Kurir Bertugas
  async notifyCourierTipReceived(params: {
    courierUserId: number;
    orderId?: number | string | null;
    invoiceNo?: string | null;
    tipAmount: number;
    customerName?: string | null;
  }): Promise<void> {
    const formattedTip = new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(params.tipAmount);

    const title = '🎉 Anda Menerima Tips!';
    const message = params.customerName
      ? `Selamat! ${params.customerName} memberikan tips sebesar ${formattedTip} untuk pesanan #${params.invoiceNo || ''}. Saldo LaundryPay Anda telah otomatis bertambah!`
      : `Selamat! Anda menerima tips sebesar ${formattedTip} untuk pesanan #${params.invoiceNo || ''}. Saldo LaundryPay Anda telah otomatis bertambah!`;

    await this.notificationRepository.create({
      users_id: params.courierUserId,
      orders_id: params.orderId ? (CryptoUtil.decryptId(params.orderId) ?? Number(params.orderId)) : null,
      title,
      message,
      type: 'courier_tip_received',
      target_role: null,
      data: {
        invoice_no: params.invoiceNo,
        tip_amount: params.tipAmount,
        customer_name: params.customerName,
      },
    });
  }
}
