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
          updated_at DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
          deleted_at DATETIME NULL,
          FOREIGN KEY (users_id) REFERENCES users(id_users) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);

      try { await connection.query(`ALTER TABLE wallet_transactions ADD COLUMN updated_at DATETIME NULL ON UPDATE CURRENT_TIMESTAMP AFTER created_at`); } catch (_) {}
      try { await connection.query(`ALTER TABLE wallet_transactions ADD COLUMN deleted_at DATETIME NULL AFTER updated_at`); } catch (_) {}
    } catch (e: any) {
      console.warn('  ▲ [Migration Info] wallet_transactions table check:', e.message);
    }

    // Auto-seed/ensure Saldo LaundryPay exists in master_payment_methods if not present
    try {
      const [existingLPay]: any = await connection.query(
        'SELECT id_payment_methods FROM master_payment_methods WHERE LOWER(code) = "laundrypay" OR type = "laundrypay" LIMIT 1'
      );
      if (!existingLPay || existingLPay.length === 0) {
        await connection.query(`
          INSERT INTO master_payment_methods (name_payment_methods, code, type, account_number, account_name, description, is_active, created_at, creator)
          VALUES ('Saldo LaundryPay', 'LAUNDRYPAY', 'laundrypay', NULL, NULL, 'Pembayaran instan langsung memotong saldo dompet digital LaundryPay Anda secara otomatis.', 1, NOW(), 1)
        `);
        console.log('  ✔ [Migration] Master payment method "Saldo LaundryPay" seeded successfully.');
      }
    } catch (e: any) {
      console.warn('  ▲ [Migration Info] master_payment_methods check:', e.message);
    }

    // Auto-create withdrawal_requests table if not exists
    try {
      await connection.query(`
        CREATE TABLE IF NOT EXISTS withdrawal_requests (
          id_withdrawal_requests INT AUTO_INCREMENT PRIMARY KEY,
          users_id INT NOT NULL,
          amount INT NOT NULL,
          bank_name VARCHAR(100) NOT NULL,
          account_number VARCHAR(100) NOT NULL,
          account_name VARCHAR(150) NOT NULL,
          status ENUM('pending', 'completed', 'rejected') NOT NULL DEFAULT 'pending',
          admin_notes TEXT NULL,
          proof_image VARCHAR(255) NULL,
          processed_by INT NULL,
          processed_at DATETIME NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (users_id) REFERENCES users(id_users) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);
    } catch (e: any) {
      console.warn('  ▲ [Migration Info] withdrawal_requests table check:', e.message);
    }

    // Auto-create topup_requests table if not exists
    try {
      await connection.query(`
        CREATE TABLE IF NOT EXISTS topup_requests (
          id_topup_requests INT AUTO_INCREMENT PRIMARY KEY,
          users_id INT NOT NULL,
          amount INT NOT NULL,
          payment_method VARCHAR(100) NOT NULL,
          notes TEXT NULL,
          status ENUM('pending', 'completed', 'rejected') NOT NULL DEFAULT 'pending',
          admin_notes TEXT NULL,
          proof_image VARCHAR(255) NULL,
          processed_by INT NULL,
          processed_at DATETIME NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (users_id) REFERENCES users(id_users) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);
    } catch (e: any) {
      console.warn('  ▲ [Migration Info] topup_requests table check:', e.message);
    }

    // Auto-create & migrate promos & user_vouchers table
    try {
      // 1. Check promos columns (tanpa DEFAULT)
      try { await connection.query(`ALTER TABLE promos ADD COLUMN category VARCHAR(50) NOT NULL AFTER code`); } catch (_) {}
      try { await connection.query(`ALTER TABLE promos ADD COLUMN benefit_type VARCHAR(50) NOT NULL AFTER category`); } catch (_) {}
      try { await connection.query(`ALTER TABLE promos ADD COLUMN discount_type VARCHAR(50) NOT NULL AFTER benefit_type`); } catch (_) {}
      try { await connection.query(`ALTER TABLE promos ADD COLUMN max_discount INT NULL AFTER discount_amount`); } catch (_) {}
      try { await connection.query(`ALTER TABLE promos ADD COLUMN points_required INT NOT NULL AFTER min_order_amount`); } catch (_) {}
      try { await connection.query(`ALTER TABLE promos ADD COLUMN start_date DATE NOT NULL AFTER points_required`); } catch (_) {}
      try { await connection.query(`ALTER TABLE promos ADD COLUMN end_date DATE NOT NULL AFTER start_date`); } catch (_) {}

      // Pastikan semua kolom promos tidak memiliki DEFAULT constraint
      try { await connection.query(`ALTER TABLE promos MODIFY COLUMN category VARCHAR(50) NOT NULL`); } catch (_) {}
      try { await connection.query(`ALTER TABLE promos MODIFY COLUMN benefit_type VARCHAR(50) NOT NULL`); } catch (_) {}
      try { await connection.query(`ALTER TABLE promos MODIFY COLUMN discount_type VARCHAR(50) NOT NULL`); } catch (_) {}
      try { await connection.query(`ALTER TABLE promos MODIFY COLUMN discount_amount INT NOT NULL`); } catch (_) {}
      try { await connection.query(`ALTER TABLE promos MODIFY COLUMN max_discount INT NULL`); } catch (_) {}
      try { await connection.query(`ALTER TABLE promos MODIFY COLUMN min_order_amount INT NOT NULL`); } catch (_) {}
      try { await connection.query(`ALTER TABLE promos MODIFY COLUMN points_required INT NOT NULL`); } catch (_) {}
      try { await connection.query(`ALTER TABLE promos MODIFY COLUMN start_date DATE NOT NULL`); } catch (_) {}
      try { await connection.query(`ALTER TABLE promos MODIFY COLUMN end_date DATE NOT NULL`); } catch (_) {}
      
      // Update any existing promos without start_date / end_date
      try {
        await connection.query(`
          UPDATE promos 
          SET start_date = COALESCE(start_date, CURDATE()), 
              end_date = COALESCE(end_date, DATE_ADD(CURDATE(), INTERVAL 90 DAY))
          WHERE start_date IS NULL OR end_date IS NULL
        `);
      } catch (_) {}

      // 2. Check user_vouchers table and columns (tanpa DEFAULT)
      await connection.query(`
        CREATE TABLE IF NOT EXISTS user_vouchers (
          id_user_vouchers INT AUTO_INCREMENT PRIMARY KEY,
          users_id INT NOT NULL,
          promos_id INT NULL,
          code_voucher VARCHAR(50) NOT NULL,
          title VARCHAR(150) NOT NULL,
          subtitle VARCHAR(255) NULL,
          category VARCHAR(50) NOT NULL,
          benefit_type VARCHAR(50) NOT NULL,
          discount_type VARCHAR(50) NOT NULL,
          discount_amount INT NOT NULL,
          max_discount INT NULL,
          min_order_amount INT NOT NULL,
          points_spent INT NOT NULL,
          start_date DATE NOT NULL,
          end_date DATE NOT NULL,
          is_used BOOLEAN NOT NULL,
          used_at DATETIME NULL,
          orders_id INT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          creator BIGINT UNSIGNED NULL,
          updated_at DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
          update_pic BIGINT UNSIGNED NULL,
          deleted_at DATETIME NULL,
          delete_pic BIGINT UNSIGNED NULL,
          INDEX idx_user_vouchers_user (users_id),
          INDEX idx_user_vouchers_code (code_voucher)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);

      try { await connection.query(`ALTER TABLE user_vouchers ADD COLUMN category VARCHAR(50) NOT NULL AFTER subtitle`); } catch (_) {}
      try { await connection.query(`ALTER TABLE user_vouchers ADD COLUMN benefit_type VARCHAR(50) NOT NULL AFTER category`); } catch (_) {}
      try { await connection.query(`ALTER TABLE user_vouchers ADD COLUMN discount_type VARCHAR(50) NOT NULL AFTER benefit_type`); } catch (_) {}
      try { await connection.query(`ALTER TABLE user_vouchers ADD COLUMN max_discount INT NULL AFTER discount_amount`); } catch (_) {}
      try { await connection.query(`ALTER TABLE user_vouchers ADD COLUMN start_date DATE NOT NULL AFTER points_spent`); } catch (_) {}
      try { await connection.query(`ALTER TABLE user_vouchers ADD COLUMN end_date DATE NOT NULL AFTER start_date`); } catch (_) {}

      // Pastikan semua kolom user_vouchers tidak memiliki DEFAULT constraint
      try { await connection.query(`ALTER TABLE user_vouchers MODIFY COLUMN category VARCHAR(50) NOT NULL`); } catch (_) {}
      try { await connection.query(`ALTER TABLE user_vouchers MODIFY COLUMN benefit_type VARCHAR(50) NOT NULL`); } catch (_) {}
      try { await connection.query(`ALTER TABLE user_vouchers MODIFY COLUMN discount_type VARCHAR(50) NOT NULL`); } catch (_) {}
      try { await connection.query(`ALTER TABLE user_vouchers MODIFY COLUMN discount_amount INT NOT NULL`); } catch (_) {}
      try { await connection.query(`ALTER TABLE user_vouchers MODIFY COLUMN max_discount INT NULL`); } catch (_) {}
      try { await connection.query(`ALTER TABLE user_vouchers MODIFY COLUMN min_order_amount INT NOT NULL`); } catch (_) {}
      try { await connection.query(`ALTER TABLE user_vouchers MODIFY COLUMN points_spent INT NOT NULL`); } catch (_) {}
      try { await connection.query(`ALTER TABLE user_vouchers MODIFY COLUMN start_date DATE NOT NULL`); } catch (_) {}
      try { await connection.query(`ALTER TABLE user_vouchers MODIFY COLUMN end_date DATE NOT NULL`); } catch (_) {}

      // Normalisasi nilai kolom ke format standar Title Case (tanpa underscore)
      try {
        await connection.query(`
          UPDATE promos SET category = 'Event' WHERE category IN ('event', 'Event');
        `);
        await connection.query(`
          UPDATE promos SET category = 'Reward Point' WHERE category IN ('reward_point', 'reward point', 'Reward Point');
        `);
        await connection.query(`
          UPDATE promos SET benefit_type = 'Potongan Harga' WHERE benefit_type IN ('service_discount', 'service discount', 'potongan_harga', 'potongan harga', 'Potongan Harga');
        `);
        await connection.query(`
          UPDATE promos SET benefit_type = 'Bebas Ongkir' WHERE benefit_type IN ('free_delivery', 'free delivery', 'bebas_ongkir', 'bebas ongkir', 'Bebas Ongkir');
        `);
        await connection.query(`
          UPDATE promos SET benefit_type = 'Potongan Ongkir' WHERE benefit_type IN ('delivery_discount', 'delivery discount', 'potongan_ongkir', 'potongan ongkir', 'Potongan Ongkir');
        `);
        await connection.query(`
          UPDATE promos SET discount_type = 'Nominal' WHERE discount_type IN ('fixed', 'nominal', 'Nominal');
        `);
        await connection.query(`
          UPDATE promos SET discount_type = 'Persen' WHERE discount_type IN ('percent', 'percentage', 'persen', 'Persen');
        `);
      } catch (_) {}

      try {
        await connection.query(`
          UPDATE user_vouchers SET category = 'Event' WHERE category IN ('event', 'Event');
        `);
        await connection.query(`
          UPDATE user_vouchers SET category = 'Reward Point' WHERE category IN ('reward_point', 'reward point', 'Reward Point');
        `);
        await connection.query(`
          UPDATE user_vouchers SET benefit_type = 'Potongan Harga' WHERE benefit_type IN ('service_discount', 'service discount', 'potongan_harga', 'potongan harga', 'Potongan Harga');
        `);
        await connection.query(`
          UPDATE user_vouchers SET benefit_type = 'Bebas Ongkir' WHERE benefit_type IN ('free_delivery', 'free delivery', 'bebas_ongkir', 'bebas ongkir', 'Bebas Ongkir');
        `);
        await connection.query(`
          UPDATE user_vouchers SET benefit_type = 'Potongan Ongkir' WHERE benefit_type IN ('delivery_discount', 'delivery discount', 'potongan_ongkir', 'potongan ongkir', 'Potongan Ongkir');
        `);
        await connection.query(`
          UPDATE user_vouchers SET discount_type = 'Nominal' WHERE discount_type IN ('fixed', 'nominal', 'Nominal');
        `);
        await connection.query(`
          UPDATE user_vouchers SET discount_type = 'Persen' WHERE discount_type IN ('percent', 'percentage', 'persen', 'Persen');
        `);
      } catch (_) {}
    } catch (e: any) {
      console.warn('  ▲ [Migration Info] promos & user_vouchers table check:', e.message);
    }

    // Auto-create master_outlets table if not exists
    try {
      await connection.query(`
        CREATE TABLE IF NOT EXISTS master_outlets (
          id_outlets INT AUTO_INCREMENT PRIMARY KEY,
          name_outlet VARCHAR(150) NOT NULL,
          address TEXT NOT NULL,
          latitude VARCHAR(50) NOT NULL,
          longitude VARCHAR(50) NOT NULL,
          phone VARCHAR(30) NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          creator BIGINT UNSIGNED NOT NULL,
          updated_at DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
          update_pic BIGINT UNSIGNED NULL,
          deleted_at DATETIME NULL,
          delete_pic BIGINT UNSIGNED NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);

      try { await connection.query(`ALTER TABLE master_outlets MODIFY COLUMN latitude VARCHAR(50) NOT NULL`); } catch (_) {}
      try { await connection.query(`ALTER TABLE master_outlets MODIFY COLUMN longitude VARCHAR(50) NOT NULL`); } catch (_) {}
    } catch (e: any) {
      console.warn('  ▲ [Migration Info] master_outlets table check:', e.message);
    }

    // Auto-create/update master_ongkirs table if not exists
    try {
      await connection.query(`
        CREATE TABLE IF NOT EXISTS master_ongkirs (
          id_ongkirs INT AUTO_INCREMENT PRIMARY KEY,
          outlets_id INT NOT NULL,
          units_id INT NOT NULL,
          name_ongkir VARCHAR(100) NOT NULL,
          code_ongkir VARCHAR(3) NOT NULL,
          free_radius DECIMAL(14, 2) NOT NULL,
          base_radius DECIMAL(14, 2) NOT NULL,
          base_price INT NOT NULL,
          step_radius DECIMAL(14, 2) NOT NULL,
          step_price INT NOT NULL,
          max_radius DECIMAL(14, 2) NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          creator BIGINT UNSIGNED NOT NULL,
          updated_at DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
          update_pic BIGINT UNSIGNED NULL,
          deleted_at DATETIME NULL,
          delete_pic BIGINT UNSIGNED NULL,
          INDEX idx_ongkir_outlets (outlets_id),
          INDEX idx_ongkir_units (units_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);

      try { await connection.query(`ALTER TABLE master_ongkirs ADD COLUMN outlets_id INT NOT NULL AFTER id_ongkirs`); } catch (_) {}
      try { await connection.query(`ALTER TABLE master_ongkirs ADD COLUMN units_id INT NOT NULL AFTER outlets_id`); } catch (_) {}
      try { await connection.query(`ALTER TABLE master_ongkirs ADD COLUMN free_radius DECIMAL(14, 2) NOT NULL AFTER code_ongkir`); } catch (_) {}
      try { await connection.query(`ALTER TABLE master_ongkirs ADD COLUMN base_radius DECIMAL(14, 2) NOT NULL AFTER free_radius`); } catch (_) {}
      try { await connection.query(`ALTER TABLE master_ongkirs ADD COLUMN base_price INT NOT NULL AFTER base_radius`); } catch (_) {}
      try { await connection.query(`ALTER TABLE master_ongkirs ADD COLUMN step_radius DECIMAL(14, 2) NOT NULL AFTER base_price`); } catch (_) {}
      try { await connection.query(`ALTER TABLE master_ongkirs ADD COLUMN step_price INT NOT NULL AFTER step_radius`); } catch (_) {}
      try { await connection.query(`ALTER TABLE master_ongkirs ADD COLUMN max_radius DECIMAL(14, 2) NOT NULL AFTER step_price`); } catch (_) {}

      // Dynamic cleanup: remove any obsolete/legacy columns that are not in the new master_ongkirs schema
      try {
        const [existingCols]: any = await connection.query(`SHOW COLUMNS FROM master_ongkirs`);
        const validCols = new Set([
          'id_ongkirs',
          'outlets_id',
          'units_id',
          'name_ongkir',
          'code_ongkir',
          'free_radius',
          'base_radius',
          'base_price',
          'step_radius',
          'step_price',
          'max_radius',
          'created_at',
          'creator',
          'updated_at',
          'update_pic',
          'deleted_at',
          'delete_pic',
        ]);

        for (const col of existingCols) {
          if (!validCols.has(col.Field)) {
            try {
              await connection.query(`ALTER TABLE master_ongkirs DROP COLUMN \`${col.Field}\``);
              console.log(`  ✓ [Migration] Dropped legacy column master_ongkirs.${col.Field}`);
            } catch (_) {
              try {
                await connection.query(`ALTER TABLE master_ongkirs MODIFY COLUMN \`${col.Field}\` TEXT NULL DEFAULT NULL`);
              } catch (_) {}
            }
          }
        }
      } catch (colErr: any) {
        console.warn('  ▲ [Migration Info] legacy columns check:', colErr.message);
      }

      // Modify existing column definitions to DECIMAL(14, 2)
      try { await connection.query(`ALTER TABLE master_ongkirs MODIFY COLUMN free_radius DECIMAL(14, 2) NOT NULL`); } catch (_) {}
      try { await connection.query(`ALTER TABLE master_ongkirs MODIFY COLUMN base_radius DECIMAL(14, 2) NOT NULL`); } catch (_) {}
      try { await connection.query(`ALTER TABLE master_ongkirs MODIFY COLUMN step_radius DECIMAL(14, 2) NOT NULL`); } catch (_) {}
      try { await connection.query(`ALTER TABLE master_ongkirs MODIFY COLUMN max_radius DECIMAL(14, 2) NOT NULL`); } catch (_) {}
    } catch (e: any) {
      console.warn('  ▲ [Migration Info] master_ongkirs table check:', e.message);
    }

    // Auto-sync existing tips to courier laundry_pay_balance & wallet_transactions
    try {
      // 1. Populate historical tips into wallet_transactions if not present
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

      // 2. Recalculate true active laundry_pay_balance from wallet_transactions net sum
      const [calculatedUsers]: any = await connection.query(`
        SELECT 
          users_id,
          COALESCE(SUM(CASE WHEN type = 'credit' THEN amount ELSE -amount END), 0) AS real_balance
        FROM wallet_transactions
        GROUP BY users_id
      `);
      if (Array.isArray(calculatedUsers)) {
        for (const u of calculatedUsers) {
          const realBal = Math.max(0, Number(u.real_balance) || 0);
          await connection.query(
            'UPDATE users SET laundry_pay_balance = ? WHERE id_users = ?',
            [realBal, u.users_id]
          );
        }
      }
    } catch (e: any) {
      console.warn('  ▲ [Migration Info] tips balance & transaction sync:', e.message);
    }

    // Auto-create activity_logs table if not exists
    try {
      await connection.query(`
        CREATE TABLE IF NOT EXISTS activity_logs (
          id_activity_logs INT AUTO_INCREMENT PRIMARY KEY,
          log_type ENUM('main', 'secondary') NOT NULL DEFAULT 'main',
          users_id INT NULL,
          user_code VARCHAR(50) NULL,
          user_name VARCHAR(150) NULL,
          user_role VARCHAR(50) NULL,
          activity TEXT NOT NULL,
          ip_address VARCHAR(45) NULL,
          location VARCHAR(255) NULL,
          user_agent TEXT NULL,
          payload JSON NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          creator BIGINT UNSIGNED NULL,
          updated_at DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
          update_pic BIGINT UNSIGNED NULL,
          deleted_at DATETIME NULL,
          delete_pic BIGINT UNSIGNED NULL,
          INDEX idx_act_logs_type (log_type),
          INDEX idx_act_logs_users (users_id),
          INDEX idx_act_logs_user_code (user_code),
          INDEX idx_act_logs_created (created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);

      // Auto-register permission: log-activity.index
      try {
        // Update previous key if any
        await connection.query(
          "UPDATE permissions SET code = 'log-activity.index', name_permissions = 'Lihat Log Activity' WHERE LOWER(code) IN ('system.activity-log', 'log-activity', 'activity-log.index') AND deleted_at IS NULL"
        );

        const [existingPerm]: any = await connection.query(
          "SELECT id_permissions FROM permissions WHERE LOWER(code) = 'log-activity.index' AND deleted_at IS NULL LIMIT 1"
        );
        let permId: number | null = null;
        if (!existingPerm || existingPerm.length === 0) {
          const [insPerm]: any = await connection.query(`
            INSERT INTO permissions (name_permissions, code, module, created_at, creator)
            VALUES ('Lihat Log Activity', 'log-activity.index', 'System', NOW(), 1)
          `);
          permId = insPerm.insertId;
        } else {
          permId = existingPerm[0].id_permissions;
        }

        // Grant permission to superadmin and admin roles
        if (permId) {
          const [adminRoles]: any = await connection.query(
            "SELECT id_roles FROM roles WHERE LOWER(code) IN ('superadmin', 'admin', 'administrator', 'kasir', 'operator') AND deleted_at IS NULL"
          );
          if (Array.isArray(adminRoles)) {
            for (const r of adminRoles) {
              const [hasRolePerm]: any = await connection.query(
                "SELECT id_role_menus FROM role_permissions WHERE roles_id = ? AND permissions_id = ? AND deleted_at IS NULL LIMIT 1",
                [r.id_roles, permId]
              );
              if (!hasRolePerm || hasRolePerm.length === 0) {
                await connection.query(
                  "INSERT INTO role_permissions (roles_id, permissions_id, created_at, creator) VALUES (?, ?, NOW(), 1)",
                  [r.id_roles, permId]
                );
              }
            }
          }
        }
      } catch (pErr: any) {
        console.warn('  ▲ [Migration Info] log-activity.index permission check:', pErr.message);
      }

      // Auto-register sub menu: Log Activity under System with path /system/log-activity
      try {
        // Update previous menu if any
        await connection.query(`
          UPDATE menus 
          SET \`key\` = 'system.log-activity', 
              name_menus = 'Log Activity', 
              path = '/system/log-activity', 
              nama_akses = 'log-activity.index' 
          WHERE (LOWER(path) IN ('/system/activity-log', '/activity-log', '/system/log-activity') OR LOWER(\`key\`) IN ('system.activity-log', 'system.log-activity')) 
            AND deleted_at IS NULL
        `);

        const [existingMenu]: any = await connection.query(
          "SELECT id_menus FROM menus WHERE LOWER(path) = '/system/log-activity' AND deleted_at IS NULL LIMIT 1"
        );
        if (!existingMenu || existingMenu.length === 0) {
          // Cari ID parent menu System
          const [systemParent]: any = await connection.query(
            "SELECT id_menus FROM menus WHERE (LOWER(name_menus) = 'system' OR LOWER(`key`) = 'system') AND (menus_id IS NULL OR menus_id = 0) AND deleted_at IS NULL LIMIT 1"
          );
          const parentId = systemParent && systemParent.length > 0 ? systemParent[0].id_menus : null;

          await connection.query(`
            INSERT INTO menus (\`key\`, name_menus, path, nama_akses, icon, menus_id, order_index, is_active, is_sidebar, created_at, creator)
            VALUES ('system.log-activity', 'Log Activity', '/system/log-activity', 'log-activity.index', 'Activity', ?, 99, 1, 1, NOW(), 1)
          `, [parentId]);
          console.log('  ✔ [Migration] Menu "Log Activity" registered at /system/log-activity successfully.');
        }
      } catch (mErr: any) {
        console.warn('  ▲ [Migration Info] Log Activity menu check:', mErr.message);
      }

    } catch (e: any) {
      console.warn('  ▲ [Migration Info] activity_logs table check:', e.message);
    }

    connection.release();
    return true;
  } catch (error: any) {
    console.warn(`  ${pc.yellow('▲')} ${pc.bold(pc.yellow('[Database Warning]'))} Gagal terhubung ke MySQL (${error.message}).`);
    return false;
  }
};


