import { query } from '../config/database';

export interface InvoiceGeneratorOptions {
  prefix?: string;
  padding?: number;
  separator?: string;
  date?: Date;
}

export class InvoiceGeneratorUtil {
  /**
   * Format objek Date menjadi string YYYYMMDD
   * Contoh: 24 September 2026 -> "20260924"
   */
  public static formatDateCode(date: Date = new Date()): string {
    const yyyy = date.getFullYear().toString();
    const mm = (date.getMonth() + 1).toString().padStart(2, '0');
    const dd = date.getDate().toString().padStart(2, '0');
    return `${yyyy}${mm}${dd}`;
  }

  /**
   * Menghasilkan nomor Invoice harian berurutan dengan format: INV-YYYYMMDD-XXX
   * Contoh:
   *   - Pesanan ke-1 hari ini -> INV-20260924-001
   *   - Pesanan ke-2 hari ini -> INV-20260924-002
   * 
   * Counter otomatis direset kembali ke 001 setiap pergantian hari.
   */
  public static async generateInvoiceNo(options?: InvoiceGeneratorOptions): Promise<string> {
    const prefix = options?.prefix || 'INV';
    const padding = options?.padding || 3;
    const separator = options?.separator || '-';
    const targetDate = options?.date || new Date();

    const dateCode = this.formatDateCode(targetDate);
    const searchPattern = `${prefix}${separator}${dateCode}${separator}%`;

    try {
      // Cari invoice terakhir pada tanggal yang sama
      const rows = await query<any>(
        'SELECT invoice_no FROM orders WHERE invoice_no LIKE ? ORDER BY id_orders DESC LIMIT 1',
        [searchPattern]
      );

      let nextSequence = 1;

      if (rows && rows.length > 0 && rows[0].invoice_no) {
        const lastInvoice = rows[0].invoice_no;
        const parts = lastInvoice.split(separator);
        const lastSeqStr = parts[parts.length - 1];
        const lastSeqNum = parseInt(lastSeqStr, 10);

        if (!isNaN(lastSeqNum) && lastSeqNum > 0) {
          nextSequence = lastSeqNum + 1;
        }
      } else {
        // Alternatif: hitung total order yang dibuat pada tanggal tersebut
        const yyyyMmDd = `${targetDate.getFullYear()}-${(targetDate.getMonth() + 1)
          .toString()
          .padStart(2, '0')}-${targetDate.getDate().toString().padStart(2, '0')}`;

        const countRows = await query<any>(
          'SELECT COUNT(*) as total FROM orders WHERE DATE(order_date) = ? AND deleted_at IS NULL',
          [yyyyMmDd]
        );

        if (countRows && countRows.length > 0 && Number(countRows[0].total) > 0) {
          nextSequence = Number(countRows[0].total) + 1;
        }
      }

      const seqPadded = nextSequence.toString().padStart(padding, '0');
      return `${prefix}${separator}${dateCode}${separator}${seqPadded}`;
    } catch (_) {
      // Fallback generator acak jika terjadi kendala query
      const randomSeq = Math.floor(1 + Math.random() * 999)
        .toString()
        .padStart(padding, '0');
      return `${prefix}${separator}${dateCode}${separator}${randomSeq}`;
    }
  }
}
