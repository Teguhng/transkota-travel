# Comprehension Audit Report (Stage 6)

**Target Document**: `docs/designs/sistem_pemesanan_tiket_travel.md`  
**Auditor**: `egm-comprehension` (Comprehension Goldfish / Naive Reader Persona)  
**Standard**: `resources/document_standards/re-implementation-standard.md` (Zero-Assumption Rule)  
**Scope**: `FeatureRange` (lines 1 to 336) & `DetailedRange` (lines 337 to 507)  
**Date**: 2026-10-30  

---

## Executive Summary

Audit *Stage 6: Comprehension Test* mengevaluasi dokumen desain berdasarkan standar pemahaman dan implementasi ulang (*Re-Implementation Standard & Zero-Assumption Rule*). Tujuannya adalah memastikan bahwa seorang insinyur baru (atau sesi AI independen) dapat membangun sistem secara deterministik tanpa membuat asumsi atau tebakan liar terhadap antarmuka, alur data, atau penanganan galat (*error handling*).

Total temuan: **10 Temuan**
* 🔴 **Blocker**: 1 temuan
* 🟡 **Major**: 5 temuan
* 🟢 **Nit**: 4 temuan

---

## Detailed Findings

### 🔴 Finding 1: Discrepancy on Walk-in Cash Payments vs Stored Procedure Exclusivity
* **Severity**: Blocker
* **Affected Scope**: CUJ 3 (lines 71–75), Technical Plan / Database Integration (lines 28–33, 106, 116), Detailed Implementation Plan (lines 398–399, 407, 423).
* **Discrepancy Description & Rationale**:
  Dokumen menetapkan pada CUJ 3 (baris 74) bahwa untuk pemesanan walk-in di loket fisik, operator membuat pesanan, "langsung menandai pembayaran tunai lunas, dan mencetak tiket fisik secara instan." Pada saat bersamaan, dokumen (baris 11, 28–33) dan bagian *Alternatives Considered* (baris 289–296) mewajibkan seluruh alur transaksi didelegasikan secara eksklusif ke *stored procedures* bawaan database untuk mencegah *deadlock* dan pelanggaran *foreign key* melingkar (`fk_alokasi_detail`).
  Namun, skema `db_tiket.sql` **tidak memiliki stored procedure untuk pembayaran tunai**. Prosedur pembayaran yang ada hanyalah `sp_ajukan_pembayaran`, yang memaksakan `metode = 'transfer_manual'` dan mewajibkan nilai non-kosong pada `referensi`, `no_rek_pengirim`, dan `bukti_pembayaran` (dengan komentar SQL: `-- Manual transfer submission. Cash/gateway integrations need separate verified flows.`).
  Dokumen desain tidak mendefinisikan bagaimana pembayaran tunai dicatat:
  1. Apakah backend mengeksekusi multi-table SQL transaction manual (`INSERT INTO pembayaran (metode='tunai', status='diterima', ...)`, `UPDATE jadwal_kursi SET status='terjual', ditahan_sampai=NULL`, `UPDATE pemesanan SET status='lunas', jatuh_tempo=NULL`)?
  2. Jika ya, bagaimana backend mempertahankan urutan penguncian ketat (`jadwal -> pemesanan -> pembayaran / jadwal_kursi`) seperti tertulis pada baris 318 `db_tiket.sql` agar tidak terjadi *deadlock*?
  Seorang insinyur baru tidak dapat mengimplementasikan CUJ 3 tanpa menebak atau melanggar aturan isolasi stored procedure.

---

### 🟡 Finding 2: Unstated Specification for Walk-in On-The-Fly Member Provisioning
* **Severity**: Major
* **Affected Scope**: Open Questions #1 (lines 52–53), CUJ 3 (line 74), `booking.service.ts` (line 407), `user.repository.ts` (lines 241–242, 389).
* **Discrepancy Description & Rationale**:
  Untuk memenuhi kendala `role = 'member'` pada `sp_buat_pemesanan`, dokumen menyatakan bahwa ketika operator menginput Nama dan No. HP di loket, "backend secara otomatis mencari atau mendaftarkan akun member instan (*on-the-fly provisioning*) sebelum prosedur reservasi dieksekusi."
  Namun, `db_tiket.sql` memberlakukan batasan ketat pada tabel `users`:
  - `username VARCHAR(100) NOT NULL UNIQUE`
  - `CONSTRAINT ck_users_password CHECK (wajib_reset_password IN (0,1) AND (wajib_reset_password = 1 OR password_hash IS NOT NULL))`
  Dokumen belum mendefinisikan:
  1. Rumus/pola pembuatan `username` untuk akun walk-in (misal: `walkin_<phone>` atau prefix unik berbasis timestamp).
  2. Perilaku sistem jika nomor telepon yang diinput telah terdaftar atas nama penumpang yang berbeda.
  3. Status awal password (`password_hash` diisi string acak atau `NULL` dengan flag `wajib_reset_password = 1`).
  Pengembang terpaksa menebak aturan default ini saat menulis kode.

---

### 🟡 Finding 3: Missing Identity Verification Contract on Legacy Account Activation
* **Severity**: Major
* **Affected Scope**: The Problem #3 (lines 20–21), `auth.service.ts` (line 405), `auth.controller.ts` (line 417), `auth.routes.ts` (line 433), `views/public/activate.ejs` (line 446).
* **Discrepancy Description & Rationale**:
  Dokumen mengidentifikasi masalah akun warisan (*cold-start legacy accounts* dengan `password_hash = NULL`, `wajib_reset_password = 1`) sebagai tantangan utama dan menyediakan halaman `/auth/activate`.
  Namun, dokumen tidak mendefinisikan protokol pembuktian identitas dan kontrak keamanannya:
  1. Bagaimana pengguna yang belum diautentikasi membuktikan bahwa akun tersebut miliknya? (Karena gateway SMS/WhatsApp merupakan *Non-Goal* di baris 44 sehingga OTP tidak ada). Apakah pengguna menginput `username` + nomor telepon atau email yang cocok dengan basis data?
  2. Bagaimana skema validasi Zod untuk request aktivasi password?
  3. Apakah login pertama otomatis me-redirect ke `/auth/activate` dengan sesi sementara (*temporary flag*), ataukah form aktivasi terbuka secara publik?
  Alur aktivasi akun warisan tidak dapat diimplementasikan secara deterministik tanpa kontrak ini.

---

### 🟡 Finding 4: Incomplete Routing Table and HTTP Endpoints Specification
* **Severity**: Major
* **Affected Scope**: Routing Declarations (`src/routes/`, lines 427–440), Presentation Controllers (`src/controllers/`, lines 416–426).
* **Discrepancy Description & Rationale**:
  Berdasarkan *Re-Implementation Standard*, tanda tangan API dan rute HTTP harus eksplisit. Pada Bagian 8:
  - `src/routes/member.routes.ts` hanya dirangkum sebagai `/member/*`, `/booking/*`, `/pesanan/*`.
  - `src/routes/operator.routes.ts` hanya dirangkum sebagai `/operator/*`.
  - `src/routes/admin.routes.ts` hanya dirangkum sebagai `/admin/*`.
  Meskipun beberapa endpoint muncul pada *sequence diagram*, endpoint penting operasional lainnya tidak tercantum, meliputi:
  - URL tampilan pemilihan kursi (`GET /booking/:jadwalId` vs `GET /jadwal/:id/kursi`).
  - Rute pembatalan tiket (`POST /pesanan/:kode/batal`) untuk memanggil `sp_batalkan_pemesanan`.
  - Endpoint pengajuan keluhan member (`POST /member/keluhan`).
  - Endpoint pengajuan walk-in operator (`POST /operator/walkin`).
  - Seluruh endpoint CRUD Admin untuk rute, armada, jadwal, manajemen pengguna, dan penanganan keluhan.
  Insinyur baru harus mereka-reka struktur URL, method HTTP, dan binding controller terkait.

---

### 🟡 Finding 5: Ambiguity in E-Ticket / Receipt Physical Printing Capability
* **Severity**: Major
* **Affected Scope**: CUJ 2 (line 69), CUJ 3 (line 75), `package.json` (lines 344–345), `src/services/` (lines 403–414).
* **Discrepancy Description & Rationale**:
  CUJ 2 (baris 69) menyatakan "E-Tiket PDF langsung dapat dicetak" dan CUJ 3 (baris 75) menyatakan "mencetak tiket fisik secara instan."
  Namun:
  1. `package.json` (baris 344–345) hanya menyertakan pustaka dasar tanpa generator PDF (seperti `pdfkit`, `puppeteer`, dsb.).
  2. Tidak ada layanan pembuatan binary PDF maupun endpoint controller PDF di `src/services/` atau `src/controllers/`.
  Dokumen tidak memperjelas apakah pencetakan dilakukan melalui stream biner PDF server-side, atau murni tampilan web EJS dengan CSS stylesheet cetak `@media print` yang dipicu via `window.print()`.

---

### 🟡 Finding 6: Incompatible Payload Contract for `sp_buat_pemesanan`
* **Severity**: Major
* **Affected Scope**: Sequence Diagram A (line 136), `src/types/booking.types.ts` (line 365), `pemesanan.repository.ts` (line 227).
* **Discrepancy Description & Rationale**:
  Pada Sequence Diagram A (baris 136), payload checkout digambarkan sebagai:
  `POST /booking/:id/checkout (kursi: [3], nama: "Budi")`
  Padahal di dalam `db_tiket.sql` (baris 358, 376–378, 408–409), prosedur `sp_buat_pemesanan` secara ketat mem-parsing array JSON object via `JSON_TABLE` dengan struktur kunci:
  `[{"id_jadwal_kursi": <BIGINT>, "nama": <VARCHAR>, "telepon": <VARCHAR|NULL>}]`
  Mengirim `kursi: [3]` (nomor kursi integer) alih-alih `id_jadwal_kursi` (primary key inventori `jadwal_kursi`) melanggar parsing path JSON (`$.id_jadwal_kursi`) dan memicu error `SQLSTATE 45000: 'Kursi duplikat atau data penumpang tidak lengkap'`.
  Dokumen melewatkan definisi DTO TypeScript yang presisi untuk mapping form input ke struktur JSON yang diharapkan prosedur database.

---

### 🟢 Finding 7: Missing Package for CSRF Protection
* **Severity**: Nit
* **Affected Scope**: Architecture (line 99), Keamanan & Proteksi Data (line 323), `package.json` (lines 344–345), `src/middlewares/csrf.middleware.ts` (lines 382–383).
* **Discrepancy Description & Rationale**:
  Dokumen mewajibkan proteksi CSRF untuk form transaksi dan menyertakan `src/middlewares/csrf.middleware.ts`. Namun `package.json` tidak mencantumkan modul CSRF (seperti `csrf-csrf`, mengingat pustaka `csurf` telah deprecated). Dokumen perlu menegaskan apakah middleware tersebut dibuat custom menggunakan `crypto.randomBytes` via session atau menggunakan pustaka npm tertentu.

---

### 🟢 Finding 8: Automatic Table Creation Flag for Session Storage
* **Severity**: Nit
* **Affected Scope**: Architecture (line 107), Keamanan (line 314), `src/config/session.ts` (lines 372–374).
* **Discrepancy Description & Rationale**:
  Dokumen menyatakan sesi disimpan di MySQL via `express-mysql-session` pada tabel `sessions` (line 107), sementara `db_tiket.sql` tidak memuat tabel tersebut.
  Konfigurasi `session.ts` belum mencantumkan opsi eksplisit `createDatabaseTable: true` pada `MySQLStoreOptions` agar pustaka membuat tabel secara otomatis saat aplikasi dijalankan.

---

### 🟢 Finding 9: Unspecified SQL Query for Expiry Worker
* **Severity**: Nit
* **Affected Scope**: CUJ 4 (line 79), `jadwal.repository.ts` (line 238), `src/services/expiry.worker.ts` (lines 412–413).
* **Discrepancy Description & Rationale**:
  `src/services/expiry.worker.ts` dijadwalkan memanggil `sp_kedaluwarsa_jadwal` untuk "seluruh jadwal aktif". Pada `jadwal.repository.ts`, metode `releaseExpiredHolds(jadwalId)` membutuhkan parameter ID tunggal. Kueri SQL untuk mengambil daftar jadwal aktif tersebut belum disebutkan.

---

### 🟢 Finding 10: Missing Data-Binding Contract for Countdown Timer
* **Severity**: Nit
* **Affected Scope**: CUJ 1 (line 63), Sequence Diagram A (line 149), `public/js/countdown.js` (lines 458–459).
* **Discrepancy Description & Rationale**:
  Dokumen menyebutkan *sticky countdown timer* 15 menit pada halaman pembayaran, namun tidak merinci mekanisme passing timestamp batas bayar dari server ke klien (misalnya atribut HTML5 `data-expires-at="<%= order.jatuh_tempo.toISOString() %>"`). Tanpa spesifikasi ini, pengembang klien berisiko membuat timer statis 15 menit yang ter-reset saat halaman di-refresh.

