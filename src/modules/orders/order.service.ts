import { OrderRepository, OrderEntity, TimelineStepEntity } from './order.repository';
import { CryptoUtil } from '../../utils/crypto.util';
import { InvoiceGeneratorUtil } from '../../utils/invoice-generator.util';
import { NotificationService } from '../notifications/notification.service';
import { UserRepository } from '../user/user.repository';
import { query } from '../../config/database';

export class OrderService {
  private orderRepository: OrderRepository;
  private notificationService: NotificationService;
  private userRepository: UserRepository;

  constructor(orderRepository?: OrderRepository, notificationService?: NotificationService, userRepository?: UserRepository) {
    this.orderRepository = orderRepository || new OrderRepository();
    this.notificationService = notificationService || new NotificationService();
    this.userRepository = userRepository || new UserRepository();
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

    const customerName = o.customer_name ?? o.user_name ?? null;
    const customerPhone = o.customer_phone ?? o.user_phone ?? null;
    const customerEmail = o.customer_email ?? o.user_email ?? null;
    const customerTier = o.customer_member_tier ?? null;

    return {
      ...o,
      id_orders: rawId,
      id: CryptoUtil.encryptId(rawId) ?? String(rawId),
      users_id: rawUserId ?? undefined,
      user_id: rawUserId ? (CryptoUtil.encryptId(rawUserId) ?? String(rawUserId)) : undefined,
      customer_name: customerName,
      customer_phone: customerPhone,
      customer_email: customerEmail,
      customer_member_tier: customerTier,
      user_name: customerName,
      user_phone: customerPhone,
      user_email: customerEmail,
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
      voucher_code?: string;
      points_redeemed?: number;
      payment_method?: string;
      payment_method_code?: string;
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
    const numericUserId = rawUserId ? (CryptoUtil.decryptId(rawUserId) ?? Number(rawUserId)) : null;

    // Check payment method
    const paymentMethodLower = (data.payment_method || '').toLowerCase();
    const paymentCodeLower = (data.payment_method_code || '').toLowerCase();
    const notesLower = (data.notes || '').toLowerCase();
    const isLaundryPay =
      paymentMethodLower.includes('laundrypay') ||
      paymentMethodLower.includes('saldo') ||
      paymentCodeLower.includes('laundrypay') ||
      paymentCodeLower.includes('saldo') ||
      notesLower.includes('metode pembayaran: saldo laundrypay') ||
      notesLower.includes('metode pembayaran: laundrypay');

    const quantityNum = Number(data.quantity) || 1.0;
    const priceNum = Number(data.price_per_unit) || 0;
    const deliveryFeeNum = Number(data.delivery_fee) || 0;
    const discountNum = Number(data.discount) || 0;
    const pointsNum = Number(data.points_redeemed) || 0;
    const grandTotal = Math.max(0, (quantityNum * priceNum) + deliveryFeeNum - discountNum - pointsNum);

    // If LaundryPay is selected and grandTotal > 0, validate user balance beforehand
    if (isLaundryPay && grandTotal > 0 && numericUserId) {
      const userRes = await query<any>(
        'SELECT id_users, name_users, laundry_pay_balance FROM users WHERE id_users = ? AND deleted_at IS NULL LIMIT 1',
        [numericUserId]
      );
      if (!userRes || userRes.length === 0) {
        throw new Error('Akun pengguna tidak ditemukan atau tidak aktif.');
      }
      const userBalanceBefore = Number(userRes[0].laundry_pay_balance) || 0;
      if (userBalanceBefore < grandTotal) {
        const shortage = grandTotal - userBalanceBefore;
        throw new Error(
          `Saldo LaundryPay Anda tidak mencukupi. Saldo saat ini Rp ${userBalanceBefore.toLocaleString('id-ID')}, kurang Rp ${shortage.toLocaleString('id-ID')} dari total pembayaran Rp ${grandTotal.toLocaleString('id-ID')}. Silakan lakukan top-up saldo terlebih dahulu.`
        );
      }
    }

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
      quantity: quantityNum,
      unit: data.unit || 'kg',
      price_per_unit: priceNum,
      delivery_fee: deliveryFeeNum,
      discount: discountNum,
      pickup_address: data.pickup_address,
      delivery_address: data.delivery_address || data.pickup_address,
      courier_name: data.courier_name || '',
      courier_phone: data.courier_phone || '',
      notes: data.notes || '',
    };

    const created = await this.orderRepository.create(newOrder, creatorPic || undefined);
    const createdOrderId = created.id_orders || created.id;

    // Tandai voucher pengguna sebagai terpakai jika disertakan
    if (rawUserId && data.voucher_code) {
      try {
        await this.userRepository.markUserVoucherAsUsed(rawUserId, data.voucher_code, createdOrderId);
      } catch (vErr) {
        console.warn('[OrderService Warning] Gagal menandai voucher sebagai terpakai:', vErr);
      }
    }

    // Potong poin reward jika ada penukaran poin saat checkout
    if (rawUserId && data.points_redeemed && Number(data.points_redeemed) > 0) {
      try {
        await this.userRepository.deductRewardPoints(
          rawUserId,
          Number(data.points_redeemed),
          `Tukar Poin Checkout Pesanan #${created.invoice_no}`,
          `Potongan harga Rp ${Number(data.points_redeemed).toLocaleString('id-ID')} pada pesanan #${created.invoice_no}`
        );
      } catch (pErr) {
        console.warn('[OrderService Warning] Gagal memotong poin reward checkout:', pErr);
      }
    }

    // Potong saldo LaundryPay jika metode pembayaran adalah LaundryPay
    if (isLaundryPay && grandTotal > 0 && numericUserId) {
      try {
        const debitResult = await this.userRepository.deductLaundryPayBalance(
          numericUserId,
          grandTotal,
          createdOrderId,
          created.invoice_no,
          `Pembayaran Pesanan #${created.invoice_no}`,
          `Pembayaran pesanan ${data.service_name} #${created.invoice_no} menggunakan Saldo LaundryPay`
        );

        if (debitResult.success) {
          try {
            await this.notificationService.createNotification({
              users_id: numericUserId,
              orders_id: createdOrderId,
              title: 'Pembayaran Saldo LaundryPay Berhasil',
              message: `Pembayaran pesanan #${created.invoice_no} sebesar Rp ${grandTotal.toLocaleString('id-ID')} menggunakan Saldo LaundryPay berhasil. Sisa saldo aktif Anda sekarang Rp ${debitResult.balanceAfter.toLocaleString('id-ID')}.`,
              type: 'payment_success',
            });
          } catch (notifErr) {
            console.warn('[OrderService Warning] Gagal membuat notifikasi pembayaran LaundryPay:', notifErr);
          }
        }
      } catch (lpayErr: any) {
        console.error('[OrderService Error] Gagal memotong saldo LaundryPay:', lpayErr);
        throw lpayErr;
      }
    }

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

    // 3. Trigger Notifikasi: Status Cucian Diperbarui (Ke Pelanggan Real-Time)
    try {
      const updatedOrder = await this.orderRepository.findById(id);
      if (updatedOrder) {
        const newStatus = updatedOrder.status || '';
        const oldStatus = existingOrder?.status || '';

        if (newStatus !== oldStatus) {
          await this.notificationService.notifyOrderStatusChanged({
            order: updatedOrder,
            statusName: newStatus,
            previousStatus: oldStatus,
            creatorPic: updatePic || null,
          });
        }

        // 4. Trigger Reward Points: Otomatis jika status Pesanan Selesai
        await this.awardRewardPointsIfCompleted(updatedOrder, existingOrder?.status);
      }
    } catch (notifErr) {
      console.warn('[Notification Warning] Gagal membuat notifikasi perubahan status:', notifErr);
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

      // Formula Reward: 1 Poin per Rp 1.000 transaksi riil
      const earnedPoints = Math.floor(totalAmount / 1000);
      if (earnedPoints <= 0) return;

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

  async submitRating(
    id: string | number,
    data: { rating: number; review?: string; tip_amount?: number; userId?: number | null }
  ): Promise<boolean> {
    const existingOrder = await this.orderRepository.findById(String(id));
    if (!existingOrder) {
      throw new Error('Pesanan laundry tidak ditemukan');
    }

    // Validasi kepemilikan: Hanya pelanggan pemilik pesanan yang berhak memberikan penilaian & tips
    const rawOrderOwnerId = existingOrder.users_id 
      ? Number(existingOrder.users_id) 
      : (existingOrder.user_id ? Number(CryptoUtil.decryptId(existingOrder.user_id) ?? existingOrder.user_id) : null);

    if (data.userId && rawOrderOwnerId && Number(data.userId) !== rawOrderOwnerId) {
      throw new Error('Hanya pelanggan pemilik pesanan ini yang dapat memberikan ulasan dan rating.');
    }

    const prevTip = Number(existingOrder?.tip_amount) || 0;
    const newTip = Math.max(0, Number(data.tip_amount) || 0);
    const tipDelta = newTip - prevTip;

    const result = await this.orderRepository.submitRating(id, data);

    // Jika ada tips (atau perubahan nilai tips) dan pesanan memiliki kurir bertugas
    if (result && tipDelta !== 0 && existingOrder) {
      try {
        let courierUserId: number | null = null;
        if (existingOrder.courier_users_id || existingOrder.courier_user_id) {
          courierUserId = Number(existingOrder.courier_users_id ?? existingOrder.courier_user_id);
        } else {
          const cleanPhone = (existingOrder.courier_phone || '').replace(/[^0-9]/g, '');
          const courierName = (existingOrder.courier_name || '').trim();
          if (courierName.length > 0 || cleanPhone.length > 0) {
            const courierRows = await query<any>(
              `SELECT id_users FROM users 
               WHERE ((phone IS NOT NULL AND phone != '' AND REPLACE(REPLACE(phone, '-', ''), ' ', '') = ?) OR (LOWER(name_users) = LOWER(?)))
                 AND deleted_at IS NULL 
               LIMIT 1`,
              [cleanPhone, courierName]
            );
            if (courierRows && courierRows.length > 0) {
              courierUserId = Number(courierRows[0].id_users);
            }
          }
        }

        if (courierUserId) {
          // Dapatkan saldo kurir saat ini untuk mutasi
          const userBalRes = await query<any>('SELECT laundry_pay_balance FROM users WHERE id_users = ?', [courierUserId]);
          const currentBal = userBalRes && userBalRes.length > 0 ? (Number(userBalRes[0].laundry_pay_balance) || 0) : 0;
          const nextBal = currentBal + tipDelta;

          // 1. Otomatis tambahkan tips ke saldo LaundryPay kurir
          await query(
            'UPDATE users SET laundry_pay_balance = GREATEST(0, COALESCE(laundry_pay_balance, 0) + ?) WHERE id_users = ?',
            [tipDelta, courierUserId]
          );

          // 2. Simpan ke riwayat transaksi dompet (wallet_transactions)
          if (tipDelta > 0) {
            const customerName = (existingOrder as any).customer_name || (existingOrder as any).user_name || 'Pelanggan';
            try {
              await query(`
                INSERT INTO wallet_transactions 
                  (users_id, orders_id, type, category, amount, balance_before, balance_after, title, description, reference_no)
                VALUES (?, ?, 'credit', 'tip', ?, ?, ?, ?, ?, ?)
              `, [
                courierUserId,
                existingOrder.id_orders ?? existingOrder.id,
                tipDelta,
                currentBal,
                nextBal,
                'Tips Pengantaran Pesanan',
                `Tips sebesar Rp ${tipDelta.toLocaleString('id-ID')} dari ${customerName} untuk pesanan #${existingOrder.invoice_no}`,
                existingOrder.invoice_no
              ]);
            } catch (txErr: any) {
              console.warn('[WalletTransaction Warning] Gagal mencatat mutasi tips kurir:', txErr?.message || txErr);
            }

            // 3. Kirim notifikasi tips masuk ke akun kurir
            await this.notificationService.notifyCourierTipReceived({
              courierUserId,
              orderId: existingOrder.id_orders ?? existingOrder.id,
              invoiceNo: existingOrder.invoice_no,
              tipAmount: tipDelta,
              customerName,
            });
          }
        }
      } catch (err: any) {
        console.warn('[Courier Tip Warning] Gagal mengkreditkan saldo tips ke kurir:', err?.message || err);
      }
    }

    return result;
  }
}
