# Critic Review Report (Stage 7)

**Target Document**: `docs/designs/sistem_pemesanan_tiket_travel.md`  
**Auditors Swarm**:
* `egm-design` (Hostile Design Critic)
* `egm-structural` (Structural Layout Validator)
* `egm-style` (Technical Copy Editor)  
**Standard**: `resources/document_standards/feature-spec-standard.md`  
**Scope**: `FeatureRange` (lines 1 to 336)  
**Date**: 2026-10-30  

---

## Executive Summary

Audit *Stage 7: Critic Review* melakukan pengujian antagonistik mendalam terhadap spesifikasi fitur (`FeatureRange`, baris 1–336) menggunakan tiga lensa spesialis: arsitektur sistem & mitigasi risiko (`egm-design`), kepatuhan struktur & hierarki dokumen (`egm-structural`), serta ketepatan gaya bahasa teknis & objektivitas (`egm-style`).

Total temuan terkonsolidasi: **21 Temuan**
* 🔴 **Blocker**: 3 temuan (Arsitektur pembayaran tunai loket, Vektor pembajakan akun cold-start, Ketiadaan bagian wajib *Risks & Mitigations*)
* 🟡 **Major**: 8 temuan (Penyimpanan struk publik, Unbounded queue, Expiry worker locking, Alternatif UI kosmetik, Standar penamaan header, Misnomer UUID enkripsi, Klaim hiperbola visual, Framing informal)
* 🟢 **Nit**: 10 temuan (Struktur tabel alternatif, Tabrakan username walk-in, Sintaks markdown inkonsisten, Jargon/fluff, dsb.)

---

## Prioritized Consolidated Findings

### 🔴 Blocker Findings

#### 1. Ketiadaan Bagian Wajib "Risks & Mitigations" pada Blueprint
* **Reviewer Lens**: `egm-structural`, `egm-design`
* **Affected Scope**: Baris 309–335 (antara Alternatives Considered dan Detailed Implementation Plan)
* **Discrepancy Description**: *Feature Specification Standard* secara eksplisit mewajibkan bagian mandatori **Risks & Limits / Risks & Mitigations** yang mengidentifikasi potensi kegagalan sistem (*failure modes*), implikasi keamanan, limit skalabilitas, dan mitigasinya. Dokumen saat ini hanya mencantumkan *Non-Functional Requirements* operasional umum tanpa matriks mitigasi risiko yang terstruktur.
* **Recommendation**: Tambahkan bagian H2 `## Risks & Mitigations` yang merinci secara sistematis matriks mitigasi untuk:
  1. Kontensi row lock dan deadlock transaksi konkuren.
  2. Kegagalan worker kedaluwarsa kursi dan rollback.
  3. Penumpukan berkas unggahan bukti transfer yatim (*orphaned files*).
  4. Risiko pembajakan akun pada alur aktivasi password legacy.

#### 2. Ketiadaan Kontrak Prosedur Database untuk Pembayaran Tunai Loket (CUJ 3)
* **Reviewer Lens**: `egm-design`
* **Affected Scope**: CUJ 3 (baris 71–75), Goals (baris 35), dan Integrasi Skema Database (baris 223–245)
* **Discrepancy Description**: CUJ 3 menyatakan operator loket dapat memproses penumpang walk-in dan langsung menerbitkan tiket lunas tunai. Sementara itu, dokumen mewajibkan seluruh transaksi diisolasi mutlak via *stored procedures* database. Namun, di dalam `db_tiket.sql` **tidak ada stored procedure untuk pembayaran tunai**. Prosedur `sp_ajukan_pembayaran` memaksakan transfer bank manual dengan bukti transfer dan nomor rekening pengirim. Melakukan direct SQL update di layer aplikasi melanggar aturan isolasi arsitektur, sedangkan memalsukan data ke `sp_ajukan_pembayaran` mencemari data audit.
* **Recommendation**: Definisikan mekanisme transaksi tunai yang valid dan aman:
  - Tentukan transaksi terisolasi di layer `pembayaran.repository.ts` yang mencatat pembayaran dengan `metode = 'tunai'`, status `diterima`, dan mengupdate status pemesanan menjadi `lunas` serta kursi menjadi `terjual` (`ditahan_sampai = NULL`) mengikuti urutan lock strict (`jadwal -> pemesanan -> pembayaran / jadwal_kursi`), ATAU sediakan jembatan prosedur terverifikasi.

#### 3. Vektor Pembajakan Akun pada Alur Reset Password Akun Warisan (Cold-Start)
* **Reviewer Lens**: `egm-design`
* **Affected Scope**: The Problem (baris 20), Integrasi Skema Database (baris 240–244)
* **Discrepancy Description**: Seluruh akun warisan 2017 memiliki `password_hash = NULL` dan `wajib_reset_password = 1`. Dokumen mengecualikan gateway SMS/WhatsApp (Non-Goals, baris 44). Namun, dokumen tidak merinci bagaimana seorang pengguna membuktikan kepemilikan akun pada `/auth/activate`. Tanpa faktor pembuktian identitas (misal: pencocokan kombinasi username + no. telepon / email terdaftar), siapa pun yang mengetahui username legacy dapat mengambil alih akun secara sepihak.
* **Recommendation**: Tetapkan kontrak pembuktian identitas pada form `/auth/activate`: mewajibkan input `username` dan verifikasi nomor telepon/email yang cocok dengan database sebelum mengizinkan setelan password baru.

---

### 🟡 Major Findings

#### 4. Kerentanan Akses Publik Berkas Bukti Pembayaran & Validasi MIME Lemah
* **Reviewer Lens**: `egm-design`
* **Affected Scope**: Component Architecture (baris 108, 118–119), Keamanan (baris 319–324)
* **Discrepancy Description**: Bukti transfer disimpan di `./public/uploads` yang dilayani secara publik via `express.static('public')`. Pengguna manapun yang menebak nama berkas dapat melihat struk transfer sensitif berisi nama lengkap, nomor rekening, dan nominal transfer. Selain itu, validasi MIME multer hanya membaca header client tanpa memeriksa *magic bytes* berkas.
* **Recommendation**: Pindahkan folder unggahan ke direktori privat di luar web root (misalnya `./storage/uploads/`), dan layani akses bukti transfer hanya melalui rute berotentikasi operator (`/operator/pembayaran/:id/bukti`) dengan header `Content-Disposition: inline` dan `X-Content-Type-Options: nosniff`, serta validasi signature berkas via pustaka file-type.

#### 5. Unbounded Queue Limit pada Pool Koneksi Database
* **Reviewer Lens**: `egm-design`
* **Affected Scope**: Non-Functional Requirements - Performance (baris 326–329)
* **Discrepancy Description**: Konfigurasi `queueLimit: 0` memungkinkan antrean request di memori Node.js bertambah tanpa batas saat terjadi lonjakan request transaksi konkuren yang mengalami lock-wait di MySQL. Hal ini dapat memicu keterlambatan event loop dan crash Out-Of-Memory (OOM).
* **Recommendation**: Tetapkan batas antrean eksplisit (misal: `queueLimit: 100`) dengan timeout koneksi terdefinisi, serta kembalikan respon *fail-fast* (HTTP 503 / 429) ketika antrean penuh.

#### 6. Spesifikasi Kueri Expiry Worker & Potensi Lock Contention
* **Reviewer Lens**: `egm-design`
* **Affected Scope**: CUJ 4 (baris 76–80), Component Architecture (baris 101), `jadwal.repository.ts` (baris 238)
* **Discrepancy Description**: Prosedur `sp_kedaluwarsa_jadwal` membutuhkan parameter spesifik `jadwal_id`. Spesifikasi belum mendefinisikan kueri discovery untuk mencari jadwal mana saja yang memiliki pesanan kedaluwarsa. Jika worker mengeksekusi prosedur untuk seluruh jadwal aktif pada interval pendek, akan terjadi kontensi lock `FOR UPDATE` yang bertabrakan dengan transaksi pemesanan reguler.
* **Recommendation**: Definisikan kueri pencarian target jadwal spesifik (misal: jadwal yang memiliki pemesanan berstatus `menunggu_pembayaran` dengan `jatuh_tempo <= NOW()`) dan perjelas bahwa `sp_buat_pemesanan` sudah melakukan pembersihan inline secara *lazy*.

#### 7. Evaluasi Alternatif Bersifat Kosmetik (Pelanggaran *The Alternatives Rule*)
* **Reviewer Lens**: `egm-design`, `egm-structural`
* **Affected Scope**: Alternatives Considered (baris 264–307)
* **Discrepancy Description**: Alternative D ("Pure Black OLED vs Nordic Slate") merupakan preferensi styling/token warna CSS, bukan alternatif arsitektur perangkat lunak. Sementara itu, keputusan arsitektural krusial tidak dievaluasi alternatifnya (misalnya: MySQL Event Scheduler vs Node.js Background Worker untuk auto-cancel, atau Redis vs `express-mysql-session`).
* **Recommendation**: Ganti Alternative D dengan analisis trade-off arsitektural yang substantif (misalnya mekanisme pembatalan otomatis tiket atau persistensi session store), dan sajikan dalam tabel komparasi terstruktur.

#### 8. Deviasi Penamaan Heading Blueprint Standar
* **Reviewer Lens**: `egm-structural`
* **Affected Scope**: Baris 15 (`## The Problem`) dan Baris 84 (`## Technical Plan (Architecture)`)
* **Discrepancy Description**: Standar *Feature Specification* menetapkan penamaan baku **Problem Statement** dan **Proposed Architecture**.
* **Recommendation**: Sesuaikan judul heading menjadi `## Problem Statement` dan `## Proposed Architecture`.

#### 9. Misnomer Teknis Pengacakan Nama Berkas (Bukan Enkripsi)
* **Reviewer Lens**: `egm-style`
* **Affected Scope**: Non-Functional Requirements (baris 322)
* **Discrepancy Description**: Pernyataan *"Nama berkas dienkripsi acak dengan UUID v4"* tidak tepat secara terminologi komputer karena UUID v4 adalah string identifier unik acak, bukan hasil enkripsi kriptografi.
* **Recommendation**: Ubah menjadi *"Nama berkas diganti dengan pengidentifikasi unik acak UUID v4 (`crypto.randomUUID()`)..."*.

#### 10. Klaim Hiperbola dan Copywriting Pemasaran Subjektif
* **Reviewer Lens**: `egm-style`
* **Affected Scope**: Alternatives Considered (baris 305–306)
* **Discrepancy Description**: Penggunaan frasa dramatis seperti *"Snow Blindness"* dan *"terbukti memberikan kenyamanan visual jangka panjang"* merupakan klaim pemasaran subjektif.
* **Recommendation**: Ganti dengan tolok ukur teknis objektif dan terukur (rasio kontras `≥ 7:1` sesuai kriteria WCAG).

#### 11. Bahasa Informal dan Framing Non-Teknis
* **Reviewer Lens**: `egm-style`
* **Affected Scope**: Baris 37, 54–55, 158, 269
* **Discrepancy Description**: Istilah informal seperti *"File Sampah"*, framing presentasi akademik (*"agar pengujian di hadapan dosen tidak kosong"*), dan pembenaran informal (*"Sangat familier di lingkungan akademik"*) menurunkan standar teknis dokumen.
* **Recommendation**: Gunakan istilah formal: *"Pembersihan Berkas Yatim (Orphaned File Cleanup)"*, framing teknis untuk seeder demo (*"verifikasi fungsional dan pengujian lokal"*), dan justifikasi arsitektur berbasis atribut kualitas sistem.

---

### 🟢 Nit Findings

12. **Inkonsistensi Pemisah Markdown**: Standardisasi seluruh garis horizontal menggunakan `---` (menghilangkan pemisah 80 karakter `----...`). (`egm-structural`)
13. **Inkonsistensi Bullet List**: Menyeragamkan semua unordered list menggunakan bullet asteris (`*`). (`egm-structural`)
14. **Penomoran Redundan pada Heading Alternatif**: Menghilangkan penomoran ganda (`### 1. Alternative A` disederhanakan menjadi `### Alternative A`). (`egm-structural`)
15. **Ketiadaan Tabel Komparasi Alternatif**: Menyajikan alternatif dalam tabel perbandingan ringkas (Karakteristik, Kelebihan, Alasan Penolakan). (`egm-structural`)
16. **Risiko Tabrakan Username Walk-in**: Mendokumentasikan format pembuatan username sintetis (misal `walkin_<phone>`) dan penanganan nomor yang telah terdaftar. (`egm-design`)
17. **Redundansi Adverbia dan Pengulangan Kata**: Menghilangkan frasa berlebih seperti *"datang langsung secara fisik"* dan *"langsung menandai ... secara instan"*. (`egm-style`)
18. **Eliminasi Kata Pengisi (Fluff)**: Menghapus kata pengisi seperti *"Penuh"*, *"resmi"*, dan mengganti *"Ergonomis"* dengan kriteria aksesibilitas terukur. (`egm-style`)
19. **Standardisasi Istilah Bahasa Asing**: Mengganti jargon seperti *"out-of-the-box"* menjadi *"bawaan framework"*, *"Plumbing Overhead"* menjadi *"overhead integrasi lintas-layanan"*. (`egm-style`)
20. **Koreksi Ejaan Baku**: Memperbaiki kata non-baku *"merubah"* menjadi *"mengubah"*, *"ter-normalisasi"* menjadi *"ternormalisasi"*. (`egm-style`)
21. **Klarifikasi Port Deployment**: Mencantumkan catatan kesiapan reverse-proxy (Nginx/TLS) untuk deployment non-lokal. (`egm-design`)

