# TRANSKOTA Travel

Sistem reservasi tiket minibus antarkota eksekutif berbasis web monolith (Server-Side Rendering) dengan jaminan reservasi kursi atomik bebas double-booking, manajemen jadwal real-time, verifikasi pembayaran manual, dan dashboard multi-peran.

Repository: [https://github.com/rizkyaa-dev/transkota-travel.git](https://github.com/rizkyaa-dev/transkota-travel.git)

---

## Fitur Utama

- **Reservasi Kursi Atomik**: Pencegahan double-booking pada level database menggunakan stored procedure MySQL dengan lock transaksi baris (`FOR UPDATE`).
- **Katalog Jadwal & Rute**: Pencarian jadwal keberangkatan berdasarkan stasiun asal, tujuan, dan tanggal perjalanan.
- **Sistem Pembayaran & Tiket**: Unggah bukti transfer dengan validasi tipe file dan ukuran, batas waktu kedaluwarsa otomatis (expiry worker), dan penerbitan kode tiket unik.
- **Dashboard Multi-Peran**:
  - **Admin**: Manajemen data master (rute, kendaraan, kota, jadwal), monitoring transaksi, dan rekapitulasi laporan.
  - **Operator Loket**: Validasi dan verifikasi bukti transfer pembayaran, monitoring manifes penumpang per jadwal.
  - **Member**: Riwayat pemesanan, unduh e-tiket, dan pelacakan status pembayaran.
- **Desain Responsif & Aksesibilitas**: Tampilan antarmuka *Nordic Slate & Ocean Blue* yang dioptimalkan untuk perangkat mobile (360px+) dan desktop, mendukung mode terang dan gelap.

---

## Tech Stack

- **Backend Runtime**: Node.js (ES Modules) & TypeScript 5.6
- **Web Framework**: Express.js 4.21
- **Template Engine**: EJS dengan `express-ejs-layouts`
- **Styling**: Tailwind CSS 3.4
- **Database**: MySQL 8.4 (InnoDB, Stored Procedures, Triggers, Views)
- **Session & Security**: `express-session`, `express-mysql-session`, `bcryptjs`, `csrf-csrf`, `zod`
- **File Upload**: `multer` (penyimpanan bukti bayar)
- **Pengujian**: Vitest

---

## Struktur Direktori

```text
├── docs/                 # Dokumentasi arsitektur dan spesifikasi
├── public/               # File statis (CSS, aset SVG, JS client)
│   └── css/              # input.css, output.css, base.css
├── scripts/              # Skrip otomasi, snapshot, dan utilitas
├── src/
│   ├── config/           # Konfigurasi database, env, dan session
│   ├── controllers/      # Controller per domain (auth, booking, admin, operator)
│   ├── middlewares/      # Auth guard, CSRF, validasi role, error handler
│   ├── routes/           # Definisi rute Express
│   ├── scripts/          # Skrip seeder database (passwords, jadwal)
│   ├── services/         # Logika bisnis dan akses database
│   └── server.ts         # Entrypoint aplikasi Express
├── storage/              # Direktori penyimpanan bukti transfer
├── tests/                # Unit dan integration test suite (Vitest)
├── views/                # Template EJS (admin, operator, member, public, partials)
├── db_tiket.sql          # Skema database MySQL 8.4 lengkap
├── docker-compose.yml    # Konfigurasi container MySQL dan app
└── tailwind.config.js    # Konfigurasi Tailwind CSS
```

---

## Prasyarat Sistem

1. Node.js versi 20.x atau lebih baru
2. npm versi 10.x atau lebih baru
3. MySQL Server versi 8.4 (lokal via Laragon/XAMPP atau via Docker Compose)

---

## Panduan Instalasi dan Menjalankan Aplikasi

### 1. Kloning Repository

```bash
git clone https://github.com/rizkyaa-dev/transkota-travel.git
cd transkota-travel
```

### 2. Pasang Dependensi

```bash
npm install
```

### 3. Konfigurasi Lingkungan (.env)

Salin file contoh konfigurasi dan sesuaikan kredensial database Anda:

```bash
cp .env.example .env
```

Pastikan variabel lingkungan pada `.env` telah sesuai:

```env
PORT=3000
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=tiket_user
DB_PASSWORD=secret
DB_NAME=db_tiket
SESSION_SECRET=kunci_rahasia_sesi_anda
NODE_ENV=development
```

### 4. Setup Database MySQL

Buat database dan impor skema `db_tiket.sql`:

```bash
# Opsi A: Menggunakan MySQL CLI lokal
mysql -u root -p -e "CREATE DATABASE db_tiket;"
mysql -u root -p db_tiket < db_tiket.sql

# Opsi B: Menggunakan Docker Compose
docker compose up -d db
```

Jalankan seeder untuk inisialisasi akun demo dan contoh jadwal:

```bash
npm run seed:passwords
npm run seed:demo-schedules
```

### 5. Kompilasi Aset CSS

```bash
npm run build
```

### 6. Menjalankan Server

**Mode Pengembangan (dengan hot reload via tsx):**
```bash
npm run dev
```

**Mode Produksi:**
```bash
npm run build
npm start
```

Aplikasi dapat diakses melalui browser pada: [http://localhost:3000](http://localhost:3000)

---

## Akun Demo untuk Pengujian

Semua akun demo menggunakan password default: `Password123!`

| Peran | Username | Akses URL |
| :--- | :--- | :--- |
| **Administrator** | `admin_1` | `/login` -> `/admin/dashboard` |
| **Operator Loket** | `operator_1` | `/login` -> `/operator/dashboard` |
| **Member (Penumpang)** | `aziz` | `/login` -> `/member/my-tickets` |

---

## Menjalankan Pengujian (Testing)

Suite pengujian mencakup unit test service dan integration test database stored procedure:

```bash
npm test
```

Pemeriksaan tipe data TypeScript:

```bash
npm run typecheck
```

---
---

## Lisensi

Proyek ini dilisensikan di bawah lisensi MIT. Lihat file [LICENSE](LICENSE) untuk detail lengkap.

