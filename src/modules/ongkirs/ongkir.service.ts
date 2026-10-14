import { OngkirRepository } from './ongkir.repository';
import { OutletRepository } from '../outlets/outlet.repository';
import {
  OngkirEntity,
  CreateOngkirDto,
  UpdateOngkirDto,
  CalculateOngkirDto,
  CalculateOngkirResult,
  OngkirTierPreview,
} from './ongkir.types';
import { CryptoUtil } from '../../utils/crypto.util';

export class OngkirService {
  private repo = new OngkirRepository();
  private outletRepo = new OutletRepository();

  /**
   * Menghitung jarak garis lurus bumi (Haversine formula) dalam satuan Kilometer (KM)
   */
  private calculateHaversineDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const toRad = (val: number) => (val * Math.PI) / 180;
    const R = 6371; // Radius bumi dalam KM

    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;

    return Math.round(distance * 100) / 100; // Pembulatan 2 desimal
  }

  /**
   * Menghasilkan deretan tier preview sequence otomatis dari satu konfigurasi ongkir
   */
  generateTiers(config: Partial<OngkirEntity>, customUnitSymbol?: string): OngkirTierPreview[] {
    const freeRadius = Number(config.free_radius);
    const baseRadius = Number(config.base_radius);
    const basePrice = Number(config.base_price);
    const stepRadius = Number(config.step_radius);
    const stepPrice = Number(config.step_price);
    const maxRadius = Number(config.max_radius);
    const unitSymbol = (customUnitSymbol || config.unit_symbol || config.unit_code || 'km').trim();

    if (
      isNaN(freeRadius) ||
      isNaN(baseRadius) ||
      isNaN(basePrice) ||
      isNaN(stepRadius) ||
      isNaN(stepPrice) ||
      isNaN(maxRadius) ||
      freeRadius < 0 ||
      baseRadius <= 0 ||
      freeRadius >= baseRadius ||
      stepRadius <= 0 ||
      stepPrice < 0 ||
      basePrice < 0 ||
      maxRadius <= baseRadius
    ) {
      return [];
    }

    const tiers: OngkirTierPreview[] = [];
    let tierIdx = 1;

    // 1. Tier Gratis (0 s/d freeRadius)
    if (freeRadius > 0) {
      tiers.push({
        tier_index: tierIdx,
        code: String(tierIdx).padStart(3, '0'),
        min_distance: 0,
        max_distance: freeRadius,
        price: 0,
        label: `Gratis ongkir untuk jarak dekat (maks. ${freeRadius.toFixed(1)} ${unitSymbol})`,
        is_free: true,
        unit_symbol: unitSymbol,
      });
      tierIdx++;
    }

    // 2. Tier Radius Dasar (freeRadius s/d baseRadius)
    if (baseRadius > freeRadius) {
      tiers.push({
        tier_index: tierIdx,
        code: String(tierIdx).padStart(3, '0'),
        min_distance: freeRadius,
        max_distance: baseRadius,
        price: basePrice,
        label: `Tarif dasar flat (jarak > ${freeRadius.toFixed(1)} s/d ${baseRadius.toFixed(1)} ${unitSymbol})`,
        is_free: false,
        unit_symbol: unitSymbol,
      });
      tierIdx++;
    }

    // 3. Tier Bertingkat (+stepRadius s/d maxRadius)
    let currentMin = Math.max(baseRadius, freeRadius);
    let currentPrice = basePrice;
    let stepCount = 1;

    while (currentMin < maxRadius) {
      const currentMax = Math.min(currentMin + stepRadius, maxRadius);
      currentPrice += stepPrice;

      tiers.push({
        tier_index: tierIdx,
        code: String(tierIdx).padStart(3, '0'),
        min_distance: Math.round(currentMin * 10) / 10,
        max_distance: Math.round(currentMax * 10) / 10,
        price: currentPrice,
        label: `Tarif dasar Rp ${basePrice.toLocaleString('id-ID')} + ${stepCount}x tambahan Rp ${stepPrice.toLocaleString('id-ID')}`,
        is_free: false,
        unit_symbol: unitSymbol,
      });

      currentMin = currentMax;
      stepCount++;
      tierIdx++;
    }

    return tiers;
  }

  async getAllOngkirs(search?: string): Promise<OngkirEntity[]> {
    return await this.repo.findAll(search);
  }

  async getOngkirById(id: string): Promise<OngkirEntity | null> {
    const numericId = CryptoUtil.decryptId(id) || Number(id);
    if (!numericId) return null;
    return await this.repo.findById(numericId);
  }

  async getNextCode(): Promise<string> {
    return await this.repo.getNextCode();
  }

  async createOngkir(dto: CreateOngkirDto, creator: number | null = null): Promise<OngkirEntity> {
    let cleanCode = (dto.code_ongkir || '').trim().toUpperCase();
    if (!cleanCode) {
      cleanCode = await this.repo.getNextCode();
    }
    if (cleanCode.length > 3) {
      throw new Error('Kode ongkir maksimal 3 karakter.');
    }

    const existing = await this.repo.findByCode(cleanCode);
    if (existing) {
      throw new Error(`Kode ongkir "${cleanCode}" sudah terdaftar.`);
    }

    const name = (dto.name_ongkir || '').trim();
    if (!name) {
      throw new Error('Nama aturan ongkir wajib diisi.');
    }

    const rawOutletId = CryptoUtil.decryptId(String(dto.outlets_id)) || Number(dto.outlets_id);
    if (!rawOutletId) {
      throw new Error('Outlet wajib dipilih.');
    }

    const existingOutletOngkir = await this.repo.findByOutletId(rawOutletId);
    if (existingOutletOngkir) {
      throw new Error(`Outlet "${existingOutletOngkir.outlet_name || 'terpilih'}" sudah memiliki aturan tarif ongkir aktif.`);
    }

    const rawUnitId = CryptoUtil.decryptId(String(dto.units_id)) || Number(dto.units_id);
    if (!rawUnitId) {
      throw new Error('Satuan jarak wajib dipilih.');
    }

    if (dto.free_radius === undefined || isNaN(Number(dto.free_radius)) || Number(dto.free_radius) < 0) {
      throw new Error('Radius gratis wajib diisi angka valid (minimal 0).');
    }
    if (dto.base_radius === undefined || isNaN(Number(dto.base_radius)) || Number(dto.base_radius) <= 0) {
      throw new Error('Radius dasar wajib diisi angka lebih besar dari 0.');
    }
    if (dto.base_price === undefined || isNaN(Number(dto.base_price)) || Number(dto.base_price) < 0) {
      throw new Error('Tarif dasar wajib diisi angka valid.');
    }
    if (dto.step_radius === undefined || isNaN(Number(dto.step_radius)) || Number(dto.step_radius) <= 0) {
      throw new Error('Kelipatan jarak tambahan wajib diisi angka lebih besar dari 0.');
    }
    if (dto.step_price === undefined || isNaN(Number(dto.step_price)) || Number(dto.step_price) < 0) {
      throw new Error('Tarif tambahan per jarak wajib diisi angka valid.');
    }
    if (dto.max_radius === undefined || isNaN(Number(dto.max_radius)) || Number(dto.max_radius) <= 0) {
      throw new Error('Maksimal jangkauan pengantaran wajib diisi angka lebih besar dari 0.');
    }

    const freeRadius = Number(dto.free_radius);
    const baseRadius = Number(dto.base_radius);
    const basePrice = Number(dto.base_price);
    const stepRadius = Number(dto.step_radius);
    const stepPrice = Number(dto.step_price);
    const maxRadius = Number(dto.max_radius);

    if (freeRadius >= baseRadius) {
      throw new Error('Radius gratis tidak boleh lebih besar atau sama dengan radius dasar.');
    }
    if (maxRadius <= baseRadius) {
      throw new Error('Maksimal jangkauan harus lebih besar dari radius dasar.');
    }

    return await this.repo.create(
      {
        outlets_id: rawOutletId,
        units_id: rawUnitId,
        name_ongkir: name,
        code_ongkir: cleanCode,
        free_radius: freeRadius,
        base_radius: baseRadius,
        base_price: basePrice,
        step_radius: stepRadius,
        step_price: stepPrice,
        max_radius: maxRadius,
      },
      creator,
    );
  }

  async updateOngkir(id: string, dto: UpdateOngkirDto, updatePic: number | null = null): Promise<OngkirEntity | null> {
    const numericId = CryptoUtil.decryptId(id) || Number(id);
    if (!numericId) throw new Error('ID Ongkir tidak valid.');

    const current = await this.repo.findById(numericId);
    if (!current) throw new Error('Data Master Ongkir tidak ditemukan.');

    if (dto.code_ongkir !== undefined) {
      const cleanCode = dto.code_ongkir.trim().toUpperCase();
      if (cleanCode.length > 3) {
        throw new Error('Kode ongkir maksimal 3 karakter.');
      }
      const existing = await this.repo.findByCode(cleanCode, numericId);
      if (existing) {
        throw new Error(`Kode ongkir "${cleanCode}" sudah digunakan.`);
      }
    }

    const finalFreeRadius = dto.free_radius !== undefined ? Number(dto.free_radius) : Number(current.free_radius);
    const finalBaseRadius = dto.base_radius !== undefined ? Number(dto.base_radius) : Number(current.base_radius);
    const finalMaxRadius = dto.max_radius !== undefined ? Number(dto.max_radius) : Number(current.max_radius);
    const finalStepRadius = dto.step_radius !== undefined ? Number(dto.step_radius) : Number(current.step_radius);

    if (isNaN(finalFreeRadius) || finalFreeRadius < 0) {
      throw new Error('Radius gratis wajib diisi angka valid (minimal 0).');
    }
    if (isNaN(finalBaseRadius) || finalBaseRadius <= 0) {
      throw new Error('Radius dasar wajib diisi angka lebih besar dari 0.');
    }
    if (finalFreeRadius >= finalBaseRadius) {
      throw new Error('Radius gratis tidak boleh lebih besar atau sama dengan radius dasar.');
    }
    if (finalMaxRadius <= finalBaseRadius) {
      throw new Error('Maksimal jangkauan harus lebih besar dari radius dasar.');
    }
    if (isNaN(finalStepRadius) || finalStepRadius <= 0) {
      throw new Error('Kelipatan jarak tambahan harus lebih besar dari 0.');
    }

    const rawOutletId = dto.outlets_id !== undefined
      ? (CryptoUtil.decryptId(String(dto.outlets_id)) || Number(dto.outlets_id))
      : undefined;

    if (rawOutletId !== undefined) {
      const existingOutletOngkir = await this.repo.findByOutletId(rawOutletId, numericId);
      if (existingOutletOngkir) {
        throw new Error(`Outlet "${existingOutletOngkir.outlet_name || 'terpilih'}" sudah memiliki aturan tarif ongkir aktif.`);
      }
    }

    const rawUnitId = dto.units_id !== undefined
      ? (CryptoUtil.decryptId(String(dto.units_id)) || Number(dto.units_id))
      : undefined;

    return await this.repo.update(
      numericId,
      {
        ...(rawOutletId !== undefined && { outlets_id: rawOutletId }),
        ...(rawUnitId !== undefined && { units_id: rawUnitId }),
        ...(dto.name_ongkir !== undefined && { name_ongkir: dto.name_ongkir.trim() }),
        ...(dto.code_ongkir !== undefined && { code_ongkir: dto.code_ongkir.trim().toUpperCase() }),
        ...(dto.free_radius !== undefined && { free_radius: Number(dto.free_radius) }),
        ...(dto.base_radius !== undefined && { base_radius: Number(dto.base_radius) }),
        ...(dto.base_price !== undefined && { base_price: Number(dto.base_price) }),
        ...(dto.step_radius !== undefined && { step_radius: Number(dto.step_radius) }),
        ...(dto.step_price !== undefined && { step_price: Number(dto.step_price) }),
        ...(dto.max_radius !== undefined && { max_radius: Number(dto.max_radius) }),
      },
      updatePic,
    );
  }

  async deleteOngkir(id: string, deletePic: number | null = null): Promise<boolean> {
    const numericId = CryptoUtil.decryptId(id) || Number(id);
    if (!numericId) throw new Error('ID Ongkir tidak valid.');
    return await this.repo.softDelete(numericId, deletePic);
  }

  /**
   * Menghitung ongkir secara presisi berdasarkan koordinat pelanggan & outlet
   */
  async calculateOngkir(dto: CalculateOngkirDto): Promise<CalculateOngkirResult> {
    const custLat = Number(dto.latitude);
    const custLon = Number(dto.longitude);

    if (isNaN(custLat) || isNaN(custLon) || (custLat === 0 && custLon === 0)) {
      throw new Error('Koordinat pelanggan (latitude & longitude) tidak valid.');
    }

    // Ambil semua outlet aktif
    const outlets = await this.outletRepo.findAll();
    if (outlets.length === 0) {
      throw new Error('Belum ada data master outlet yang terdaftar.');
    }

    let selectedOutlet = outlets[0];

    if (dto.outlets_id) {
      const rawOutletId = CryptoUtil.decryptId(String(dto.outlets_id)) || Number(dto.outlets_id);
      const matched = outlets.find((o) => Number(o.id_outlets) === Number(rawOutletId));
      if (matched) selectedOutlet = matched;
    } else {
      // Cari outlet terdekat
      let minDistance = Infinity;
      for (const o of outlets) {
        const oLat = Number(o.latitude);
        const oLng = Number(o.longitude);
        if (!isNaN(oLat) && !isNaN(oLng) && (oLat !== 0 || oLng !== 0)) {
          const d = this.calculateHaversineDistance(custLat, custLon, oLat, oLng);
          if (d < minDistance) {
            minDistance = d;
            selectedOutlet = o;
          }
        }
      }
    }

    const distance = this.calculateHaversineDistance(
      custLat,
      custLon,
      Number(selectedOutlet.latitude),
      Number(selectedOutlet.longitude),
    );

    // Ambil aturan ongkir untuk outlet ini
    const ongkirRule = await this.repo.findByOutletId(Number(selectedOutlet.id_outlets));
    if (!ongkirRule) {
      throw new Error(`Aturan tarif ongkir untuk outlet "${selectedOutlet.name_outlet}" belum dikonfigurasi.`);
    }

    const unitSymbol = (ongkirRule.unit_symbol || ongkirRule.unit_code || 'km').trim();
    const freeRadius = Number(ongkirRule.free_radius);
    const baseRadius = Number(ongkirRule.base_radius);
    const basePrice = Number(ongkirRule.base_price);
    const stepRadius = Number(ongkirRule.step_radius);
    const stepPrice = Number(ongkirRule.step_price);
    const maxRadius = Number(ongkirRule.max_radius);

    let price = 0;
    let isFree = false;
    let isDeliverable = true;
    let tierLabel = '';
    let message = '';
    let excessDistance = 0;
    let additionalSteps = 0;

    if (distance > maxRadius) {
      isDeliverable = false;
      price = 0;
      tierLabel = `Di Luar Jangkauan (> ${maxRadius} ${unitSymbol})`;
      message = `Lokasi Anda berjarak ${distance} ${unitSymbol} dari ${selectedOutlet.name_outlet}, melebihi batas jangkauan pengiriman (${maxRadius} ${unitSymbol}).`;
    } else if (distance <= freeRadius) {
      // Gratis Ongkir jika <= freeRadius
      isFree = true;
      price = 0;
      tierLabel = `Gratis Ongkir (≤ ${freeRadius} ${unitSymbol})`;
      message = `Gratis ongkos kirim untuk jarak ${distance} ${unitSymbol} (di dalam radius ${freeRadius} ${unitSymbol}).`;
    } else if (distance <= baseRadius) {
      // Tarif Dasar jika <= baseRadius
      price = basePrice;
      isFree = false;
      tierLabel = `Radius Dasar (> ${freeRadius} - ${baseRadius} ${unitSymbol})`;
      message = `Tarif pengiriman Rp ${basePrice.toLocaleString('id-ID')} untuk jarak ${distance} ${unitSymbol}.`;
    } else {
      // Tambahan per kelipatan stepRadius
      excessDistance = Math.round((distance - baseRadius) * 100) / 100;
      additionalSteps = Math.ceil(excessDistance / stepRadius);
      price = basePrice + additionalSteps * stepPrice;
      isFree = false;
      tierLabel = `Radius +${additionalSteps * stepRadius} ${unitSymbol} (> ${baseRadius} - ${baseRadius + additionalSteps * stepRadius} ${unitSymbol})`;
      message = `Tarif pengiriman Rp ${price.toLocaleString('id-ID')} (${distance} ${unitSymbol}: dasar Rp ${basePrice.toLocaleString('id-ID')} + ${additionalSteps}x tambahan Rp ${stepPrice.toLocaleString('id-ID')}).`;
    }

    return {
      distance,
      distance_km: distance,
      price_ongkir: price,
      is_free: isFree,
      is_deliverable: isDeliverable,
      message,
      tier_label: tierLabel,
      unit: ongkirRule.unit_id ? {
        id: String(ongkirRule.unit_id),
        name_unit: ongkirRule.unit_name || '',
        code_unit: ongkirRule.unit_code || '',
        symbol: ongkirRule.unit_symbol || '',
      } : null,
      outlet: {
        id: selectedOutlet.id ? String(selectedOutlet.id) : '',
        name_outlet: selectedOutlet.name_outlet,
        address: selectedOutlet.address,
        latitude: Number(selectedOutlet.latitude),
        longitude: Number(selectedOutlet.longitude),
      },
      breakdown: {
        free_radius: freeRadius,
        base_radius: baseRadius,
        base_price: basePrice,
        step_radius: stepRadius,
        step_price: stepPrice,
        max_radius: maxRadius,
        excess_distance: excessDistance,
        additional_steps: additionalSteps,
      },
    };
  }
}
