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

    // Auto-create point_histories table if not exists
    try {
      await connection.query(`
        CREATE TABLE IF NOT EXISTS point_histories (
          id_point_histories INT AUTO_INCREMENT PRIMARY KEY,
          users_id INT NOT NULL,
          orders_id INT NULL,
          points INT NOT NULL,
          type VARCHAR(20) NOT NULL DEFAULT 'earn',
          title VARCHAR(150) NOT NULL,
          description VARCHAR(255) NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_point_users (users_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);
    } catch (e: any) {
      console.warn('  ▲ [Migration Info] point_histories table check:', e.message);
    }

    // Auto-add reward_points_awarded column to orders if not exists
    try {
      await connection.query(`
        ALTER TABLE orders ADD COLUMN reward_points_awarded TINYINT(1) NOT NULL DEFAULT 0;
      `);
    } catch (_) {
      // Column already exists
    }

    connection.release();
    return true;
  } catch (error: any) {
    console.warn(`  ${pc.yellow('▲')} ${pc.bold(pc.yellow('[Database Warning]'))} Gagal terhubung ke MySQL (${error.message}).`);
    return false;
  }
};


