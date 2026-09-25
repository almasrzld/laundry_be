import { query } from '../config/database';

export interface PromoCodeGeneratorOptions {
  prefix?: string;
  padding?: number;
  date?: Date;
  mode?: 'sequence' | 'random';
}

export class PromoGeneratorUtil {
  /**
   * Format objek Date menjadi string YYYYMM (Tahun dan Bulan)
   * Contoh: September 2026 -> "202609"
   */
  public static formatYearMonth(date: Date = new Date()): string {
    const yyyy = date.getFullYear().toString();
    const mm = (date.getMonth() + 1).toString().padStart(2, '0');
    return `${yyyy}${mm}`;
  }

  /**
   * Menghasilkan karakter alfanumerik acak kapital tanpa huruf ambigu (O, 0, I, 1)
   */
  public static generateRandomAlphanumeric(length: number = 6): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  /**
   * Menghasilkan kode promo otomatis tanpa tanda strip (-)
   * Mode:
   * - 'sequence': Format berurutan PROMOYYYYMMXXX (Contoh: PROMO202609001)
   * - 'random': Format acak PROMOXXXXXX (Contoh: PROMO8K3P9X)
   */
  public static async generatePromoCode(options?: PromoCodeGeneratorOptions): Promise<string> {
    const prefix = options?.prefix || 'PROMO';
    const mode = options?.mode || 'sequence';
    const padding = options?.padding || 3;
    const targetDate = options?.date || new Date();
    const ymCode = this.formatYearMonth(targetDate);

    // Mode Acak (Random) saat user mengklik "Acak Kode"
    if (mode === 'random') {
      let candidate = `${prefix}${this.generateRandomAlphanumeric(6)}`;
      let attempts = 0;
      while (attempts < 10) {
        try {
          const check = await query<any>(
            'SELECT id_promos FROM promos WHERE code = ? AND deleted_at IS NULL LIMIT 1',
            [candidate]
          );
          if (!check || check.length === 0) {
            return candidate;
          }
        } catch (_) {
          return candidate;
        }
        candidate = `${prefix}${this.generateRandomAlphanumeric(6)}`;
        attempts++;
      }
      return candidate;
    }

    // Mode Berurutan (Sequence)
    const searchPattern = `${prefix}${ymCode}%`;

    try {
      const rows = await query<any>(
        'SELECT code FROM promos WHERE code LIKE ? AND deleted_at IS NULL ORDER BY id_promos DESC',
        [searchPattern]
      );

      let nextSequence = 1;

      if (rows && rows.length > 0) {
        for (const row of rows) {
          const codeStr = String(row.code || '').toUpperCase();
          const numPart = codeStr.replace(new RegExp(`^${prefix}${ymCode}`, 'i'), '');
          const parsed = parseInt(numPart, 10);
          if (!isNaN(parsed) && parsed >= nextSequence) {
            nextSequence = parsed + 1;
          }
        }
      }

      const seqPadded = nextSequence.toString().padStart(padding, '0');
      let candidate = `${prefix}${ymCode}${seqPadded}`;

      // Pastikan benar-benar unik
      let check = await query<any>(
        'SELECT id_promos FROM promos WHERE code = ? AND deleted_at IS NULL LIMIT 1',
        [candidate]
      );
      while (check && check.length > 0) {
        nextSequence++;
        candidate = `${prefix}${ymCode}${nextSequence.toString().padStart(padding, '0')}`;
        check = await query<any>(
          'SELECT id_promos FROM promos WHERE code = ? AND deleted_at IS NULL LIMIT 1',
          [candidate]
        );
      }

      return candidate;
    } catch (_) {
      const randomSeq = Math.floor(100 + Math.random() * 900).toString();
      return `${prefix}${ymCode}${randomSeq}`;
    }
  }
}
