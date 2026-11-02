import { Request, Response, NextFunction } from 'express';
import { ruteRepository } from '../repositories/rute.repository.js';
import { jadwalRepository } from '../repositories/jadwal.repository.js';

export class PublicController {
  async home(req: Request, res: Response, next: NextFunction) {
    try {
      const cities = await ruteRepository.getAllCities();
      const schedules = await jadwalRepository.getActiveSchedules();

      res.render('public/home', {
        title: 'Pemesanan Tiket Travel Antarkota Minibus Nyaman & Cepat',
        cities,
        schedules: schedules.slice(0, 6) // Tampilkan 6 jadwal terdekat di beranda
      });
    } catch (err) {
      next(err);
    }
  }

  async searchSchedules(req: Request, res: Response, next: NextFunction) {
    try {
      const cities = await ruteRepository.getAllCities();
      const asal = req.query.asal ? Number(req.query.asal) : undefined;
      const tujuan = req.query.tujuan ? Number(req.query.tujuan) : undefined;
      const tanggal = req.query.tanggal as string | undefined;

      const schedules = await jadwalRepository.getActiveSchedules(asal, tujuan, tanggal);

      res.render('public/jadwal-list', {
        title: 'Katalog Jadwal Travel Keberangkatan',
        cities,
        schedules,
        filter: { asal, tujuan, tanggal }
      });
    } catch (err) {
      next(err);
    }
  }
}

export const publicController = new PublicController();

