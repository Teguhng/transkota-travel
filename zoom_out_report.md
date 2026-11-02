# Initial Zoom Out Review Report (Stage 5)

**Target Document**: `docs/designs/sistem_pemesanan_tiket_travel.md`  
**Auditor**: `egm-zoom-out` (Skeptical Architect Persona)  
**Standard**: `resources/document_standards/zoom-out-standard.md`  
**Scope**: Full Document (lines 1 to 508)  
**Date**: 2026-10-30  

---

## Executive Summary

Audit *Stage 5: Initial Zoom Out Review* mengevaluasi dokumen desain sistem pemesanan tiket travel dari perspektif arsitektur tingkat tinggi (*high-altitude*), prinsip YAGNI (*You Aren't Gonna Need It*), minimalisme, pemanfaatan kode dan skema yang sudah ada (*leverage existing*), dan eliminasi detail prematur (*anti-weeds*).

Total temuan: **6 Temuan**
* 🔴 **Blocker**: 1 temuan
* 🟡 **Major**: 3 temuan
* 🟢 **Nit**: 2 temuan

---

## Detailed Findings

### 🔴 Finding 1: Disconnect Between Walk-in Cash Payments and Stored Procedure Constraints
* **Severity**: Blocker
* **Affected Scope**: Section "Goals" (line 35), "CUJ 3" (lines 71–75), "Technical Plan - 3. Integrasi Skema Database" (lines 231–234), "Alternatives Considered - Alternative C" (lines 289–296).
* **Simplicity Rationale**:
  Dokumen desain menetapkan aturan arsitektural mutlak bahwa seluruh alur transaksi diisolasi menggunakan *stored procedures* transaksi ACID bawaan database tanpa merubah struktur tabel maupun data historis, secara eksplisit menolak transaksi SQL manual di layer aplikasi (Alternative C).
  Namun, pada skenario CUJ 3 (Pemesanan Walk-in Loket), dokumen menyatakan bahwa operator "langsung menandai pembayaran tunai lunas dan mencetak tiket fisik secara instan". Pada kenyataannya, di dalam `db_tiket.sql` **tidak ada stored procedure untuk pembayaran tunai**:
  1. `sp_buat_pemesanan` secara kaku menetapkan status pemesanan ke `menunggu_pembayaran` dengan batas waktu 15 menit.
  2. `sp_ajukan_pembayaran` mengunci nilai `metode = 'transfer_manual'` serta mewajibkan string non-kosong pada parameter `referensi`, `no_rek_pengirim`, dan `bukti_pembayaran` (`SIGNAL SQLSTATE '45000'`), mengubah status menjadi `menunggu_verifikasi`.
  3. `pembayaran.repository.ts` hanya menyediakan pemanggilan `sp_ajukan_pembayaran` dan `sp_verifikasi_pembayaran`.
  
  Arsitektur belum mendefinisikan bagaimana pembayaran tunai mencapai status `lunas`. Melakukan `UPDATE` langsung dari Node.js melanggar aturan isolasi stored procedure, sedangkan memanggil `sp_ajukan_pembayaran` akan terhambat validasi. Arsitektur harus mendefinisikan jembatan sintetis yang konsisten (misal: otomatis mengajukan metadata pembayaran tunai loket via operator lalu langsung memanggil `sp_verifikasi_pembayaran` dalam satu alur terisolasi) atau mengonfirmasi tata kelola transaksi tunai yang valid.

---

### 🟡 Finding 2: `DEMO_SHOW_ALL_SCHEDULES=true` is a Deceptive Symptom Patch that Breaks CUJ 1
* **Severity**: Major
* **Affected Scope**: Section "Open Questions - Pertanyaan 2" (lines 54–55) dan Section 3 "jadwal.repository.ts" (line 236).
* **Simplicity Rationale**:
  Proposal mengusulkan opsi konfigurasi `DEMO_SHOW_ALL_SCHEDULES=true` untuk menampilkan jadwal historis tahun 2017 pada katalog agar tampilan demo tidak kosong.
  Akan tetapi, di dalam `db_tiket.sql` (`sp_buat_pemesanan`, baris 387–390), MySQL memberlakukan validasi *immutable*:
  ```sql
  IF v_status IS NULL OR v_status<>'dijadwalkan' OR v_berangkat<=NOW() THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Jadwal tidak tersedia untuk pemesanan';
  END IF;
  ```
  Karena seluruh jadwal historis memiliki waktu `berangkat_pada <= NOW()`, setiap percobaan *booking* pada jadwal historis 2017 dipastikan **gagal total** dengan error SQLSTATE 45000. Menampilkan jadwal kedaluwarsa di UI katalog adalah *symptom patch* yang menimbulkan *dead-end* saat pengujian use case. Solusi arsitektural yang bersih dan definitif adalah semata-mata mengandalkan `src/scripts/seedDemoSchedules.ts` (mengisi jadwal mendatang untuk hari ini/besok). Flag `DEMO_SHOW_ALL_SCHEDULES` menambah kompleksitas percabangan dan harus dieliminasi.

---

### 🟡 Finding 3: Premature Optimization: Background Expiry Worker vs. Native Lazy DB Cleanup
* **Severity**: Major
* **Affected Scope**: Section "CUJ 4" (lines 76–80), "Component Architecture" (lines 101, 106), "Business Logic Layer" (lines 412–413).
* **Simplicity Rationale**:
  Proposal merancang *background timer worker* terpisah (`src/services/expiry.worker.ts`) yang mengeksekusi `CALL sp_kedaluwarsa_jadwal(jadwal_id)` setiap 60 detik untuk seluruh jadwal aktif.
  Komponen ini merupakan *premature optimization* yang berlebih. Di dalam `db_tiket.sql`, prosedur `sp_buat_pemesanan` **sudah secara otomatis memanggil `CALL internal_kedaluwarsa_jadwal(p_jadwal)` secara native pada baris 395** tepat sebelum validasi ketersediaan kursi dilakukan. Kursi yang masa tahannya lewat otomatis dilepaskan secara on-demand saat ada user yang hendak memesan.
  Menjalankan loop polling `setInterval` di aplikasi menambah beban siklus hidup proses dan memicu potensi *lock contention* yang tidak perlu (`sp_kedaluwarsa_jadwal` melakukan `SELECT id ... FOR UPDATE`). Pelepasan kursi kedaluwarsa cukup dieksekusi secara *lazy* saat kueri ketersediaan/pemesanan dilakukan.

---

### 🟡 Finding 4: Under-Specified On-The-Fly Member Provisioning & Username Constraints
* **Severity**: Major
* **Affected Scope**: Section "Open Questions - Pertanyaan 1" (lines 52–53) dan "Business Logic Layer" (line 407).
* **Simplicity Rationale**:
  Untuk memenuhi syarat `sp_buat_pemesanan` (`role = 'member'`), desain mengusulkan pembuatan akun otomatis (*instant provisioning*) bagi penumpang walk-in di loket dengan modal Nama dan Nomor Telepon.
  Namun, skema tabel `users` pada `db_tiket.sql` (baris 9–28) menetapkan:
  - `username VARCHAR(100) NOT NULL UNIQUE`
  - `telepon VARCHAR(30) NULL` (non-unik)
  - `CONSTRAINT ck_users_password CHECK (wajib_reset_password = 1 OR password_hash IS NOT NULL)`
  
  Desain belum merinci strategi pembuatan `username` yang tahan tabrakan (*collision-safe*, misal jika beberapa walk-in memiliki nama sama atau nomor HP sama), serta belum menentukan apakah nomor HP yang sama akan menggunakan kembali akun yang ada atau membuat entri baru. Kontrak antarmuka fungsi *walk-in member provisioning* harus didefinisikan secara presisi.

---

### 🟢 Finding 5: Altitude Drop & Weeds: UI Gimmicks and Ocular Science Bike-Shedding
* **Severity**: Nit
* **Affected Scope**: Section "Goals" (line 34), "CUJ 2" (line 68), "Alternatives Considered - Alternative D" (lines 299–307), "Antarmuka Tampilan & Berkas Publik" (lines 450, 458–459).
* **Simplicity Rationale**:
  Dokumen desain kehilangan fokus ketinggian arsitektur (*altitude drop*) dengan membahas detail *widget* klien yang minor:
  1. Bagian alternatif desain (Alternative D) terlalu panjang memperdebatkan fenomena medis okular (*halation*, astigmatisme, *snow blindness*, perbandingan `#000000` vs `Slate-950`). Hal ini semestinya berada pada spesifikasi token desain CSS atau panduan gaya, bukan dokumen arsitektur teknis.
  2. Pembahasan fitur rotasi dan zoom gambar struk (`image-preview.js`) diangkat berulang kali di diagram arsitektur hingga daftar controller.
  3. Penargetan standar **WCAG 2.1 AAA** tergolong *over-specification* untuk tugas kuliah travel (standar industri adalah WCAG 2.1 AA, sedangkan AAA mewajibkan kontras ekstrem dan terjemahan bahasa isyarat). Fokus arsitektur tingkat tinggi seharusnya berada pada batasan transaksi, alur data, dan konkurensi.

---

### 🟢 Finding 6: Schema Assumption Regarding Session Storage
* **Severity**: Nit
* **Affected Scope**: Section "Component Architecture" (line 107), "Non-Functional Requirements - Security" (line 314), "src/config/session.ts" (line 373).
* **Simplicity Rationale**:
  Dokumen menetapkan penggunaan `express-mysql-session` yang menyimpan data sesi ke tabel `sessions`, sementara klaim awal menyatakan bahwa sistem berjalan murni tanpa mengubah struktur tabel database (`db_tiket.sql`).
  Secara *default*, `express-mysql-session` akan membuat tabel baru `sessions` jika belum tersedia (`CREATE TABLE IF NOT EXISTS`). Dokumen perlu memperjelas apakah tabel `sessions` diperbolehkan sebagai tabel utilitas infrastruktur terpisah di luar skema bisnis, atau lebih baik menggunakan *signed/encrypted cookie session* (karena aplikasi ini berjalan sebagai single-instance kontainer) sehingga database MySQL benar-benar bersih 100% tanpa modifikasi skema sama sekali.

