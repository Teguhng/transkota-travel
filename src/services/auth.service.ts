import bcrypt from 'bcryptjs';
import { userRepository } from '../repositories/user.repository.js';
import { UserRow } from '../types/db.types.js';

export class AuthService {
  async authenticate(identifier: string, passwordPlain: string): Promise<UserRow> {
    const user = await userRepository.findByUsernameOrEmail(identifier);
    if (!user) {
      throw new Error('Username atau kata sandi tidak valid.');
    }

    if (user.status_akun !== 'aktif') {
      throw new Error('Akun Anda dinonaktifkan. Silakan hubungi administrator.');
    }

    // Jika pengguna migrasi lama belum pernah aktivasi kata sandi
    if (user.wajib_reset_password === 1 && !user.password_hash) {
      throw new Error('Akun Anda memerlukan aktivasi kata sandi awal pada menu /auth/activate.');
    }

    if (!user.password_hash) {
      throw new Error('Kata sandi belum disetel.');
    }

    const isMatch = await bcrypt.compare(passwordPlain, user.password_hash);
    if (!isMatch) {
      throw new Error('Username atau kata sandi tidak valid.');
    }

    return user;
  }

  async registerMember(data: {
    username: string;
    nama: string;
    email: string;
    telepon: string;
    alamat?: string;
    jenis_kelamin?: 'L' | 'P';
    password: string;
  }): Promise<UserRow> {
    const existing = await userRepository.findByUsernameOrEmail(data.username);
    if (existing) {
      throw new Error('Username sudah digunakan oleh akun lain.');
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(data.password, salt);

    const newUserId = await userRepository.createMember({
      username: data.username,
      nama: data.nama,
      email: data.email,
      telepon: data.telepon,
      alamat: data.alamat,
      jenis_kelamin: data.jenis_kelamin,
      password_hash: passwordHash,
      wajib_reset_password: 0
    });

    const user = await userRepository.findById(newUserId);
    if (!user) throw new Error('Gagal mengambil data akun yang baru dibuat.');
    return user;
  }

  async activateLegacyAccount(username: string, phoneOrEmail: string, newPassword: string): Promise<boolean> {
    const user = await userRepository.verifyLegacyAccount(username, phoneOrEmail);
    if (!user) {
      throw new Error('Verifikasi gagal: kombinasi username dan nomor telepon/email tidak cocok dengan data terdaftar.');
    }

    const salt = await bcrypt.genSalt(10);
    const newHash = await bcrypt.hash(newPassword, salt);

    return await userRepository.updatePassword(user.id, newHash);
  }
}

export const authService = new AuthService();

