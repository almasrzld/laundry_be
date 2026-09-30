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
          creator BIGINT UNSIGNED NOT NULL,
          updated_at DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
          update_pic BIGINT UNSIGNED NULL,
          deleted_at DATETIME NULL,
          delete_pic BIGINT UNSIGNED NULL,
          INDEX idx_point_users (users_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);
      try {
        await connection.query(`ALTER TABLE point_histories ADD COLUMN creator BIGINT UNSIGNED NOT NULL AFTER created_at`);
      } catch (_) {}
      try {
        await connection.query(`ALTER TABLE point_histories ADD COLUMN updated_at DATETIME NULL ON UPDATE CURRENT_TIMESTAMP AFTER creator`);
      } catch (_) {}
      try {
        await connection.query(`ALTER TABLE point_histories ADD COLUMN update_pic BIGINT UNSIGNED NULL AFTER updated_at`);
      } catch (_) {}
      try {
        await connection.query(`ALTER TABLE point_histories ADD COLUMN deleted_at DATETIME NULL AFTER update_pic`);
      } catch (_) {}
      try {
        await connection.query(`ALTER TABLE point_histories ADD COLUMN delete_pic BIGINT UNSIGNED NULL AFTER deleted_at`);
      } catch (_) {}
    } catch (e: any) {
      console.warn('  ▲ [Migration Info] point_histories table check:', e.message);
    }

    // Auto-add active_session_id column to users if not exists
    try {
      await connection.query(`
        ALTER TABLE users ADD COLUMN active_session_id VARCHAR(100) NULL DEFAULT NULL;
      `);
    } catch (_) {
      // Column already exists
    }

    // Auto-add reward_points_awarded column to orders if not exists
    try {
      await connection.query(`
        ALTER TABLE orders ADD COLUMN reward_points_awarded TINYINT(1) NOT NULL DEFAULT 0;
      `);
    } catch (_) {
      // Column already exists
    }

    // Auto-add rating, review, tip_amount, rated_at columns to orders if not exists
    try {
      await connection.query(`
        ALTER TABLE orders 
          ADD COLUMN rating INT NULL DEFAULT NULL,
          ADD COLUMN review TEXT NULL DEFAULT NULL,
          ADD COLUMN tip_amount INT NOT NULL DEFAULT 0,
          ADD COLUMN rated_at DATETIME NULL DEFAULT NULL;
      `);
    } catch (_) {
      // Columns already exist
    }

    // Auto-create wallet_transactions table if not exists
    try {
      await connection.query(`
        CREATE TABLE IF NOT EXISTS wallet_transactions (
          id_wallet_transactions INT AUTO_INCREMENT PRIMARY KEY,
          users_id INT NOT NULL,
          orders_id INT NULL,
          type ENUM('credit', 'debit') NOT NULL DEFAULT 'credit',
          category VARCHAR(50) NOT NULL DEFAULT 'tip',
          amount INT NOT NULL,
          balance_before INT NOT NULL DEFAULT 0,
          balance_after INT NOT NULL DEFAULT 0,
          title VARCHAR(150) NOT NULL,
          description TEXT NULL,
          reference_no VARCHAR(100) NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (users_id) REFERENCES users(id_users) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);
    } catch (e: any) {
      console.warn('  ▲ [Migration Info] wallet_transactions table check:', e.message);
    }

    // Auto-sync existing tips to courier laundry_pay_balance & wallet_transactions
    try {
      const [couriersWithTips]: any = await connection.query(`
        SELECT 
          u.id_users, 
          u.name_users,
          u.laundry_pay_balance,
          COALESCE(SUM(o.tip_amount), 0) AS total_tips
        FROM users u
        JOIN orders o ON (
          LOWER(TRIM(o.courier_name)) = LOWER(TRIM(u.name_users)) 
          OR (u.phone IS NOT NULL AND u.phone != '' AND REPLACE(REPLACE(o.courier_phone, '-', ''), ' ', '') = REPLACE(REPLACE(u.phone, '-', ''), ' ', ''))
        )
        WHERE o.deleted_at IS NULL AND o.tip_amount > 0 AND u.deleted_at IS NULL
        GROUP BY u.id_users, u.name_users, u.laundry_pay_balance
      `);

      if (Array.isArray(couriersWithTips)) {
        for (const row of couriersWithTips) {
          const tips = Number(row.total_tips) || 0;
          const currentBal = Number(row.laundry_pay_balance) || 0;
          if (tips > 0 && currentBal < tips) {
            await connection.query(
              'UPDATE users SET laundry_pay_balance = ? WHERE id_users = ?',
              [tips, row.id_users]
            );
          }
        }
      }

      // Populate historical tips into wallet_transactions if not present
      const [ordersWithTips]: any = await connection.query(`
        SELECT 
          o.id_orders,
          o.invoice_no,
          o.tip_amount,
          o.created_at,
          o.rated_at,
          u.id_users AS courier_user_id,
          u.name_users AS courier_name,
          cust.name_users AS customer_name
        FROM orders o
        JOIN users u ON (
          LOWER(TRIM(o.courier_name)) = LOWER(TRIM(u.name_users))
          OR (u.phone IS NOT NULL AND u.phone != '' AND REPLACE(REPLACE(o.courier_phone, '-', ''), ' ', '') = REPLACE(REPLACE(u.phone, '-', ''), ' ', ''))
        )
        LEFT JOIN users cust ON o.users_id = cust.id_users
        WHERE o.deleted_at IS NULL AND o.tip_amount > 0 AND u.deleted_at IS NULL
      `);

      if (Array.isArray(ordersWithTips)) {
        for (const ord of ordersWithTips) {
          const [exists]: any = await connection.query(
            'SELECT id_wallet_transactions FROM wallet_transactions WHERE users_id = ? AND orders_id = ? AND category = "tip" LIMIT 1',
            [ord.courier_user_id, ord.id_orders]
          );
          if (!exists || exists.length === 0) {
            const custName = ord.customer_name || 'Pelanggan';
            await connection.query(`
              INSERT INTO wallet_transactions 
                (users_id, orders_id, type, category, amount, balance_before, balance_after, title, description, reference_no, created_at)
              VALUES (?, ?, 'credit', 'tip', ?, 0, ?, ?, ?, ?, COALESCE(?, ?, NOW()))
            `, [
              ord.courier_user_id,
              ord.id_orders,
              ord.tip_amount,
              ord.tip_amount,
              'Tips Pengantaran Pesanan',
              `Tips sebesar Rp ${Number(ord.tip_amount).toLocaleString('id-ID')} dari ${custName} untuk pesanan #${ord.invoice_no}`,
              ord.invoice_no,
              ord.rated_at,
              ord.created_at
            ]);
          }
        }
      }
    } catch (e: any) {
      console.warn('  ▲ [Migration Info] tips balance & transaction sync:', e.message);
    }

    connection.release();
    return true;
  } catch (error: any) {
    console.warn(`  ${pc.yellow('▲')} ${pc.bold(pc.yellow('[Database Warning]'))} Gagal terhubung ke MySQL (${error.message}).`);
    return false;
  }
};


