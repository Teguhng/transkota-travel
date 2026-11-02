# Implementation Readiness Review Report (Stage 9)

**Target Document**: `docs/designs/sistem_pemesanan_tiket_travel.md`  
**Auditors Swarm**:
* `egm-implementation-readiness` (Pragmatic Tech Lead Persona)
* `egm-codebase-details` (Technical Quality Auditor Persona)
* `egm-style` (Technical Copy Editor Persona)  
**Standard**: `resources/document_standards/implementation-readiness-standard.md` (Zero-Decision Rule & Phasing Standard)  
**Scope**: `DetailedRange` (lines 337 to 507)  
**Date**: 2026-10-30  

---

## Executive Summary

Audit *Stage 9: Implementation Readiness Test* melakukan evaluasi ketat terhadap rencana implementasi teknis (`DetailedRange`, baris 337–507) dan rencana verifikasi (*Verification Plan*). Tinjauan difokuskan pada pemenuhan prinsip **Zero-Decision Rule** (tidak meninggalkan keputusan teknis/arsitektural kepada pengembang), **Phasing & Checkpoints** (tahapan eksekusi bertahap yang stabil), serta ketepatan kode terhadap skema [db_tiket.sql](file:///c:/Users/kikid/Desktop/LAtihan/db_tiket.sql).

Total temuan terkonsolidasi: **19 Temuan**
* 🔴 **Blocker**: 4 temuan (Ketiadaan pembagian fase kerja/phasing, script build Docker `tsc --noEmit`, ketiadaan DAL pembayaran tunai, kontrak rute HTTP wildcard)
* 🟡 **Major**: 8 temuan (Dependensi package.json tidak lengkap, Dockerfile stage 2 lupa copy views/public, query worker kedaluwarsa, tipe database ناقص, mutasi DAL admin/keluhan, session & activation interceptor, Zod DTO form mapping, test environment profile)
* 🟢 **Nit**: 7 temuan (Inkonsistensi jumlah tampilan views, handling SQLSTATE 23000, framing demo dosen, redundansi modifier, meta-filler)

---

## Prioritized Consolidated Findings

### 🔴 Blocker Findings

#### 1. Pelanggaran Standar Pentahapan Kerja (*Phasing & Checkpoints*)
* **Reviewer Lens**: `egm-implementation-readiness`
* **Affected Scope**: Baris 337–479 (`Target Files to Create`)
* **Discrepancy Description**: Rencana implementasi saat ini menyajikan lebih dari 35 berkas dalam bentuk katalog datar (12 kategori komponen) tanpa mengurutkan urutan eksekusi menjadi fase-fase inkremental. Pengembang tidak memiliki panduan baseline tahapan build mana yang harus diselesaikan terlebih dahulu (misal: Fase 1 Konfigurasi Dasar ➔ Fase 2 DAL & Database ➔ Fase 3 Autentikasi & Middleware ➔ Fase 4 Layanan Bisnis ➔ Fase 5 Controller & Tampilan EJS ➔ Fase 6 Pengujian & Seeder).
* **Recommendation**: Restrukturisasi seluruh berkas target ke dalam fase-fase bernomor dengan kriteria pintu keluar (*exit criteria*) yang dapat diverifikasi pada setiap fase.

#### 2. Cacat Skrip Kompilasi Build Produksi (`tsc --noEmit`)
* **Reviewer Lens**: `egm-codebase-details`
* **Affected Scope**: Baris 485 (`Verification Plan`), Baris 345 (`package.json`), Baris 351 (`Dockerfile`)
* **Discrepancy Description**: Baris 485 mendefinisikan `npm run build` sebagai `(menjalankan tsc --noEmit dan build Tailwind CSS)`. Opsi `--noEmit` secara eksplisit melarang TypeScript menghasilkan artefak JavaScript ke disk. Padahal kontainer produksi dan skrip start menjalankan `node dist/server.js`. Akibatnya, `npm run build` tidak menghasilkan direktori `dist/`, menyebabkan kontainer Docker produksi gagal total dengan error `Cannot find module '/app/dist/server.js'`.
* **Recommendation**: Ganti skrip build produksi menjadi `tsc && npx tailwindcss -i ... -o dist/public/css/output.css --minify`, dan pindahkan opsi `--noEmit` ke skrip `npm run typecheck`.

#### 3. Ketiadaan Transaksi Pembayaran Tunai Loket pada DAL
* **Reviewer Lens**: `egm-implementation-readiness`, `egm-codebase-details`
* **Affected Scope**: Baris 398–399 (`pembayaran.repository.ts`), Baris 406–407 (`booking.service.ts`), Baris 422–423 (`operator.controller.ts`)
* **Discrepancy Description**: Rencana menginstruksikan tiket tunai walk-in diterbitkan secara instan di loket. Namun `db_tiket.sql` hanya memiliki `sp_ajukan_pembayaran` yang mewajibkan bukti transfer bank. Di `pembayaran.repository.ts`, metode untuk transaksi tunai (`metode = 'tunai'`, status `diterima`, update kursi `terjual`, update pemesanan `lunas`) sama sekali tidak didefinisikan, memaksa pengembang mengambil keputusan desain SQL sendiri.
* **Recommendation**: Tentukan secara eksplisit tanda tangan metode `processCashPayment(orderId, operatorUserId)` di `pembayaran.repository.ts` yang menjalankan transaksi database ACID lengkap dengan urutan penguncian ketat.

#### 4. Kontrak Routing HTTP Bersifat Wildcard dan Mengandung Kontradiksi
* **Reviewer Lens**: `egm-implementation-readiness`
* **Affected Scope**: Baris 427–440 (`src/routes/`)
* **Discrepancy Description**: Berkas route hanya dituliskan dalam wildcard generik (`/member/*`, `/operator/*`, `/admin/*`) tanpa mendaftarkan metode HTTP (`GET`/`POST`), path absolut, dan controller binding. Selain itu, terdapat kontradiksi path checkout antara Sequence Diagram A (`POST /booking/:id/checkout`) dan CSRF spec (`POST /booking/checkout`).
* **Recommendation**: Sertakan tabel rute HTTP definitif yang mencantumkan seluruh endpoint (Admin CRUD armada/rute/jadwal/keluhan, Operator review/walk-in, Member pemesanan/cetak/keluhan) beserta controller method dan middleware terkait.

---

### 🟡 Major Findings

#### 5. Kelalaian Dependensi Kritis pada `package.json`
* **Reviewer Lens**: `egm-codebase-details`, `egm-implementation-readiness`
* **Affected Scope**: Baris 344–345 (`package.json`)
* **Discrepancy Description**: Manifest hanya memuat dependensi runtime dasar. Berkas melewatkan paket-paket yang diwajibkan oleh rencana:
  1. CSRF: `csrf-csrf`
  2. Flash Notification: `connect-flash`
  3. DevDependencies & TypeScript: `typescript`, `@types/node`, `@types/express`, `@types/multer`, `@types/bcryptjs`, `@types/express-session`, `@types/connect-flash`, `@types/ejs`, `tailwindcss`, `tsx` (untuk menjalankan seeder dan nodemon dev).
  4. Test Runner: test runner framework untuk menjalankan `npm test`.
* **Recommendation**: Cantumkan daftar `dependencies` dan `devDependencies` secara lengkap dan siap salin (*copy-paste ready*).

#### 6. Dockerfile Multi-Stage Lupa Menyalin Berkas `views/` dan `public/`
* **Reviewer Lens**: `egm-codebase-details`
* **Affected Scope**: Baris 350–351 (`Dockerfile`)
* **Discrepancy Description**: Kompilasi TypeScript hanya menghasilkan file JS di `dist/`. Template EJS (`views/**/*.ejs`) dan aset statis (`public/`) tidak disertakan dalam perintah copy Stage 2 kontainer runner. Ini akan memicu error Express `Failed to lookup view in "views" directory` saat aplikasi berjalan di dalam kontainer.
* **Recommendation**: Tambahkan instruksi `COPY --from=builder /app/views ./views` dan `COPY --from=builder /app/public ./public` pada Stage 2 Dockerfile.

#### 7. Ketiadaan Kueri Target pada Background Expiry Worker
* **Reviewer Lens**: `egm-implementation-readiness`, `egm-codebase-details`
* **Affected Scope**: Baris 412–413 (`expiry.worker.ts`), Baris 394–395 (`jadwal.repository.ts`)
* **Discrepancy Description**: Prosedur `sp_kedaluwarsa_jadwal(IN p_jadwal BIGINT UNSIGNED)` mewajibkan satu ID jadwal. Worker dinyatakan berjalan setiap 60 detik untuk "seluruh jadwal aktif", namun tidak ada kueri SQL di repository untuk menemukan ID jadwal mana saja yang memiliki pesanan kedaluwarsa.
* **Recommendation**: Tambahkan metode `findSchedulesWithExpiredHolds(): Promise<number[]>` pada `jadwal.repository.ts` yang mengeksekusi kueri `SELECT DISTINCT id_jadwal FROM pemesanan WHERE status = 'menunggu_pembayaran' AND jatuh_tempo <= NOW()`.

#### 8. Kelalaian Tipe Database pada `db.types.ts`
* **Reviewer Lens**: `egm-codebase-details`
* **Affected Scope**: Baris 362–363 (`src/types/db.types.ts`)
* **Discrepancy Description**: Spesifikasi hanya mendaftarkan 7 tabel, melewatkan entitas relasional kunci: `kursi_kendaraan`, `rute`, `jadwal_kursi`, `detail_pemesanan`, dan `arsip_migrasi`.
* **Recommendation**: Lengkapi definisi TypeScript interface untuk seluruh 12 tabel skema `db_tiket.sql`.

#### 9. Operasi Update Keluhan pada DAL Admin Belum Terdefinisi
* **Reviewer Lens**: `egm-codebase-details`, `egm-implementation-readiness`
* **Affected Scope**: Baris 400–401 (`keluhan.repository.ts`), Baris 425 (`admin.controller.ts`)
* **Discrepancy Description**: Tabel `keluhan` memuat status operasional (`'baru'`, `'diproses'`, `'selesai'`) dan tanggapan admin. Rencana saat ini hanya mencantumkan query daftar komplain tanpa metode mutasi untuk menanggapi dan menyelesaikan keluhan.
* **Recommendation**: Tambahkan metode `respondToComplaint(id, response, adminUserId, status)` pada `keluhan.repository.ts`.

#### 10. Kontrak Data Sesi dan Interseptor Aktivasi Akun
* **Reviewer Lens**: `egm-implementation-readiness`
* **Affected Scope**: Baris 360–361 (`express.d.ts`), Baris 376–377 (`auth.middleware.ts`)
* **Discrepancy Description**: Rencana mengharuskan pengguna warisan yang login (`wajib_reset_password = 1`) dialihkan ke `/auth/activate`. Kontrak interface `req.session.user` dan daftar *whitelist* rute yang tidak boleh di-redirect (untuk mencegah *infinite redirect loop*) belum ditentukan.
* **Recommendation**: Definisikan interface `SessionUser` (`id`, `username`, `nama`, `role`, `wajib_reset_password`) dan cantumkan logika pengecualian rute pada `auth.middleware.ts`.

#### 11. Skema Zod & Mapping Form HTML ke JSON DTO `sp_buat_pemesanan`
* **Reviewer Lens**: `egm-implementation-readiness`
* **Affected Scope**: Baris 364–365 (`booking.types.ts`), Baris 406–407 (`booking.service.ts`)
* **Discrepancy Description**: `sp_buat_pemesanan` memvalidasi array JSON `[{"id_jadwal_kursi": ..., "nama": ..., "telepon": ...}]`. Karena aplikasi menggunakan form HTML standar SSR, struktur penamaan input form dan skema parser Zod untuk mengubah payload form menjadi format JSON yang diterima database belum didefinisikan.
* **Recommendation**: Tentukan skema Zod `CheckoutSchema` dan aturan serialisasi input form HTML.

#### 12. Profil Koneksi Database untuk Lingkungan Pengujian Lokal
* **Reviewer Lens**: `egm-codebase-details`
* **Affected Scope**: Baris 352–355 (`docker-compose.yml`, `.env.example`), Baris 476–477 (`tests/`)
* **Discrepancy Description**: Host `DB_HOST=db` hanya dikenali di dalam Docker bridge network. Menjalankan `npm test` langsung di mesin host akan gagal koneksi jika port 3306 tidak diekspos ke host (`ports: ["3306:3306"]`) atau tanpa berkas konfigurasi pengujian khusus.
* **Recommendation**: Pastikan `docker-compose.yml` mengekspos port database atau sediakan petunjuk eksekusi test di dalam container `docker compose exec app npm test`.

---

### 🟢 Nit Findings

13. **Koreksi Jumlah Tampilan Halaman Operator**: Perbaiki kontradiksi angka di baris 450–451 dari "4 halaman operasional" menjadi "5 halaman operasional loket". (`egm-style`, `egm-codebase-details`)
14. **Penanganan Error SQLSTATE 23000**: Tambahkan penanganan `SQLSTATE 23000` (ER_DUP_ENTRY) pada `error.middleware.ts` untuk menangkap duplikasi kode referensi/username. (`egm-codebase-details`)
15. **Struktur Pengujian CUJ yang Konsisten**: Tambahkan format `Perintah` dan `Kriteria Sukses` pada Item 4 Verification Plan agar selaras dengan Item 1–3. (`egm-style`)
16. **Eliminasi Framing Informal Presentasi**: Hapus frasa kasual *"guna kemudahan pengujian demo dosen"* menjadi *"untuk verifikasi akun pengujian lokal"*. (`egm-style`)
17. **Objektivitas Kriteria Aksesibilitas**: Ganti kriteria estetik *"tanpa pendaran berbayang"* dan *"skor 100%"* dengan *"skor Lighthouse Accessibility >= 90 dan kontras WCAG AA"*. (`egm-style`)
18. **Pembersihan Redundansi Kata & Pleonasme**: Hapus pengulangan kata seperti *"penamaan UUID acak"*, *"armada mobil"*, *"halaman landing page"*. (`egm-style`)
19. **Penghapusan Meta-Filler & Boilerplate AI**: Hapus kalimat pembuka meta-filler baris 339 dan tag `*Drafted with EGM*` di baris 506. (`egm-style`)

