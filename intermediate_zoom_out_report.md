# Intermediate Zoom Out Review Report (Stage 8)

**Target Document**: `docs/designs/sistem_pemesanan_tiket_travel.md`  
**Auditor**: `egm-zoom-out` (Skeptical Architect Persona)  
**Standard**: `resources/document_standards/zoom-out-standard.md`  
**Scope**: Full Document (lines 1 to 508)  
**Date**: 2026-10-30  

---

## Executive Summary

Audit *Stage 8: Intermediate Zoom Out Review* mengevaluasi stabilitas dan minimalisme arsitektur secara menyeluruh setelah temuan dari Stage 5 (*Initial Zoom Out*), Stage 6 (*Comprehension*), dan Stage 7 (*Critic Review*). Fokus utama audit ini adalah bertindak sebagai benteng penyederhanaan:
1. **Mencegah Over-Engineering & Bloat**: Memastikan rekomendasi perbaikan dari tahap sebelumnya tidak memicu penambahan dependensi npm berat (seperti Puppeteer, Chromium, pustaka deep MIME sniffing, atau gateway OTP/SMTP eksternal).
2. **Menjaga Koherensi Arsitektur Monolit**: Menolak kompleksitas sistem terdistribusi, background worker polling agresif, atau modifikasi skema ad-hoc, demi menjaga arsitektur tetap berupa Express + TypeScript SSR monolith yang ringan dan terisolasi rapi di Docker.
3. **High-Altitude Sanity Check**: Menetapkan solusi paling sederhana, elegan, dan minim kode (*least-code, highest-leverage*) untuk menyelesaikan blocker transaksi tunai loket dan keamanan akun warisan.

Total temuan: **7 Temuan**
* 🔴 **Blocker**: 1 temuan
* 🟡 **Major**: 4 temuan
* 🟢 **Nit**: 2 temuan

---

## Prioritized Findings

### 🔴 Finding 1: Disconnect Between Walk-In Cash Settlement and Stored Procedure Exclusivity
* **Severity**: Blocker
* **Affected Scope**: Section "Goals" (line 35), "CUJ 3" (lines 71–75), "Technical Plan - 3. Integrasi Skema Database" (lines 231–234), "Alternatives Considered - Alternative C" (lines 289–296).
* **Simplicity Rationale**:
  Dokumen menetapkan aturan arsitektural mutlak bahwa seluruh alur transaksi diisolasi menggunakan *stored procedures* bawaan database dan menolak transaksi manual di layer aplikasi. Namun, pada CUJ 3 (Pemesanan Walk-in), operator memproses pembayaran tunai dan langsung menerbitkan tiket lunas.
  Di dalam `db_tiket.sql`, **tidak ada stored procedure untuk pembayaran tunai**. Prosedur `sp_ajukan_pembayaran` secara kaku memvalidasi transfer manual (`referensi`, `no_rek_pengirim`, dan `bukti_pembayaran` wajib diisi string non-kosong). Komentar resmi database bahkan menyatakan: `-- Manual transfer submission. Cash/gateway integrations need separate verified flows.`
  * **Risiko Over-Engineering**: Mencoba mengakali ketiadaan SP tunai dengan memalsukan data (membuat string resi dummy, nomor rekening palsu, dan berkas gambar struk kosong) agar bisa memanggil `sp_ajukan_pembayaran` lalu disambung `sp_verifikasi_pembayaran`. Ini mencemari integritas audit database dan menghasilkan berkas sampah di disk.
  * **Solusi Arsitektur Paling Sederhana**:
    Skema tabel `pembayaran` pada `db_tiket.sql` (baris 146–150) sudah secara native menyediakan `metode ENUM('transfer_manual','gateway','tunai')` dengan kolom referensi/bukti yang *nullable*.
    Definisikan satu metode terisolasi di `pembayaran.repository.ts` (`processCashPayment`) yang mengeksekusi transaksi ACID native dengan urutan penguncian ketat sesuai standar `db_tiket.sql` (`jadwal -> pemesanan -> pembayaran / jadwal_kursi`):
    1. Kunci jadwal & pemesanan (`FOR UPDATE`).
    2. `INSERT INTO pembayaran (id_pemesanan, metode, nominal, status, diverifikasi_oleh, diverifikasi_pada)` dengan `metode = 'tunai'` dan `status = 'diterima'`.
    3. `UPDATE jadwal_kursi SET status = 'terjual', ditahan_sampai = NULL`.
    4. `UPDATE pemesanan SET status = 'lunas', jatuh_tempo = NULL`.
    Dokumen harus merevisi klaim kaku "100% via stored procedure" menjadi "seluruh reservasi dan transfer manual melalui stored procedure, sedangkan pelunasan tunai loket diisolasi dalam transaksi terkontrol di repository sesuai urutan lock resmi database".

---

### 🟡 Finding 2: YAGNI: Speculative Server-Side PDF Engines vs. Browser-Native Print Styles
* **Severity**: Major
* **Affected Scope**: Section "Goals" (line 35), "CUJ 2" (line 69), "CUJ 3" (line 75), "Detailed Implementation Plan - package.json" (lines 344–345).
* **Simplicity Rationale**:
  Dokumen menyebutkan "E-Tiket PDF langsung dapat dicetak" dan "mencetak tiket fisik secara instan", tetapi tidak mendefinisikan mekanisme pembangkitan berkas PDF tersebut.
  * **Risiko Over-Engineering**: Menambahkan pustaka headless browser seperti Puppeteer/Chromium ke dalam kontainer Docker akan melipatgandakan ukuran image dari ~75MB menjadi >500MB, melipatgandakan konsumsi RAM dari ~50MB menjadi >300MB (melanggar NFR Performance baris 326), dan menimbulkan risiko crash subprocess. Menggunakan `pdfkit` pun menambah ratusan baris kode koordinat layout kanvas biner yang sulit dipelihara.
  * **Solusi Arsitektur Paling Sederhana**:
    Gunakan **Browser-Native Printing (`@media print`)**. Sediakan rute tampilan EJS `/pesanan/:kode/cetak` dengan stylesheet cetak responsif standar (disesuaikan untuk kertas thermal loket 80mm maupun kertas A4) dan tombol aksi yang memicu `window.print()`.
    Solusi ini memiliki **nol dependensi npm tambahan**, nol overhead memori/CPU server, dan memberikan pengalaman cetak langsung yang natural bagi operator loket maupun pelanggan. Dokumen harus menegaskan pendekatan ini dan mencoret referensi generator biner PDF server-side.

---

### 🟡 Finding 3: Preventing Auth Challenge Over-Engineering for Legacy Cold-Start Accounts
* **Severity**: Major
* **Affected Scope**: Section "The Problem #3" (lines 20–21), "Business Logic Layer - auth.service.ts" (line 405), "Presentation Controllers - views/public/activate.ejs" (lines 417, 446).
* **Simplicity Rationale**:
  Audit Critic (Stage 7) mengangkat risiko pembajakan akun warisan (*legacy accounts*) pada formulir `/auth/activate` karena akun lama memiliki `password_hash = NULL` dan `wajib_reset_password = 1`.
  * **Risiko Over-Engineering**: Memperbaiki celah ini dengan mengintegrasikan server email SMTP (Nodemailer, template email, background queue) atau SMS/WhatsApp OTP gateway (yang sudah tegas dinyatakan sebagai *Non-Goals* pada baris 44).
  * **Solusi Arsitektur Paling Sederhana**:
    Terapkan verifikasi kepemilikan akun langsung berbasis data profil yang ada di tabel `users`.
    Formulir `/auth/activate` mewajibkan input: `username`, `nomor telepon` atau `email` terdaftar, serta `password baru`.
    Backend memvalidasi dengan satu kueri SQL terindeks:
    ```sql
    SELECT id FROM users 
    WHERE username = ? AND (telepon = ? OR email = ?) 
      AND wajib_reset_password = 1 AND password_hash IS NULL;
    ```
    Jika cocok, backend langsung mengupdate `password_hash` via Bcrypt dan mengeset `wajib_reset_password = 0`. Ini menutup celah pengambilalihan akun secara instan tanpa menambah satu baris pun dependensi eksternal atau tabel baru.

---

### 🟡 Finding 4: Aggressive Polling Worker vs. Native Lazy DB Cleanup & Lock Contention
* **Severity**: Major
* **Affected Scope**: Section "CUJ 4" (lines 76–80), "Component Architecture" (lines 101, 106), "Business Logic Layer - expiry.worker.ts" (lines 412–413).
* **Simplicity Rationale**:
  Desain mengusulkan background timer worker (`setInterval` setiap 60 detik) yang memanggil `sp_kedaluwarsa_jadwal` untuk seluruh jadwal aktif.
  * **Risiko Over-Engineering & Kontensi Lock**: Prosedur `sp_kedaluwarsa_jadwal` melakukan penguncian row `SELECT id FROM jadwal WHERE id = ? FOR UPDATE`. Melakukan polling konstan setiap 60 detik terhadap semua jadwal aktif di background akan bertabrakan langsung dengan transaksi reservasi member (`sp_buat_pemesanan`) yang juga membutuhkan lock eksklusif pada baris jadwal yang sama.
  * **Solusi Arsitektur Paling Sederhana**:
    Perhatikan bahwa di dalam `db_tiket.sql` (baris 395), prosedur `sp_buat_pemesanan` **sudah memanggil `internal_kedaluwarsa_jadwal(p_jadwal)` secara native dan lazy** tepat sebelum kursi divalidasi. Artinya, sistem database sudah memiliki proteksi atomik: kursi yang batas tahannya habis akan otomatis dibebaskan saat ada pengguna lain yang ingin memesan jadwal tersebut.
    Jika pembersihan berkala tetap diinginkan agar katalog tampilan web tidak menampilkan label "ditahan" yang kedaluwarsa:
    1. Panggil pembersihan secara on-demand saat membaca denah ketersediaan kursi (`getScheduleSeats`), ATAU
    2. Batasi worker background pada interval yang lebih rileks (misal 5 menit) dan kueri target yang spesifik: hanya jadwal keberangkatan 24 jam ke depan yang memiliki pesanan berstatus `menunggu_pembayaran` dengan `jatuh_tempo <= NOW()`. Jangan jalankan loop polling buta ke semua jadwal.

---

### 🟡 Finding 5: Altitude Drop: Debat Kosmetik Medis-Okular pada "Alternatives Considered"
* **Severity**: Major
* **Affected Scope**: Section "Alternatives Considered - Alternative D" (lines 299–307).
* **Simplicity Rationale**:
  Bagian Alternative D membahas secara panjang lebar perdebatan kosmetik: *Pure Black OLED (#000000) vs Nordic Slate*, efek pendaran berbayang (*halation*), astigmatisme, dan *snow blindness*.
  * **Altitude Drop & Fluff**: Pemilihan token warna dan palet tema adalah keputusan styling CSS, bukan alternatif arsitektur perangkat lunak tingkat tinggi. Memasukkan teori medis mata ke dalam dokumen blueprint arsitektur mengaburkan fokus tinjauan sistemik.
  * **Solusi Arsitektur Paling Sederhana**:
    Ganti Alternative D dengan komparasi trade-off arsitektur substantif yang nyata dan berdampak langsung pada kesederhanaan sistem:
    *Pembangkitan Tiket: Server-Side PDF Engine (Puppeteer/PDFKit) vs. Client-Side Browser Native Print (`@media print`)*.
    Ini mengembalikan standar dokumen ke tingkat abstraksi arsitektur rekayasa perangkat lunak yang matang.

---

### 🟢 Finding 6: Private File Serving Without Bloated Object Storage or Deep MIME Sniffing
* **Severity**: Nit
* **Affected Scope**: Section "Component Architecture" (line 108), "Keamanan & Proteksi Data" (lines 319–324).
* **Simplicity Rationale**:
  Audit Critic merekomendasikan pemindahan berkas bukti transfer keluar dari direktori publik (`./public/uploads`) agar tidak bisa diakses sembarang orang tanpa otentikasi.
  * **Risiko Over-Engineering**: Mengintegrasikan object storage cloud (MinIO/S3), memasang dependensi deep packet inspection biner yang berat (`file-type`), atau membuat proxy streaming berkas yang rumit.
  * **Solusi Arsitektur Paling Sederhana**:
    Cukup ubah folder tujuan Multer ke `./storage/uploads/` (di luar web root statis Express), gunakan filter ekstensi bawaan Multer (`image/jpeg`, `image/png`, `image/webp`), dan layani pengunduhan/pratinjau struk melalui satu handler controller sederhana:
    `GET /operator/pembayaran/:id/bukti` yang dilindungi `roleMiddleware('operator')` dan mengembalikan berkas via `res.sendFile(filePath)`. Sederhana, aman, dan tanpa pustaka tambahan.

---

### 🟢 Finding 7: Minimalist On-The-Fly Member Provisioning for Loket Walk-In
* **Severity**: Nit
* **Affected Scope**: Section "Open Questions - Pertanyaan 1" (lines 52–53), "Business Logic Layer - booking.service.ts" (line 407).
* **Simplicity Rationale**:
  Untuk memenuhi syarat `sp_buat_pemesanan` (`role = 'member'`), operator loket membutuhkan akun member yang diasosiasikan dengan tiket walk-in.
  * **Risiko Over-Engineering**: Membuat sistem "guest checkout" terpisah, tabel pemesanan anonim baru, atau alur verifikasi penumpang yang kompleks.
  * **Solusi Arsitektur Paling Sederhana**:
    Gunakan pola pencarian atau pembuatan akun instan berbasis nomor telepon:
    1. Cek keberadaan akun: `SELECT id FROM users WHERE telepon = ? AND role = 'member' LIMIT 1`.
    2. Jika sudah ada, gunakan ID pengguna tersebut.
    3. Jika belum ada, buat entri member baru:
       - `username`: `walkin_${telepon}` (tambahkan suffix acak 4 digit jika terjadi benturan username unik).
       - `nama`: `inputNama`
       - `telepon`: `inputTelepon`
       - `role`: `'member'`
       - `wajib_reset_password`: `1`
       - `password_hash`: `NULL` (valid berdasarkan `ck_users_password`).
    Alur ini membutuhkan kurang dari 15 baris kode di `booking.service.ts` dan 100% mematuhi seluruh batasan integritas basis data.

