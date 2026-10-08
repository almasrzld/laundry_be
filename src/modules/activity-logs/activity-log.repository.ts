import { query } from '../../config/database';
import { CryptoUtil } from '../../utils/crypto.util';
import { ActivityLogEntity, ActivityLogFilter } from './activity-log.entity';
import { decryptEncryptedText, sanitizeAndDecryptPayload } from './activity-log.helper';

export class ActivityLogRepository {
  /**
   * Mengambil daftar log aktivitas dengan filter tanggal awal, tanggal akhir, tipe log, dan pagination
   */
  async findAll(filter: ActivityLogFilter = {}): Promise<{
    data: ActivityLogEntity[];
    total: number;
    page: number;
    limit: number;
    total_pages: number;
  }> {
    const page = Math.max(1, Number(filter.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(filter.limit) || 20));
    const offset = (page - 1) * limit;

    const conditions: string[] = ['a.deleted_at IS NULL'];
    const params: any[] = [];

    // Filter Tipe Log: main / secondary
    if (filter.type && filter.type.trim() !== '') {
      conditions.push('LOWER(a.log_type) = LOWER(?)');
      params.push(filter.type.trim());
    }

    // Filter Tanggal Awal (Start Date)
    if (filter.startDate && filter.startDate.trim() !== '') {
      conditions.push('DATE(a.created_at) >= ?');
      params.push(filter.startDate.trim());
    }

    // Filter Tanggal Akhir (End Date)
    if (filter.endDate && filter.endDate.trim() !== '') {
      conditions.push('DATE(a.created_at) <= ?');
      params.push(filter.endDate.trim());
    }

    // Filter Pencarian kata kunci (search)
    if (filter.search && filter.search.trim() !== '') {
      const s = `%${filter.search.trim()}%`;
      conditions.push('(a.user_code LIKE ? OR a.user_name LIKE ? OR a.activity LIKE ? OR a.ip_address LIKE ? OR a.location LIKE ?)');
      params.push(s, s, s, s, s);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // 1. Hitung total rows
    const countSql = `SELECT COUNT(*) AS total FROM activity_logs a ${whereClause}`;
    const countRes: any = await query(countSql, params);
    const total = Number(countRes[0]?.total || 0);

    // 2. Ambil data log
    const dataSql = `
      SELECT 
        a.id_activity_logs,
        a.log_type,
        a.users_id,
        a.user_code,
        a.user_name,
        a.user_role,
        a.activity,
        a.ip_address,
        a.location,
        a.user_agent,
        a.payload,
        a.created_at,
        a.creator,
        a.updated_at,
        a.update_pic,
        a.deleted_at,
        a.delete_pic
      FROM activity_logs a
      ${whereClause}
      ORDER BY a.id_activity_logs DESC
      LIMIT ? OFFSET ?
    `;

    const dataParams = [...params, limit, offset];
    const rows = await query<ActivityLogEntity>(dataSql, dataParams);

    const formattedData = rows.map((row) => {
      const rawId = Number(row.id_activity_logs);
      const rawUserId = row.users_id ? Number(row.users_id) : null;

      let parsedPayload = row.payload;
      if (typeof row.payload === 'string') {
        try {
          parsedPayload = JSON.parse(row.payload);
        } catch (_) {}
      }

      // Pastikan teks aktivitas dan payload didekripsi jika sebelumnya tersimpan ID terenkripsi
      const cleanedActivity = decryptEncryptedText(row.activity);
      const cleanedPayload = sanitizeAndDecryptPayload(parsedPayload);

      let dateFormatted = '';
      let timeFormatted = '';
      if (row.created_at) {
        const d = new Date(row.created_at);
        if (!isNaN(d.getTime())) {
          const dd = String(d.getDate()).padStart(2, '0');
          const mm = String(d.getMonth() + 1).padStart(2, '0');
          const yyyy = d.getFullYear();
          const hh = String(d.getHours()).padStart(2, '0');
          const min = String(d.getMinutes()).padStart(2, '0');
          const ss = String(d.getSeconds()).padStart(2, '0');
          dateFormatted = `${dd}/${mm}/${yyyy}`;
          timeFormatted = `${hh}:${min}:${ss}`;
        }
      }

      return {
        ...row,
        id_activity_logs: rawId,
        id: CryptoUtil.encryptId(rawId) ?? String(rawId),
        users_id: rawUserId,
        user_id: rawUserId ? (CryptoUtil.encryptId(rawUserId) ?? String(rawUserId)) : null,
        activity: cleanedActivity,
        payload: cleanedPayload,
        date_formatted: dateFormatted,
        time_formatted: timeFormatted,
      };
    });

    return {
      data: formattedData,
      total,
      page,
      limit,
      total_pages: Math.ceil(total / limit) || 1,
    };
  }

  /**
   * Menyimpan log aktivitas baru
   */
  async create(data: {
    log_type: 'main' | 'secondary';
    users_id?: number | null;
    user_code?: string | null;
    user_name?: string | null;
    user_role?: string | null;
    activity: string;
    ip_address?: string | null;
    location?: string | null;
    user_agent?: string | null;
    payload?: any;
    creator?: number | null;
  }): Promise<number> {
    const payloadJson = data.payload !== undefined && data.payload !== null
      ? (typeof data.payload === 'string' ? data.payload : JSON.stringify(data.payload))
      : null;

    const sql = `
      INSERT INTO activity_logs (
        log_type, users_id, user_code, user_name, user_role, activity,
        ip_address, location, user_agent, payload, created_at, creator
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?)
    `;

    const res: any = await query(sql, [
      data.log_type || 'main',
      data.users_id || null,
      data.user_code || null,
      data.user_name || null,
      data.user_role || null,
      data.activity,
      data.ip_address || null,
      data.location || null,
      data.user_agent || null,
      payloadJson,
      data.creator || data.users_id || null,
    ]);

    return Number(res.insertId);
  }
}
