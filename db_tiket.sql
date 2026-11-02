-- Tiket web schema v2. Target: MySQL 8.4, InnoDB.
-- Import only into a selected, empty database. This is a replacement dump,
-- not an in-place migration of a running application database.
-- DATETIME values use Asia/Jakarta. Legacy timestamps with unknown values stay NULL.
SET NAMES utf8mb4;
SET SESSION time_zone = '+07:00';
SET SESSION sql_mode = 'STRICT_TRANS_TABLES,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION';

CREATE TABLE users (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 username VARCHAR(100) NOT NULL UNIQUE,
 email VARCHAR(254) NULL UNIQUE,
 nama VARCHAR(150) NOT NULL,
 telepon VARCHAR(30) NULL,
 alamat TEXT NULL,
 jenis_kelamin ENUM('L','P') NULL,
 role ENUM('admin','operator','member') NOT NULL DEFAULT 'member',
 password_hash VARCHAR(255) NULL,
 wajib_reset_password BOOLEAN NOT NULL DEFAULT TRUE,
 status_akun ENUM('aktif','nonaktif') NOT NULL DEFAULT 'aktif',
 sumber_legacy ENUM('admin','operator_loket','member') NULL,
 id_legacy BIGINT UNSIGNED NULL,
 dibuat_pada DATETIME NULL DEFAULT CURRENT_TIMESTAMP,
 diperbarui_pada DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 UNIQUE KEY uq_users_legacy (sumber_legacy,id_legacy),
 CONSTRAINT ck_users_password CHECK (wajib_reset_password IN (0,1) AND
   (wajib_reset_password = 1 OR password_hash IS NOT NULL))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE kota (
 id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 nama VARCHAR(100) NOT NULL UNIQUE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE kendaraan (
 id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 jenis VARCHAR(100) NOT NULL,
 nomor_polisi VARCHAR(20) NOT NULL UNIQUE,
 warna VARCHAR(30) NULL,
 status ENUM('aktif','perawatan','nonaktif') NOT NULL DEFAULT 'aktif'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE kursi_kendaraan (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 id_kendaraan INT UNSIGNED NOT NULL,
 nomor VARCHAR(10) NOT NULL,
 urutan SMALLINT UNSIGNED NOT NULL,
 aktif BOOLEAN NOT NULL DEFAULT TRUE,
 UNIQUE KEY uq_kursi_nomor (id_kendaraan,nomor),
 UNIQUE KEY uq_kursi_urutan (id_kendaraan,urutan),
 UNIQUE KEY uq_kursi_kendaraan_id (id_kendaraan,id),
 FOREIGN KEY (id_kendaraan) REFERENCES kendaraan(id) ON DELETE RESTRICT,
 CHECK (urutan > 0 AND aktif IN (0,1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE rute (
 id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 id_kota_asal INT UNSIGNED NOT NULL,
 id_kota_tujuan INT UNSIGNED NOT NULL,
 aktif BOOLEAN NOT NULL DEFAULT TRUE,
 UNIQUE KEY uq_rute (id_kota_asal,id_kota_tujuan),
 FOREIGN KEY (id_kota_asal) REFERENCES kota(id) ON DELETE RESTRICT,
 FOREIGN KEY (id_kota_tujuan) REFERENCES kota(id) ON DELETE RESTRICT,
 CHECK (id_kota_asal <> id_kota_tujuan AND aktif IN (0,1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE jadwal (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 id_rute INT UNSIGNED NOT NULL,
 id_kendaraan INT UNSIGNED NOT NULL,
 berangkat_pada DATETIME NOT NULL,
 tiba_pada DATETIME NULL,
 harga DECIMAL(12,2) NOT NULL,
 status ENUM('dijadwalkan','berangkat','selesai','dibatalkan') NOT NULL DEFAULT 'dijadwalkan',
 UNIQUE KEY uq_jadwal_kendaraan (id,id_kendaraan),
 KEY ix_jadwal_cari (id_rute,status,berangkat_pada),
 KEY ix_jadwal_kendaraan_waktu (id_kendaraan,berangkat_pada),
 FOREIGN KEY (id_rute) REFERENCES rute(id) ON DELETE RESTRICT,
 FOREIGN KEY (id_kendaraan) REFERENCES kendaraan(id) ON DELETE RESTRICT,
 CHECK (harga > 0),
 CHECK (tiba_pada IS NULL OR tiba_pada > berangkat_pada)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE pemesanan (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 kode_booking VARCHAR(40) NOT NULL UNIQUE,
 id_pemesan BIGINT UNSIGNED NOT NULL,
 id_jadwal BIGINT UNSIGNED NOT NULL,
 status ENUM('menunggu_pembayaran','menunggu_verifikasi','lunas','dibatalkan','kedaluwarsa') NOT NULL,
 total DECIMAL(14,2) NOT NULL,
 jatuh_tempo DATETIME NULL,
 dibuat_pada DATETIME NULL DEFAULT CURRENT_TIMESTAMP,
 diperbarui_pada DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 alasan_pembatalan VARCHAR(255) NULL,
 status_legacy VARCHAR(100) NULL,
 UNIQUE KEY uq_pemesanan_jadwal (id,id_jadwal),
 KEY ix_pemesanan_user (id_pemesan,dibuat_pada),
 KEY ix_pemesanan_expiry (status,jatuh_tempo),
 FOREIGN KEY (id_pemesan) REFERENCES users(id) ON DELETE RESTRICT,
 FOREIGN KEY (id_jadwal) REFERENCES jadwal(id) ON DELETE RESTRICT,
 CHECK (total > 0),
 CHECK (status NOT IN ('menunggu_pembayaran','menunggu_verifikasi') OR jatuh_tempo IS NOT NULL)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE jadwal_kursi (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 id_jadwal BIGINT UNSIGNED NOT NULL,
 id_kendaraan INT UNSIGNED NOT NULL,
 id_kursi BIGINT UNSIGNED NOT NULL,
 status ENUM('tersedia','ditahan','terjual') NOT NULL DEFAULT 'tersedia',
 id_detail_pemesanan BIGINT UNSIGNED NULL,
 ditahan_sampai DATETIME NULL,
 UNIQUE KEY uq_jadwal_kursi (id_jadwal,id_kursi),
 UNIQUE KEY uq_jadwal_kursi_jadwal (id,id_jadwal),
 UNIQUE KEY uq_alokasi_detail (id_detail_pemesanan),
 KEY ix_ketersediaan (id_jadwal,status),
 FOREIGN KEY (id_jadwal,id_kendaraan) REFERENCES jadwal(id,id_kendaraan) ON DELETE RESTRICT,
 FOREIGN KEY (id_kendaraan,id_kursi) REFERENCES kursi_kendaraan(id_kendaraan,id) ON DELETE RESTRICT,
 CHECK ((status='tersedia' AND id_detail_pemesanan IS NULL AND ditahan_sampai IS NULL)
  OR (status='ditahan' AND id_detail_pemesanan IS NOT NULL AND ditahan_sampai IS NOT NULL)
  OR (status='terjual' AND id_detail_pemesanan IS NOT NULL AND ditahan_sampai IS NULL))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE detail_pemesanan (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 id_pemesanan BIGINT UNSIGNED NOT NULL,
 id_jadwal BIGINT UNSIGNED NOT NULL,
 id_jadwal_kursi BIGINT UNSIGNED NOT NULL,
 nama_penumpang VARCHAR(150) NULL,
 telepon_penumpang VARCHAR(30) NULL,
 harga DECIMAL(12,2) NOT NULL,
 UNIQUE KEY uq_detail_kursi (id_pemesanan,id_jadwal_kursi),
 UNIQUE KEY uq_detail_alokasi (id,id_jadwal_kursi),
 FOREIGN KEY (id_pemesanan,id_jadwal) REFERENCES pemesanan(id,id_jadwal) ON DELETE RESTRICT,
 FOREIGN KEY (id_jadwal_kursi,id_jadwal) REFERENCES jadwal_kursi(id,id_jadwal) ON DELETE RESTRICT,
 CHECK (harga > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- An allocation can point only to a detail row for that exact inventory seat.
ALTER TABLE jadwal_kursi ADD CONSTRAINT fk_alokasi_detail
 FOREIGN KEY (id_detail_pemesanan,id) REFERENCES detail_pemesanan(id,id_jadwal_kursi) ON DELETE RESTRICT;

CREATE TABLE pembayaran (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 id_pemesanan BIGINT UNSIGNED NOT NULL,
 metode ENUM('transfer_manual','gateway','tunai') NOT NULL,
 referensi VARCHAR(100) NULL UNIQUE,
 no_rek_pengirim VARCHAR(34) NULL,
 nominal DECIMAL(14,2) NOT NULL,
 bukti_pembayaran VARCHAR(500) NULL,
 status ENUM('menunggu','diterima','ditolak','dibatalkan') NOT NULL DEFAULT 'menunggu',
 diajukan_pada DATETIME NULL DEFAULT CURRENT_TIMESTAMP,
 diverifikasi_oleh BIGINT UNSIGNED NULL,
 diverifikasi_pada DATETIME NULL,
 alasan_penolakan VARCHAR(255) NULL,
 perlu_verifikasi_data BOOLEAN NOT NULL DEFAULT FALSE,
 -- Allow retries after rejection, but at most one pending/accepted attempt.
 pemesanan_aktif BIGINT UNSIGNED GENERATED ALWAYS AS
  (CASE WHEN status IN ('menunggu','diterima') THEN id_pemesanan ELSE NULL END) STORED,
 UNIQUE KEY uq_pembayaran_aktif (pemesanan_aktif),
 KEY ix_pembayaran_antrian (status,diajukan_pada),
 FOREIGN KEY (id_pemesanan) REFERENCES pemesanan(id) ON DELETE RESTRICT,
 FOREIGN KEY (diverifikasi_oleh) REFERENCES users(id) ON DELETE RESTRICT,
 CHECK (nominal > 0 AND perlu_verifikasi_data IN (0,1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE keluhan (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 id_user BIGINT UNSIGNED NOT NULL,
 id_pemesanan BIGINT UNSIGNED NULL,
 judul VARCHAR(150) NOT NULL,
 isi TEXT NOT NULL,
 status ENUM('baru','diproses','selesai') NOT NULL DEFAULT 'baru',
 tanggapan TEXT NULL,
 ditangani_oleh BIGINT UNSIGNED NULL,
 dibuat_pada DATETIME NULL DEFAULT CURRENT_TIMESTAMP,
 diperbarui_pada DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 selesai_pada DATETIME NULL,
 FOREIGN KEY (id_user) REFERENCES users(id) ON DELETE RESTRICT,
 FOREIGN KEY (id_pemesanan) REFERENCES pemesanan(id) ON DELETE RESTRICT,
 FOREIGN KEY (ditangani_oleh) REFERENCES users(id) ON DELETE RESTRICT,
 KEY ix_keluhan_antrian (status,dibuat_pada)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE arsip_migrasi (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 tabel_asal VARCHAR(50) NOT NULL,
 kunci_asal VARCHAR(100) NOT NULL,
 alasan VARCHAR(255) NOT NULL,
 data_asal JSON NOT NULL,
 diarsipkan_pada DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE VIEW v_kapasitas_kendaraan AS
 SELECT k.id,k.jenis,k.nomor_polisi,COUNT(CASE WHEN s.aktif=1 THEN 1 END) AS kapasitas
 FROM kendaraan k LEFT JOIN kursi_kendaraan s ON s.id_kendaraan=k.id GROUP BY k.id;

DELIMITER $$
CREATE TRIGGER trg_jadwal_buat_kursi AFTER INSERT ON jadwal FOR EACH ROW
BEGIN
 IF NOT EXISTS(SELECT 1 FROM kursi_kendaraan WHERE id_kendaraan=NEW.id_kendaraan AND aktif=1) THEN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Kendaraan belum memiliki kursi aktif';
 END IF;
 INSERT INTO jadwal_kursi(id_jadwal,id_kendaraan,id_kursi)
 SELECT NEW.id,NEW.id_kendaraan,id FROM kursi_kendaraan WHERE id_kendaraan=NEW.id_kendaraan AND aktif=1;
END$$
DELIMITER ;


-- Legacy data mapping. Unknown passwords/timestamps/passenger names are not invented.
START TRANSACTION;
INSERT INTO users (`id`,`username`,`email`,`nama`,`telepon`,`alamat`,`jenis_kelamin`,`role`,`password_hash`,`wajib_reset_password`,`sumber_legacy`,`id_legacy`,`dibuat_pada`) VALUES (1,'admin_1','test@team2travel.net','Mohammad Aziz Fikri','85766667009',NULL,NULL,'admin',NULL,1,'admin',1,NULL);
INSERT INTO users (`id`,`username`,`email`,`nama`,`telepon`,`alamat`,`jenis_kelamin`,`role`,`password_hash`,`wajib_reset_password`,`sumber_legacy`,`id_legacy`,`dibuat_pada`) VALUES (2,'admin_2','selamatriady@team2travel.net','Selamat Riady','7868698129',NULL,NULL,'admin',NULL,1,'admin',2,NULL);
INSERT INTO users (`id`,`username`,`email`,`nama`,`telepon`,`alamat`,`jenis_kelamin`,`role`,`password_hash`,`wajib_reset_password`,`sumber_legacy`,`id_legacy`,`dibuat_pada`) VALUES (3,'admin_3','ochifeb@team2travel.net','Ochi Febrianti','089876542321',NULL,NULL,'admin',NULL,1,'admin',3,NULL);
INSERT INTO users (`id`,`username`,`email`,`nama`,`telepon`,`alamat`,`jenis_kelamin`,`role`,`password_hash`,`wajib_reset_password`,`sumber_legacy`,`id_legacy`,`dibuat_pada`) VALUES (4,'admin_4','lubna@team2travel.net','Lubna Abidah','0980970709',NULL,NULL,'admin',NULL,1,'admin',4,NULL);
INSERT INTO users (`id`,`username`,`email`,`nama`,`telepon`,`alamat`,`jenis_kelamin`,`role`,`password_hash`,`wajib_reset_password`,`sumber_legacy`,`id_legacy`,`dibuat_pada`) VALUES (5,'admin_5','test@localhost','Test Aja','75689709',NULL,NULL,'admin',NULL,1,'admin',5,NULL);
INSERT INTO users (`id`,`username`,`email`,`nama`,`telepon`,`alamat`,`jenis_kelamin`,`role`,`password_hash`,`wajib_reset_password`,`sumber_legacy`,`id_legacy`,`dibuat_pada`) VALUES (6,'operator_1','operatortiket@localhost','Loket',NULL,NULL,NULL,'operator',NULL,1,'operator_loket',1,NULL);
INSERT INTO users (`id`,`username`,`email`,`nama`,`telepon`,`alamat`,`jenis_kelamin`,`role`,`password_hash`,`wajib_reset_password`,`sumber_legacy`,`id_legacy`,`dibuat_pada`) VALUES (7,'aziz','aziz@localhost','aziz','085745509897','Rajabasa','L','member',NULL,1,'member',1,NULL);
INSERT INTO users (`id`,`username`,`email`,`nama`,`telepon`,`alamat`,`jenis_kelamin`,`role`,`password_hash`,`wajib_reset_password`,`sumber_legacy`,`id_legacy`,`dibuat_pada`) VALUES (8,'selamat','selamat@localhost','selamat','13254565','Samping Poltek','L','member',NULL,1,'member',2,NULL);
INSERT INTO users (`id`,`username`,`email`,`nama`,`telepon`,`alamat`,`jenis_kelamin`,`role`,`password_hash`,`wajib_reset_password`,`sumber_legacy`,`id_legacy`,`dibuat_pada`) VALUES (9,'ochi','ochi@localhost','ochi','4343','bandar lampung','P','member',NULL,1,'member',3,NULL);
INSERT INTO users (`id`,`username`,`email`,`nama`,`telepon`,`alamat`,`jenis_kelamin`,`role`,`password_hash`,`wajib_reset_password`,`sumber_legacy`,`id_legacy`,`dibuat_pada`) VALUES (10,'Lubna','lubna@localhost','Lubna','085768039510','liwa','P','member',NULL,1,'member',4,NULL);
INSERT INTO users (`id`,`username`,`email`,`nama`,`telepon`,`alamat`,`jenis_kelamin`,`role`,`password_hash`,`wajib_reset_password`,`sumber_legacy`,`id_legacy`,`dibuat_pada`) VALUES (11,'aqinnn','aqin@localhost','aqinnn','08977849549','bataranila','L','member',NULL,1,'member',20,NULL);
INSERT INTO users (`id`,`username`,`email`,`nama`,`telepon`,`alamat`,`jenis_kelamin`,`role`,`password_hash`,`wajib_reset_password`,`sumber_legacy`,`id_legacy`,`dibuat_pada`) VALUES (12,'Shinta Anisa','shinta12@gmail.com','Shinta Anisa','085647354611','Rajabasa','P','member',NULL,1,'member',22,NULL);
INSERT INTO users (`id`,`username`,`email`,`nama`,`telepon`,`alamat`,`jenis_kelamin`,`role`,`password_hash`,`wajib_reset_password`,`sumber_legacy`,`id_legacy`,`dibuat_pada`) VALUES (13,'doni','doni@localhost','doni','08566747488','Way Halim','L','member',NULL,1,'member',25,NULL);
INSERT INTO kota (`id`,`nama`) VALUES (1,'Bandar Lampung');
INSERT INTO kota (`id`,`nama`) VALUES (2,'Metro');
INSERT INTO kota (`id`,`nama`) VALUES (3,'Lampung Tengah');
INSERT INTO kota (`id`,`nama`) VALUES (4,'Lampung Timur');
INSERT INTO kota (`id`,`nama`) VALUES (5,'Lampung Selatan');
INSERT INTO kota (`id`,`nama`) VALUES (6,'Tanggamus');
INSERT INTO kota (`id`,`nama`) VALUES (7,'Pringsewu');
INSERT INTO kota (`id`,`nama`) VALUES (8,'Pesawaran');
INSERT INTO kota (`id`,`nama`) VALUES (9,'Lampung Barat');
INSERT INTO kota (`id`,`nama`) VALUES (10,'Lampung Utara');
INSERT INTO kota (`id`,`nama`) VALUES (11,'Mesuji');
INSERT INTO kota (`id`,`nama`) VALUES (12,'Tulang Bawang');
INSERT INTO kota (`id`,`nama`) VALUES (13,'Tulang Bawang Barat');
INSERT INTO kota (`id`,`nama`) VALUES (14,'Way Kanan');
INSERT INTO kota (`id`,`nama`) VALUES (15,'Gunung Sugih');
INSERT INTO kota (`id`,`nama`) VALUES (16,'Kotabumi');
INSERT INTO kota (`id`,`nama`) VALUES (17,'Kalianda');
INSERT INTO kota (`id`,`nama`) VALUES (18,'Liwa');
INSERT INTO kota (`id`,`nama`) VALUES (19,'Sukadana');
INSERT INTO kota (`id`,`nama`) VALUES (20,'Wiralaga Mulya');
INSERT INTO kota (`id`,`nama`) VALUES (21,'Gedong Tataan');
INSERT INTO kota (`id`,`nama`) VALUES (22,'Krui');
INSERT INTO arsip_migrasi (`tabel_asal`,`kunci_asal`,`alasan`,`data_asal`) VALUES ('kota_asal','24','Nama kota duplikat; dipetakan ke kota yang sama','{"id_kota_asal": 24, "nm_kota_asal": "Pringsewu"}');
INSERT INTO kota (`id`,`nama`) VALUES (23,'Menggala');
INSERT INTO kota (`id`,`nama`) VALUES (24,'Tulang Bawang Tengah');
INSERT INTO kota (`id`,`nama`) VALUES (25,'Kota Agung');
INSERT INTO kota (`id`,`nama`) VALUES (26,'Blambangan Umpu');
INSERT INTO kota (`id`,`nama`) VALUES (27,'Tanjung Karang');
INSERT INTO kendaraan (`id`,`jenis`,`nomor_polisi`,`warna`) VALUES (1,'Toyota Avanza','BE 1212 AT','Hitam');
INSERT INTO kursi_kendaraan (`id`,`id_kendaraan`,`nomor`,`urutan`) VALUES (1,1,'1',1);
INSERT INTO kursi_kendaraan (`id`,`id_kendaraan`,`nomor`,`urutan`) VALUES (2,1,'2',2);
INSERT INTO kursi_kendaraan (`id`,`id_kendaraan`,`nomor`,`urutan`) VALUES (3,1,'3',3);
INSERT INTO kursi_kendaraan (`id`,`id_kendaraan`,`nomor`,`urutan`) VALUES (4,1,'4',4);
INSERT INTO kursi_kendaraan (`id`,`id_kendaraan`,`nomor`,`urutan`) VALUES (5,1,'5',5);
INSERT INTO kendaraan (`id`,`jenis`,`nomor_polisi`,`warna`) VALUES (2,'Daihatsu Xenia','BE 4677 DT','Biru');
INSERT INTO kursi_kendaraan (`id`,`id_kendaraan`,`nomor`,`urutan`) VALUES (6,2,'1',1);
INSERT INTO kursi_kendaraan (`id`,`id_kendaraan`,`nomor`,`urutan`) VALUES (7,2,'2',2);
INSERT INTO kursi_kendaraan (`id`,`id_kendaraan`,`nomor`,`urutan`) VALUES (8,2,'3',3);
INSERT INTO kursi_kendaraan (`id`,`id_kendaraan`,`nomor`,`urutan`) VALUES (9,2,'4',4);
INSERT INTO kursi_kendaraan (`id`,`id_kendaraan`,`nomor`,`urutan`) VALUES (10,2,'5',5);
INSERT INTO rute (`id`,`id_kota_asal`,`id_kota_tujuan`) VALUES (1,1,2);
INSERT INTO jadwal (`id`,`id_rute`,`id_kendaraan`,`berangkat_pada`,`tiba_pada`,`harga`,`status`) VALUES (1,1,2,'2017-01-07 08:21:00',NULL,60000,'selesai');
INSERT INTO rute (`id`,`id_kota_asal`,`id_kota_tujuan`) VALUES (2,1,3);
INSERT INTO jadwal (`id`,`id_rute`,`id_kendaraan`,`berangkat_pada`,`tiba_pada`,`harga`,`status`) VALUES (2,2,1,'2017-01-15 06:31:00',NULL,50000,'selesai');
INSERT INTO rute (`id`,`id_kota_asal`,`id_kota_tujuan`) VALUES (3,1,9);
INSERT INTO jadwal (`id`,`id_rute`,`id_kendaraan`,`berangkat_pada`,`tiba_pada`,`harga`,`status`) VALUES (3,3,1,'2017-01-16 08:00:00',NULL,70000,'selesai');
INSERT INTO rute (`id`,`id_kota_asal`,`id_kota_tujuan`) VALUES (4,1,5);
INSERT INTO jadwal (`id`,`id_rute`,`id_kendaraan`,`berangkat_pada`,`tiba_pada`,`harga`,`status`) VALUES (4,4,2,'2017-01-17 01:01:00',NULL,40000,'selesai');
INSERT INTO rute (`id`,`id_kota_asal`,`id_kota_tujuan`) VALUES (5,1,7);
INSERT INTO jadwal (`id`,`id_rute`,`id_kendaraan`,`berangkat_pada`,`tiba_pada`,`harga`,`status`) VALUES (5,5,1,'2017-01-06 02:01:00',NULL,50000,'selesai');
INSERT INTO rute (`id`,`id_kota_asal`,`id_kota_tujuan`) VALUES (6,1,6);
INSERT INTO jadwal (`id`,`id_rute`,`id_kendaraan`,`berangkat_pada`,`tiba_pada`,`harga`,`status`) VALUES (6,6,2,'2017-01-31 10:00:00',NULL,80000,'selesai');
INSERT INTO pemesanan (`id`,`kode_booking`,`id_pemesan`,`id_jadwal`,`status`,`total`,`jatuh_tempo`,`dibuat_pada`,`status_legacy`) VALUES (4,'LEGACY-4',10,1,'lunas',60000,NULL,NULL,'Lunas');
INSERT INTO detail_pemesanan(id,id_pemesanan,id_jadwal,id_jadwal_kursi,nama_penumpang,harga) SELECT 4,4,1,id,NULL,60000 FROM jadwal_kursi WHERE id_jadwal=1 AND id_kursi=8;
UPDATE jadwal_kursi s JOIN detail_pemesanan d ON d.id_jadwal_kursi=s.id SET s.status='terjual',s.id_detail_pemesanan=d.id WHERE d.id=4;
INSERT INTO pemesanan (`id`,`kode_booking`,`id_pemesan`,`id_jadwal`,`status`,`total`,`jatuh_tempo`,`dibuat_pada`,`status_legacy`) VALUES (106,'LEGACY-106',9,1,'kedaluwarsa',60000,NULL,NULL,'Dalam Proses');
INSERT INTO detail_pemesanan(id,id_pemesanan,id_jadwal,id_jadwal_kursi,nama_penumpang,harga) SELECT 106,106,1,id,NULL,60000 FROM jadwal_kursi WHERE id_jadwal=1 AND id_kursi=6;
INSERT INTO arsip_migrasi (`tabel_asal`,`kunci_asal`,`alasan`,`data_asal`) VALUES ('pesan','106','Jadwal tahun 2017 telah berlalu; booking belum lunas menjadi kedaluwarsa','{"id_pesan": 106, "nomor_kursi": "1", "status": "Dalam Proses", "id_jadwal": 1, "id_member": 3}');
INSERT INTO pemesanan (`id`,`kode_booking`,`id_pemesan`,`id_jadwal`,`status`,`total`,`jatuh_tempo`,`dibuat_pada`,`status_legacy`) VALUES (108,'LEGACY-108',7,2,'lunas',50000,NULL,NULL,'Lunas');
INSERT INTO detail_pemesanan(id,id_pemesanan,id_jadwal,id_jadwal_kursi,nama_penumpang,harga) SELECT 108,108,2,id,NULL,50000 FROM jadwal_kursi WHERE id_jadwal=2 AND id_kursi=5;
UPDATE jadwal_kursi s JOIN detail_pemesanan d ON d.id_jadwal_kursi=s.id SET s.status='terjual',s.id_detail_pemesanan=d.id WHERE d.id=108;
INSERT INTO arsip_migrasi (`tabel_asal`,`kunci_asal`,`alasan`,`data_asal`) VALUES ('pesan','109','Member induk tidak tersedia; pemesanan tidak diaktifkan','{"id_pesan": 109, "nomor_kursi": "2", "status": "Lunas", "id_jadwal": 1, "id_member": 17}');
INSERT INTO pemesanan (`id`,`kode_booking`,`id_pemesan`,`id_jadwal`,`status`,`total`,`jatuh_tempo`,`dibuat_pada`,`status_legacy`) VALUES (115,'LEGACY-115',11,2,'lunas',50000,NULL,NULL,'Lunas');
INSERT INTO detail_pemesanan(id,id_pemesanan,id_jadwal,id_jadwal_kursi,nama_penumpang,harga) SELECT 115,115,2,id,NULL,50000 FROM jadwal_kursi WHERE id_jadwal=2 AND id_kursi=4;
UPDATE jadwal_kursi s JOIN detail_pemesanan d ON d.id_jadwal_kursi=s.id SET s.status='terjual',s.id_detail_pemesanan=d.id WHERE d.id=115;
INSERT INTO pemesanan (`id`,`kode_booking`,`id_pemesan`,`id_jadwal`,`status`,`total`,`jatuh_tempo`,`dibuat_pada`,`status_legacy`) VALUES (116,'LEGACY-116',12,2,'kedaluwarsa',50000,NULL,NULL,'Dalam Proses');
INSERT INTO detail_pemesanan(id,id_pemesanan,id_jadwal,id_jadwal_kursi,nama_penumpang,harga) SELECT 116,116,2,id,NULL,50000 FROM jadwal_kursi WHERE id_jadwal=2 AND id_kursi=3;
INSERT INTO arsip_migrasi (`tabel_asal`,`kunci_asal`,`alasan`,`data_asal`) VALUES ('pesan','116','Jadwal tahun 2017 telah berlalu; booking belum lunas menjadi kedaluwarsa','{"id_pesan": 116, "nomor_kursi": "3", "status": "Dalam Proses", "id_jadwal": 2, "id_member": 22}');
INSERT INTO pemesanan (`id`,`kode_booking`,`id_pemesan`,`id_jadwal`,`status`,`total`,`jatuh_tempo`,`dibuat_pada`,`status_legacy`) VALUES (117,'LEGACY-117',10,3,'lunas',70000,NULL,NULL,'Lunas');
INSERT INTO detail_pemesanan(id,id_pemesanan,id_jadwal,id_jadwal_kursi,nama_penumpang,harga) SELECT 117,117,3,id,NULL,70000 FROM jadwal_kursi WHERE id_jadwal=3 AND id_kursi=3;
UPDATE jadwal_kursi s JOIN detail_pemesanan d ON d.id_jadwal_kursi=s.id SET s.status='terjual',s.id_detail_pemesanan=d.id WHERE d.id=117;
INSERT INTO pemesanan (`id`,`kode_booking`,`id_pemesan`,`id_jadwal`,`status`,`total`,`jatuh_tempo`,`dibuat_pada`,`status_legacy`) VALUES (118,'LEGACY-118',13,3,'kedaluwarsa',70000,NULL,NULL,'Belum Bayar');
INSERT INTO detail_pemesanan(id,id_pemesanan,id_jadwal,id_jadwal_kursi,nama_penumpang,harga) SELECT 118,118,3,id,NULL,70000 FROM jadwal_kursi WHERE id_jadwal=3 AND id_kursi=4;
INSERT INTO arsip_migrasi (`tabel_asal`,`kunci_asal`,`alasan`,`data_asal`) VALUES ('pesan','118','Jadwal tahun 2017 telah berlalu; booking belum lunas menjadi kedaluwarsa','{"id_pesan": 118, "nomor_kursi": "4", "status": "Belum Bayar", "id_jadwal": 3, "id_member": 25}');
INSERT INTO pembayaran (`id_pemesanan`,`metode`,`referensi`,`no_rek_pengirim`,`nominal`,`status`,`diajukan_pada`,`perlu_verifikasi_data`) VALUES (115,'transfer_manual','041422680263',NULL,50000,'diterima','2017-01-06 17:38:00',1);
INSERT INTO arsip_migrasi (`tabel_asal`,`kunci_asal`,`alasan`,`data_asal`) VALUES ('konfirmasi_pesan','041422680263','Nominal dibentuk dari harga jadwal karena dump tidak mencatat nominal transfer; data pembayaran perlu verifikasi; nomor rekening sumber tidak dapat dipercaya','{"no_resi": "041422680263", "no_rek": 0, "tgl_transfer": "2017-01-06", "jam_transfer": "17:38:00", "id_pesan": 115}');
INSERT INTO pembayaran (`id_pemesanan`,`metode`,`referensi`,`no_rek_pengirim`,`nominal`,`status`,`diajukan_pada`,`perlu_verifikasi_data`) VALUES (108,'transfer_manual','2147483647',NULL,50000,'diterima','2017-01-04 13:40:00',1);
INSERT INTO arsip_migrasi (`tabel_asal`,`kunci_asal`,`alasan`,`data_asal`) VALUES ('konfirmasi_pesan','2147483647','Nominal dibentuk dari harga jadwal karena dump tidak mencatat nominal transfer; data pembayaran perlu verifikasi; nomor rekening sumber tidak dapat dipercaya','{"no_resi": "2147483647", "no_rek": 2147483647, "tgl_transfer": "2017-01-04", "jam_transfer": "13:40:00", "id_pesan": 108}');
INSERT INTO arsip_migrasi (`tabel_asal`,`kunci_asal`,`alasan`,`data_asal`) VALUES ('konfirmasi_pesan','35666777','Pemesanan tidak ada atau dikarantina','{"no_resi": "35666777", "no_rek": 234556677, "tgl_transfer": "2017-01-02", "jam_transfer": "04:02:00", "id_pesan": 107}');
INSERT INTO pembayaran (`id_pemesanan`,`metode`,`referensi`,`no_rek_pengirim`,`nominal`,`status`,`diajukan_pada`,`perlu_verifikasi_data`) VALUES (117,'transfer_manual','4344546687768',NULL,70000,'diterima','2017-04-13 01:02:00',1);
INSERT INTO arsip_migrasi (`tabel_asal`,`kunci_asal`,`alasan`,`data_asal`) VALUES ('konfirmasi_pesan','4344546687768','Nominal dibentuk dari harga jadwal karena dump tidak mencatat nominal transfer; data pembayaran perlu verifikasi; nomor rekening sumber tidak dapat dipercaya','{"no_resi": "4344546687768", "no_rek": 0, "tgl_transfer": "2017-04-13", "jam_transfer": "01:02:00", "id_pesan": 117}');
INSERT INTO arsip_migrasi (`tabel_asal`,`kunci_asal`,`alasan`,`data_asal`) VALUES ('konfirmasi_pesan','4344546687768','Tanggal transfer sesudah tanggal keberangkatan; perlu pemeriksaan','{"no_resi": "4344546687768", "no_rek": 0, "tgl_transfer": "2017-04-13", "jam_transfer": "01:02:00", "id_pesan": 117}');
INSERT INTO pembayaran (`id_pemesanan`,`metode`,`referensi`,`no_rek_pengirim`,`nominal`,`status`,`diajukan_pada`,`perlu_verifikasi_data`) VALUES (4,'transfer_manual','532334545',NULL,60000,'diterima','2017-01-01 20:25:00',1);
INSERT INTO arsip_migrasi (`tabel_asal`,`kunci_asal`,`alasan`,`data_asal`) VALUES ('konfirmasi_pesan','532334545','Nominal dibentuk dari harga jadwal karena dump tidak mencatat nominal transfer; data pembayaran perlu verifikasi; nomor rekening sumber tidak dapat dipercaya','{"no_resi": "532334545", "no_rek": 2147483647, "tgl_transfer": "2017-01-01", "jam_transfer": "20:25:00", "id_pesan": 4}');
INSERT INTO pembayaran (`id_pemesanan`,`metode`,`referensi`,`no_rek_pengirim`,`nominal`,`status`,`diajukan_pada`,`perlu_verifikasi_data`) VALUES (106,'transfer_manual','675485944','757484859',60000,'dibatalkan','2017-01-02 09:04:00',1);
INSERT INTO arsip_migrasi (`tabel_asal`,`kunci_asal`,`alasan`,`data_asal`) VALUES ('konfirmasi_pesan','675485944','Nominal dibentuk dari harga jadwal karena dump tidak mencatat nominal transfer; data pembayaran perlu verifikasi','{"no_resi": "675485944", "no_rek": 757484859, "tgl_transfer": "2017-01-02", "jam_transfer": "09:04:00", "id_pesan": 106}');
INSERT INTO arsip_migrasi (`tabel_asal`,`kunci_asal`,`alasan`,`data_asal`) VALUES ('konfirmasi_pesan','7487384','Pemesanan tidak ada atau dikarantina','{"no_resi": "7487384", "no_rek": 7457585, "tgl_transfer": "2017-01-02", "jam_transfer": "03:03:00", "id_pesan": 109}');
INSERT INTO pembayaran (`id_pemesanan`,`metode`,`referensi`,`no_rek_pengirim`,`nominal`,`status`,`diajukan_pada`,`perlu_verifikasi_data`) VALUES (116,'transfer_manual','769785858555555',NULL,50000,'dibatalkan','2017-01-09 11:00:00',1);
INSERT INTO arsip_migrasi (`tabel_asal`,`kunci_asal`,`alasan`,`data_asal`) VALUES ('konfirmasi_pesan','769785858555555','Nominal dibentuk dari harga jadwal karena dump tidak mencatat nominal transfer; data pembayaran perlu verifikasi; nomor rekening sumber tidak dapat dipercaya','{"no_resi": "769785858555555", "no_rek": 0, "tgl_transfer": "2017-01-09", "jam_transfer": "11:00:00", "id_pesan": 116}');
INSERT INTO keluhan (`id`,`id_user`,`judul`,`isi`,`dibuat_pada`) VALUES (9,10,'akun saya','diblokir loh',NULL);
INSERT INTO keluhan (`id`,`id_user`,`judul`,`isi`,`dibuat_pada`) VALUES (10,13,'akun saya','diblokir loh',NULL);
COMMIT;
-- Public procedures own their transactions. Call outside any existing transaction.
-- Lock order is always jadwal -> pemesanan -> pembayaran / jadwal_kursi.
DELIMITER $$

-- Internal helper: caller must already own a transaction.
CREATE PROCEDURE internal_kunci_pemesanan(IN p_id BIGINT UNSIGNED)
BEGIN
 DECLARE v_jadwal BIGINT UNSIGNED DEFAULT NULL;
 DECLARE v_lock BIGINT UNSIGNED;
 SELECT id_jadwal INTO v_jadwal FROM pemesanan WHERE id=p_id;
 IF v_jadwal IS NULL THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Pemesanan tidak ditemukan'; END IF;
 SELECT id INTO v_lock FROM jadwal WHERE id=v_jadwal FOR UPDATE;
 SELECT id INTO v_lock FROM pemesanan WHERE id=p_id FOR UPDATE;
END$$

-- Internal helper: caller holds the schedule row lock.
CREATE PROCEDURE internal_kedaluwarsa_jadwal(IN p_jadwal BIGINT UNSIGNED)
BEGIN
 UPDATE jadwal_kursi s JOIN detail_pemesanan d ON d.id=s.id_detail_pemesanan
 JOIN pemesanan p ON p.id=d.id_pemesanan
 SET s.status='tersedia',s.id_detail_pemesanan=NULL,s.ditahan_sampai=NULL
 WHERE p.id_jadwal=p_jadwal AND p.status IN ('menunggu_pembayaran','menunggu_verifikasi')
 AND p.jatuh_tempo<=NOW();
 UPDATE pembayaran b JOIN pemesanan p ON p.id=b.id_pemesanan
 SET b.status='dibatalkan' WHERE p.id_jadwal=p_jadwal AND b.status='menunggu'
 AND p.status IN ('menunggu_pembayaran','menunggu_verifikasi') AND p.jatuh_tempo<=NOW();
 UPDATE pemesanan SET status='kedaluwarsa'
 WHERE id_jadwal=p_jadwal AND status IN ('menunggu_pembayaran','menunggu_verifikasi') AND jatuh_tempo<=NOW();
END$$

CREATE PROCEDURE sp_kedaluwarsa_jadwal(IN p_jadwal BIGINT UNSIGNED)
BEGIN
 DECLARE v_lock BIGINT UNSIGNED;
 DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN ROLLBACK; RESIGNAL; END;
 SET TRANSACTION ISOLATION LEVEL READ COMMITTED;
 START TRANSACTION;
 SELECT id INTO v_lock FROM jadwal WHERE id=p_jadwal FOR UPDATE;
 CALL internal_kedaluwarsa_jadwal(p_jadwal);
 COMMIT;
END$$

-- Input array: [{"id_jadwal_kursi":123,"nama":"Nama penumpang","telepon":"08..."}].
-- Booking code and price are server generated. A booking covers one schedule.
CREATE PROCEDURE sp_buat_pemesanan(IN p_user BIGINT UNSIGNED, IN p_jadwal BIGINT UNSIGNED, IN p_penumpang JSON)
BEGIN
 DECLARE v_harga DECIMAL(12,2);
 DECLARE v_berangkat DATETIME;
 DECLARE v_status VARCHAR(30);
 DECLARE v_jumlah INT;
 DECLARE v_valid INT;
 DECLARE v_order BIGINT UNSIGNED;
 DECLARE v_kode VARCHAR(40);
 DECLARE v_deadline DATETIME;
 DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN ROLLBACK; RESIGNAL; END;
 IF p_penumpang IS NULL OR JSON_TYPE(p_penumpang)<>'ARRAY' OR JSON_LENGTH(p_penumpang) NOT BETWEEN 1 AND 10 THEN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Penumpang harus berupa array berisi 1 sampai 10 orang';
 END IF;
 SET v_jumlah=JSON_LENGTH(p_penumpang);
 SELECT COUNT(DISTINCT t.seat) INTO v_valid
 FROM JSON_TABLE(p_penumpang,'$[*]' COLUMNS(
  seat BIGINT PATH '$.id_jadwal_kursi' ERROR ON EMPTY ERROR ON ERROR,
  nama VARCHAR(150) PATH '$.nama' ERROR ON EMPTY ERROR ON ERROR)) t
 WHERE t.seat>0 AND CHAR_LENGTH(TRIM(t.nama))>0;
 IF v_valid<>v_jumlah THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Kursi duplikat atau data penumpang tidak lengkap'; END IF;
 SET TRANSACTION ISOLATION LEVEL READ COMMITTED;
 START TRANSACTION;
 IF NOT EXISTS(SELECT 1 FROM users WHERE id=p_user AND role='member' AND status_akun='aktif') THEN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Akun pemesan tidak valid';
 END IF;
 SET v_status=NULL;
 SELECT harga,berangkat_pada,status INTO v_harga,v_berangkat,v_status FROM jadwal WHERE id=p_jadwal FOR UPDATE;
 IF v_status IS NULL OR v_status<>'dijadwalkan' OR v_berangkat<=NOW() THEN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Jadwal tidak tersedia untuk pemesanan';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM jadwal j JOIN kendaraan k ON k.id=j.id_kendaraan
 JOIN rute r ON r.id=j.id_rute WHERE j.id=p_jadwal AND k.status='aktif' AND r.aktif=1) THEN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Rute atau kendaraan tidak aktif';
 END IF;
 CALL internal_kedaluwarsa_jadwal(p_jadwal);
 SELECT COUNT(*) INTO v_valid FROM jadwal_kursi s
 JOIN JSON_TABLE(p_penumpang,'$[*]' COLUMNS(seat BIGINT PATH '$.id_jadwal_kursi')) t ON t.seat=s.id
 JOIN kursi_kendaraan k ON k.id=s.id_kursi
 WHERE s.id_jadwal=p_jadwal AND s.status='tersedia' AND k.aktif=1;
 IF v_valid<>v_jumlah THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Salah satu kursi sudah diambil atau bukan milik jadwal ini'; END IF;
 SET v_kode=CONCAT('TKT-',REPLACE(UUID(),'-',''));
 SET v_deadline=LEAST(DATE_ADD(NOW(),INTERVAL 15 MINUTE),v_berangkat);
 INSERT INTO pemesanan(kode_booking,id_pemesan,id_jadwal,status,total,jatuh_tempo)
 VALUES(v_kode,p_user,p_jadwal,'menunggu_pembayaran',v_harga*v_jumlah,v_deadline);
 SET v_order=LAST_INSERT_ID();
 INSERT INTO detail_pemesanan(id_pemesanan,id_jadwal,id_jadwal_kursi,nama_penumpang,telepon_penumpang,harga)
 SELECT v_order,p_jadwal,t.seat,TRIM(t.nama),t.telepon,v_harga
 FROM JSON_TABLE(p_penumpang,'$[*]' COLUMNS(seat BIGINT PATH '$.id_jadwal_kursi',
 nama VARCHAR(150) PATH '$.nama',telepon VARCHAR(30) PATH '$.telepon' NULL ON EMPTY)) t;
 UPDATE jadwal_kursi s JOIN detail_pemesanan d ON d.id_jadwal_kursi=s.id
 SET s.status='ditahan',s.id_detail_pemesanan=d.id,s.ditahan_sampai=v_deadline WHERE d.id_pemesanan=v_order;
 COMMIT;
 SELECT v_order AS id_pemesanan,v_kode AS kode_booking,v_harga*v_jumlah AS total,v_deadline AS jatuh_tempo;
END$$

-- Manual transfer submission. Cash/gateway integrations need separate verified flows.
CREATE PROCEDURE sp_ajukan_pembayaran(IN p_order BIGINT UNSIGNED,IN p_user BIGINT UNSIGNED,
 IN p_referensi VARCHAR(100),IN p_rekening VARCHAR(34),IN p_bukti VARCHAR(500))
BEGIN
 DECLARE v_deadline DATETIME;
 DECLARE v_payment BIGINT UNSIGNED;
 DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN ROLLBACK; RESIGNAL; END;
 IF p_referensi IS NULL OR TRIM(p_referensi)='' OR p_rekening IS NULL OR TRIM(p_rekening)=''
 OR p_bukti IS NULL OR TRIM(p_bukti)='' THEN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Referensi, rekening, dan bukti pembayaran wajib diisi';
 END IF;
 SET TRANSACTION ISOLATION LEVEL READ COMMITTED;
 START TRANSACTION;
 CALL internal_kunci_pemesanan(p_order);
 IF NOT EXISTS(SELECT 1 FROM pemesanan WHERE id=p_order AND id_pemesan=p_user
 AND status='menunggu_pembayaran' AND jatuh_tempo>NOW()) THEN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Pemesanan tidak dapat dibayar oleh pengguna ini';
 END IF;
 SELECT LEAST(DATE_ADD(NOW(),INTERVAL 24 HOUR),j.berangkat_pada) INTO v_deadline
 FROM pemesanan p JOIN jadwal j ON j.id=p.id_jadwal WHERE p.id=p_order;
 INSERT INTO pembayaran(id_pemesanan,metode,referensi,no_rek_pengirim,nominal,bukti_pembayaran)
 SELECT id,'transfer_manual',TRIM(p_referensi),TRIM(p_rekening),total,p_bukti FROM pemesanan WHERE id=p_order;
 SET v_payment=LAST_INSERT_ID();
 UPDATE pemesanan SET status='menunggu_verifikasi',jatuh_tempo=v_deadline WHERE id=p_order;
 UPDATE jadwal_kursi s JOIN detail_pemesanan d ON d.id=s.id_detail_pemesanan
 SET s.ditahan_sampai=v_deadline WHERE d.id_pemesanan=p_order AND s.status='ditahan';
 COMMIT;
 SELECT v_payment AS id_pembayaran,v_deadline AS batas_verifikasi;
END$$

CREATE PROCEDURE sp_verifikasi_pembayaran(IN p_payment BIGINT UNSIGNED,IN p_petugas BIGINT UNSIGNED,
 IN p_terima BOOLEAN,IN p_alasan VARCHAR(255))
BEGIN
 DECLARE v_order BIGINT UNSIGNED DEFAULT NULL;
 DECLARE v_status VARCHAR(30);
 DECLARE v_total DECIMAL(14,2);
 DECLARE v_nominal DECIMAL(14,2);
 DECLARE v_lock BIGINT UNSIGNED;
 DECLARE v_deadline DATETIME;
 DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN ROLLBACK; RESIGNAL; END;
 IF p_terima IS NULL OR p_terima NOT IN (0,1) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Keputusan verifikasi tidak valid'; END IF;
 SET TRANSACTION ISOLATION LEVEL READ COMMITTED;
 START TRANSACTION;
 IF NOT EXISTS(SELECT 1 FROM users WHERE id=p_petugas AND role IN ('admin','operator') AND status_akun='aktif') THEN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Petugas tidak berwenang';
 END IF;
 SELECT id_pemesanan INTO v_order FROM pembayaran WHERE id=p_payment;
 CALL internal_kunci_pemesanan(v_order);
 SELECT status,nominal INTO v_status,v_nominal FROM pembayaran WHERE id=p_payment FOR UPDATE;
 IF v_status<>'menunggu' OR NOT EXISTS(SELECT 1 FROM pemesanan WHERE id=v_order
 AND status='menunggu_verifikasi' AND jatuh_tempo>NOW()) THEN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Pembayaran sudah diproses atau pemesanan kedaluwarsa';
 END IF;
 SELECT total INTO v_total FROM pemesanan WHERE id=v_order;
 IF p_terima=1 THEN
  IF v_nominal<>v_total THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Nominal tidak sesuai total'; END IF;
  UPDATE pembayaran SET status='diterima',diverifikasi_oleh=p_petugas,diverifikasi_pada=NOW() WHERE id=p_payment;
  UPDATE jadwal_kursi s JOIN detail_pemesanan d ON d.id=s.id_detail_pemesanan
  SET s.status='terjual',s.ditahan_sampai=NULL WHERE d.id_pemesanan=v_order AND s.status='ditahan';
  IF ROW_COUNT()<>(SELECT COUNT(*) FROM detail_pemesanan WHERE id_pemesanan=v_order) THEN
   SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Alokasi kursi tidak lengkap';
  END IF;
  UPDATE pemesanan SET status='lunas',jatuh_tempo=NULL WHERE id=v_order;
 ELSE
  IF p_alasan IS NULL OR TRIM(p_alasan)='' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Alasan penolakan wajib diisi'; END IF;
  SELECT LEAST(DATE_ADD(NOW(),INTERVAL 15 MINUTE),j.berangkat_pada) INTO v_deadline
  FROM pemesanan p JOIN jadwal j ON j.id=p.id_jadwal WHERE p.id=v_order;
  UPDATE pembayaran SET status='ditolak',alasan_penolakan=p_alasan,diverifikasi_oleh=p_petugas,diverifikasi_pada=NOW() WHERE id=p_payment;
  UPDATE pemesanan SET status='menunggu_pembayaran',jatuh_tempo=v_deadline WHERE id=v_order;
  UPDATE jadwal_kursi s JOIN detail_pemesanan d ON d.id=s.id_detail_pemesanan
  SET s.ditahan_sampai=v_deadline WHERE d.id_pemesanan=v_order AND s.status='ditahan';
 END IF;
 COMMIT;
END$$

CREATE PROCEDURE sp_batalkan_pemesanan(IN p_order BIGINT UNSIGNED,IN p_user BIGINT UNSIGNED,IN p_alasan VARCHAR(255))
BEGIN
 DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN ROLLBACK; RESIGNAL; END;
 SET TRANSACTION ISOLATION LEVEL READ COMMITTED;
 START TRANSACTION;
 CALL internal_kunci_pemesanan(p_order);
 IF NOT EXISTS(SELECT 1 FROM pemesanan WHERE id=p_order AND id_pemesan=p_user
 AND status IN ('menunggu_pembayaran','menunggu_verifikasi')) THEN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Pemesanan tidak dapat dibatalkan; tiket lunas memerlukan proses refund';
 END IF;
 UPDATE jadwal_kursi s JOIN detail_pemesanan d ON d.id=s.id_detail_pemesanan
 SET s.status='tersedia',s.id_detail_pemesanan=NULL,s.ditahan_sampai=NULL WHERE d.id_pemesanan=p_order;
 UPDATE pembayaran SET status='dibatalkan' WHERE id_pemesanan=p_order AND status='menunggu';
 UPDATE pemesanan SET status='dibatalkan',alasan_pembatalan=p_alasan WHERE id=p_order;
 COMMIT;
END$$
DELIMITER ;
