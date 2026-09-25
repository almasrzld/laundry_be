import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { AuthRepository, UserEntity } from './auth.repository';
import { UserRepository } from '../user/user.repository';
import { ENV } from '../../config/env';
import { isCustomerRole } from '../../utils/role.util';

export class AuthError extends Error {
  statusCode: number;
  errorPayload?: any;

  constructor(message: string, statusCode: number = 400, errorPayload?: any) {
    super(message);
    this.name = 'AuthError';
    this.statusCode = statusCode;
    this.errorPayload = errorPayload;
  }
}

export class AuthService {
  private authRepository: AuthRepository;
  private userRepository: UserRepository;

  constructor(authRepository?: AuthRepository, userRepository?: UserRepository) {
    this.authRepository = authRepository || new AuthRepository();
    this.userRepository = userRepository || new UserRepository();
  }

  async login(email: string, password?: string): Promise<{ token: string; user: Partial<UserEntity> }> {
    const user = await this.authRepository.findByEmail(email);
    if (!user) {
      throw new AuthError('Email atau password tidak valid', 400, {
        code: 'INVALID_CREDENTIALS',
      });
    }

    // 1. Cek apakah akun terkunci permanen
    if (user.is_permanently_locked) {
      throw new AuthError(
        'Akun Anda telah dinonaktifkan sementara demi keamanan karena melebihi batas percobaan masuk. Silakan datang langsung ke toko offline Almas Laundry terdekat untuk pemulihan akun.',
        403,
        {
          code: 'ACCOUNT_PERMANENTLY_LOCKED',
          is_permanently_locked: true,
        }
      );
    }

    // 2. Cek apakah akun sedang terkunci sementara
    if (user.locked_until) {
      const lockedUntil = new Date(user.locked_until);
      const now = new Date();
      if (lockedUntil.getTime() > now.getTime()) {
        const remainingMs = lockedUntil.getTime() - now.getTime();
        const remainingSec = Math.ceil(remainingMs / 1000);
        const remainingMin = Math.ceil(remainingSec / 60);

        const durationText =
          remainingSec < 60
            ? `${remainingSec} detik`
            : `${remainingMin} menit`;

        throw new AuthError(
          `Akun Anda sedang terkunci sementara. Silakan coba lagi dalam ${durationText}.`,
          429,
          {
            code: 'ACCOUNT_TEMPORARILY_LOCKED',
            locked_until: user.locked_until,
            remaining_seconds: remainingSec,
            remaining_minutes: remainingMin,
            lockout_stage: user.lockout_stage || 0,
          }
        );
      }
    }

    // 3. Verifikasi Password
    let isMatch = false;
    if (user.password && password) {
      isMatch = await bcrypt.compare(password, user.password);
    }

    if (!isMatch) {
      const currentStage = user.lockout_stage || 0;
      // Progressive lockout model:
      // Stage 0: 5 attempts (fails -> locked 5s, stage becomes 1)
      // Stage 1: 4 attempts (fails -> locked 10s, stage becomes 2)
      // Stage 2: 3 attempts (fails -> locked 15s, stage becomes 3)
      // Stage 3: 2 attempts (fails -> locked 20s, stage becomes 4)
      // Stage 4: 1 attempt  (fails -> locked 25s, stage becomes 5)
      // Stage 5: 0 attempts left -> Permanent Lockout!
      const maxAttempts = Math.max(0, 5 - currentStage);

      if (maxAttempts <= 0) {
        await this.authRepository.setPermanentLockout(user.id_users || user.id!);
        throw new AuthError(
          'Akun Anda telah dinonaktifkan sementara demi keamanan karena melebihi batas percobaan masuk. Silakan datang langsung ke toko offline Almas Laundry terdekat untuk pemulihan akun.',
          403,
          {
            code: 'ACCOUNT_PERMANENTLY_LOCKED',
            is_permanently_locked: true,
          }
        );
      }

      const newAttempts = (user.failed_login_attempts || 0) + 1;

      if (newAttempts >= maxAttempts) {
        const nextStage = currentStage + 1;
        // Mode testing: 5 detik per kelipatan stage (Stage 1: 5s, Stage 2: 10s, Stage 3: 15s, Stage 4: 20s, Stage 5: 25s)
        const durationSeconds = nextStage * 5;
        const lockedUntil = new Date(Date.now() + durationSeconds * 1000);

        if (nextStage >= 5) {
          await this.authRepository.recordLockout(user.id_users || user.id!, 0, nextStage, lockedUntil, false);

          throw new AuthError(
            `Akun Anda terkunci selama ${durationSeconds} detik karena gagal login ${maxAttempts} kali berturut-turut. Ini adalah kesempatan terakhir sebelum akun terkunci permanen.`,
            429,
            {
              code: 'ACCOUNT_TEMPORARILY_LOCKED',
              locked_until: lockedUntil.toISOString(),
              remaining_seconds: durationSeconds,
              remaining_minutes: Math.ceil(durationSeconds / 60),
              lockout_stage: nextStage,
              max_attempts_for_next: 0,
            }
          );
        } else {
          await this.authRepository.recordLockout(user.id_users || user.id!, 0, nextStage, lockedUntil, false);

          const nextMaxAttempts = 5 - nextStage;
          throw new AuthError(
            `Akun Anda terkunci selama ${durationSeconds} detik karena gagal login ${maxAttempts} kali berturut-turut. Setelah waktu tunggu selesai, Anda hanya memiliki ${nextMaxAttempts} kali percobaan.`,
            429,
            {
              code: 'ACCOUNT_TEMPORARILY_LOCKED',
              locked_until: lockedUntil.toISOString(),
              remaining_seconds: durationSeconds,
              remaining_minutes: Math.ceil(durationSeconds / 60),
              lockout_stage: nextStage,
              max_attempts_for_next: nextMaxAttempts,
            }
          );
        }
      } else {
        const remainingAttempts = maxAttempts - newAttempts;
        await this.authRepository.recordFailedAttempt(user.id_users || user.id!, newAttempts);

        throw new AuthError(
          `Email atau password tidak valid. Percobaan ke-${newAttempts} dari ${maxAttempts} kali (Sisa ${remainingAttempts} percobaan lagi).`,
          400,
          {
            code: 'INVALID_CREDENTIALS',
            current_attempt: newAttempts,
            max_attempts: maxAttempts,
            remaining_attempts: remainingAttempts,
            lockout_stage: currentStage,
          }
        );
      }
    }

    // 4. Jika login berhasil, reset semua counter lockout
    await this.authRepository.resetLockout(user.id_users || user.id!);

    let userCode: number | null = null;
    try {
      const { UserCodeUtil } = await import('../../utils/user-code.util');
      userCode = await UserCodeUtil.resolveUserCodeAsync(user);
    } catch (_) {}

    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        name: user.name,
        role_code: user.role_code || 'customer',
        role: user.role_code || 'customer',
        user_code: userCode ? String(userCode) : undefined,
        created_at: user.created_at,
      },
      ENV.JWT_SECRET,
      { expiresIn: '30d' }
    );

    const { password: _, ...userWithoutPassword } = user;

    return {
      token,
      user: {
        ...userWithoutPassword,
        ...(userCode ? { user_code: String(userCode) } : {}),
      },
    };
  }

  async register(data: { name: string; email: string; phone: string; password?: string }): Promise<{ token: string; user: Partial<UserEntity> }> {
    const existing = await this.authRepository.findByEmail(data.email);
    if (existing) {
      throw new Error('Email sudah terdaftar. Silakan login.');
    }

    let hashedPassword = undefined;
    if (data.password) {
      hashedPassword = await bcrypt.hash(data.password, 10);
    }

    const newUser = await this.authRepository.createUser({
      name: data.name,
      email: data.email,
      phone: data.phone,
      password: hashedPassword,
      member_tier: 'REGULAR',
      laundry_pay_balance: 0,
      reward_points: 100,
    });

    const token = jwt.sign(
      {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
      },
      ENV.JWT_SECRET,
      { expiresIn: '30d' }
    );

    return {
      token,
      user: newUser,
    };
  }

  async getMe(userId: string): Promise<UserEntity | null> {
    return this.authRepository.findById(userId);
  }

  /**
   * Tahap 1 Lupa Password: Cek identitas pengguna & ambil pertanyaan keamanan
   */
  async initForgotPassword(identifier: string): Promise<{
    session_token: string;
    name: string;
    masked_email: string;
    masked_phone: string;
    question_1: string;
    question_2: string;
  }> {
    if (!identifier || !identifier.trim()) {
      throw new Error('Email atau nomor HP wajib diisi');
    }

    const user = await this.authRepository.findUserByIdentifier(identifier);
    if (!user || !user.id) {
      throw new Error('Pengguna dengan email atau nomor HP tersebut tidak ditemukan');
    }

    const isCustomer = await isCustomerRole(user.role_code);
    const sq = await this.userRepository.getSecurityQuestions(user.id);

    if (!isCustomer || !sq) {
      throw new Error(
        'Akun ini belum memiliki pertanyaan keamanan terdaftar. Silakan hubungi administrator untuk mereset kata sandi Anda.'
      );
    }

    // Masking email (contoh: a***s@domain.com)
    const emailParts = user.email.split('@');
    const maskedName =
      emailParts[0].length <= 2
        ? emailParts[0][0] + '***'
        : emailParts[0].slice(0, 2) + '***' + emailParts[0].slice(-1);
    const maskedEmail = `${maskedName}@${emailParts[1] || ''}`;

    // Masking phone (contoh: 0812****789)
    const phone = user.phone || '';
    const maskedPhone =
      phone.length > 6
        ? phone.slice(0, 4) + '****' + phone.slice(-3)
        : phone;

    const session_token = jwt.sign(
      {
        id: user.id,
        purpose: 'security_question_challenge',
      },
      ENV.JWT_SECRET,
      { expiresIn: '15m' }
    );

    return {
      session_token,
      name: user.name || user.name_users || 'Pelanggan',
      masked_email: maskedEmail,
      masked_phone: maskedPhone,
      question_1: sq.question_1,
      question_2: sq.question_2,
    };
  }

  /**
   * Tahap 2 Lupa Password: Verifikasi jawaban 2 pertanyaan keamanan
   */
  async verifySecurityQuestions(
    sessionToken: string,
    answer1: string,
    answer2: string
  ): Promise<{ reset_token: string; message: string }> {
    if (!sessionToken) {
      throw new Error('Sesi verifikasi tidak valid atau telah kedaluwarsa');
    }
    if (!answer1 || !answer2) {
      throw new Error('Semua jawaban pertanyaan keamanan wajib diisi');
    }

    let decoded: any;
    try {
      decoded = jwt.verify(sessionToken, ENV.JWT_SECRET);
    } catch {
      throw new Error('Sesi verifikasi telah kedaluwarsa. Silakan ulangi proses lupa kata sandi.');
    }

    if (decoded.purpose !== 'security_question_challenge' || !decoded.id) {
      throw new Error('Token verifikasi tidak valid');
    }

    const sqAnswers = await this.userRepository.getSecurityQuestionsWithAnswers(decoded.id);
    if (!sqAnswers) {
      throw new Error('Pertanyaan keamanan tidak ditemukan untuk akun ini');
    }

    const cleanA1 = answer1.trim().toLowerCase();
    const cleanA2 = answer2.trim().toLowerCase();

    const isMatch1 = bcrypt.compareSync(cleanA1, sqAnswers.answer_1);
    const isMatch2 = bcrypt.compareSync(cleanA2, sqAnswers.answer_2);

    if (!isMatch1 || !isMatch2) {
      throw new Error('Jawaban pertanyaan keamanan tidak sesuai. Silakan periksa kembali jawaban Anda.');
    }

    const reset_token = jwt.sign(
      {
        id: decoded.id,
        purpose: 'password_reset',
      },
      ENV.JWT_SECRET,
      { expiresIn: '15m' }
    );

    return {
      reset_token,
      message: 'Pertanyaan keamanan berhasil diverifikasi',
    };
  }

  /**
   * Tahap 3 Lupa Password: Reset kata sandi baru menggunakan reset token
   */
  async resetPasswordWithToken(
    resetToken: string,
    newPassword: string
  ): Promise<{ message: string }> {
    if (!resetToken) {
      throw new Error('Token reset password tidak valid atau telah kedaluwarsa');
    }
    if (!newPassword || newPassword.length < 6) {
      throw new Error('Kata sandi baru minimal 6 karakter');
    }

    let decoded: any;
    try {
      decoded = jwt.verify(resetToken, ENV.JWT_SECRET);
    } catch {
      throw new Error('Sesi reset password telah kedaluwarsa. Silakan ulangi proses lupa kata sandi.');
    }

    if (decoded.purpose !== 'password_reset' || !decoded.id) {
      throw new Error('Token reset password tidak valid');
    }

    const newHash = bcrypt.hashSync(newPassword.trim(), 10);
    await this.authRepository.updatePassword(decoded.id, newHash, decoded.id);
    await this.authRepository.resetLockout(decoded.id);

    return {
      message: 'Kata sandi Anda berhasil diperbarui. Silakan masuk menggunakan kata sandi baru.',
    };
  }
}
