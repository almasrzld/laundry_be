import { query } from '../../config/database';
import { CryptoUtil } from '../../utils/crypto.util';

export interface TimelineStepEntity {
  id?: number | string;
  id_order_timelines?: number | string;
  order_id?: number | string;
  orders_id?: number | string;
  order_statuses_id?: number | string | null;
  status_id?: string | null;
  title: string;
  description: string;
  time: string;
  is_completed: boolean;
  is_current: boolean;
  step_order?: number;
  created_at?: Date | string;
  creator?: number;
  updated_at?: Date | string;
  update_pic?: number | null;
  deleted_at?: Date | string | null;
  delete_pic?: number | null;
}

export interface OrderEntity {
  id?: number | string;
  id_orders?: number | string;
  invoice_no: string;
  user_id?: number | string;
  users_id?: number | string;
  service_name: string;
  service_type: string;
  order_date: string | Date;
  estimated_completion_date: string | Date;
  status: string;
  order_statuses_id?: number | string | null;
  status_name?: string;
  status_code?: string;
  status_color_hex?: string;
  status_badge_variant?: string;
  status_step_order?: number;
  quantity: number;
  unit: string;
  price_per_unit: number;
  delivery_fee: number;
  discount: number;
  pickup_address: string;
  delivery_address: string;
  courier_name: string;
  courier_phone: string;
  notes: string;
  timeline?: TimelineStepEntity[];
  created_at?: Date | string;
  creator?: number;
  updated_at?: Date | string;
  update_pic?: number | null;
  deleted_at?: Date | string | null;
  delete_pic?: number | null;
}

const ORDER_SELECT = `
  o.id_orders, o.invoice_no, o.users_id, o.service_name, o.service_type, 
  o.order_date, o.estimated_completion_date, 
  COALESCE(mos.name_order_statuses, o.status) AS status,
  o.order_statuses_id,
  mos.name_order_statuses AS status_name,
  mos.code AS status_code,
  mos.color_hex AS status_color_hex,
  mos.badge_variant AS status_badge_variant,
  COALESCE(mos.step_order, 1) AS status_step_order,
  o.quantity, o.unit, o.price_per_unit, o.delivery_fee, o.discount, 
  o.pickup_address, o.delivery_address, o.courier_name, o.courier_phone, o.notes, 
  o.created_at, o.creator, o.updated_at, o.update_pic, o.deleted_at, o.delete_pic
`;

const TIMELINE_SELECT = `
  t.id_order_timelines, t.orders_id, t.order_statuses_id, t.title, t.description, t.time, 
  t.is_completed, t.is_current, t.step_order, t.created_at, t.creator, 
  t.updated_at, t.update_pic, t.deleted_at, t.delete_pic
`;

export class OrderRepository {
  private async resolveStatusInfo(statusOrId: string | number | null | undefined): Promise<{ id: number | null; name: string; code?: string; step_order?: number; description?: string; color_hex?: string }> {
    if (!statusOrId) {
      const first = await query<any>('SELECT id_order_statuses, name_order_statuses, code, step_order, description, color_hex FROM master_order_statuses WHERE deleted_at IS NULL AND is_active = 1 ORDER BY step_order ASC LIMIT 1');
      if (first.length > 0) {
        return {
          id: first[0].id_order_statuses,
          name: first[0].name_order_statuses,
          code: first[0].code,
          step_order: first[0].step_order,
          description: first[0].description,
          color_hex: first[0].color_hex,
        };
      }
      return { id: null, name: '', step_order: 1 };
    }

    const decrypted = CryptoUtil.decryptId(statusOrId);
    const numericId = decrypted ? Number(decrypted) : (!isNaN(Number(statusOrId)) ? Number(statusOrId) : null);

    if (numericId) {
      const res = await query<any>('SELECT id_order_statuses, name_order_statuses, code, step_order, description, color_hex FROM master_order_statuses WHERE id_order_statuses = ? AND deleted_at IS NULL LIMIT 1', [numericId]);
      if (res.length > 0) {
        return {
          id: res[0].id_order_statuses,
          name: res[0].name_order_statuses,
          code: res[0].code,
          step_order: res[0].step_order,
          description: res[0].description,
          color_hex: res[0].color_hex,
        };
      }
    }

    const strVal = String(statusOrId).trim();
    const res = await query<any>(
      'SELECT id_order_statuses, name_order_statuses, code, step_order, description, color_hex FROM master_order_statuses WHERE (LOWER(code) = LOWER(?) OR LOWER(name_order_statuses) = LOWER(?)) AND deleted_at IS NULL LIMIT 1',
      [strVal, strVal]
    );
    if (res.length > 0) {
      return {
        id: res[0].id_order_statuses,
        name: res[0].name_order_statuses,
        code: res[0].code,
        step_order: res[0].step_order,
        description: res[0].description,
        color_hex: res[0].color_hex,
      };
    }

    return { id: numericId, name: String(statusOrId), step_order: 1 };
  }

  private async getTimelineForOrder(
    orderId: number,
    currentStepOrder: number = 1,
    currentStatusCode?: string,
    currentStatusName?: string
  ): Promise<TimelineStepEntity[]> {
    // 1. Fetch active master order statuses ordered by step_order ASC
    const masterStatuses = await query<any>(
      'SELECT id_order_statuses, name_order_statuses, code, step_order, color_hex, badge_variant, description FROM master_order_statuses WHERE deleted_at IS NULL AND is_active = 1 ORDER BY step_order ASC'
    );

    // 2. Fetch recorded timeline logs for this order
    const recordedLogs = await query<TimelineStepEntity>(
      `SELECT ${TIMELINE_SELECT} FROM order_timelines t WHERE t.orders_id = ? AND t.deleted_at IS NULL ORDER BY t.step_order ASC`,
      [orderId]
    );

    if (masterStatuses.length === 0) {
      return recordedLogs;
    }

    const maxStepOrder = Math.max(...masterStatuses.map((s: any) => Number(s.step_order) || 1));
    const isFinished =
      currentStepOrder >= maxStepOrder ||
      currentStatusCode === 'pesanan-selesai' ||
      currentStatusCode === 'completed' ||
      Boolean(currentStatusName?.toLowerCase().includes('selesai'));

    return masterStatuses.map((st: any) => {
      const stepNum = Number(st.step_order) || 1;
      const isCompleted = isFinished ? stepNum <= currentStepOrder : stepNum < currentStepOrder;
      const isCurrent = isFinished ? false : stepNum === currentStepOrder;

      const matchedLog = recordedLogs.find(
        (l) =>
          Number(l.order_statuses_id) === Number(st.id_order_statuses) ||
          l.title?.toLowerCase() === st.name_order_statuses?.toLowerCase() ||
          l.step_order === stepNum
      );

      return {
        id: matchedLog?.id || matchedLog?.id_order_timelines || st.id_order_statuses,
        id_order_timelines: matchedLog?.id_order_timelines || st.id_order_statuses,
        orders_id: orderId,
        order_statuses_id: st.id_order_statuses,
        title: st.name_order_statuses,
        description: st.description || matchedLog?.description || 'Proses tahapan SOP laundry',
        time: matchedLog?.time || (isCompleted ? 'Selesai' : isCurrent ? 'Sedang Berjalan' : 'Antrean SOP'),
        is_completed: isCompleted,
        is_current: isCurrent,
        step_order: stepNum,
        created_at: matchedLog?.created_at,
        creator: matchedLog?.creator,
      };
    });
  }

  async findAll(statusFilter?: 'active' | 'history'): Promise<OrderEntity[]> {
    const sql = `
      SELECT ${ORDER_SELECT} 
      FROM orders o
      LEFT JOIN master_order_statuses mos ON o.order_statuses_id = mos.id_order_statuses AND mos.deleted_at IS NULL
      WHERE o.deleted_at IS NULL 
      ORDER BY o.order_date DESC
    `;
    const orders = await query<OrderEntity>(sql);

    for (const order of orders) {
      const stepOrder = Number(order.status_step_order) || 1;
      order.timeline = await this.getTimelineForOrder(
        Number(order.id_orders || order.id),
        stepOrder,
        order.status_code,
        order.status_name || order.status
      );
    }

    if (statusFilter === 'active') {
      return orders.filter((o) => o.status !== 'completed' && o.status !== 'cancelled' && o.status_code !== 'pesanan-selesai');
    } else if (statusFilter === 'history') {
      return orders.filter((o) => o.status === 'completed' || o.status === 'cancelled' || o.status_code === 'pesanan-selesai');
    }
    return orders;
  }

  async findById(id: string | number): Promise<OrderEntity | null> {
    const numericId = CryptoUtil.decryptId(id) ?? id;
    const orders = await query<OrderEntity>(
      `
      SELECT ${ORDER_SELECT} 
      FROM orders o
      LEFT JOIN master_order_statuses mos ON o.order_statuses_id = mos.id_order_statuses AND mos.deleted_at IS NULL
      WHERE o.id_orders = ? AND o.deleted_at IS NULL 
      LIMIT 1
      `,
      [numericId]
    );
    if (orders.length > 0) {
      const order = orders[0];
      const stepOrder = Number(order.status_step_order) || 1;
      order.timeline = await this.getTimelineForOrder(
        Number(order.id_orders || order.id),
        stepOrder,
        order.status_code,
        order.status_name || order.status
      );
      return order;
    }
    return null;
  }

  async create(order: OrderEntity, creatorPic?: number): Promise<OrderEntity> {
    const rawUserId = order.users_id || order.user_id;
    const userId = rawUserId ? (CryptoUtil.decryptId(rawUserId) ?? rawUserId) : null;
    const creatorVal = creatorPic ?? order.creator ?? 0;

    const statusInfo = await this.resolveStatusInfo(order.order_statuses_id || order.status);
    const finalStatusName = statusInfo.name || order.status || '';
    const finalStatusId = statusInfo.id;

    const sql = `
      INSERT INTO orders (invoice_no, users_id, service_name, service_type, order_date, estimated_completion_date, status, order_statuses_id, quantity, unit, price_per_unit, delivery_fee, discount, pickup_address, delivery_address, courier_name, courier_phone, notes, created_at, creator)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?)
    `;
    const orderDate = new Date(order.order_date || Date.now());
    const estDate = new Date(order.estimated_completion_date || Date.now() + 48 * 3600 * 1000);

    const res: any = await query(sql, [
      order.invoice_no,
      userId,
      order.service_name,
      order.service_type,
      orderDate,
      estDate,
      finalStatusName,
      finalStatusId,
      order.quantity,
      order.unit,
      order.price_per_unit,
      order.delivery_fee,
      order.discount,
      order.pickup_address,
      order.delivery_address,
      order.courier_name,
      order.courier_phone,
      order.notes,
      creatorVal,
    ]);

    const insertedId = res?.insertId;
    if (insertedId) {
      // Record initial timeline step
      await query(
        'INSERT INTO order_timelines (orders_id, order_statuses_id, title, description, time, is_completed, is_current, step_order, created_at, creator) VALUES (?, ?, ?, ?, ?, 0, 1, ?, NOW(), ?)',
        [insertedId, finalStatusId, finalStatusName, statusInfo.description || 'Pesanan dibuat dan siap diproses', 'Baru saja', statusInfo.step_order || 1, creatorVal]
      );
    }

    return (await this.findById(insertedId))!;
  }

  async updateOrder(id: string | number, data: Partial<OrderEntity>, updatePic?: number): Promise<OrderEntity | null> {
    const numericId = CryptoUtil.decryptId(id) ?? id;
    const sets: string[] = [];
    const values: any[] = [];

    if (data.service_name !== undefined) {
      sets.push('service_name = ?');
      values.push(data.service_name);
    }
    if (data.service_type !== undefined) {
      sets.push('service_type = ?');
      values.push(data.service_type);
    }
    if (data.quantity !== undefined) {
      sets.push('quantity = ?');
      values.push(data.quantity);
    }
    if (data.unit !== undefined) {
      sets.push('unit = ?');
      values.push(data.unit);
    }
    if (data.price_per_unit !== undefined) {
      sets.push('price_per_unit = ?');
      values.push(data.price_per_unit);
    }
    if (data.pickup_address !== undefined) {
      sets.push('pickup_address = ?');
      values.push(data.pickup_address);
    }
    if (data.delivery_address !== undefined) {
      sets.push('delivery_address = ?');
      values.push(data.delivery_address);
    }
    if (data.courier_name !== undefined) {
      sets.push('courier_name = ?');
      values.push(data.courier_name);
    }
    if (data.courier_phone !== undefined) {
      sets.push('courier_phone = ?');
      values.push(data.courier_phone);
    }
    if (data.notes !== undefined) {
      sets.push('notes = ?');
      values.push(data.notes);
    }
    if (data.status !== undefined || data.order_statuses_id !== undefined) {
      const statusInfo = await this.resolveStatusInfo(data.order_statuses_id || data.status);
      sets.push('status = ?');
      values.push(statusInfo.name);
      sets.push('order_statuses_id = ?');
      values.push(statusInfo.id);

      // Update timeline status log
      await query(
        'UPDATE order_timelines SET is_current = 0 WHERE orders_id = ? AND deleted_at IS NULL',
        [numericId]
      );
      await query(
        'INSERT INTO order_timelines (orders_id, order_statuses_id, title, description, time, is_completed, is_current, step_order, created_at, creator) VALUES (?, ?, ?, ?, ?, 0, 1, ?, NOW(), ?)',
        [numericId, statusInfo.id, statusInfo.name, statusInfo.description || 'Status pengerjaan diperbarui', 'Baru saja', statusInfo.step_order || 1, updatePic || 0]
      );
    }

    sets.push('updated_at = NOW()');
    sets.push('update_pic = ?');
    values.push(updatePic || null);

    values.push(numericId);

    const sql = `UPDATE orders SET ${sets.join(', ')} WHERE id_orders = ? AND deleted_at IS NULL`;
    await query(sql, values);
    return this.findById(numericId);
  }

  async updateStatus(id: string | number, newStatusOrId: string | number, updatePic?: number): Promise<boolean> {
    const numericId = CryptoUtil.decryptId(id) ?? id;
    const statusInfo = await this.resolveStatusInfo(newStatusOrId);

    await query(
      'UPDATE orders SET status = ?, order_statuses_id = ?, updated_at = NOW(), update_pic = ? WHERE id_orders = ?',
      [statusInfo.name, statusInfo.id, updatePic || null, numericId]
    );

    // Record timeline change
    await query(
      'UPDATE order_timelines SET is_current = 0 WHERE orders_id = ? AND deleted_at IS NULL',
      [numericId]
    );
    await query(
      'INSERT INTO order_timelines (orders_id, order_statuses_id, title, description, time, is_completed, is_current, step_order, created_at, creator) VALUES (?, ?, ?, ?, ?, 0, 1, ?, NOW(), ?)',
      [numericId, statusInfo.id, statusInfo.name, statusInfo.description || 'Status diperbarui', 'Baru saja', statusInfo.step_order || 1, updatePic || 0]
    );
    return true;
  }

  async softDelete(id: string | number, deletePic?: number): Promise<boolean> {
    const numericId = CryptoUtil.decryptId(id) ?? id;
    await query('UPDATE orders SET deleted_at = NOW(), delete_pic = ? WHERE id_orders = ?', [deletePic || null, numericId]);
    await query('UPDATE order_timelines SET deleted_at = NOW(), delete_pic = ? WHERE orders_id = ?', [deletePic || null, numericId]);
    return true;
  }
}
