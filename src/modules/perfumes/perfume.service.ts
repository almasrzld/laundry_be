import { PerfumeRepository } from './perfume.repository';
import { PerfumeEntity, CreatePerfumeDto, UpdatePerfumeDto } from './perfume.types';
import { CryptoUtil } from '../../utils/crypto.util';

export class PerfumeService {
  private repo = new PerfumeRepository();

  private formatPerfume(entity: PerfumeEntity): PerfumeEntity {
    const rawId = Number(entity.id_perfumes ?? entity.id);
    return {
      ...entity,
      id_perfumes: rawId,
      id: CryptoUtil.encryptId(rawId) ?? String(rawId),
      name: entity.name_perfumes ?? entity.name,
      is_active: Boolean(entity.is_active),
    };
  }

  async getAllPerfumes(search?: string): Promise<PerfumeEntity[]> {
    const list = await this.repo.findAll(search);
    return list.map((p) => this.formatPerfume(p));
  }

  async getPerfumeById(id: string): Promise<PerfumeEntity | null> {
    const numericId = CryptoUtil.decryptId(id);
    if (!numericId) return null;
    const item = await this.repo.findById(numericId);
    return item ? this.formatPerfume(item) : null;
  }

  async createPerfume(dto: CreatePerfumeDto, creator: number | null = null): Promise<PerfumeEntity> {
    const cleanCode = dto.code.trim().toLowerCase();
    const existing = await this.repo.findByCode(cleanCode);
    if (existing) {
      throw new Error(`Kode parfum "${dto.code}" sudah terdaftar.`);
    }

    const perfumeName = (dto.name_perfumes || dto.name || '').trim();
    const created = await this.repo.create(
      {
        name_perfumes: perfumeName,
        name: perfumeName,
        code: cleanCode,
        scent_type: dto.scent_type?.trim() || null,
        description: dto.description?.trim() || null,
        is_active: dto.is_active !== undefined ? (dto.is_active ? 1 : 0) : 1,
      },
      creator,
    );

    return this.formatPerfume(created);
  }

  async updatePerfume(id: string, dto: UpdatePerfumeDto, updatePic: number | null = null): Promise<PerfumeEntity | null> {
    const numericId = CryptoUtil.decryptId(id);
    if (!numericId) throw new Error('ID Parfum tidak valid.');

    if (dto.code) {
      const cleanCode = dto.code.trim().toLowerCase();
      const existing = await this.repo.findByCode(cleanCode, numericId);
      if (existing) {
        throw new Error(`Kode parfum "${dto.code}" sudah digunakan.`);
      }
    }

    const perfumeName = dto.name_perfumes !== undefined ? dto.name_perfumes.trim() : (dto.name !== undefined ? dto.name.trim() : undefined);

    const updated = await this.repo.update(
      numericId,
      {
        ...(perfumeName !== undefined && { name_perfumes: perfumeName, name: perfumeName }),
        ...(dto.code && { code: dto.code.trim().toLowerCase() }),
        ...(dto.scent_type !== undefined && { scent_type: dto.scent_type?.trim() || null }),
        ...(dto.description !== undefined && { description: dto.description?.trim() || null }),
        ...(dto.is_active !== undefined && { is_active: dto.is_active ? 1 : 0 }),
      },
      updatePic,
    );

    return updated ? this.formatPerfume(updated) : null;
  }

  async deletePerfume(id: string, deletePic: number | null = null): Promise<boolean> {
    const numericId = CryptoUtil.decryptId(id);
    if (!numericId) throw new Error('ID Parfum tidak valid.');
    return await this.repo.softDelete(numericId, deletePic);
  }
}
