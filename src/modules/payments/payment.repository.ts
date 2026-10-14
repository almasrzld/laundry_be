import { query } from '../../config/database';
import { CryptoUtil } from '../../utils/crypto.util';

export interface PaymentTransactionEntity {
  id_payment_transactions?: number;
  orders_id: number;
  reference_id: string;
  qr_id?: string | null;
  qr_string?: string | null;
  amount: number;
  payment_method: string;
  status: string; // 'PENDING' | 'WAITING_VERIFICATION' | 'PAID' | 'EXPIRED' | 'CANCELLED'
  expires_at?: Date | string | null;
  paid_at?: Date | string | null;
  payload?: string | null;
  proof_image?: string | null;
  created_at?: Date | string;
  creator?: number;
  updated_at?: Date | string | null;
  update_pic?: number | null;
  deleted_at?: Date | string | null;
  delete_pic?: number | null;
}

export class PaymentRepository {
  private isTableInitialized = false;

  private async ensureTable(): Promise<void> {
    if (this.isTableInitialized) return;
    try {
      await query(`
        CREATE TABLE IF NOT EXISTS payment_transactions (
          id_payment_transactions INT AUTO_INCREMENT PRIMARY KEY,
          orders_id INT NOT NULL,
          reference_id VARCHAR(100) NOT NULL,
          qr_id VARCHAR(100) NULL,
          qr_string TEXT NULL,
          amount INT NOT NULL,
          payment_method VARCHAR(50) NOT NULL DEFAULT 'QRIS',
          status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
          expires_at DATETIME NULL,
          paid_at DATETIME NULL,
          payload TEXT NULL,
          proof_image TEXT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          creator BIGINT UNSIGNED NOT NULL,
          updated_at DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
          update_pic BIGINT UNSIGNED NULL,
          deleted_at DATETIME NULL,
          delete_pic BIGINT UNSIGNED NULL,
          INDEX idx_pay_orders (orders_id),
          INDEX idx_pay_ref (reference_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);

      // Pastikan kolom proof_image dan audit ada jika tabel sudah pernah dibuat sebelumnya
      try {
        await query(`ALTER TABLE payment_transactions ADD COLUMN proof_image TEXT NULL AFTER payload`);
      } catch (_) {}
      try {
        await query(`ALTER TABLE payment_transactions ADD COLUMN creator BIGINT UNSIGNED NOT NULL AFTER created_at`);
      } catch (_) {}
      try {
        await query(`ALTER TABLE payment_transactions ADD COLUMN update_pic BIGINT UNSIGNED NULL AFTER updated_at`);
      } catch (_) {}
      try {
        await query(`ALTER TABLE payment_transactions ADD COLUMN deleted_at DATETIME NULL AFTER update_pic`);
      } catch (_) {}
      try {
        await query(`ALTER TABLE payment_transactions ADD COLUMN delete_pic BIGINT UNSIGNED NULL AFTER deleted_at`);
      } catch (_) {}

      this.isTableInitialized = true;
    } catch (_) {
      // Ignored if already created
    }
  }

  private toMySqlDatetime(dateVal?: Date | string | null): string | null {
    if (!dateVal) return null;
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return null;
    return d.toISOString().slice(0, 19).replace('T', ' ');
  }

  async saveTransaction(data: PaymentTransactionEntity): Promise<number> {
    await this.ensureTable();
    const formattedExpiresAt = this.toMySqlDatetime(data.expires_at);
    const result = await query(
      `INSERT INTO payment_transactions 
       (orders_id, reference_id, qr_id, qr_string, amount, payment_method, status, expires_at, payload, creator)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.orders_id,
        data.reference_id,
        data.qr_id || null,
        data.qr_string || null,
        data.amount,
        data.payment_method,
        data.status,
        formattedExpiresAt,
        data.payload || null,
        data.creator,
      ]
    );
    return (result as any).insertId;
  }

  async getTransactionByOrderId(orderId: number): Promise<PaymentTransactionEntity | null> {
    await this.ensureTable();
    const rows = await query<PaymentTransactionEntity>(
      `SELECT * FROM payment_transactions WHERE orders_id = ? ORDER BY id_payment_transactions DESC LIMIT 1`,
      [orderId]
    );
    return rows.length > 0 ? rows[0] : null;
  }

  async getTransactionByReferenceId(refId: string): Promise<PaymentTransactionEntity | null> {
    await this.ensureTable();
    const rows = await query<PaymentTransactionEntity>(
      `SELECT * FROM payment_transactions WHERE reference_id = ? LIMIT 1`,
      [refId]
    );
    return rows.length > 0 ? rows[0] : null;
  }

  async updateTransactionStatus(
    refOrId: string | number,
    status: string,
    paidAt?: Date | string,
    updatePic?: number | null
  ): Promise<boolean> {
    await this.ensureTable();
    const isNum = typeof refOrId === 'number';
    const whereField = isNum ? 'orders_id' : 'reference_id';
    const formattedPaidAt = this.toMySqlDatetime(paidAt || new Date());
    
    await query(
      `UPDATE payment_transactions 
       SET status = ?, paid_at = COALESCE(?, paid_at), update_pic = ?, updated_at = NOW() 
       WHERE ${whereField} = ?`,
      [status, formattedPaidAt, updatePic || null, refOrId]
    );
    return true;
  }

  /**
   * Update status pesanan di tabel orders dan timeline saat lunas
   */
  async markOrderAsPaid(orderId: number, paymentMethodLabel = 'QRIS'): Promise<void> {
    // 1. Update notes dan status order
    await query(
      `UPDATE orders 
       SET notes = CONCAT(COALESCE(notes, ''), ' • [LUNAS via ${paymentMethodLabel}]'),
           updated_at = NOW()
       WHERE id_orders = ?`,
      [orderId]
    );

    // 2. Tambah timeline status pembayaran lunas
    const timelineRows = await query<any>(
      `SELECT COUNT(*) as count FROM order_timelines WHERE orders_id = ?`,
      [orderId]
    );
    const nextStep = (timelineRows[0]?.count || 0) + 1;

    await query(
      `INSERT INTO order_timelines (orders_id, title, description, time, is_completed, is_current, step_order, creator)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        orderId,
        'Pembayaran Lunas',
        `Pembayaran telah diterima dan terverifikasi secara otomatis via ${paymentMethodLabel}.`,
        'Baru saja',
        true,
        true,
        nextStep,
        1,
      ]
    );
  }

  /**
   * Update status pesanan di tabel orders dan timeline saat pembayaran kadaluarsa/dibatalkan
   */
  async markOrderAsExpired(orderId: number): Promise<void> {
    // 1. Update notes pada order
    await query(
      `UPDATE orders 
       SET notes = CONCAT(COALESCE(notes, ''), ' • [BATAL: Waktu Pembayaran Habis]'),
           updated_at = NOW()
       WHERE id_orders = ?`,
      [orderId]
    );

    // 2. Tambah timeline status pesanan dibatalkan
    const timelineRows = await query<any>(
      `SELECT COUNT(*) as count FROM order_timelines WHERE orders_id = ?`,
      [orderId]
    );
    const nextStep = (timelineRows[0]?.count || 0) + 1;

    await query(
      `INSERT INTO order_timelines (orders_id, title, description, time, is_completed, is_current, step_order, creator)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        orderId,
        'Pesanan Dibatalkan',
        'Batas waktu pembayaran telah berakhir. Pesanan otomatis dibatalkan oleh sistem.',
        'Baru saja',
        true,
        true,
        nextStep,
        1,
      ]
    );
  }

  /**
   * Menyimpan bukti transfer manual dan mengubah status menjadi WAITING_VERIFICATION
   */
  async savePaymentProof(orderId: number, proofImageUrl: string, userId: number, amount = 0): Promise<void> {
    await this.ensureTable();
    const existing = await this.getTransactionByOrderId(orderId);
    if (existing) {
      await query(
        `UPDATE payment_transactions 
         SET proof_image = ?, status = 'WAITING_VERIFICATION', update_pic = ?, updated_at = NOW() 
         WHERE orders_id = ?`,
        [proofImageUrl, userId, orderId]
      );
    } else {
      await query(
        `INSERT INTO payment_transactions 
         (orders_id, reference_id, amount, payment_method, status, proof_image, creator)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          orderId,
          `PROOF-${orderId}-${Date.now().toString().slice(-4)}`,
          amount,
          'TRANSFER BANK',
          'WAITING_VERIFICATION',
          proofImageUrl,
          userId,
        ]
      );
    }

    // Tambah timeline status bukti pembayaran diunggah
    const timelineRows = await query<any>(
      `SELECT COUNT(*) as count FROM order_timelines WHERE orders_id = ?`,
      [orderId]
    );
    const nextStep = (timelineRows[0]?.count || 0) + 1;

    await query(
      `INSERT INTO order_timelines (orders_id, title, description, time, is_completed, is_current, step_order, creator)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        orderId,
        'Bukti Pembayaran Diunggah',
        'Bukti transfer telah berhasil diunggah. Menunggu verifikasi oleh tim admin/kasir.',
        'Baru saja',
        true,
        true,
        nextStep,
        userId,
      ]
    );
  }
}
