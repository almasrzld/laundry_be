import * as admin from 'firebase-admin';
import * as path from 'path';
import * as fs from 'fs';

let firebaseApp: admin.app.App | null = null;

export function getFirebaseAdmin(): admin.app.App | null {
  if (firebaseApp) return firebaseApp;

  try {
    const defaultPath = path.resolve(__dirname, 'firebase-service-account.json');
    const envPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH
      ? path.resolve(process.cwd(), process.env.FIREBASE_SERVICE_ACCOUNT_PATH)
      : null;

    const credentialsPath = envPath && fs.existsSync(envPath)
      ? envPath
      : fs.existsSync(defaultPath)
      ? defaultPath
      : null;

    if (!credentialsPath) {
      console.log('ℹ️  [Firebase FCM] File kredensial firebase-service-account.json belum ditemukan di src/config/. Push notification FCM berjalan dalam mode simulasi/standby.');
      return null;
    }

    const serviceAccount = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));

    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });

    console.log('🔥 [Firebase FCM] Firebase Admin SDK berhasil diinisialisasi untuk push notifications.');
    return firebaseApp;
  } catch (error) {
    console.warn('⚠️  [Firebase FCM] Gagal menginisialisasi Firebase Admin:', (error as any)?.message || error);
    return null;
  }
}

export function getMessaging(): admin.messaging.Messaging | null {
  const app = getFirebaseAdmin();
  if (!app) return null;
  try {
    return admin.messaging(app);
  } catch {
    return null;
  }
}
