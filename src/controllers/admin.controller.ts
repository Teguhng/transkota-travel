import { Request, Response, NextFunction } from 'express';
import { adminService } from '../services/admin.service.js';
import { ruteRepository } from '../repositories/rute.repository.js';
import { kendaraanRepository } from '../repositories/kendaraan.repository.js';
import { jadwalRepository } from '../repositories/jadwal.repository.js';
import { userRepository } from '../repositories/user.repository.js';
import { keluhanRepository } from '../repositories/keluhan.repository.js';
import { UserRole } from '../types/db.types.js';

export class AdminController {
  async dashboard(req: Request, res: Response, next: NextFunction) {
    try {
      const stats = await adminService.getDashboardMetrics();
      res.render('admin/dashboard', {
        title: 'Panel Kontrol Eksekutif & Analitik Bisnis',
        stats
      });
    } catch (err) {
      next(err);
    }
  }

  async masterData(req: Request, res: Response, next: NextFunction) {
    try {
      const tab = (req.query.tab as string) || 'jadwal';
      const cities = await ruteRepository.getAllCities();
      const routes = await ruteRepository.getAllRoutes();
      const vehicles = await kendaraanRepository.getAllVehicles();
      const schedules = await jadwalRepository.getAllSchedulesAdmin();

      res.render('admin/master-data', {
        title: 'Manajemen Data Master Sistem Travel',
        tab,
        cities,
        routes,
        vehicles,
        schedules
      });
    } catch (err) {
      next(err);
    }
  }

  async mutateMaster(req: Request, res: Response, next: NextFunction) {
    try {
      const entity = req.params.entity;

      if (entity === 'kota') {
        const { nama } = req.body;
        if (!nama) throw new Error('Nama kota wajib diisi.');
        await ruteRepository.createCity(nama.trim());
        req.flash('success', 'Kota baru berhasil ditambahkan.');
        return res.redirect('/admin/master?tab=kota');
      }

      if (entity === 'rute') {
        const { id_kota_asal, id_kota_tujuan } = req.body;
        if (id_kota_asal === id_kota_tujuan) {
          throw new Error('Kota asal dan kota tujuan tidak boleh sama.');
        }
        await ruteRepository.createRoute(Number(id_kota_asal), Number(id_kota_tujuan));
        req.flash('success', 'Rute perjalanan baru berhasil ditambahkan.');
        return res.redirect('/admin/master?tab=rute');
      }

      if (entity === 'kendaraan') {
        const { jenis, nomor_polisi, warna } = req.body;
        if (!jenis || !nomor_polisi) throw new Error('Jenis dan nomor polisi wajib diisi.');
        await kendaraanRepository.createVehicle(jenis.trim(), nomor_polisi.trim().toUpperCase(), warna?.trim() || null);
        req.flash('success', 'Armada minibus baru beserta 5 kursi aktif berhasil didaftarkan.');
        return res.redirect('/admin/master?tab=kendaraan');
      }

      if (entity === 'jadwal') {
        const { id_rute, id_kendaraan, berangkat_pada, tiba_pada, harga } = req.body;
        if (!id_rute || !id_kendaraan || !berangkat_pada || !harga) {
          throw new Error('Semua kolom jadwal wajib diisi.');
        }
        await jadwalRepository.createSchedule({
          id_rute: Number(id_rute),
          id_kendaraan: Number(id_kendaraan),
          berangkat_pada,
          tiba_pada: tiba_pada || null,
          harga: Number(harga)
        });
        req.flash('success', 'Jadwal perjalanan baru berhasil diterbitkan (kursi kabin teralokasi otomatis).');
        return res.redirect('/admin/master?tab=jadwal');
      }

      throw new Error('Entitas tidak dikenali.');
    } catch (err: any) {
      req.flash('error', err.message || 'Gagal menyimpan perubahan data master.');
      res.redirect('/admin/master');
    }
  }

  async usersAndComplaints(req: Request, res: Response, next: NextFunction) {
    try {
      const roleFilter = req.query.role as UserRole | undefined;
      const users = await userRepository.getAllUsers(roleFilter);
      const complaints = await keluhanRepository.getAllComplaints();

      res.render('admin/users-complaints', {
        title: 'Manajemen Pengguna & Pusat Evaluasi Keluhan',
        users,
        complaints,
        roleFilter
      });
    } catch (err) {
      next(err);
    }
  }

  async respondComplaint(req: Request, res: Response, next: NextFunction) {
    try {
      const admin = req.session.user!;
      const complaintId = Number(req.params.id);
      const { tanggapan, status } = req.body;

      if (!tanggapan) {
        req.flash('error', 'Tanggapan tidak boleh kosong.');
        return res.redirect('/admin/users-keluhan');
      }

      await keluhanRepository.respondToComplaint(
        complaintId,
        tanggapan.trim(),
        admin.id,
        status || 'selesai'
      );

      req.flash('success', 'Tanggapan keluhan berhasil dikirim dan status diperbarui.');
      res.redirect('/admin/users-keluhan');
    } catch (err: any) {
      req.flash('error', err.message || 'Gagal menanggapi keluhan.');
      res.redirect('/admin/users-keluhan');
    }
  }
}

export const adminController = new AdminController();

