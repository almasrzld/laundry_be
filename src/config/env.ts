import dotenv from 'dotenv';
import { CryptoUtil } from '../utils/crypto.util';

dotenv.config();

export const ENV = {
  PORT: Number(process.env.PORT),
  NODE_ENV: process.env.NODE_ENV ?? '',
  JWT_SECRET: process.env.JWT_SECRET ?? '',
  AUTO_LOGOUT_MINUTES: Number(process.env.AUTO_LOGOUT_MINUTES),
  FRONTEND_URL: process.env.FRONTEND_URL ?? '',
  BACKEND_URL: process.env.BACKEND_URL ?? '',
  MOBILE_APP_URL: process.env.MOBILE_APP_URL ?? '',

  // Database Configurations (semua murni dari .env, otomatis dekripsi jika terenkripsi)
  DB_CONNECTION: process.env.DB_CONNECTION ?? '',
  DB_HOST: CryptoUtil.decryptEnvValue(process.env.DB_HOST),
  DB_PORT: Number(CryptoUtil.decryptEnvValue(process.env.DB_PORT)),
  DB_DATABASE: CryptoUtil.decryptEnvValue(process.env.DB_DATABASE),
  DB_USERNAME: CryptoUtil.decryptEnvValue(process.env.DB_USERNAME),
  DB_PASSWORD: CryptoUtil.decryptEnvValue(process.env.DB_PASSWORD),

  // Xendit Payment Gateway Configurations
  XENDIT_SECRET_KEY: process.env.XENDIT_SECRET_KEY ?? '',
  XENDIT_WEBHOOK_VERIFICATION_TOKEN: process.env.XENDIT_WEBHOOK_VERIFICATION_TOKEN ?? '',
};

