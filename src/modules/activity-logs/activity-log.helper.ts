import { Request } from 'express';
import { requestContext, extractClientIp, extractClientLocation } from '../../middleware/request-context.middleware';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';
import { UserCodeUtil } from '../../utils/user-code.util';
import { CryptoUtil } from '../../utils/crypto.util';
import { ActivityLogRepository } from './activity-log.repository';

let _activityLogRepo: ActivityLogRepository | null = null;
function getRepo(): ActivityLogRepository {
  if (!_activityLogRepo) {
    _activityLogRepo = new ActivityLogRepository();
  }
  return _activityLogRepo;
}

/**
 * Mendekripsi string token ID yang terenkripsi dan merapikan teks agar menampilkan format ID yang jelas (contoh: "ID 40" bukan "#40").
 */
export function decryptEncryptedText(text: string): string {
  if (!text || typeof text !== 'string') return text;

  let result = text;

  // 1. Pola #<hash> -> ID <decryptedNumber>
  result = result.replace(/#([A-Za-z0-9+/=]{10,64})/g, (match, p1) => {
    const dec = CryptoUtil.decryptId(p1);
    return dec !== null ? `ID ${dec}` : match;
  });

  // 2. Pola ID: <hash> atau ID <hash> -> ID <decryptedNumber>
  result = result.replace(/\bID[:\s]+([A-Za-z0-9+/=]{10,64})/gi, (match, p1) => {
    const dec = CryptoUtil.decryptId(p1);
    return dec !== null ? `ID ${dec}` : match;
  });

  // 3. Pola dalam kurung siku [ '<hash>' ] -> [ ID <decryptedNumber> ]
  result = result.replace(/\[\s*['"]([A-Za-z0-9+/=]{10,64})['"]\s*\]/g, (match, p1) => {
    const dec = CryptoUtil.decryptId(p1);
    return dec !== null ? `[ ID ${dec} ]` : match;
  });

  // 4. Token hash base64 mandiri (panjang 16-64) -> ID <decryptedNumber>
  result = result.replace(/\b([A-Za-z0-9+/=]{16,64})\b/g, (match) => {
    const dec = CryptoUtil.decryptId(match);
    return dec !== null ? `ID ${dec}` : match;
  });

  // 5. Gantikan pola "#<number>" menjadi "ID <number>" (misal: "#40" -> "ID 40", "#12" -> "ID 12")
  result = result.replace(/(?<![A-Za-z0-9_-])#(\d+)\b/g, 'ID $1');

  // 6. Normalisasi "ID: <number>" atau "ID #<number>" -> "ID <number>"
  result = result.replace(/\bID[:\s]+#?(\d+)\b/gi, 'ID $1');

  // 7. Normalisasi format kurung siku [ <number> ] atau [ #<number> ] -> [ ID <number> ]
  result = result.replace(/\[\s*#?(\d+)\s*\]/g, '[ ID $1 ]');

  return result;
}

/**
 * Sanitasi dan rekursif dekripsi payload log aktivitas
 * Mengubah seluruh encrypted ID menjadi angka asli dan membuang data sensitif
 */
export function sanitizeAndDecryptPayload(payload: any): any {
  if (payload === null || payload === undefined || payload === '') {
    return null;
  }

  // Jika string tunggal
  if (typeof payload === 'string') {
    const trimmed = payload.trim();
    if (trimmed.length >= 10 && trimmed.length <= 64 && !trimmed.includes(' ') && !trimmed.startsWith('data:')) {
      const dec = CryptoUtil.decryptId(trimmed);
      if (dec !== null) return dec;
    }
    return trimmed;
  }

  // Jika number atau boolean
  if (typeof payload === 'number' || typeof payload === 'boolean') {
    return payload;
  }

  // Jika array
  if (Array.isArray(payload)) {
    const cleanedArr = payload
      .map((item) => sanitizeAndDecryptPayload(item))
      .filter((item) => item !== null && item !== undefined && item !== '');
    return cleanedArr.length > 0 ? cleanedArr : null;
  }

  // Jika object
  if (typeof payload === 'object' && !(payload instanceof Date)) {
    const cleanedObj: Record<string, any> = {};
    const sensitiveKeys = [
      'password', 'current_password', 'new_password', 'pin', 'token',
      'access_token', 'refresh_token', 'file', 'filebytes', 'image', 'photo'
    ];

    for (const key of Object.keys(payload)) {
      const lowerKey = key.toLowerCase();
      if (sensitiveKeys.includes(lowerKey) || lowerKey.includes('password') || lowerKey.includes('secret')) {
        continue;
      }

      const val = payload[key];
      if (val === null || val === undefined || val === '') {
        continue;
      }

      if (typeof val === 'string') {
        const trimmedVal = val.trim();
        const isIdField =
          lowerKey === 'id' ||
          lowerKey.startsWith('id_') ||
          lowerKey.endsWith('_id') ||
          lowerKey.includes('id');

        if (isIdField && trimmedVal.length >= 10 && trimmedVal.length <= 64 && !trimmedVal.includes(' ')) {
          const dec = CryptoUtil.decryptId(trimmedVal);
          cleanedObj[key] = dec !== null ? dec : trimmedVal;
        } else {
          cleanedObj[key] = trimmedVal;
        }
      } else {
        cleanedObj[key] = sanitizeAndDecryptPayload(val);
      }
    }

    return Object.keys(cleanedObj).length > 0 ? cleanedObj : null;
  }

  return payload;
}

/**
 * Core function to record an activity log
 */
export async function recordActivityLog(
  logType: 'main' | 'secondary',
  arg1: any,
  arg2?: any,
  arg3?: any
): Promise<void> {
  try {
    let effectiveReq: AuthenticatedRequest | undefined;
    let activityText = '';
    let payloadData: any = [];

    // Polymorphic signature handling:
    // 1. (req, 'Activity message', [payload])
    if (arg1 && typeof arg1 === 'object' && ('headers' in arg1 || 'method' in arg1 || 'url' in arg1)) {
      effectiveReq = arg1 as AuthenticatedRequest;
      activityText = typeof arg2 === 'string' ? arg2 : String(arg2 || '');
      payloadData = arg3 !== undefined ? arg3 : [];
    }
    // 2. ('Activity message', [payload], req)
    else {
      activityText = typeof arg1 === 'string' ? arg1 : String(arg1 || '');
      payloadData = arg2 !== undefined ? arg2 : [];
      if (arg3 && typeof arg3 === 'object' && ('headers' in arg3 || 'method' in arg3)) {
        effectiveReq = arg3 as AuthenticatedRequest;
      }
    }

    // Fallback to AsyncLocalStorage requestContext if req was not passed
    if (!effectiveReq) {
      const store = requestContext.getStore();
      effectiveReq = store?.req as AuthenticatedRequest | undefined;
    }

    let usersId: number | null = null;
    let userCode: string | null = null;
    let userName: string | null = null;
    let userRole: string | null = null;
    let ipAddress: string | null = null;
    let location: string | null = null;
    let userAgent: string | null = null;

    if (effectiveReq) {
      ipAddress = extractClientIp(effectiveReq);
      location = extractClientLocation(effectiveReq);
      userAgent = typeof effectiveReq.headers['user-agent'] === 'string' ? effectiveReq.headers['user-agent'] : null;

      const user = effectiveReq.user;
      if (user) {
        const rawId = user.id ?? (user as any).id_users;
        if (rawId) {
          usersId = CryptoUtil.decryptId(rawId) ?? (typeof rawId === 'number' ? rawId : parseInt(String(rawId), 10) || null);
        }

        userName = user.name || (user as any).name_users || (user as any).username || null;
        userRole = user.role || user.role_code || null;

        // User Code (e.g. 102600002)
        if (user.user_code && /^\d{9}$/.test(String(user.user_code))) {
          userCode = String(user.user_code);
        } else if (usersId) {
          const resolved = await UserCodeUtil.resolveUserCodeAsync({
            id_users: usersId,
            role_code: userRole || undefined,
            created_at: (user as any).created_at,
          });
          userCode = resolved ? String(resolved) : String(usersId);
        }
      }
    }

    // Fallback deteksi user dari payload jika login/register
    if (!usersId && payloadData && typeof payloadData === 'object') {
      const candidateId = payloadData.user_id || payloadData.id_users || payloadData.id;
      if (candidateId) {
        usersId = CryptoUtil.decryptId(candidateId) ?? (typeof candidateId === 'number' ? candidateId : parseInt(String(candidateId), 10) || null);
        if (usersId) {
          const resolved = await UserCodeUtil.resolveUserCodeAsync({
            id_users: usersId,
            role_code: payloadData.role || payloadData.role_code,
          });
          if (resolved) userCode = String(resolved);
        }
      }
      if (!userName && payloadData.email) {
        userName = payloadData.email;
      }
    }

    // Dekripsi teks aktivitas dan pastikan tidak mengandung ID enkripsi
    activityText = decryptEncryptedText(activityText);

    // Deteksi jika aktivitas berasal dari perangkat / aplikasi mobile
    let isMobile = false;
    if (effectiveReq) {
      const platformHeader = (
        effectiveReq.headers['x-platform'] ||
        effectiveReq.headers['x-client-platform'] ||
        effectiveReq.headers['x-app-platform'] ||
        ''
      ).toString().toLowerCase();

      const userAgentLower = (userAgent || '').toLowerCase();
      isMobile = (
        platformHeader.includes('mobile') ||
        platformHeader.includes('android') ||
        platformHeader.includes('ios') ||
        platformHeader.includes('flutter') ||
        userAgentLower.includes('dart') ||
        userAgentLower.includes('flutter') ||
        userAgentLower.includes('okhttp') ||
        userAgentLower.includes('dalvik') ||
        userAgentLower.includes('android') ||
        userAgentLower.includes('iphone') ||
        userAgentLower.includes('ipad')
      );
    }

    // Sanitasi dan dekripsi payload data
    const sanitizedPayload = sanitizeAndDecryptPayload(payloadData);

    await getRepo().create({
      log_type: logType,
      users_id: usersId,
      user_code: userCode,
      user_name: userName,
      user_role: userRole,
      activity: activityText,
      ip_address: ipAddress,
      location: location,
      user_agent: userAgent,
      payload: sanitizedPayload,
      creator: usersId || null,
    });
  } catch (err: any) {
    console.warn('[ActivityLog Warning] Gagal menyimpan log aktivitas:', err?.message || err);
  }
}

/**
 * Mencatat Aktivitas Utama (Main Log)
 * Contoh:
 * ActivityLogMain('Mengakses Halaman Master Data Cabang', []);
 * ActivityLogMain(req, 'Mengakses Halaman Master Data Cabang', []);
 */
export function ActivityLogMain(activity: string, payload?: any, req?: Request | AuthenticatedRequest): Promise<void>;
export function ActivityLogMain(req: Request | AuthenticatedRequest, activity: string, payload?: any): Promise<void>;
export function ActivityLogMain(arg1: any, arg2?: any, arg3?: any): Promise<void> {
  return recordActivityLog('main', arg1, arg2, arg3);
}

/**
 * Mencatat Aktivitas Sekunder (Secondary Log)
 * Contoh:
 * ActivityLogSecondary('Mengambil Daftar Satuan', []);
 * ActivityLogSecondary(req, 'Mengambil Detail Pelanggan', []);
 */
export function ActivityLogSecondary(activity: string, payload?: any, req?: Request | AuthenticatedRequest): Promise<void>;
export function ActivityLogSecondary(req: Request | AuthenticatedRequest, activity: string, payload?: any): Promise<void>;
export function ActivityLogSecondary(arg1: any, arg2?: any, arg3?: any): Promise<void> {
  return recordActivityLog('secondary', arg1, arg2, arg3);
}

// Alias lowercase untuk kemudahan pemanggilan fleksibel
export const activityLogMain = ActivityLogMain;
export const activityLogSecondary = ActivityLogSecondary;
