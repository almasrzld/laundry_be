import { UnitRepository } from "./unit.repository";
import { UnitEntity, CreateUnitDto, UpdateUnitDto } from "./unit.types";
import { CryptoUtil } from "../../utils/crypto.util";

export class UnitService {
  private repo = new UnitRepository();

  private formatUnit(entity: UnitEntity): UnitEntity {
    const rawId = Number(entity.id_units ?? entity.id);
    return {
      ...entity,
      id_units: rawId,
      id: CryptoUtil.encryptId(rawId) ?? String(rawId),
      name_unit: entity.name_unit,
      code_unit: entity.code_unit,
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

  async createUnit(
    dto: CreateUnitDto,
    creator: number | null = null,
  ): Promise<UnitEntity> {
    const cleanCode = dto.code_unit.trim().toLowerCase();
    if (!cleanCode) {
      throw new Error("Kode satuan wajib diisi.");
    }

    const existing = await this.repo.findByCode(cleanCode);
    if (existing) {
      throw new Error(`Kode satuan "${cleanCode}" sudah terdaftar.`);
    }

    const unitName = dto.name_unit.trim();
    if (!unitName) {
      throw new Error("Nama satuan wajib diisi.");
    }

    const created = await this.repo.create(
      {
        name_unit: unitName,
        code_unit: cleanCode,
        symbol: dto.symbol?.trim() || null,
        description: dto.description?.trim() || null,
        is_active: dto.is_active ? 1 : 0,
      },
      creator,
    );

    return this.formatUnit(created);
  }

  async updateUnit(
    id: string,
    dto: UpdateUnitDto,
    updatePic: number | null = null,
  ): Promise<UnitEntity | null> {
    const numericId = CryptoUtil.decryptId(id);
    if (!numericId) throw new Error("ID Satuan tidak valid.");

    if (dto.code_unit !== undefined) {
      const cleanCode = dto.code_unit.trim().toLowerCase();
      const existing = await this.repo.findByCode(cleanCode, numericId);
      if (existing) {
        throw new Error(`Kode satuan "${cleanCode}" sudah digunakan.`);
      }
    }

    const updated = await this.repo.update(
      numericId,
      {
        ...(dto.name_unit !== undefined && { name_unit: dto.name_unit.trim() }),
        ...(dto.code_unit !== undefined && { code_unit: dto.code_unit.trim().toLowerCase() }),
        ...(dto.symbol !== undefined && { symbol: dto.symbol?.trim() || null }),
        ...(dto.description !== undefined && {
          description: dto.description?.trim() || null,
        }),
        ...(dto.is_active !== undefined && {
          is_active: dto.is_active ? 1 : 0,
        }),
      },
      updatePic,
    );

    return updated ? this.formatUnit(updated) : null;
  }

  async deleteUnit(
    id: string,
    deletePic: number | null = null,
  ): Promise<boolean> {
    const numericId = CryptoUtil.decryptId(id);
    if (!numericId) throw new Error("ID Satuan tidak valid.");
    return await this.repo.softDelete(numericId, deletePic);
  }
}
