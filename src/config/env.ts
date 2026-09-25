import dotenv from 'dotenv';
import { CryptoUtil } from '../utils/crypto.util';

dotenv.config();

export const ENV = {
  PORT: parseInt(process.env.PORT || '5000', 10),
  NODE_ENV: process.env.NODE_ENV || 'development',
  JWT_SECRET: process.env.JWT_SECRET || '',

  // Database Configurations (semua dari .env, otomatis dekripsi jika terenkripsi)
  DB_CONNECTION: process.env.DB_CONNECTION || 'mysql',
  DB_HOST: CryptoUtil.decryptEnvValue(process.env.DB_HOST),
  DB_PORT: parseInt(CryptoUtil.decryptEnvValue(process.env.DB_PORT, '3306'), 10),
  DB_DATABASE: CryptoUtil.decryptEnvValue(process.env.DB_DATABASE),
  DB_USERNAME: CryptoUtil.decryptEnvValue(process.env.DB_USERNAME),
  DB_PASSWORD: CryptoUtil.decryptEnvValue(process.env.DB_PASSWORD),
};

