import { pool } from '../config/database.js';
import { PembayaranRow } from '../types/db.types.js';
import { RowDataPacket } from 'mysql2';

export class PembayaranRepository {
  async submitPaymentProof(
    orderId: number,
    userId: number,
    reference: string,
    accountNumber: string,
    receiptFilename: string
  ): Promise<void> {
    await pool.query('CALL sp_ajukan_pembayaran(?, ?, ?, ?, ?)', [
      orderId,
      userId,
      reference,
      accountNumber,
      receiptFilename
    ]);
  }

  async verifyPayment(
    paymentId: number,
    operatorId: number,
    isApproved: boolean,
    rejectReason: string = ''
  ): Promise<void> {
    await pool.query('CALL sp_verifikasi_pembayaran(?, ?, ?, ?)', [
      paymentId,
      operatorId,
      isApproved ? 1 : 0,
      rejectReason
    ]);
  }

  /**
   * Transaksi ACID Pelunasan Pembayaran Tunai Loket (CUJ 3).
   * Menjamin penguncian teratur: jadwal -> pemesanan -> pembayaran / jadwal_kursi
   * dan kepatuhan CHECK constraints (ditahan_sampai = NULL saat terjual).
   */
  async processCashPayment(orderId: number, operatorUserId: number): Promise<void> {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      // 1. Kunci secara kanonikal: jadwal -> pemesanan
      await conn.query('CALL internal_kunci_pemesanan(?)', [orderId]);

      // 2. Baca data pemesanan yang telah terkunci
      const [orderRows] = await conn.query<RowDataPacket[]>(
        'SELECT id, id_jadwal, total, status FROM pemesanan WHERE id = ?',
        [orderId]
      );
      if (!orderRows.length) {
        throw new Error('Pesanan tidak ditemukan.');
      }
      const order = orderRows[0];
      if (order.status !== 'menunggu_pembayaran') {
        throw new Error(`Pesanan tidak dapat dibayar karena berstatus: ${order.status}`);
      }

      // 3. Catat pembayaran tunai langsung berstatus 'diterima'
      await conn.query(
        `INSERT INTO pembayaran 
         (id_pemesanan, metode, referensi, no_rek_pengirim, nominal, bukti_pembayaran, status, diajukan_pada, diverifikasi_oleh, diverifikasi_pada)
         VALUES (?, 'tunai', CONCAT('CASH-', UNIX_TIMESTAMP(), '-', ?), 'LOKET_OFFLINE', ?, NULL, 'diterima', NOW(), ?, NOW())`,
        [orderId, orderId, order.total, operatorUserId]
      );

      // 4. Ubah status kursi dari 'ditahan' menjadi 'terjual' (ditahan_sampai wajib NULL)
      await conn.query(
        `UPDATE jadwal_kursi jk
         JOIN detail_pemesanan dp ON dp.id_jadwal_kursi = jk.id
         SET jk.status = 'terjual', jk.ditahan_sampai = NULL
         WHERE dp.id_pemesanan = ?`,
        [orderId]
      );

      // 5. Ubah status pesanan menjadi 'lunas' (jatuh_tempo menjadi NULL)
      await conn.query(
        'UPDATE pemesanan SET status = "lunas", jatuh_tempo = NULL WHERE id = ?',
        [orderId]
      );

      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }

  async getPendingPayments(): Promise<PembayaranRow[]> {
    const sql = `
      SELECT p.*, o.kode_booking, o.total AS total_tagihan, p.nominal AS total_harga,
             p.diajukan_pada AS waktu_bayar,
             u.nama AS nama_pemesan, u.telepon AS telepon_pemesan,
             ka.nama AS kota_asal, kt.nama AS kota_tujuan
      FROM pembayaran p
      JOIN pemesanan o ON o.id = p.id_pemesanan
      JOIN users u ON u.id = o.id_pemesan
      JOIN jadwal j ON j.id = o.id_jadwal
      JOIN rute r ON r.id = j.id_rute
      JOIN kota ka ON ka.id = r.id_kota_asal
      JOIN kota kt ON kt.id = r.id_kota_tujuan
      WHERE p.status = 'menunggu'
      ORDER BY p.diajukan_pada ASC
    `;
    const [rows] = await pool.query<RowDataPacket[]>(sql);
    return rows as PembayaranRow[];
  }

  async getPaymentById(id: number): Promise<PembayaranRow | null> {
    const sql = `
      SELECT p.*, o.kode_booking, o.total AS total_tagihan, u.nama AS nama_pemesan,
             petugas.nama AS nama_petugas
      FROM pembayaran p
      JOIN pemesanan o ON o.id = p.id_pemesanan
      JOIN users u ON u.id = o.id_pemesan
      LEFT JOIN users petugas ON petugas.id = p.diverifikasi_oleh
      WHERE p.id = ?
    `;
    const [rows] = await pool.query<RowDataPacket[]>(sql, [id]);
    return (rows[0] as PembayaranRow) || null;
  }

  async getPaymentByOrderId(orderId: number): Promise<PembayaranRow | null> {
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM pembayaran WHERE id_pemesanan = ? ORDER BY id DESC LIMIT 1',
      [orderId]
    );
    return (rows[0] as PembayaranRow) || null;
  }
}

export const pembayaranRepository = new PembayaranRepository();
