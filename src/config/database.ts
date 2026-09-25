import mysql from 'mysql2/promise';
import pc from 'picocolors';
import { ENV } from './env';

// Inisialisasi Connection Pool MySQL
export const pool = mysql.createPool({
  host: ENV.DB_HOST,
  port: ENV.DB_PORT,
  user: ENV.DB_USERNAME,
  password: ENV.DB_PASSWORD,
  database: ENV.DB_DATABASE,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
});

/**
 * Helper untuk mengeksekusi query SQL dengan prepared statements dan query logger di terminal
 */
export const query = async <T = any>(sql: string, params: any[] = []): Promise<T[]> => {
  const start = Date.now();
  try {
    const [results] = await pool.execute(sql, params);
    const duration = Date.now() - start;
    const cleanSql = sql.replace(/\s+/g, ' ').trim();
    console.log(`  ${pc.gray('└─')} ${pc.magenta('[SQL Query]')} ${pc.gray(`(${duration}ms)`)} ${pc.cyan(cleanSql)} ${params.length > 0 ? pc.gray(`| Params: ${JSON.stringify(params)}`) : ''}`);
    return results as T[];
  } catch (error: any) {
    const cleanSql = sql.replace(/\s+/g, ' ').trim();
    console.error(`  ${pc.red('└─')} ${pc.bold(pc.red('[SQL Error]'))} ${error.message} ${pc.gray(`(SQL: ${cleanSql})`)}`);
    throw error;
  }
};

/**
 * Test koneksi database saat server pertama kali start
 */
export const testDatabaseConnection = async (): Promise<boolean> => {
  try {
    const connection = await pool.getConnection();
    console.log(`  ${pc.green('✔')} ${pc.bold(pc.green('[Database]'))} Berhasil terhubung ke MySQL ${pc.cyan(`${ENV.DB_HOST}:${ENV.DB_PORT}/${ENV.DB_DATABASE}`)}`);
    connection.release();
    return true;
  } catch (error: any) {
    console.warn(`  ${pc.yellow('▲')} ${pc.bold(pc.yellow('[Database Warning]'))} Gagal terhubung ke MySQL (${error.message}).`);
    return false;
  }
};


