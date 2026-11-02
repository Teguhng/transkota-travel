import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/auth.service.js';

export class AuthController {
  showLogin(req: Request, res: Response) {
    res.render('public/login', {
      title: 'Masuk ke Akun - Travel Antarkota',
      redirect: req.query.redirect || ''
    });
  }

  async processLogin(req: Request, res: Response, next: NextFunction) {
    try {
      const { identifier, password } = req.body;
      if (!identifier || !password) {
        req.flash('error', 'Username dan kata sandi wajib diisi.');
        return res.redirect('/login');
      }

      const user = await authService.authenticate(identifier.trim(), password);

      req.session.user = {
        id: user.id,
        username: user.username,
        nama: user.nama,
        role: user.role,
        wajib_reset_password: user.wajib_reset_password
      };

      req.flash('success', `Selamat datang kembali, ${user.nama}!`);

      if (user.wajib_reset_password === 1) {
        return res.redirect('/auth/activate');
      }

      const redirectUrl = (req.body.redirect as string) || (req.query.redirect as string);
      if (redirectUrl && redirectUrl.startsWith('/')) {
        return res.redirect(redirectUrl);
      }

      if (user.role === 'admin') return res.redirect('/admin/dashboard');
      if (user.role === 'operator') return res.redirect('/operator/dashboard');
      return res.redirect('/');
    } catch (err: any) {
      req.flash('error', err.message || 'Gagal masuk.');
      return res.redirect('/login');
    }
  }

  showRegister(req: Request, res: Response) {
    res.render('public/register', {
      title: 'Pendaftaran Member Baru - Travel Antarkota'
    });
  }

  async processRegister(req: Request, res: Response, next: NextFunction) {
    try {
      const { username, nama, email, telepon, alamat, jenis_kelamin, password, password_confirm } = req.body;

      if (!username || !nama || !email || !telepon || !password) {
        req.flash('error', 'Semua kolom bertanda bintang (*) wajib diisi.');
        return res.redirect('/register');
      }

      if (password !== password_confirm) {
        req.flash('error', 'Konfirmasi kata sandi tidak cocok.');
        return res.redirect('/register');
      }

      if (password.length < 6) {
        req.flash('error', 'Kata sandi minimal 6 karakter.');
        return res.redirect('/register');
      }

      const newUser = await authService.registerMember({
        username: username.trim(),
        nama: nama.trim(),
        email: email.trim(),
        telepon: telepon.trim(),
        alamat: alamat?.trim(),
        jenis_kelamin: jenis_kelamin as 'L' | 'P',
        password
      });

      req.session.user = {
        id: newUser.id,
        username: newUser.username,
        nama: newUser.nama,
        role: newUser.role,
        wajib_reset_password: newUser.wajib_reset_password
      };

      req.flash('success', 'Pendaftaran akun member berhasil! Selamat datang.');
      res.redirect('/');
    } catch (err: any) {
      req.flash('error', err.message || 'Pendaftaran gagal.');
      res.redirect('/register');
    }
  }

  showActivate(req: Request, res: Response) {
    res.render('public/activate', {
      title: 'Aktivasi Kata Sandi Pengguna - Travel Antarkota',
      defaultUsername: req.session?.user?.username || ''
    });
  }

  async processActivate(req: Request, res: Response, next: NextFunction) {
    try {
      const { username, phone_or_email, new_password, confirm_password } = req.body;

      if (!username || !phone_or_email || !new_password) {
        req.flash('error', 'Harap isi seluruh kolom verifikasi akun.');
        return res.redirect('/auth/activate');
      }

      if (new_password !== confirm_password) {
        req.flash('error', 'Konfirmasi kata sandi baru tidak cocok.');
        return res.redirect('/auth/activate');
      }

      if (new_password.length < 6) {
        req.flash('error', 'Kata sandi baru minimal 6 karakter.');
        return res.redirect('/auth/activate');
      }

      await authService.activateLegacyAccount(username.trim(), phone_or_email.trim(), new_password);

      // Perbarui sesi jika sedang login
      if (req.session?.user && req.session.user.username === username.trim()) {
        req.session.user.wajib_reset_password = 0;
      }

      req.flash('success', 'Aktivasi kata sandi berhasil! Anda kini dapat masuk menggunakan kata sandi baru.');
      res.redirect('/login');
    } catch (err: any) {
      req.flash('error', err.message || 'Aktivasi akun gagal.');
      res.redirect('/auth/activate');
    }
  }

  logout(req: Request, res: Response) {
    req.session.destroy(() => {
      res.redirect('/');
    });
  }
}

export const authController = new AuthController();

