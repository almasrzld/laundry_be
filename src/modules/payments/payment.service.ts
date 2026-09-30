import { XenditService, XenditQrCodeResponse } from './xendit.service';
import { PaymentRepository, PaymentTransactionEntity } from './payment.repository';
import { OrderRepository } from '../orders/order.repository';
import { NotificationService } from '../notifications/notification.service';
import { CryptoUtil } from '../../utils/crypto.util';
import { ImageUtil } from '../../utils/image.util';

export class PaymentService {
  private xenditService: XenditService;
  private paymentRepository: PaymentRepository;
  private orderRepository: OrderRepository;
  private notificationService: NotificationService;

  constructor(
    xenditService?: XenditService,
    paymentRepository?: PaymentRepository,
    orderRepository?: OrderRepository,
    notificationService?: NotificationService
  ) {
    this.xenditService = xenditService || new XenditService();
    this.paymentRepository = paymentRepository || new PaymentRepository();
    this.orderRepository = orderRepository || new OrderRepository();
    this.notificationService = notificationService || new NotificationService();
  }

  /**
   * Helper untuk mendeteksi Bank Code dari string metode pembayaran
   */
  private resolveBankCode(codeOrName: string): string {
    const lower = codeOrName.toLowerCase();
    if (lower.includes('mandiri')) return 'MANDIRI';
    if (lower.includes('bri')) return 'BRI';
    if (lower.includes('bca')) return 'BCA';
    if (lower.includes('bni')) return 'BNI';
    if (lower.includes('permata')) return 'PERMATA';
    if (lower.includes('bsi')) return 'BSI';
    return 'MANDIRI';
  }

  /**
   * Helper untuk mendeteksi E-Wallet Channel Code dari string metode pembayaran
   */
  private resolveEwalletCode(codeOrName: string): string {
    const lower = codeOrName.toLowerCase();
    if (lower.includes('dana')) return 'ID_DANA';
    if (lower.includes('gopay')) return 'ID_GOPAY';
    if (lower.includes('shopee')) return 'ID_SHOPEEPAY';
    if (lower.includes('ovo')) return 'ID_OVO';
    if (lower.includes('linkaja')) return 'ID_LINKAJA';
    return 'ID_DANA';
  }

  /**
   * Membuat Pembayaran Otomatis Xendit (QRIS, Virtual Account Bank, E-Wallet)
   */
  async createPayment(orderIdRaw: string | number, paymentMethodCode?: string, phone?: string): Promise<any> {
    const orderId = typeof orderIdRaw === 'string'
      ? (CryptoUtil.decryptId(orderIdRaw) || parseInt(orderIdRaw, 10))
      : orderIdRaw;

    if (!orderId || isNaN(orderId)) {
      throw new Error('ID Pesanan tidak valid');
    }

    const order = await this.orderRepository.findById(orderId);
    if (!order) {
      throw new Error('Pesanan tidak ditemukan');
    }

    const subtotal = (order.quantity || 1) * (order.price_per_unit || 0);
    const deliveryFee = order.delivery_fee || 0;
    const discount = order.discount || 0;
    const totalAmount = Math.max(1000, subtotal + deliveryFee - discount);
    const orderCreator = Number(order.users_id ?? (order.user_id ? CryptoUtil.decryptId(order.user_id) : 1)) || 1;

    const method = (paymentMethodCode || order.notes || 'QRIS').toLowerCase();

    // 1. BANK TRANSFER / VIRTUAL ACCOUNT
    if (method.includes('bank') || method.includes('transfer') || method.includes('mandiri') || method.includes('bri') || method.includes('bca') || method.includes('bni') || method.includes('va')) {
      const bankCode = this.resolveBankCode(method);
      const externalId = `VA-${order.invoice_no}-${Date.now().toString().slice(-4)}`;

      const vaResult = await this.xenditService.createVirtualAccount({
        externalId,
        bankCode,
        name: `ALMAS - ${order.customer_name || 'Customer'}`,
        amount: totalAmount,
      });

      await this.paymentRepository.saveTransaction({
        orders_id: orderId,
        reference_id: externalId,
        qr_id: vaResult.id,
        qr_string: vaResult.account_number,
        amount: totalAmount,
        payment_method: `VA_${bankCode}`,
        status: 'PENDING',
        expires_at: vaResult.expires_at,
        payload: JSON.stringify(vaResult),
        creator: orderCreator,
      });

      return {
        order_id: CryptoUtil.encryptId(orderId),
        invoice_no: order.invoice_no,
        reference_id: externalId,
        payment_type: 'VIRTUAL_ACCOUNT',
        payment_method: `Virtual Account ${bankCode}`,
        bank_code: bankCode,
        account_number: vaResult.account_number,
        account_name: vaResult.name,
        amount: totalAmount,
        expires_at: vaResult.expires_at,
        status: 'PENDING',
        service_name: order.service_name,
      };
    }

    // 2. E-WALLET (DANA, GOPAY, SHOPEEPAY, OVO)
    if (method.includes('dana') || method.includes('gopay') || method.includes('shopee') || method.includes('ovo') || method.includes('ewallet')) {
      const channelCode = this.resolveEwalletCode(method);
      const referenceId = `EWL-${order.invoice_no}-${Date.now().toString().slice(-4)}`;

      const ewlResult = await this.xenditService.createEwalletCharge({
        referenceId,
        channelCode,
        amount: totalAmount,
        phone,
      });

      await this.paymentRepository.saveTransaction({
        orders_id: orderId,
        reference_id: referenceId,
        qr_id: ewlResult.id,
        qr_string: ewlResult.qr_string || ewlResult.checkout_url || '',
        amount: totalAmount,
        payment_method: `EWALLET_${channelCode}`,
        status: 'PENDING',
        expires_at: ewlResult.expires_at,
        payload: JSON.stringify(ewlResult),
        creator: orderCreator,
      });

      return {
        order_id: CryptoUtil.encryptId(orderId),
        invoice_no: order.invoice_no,
        reference_id: referenceId,
        payment_type: 'EWALLET',
        payment_method: channelCode.replace('ID_', ''),
        channel_code: channelCode,
        checkout_url: ewlResult.checkout_url,
        qr_string: ewlResult.qr_string,
        amount: totalAmount,
        expires_at: ewlResult.expires_at,
        status: 'PENDING',
        service_name: order.service_name,
      };
    }

    // 3. QRIS (DEFAULT)
    return this.createQrisPayment(orderIdRaw);
  }

  /**
   * Membuat pembayaran Dynamic QRIS Xendit untuk sebuah Pesanan
   */
  async createQrisPayment(orderIdRaw: string | number): Promise<any> {
    const orderId = typeof orderIdRaw === 'string'
      ? (CryptoUtil.decryptId(orderIdRaw) || parseInt(orderIdRaw, 10))
      : orderIdRaw;

    if (!orderId || isNaN(orderId)) {
      throw new Error('ID Pesanan tidak valid');
    }

    const order = await this.orderRepository.findById(orderId);
    if (!order) {
      throw new Error('Pesanan tidak ditemukan');
    }

    // Hitung total bayar
    const subtotal = (order.quantity || 1) * (order.price_per_unit || 0);
    const deliveryFee = order.delivery_fee || 0;
    const discount = order.discount || 0;
    const totalAmount = Math.max(1000, subtotal + deliveryFee - discount);

    // Cek apakah sudah ada transaksi aktif yang belum expired
    const existing = await this.paymentRepository.getTransactionByOrderId(orderId);
    if (existing && existing.status === 'PENDING' && existing.expires_at) {
      const isStillValid = new Date(existing.expires_at).getTime() > Date.now();
      if (isStillValid && existing.qr_string) {
        return {
          order_id: CryptoUtil.encryptId(orderId),
          invoice_no: order.invoice_no,
          reference_id: existing.reference_id,
          payment_type: existing.payment_method?.startsWith('VA_') ? 'VIRTUAL_ACCOUNT' : 'QRIS',
          qr_id: existing.qr_id,
          qr_string: existing.qr_string,
          account_number: existing.qr_string,
          amount: existing.amount,
          expires_at: existing.expires_at,
          status: existing.status,
          service_name: order.service_name,
        };
      }
    }

    // Buat QR Code baru via Xendit
    const referenceId = `XND-${order.invoice_no}-${Date.now().toString().slice(-4)}`;
    const xenditResult = await this.xenditService.createQrCode({
      referenceId,
      amount: totalAmount,
      description: `Pembayaran Laundry ${order.invoice_no}`,
    });

    const orderCreator = Number(order.users_id ?? (order.user_id ? CryptoUtil.decryptId(order.user_id) : 1)) || 1;

    // Simpan ke database
    await this.paymentRepository.saveTransaction({
      orders_id: orderId,
      reference_id: referenceId,
      qr_id: xenditResult.id,
      qr_string: xenditResult.qr_string,
      amount: totalAmount,
      payment_method: 'QRIS',
      status: 'PENDING',
      expires_at: xenditResult.expires_at,
      payload: JSON.stringify(xenditResult),
      creator: orderCreator,
    });

    return {
      order_id: CryptoUtil.encryptId(orderId),
      invoice_no: order.invoice_no,
      reference_id: referenceId,
      payment_type: 'QRIS',
      qr_id: xenditResult.id,
      qr_string: xenditResult.qr_string,
      amount: totalAmount,
      expires_at: xenditResult.expires_at,
      status: 'PENDING',
      service_name: order.service_name,
    };
  }

  /**
   * Simulasi Pembayaran Berhasil (Khusus Sandbox & Testing untuk QRIS / VA / E-Wallet)
   */
  async simulatePayment(orderIdRaw: string | number): Promise<any> {
    const orderId = typeof orderIdRaw === 'string'
      ? (CryptoUtil.decryptId(orderIdRaw) || parseInt(orderIdRaw, 10))
      : orderIdRaw;

    if (!orderId || isNaN(orderId)) {
      throw new Error('ID Pesanan tidak valid');
    }

    const tx = await this.paymentRepository.getTransactionByOrderId(orderId);
    if (!tx) {
      throw new Error('Transaksi pembayaran tidak ditemukan untuk pesanan ini');
    }

    const method = tx.payment_method || 'QRIS';

    // Panggil simulasi Xendit sesuai jenis channel
    if (method.startsWith('VA_')) {
      await this.xenditService.simulateVirtualAccountPayment(tx.reference_id, tx.amount);
    } else if (tx.qr_id) {
      await this.xenditService.simulatePayment(tx.qr_id, tx.amount);
    }

    const paymentLabel = method.replace('VA_', 'Virtual Account ').replace('EWALLET_ID_', 'E-Wallet ');

    // Update status transaksi menjadi PAID
    await this.paymentRepository.updateTransactionStatus(orderId, 'PAID', new Date());

    // Update status pesanan dan timeline
    await this.paymentRepository.markOrderAsPaid(orderId, paymentLabel);

    // Kirim notifikasi lonceng ke akun user sebagai bukti bayar
    try {
      const order = await this.orderRepository.findById(orderId);
      if (order) {
        await this.notificationService.notifyPaymentSuccess({
          order,
          amount: tx.amount,
          paymentMethod: paymentLabel,
        });
      }
    } catch (notifErr) {
      console.warn('[Payment Warning] Gagal mengirim notifikasi bayar berhasil:', notifErr);
    }

    return {
      success: true,
      message: `Pembayaran ${paymentLabel} berhasil diverifikasi! Status pesanan telah diperbarui menjadi Lunas.`,
      status: 'PAID',
    };
  }

  /**
   * Upload Bukti Pembayaran Manual (JPG/JPEG/PNG) yang otomatis di-convert ke WebP <= 1MB
   */
  async uploadPaymentProof(
    orderIdRaw: string | number,
    file?: Express.Multer.File,
    userIdRaw?: string | number
  ): Promise<any> {
    if (!file || !file.buffer) {
      throw new Error('File bukti transfer wajib disertakan.');
    }

    const orderId = typeof orderIdRaw === 'string'
      ? (CryptoUtil.decryptId(orderIdRaw) || parseInt(orderIdRaw, 10))
      : orderIdRaw;

    if (!orderId || isNaN(orderId)) {
      throw new Error('ID Pesanan tidak valid');
    }

    const order = await this.orderRepository.findById(orderId);
    if (!order) {
      throw new Error('Pesanan tidak ditemukan');
    }

    const userId = typeof userIdRaw === 'string'
      ? (CryptoUtil.decryptId(userIdRaw) || parseInt(userIdRaw, 10))
      : (userIdRaw || 1);

    // Proses konversi gambar ke WebP dan kompresi maksimal 1MB
    const processed = await ImageUtil.processAndSavePaymentProof(
      file.buffer,
      orderId,
      file.originalname,
      file.mimetype
    );

    const subtotal = (order.quantity || 1) * (order.price_per_unit || 0);
    const deliveryFee = order.delivery_fee || 0;
    const discount = order.discount || 0;
    const totalAmount = Math.max(1000, subtotal + deliveryFee - discount);

    // Simpan ke database
    await this.paymentRepository.savePaymentProof(orderId, processed.relativeUrl, Number(userId) || 1, totalAmount);

    return {
      order_id: CryptoUtil.encryptId(orderId),
      invoice_no: order.invoice_no,
      proof_image: processed.relativeUrl,
      file_size_kb: Math.round(processed.fileSizeBytes / 1024),
      format: processed.format,
      status: 'WAITING_VERIFICATION',
      message: 'Bukti transfer berhasil diunggah dalam format WebP dan menunggu verifikasi admin.',
    };
  }

  /**
   * Konfirmasi Pembayaran Manual oleh Admin / Kasir
   */
  async confirmManualPayment(orderIdRaw: string | number, adminUserId?: number): Promise<any> {
    const orderId = typeof orderIdRaw === 'string'
      ? (CryptoUtil.decryptId(orderIdRaw) || parseInt(orderIdRaw, 10))
      : orderIdRaw;

    if (!orderId || isNaN(orderId)) {
      throw new Error('ID Pesanan tidak valid');
    }

    const order = await this.orderRepository.findById(orderId);
    if (!order) {
      throw new Error('Pesanan tidak ditemukan');
    }

    const tx = await this.paymentRepository.getTransactionByOrderId(orderId);
    const amount = tx?.amount || Math.max(1000, (order.quantity || 1) * (order.price_per_unit || 0) + (order.delivery_fee || 0) - (order.discount || 0));

    // Update status transaksi menjadi PAID
    await this.paymentRepository.updateTransactionStatus(orderId, 'PAID', new Date(), adminUserId || 1);

    // Update status pesanan dan timeline
    await this.paymentRepository.markOrderAsPaid(orderId, 'Transfer Bank Manual (Diverifikasi Admin)');

    // Kirim notifikasi lonceng ke akun user sebagai bukti bayar
    try {
      await this.notificationService.notifyPaymentSuccess({
        order,
        amount,
        paymentMethod: 'Transfer Bank',
      });
    } catch (notifErr) {
      console.warn('[Payment Warning] Gagal mengirim notifikasi bayar berhasil:', notifErr);
    }

    return {
      success: true,
      message: `Pembayaran pesanan #${order.invoice_no} berhasil dikonfirmasi Lunas oleh admin!`,
      status: 'PAID',
    };
  }

  /**
   * Cek Status Pembayaran Pesanan
   */
  async getPaymentStatus(orderIdRaw: string | number): Promise<any> {
    const orderId = typeof orderIdRaw === 'string'
      ? (CryptoUtil.decryptId(orderIdRaw) || parseInt(orderIdRaw, 10))
      : orderIdRaw;

    if (!orderId || isNaN(orderId)) {
      throw new Error('ID Pesanan tidak valid');
    }

    const tx = await this.paymentRepository.getTransactionByOrderId(orderId);
    return {
      order_id: CryptoUtil.encryptId(orderId),
      status: tx?.status || 'UNPAID',
      paid_at: tx?.paid_at || null,
      amount: tx?.amount || 0,
      payment_method: tx?.payment_method || 'TRANSFER_BANK',
      proof_image: tx?.proof_image || null,
    };
  }

  /**
   * Menerima Webhook Callback dari Xendit Server (QRIS, VA Bank, & E-Wallet)
   */
  async handleXenditWebhook(payload: any, token?: string): Promise<any> {
    const isValid = this.xenditService.verifyWebhookToken(token);
    if (!isValid) {
      throw new Error('Token callback webhook Xendit tidak valid');
    }

    const event = payload?.event;
    const qrData = payload?.data || payload;
    const referenceId = qrData?.reference_id || qrData?.external_id || payload?.external_id || payload?.reference_id;
    const status = qrData?.status || payload?.status || (event?.includes('paid') || event?.includes('succeeded') ? 'PAID' : undefined);
    const source = qrData?.payment_detail?.source || payload?.bank_code || qrData?.channel_code || 'Xendit';

    if (!referenceId) {
      return { received: true, message: 'Tidak ada reference_id / external_id yang relevan' };
    }

    const tx = await this.paymentRepository.getTransactionByReferenceId(referenceId);
    if (tx) {
      if (status === 'SUCCEEDED' || status === 'COMPLETED' || status === 'PAID' || event === 'fva_paid' || event === 'ewallet.charge.succeeded') {
        const paymentLabel = tx.payment_method?.startsWith('VA_')
          ? tx.payment_method.replace('VA_', 'Virtual Account ')
          : (tx.payment_method?.startsWith('EWALLET_') ? tx.payment_method.replace('EWALLET_ID_', 'E-Wallet ') : (source && source !== 'QRIS' ? `QRIS (${source})` : 'QRIS'));

        await this.paymentRepository.updateTransactionStatus(referenceId, 'PAID', new Date());
        await this.paymentRepository.markOrderAsPaid(tx.orders_id, paymentLabel);

        // Kirim notifikasi lonceng ke akun user sebagai bukti bayar
        try {
          const order = await this.orderRepository.findById(tx.orders_id);
          if (order) {
            await this.notificationService.notifyPaymentSuccess({
              order,
              amount: tx.amount,
              paymentMethod: paymentLabel,
            });
          }
        } catch (notifErr) {
          console.warn('[Webhook Warning] Gagal mengirim notifikasi bayar berhasil:', notifErr);
        }
      } else if (status === 'EXPIRED' || event === 'fva_expired') {
        await this.paymentRepository.updateTransactionStatus(referenceId, 'EXPIRED');
        await this.paymentRepository.markOrderAsExpired(tx.orders_id);

        // Kirim notifikasi lonceng ke akun user bahwa waktu bayar habis & pesanan batal
        try {
          const order = await this.orderRepository.findById(tx.orders_id);
          if (order) {
            await this.notificationService.notifyPaymentExpired({ order });
          }
        } catch (notifErr) {
          console.warn('[Webhook Warning] Gagal mengirim notifikasi bayar expired:', notifErr);
        }
      }
    }

    return { received: true, success: true };
  }
}
