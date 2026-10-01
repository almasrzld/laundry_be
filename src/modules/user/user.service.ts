import { UserRepository, AddressEntity } from './user.repository';
import { UserEntity } from '../auth/auth.repository';

export class UserService {
  private userRepository: UserRepository;

  constructor(userRepository?: UserRepository) {
    this.userRepository = userRepository || new UserRepository();
  }

  async getProfile(userId: string): Promise<(UserEntity & { addresses: AddressEntity[] }) | null> {
    const profile = await this.userRepository.getProfile(userId);
    if (!profile) return null;

    const addresses = await this.userRepository.getAddresses(userId);
    return {
      ...profile,
      id: profile.id_users ?? profile.id,
      name: profile.name_users ?? profile.name,
      addresses: addresses.map(a => ({
        ...a,
        id: a.id_addresses ?? a.id,
        user_id: a.users_id ?? a.user_id,
      })),
    };
  }

  async getAddresses(userId: string): Promise<AddressEntity[]> {
    const addresses = await this.userRepository.getAddresses(userId);
    return addresses.map(a => ({
      ...a,
      id: a.id_addresses ?? a.id,
      user_id: a.users_id ?? a.user_id,
    }));
  }

  async addAddress(userId: string, data: Partial<AddressEntity>, creatorPic?: number | null): Promise<AddressEntity> {
    if (!data.full_address) {
      throw new Error('Alamat lengkap wajib diisi');
    }
    return this.userRepository.addAddress(userId, data, creatorPic || undefined);
  }

  async updateAddress(addressId: string, data: Partial<AddressEntity>, updatePic?: number | null): Promise<boolean> {
    if (!data.full_address) {
      throw new Error('Alamat lengkap wajib diisi');
    }
    return this.userRepository.updateAddress(addressId, data, updatePic || undefined);
  }

  async deleteAddress(addressId: string, deletePic?: number | null): Promise<boolean> {
    return this.userRepository.softDeleteAddress(addressId, deletePic || undefined);
  }

  async updateProfile(userId: string, data: Partial<UserEntity>, updatePic?: number | null): Promise<boolean> {
    return this.userRepository.updateProfile(userId, data, updatePic || undefined);
  }

  async changePassword(
    userId: string,
    oldPass: string,
    newPass: string,
    updatePic?: number | null,
    securityQuestions?: { question_1: string; answer_1: string; question_2: string; answer_2: string }
  ): Promise<boolean> {
    if (!oldPass || !newPass) {
      throw new Error('Password lama dan password baru wajib diisi');
    }
    if (newPass.length < 6) {
      throw new Error('Password baru minimal 6 karakter');
    }
    return this.userRepository.changePassword(userId, oldPass, newPass, updatePic || undefined, securityQuestions);
  }

  async getPointHistories(userId: string) {
    return this.userRepository.getPointHistories(userId);
  }

  async redeemPoints(
    userId: string,
    data: {
      points: number;
      code_voucher?: string;
      code?: string;
      title?: string;
      subtitle?: string;
      description?: string;
      discount_amount?: number;
      min_order_amount?: number;
      promos_id?: number | null;
    } | number,
    titleParam?: string,
    descriptionParam?: string
  ) {
    const points = typeof data === 'number' ? data : data.points;
    if (!points || points <= 0) {
      throw new Error('Jumlah poin yang ditukarkan harus lebih dari 0');
    }

    const profile = await this.userRepository.getProfile(userId);
    if (!profile) {
      throw new Error('Pengguna tidak ditemukan');
    }

    const currentPoints = profile.reward_points || 0;
    if (currentPoints < points) {
      throw new Error(`Poin Anda tidak mencukupi (Poin Anda: ${currentPoints}, Dibutuhkan: ${points})`);
    }

    const rawCode = typeof data === 'object' ? (data.code_voucher || data.code) : null;
    const title = typeof data === 'object' ? (data.title || titleParam) : titleParam;
    const subtitle = typeof data === 'object' ? (data.subtitle || data.description || descriptionParam) : descriptionParam;
    const discountAmount = typeof data === 'object' ? (Number(data.discount_amount) || 0) : 0;
    const minOrderAmount = typeof data === 'object' ? (Number(data.min_order_amount) || 0) : 0;
    const promosId = typeof data === 'object' ? data.promos_id : null;

    const finalCode = (rawCode || `REWARD-${points}PTS-${Date.now().toString().slice(-4)}`).toUpperCase();
    const finalTitle = title || `Voucher Reward Diskon (-${points} Poin)`;
    const finalSubtitle = subtitle || `Ditukarkan dengan ${points} Poin Reward`;

    const success = await this.userRepository.deductRewardPoints(
      userId,
      points,
      finalTitle,
      `Penukaran kode voucher ${finalCode}`
    );

    if (!success) {
      throw new Error('Gagal menukarkan poin, silakan coba kembali');
    }

    // Simpan voucher resmi ke tabel user_vouchers milik user ini
    const voucher = await this.userRepository.createUserVoucher(userId, {
      code_voucher: finalCode,
      title: finalTitle,
      subtitle: finalSubtitle,
      discount_amount: discountAmount > 0 ? discountAmount : (points === 50 ? 10000 : points === 100 ? 10000 : points === 200 ? 20000 : points === 300 ? 15000 : points * 100),
      min_order_amount: minOrderAmount > 0 ? minOrderAmount : (points === 50 ? 25000 : points === 100 ? 30000 : points === 200 ? 50000 : points === 300 ? 40000 : 0),
      points_spent: points,
      promos_id: promosId,
    });

    return {
      success: true,
      message: `Selamat! Berhasil menukarkan ${points} poin reward`,
      remaining_points: currentPoints - points,
      voucher,
    };
  }

  async getUserVouchers(userId: string, activeOnly = false) {
    return this.userRepository.getUserVouchers(userId, activeOnly);
  }

  async verifyUserVoucher(userId: string, code: string) {
    if (!code || !code.trim()) {
      throw new Error('Kode voucher wajib diisi');
    }

    const cleanCode = code.trim().toUpperCase();
    const voucher = await this.userRepository.findUserVoucherByCode(userId, cleanCode, true);

    if (!voucher) {
      throw new Error('Kode voucher tidak valid atau belum Anda tukarkan.');
    }

    if (voucher.is_used) {
      throw new Error('Voucher ini sudah pernah digunakan untuk pesanan lain.');
    }

    return voucher;
  }

  async getWalletTransactions(userId: string, limit?: number) {
    return this.userRepository.getWalletTransactions(userId, limit);
  }
}


