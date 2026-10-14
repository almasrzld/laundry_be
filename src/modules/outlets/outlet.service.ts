import { OutletRepository } from './outlet.repository';
import { OutletEntity, CreateOutletDto, UpdateOutletDto } from './outlet.types';
import { CryptoUtil } from '../../utils/crypto.util';

export class OutletService {
  private repo = new OutletRepository();

  async getAllOutlets(search?: string): Promise<OutletEntity[]> {
    return await this.repo.findAll(search);
  }

  async getOutletById(id: string): Promise<OutletEntity | null> {
    const numericId = CryptoUtil.decryptId(id) || Number(id);
    if (!numericId) return null;
    return await this.repo.findById(numericId);
  }

  async createOutlet(dto: CreateOutletDto, creator: number | null = null): Promise<OutletEntity> {
    const name = (dto.name_outlet || '').trim();
    if (!name) throw new Error('Nama outlet wajib diisi.');

    const address = (dto.address || '').trim();
    if (!address) throw new Error('Alamat outlet wajib diisi.');

    const lat = Number(dto.latitude);
    if (isNaN(lat)) throw new Error('Latitude harus berupa angka valid.');

    const lng = Number(dto.longitude);
    if (isNaN(lng)) throw new Error('Longitude harus berupa angka valid.');

    return await this.repo.create(
      {
        name_outlet: name,
        address,
        latitude: lat,
        longitude: lng,
        phone: dto.phone ? dto.phone.trim() : null,
      },
      creator,
    );
  }

  async updateOutlet(id: string, dto: UpdateOutletDto, updatePic: number | null = null): Promise<OutletEntity | null> {
    const numericId = CryptoUtil.decryptId(id) || Number(id);
    if (!numericId) throw new Error('ID Outlet tidak valid.');

    return await this.repo.update(
      numericId,
      {
        ...(dto.name_outlet !== undefined && { name_outlet: dto.name_outlet.trim() }),
        ...(dto.address !== undefined && { address: dto.address.trim() }),
        ...(dto.latitude !== undefined && { latitude: Number(dto.latitude) }),
        ...(dto.longitude !== undefined && { longitude: Number(dto.longitude) }),
        ...(dto.phone !== undefined && { phone: dto.phone ? dto.phone.trim() : null }),
      },
      updatePic,
    );
  }

  async deleteOutlet(id: string, deletePic: number | null = null): Promise<boolean> {
    const numericId = CryptoUtil.decryptId(id) || Number(id);
    if (!numericId) throw new Error('ID Outlet tidak valid.');

    const current = await this.repo.findById(numericId);
    if (!current) throw new Error('Data Outlet tidak ditemukan.');

    if (current.is_used || (current.used_count && current.used_count > 0)) {
      throw new Error('Outlet tidak dapat dihapus karena sedang digunakan dalam aturan Master Ongkir.');
    }

    return await this.repo.softDelete(numericId, deletePic);
  }
}
