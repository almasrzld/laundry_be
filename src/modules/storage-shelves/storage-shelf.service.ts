import { StorageShelfRepository } from './storage-shelf.repository';
import { StorageShelfEntity, CreateStorageShelfDto, UpdateStorageShelfDto } from './storage-shelf.types';
import { CryptoUtil } from '../../utils/crypto.util';

export class StorageShelfService {
  private repo = new StorageShelfRepository();

  private formatShelf(entity: StorageShelfEntity): StorageShelfEntity {
    const rawId = Number(entity.id_storage_shelves ?? entity.id);
    return {
      ...entity,
      id_storage_shelves: rawId,
      id: CryptoUtil.encryptId(rawId) ?? String(rawId),
      name: entity.name_storage_shelves ?? entity.name,
      capacity: Number(entity.capacity) || 0,
      is_active: Boolean(entity.is_active),
    };
  }

  async getAllShelves(search?: string): Promise<StorageShelfEntity[]> {
    const list = await this.repo.findAll(search);
    return list.map((s) => this.formatShelf(s));
  }

  async getShelfById(id: string): Promise<StorageShelfEntity | null> {
    const numericId = CryptoUtil.decryptId(id);
    if (!numericId) return null;
    const item = await this.repo.findById(numericId);
    return item ? this.formatShelf(item) : null;
  }

  async getNextCode(shelfTypeId: number | string): Promise<string> {
    const numericTypeId = CryptoUtil.decryptId(String(shelfTypeId)) || Number(shelfTypeId) || 1;
    return await this.repo.getNextCode(numericTypeId);
  }

  async createShelf(dto: CreateStorageShelfDto, creator: number | null = null): Promise<StorageShelfEntity> {
    const cleanCode = dto.code.trim().toUpperCase();
    const existing = await this.repo.findByCode(cleanCode);
    if (existing) {
      throw new Error(`Kode rak "${dto.code}" sudah terdaftar.`);
    }

    const shelfName = (dto.name_storage_shelves || dto.name || '').trim();
    const created = await this.repo.create(
      {
        name_storage_shelves: shelfName,
        name: shelfName,
        shelf_types_id: dto.shelf_types_id,
        code: cleanCode,
        capacity: dto.capacity !== undefined ? Number(dto.capacity) : 0,
        location_notes: dto.location_notes?.trim() || null,
        is_active: dto.is_active !== undefined ? (dto.is_active ? 1 : 0) : 1,
      },
      creator,
    );

    return this.formatShelf(created);
  }

  async updateShelf(id: string, dto: UpdateStorageShelfDto, updatePic: number | null = null): Promise<StorageShelfEntity | null> {
    const numericId = CryptoUtil.decryptId(id);
    if (!numericId) throw new Error('ID Rak tidak valid.');

    if (dto.code) {
      const cleanCode = dto.code.trim().toUpperCase();
      const existing = await this.repo.findByCode(cleanCode, numericId);
      if (existing) {
        throw new Error(`Kode rak "${dto.code}" sudah digunakan.`);
      }
    }

    const shelfName = dto.name_storage_shelves !== undefined ? dto.name_storage_shelves.trim() : (dto.name !== undefined ? dto.name.trim() : undefined);

    const updated = await this.repo.update(
      numericId,
      {
        ...(shelfName !== undefined && { name_storage_shelves: shelfName, name: shelfName }),
        ...(dto.shelf_types_id !== undefined && { shelf_types_id: dto.shelf_types_id }),
        ...(dto.code && { code: dto.code.trim().toUpperCase() }),
        ...(dto.capacity !== undefined && { capacity: Number(dto.capacity) }),
        ...(dto.location_notes !== undefined && { location_notes: dto.location_notes?.trim() || null }),
        ...(dto.is_active !== undefined && { is_active: dto.is_active ? 1 : 0 }),
      },
      updatePic,
    );

    return updated ? this.formatShelf(updated) : null;
  }

  async deleteShelf(id: string, deletePic: number | null = null): Promise<boolean> {
    const numericId = CryptoUtil.decryptId(id);
    if (!numericId) throw new Error('ID Rak tidak valid.');
    return await this.repo.softDelete(numericId, deletePic);
  }
}
