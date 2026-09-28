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

  async redeemPoints(userId: string, points: number, title?: string, description?: string) {
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

    const success = await this.userRepository.deductRewardPoints(
      userId,
      points,
      title || `Tukar Voucher Diskon (-${points} Poin)`,
      description || `Penukaran ${points} poin dengan voucher diskon Almas Laundry`
    );

    if (!success) {
      throw new Error('Gagal menukarkan poin, silakan coba kembali');
    }

    return {
      success: true,
      message: `Selamat! Berhasil menukarkan ${points} poin reward`,
      remaining_points: currentPoints - points,
    };
  }
}
