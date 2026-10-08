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

    const title = 'Anda Menerima Tips';
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

  // 4. Notifikasi Pembayaran Berhasil (Ditujukan langsung ke Pelanggan via users_id)
  async notifyPaymentSuccess(params: {
    order: {
      id_orders?: number | string;
      id?: number | string;
      invoice_no?: string;
      users_id?: number | string | null;
      user_id?: number | string | null;
      service_name?: string;
    };
    amount: number;
    paymentMethod?: string;
    creatorPic?: number | null;
  }): Promise<void> {
    const { order, amount, paymentMethod = 'QRIS', creatorPic } = params;
    const rawOrderId = order.id_orders ? (CryptoUtil.decryptId(order.id_orders) ?? Number(order.id_orders)) : CryptoUtil.decryptId(order.id);
    const rawCustomerUserId = order.users_id ? (CryptoUtil.decryptId(order.users_id) ?? Number(order.users_id)) : (order.user_id ? CryptoUtil.decryptId(order.user_id) : null);
    const invoiceNo = order.invoice_no || '';

    const formattedAmount = new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(amount);

    if (rawCustomerUserId) {
      await this.notificationRepository.create({
        users_id: rawCustomerUserId,
        orders_id: rawOrderId,
        title: 'Pembayaran Berhasil Diterima',
        message: `Pembayaran sebesar ${formattedAmount} untuk pesanan #${invoiceNo} (${order.service_name || 'Laundry'}) via ${paymentMethod} telah berhasil diverifikasi. Pesanan Anda akan segera diproses!`,
        type: 'payment_success',
        target_role: null,
        data: {
          invoice_no: invoiceNo,
          amount,
          payment_method: paymentMethod,
        },
        created_pic: creatorPic || null,
      });
    }
  }

  // 5. Notifikasi Pembayaran Kadaluarsa / Pesanan Dibatalkan (Ditujukan langsung ke Pelanggan via users_id)
  async notifyPaymentExpired(params: {
    order: {
      id_orders?: number | string;
      id?: number | string;
      invoice_no?: string;
      users_id?: number | string | null;
      user_id?: number | string | null;
    };
    creatorPic?: number | null;
  }): Promise<void> {
    const { order, creatorPic } = params;
    const rawOrderId = order.id_orders ? (CryptoUtil.decryptId(order.id_orders) ?? Number(order.id_orders)) : CryptoUtil.decryptId(order.id);
    const rawCustomerUserId = order.users_id ? (CryptoUtil.decryptId(order.users_id) ?? Number(order.users_id)) : (order.user_id ? CryptoUtil.decryptId(order.user_id) : null);
    const invoiceNo = order.invoice_no || '';

    if (rawCustomerUserId) {
      await this.notificationRepository.create({
        users_id: rawCustomerUserId,
        orders_id: rawOrderId,
        title: 'Batas Waktu Pembayaran Berakhir',
        message: `Batas waktu pembayaran untuk pesanan #${invoiceNo} telah berakhir dan pesanan telah dibatalkan secara otomatis. Anda dapat melakukan pemesanan ulang kapan saja.`,
        type: 'order_cancelled',
        target_role: null,
        data: {
          invoice_no: invoiceNo,
          reason: 'PAYMENT_EXPIRED',
        },
        created_pic: creatorPic || null,
      });
    }
  }

  // 6. Notifikasi Top-Up Saldo LaundryPay Berhasil (Ditujukan ke Akun Pengguna / Pelanggan)
  async notifyTopupSuccess(params: {
    userId: number | string;
    amount: number;
    balanceBefore: number;
    balanceAfter: number;
    referenceNo?: string;
    notes?: string;
    creatorPic?: number | null;
  }): Promise<void> {
    const rawUserId = CryptoUtil.decryptId(params.userId) ?? Number(params.userId);
    if (!rawUserId) return;

    const formattedAmount = new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(params.amount);

    const formattedBalanceAfter = new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(params.balanceAfter);

    await this.notificationRepository.create({
      users_id: rawUserId,
      title: 'Top-Up Saldo Berhasil',
      message: `Top-up saldo LaundryPay sebesar ${formattedAmount} telah berhasil ditambahkan. Saldo aktif Anda sekarang ${formattedBalanceAfter}.`,
      type: 'topup_success',
      target_role: null,
      data: {
        amount: params.amount,
        balance_before: params.balanceBefore,
        balance_after: params.balanceAfter,
        reference_no: params.referenceNo,
        notes: params.notes,
      },
      created_pic: params.creatorPic || null,
    });
  }

  // 7. Notifikasi Pengajuan Penarikan Dana (WD) Masuk (Ditujukan ke Admin & Staf Operasional)
  async notifyWithdrawalRequested(params: {
    withdrawalId: number | string;
    courierUserId: number | string;
    courierName: string;
    amount: number;
    bankName: string;
    accountNumber: string;
    accountName: string;
    creatorPic?: number | null;
  }): Promise<void> {
    const rawWithdrawalId = CryptoUtil.decryptId(params.withdrawalId) ?? Number(params.withdrawalId);
    const rawCourierUserId = CryptoUtil.decryptId(params.courierUserId) ?? Number(params.courierUserId);

    const formattedAmount = new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(params.amount);

    // Notifikasi untuk Admin Web
    await this.notificationRepository.create({
      target_role: 'admin',
      title: 'Pengajuan Penarikan Dana (WD)',
      message: `Kurir ${params.courierName} mengajukan penarikan dana sebesar ${formattedAmount} ke rekening ${params.bankName} (${params.accountNumber} a.n. ${params.accountName}).`,
      type: 'withdrawal_requested',
      data: {
        withdrawal_id: rawWithdrawalId,
        courier_id: rawCourierUserId,
        courier_name: params.courierName,
        amount: params.amount,
        bank_name: params.bankName,
        account_number: params.accountNumber,
        account_name: params.accountName,
      },
      created_pic: params.creatorPic || rawCourierUserId,
    });
  }

  // 8. Notifikasi Pengajuan Penarikan Dana Terkirim (Ditujukan ke Kurir)
  async notifyWithdrawalSubmitted(params: {
    courierUserId: number | string;
    withdrawalId: number | string;
    amount: number;
    bankName: string;
    accountNumber: string;
    creatorPic?: number | null;
  }): Promise<void> {
    const rawCourierUserId = CryptoUtil.decryptId(params.courierUserId) ?? Number(params.courierUserId);
    const rawWithdrawalId = CryptoUtil.decryptId(params.withdrawalId) ?? Number(params.withdrawalId);
    if (!rawCourierUserId) return;

    const formattedAmount = new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(params.amount);

    await this.notificationRepository.create({
      users_id: rawCourierUserId,
      title: 'Pengajuan Penarikan Dana Terkirim',
      message: `Pengajuan penarikan dana sebesar ${formattedAmount} ke rekening ${params.bankName} (${params.accountNumber}) sedang ditinjau oleh admin.`,
      type: 'withdrawal_submitted',
      target_role: null,
      data: {
        withdrawal_id: rawWithdrawalId,
        amount: params.amount,
        bank_name: params.bankName,
        account_number: params.accountNumber,
      },
      created_pic: params.creatorPic || rawCourierUserId,
    });
  }

  // 9. Notifikasi Persetujuan / Penolakan Penarikan Dana (Ditujukan ke Kurir)
  async notifyWithdrawalStatusProcessed(params: {
    courierUserId: number | string;
    withdrawalId: number | string;
    amount: number;
    bankName: string;
    accountNumber: string;
    status: 'completed' | 'rejected';
    adminNotes?: string;
    processedBy?: number | null;
  }): Promise<void> {
    const rawCourierUserId = CryptoUtil.decryptId(params.courierUserId) ?? Number(params.courierUserId);
    const rawWithdrawalId = CryptoUtil.decryptId(params.withdrawalId) ?? Number(params.withdrawalId);
    if (!rawCourierUserId) return;

    const formattedAmount = new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(params.amount);

    if (params.status === 'completed') {
      await this.notificationRepository.create({
        users_id: rawCourierUserId,
        title: 'Penarikan Dana Berhasil',
        message: `Penarikan dana sebesar ${formattedAmount} ke rekening ${params.bankName} (${params.accountNumber}) telah disetujui dan berhasil ditransfer.`,
        type: 'withdrawal_completed',
        target_role: null,
        data: {
          withdrawal_id: rawWithdrawalId,
          amount: params.amount,
          bank_name: params.bankName,
          account_number: params.accountNumber,
          status: 'completed',
          admin_notes: params.adminNotes,
        },
        created_pic: params.processedBy || null,
      });
    } else {
      await this.notificationRepository.create({
        users_id: rawCourierUserId,
        title: 'Penarikan Dana Ditolak',
        message: `Penarikan dana sebesar ${formattedAmount} ke rekening ${params.bankName} (${params.accountNumber}) ditolak${params.adminNotes ? `: "${params.adminNotes}"` : ''}. Saldo telah dikembalikan ke LaundryPay Anda.`,
        type: 'withdrawal_rejected',
        target_role: null,
        data: {
          withdrawal_id: rawWithdrawalId,
          amount: params.amount,
          bank_name: params.bankName,
          account_number: params.accountNumber,
          status: 'rejected',
          admin_notes: params.adminNotes,
        },
        created_pic: params.processedBy || null,
      });
    }
  }

  // 10. Notifikasi Pengajuan Top-Up Saldo Masuk (Ditujukan ke Admin Web)
  async notifyTopupRequested(params: {
    topupId: number | string;
    userId: number | string;
    userName: string;
    amount: number;
    paymentMethod: string;
    notes?: string;
    creatorPic?: number | null;
  }): Promise<void> {
    const rawTopupId = CryptoUtil.decryptId(params.topupId) ?? Number(params.topupId);
    const rawUserId = CryptoUtil.decryptId(params.userId) ?? Number(params.userId);

    const formattedAmount = new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(params.amount);

    await this.notificationRepository.create({
      target_role: 'admin',
      title: 'Pengajuan Top-Up Saldo Baru',
      message: `Pelanggan ${params.userName} mengajukan pengisian saldo LaundryPay sebesar ${formattedAmount} via ${params.paymentMethod}.`,
      type: 'topup_requested',
      data: {
        topup_id: rawTopupId,
        user_id: rawUserId,
        user_name: params.userName,
        amount: params.amount,
        payment_method: params.paymentMethod,
        notes: params.notes,
      },
      created_pic: params.creatorPic || rawUserId,
    });
  }

  // 11. Notifikasi Pengajuan Top-Up Terkirim (Ditujukan ke Mobile Pelanggan)
  async notifyTopupSubmitted(params: {
    userId: number | string;
    topupId: number | string;
    amount: number;
    paymentMethod: string;
    creatorPic?: number | null;
  }): Promise<void> {
    const rawUserId = CryptoUtil.decryptId(params.userId) ?? Number(params.userId);
    const rawTopupId = CryptoUtil.decryptId(params.topupId) ?? Number(params.topupId);
    if (!rawUserId) return;

    const formattedAmount = new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(params.amount);

    await this.notificationRepository.create({
      users_id: rawUserId,
      title: 'Pengajuan Top-Up Terkirim',
      message: `Pengajuan pengisian saldo LaundryPay sebesar ${formattedAmount} via ${params.paymentMethod} sedang menunggu verifikasi admin.`,
      type: 'topup_submitted',
      target_role: null,
      data: {
        topup_id: rawTopupId,
        amount: params.amount,
        payment_method: params.paymentMethod,
      },
      created_pic: params.creatorPic || rawUserId,
    });
  }

  // 12. Notifikasi Pengajuan Top-Up Ditolak (Ditujukan ke Mobile Pelanggan)
  async notifyTopupRejected(params: {
    userId: number | string;
    topupId: number | string;
    amount: number;
    paymentMethod: string;
    adminNotes?: string;
    processedBy?: number | null;
  }): Promise<void> {
    const rawUserId = CryptoUtil.decryptId(params.userId) ?? Number(params.userId);
    const rawTopupId = CryptoUtil.decryptId(params.topupId) ?? Number(params.topupId);
    if (!rawUserId) return;

    const formattedAmount = new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(params.amount);

    await this.notificationRepository.create({
      users_id: rawUserId,
      title: 'Pengajuan Top-Up Ditolak',
      message: `Pengajuan isi saldo LaundryPay sebesar ${formattedAmount} via ${params.paymentMethod} ditolak${params.adminNotes ? `: "${params.adminNotes}"` : ''}.`,
      type: 'topup_rejected',
      target_role: null,
      data: {
        topup_id: rawTopupId,
        amount: params.amount,
        payment_method: params.paymentMethod,
        admin_notes: params.adminNotes,
        status: 'rejected',
      },
      created_pic: params.processedBy || null,
    });
  }

  // 13. Notifikasi Pengunggahan Bukti Pembayaran Manual (Transfer Bank)
  async notifyPaymentProofUploaded(params: {
    order: {
      id_orders?: number | string;
      id?: number | string;
      invoice_no?: string;
      users_id?: number | string | null;
      user_id?: number | string | null;
      service_name?: string;
      customer_name?: string | null;
    };
    amount: number;
    proofUrl: string;
    uploaderUserId: number;
    bankName?: string;
    creatorPic?: number | null;
  }): Promise<void> {
    const { order, amount, proofUrl, uploaderUserId, bankName, creatorPic } = params;
    const rawOrderId = order.id_orders ? (CryptoUtil.decryptId(order.id_orders) ?? Number(order.id_orders)) : CryptoUtil.decryptId(order.id);
    const rawCustomerUserId = order.users_id ? (CryptoUtil.decryptId(order.users_id) ?? Number(order.users_id)) : (order.user_id ? CryptoUtil.decryptId(order.user_id) : uploaderUserId);
    const invoiceNo = order.invoice_no || '';

    const formattedAmount = new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(amount);

    // 1. Notifikasi Personal ke Pelanggan
    if (rawCustomerUserId) {
      await this.notificationRepository.create({
        users_id: rawCustomerUserId,
        orders_id: rawOrderId,
        title: 'Bukti Pembayaran Diunggah',
        message: `Bukti transfer sebesar ${formattedAmount} untuk pesanan #${invoiceNo} (${order.service_name || 'Laundry'}) telah berhasil dikirim dan sedang dalam proses verifikasi kasir/admin.`,
        type: 'payment_proof_uploaded',
        target_role: null,
        data: {
          invoice_no: invoiceNo,
          amount,
          proof_url: proofUrl,
          bank_name: bankName || null,
        },
        created_pic: creatorPic || uploaderUserId,
      });
    }

    // 2. Notifikasi Operasional ke Staf Kasir / Admin
    const customer = order.customer_name || 'Pelanggan';
    await this.notificationRepository.create({
      orders_id: rawOrderId,
      title: 'Bukti Pembayaran Masuk',
      message: `${customer} telah mengunggah bukti transfer sebesar ${formattedAmount} untuk pesanan #${invoiceNo}. Mohon segera diverifikasi.`,
      type: 'payment_proof_submitted',
      target_role: 'staff',
      data: {
        invoice_no: invoiceNo,
        amount,
        proof_url: proofUrl,
        customer_name: customer,
        bank_name: bankName || null,
      },
      created_pic: creatorPic || uploaderUserId,
    });
  }

  // 14. Notifikasi Penolakan Bukti Pembayaran Manual
  async notifyPaymentProofRejected(params: {
    order: {
      id_orders?: number | string;
      id?: number | string;
      invoice_no?: string;
      users_id?: number | string | null;
      user_id?: number | string | null;
    };
    reason?: string;
    creatorPic?: number | null;
  }): Promise<void> {
    const { order, reason, creatorPic } = params;
    const rawOrderId = order.id_orders ? (CryptoUtil.decryptId(order.id_orders) ?? Number(order.id_orders)) : CryptoUtil.decryptId(order.id);
    const rawCustomerUserId = order.users_id ? (CryptoUtil.decryptId(order.users_id) ?? Number(order.users_id)) : (order.user_id ? CryptoUtil.decryptId(order.user_id) : null);
    const invoiceNo = order.invoice_no || '';

    if (rawCustomerUserId) {
      await this.notificationRepository.create({
        users_id: rawCustomerUserId,
        orders_id: rawOrderId,
        title: 'Bukti Pembayaran Ditolak',
        message: `Bukti transfer untuk pesanan #${invoiceNo} ditolak${reason ? `: "${reason}"` : ''}. Silakan unggah ulang bukti transfer yang valid.`,
        type: 'payment_proof_rejected',
        target_role: null,
        data: {
          invoice_no: invoiceNo,
          reason: reason || null,
        },
        created_pic: creatorPic || null,
      });
    }
  }
}

