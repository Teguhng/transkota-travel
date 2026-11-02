# Sistem Pemesanan Tiket Travel (Node.js + Tailwind CSS + MySQL 8.4 Docker)

* **Author:** Mahasiswa & Antigravity Pair
* **Date:** 2026-10-30

## Overview

Sistem Pemesanan Tiket Travel adalah aplikasi web berbasis kontainer (Docker) yang mengimplementasikan 11 use case travel antarkota untuk 3 peran: **Admin**, **Operator Loket**, dan **Member/Pelanggan**. Sistem ini mengonsumsi skema ter-normalisasi MySQL 8.4 InnoDB pada `db_tiket.sql` tanpa merubah struktur tabel maupun integritas data historis. Antarmuka dibangun menggunakan **Tailwind CSS** dengan arsitektur **Dual-Theme (Light & Dark Mode)** yang ergonomis bagi mata di siang maupun malam hari serta memenuhi standar aksesibilitas **WCAG 2.1 Level AA & AAA**.

---

## Tema UI Rekomendasi: *Nordic Slate & Ocean Blue* (Dual-Theme Ergonomics)

Untuk menjawab kebutuhan antarmuka yang **"terang dan jelas saat siang hari, serta sejuk dan tidak perih di mata dalam kegelapan (dark mode)"**, tema yang paling ideal adalah **Nordic Slate & Ocean Blue**. 

### Mengapa Bukan Pure White atau Pure Black?
1. **Siang Hari (Anti-Silau / Snow Blindness)**: Latar belakang kanvas tidak menggunakan putih mentah `#FFFFFF`, melainkan `Slate-50` (`#F8FAFC`) dipadu kartu konten putih `White` dengan bayangan lembut. Ini memberikan persepsi kedalaman (*depth*) tanpa membuat mata lelah karena silau.
2. **Malam Hari (Anti-Halation / Zero Eye Strain)**: Dark mode tidak menggunakan hitam pekat `#000000` (OLED black) yang menyebabkan efek teks putih berbayang/kabur di mata (*halation effect*). Dark mode menggunakan spektrum **Deep Navy Slate** (`#020617` & `#0F172A`) yang sejuk, nyaman untuk pupil mata saat ruangan gelap, dan kontrasnya tetap tajam.

---

### Matriks Warna Dual-Theme & Kepatuhan WCAG 2.1

| Komponen Antarmuka | Mode Terang (Siang Hari) | Mode Gelap (Malam Hari) | Rasio Kontras (Light ➔ Dark) | Kepatuhan WCAG |
| :--- | :--- | :--- | :--- | :--- |
| **Kanvas Utama (Page Background)** | `Slate-50` (`#F8FAFC`) | `Slate-950` (`#020617`) | - | Background Canvas |
| **Kartu Konten / Panel (Card Surface)**| `White` (`#FFFFFF`) | `Slate-900` (`#0F172A`) | - | Surface Elevation |
| **Border & Divider** | `Slate-200` (`#E2E8F0`) | `Slate-800` (`#1E293B`) | - | Subtle Boundary |
| **Teks Utama (Headings & Values)** | `Slate-900` (`#0F172A`) | `Slate-100` (`#F1F5F9`) | **17.85 : 1** ➔ **16.30 : 1** | **Level AAA (Maksimal)** |
| **Teks Sekunder (Labels & Captions)** | `Slate-600` (`#475569`) | `Slate-400` (`#94A3B8`) | **7.58 : 1** ➔ **6.96 : 1** | **Level AAA / AA** |
| **Tombol Aksi Utama (CTA Button)** | `White` on `Blue-600` (`#2563EB`)| `White` on `Blue-600` (`#2563EB`)| **5.17 : 1** ➔ **5.17 : 1** | **Level AA** |
| **Teks Aksen & Tautan Interaktif** | `Blue-600` (`#2563EB`) | `Blue-400` (`#60A5FA`) | **5.17 : 1** ➔ **7.02 : 1** | **Level AA ➔ Level AAA** |
| **Badge Kursi Tersedia (Emerald)** | `Emerald-800` on `Emerald-50` | `Emerald-300` on `Emerald-950`| **7.29 : 1** ➔ **9.94 : 1** | **Level AAA (Kedua Mode)** |
| **Badge Timer & Pending (Amber)** | `Amber-900` on `Amber-100` | `Amber-300` on `Amber-950` | **8.15 : 1** ➔ **10.39 : 1** | **Level AAA (Kedua Mode)** |
| **Badge Kursi Terjual (Rose)** | `Rose-800` on `Rose-50` | `Rose-300` on `Rose-950` | **7.30 : 1** ➔ **8.27 : 1** | **Level AAA (Kedua Mode)** |

---

### Mekanisme Penggantian Tema (Theme Toggle)
* **Tailwind Dark Mode Strategy**: Menggunakan konfigurasi `darkMode: 'class'` pada `tailwind.config.js`.
* **Deteksi Otomatis & Persistensi**:
  * Mengikuti preferensi tema sistem operasi pengguna (`prefers-color-scheme: dark`) secara default.
  * Tombol switch (Matahari ☀️ / Bulan 🌙) di navbar untuk preferensi manual yang disimpan di `localStorage.theme`.
  * Inline head script ringan untuk mencegah efek kedip layar (*flash of unstyled theme / FOUT*) saat halaman dimuat.

---

## Audit Aksesibilitas WCAG 2.1 (Non-Warna & Screen Reader)

Sesuai **WCAG 2.1 SC 1.4.1 (*Use of Color*)**:
* **Anti-Buta Warna (Protanopia/Deuteranopia)**: Denah kursi tidak hanya membedakan status lewat warna hijau/merah.
  * Teks label selalu tertulis: *"Tersedia"*, *"Dipilih"*, atau *"Terjual"*.
  * Ikon pembeda: Centang (`✓`) untuk kursi dipilih, gembok (`🔒`) untuk terjual.
  * Pembeda border: Kursi dipilih memakai border tebal 2px dengan ring outline biru.

Sesuai **WCAG 2.1 SC 2.1.1 (*Keyboard Accessible*)**:
* Denah kursi berupa elemen `<button type="button" role="checkbox" aria-label="...">` dengan indikator fokus `focus:ring-2` yang dapat dinavigasi via keyboard (`Tab` + `Space`/`Enter`).
* Countdown timer menggunakan atribut `role="timer"` dan `aria-live="polite"`.

---

## Rincian 18 Halaman / Antarmuka Sistem

```
Total: 18 Halaman / Views
├── 1. Domain Publik & Tamu (5 Halaman)
├── 2. Domain Member / Pelanggan (6 Halaman)
├── 3. Domain Operator Loket (4 Halaman)
└── 4. Domain Administrator (3 Halaman / Panel Master)
```

### 1. Domain Publik & Tamu (5 Halaman)
1. **`views/public/home.ejs` (`GET /`)**: Landing page utama. Berisi hero banner, form pencarian rute interaktif (Kota Asal ➔ Kota Tujuan ➔ Tanggal Keberangkatan), daftar rute favorit, profil armada mobil, dan FAQ.
2. **`views/public/jadwal-list.ejs` (`GET /jadwal`)**: Katalog hasil pencarian tiket travel. Menampilkan kartu jadwal, jam berangkat/tiba, estimasi durasi, harga tiket, sisa slot kursi real-time, dan tombol "Pilih Kursi".
3. **`views/public/login.ejs` (`GET /login`)**: Pintu masuk login terpadu. Satu form untuk Admin, Operator, dan Member dengan deteksi otomatis role pengguna setelah verifikasi kredensial.
4. **`views/public/register.ejs` (`GET /register`)**: Formulir pendaftaran akun member baru (`nama`, `telepon`, `alamat`, `jenis_kelamin`, `username`, `password`).
5. **`views/public/activate.ejs` (`GET /auth/activate`)**: Form aktivasi akun dan pembuatan kata sandi perdana bagi pengguna hasil migrasi lama yang memiliki status `wajib_reset_password = 1`.

### 2. Domain Member / Pelanggan (6 Halaman)
6. **`views/member/seat-selection.ejs` (`GET /booking/:jadwal_id/kursi`)**: Denah kabin interaktif 5 kursi minibus dengan siluet mobil, indikator supir, dan kode status visual real-time (Tersedia, Dipilih, Terisi).
7. **`views/member/checkout.ejs` (`GET /booking/:jadwal_id/checkout`)**: Formulir rincian data penumpang per kursi yang dipilih, ringkasan kalkulasi total harga, dan tombol konfirmasi pemesanan.
8. **`views/member/invoice.ejs` (`GET /pesanan/:kode_booking`)**: Halaman tagihan tiket. Menampilkan rincian pesanan, rekening bank tujuan transfer travel, dan *sticky countdown timer* (15 menit batas pembayaran).
9. **`views/member/payment-form.ejs` (`GET /pesanan/:kode_booking/bayar`)**: Formulir konfirmasi pembayaran transfer manual (input nama bank, no rekening pengirim, nomor referensi/resi, dan drag-and-drop unggah struk transfer).
10. **`views/member/my-tickets.ejs` (`GET /member/pesanan`)**: Dashboard riwayat tiket pelanggan. Dilengkapi tab status (Menunggu Bayar, Menunggu Verifikasi, Lunas, Riwayat Lampau) dan tombol Cetak E-Tiket PDF.
11. **`views/member/complaints.ejs` (`GET /member/keluhan`)**: Formulir penyampaian aspirasi/keluhan layanan perjalanan beserta tabel pemantauan status tanggapan admin.

### 3. Domain Operator Loket (4 Halaman)
12. **`views/operator/dashboard.ejs` (`GET /operator/dashboard`)**: Ringkasan operasional loket harian: kartu metrik tiket menunggu verifikasi, jadwal keberangkatan hari ini, dan okupansi armada.
13. **`views/operator/verifikasi.ejs` (`GET /operator/verifikasi`)**: Tabel antrean pembayaran masuk (`status = 'menunggu'`) lengkap dengan modal review struk (zoom/rotate), perbandingan nominal, dan tombol aksi **Setujui** atau **Tolak** (disertai alasan penolakan).
14. **`views/operator/orders.ejs` (`GET /operator/pemesanan`)**: Manajemen daftar semua reservasi tiket travel, fitur pencarian cepat kode booking, filter tanggal, dan tombol check-in penumpang sebelum naik mobil.
15. **`views/operator/walkin-order.ejs` (`GET /operator/loket/baru`)**: Antarmuka khusus loket untuk melayani penumpang fisik/walk-in (pembayaran tunai langsung cetak tiket dengan pembuatan akun member otomatis by nomor telepon).

### 4. Domain Administrator (3 Halaman / Panel Master)
16. **`views/admin/dashboard.ejs` (`GET /admin/dashboard`)**: Dashboard metrik eksekutif: visualisasi pendapatan mingguan/bulanan, okupansi rute terpadat, dan utilisasi kendaraan aktif.
17. **`views/admin/master-data.ejs` (`/admin/rute`, `/admin/kendaraan`, `/admin/jadwal`)**: Panel manajemen terpadu dengan tab switcher:
    * *Tab Rute & Kota*: CRUD kota dan konfigurasi rute (jarak km, estimasi menit).
    * *Tab Kendaraan*: CRUD data mobil travel (Avanza/Xenia, nopol, warna, status).
    * *Tab Jadwal*: CRUD penugasan armada dan rute (otomatis men-generate 5 slot kursi via database trigger).
18. **`views/admin/users-complaints.ejs` (`/admin/users`, `/admin/keluhan`, `/admin/arsip-migrasi`)**: 
    * *Tab Akun*: Manajemen pengguna (aktif/nonaktif, reset password darurat).
    * *Tab Keluhan*: Evaluasi laporan komplain pelanggan untuk perbaikan mutu.
    * *Tab Log Migrasi*: Pemantauan catatan anomali data lama pada tabel `arsip_migrasi`.

---

## Arsitektur Perangkat Lunak & Topologi Docker

```
[ Browser / Klien ]
        │ HTTP Requests (Cookies / Form Data / Multipart)
        ▼
┌────────────────────────────────────────────────────────┐
│ 1. Routing & Middleware Layer                          │
│    - Routing definitions per domain                    │
│    - Session Authentication & RBAC Guard Middleware    │
│    - Request Validation (Zod) & Multer File Upload     │
└───────────────────────┬────────────────────────────────┘
                        │
                        ▼
┌────────────────────────────────────────────────────────┐
│ 2. Controller Layer                                    │
│    - HTTP Input Extraction & Response Formatting       │
│    - View Rendering (EJS Engine) & Flash Notification  │
└───────────────────────┬────────────────────────────────┘
                        │
                        ▼
┌────────────────────────────────────────────────────────┐
│ 3. Service Layer (Business Logic Engine)               │
│    - Error Mapping dari SQLSTATE ke Pesan Ramah User   │
│    - Orkestrasi Upload Berkas & Pembersihan File Gagal │
│    - Background Expiry Worker (Memanggil Stored Proc)  │
└───────────────────────┬────────────────────────────────┘
                        │
                        ▼
┌────────────────────────────────────────────────────────┐
│ 4. Repository Layer (Data Access Layer)                │
│    - Pemanggilan Terisolasi Stored Procedures MySQL    │
│    - Raw SELECT Queries dengan Parameterized Binding   │
│    - Tidak ada manual transaction juggling di Node.js  │
└───────────────────────┬────────────────────────────────┘
                        │
                        ▼
┌────────────────────────────────────────────────────────┐
│ 5. Database Layer: MySQL 8.4 (db_tiket.sql)            │
│    - ACID Stored Procedures:                           │
│      * sp_buat_pemesanan (JSON_TABLE passengers)       │
│      * sp_ajukan_pembayaran                            │
│      * sp_verifikasi_pembayaran                        │
│      * sp_kedaluwarsa_jadwal                           │
│      * sp_batalkan_pemesanan                           │
│    - Strict Constraints, Foreign Keys & Triggers       │
└────────────────────────────────────────────────────────┘
```

---

## Goals vs. Non-Goals

* **In-Scope Goals:**
  * Implementasi penuh 11 use case diagram dengan UI Tailwind CSS responsif (18 halaman).
  * Sistem tema ganda (Light Mode siang hari & Dark Mode malam hari) dengan kontras teruji WCAG AAA.
  * Kompatibilitas 100% skema MySQL 8.4 (`db_tiket.sql`) memanfaatkan stored procedures resmi.
  * Denah kabin interaktif 5 kursi dengan proteksi anti-*double-booking*.
  * Fitur unggah dan verifikasi gambar bukti struk pembayaran oleh operator dengan penghapusan otomatis berkas gagal.
  * Orkestrasi Docker Compose siap jalan dengan satu perintah (`docker compose up -d`).
  * Skrip seeder demo jadwal aktif dan reset password akun bawaan.
* **Out-of-Scope Non-Goals:**
  * Integrasi Payment Gateway API pihak ketiga (tetap transfer manual sesuai skema).
  * Notifikasi SMS/WhatsApp fisik.
  * GPS Live Tracking kendaraan.
