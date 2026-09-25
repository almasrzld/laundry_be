import { UnitRepository } from './unit.repository';
import { UnitEntity, CreateUnitDto, UpdateUnitDto } from './unit.types';
import { CryptoUtil } from '../../utils/crypto.util';

export class UnitService {
  private repo = new UnitRepository();

  private formatUnit(entity: UnitEntity): UnitEntity {
    const rawId = Number(entity.id_units ?? entity.id);
    return {
      ...entity,
      id_units: rawId,
      id: CryptoUtil.encryptId(rawId) ?? String(rawId),
      name: entity.name_units ?? entity.name,
      is_active: Boolean(entity.is_active),
    };
  }

  async getAllUnits(search?: string): Promise<UnitEntity[]> {
    const list = await this.repo.findAll(search);
    return list.map((u) => this.formatUnit(u));
  }

  async getUnitById(id: string): Promise<UnitEntity | null> {
    const numericId = CryptoUtil.decryptId(id);
    if (!numericId) return null;
    const item = await this.repo.findById(numericId);
    return item ? this.formatUnit(item) : null;
  }

  async createUnit(dto: CreateUnitDto, creator: number | null = null): Promise<UnitEntity> {
    const cleanCode = dto.code.trim().toLowerCase();
    const existing = await this.repo.findByCode(cleanCode);
    if (existing) {
      throw new Error(`Kode satuan "${dto.code}" sudah terdaftar.`);
    }

    const unitName = (dto.name_units || dto.name || '').trim();
    const created = await this.repo.create(
      {
        name_units: unitName,
        name: unitName,
        code: cleanCode,
        symbol: dto.symbol?.trim() || cleanCode,
        description: dto.description?.trim() || null,
        is_active: dto.is_active !== undefined ? (dto.is_active ? 1 : 0) : 1,
      },
      creator,
    );

    return this.formatUnit(created);
  }

  async updateUnit(id: string, dto: UpdateUnitDto, updatePic: number | null = null): Promise<UnitEntity | null> {
    const numericId = CryptoUtil.decryptId(id);
    if (!numericId) throw new Error('ID Satuan tidak valid.');

    if (dto.code) {
      const cleanCode = dto.code.trim().toLowerCase();
      const existing = await this.repo.findByCode(cleanCode, numericId);
      if (existing) {
        throw new Error(`Kode satuan "${dto.code}" sudah digunakan.`);
      }
    }

    const unitName = dto.name_units !== undefined ? dto.name_units.trim() : (dto.name !== undefined ? dto.name.trim() : undefined);

    const updated = await this.repo.update(
      numericId,
      {
        ...(unitName !== undefined && { name_units: unitName, name: unitName }),
        ...(dto.code && { code: dto.code.trim().toLowerCase() }),
        ...(dto.symbol !== undefined && { symbol: dto.symbol?.trim() || null }),
        ...(dto.description !== undefined && { description: dto.description?.trim() || null }),
        ...(dto.is_active !== undefined && { is_active: dto.is_active ? 1 : 0 }),
      },
      updatePic,
    );

    return updated ? this.formatUnit(updated) : null;
  }

  async deleteUnit(id: string, deletePic: number | null = null): Promise<boolean> {
    const numericId = CryptoUtil.decryptId(id);
    if (!numericId) throw new Error('ID Satuan tidak valid.');
    return await this.repo.softDelete(numericId, deletePic);
  }
}
