# Goldfish Annotated Review Report

**Target:** `docs/designs/sistem_pemesanan_tiket_travel.md` (`full file`, lines 1–507)  
**Status:** resolved  
**Date:** 2026-10-30  

---

## Prioritized Findings & AI Suggestions

### 1. Pelunasan Pembayaran Tunai Loket (CUJ 3) vs Isolasi Stored Procedure [`egm-zoom-out`, `egm-comprehension`, `egm-design`, `egm-implementation-readiness`, `egm-codebase-details`] - Severity: Blocker
* **Affected Scope:** [Lines 35, 71–75, 231–234, 289–296, 398–399, 423](docs/designs/sistem_pemesanan_tiket_travel.md#L71-L75) (CUJ 3, Integrasi Skema Database, Repositories)
* **Discrepancy Description:** Dokumen mewajibkan seluruh transaksi diisolasi via *stored procedures* bawaan database tanpa query manual di layer aplikasi. Namun `db_tiket.sql` tidak memiliki stored procedure untuk pembayaran tunai loket; `sp_ajukan_pembayaran` memaksakan transfer manual dengan nomor rekening dan bukti transfer.
* **Rationale:** Mencoba memalsukan data ke SP transfer manual mencemari data audit transaksi, sementara direct UPDATE di aplikasi melanggar aturan isolasi arsitektur.
* ***AI Suggestion:*** PROPOSE FIX
* ***Justification:*** Tabel `pembayaran` secara native mendukung `metode = 'tunai'` dan kolom transfer bersifat nullable. Buat satu metode terisolasi di `pembayaran.repository.ts` (`processCashPayment`) yang menjalankan transaksi ACID terisolasi sesuai urutan lock resmi database (`jadwal -> pemesanan -> pembayaran / jadwal_kursi`), dan sesuaikan klaim dokumen menjadi "seluruh reservasi dan pengajuan transfer melalui stored procedure, sedangkan pelunasan tunai loket diisolasi dalam transaksi terkontrol di repository".
* ***Proposed Edit:***
  * Location: `docs/designs/sistem_pemesanan_tiket_travel.md` (CUJ 3, Section 3 Database Integration, Section Repositories)
  * Change: Menambahkan spesifikasi transaksi tunai `processCashPayment` dengan urutan lock eksplisit dan memperbarui aturan isolasi transaksi.

---

### 2. Ketiadaan Bagian Wajib "Risks & Mitigations" pada Blueprint [`egm-structural`, `egm-design`] - Severity: Blocker
* **Affected Scope:** [Lines 309–335](docs/designs/sistem_pemesanan_tiket_travel.md#L309-L335) (Antara Alternatives Considered dan Non-Functional Requirements)
* **Discrepancy Description:** Standar *Feature Specification* mewajibkan evaluasi eksplisit kegagalan sistem (*failure modes*), implikasi keamanan, limit skalabilitas, dan mitigasinya. Dokumen saat ini hanya memiliki *Non-Functional Requirements* umum.
* **Rationale:** Tanpa matriks mitigasi risiko, kegagalan saat konkurensi tinggi atau penanganan berkas tidak memiliki panduan operasional.
* ***AI Suggestion:*** PROPOSE FIX
* ***Justification:*** Tambahkan bagian H2 `## Risks & Mitigations` yang merinci kegagalan transaksi konkuren, penanganan file yatim, mitigasi kontensi lock worker, dan pengamanan aktivasi password.
* ***Proposed Edit:***
  * Location: Sebelum `## Non-Functional Requirements`
  * Change: Menyisipkan bagian `## Risks & Mitigations` lengkap dengan tabel matriks risiko, dampak, dan mitigasi arsitekturalnya.

---

### 3. Vektor Pembajakan Akun pada Alur Reset Password Akun Warisan [`egm-design`, `egm-comprehension`, `egm-zoom-out`] - Severity: Blocker
* **Affected Scope:** [Lines 20–21, 240–244, 405, 417, 446](docs/designs/sistem_pemesanan_tiket_travel.md#L20-L21) (The Problem, auth.service.ts, activate.ejs)
* **Discrepancy Description:** Akun warisan 2017 memiliki `password_hash = NULL` dan `wajib_reset_password = 1`. Dokumen mengecualikan gateway SMS/OTP. Tanpa faktor verifikasi kepemilikan, siapa pun yang mengetahui username pengguna lama dapat mengambil alih akun pada `/auth/activate`.
* **Rationale:** Menghindari celah keamanan fatal (*Account Takeover*) tanpa menambah dependensi eksternal yang rumit (SMTP/SMS gateway).
* ***AI Suggestion:*** PROPOSE FIX
* ***Justification:*** Terapkan verifikasi tantangan identitas langsung berbasis data profil tabel `users`: mewajibkan input `username` + verifikasi kecocokan nomor telepon atau email terdaftar sebelum mengizinkan setelan password baru. Sertakan juga penanganan whitelist rute pada `auth.middleware.ts` untuk mencegah loop redirect.
* ***Proposed Edit:***
  * Location: Bagian Problem Statement, CUJ, dan modul Auth
  * Change: Menambahkan kontrak verifikasi identitas akun warisan pada form `/auth/activate`.

---

### 4. Pelanggaran Standar Pentahapan Kerja (*Phasing & Checkpoints*) [`egm-implementation-readiness`] - Severity: Blocker
* **Affected Scope:** [Lines 337–479](docs/designs/sistem_pemesanan_tiket_travel.md#L337-L479) (`## Detailed Implementation Plan`)
* **Discrepancy Description:** Rencana implementasi menyajikan 35+ berkas target dalam bentuk katalog datar tanpa mengelompokkannya menjadi fase kerja sekuensial yang memiliki baseline build dan kriteria pengujian bertahap.
* **Rationale:** Pengembang tidak memiliki panduan urutan build yang stabil dan dapat diverifikasi secara inkremental.
* ***AI Suggestion:*** PROPOSE FIX
* ***Justification:*** Reorganisasi seluruh berkas target ke dalam 6 fase implementasi berurutan dengan kriteria pintu keluar (*exit criteria*):
  - Phase 1: Environment, Manifests, & Docker Baseline
  - Phase 2: Database Schema Types, Connection Pool, & DAL (Repositories)
  - Phase 3: Security, Session, & Authentication Middleware
  - Phase 4: Core Domain Services & Background Worker
  - Phase 5: Presentation Layer (Web Controllers, Routing Table, & EJS Views)
  - Phase 6: Seeders, Accessibility Polish, & Integration Verification
* ***Proposed Edit:***
  * Location: `## Detailed Implementation Plan`
  * Change: Mengubah struktur katalog berkas menjadi 6 fase inkremental lengkap dengan kriteria kelulusan setiap fase.

---

### 5. Cacat Skrip Kompilasi Build Produksi (`tsc --noEmit`) [`egm-codebase-details`] - Severity: Blocker
* **Affected Scope:** [Lines 345, 351, 485](docs/designs/sistem_pemesanan_tiket_travel.md#L345) (package.json, Dockerfile, Verification Plan)
* **Discrepancy Description:** `npm run build` didefinisikan menjalankan `tsc --noEmit`, yang melarang emisi berkas JavaScript ke folder `dist/`. Kontainer produksi yang menjalankan `node dist/server.js` akan crash saat startup.
* **Rationale:** Transpilasi TypeScript wajib menghasilkan file `.js` pada direktori `dist/` untuk lingkungan kontainer produksi.
* ***AI Suggestion:*** PROPOSE FIX
* ***Justification:*** Ubah skrip `build` menjadi `tsc && tailwindcss -i ./public/css/input.css -o ./public/css/output.css --minify`, dan pindahkan opsi `--noEmit` ke skrip `typecheck`.
* ***Proposed Edit:***
  * Location: Rincian `package.json`, `Dockerfile`, dan `Verification Plan`
  * Change: Memperbaiki perintah skrip build TypeScript dan Tailwind.

---

### 6. Kontrak Routing HTTP Bersifat Wildcard dan Kontradiksi Path [`egm-implementation-readiness`, `egm-comprehension`] - Severity: Blocker
* **Affected Scope:** [Lines 427–440](docs/designs/sistem_pemesanan_tiket_travel.md#L427-L440) (`src/routes/`)
* **Discrepancy Description:** Deklarasi routing hanya dirangkum dengan wildcard (`/admin/*`, `/operator/*`, `/member/*`), dan terdapat inkonsistensi rute checkout antara diagram (`/booking/:id/checkout`) dan NFR (`/booking/checkout`).
* **Rationale:** Menghilangkan kebingungan implementer dan menetapkan kontrak antarmuka HTTP yang jelas.
* ***AI Suggestion:*** PROPOSE FIX
* ***Justification:*** Buat tabel routing HTTP komprehensif yang memetakan seluruh Method HTTP, URL Path, Controller Method, Middleware, dan Status Akses untuk seluruh aktor (Publik, Member, Operator, Admin).
* ***Proposed Edit:***
  * Location: `src/routes/` pada Detailed Implementation Plan
  * Change: Menyajikan tabel pemetaan rute HTTP lengkap untuk seluruh use case sistem.

---

### 7. Kerentanan Akses Publik Berkas Bukti Pembayaran [`egm-design`, `egm-zoom-out`] - Severity: Major
* **Affected Scope:** [Lines 108, 118–119, 319–324](docs/designs/sistem_pemesanan_tiket_travel.md#L108) (Component Architecture, Keamanan)
* **Discrepancy Description:** Berkas bukti transfer disimpan di `./public/uploads` dan dilayani statis secara publik tanpa autentikasi, mengekspos data perbankan sensitif pengguna.
* **Rationale:** Data transfer perbankan merupakan informasi pribadi yang hanya boleh diakses oleh operator loket dan admin.
* ***AI Suggestion:*** PROPOSE FIX
* ***Justification:*** Pindahkan direktori penyimpanan ke `./storage/uploads/` (di luar public web root) dan layani pengunduhan/pratinjau hanya melalui endpoint berotentikasi operator `GET /operator/pembayaran/:id/bukti` via `res.sendFile()`.
* ***Proposed Edit:***
  * Location: Arsitektur Komponen, Middleware Upload, dan Controller Operator
  * Change: Mengubah path unggahan ke folder privat dan menambahkan route proteksi bukti transfer.

---

### 8. Kelalaian Dependensi Kritis pada `package.json` [`egm-codebase-details`, `egm-implementation-readiness`, `egm-comprehension`] - Severity: Major
* **Affected Scope:** [Lines 344–345](docs/designs/sistem_pemesanan_tiket_travel.md#L344-L345) (`package.json`)
* **Discrepancy Description:** Manifest melewatkan `csrf-csrf`, `connect-flash`, `typescript`, `@types/*`, `tsx`, `tailwindcss`, dan dependensi test runner.
* **Rationale:** Seluruh modul yang diimpor pada kode TypeScript harus terdaftar pada `package.json`.
* ***AI Suggestion:*** PROPOSE FIX
* ***Justification:*** Cantumkan seluruh daftar dependensi runtime dan pembangunan (*devDependencies*) secara lengkap dan teruji kompatibilitasnya.
* ***Proposed Edit:***
  * Location: Rincian `package.json`
  * Change: Melengkapi daftar pustaka produksi dan dependensi pengembangan.

---

### 9. Dockerfile Multi-Stage Lupa Menyalin Berkas `views/` dan `public/` [`egm-codebase-details`] - Severity: Major
* **Affected Scope:** [Lines 350–351](docs/designs/sistem_pemesanan_tiket_travel.md#L350-L351) (`Dockerfile`)
* **Discrepancy Description:** Stage 2 runner kontainer Docker hanya menyalin artefak kompilasi JS `dist/`, tanpa menyalin template tampilan EJS (`views/`) dan aset klien (`public/`).
* **Rationale:** Express memerlukan direktori `views/` saat runtime untuk merender tampilan antarmuka SSR.
* ***AI Suggestion:*** PROPOSE FIX
* ***Justification:*** Tambahkan instruksi `COPY --from=builder /app/views ./views` dan `COPY --from=builder /app/public ./public` pada Stage 2 Dockerfile.
* ***Proposed Edit:***
  * Location: Rincian `Dockerfile`
  * Change: Menambahkan perintah penyalinan template EJS dan aset statis ke kontainer produksi.

---

### 10. Kueri Target & Interval Background Expiry Worker [`egm-zoom-out`, `egm-design`, `egm-codebase-details`, `egm-implementation-readiness`] - Severity: Major
* **Affected Scope:** [Lines 76–80, 101, 238, 394–395, 412–413](docs/designs/sistem_pemesanan_tiket_travel.md#L76-L80) (CUJ 4, jadwal.repository.ts, expiry.worker.ts)
* **Discrepancy Description:** Prosedur `sp_kedaluwarsa_jadwal` membutuhkan parameter ID tunggal. Rencana belum mendefinisikan query SQL untuk mencari jadwal mana yang memiliki pesanan kedaluwarsa, dan interval 60s memicu kontensi lock `FOR UPDATE` yang tinggi.
* **Rationale:** Menghindari polling buta ke seluruh jadwal dan memanfaatkan pembersihan lazy native database.
* ***AI Suggestion:*** PROPOSE FIX
* ***Justification:***
  1. Tegaskan bahwa `sp_buat_pemesanan` sudah membersihkan kursi kedaluwarsa secara otomatis/lazy saat ada booking baru.
  2. Tambahkan metode `findSchedulesWithExpiredHolds()` di `jadwal.repository.ts` (`SELECT DISTINCT id_jadwal FROM pemesanan WHERE status = 'menunggu_pembayaran' AND jatuh_tempo <= NOW()`).
  3. Ubah interval worker background menjadi 5 menit untuk efisiensi beban kontainer.
* ***Proposed Edit:***
  * Location: CUJ 4, `jadwal.repository.ts`, dan `expiry.worker.ts`
  * Change: Menambahkan query discovery dan mengoptimalkan siklus kerja worker.

---

### 11. Spesifikasi Cetak Tiket: Browser-Native Print (`@media print`) vs Server PDF Engine [`egm-zoom-out`, `egm-comprehension`] - Severity: Major
* **Affected Scope:** [Lines 35, 69, 75, 344–345](docs/designs/sistem_pemesanan_tiket_travel.md#L35) (Goals, CUJ 2 & 3, package.json)
* **Discrepancy Description:** Dokumen menyebutkan "cetak E-Tiket PDF" tanpa menyertakan pustaka PDF atau endpoint generator biner server-side.
* **Rationale:** Memasang Puppeteer/Chromium di Docker menambah >400MB ukuran kontainer dan membebani RAM server; solusi browser-native jauh lebih ringan dan natural bagi loket.
* ***AI Suggestion:*** PROPOSE FIX
* ***Justification:*** Tegaskan penggunaan **Browser-Native Printing (`@media print`)** pada tampilan EJS `/pesanan/:kode/cetak` dengan tombol pemicu `window.print()`, yang kompatibel untuk kertas thermal loket 80mm maupun kertas dokumen A4.
* ***Proposed Edit:***
  * Location: Goals, CUJ 2, CUJ 3, dan daftar Views
  * Change: Menegaskan pendekatan pencetakan berbasis CSS `@media print` dan menghapus referensi generator PDF server-side.

---

### 12. Rekonstruksi Alternative D Menjadi Analisis Trade-Off Arsitektural Substantif [`egm-design`, `egm-structural`, `egm-zoom-out`] - Severity: Major
* **Affected Scope:** [Lines 299–307](docs/designs/sistem_pemesanan_tiket_travel.md#L299-L307) (`Alternatives Considered - Alternative D`)
* **Discrepancy Description:** Alternative D saat ini memperdebatkan preferensi token warna CSS dan teori medis mata (*snow blindness*, astigmatisme), yang bukan merupakan alternatif arsitektur perangkat lunak.
* **Rationale:** Menyelaraskan dokumen dengan *Feature Specification Standard* (The Alternatives Rule).
* ***AI Suggestion:*** PROPOSE FIX
* ***Justification:*** Ganti Alternative D dengan komparasi arsitektural: *Pembangkitan Tiket: Server-Side PDF Engine (Puppeteer/PDFKit) vs. Client-Side Browser Native Print (`@media print`)*, lengkap dengan tabel komparasi 4 alternatif arsitektur.
* ***Proposed Edit:***
  * Location: `## Alternatives Considered`
  * Change: Mengganti teks Alternative D dan menambahkan tabel rangkuman komparatif seluruh alternatif.

---

### 13. Kelengkapan Tipe Database pada `db.types.ts` dan Operasi Mutasi Admin [`egm-codebase-details`, `egm-implementation-readiness`] - Severity: Major
* **Affected Scope:** [Lines 362–363, 387–402, 424–425](docs/designs/sistem_pemesanan_tiket_travel.md#L362-L363) (db.types.ts, Repositories, admin.controller.ts)
* **Discrepancy Description:** Tipe database melewatkan 5 tabel relasional (`kursi_kendaraan`, `rute`, `jadwal_kursi`, `detail_pemesanan`, `arsip_migrasi`), dan repositori admin belum menyertakan metode mutasi CRUD untuk armada/rute/jadwal dan tanggapan keluhan.
* **Rationale:** Memastikan layer akses data mencakup seluruh operasi manajemen data master dan relasi transaksi secara lengkap.
* ***AI Suggestion:*** PROPOSE FIX
* ***Justification:*** Definisikan tipe untuk seluruh 12 tabel skema dan tambahkan metode mutasi eksplisit pada `rute.repository.ts`, `kendaraan.repository.ts`, `jadwal.repository.ts`, dan `keluhan.repository.ts` (`respondToComplaint`).
* ***Proposed Edit:***
  * Location: `src/types/db.types.ts` dan `src/repositories/`
  * Change: Melengkapi deklarasi antarmuka tabel dan metode mutasi repository.

---

### 14. Pola Username Bebas Tabrakan untuk On-The-Fly Member Provisioning [`egm-comprehension`, `egm-design`, `egm-zoom-out`] - Severity: Major
* **Affected Scope:** [Lines 52–53, 74, 407](docs/designs/sistem_pemesanan_tiket_travel.md#L52-L53) (Open Questions, booking.service.ts)
* **Discrepancy Description:** Aturan pembuatan akun walk-in otomatis di loket belum merinci strategi pembuatan username unik dan penanganan nomor telepon yang telah terdaftar sebelumnya.
* **Rationale:** Mencegah error duplikasi database (`ER_DUP_ENTRY`) pada tabel `users`.
* ***AI Suggestion:*** PROPOSE FIX
* ***Justification:*** Definisikan algoritma: cari akun member aktif berdasarkan nomor telepon terlebih dahulu; jika ditemukan gunakan akun tersebut; jika belum ada, buat entri member baru dengan `username = walkin_${telepon}` (ditambah 4 karakter acak jika terjadi benturan username), `role = 'member'`, `wajib_reset_password = 1`, `password_hash = NULL`.
* ***Proposed Edit:***
  * Location: Open Questions dan `booking.service.ts`
  * Change: Menuliskan algoritma resolusi penumpang walk-in secara spesifik.

---

### 15. Deviasi Penamaan Heading Blueprint Standar [`egm-structural`] - Severity: Major
* **Affected Scope:** [Lines 15, 84](docs/designs/sistem_pemesanan_tiket_travel.md#L15) (The Problem, Technical Plan)
* **Discrepancy Description:** Judul bagian menyimpang dari blueprint baku *Feature Specification Standard*.
* **Rationale:** Memenuhi keselarasan template baku EGM.
* ***AI Suggestion:*** PROPOSE FIX
* ***Justification:*** Ubah `## The Problem` menjadi `## Problem Statement`, dan `## Technical Plan (Architecture)` menjadi `## Proposed Architecture`.
* ***Proposed Edit:***
  * Location: Baris 15 dan Baris 84
  * Change: Mengganti judul heading sesuai standar blueprint.

---

### 16. Penghapusan Flag `DEMO_SHOW_ALL_SCHEDULES=true` [`egm-zoom-out`] - Severity: Major
* **Affected Scope:** [Lines 54–55, 236](docs/designs/sistem_pemesanan_tiket_travel.md#L54-L55) (Open Questions, jadwal.repository.ts)
* **Discrepancy Description:** Menampilkan jadwal 2017 pada katalog web memicu error `SQLSTATE 45000` saat user mencoba memesan karena prosedur database menolak jadwal yang waktu keberangkatannya telah lewat.
* **Rationale:** Mencegah dead-end fungsional pada demo aplikasi.
* ***AI Suggestion:*** PROPOSE FIX
* ***Justification:*** Hapus flag `DEMO_SHOW_ALL_SCHEDULES=true` dan andalkan skrip seeder `src/scripts/seedDemoSchedules.ts` untuk menyediakan jadwal mendatang aktif bagi pengujian lokal.
* ***Proposed Edit:***
  * Location: Baris 54–55 dan Bagian Repositori
  * Change: Menghapus referensi toggle jadwal historis dan mengukuhkan peran seeder demo.

---

### 17. Standardisasi Pemformatan, Gaya Bahasa Teknis, dan Konsistensi Metadata [`egm-style`, `egm-structural`] - Severity: Nit
* **Affected Scope:** Berbagai baris pada dokumen
* **Discrepancy Description:** Misnomer enkripsi UUID, kata fluff (*Penuh, resmi, ramah pengguna*), pemisah horizontal non-standar (`------...`), inkonsistensi jumlah tampilan operator (tertulis 4 halaman padahal ada 5 berkas), dan tag boilerplate AI (`*Drafted with EGM*`).
* **Rationale:** Menjaga kepatuhan teknis, presisi bahasa, dan estetika dokumen rekayasa perangkat lunak profesional.
* ***AI Suggestion:*** PROPOSE FIX
* ***Justification:*** Bersihkan terminologi, samakan seluruh pemisah menjadi `---`, seragamkan bullet point asteris, koreksi jumlah template operator menjadi 5 halaman, dan hapus footer boilerplate AI.
* ***Proposed Edit:***
  * Location: Seluruh bagian dokumen terkait
  * Change: Menjalankan pembersihan editorial menyeluruh.

