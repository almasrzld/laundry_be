import { query } from '../../config/database';
import { getMessaging } from '../../config/firebase';
import { CryptoUtil } from '../../utils/crypto.util';

export interface PushNotificationPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
  imageUrl?: string;
}

export class FcmService {
  /**
   * Mendaftarkan / memperbarui token FCM perangkat user ke database
   */
  static async registerDeviceToken(
    userId: number | string,
    fcmToken: string,
    deviceType: string = 'android',
    deviceName?: string
  ): Promise<boolean> {
    if (!fcmToken || !fcmToken.trim()) return false;

    let resolvedUserId: number | null = null;
    if (typeof userId === 'string') {
      resolvedUserId = CryptoUtil.decryptId(userId);
      if (!resolvedUserId && /^\d+$/.test(userId)) {
        resolvedUserId = parseInt(userId, 10);
      }
    } else {
      resolvedUserId = userId;
    }

    if (!resolvedUserId) return false;

    const cleanToken = fcmToken.trim();
    const cleanType = (deviceType || 'android').toLowerCase().slice(0, 20);
    const cleanName = deviceName ? deviceName.trim().slice(0, 100) : null;

    // Cek apakah token sudah ada
    const existing = await query<any>(
      'SELECT id_user_devices, users_id FROM user_devices WHERE fcm_token = ? LIMIT 1',
      [cleanToken]
    );

    if (existing.length > 0) {
      await query(
        'UPDATE user_devices SET users_id = ?, device_type = ?, device_name = ?, is_active = 1, updated_at = NOW() WHERE fcm_token = ?',
        [resolvedUserId, cleanType, cleanName, cleanToken]
      );
    } else {
      await query(
        'INSERT INTO user_devices (users_id, fcm_token, device_type, device_name, is_active, created_at) VALUES (?, ?, ?, ?, 1, NOW())',
        [resolvedUserId, cleanToken, cleanType, cleanName]
      );
    }

    return true;
  }

  /**
   * Menonaktifkan / menghapus token FCM perangkat saat logout
   */
  static async removeDeviceToken(userId: number | string, fcmToken?: string): Promise<boolean> {
    let resolvedUserId: number | null = null;
    if (typeof userId === 'string') {
      resolvedUserId = CryptoUtil.decryptId(userId);
      if (!resolvedUserId && /^\d+$/.test(userId)) {
        resolvedUserId = parseInt(userId, 10);
      }
    } else {
      resolvedUserId = userId;
    }

    if (!resolvedUserId && !fcmToken) return false;

    if (fcmToken && fcmToken.trim()) {
      await query('DELETE FROM user_devices WHERE fcm_token = ?', [fcmToken.trim()]);
    } else if (resolvedUserId) {
      await query('DELETE FROM user_devices WHERE users_id = ?', [resolvedUserId]);
    }

    return true;
  }

  /**
   * Mengirim push notification langsung ke seluruh perangkat aktif seorang user
   */
  static async sendToUser(
    userId: number | string,
    payload: PushNotificationPayload
  ): Promise<{ success: boolean; sentCount: number }> {
    let resolvedUserId: number | null = null;
    if (typeof userId === 'string') {
      resolvedUserId = CryptoUtil.decryptId(userId);
      if (!resolvedUserId && /^\d+$/.test(userId)) {
        resolvedUserId = parseInt(userId, 10);
      }
    } else {
      resolvedUserId = userId;
    }

    if (!resolvedUserId) return { success: false, sentCount: 0 };

    const messaging = getMessaging();
    if (!messaging) {
      // Firebase credentials belum dipasang, catat log simulasi tanpa error
      console.log(`📡 [FCM Mock] Push Notification ke User ID ${resolvedUserId}: "${payload.title}" - ${payload.body}`);
      return { success: true, sentCount: 0 };
    }

    // Ambil seluruh token aktif milik user
    const devices = await query<any>(
      'SELECT id_user_devices, fcm_token FROM user_devices WHERE users_id = ? AND is_active = 1',
      [resolvedUserId]
    );

    if (devices.length === 0) {
      return { success: true, sentCount: 0 };
    }

    const tokens = devices.map((d: any) => d.fcm_token).filter(Boolean);
    if (tokens.length === 0) return { success: true, sentCount: 0 };

    try {
      const response = await messaging.sendEachForMulticast({
        tokens,
        notification: {
          title: payload.title,
          body: payload.body,
          imageUrl: payload.imageUrl,
        },
        data: payload.data || {},
        android: {
          priority: 'high',
          notification: {
            sound: 'default',
            channelId: 'almas_laundry_notifications',
            priority: 'high',
            defaultSound: true,
            defaultVibrateTimings: true,
          },
        },
        apns: {
          payload: {
            aps: {
              sound: 'default',
              badge: 1,
            },
          },
        },
      });

      // Bersihkan token yang sudah tidak valid / expired dari database
      const deadTokens: string[] = [];
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          const errCode = resp.error?.code;
          if (
            errCode === 'messaging/invalid-registration-token' ||
            errCode === 'messaging/registration-token-not-registered'
          ) {
            deadTokens.push(tokens[idx]);
          }
        }
      });

      if (deadTokens.length > 0) {
        const placeholders = deadTokens.map(() => '?').join(',');
        await query(`DELETE FROM user_devices WHERE fcm_token IN (${placeholders})`, deadTokens);
      }

      return { success: true, sentCount: response.successCount };
    } catch (err) {
      console.error('⚠️ [FCM Send Error]:', (err as any)?.message || err);
      return { success: false, sentCount: 0 };
    }
  }

  /**
   * Mengirim push notification ke beberapa user sekaligus (Broadcast / Batch)
   */
  static async sendToUsers(
    userIds: (number | string)[],
    payload: PushNotificationPayload
  ): Promise<void> {
    for (const uId of userIds) {
      await this.sendToUser(uId, payload);
    }
  }
}
