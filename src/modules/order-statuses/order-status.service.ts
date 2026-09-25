import { OrderStatusRepository } from './order-status.repository';
import { OrderStatusEntity, CreateOrderStatusDto, UpdateOrderStatusDto } from './order-status.types';
import { CryptoUtil } from '../../utils/crypto.util';

export class OrderStatusService {
  private repo = new OrderStatusRepository();

  private formatStatus(entity: OrderStatusEntity): OrderStatusEntity {
    const rawId = Number(entity.id_order_statuses ?? entity.id);
    return {
      ...entity,
      id_order_statuses: rawId,
      id: CryptoUtil.encryptId(rawId) ?? String(rawId),
      name: entity.name_order_statuses ?? entity.name,
      step_order: Number(entity.step_order) || 1,
      is_active: Boolean(entity.is_active),
    };
  }

  async getAllOrderStatuses(search?: string): Promise<OrderStatusEntity[]> {
    const list = await this.repo.findAll(search);
    return list.map((st) => this.formatStatus(st));
  }

  async getOrderStatusById(id: string): Promise<OrderStatusEntity | null> {
    const numericId = CryptoUtil.decryptId(id);
    if (!numericId) return null;
    const item = await this.repo.findById(numericId);
    return item ? this.formatStatus(item) : null;
  }

  async createOrderStatus(dto: CreateOrderStatusDto, creator: number | null = null): Promise<OrderStatusEntity> {
    const cleanCode = dto.code.trim().toLowerCase();
    const existing = await this.repo.findByCode(cleanCode);
    if (existing) {
      throw new Error(`Kode status "${dto.code}" sudah terdaftar.`);
    }

    const statusName = (dto.name_order_statuses || dto.name || '').trim();
    const created = await this.repo.create(
      {
        name_order_statuses: statusName,
        name: statusName,
        code: cleanCode,
        step_order: Number(dto.step_order) || 1,
        color_hex: dto.color_hex || '#0284c7',
        badge_variant: dto.badge_variant || 'info',
        description: dto.description?.trim() || null,
        is_active: dto.is_active !== undefined ? (dto.is_active ? 1 : 0) : 1,
      },
      creator,
    );

    return this.formatStatus(created);
  }

  async updateOrderStatus(id: string, dto: UpdateOrderStatusDto, updatePic: number | null = null): Promise<OrderStatusEntity | null> {
    const numericId = CryptoUtil.decryptId(id);
    if (!numericId) throw new Error('ID Status tidak valid.');

    if (dto.code) {
      const cleanCode = dto.code.trim().toLowerCase();
      const existing = await this.repo.findByCode(cleanCode, numericId);
      if (existing) {
        throw new Error(`Kode status "${dto.code}" sudah digunakan.`);
      }
    }

    const statusName = dto.name_order_statuses !== undefined ? dto.name_order_statuses.trim() : (dto.name !== undefined ? dto.name.trim() : undefined);

    const updated = await this.repo.update(
      numericId,
      {
        ...(statusName !== undefined && { name_order_statuses: statusName, name: statusName }),
        ...(dto.code && { code: dto.code.trim().toLowerCase() }),
        ...(dto.step_order !== undefined && { step_order: Number(dto.step_order) }),
        ...(dto.color_hex !== undefined && { color_hex: dto.color_hex }),
        ...(dto.badge_variant !== undefined && { badge_variant: dto.badge_variant }),
        ...(dto.description !== undefined && { description: dto.description?.trim() || null }),
        ...(dto.is_active !== undefined && { is_active: dto.is_active ? 1 : 0 }),
      },
      updatePic,
    );

    return updated ? this.formatStatus(updated) : null;
  }

  async deleteOrderStatus(id: string, deletePic: number | null = null): Promise<boolean> {
    const numericId = CryptoUtil.decryptId(id);
    if (!numericId) throw new Error('ID Status tidak valid.');
    return await this.repo.softDelete(numericId, deletePic);
  }
}
