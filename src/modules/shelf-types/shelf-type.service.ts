import { ShelfTypeRepository } from './shelf-type.repository';
import { ShelfTypeEntity, CreateShelfTypeDto, UpdateShelfTypeDto } from './shelf-type.types';
import { CryptoUtil } from '../../utils/crypto.util';

export class ShelfTypeService {
  private repo = new ShelfTypeRepository();

  private formatShelfType(entity: ShelfTypeEntity): ShelfTypeEntity & { raw_id: number } {
    const rawId = Number(entity.id_shelf_types ?? entity.id);
    return {
      ...entity,
      id_shelf_types: rawId,
      id: CryptoUtil.encryptId(rawId) ?? String(rawId),
      name: entity.name_shelf_types ?? entity.name,
      raw_id: rawId,
    };
  }

  async getAllShelfTypes(search?: string): Promise<(ShelfTypeEntity & { raw_id: number })[]> {
    const list = await this.repo.findAll(search);
    return list.map((item) => this.formatShelfType(item));
  }

  async getShelfTypeById(id: string): Promise<(ShelfTypeEntity & { raw_id: number }) | null> {
    const numericId = CryptoUtil.decryptId(id);
    if (!numericId) return null;
    const item = await this.repo.findById(numericId);
    return item ? this.formatShelfType(item) : null;
  }

  async createShelfType(dto: CreateShelfTypeDto, creator: number | null = null): Promise<ShelfTypeEntity & { raw_id: number }> {
    const cleanName = (dto.name_shelf_types || dto.name || '').trim();
    if (!cleanName) {
      throw new Error('Nama jenis rak wajib diisi.');
    }

    const existing = await this.repo.findByName(cleanName);
    if (existing) {
      throw new Error(`Jenis rak "${cleanName}" sudah terdaftar.`);
    }

    const created = await this.repo.create(
      {
        name_shelf_types: cleanName,
        name: cleanName,
      },
      creator,
    );

    return this.formatShelfType(created);
  }

  async updateShelfType(id: string, dto: UpdateShelfTypeDto, updatePic: number | null = null): Promise<(ShelfTypeEntity & { raw_id: number }) | null> {
    const numericId = CryptoUtil.decryptId(id);
    if (!numericId) throw new Error('ID Jenis Rak tidak valid.');

    const cleanName = (dto.name_shelf_types || dto.name || '').trim();
    if (cleanName) {
      const existing = await this.repo.findByName(cleanName, numericId);
      if (existing) {
        throw new Error(`Jenis rak "${cleanName}" sudah digunakan.`);
      }
    }

    const updated = await this.repo.update(
      numericId,
      {
        ...(cleanName && { name_shelf_types: cleanName, name: cleanName }),
      },
      updatePic,
    );

    return updated ? this.formatShelfType(updated) : null;
  }

  async deleteShelfType(id: string, deletePic: number | null = null): Promise<boolean> {
    const numericId = CryptoUtil.decryptId(id);
    if (!numericId) throw new Error('ID Jenis Rak tidak valid.');
    return await this.repo.softDelete(numericId, deletePic);
  }
}
