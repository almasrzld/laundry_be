/**
 * Custom Crypto Helper untuk enkripsi & dekripsi data ID dan environment variable
 * Kompatibel dengan algoritma Crypto helper (Caesar shift + random injection + date padding + base64)
 */
export class CryptoUtil {
  /**
   * Fungsi dekripsi algoritma Crypto (Shift + substring padding deconstruction)
   */
  static dekripsi(input: string, shift: number = 3): string {
    if (!input || typeof input !== 'string') return '';
    try {
      // Handle potential URL space replacement for '+' in base64
      const normalized = input.trim().replace(/ /g, '+');
      let str = Buffer.from(normalized, 'base64').toString('latin1');
      // Potong 6 karakter awal (prefix random + tahun)
      str = str.substring(6);
      // Potong 7 karakter akhir (bulan + random suffix)
      str = str.substring(0, str.length - 7);
      // Buang 6 digit random di antara karakter pertama dan karakter berikutnya
      const str1 = str.substring(0, 1);
      const str2 = str.substring(7);
      str = str1 + str2;

      let output = '';
      for (let i = 0; i < str.length; i++) {
        const charCode = str.charCodeAt(i) + shift;
        output += String.fromCharCode(charCode);
      }
      return output;
    } catch (_) {
      return input;
    }
  }

  /**
   * Fungsi enkripsi algoritma Crypto
   */
  static enkripsi(input: string | number, shift: number = 3): string {
    const strInput = String(input);
    let output = '';
    for (let i = 0; i < strInput.length; i++) {
      const charCode = strInput.charCodeAt(i) - shift;
      output += String.fromCharCode(charCode);
    }

    const str1 = output.substring(0, 1);
    const str2 = output.substring(1);

    // Gunakan pseudo-random deterministik berbasis input nilai agar ID yang sama selalu menghasilkan token enkripsi yang konsisten
    const numInput = typeof input === 'number' ? input : (parseInt(strInput, 10) || 12345);
    const midRand = String((Math.abs(numInput * 16807 + 12345) % 900000) + 100000);
    const mid = str1 + midRand + str2;

    const yy = '26';
    const mm = '09';
    const startRand = String((Math.abs(numInput * 48271 + 6789) % 8888) + 1111).padStart(4, '0');
    const endRand = String((Math.abs(numInput * 65537 + 10101) % 89898) + 10101).padStart(5, '0');

    const fullStr = startRand + yy + mid + mm + endRand;
    return Buffer.from(fullStr, 'latin1').toString('base64');
  }

  /**
   * Enkripsi ID integer menjadi string terenkripsi untuk diekspos ke client (URL, JSON, inspect)
   */
  static encryptId(id: number | string | null | undefined): string | null {
    if (id === null || id === undefined || id === '') return null;
    return CryptoUtil.enkripsi(String(id));
  }

  /**
   * Dekripsi ID string terenkripsi dari client menjadi integer untuk database query
   */
  static decryptId(encryptedId: any): number | null {
    if (encryptedId === null || encryptedId === undefined || encryptedId === '') return null;
    if (typeof encryptedId === 'number' && Number.isInteger(encryptedId)) return encryptedId;

    let strVal = String(encryptedId).trim();
    try {
      strVal = decodeURIComponent(strVal);
    } catch (_) {}

    // Jika berupa integer mentah (misal legacy query param)
    if (/^\d+$/.test(strVal)) {
      return parseInt(strVal, 10);
    }

    try {
      const decrypted = CryptoUtil.dekripsi(strVal);
      const parsed = parseInt(decrypted, 10);
      if (!isNaN(parsed)) {
        return parsed;
      }
    } catch (_) {}

    return null;
  }

  /**
   * Rekursif mengubah ID (id, parent_id, user_id, order_id, role_id, dll) pada response data menjadi token terenkripsi
   */
  static transformResponse<T = any>(data: T): T {
    if (!data) return data;

    if (Array.isArray(data)) {
      return data.map((item) => CryptoUtil.transformResponse(item)) as unknown as T;
    }

    if (typeof data === 'object' && !(data instanceof Date)) {
      const transformed: any = { ...data };
      const nonIdKeys = ['creator', 'update_pic', 'delete_pic'];

      for (const key of Object.keys(transformed)) {
        const val = transformed[key];

        const isIdField =
          !nonIdKeys.includes(key) &&
          (key === 'id' ||
            key.startsWith('id_') ||
            key.endsWith('_id') ||
            ['parent_id', 'user_id', 'order_id', 'role_id', 'permission_id', 'menu_id'].includes(key));

        if (isIdField) {
          if (typeof val === 'number') {
            transformed[key] = CryptoUtil.encryptId(val);
          } else if (typeof val === 'string' && /^\d+$/.test(val)) {
            transformed[key] = CryptoUtil.encryptId(val);
          }
        } else if (typeof val === 'object' && val !== null) {
          transformed[key] = CryptoUtil.transformResponse(val);
        }
      }
      return transformed as T;
    }

    return data;
  }

  /**
   * Helper dekripsi otomatis untuk environment variable
   */
  static decryptEnvValue(value: string | undefined, defaultValue: string = ''): string {
    if (!value) return defaultValue;
    const trimmed = value.trim();
    if (!trimmed) return defaultValue;

    try {
      const decrypted = CryptoUtil.dekripsi(trimmed);
      if (decrypted && decrypted.length > 0 && /^[\x20-\x7E]+$/.test(decrypted)) {
        return decrypted;
      }
    } catch (_) {}

    return trimmed;
  }
}
