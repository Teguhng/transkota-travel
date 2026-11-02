export type UserRole = 'admin' | 'operator' | 'member';
export type UserStatus = 'aktif' | 'nonaktif';
export type Gender = 'L' | 'P';
export type KendaraanStatus = 'aktif' | 'perawatan' | 'nonaktif';
export type JadwalStatus = 'dijadwalkan' | 'berangkat' | 'selesai' | 'dibatalkan';
export type PemesananStatus = 'menunggu_pembayaran' | 'menunggu_verifikasi' | 'lunas' | 'dibatalkan' | 'kedaluwarsa';
export type KursiStatus = 'tersedia' | 'ditahan' | 'terjual';
export type PembayaranMetode = 'transfer_manual' | 'gateway' | 'tunai';
export type PembayaranStatus = 'menunggu' | 'diterima' | 'ditolak' | 'dibatalkan';
export type KeluhanStatus = 'baru' | 'diproses' | 'selesai';

export interface UserRow {
  id: number;
  username: string;
  email: string | null;
  nama: string;
  telepon: string | null;
  alamat: string | null;
  jenis_kelamin: Gender | null;
  role: UserRole;
  password_hash: string | null;
  wajib_reset_password: number;
  status_akun: UserStatus;
  sumber_legacy: string | null;
  id_legacy: number | null;
  dibuat_pada: Date | null;
  diperbarui_pada: Date;
}

export interface KotaRow {
  id: number;
  nama: string;
}

export interface KendaraanRow {
  id: number;
  jenis: string;
  nomor_polisi: string;
  warna: string | null;
  status: KendaraanStatus;
}

export interface KursiKendaraanRow {
  id: number;
  id_kendaraan: number;
  nomor: string;
  urutan: number;
  aktif: number;
}

export interface RuteRow {
  id: number;
  id_kota_asal: number;
  id_kota_tujuan: number;
  aktif: number;
  // Joins
  kota_asal?: string;
  kota_tujuan?: string;
}

export interface JadwalRow {
  id: number;
  id_rute: number;
  id_kendaraan: number;
  berangkat_pada: Date;
  tiba_pada: Date | null;
  harga: string | number;
  status: JadwalStatus;
  // Joins
  kota_asal?: string;
  kota_tujuan?: string;
  id_kota_asal?: number;
  id_kota_tujuan?: number;
  nama_kendaraan?: string;
  nomor_polisi?: string;
  kursi_tersedia?: number;
}

export interface JadwalKursiRow {
  id: number;
  id_jadwal: number;
  id_kendaraan: number;
  id_kursi: number;
  status: KursiStatus;
  id_detail_pemesanan: number | null;
  ditahan_sampai: Date | null;
  // Joins
  nomor?: string;
  urutan?: number;
}

export interface PemesananRow {
  id: number;
  kode_booking: string;
  id_pemesan: number;
  id_jadwal: number;
  status: PemesananStatus;
  total: string | number;
  jatuh_tempo: Date | null;
  dibuat_pada: Date | null;
  diperbarui_pada: Date;
  alasan_pembatalan: string | null;
  status_legacy: string | null;
  // Joins
  nama_pemesan?: string;
  telepon_pemesan?: string;
  berangkat_pada?: Date;
  harga_jadwal?: string | number;
  kota_asal?: string;
  kota_tujuan?: string;
  nomor_polisi?: string;
}

export interface DetailPemesananRow {
  id: number;
  id_pemesanan: number;
  id_jadwal: number;
  id_jadwal_kursi: number;
  nama_penumpang: string | null;
  telepon_penumpang: string | null;
  harga: string | number;
  // Joins
  nomor_kursi?: string;
}

export interface PembayaranRow {
  id: number;
  id_pemesanan: number;
  metode: PembayaranMetode;
  referensi: string | null;
  no_rek_pengirim: string | null;
  nominal: string | number;
  bukti_pembayaran: string | null;
  status: PembayaranStatus;
  diajukan_pada: Date | null;
  diverifikasi_oleh: number | null;
  diverifikasi_pada: Date | null;
  alasan_penolakan: string | null;
  perlu_verifikasi_data: number;
  // Joins
  kode_booking?: string;
  nama_pemesan?: string;
  nama_petugas?: string;
}

export interface KeluhanRow {
  id: number;
  id_user: number;
  id_pemesanan: number | null;
  judul: string;
  isi: string;
  status: KeluhanStatus;
  tanggapan: string | null;
  ditangani_oleh: number | null;
  dibuat_pada: Date | null;
  diperbarui_pada: Date;
  selesai_pada: Date | null;
  // Joins
  nama_pelapor?: string;
  email_pelapor?: string;
  nama_petugas?: string;
  kode_booking?: string;
}

export interface ArsipMigrasiRow {
  id: number;
  tabel_asal: string;
  kunci_asal: string;
  alasan: string;
  data_asal: Record<string, unknown>;
  diarsipkan_pada: Date;
}

