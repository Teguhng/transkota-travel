import { pool } from '../config/database.js';
import { RowDataPacket } from 'mysql2';

export class AdminService {
  async getDashboardMetrics() {
    // 1. Total revenue dari pemesanan lunas
    const [revenueRows] = await pool.query<RowDataPacket[]>(
      `SELECT COALESCE(SUM(total), 0) AS total_revenue
       FROM pemesanan
       WHERE status = 'lunas'`
    );

    // 2. Transaksi pesanan dalam 24 jam terakhir
    const [todayRows] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS today_bookings
       FROM pemesanan
       WHERE dibuat_pada >= NOW() - INTERVAL 1 DAY`
    );

    // 3. Jumlah jadwal keberangkatan aktif
    const [scheduleRows] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS active_schedules
       FROM jadwal
       WHERE status = 'dijadwalkan' AND berangkat_pada >= NOW()`
    );

    // 4. Jumlah keluhan yang belum terselesaikan
    const [complaintRows] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS pending_complaints
       FROM keluhan
       WHERE status IN ('diajukan', 'diproses')`
    );

    // 5. Rute paling diminati
    const [topRoutesRows] = await pool.query<RowDataPacket[]>(
      `SELECT 
         ka.nama AS kota_asal,
         kt.nama AS kota_tujuan,
         COUNT(p.id) AS total_booking,
         COALESCE(SUM(CASE WHEN p.status = 'lunas' THEN p.total ELSE 0 END), 0) AS total_nominal
       FROM pemesanan p
       JOIN jadwal j ON p.id_jadwal = j.id
       JOIN rute r ON j.id_rute = r.id
       JOIN kota ka ON r.id_kota_asal = ka.id
       JOIN kota kt ON r.id_kota_tujuan = kt.id
       GROUP BY r.id, ka.nama, kt.nama
       ORDER BY total_booking DESC
       LIMIT 5`
    );

    // 6. Transaksi pesanan terakhir
    const [recentRows] = await pool.query<RowDataPacket[]>(
      `SELECT 
         p.kode_booking,
         u.nama AS nama_pemesan,
         ka.nama AS kota_asal,
         kt.nama AS kota_tujuan,
         p.total AS total_harga,
         p.status
       FROM pemesanan p
       JOIN users u ON u.id = p.id_pemesan
       JOIN jadwal j ON p.id_jadwal = j.id
       JOIN rute r ON j.id_rute = r.id
       JOIN kota ka ON r.id_kota_asal = ka.id
       JOIN kota kt ON r.id_kota_tujuan = kt.id
       ORDER BY p.id DESC
       LIMIT 5`
    );

    return {
      totalRevenue: Number(revenueRows[0]?.total_revenue ?? 0),
      todayBookings: Number(todayRows[0]?.today_bookings ?? 0),
      activeSchedulesCount: Number(scheduleRows[0]?.active_schedules ?? 0),
      pendingComplaintsCount: Number(complaintRows[0]?.pending_complaints ?? 0),
      topRoutes: topRoutesRows || [],
      recentBookings: recentRows || []
    };
  }
}

export const adminService = new AdminService();
