# Private state vault (pratinjau)

## Status dan otoritas

**[Fakta]** Artefak yang ditinjau adalah `design/private-state-vault.html`, sebuah pratinjau HTML mandiri. Persetujuan desain Dien masih menunggu; UI aplikasi sebenarnya belum diimplementasikan. Dokumen ini merupakan handoff permukaan lokal, bukan persetujuan implementasi atau perubahan sistem visual global.

**[Fakta]** Konteks produk dan visual berasal dari `PRODUCT.md`, `DESIGN.md`, dan aturan skala app di `AGENTS.md`. Mode kerja adalah **Operate**, dengan arah **existing-world local extension** (memperluas pola app Senyap yang sudah ada). Tidak ada comp atau quality-bar card untuk perluasan sempit ini; review tidak menyatakan artefak tersebut tersedia.

## Kontrak arah lokal

- Tugas pengguna adalah membuat atau membuka ruang privat perangkat, menyimpan cadangan terenkripsi, atau memulihkan data. Lace menangani transaksi; ruang privat melindungi pilihan dan kunci lokal. Perbedaan tersebut harus dijelaskan dalam bahasa sederhana.
- Gunakan shell app ringkas, konten satu kolom terpusat, formulir dahulu, lalu bantuan cadangan dan jalur demo. Desktop mempertahankan navigasi samping; pratinjau menyembunyikannya pada lebar maksimal 650px dan mempertahankan semua aksi utama.
- Warisi SF Pro system stack, judul berbobot 300, isi 400, label 500–600. Skala app yang disahkan memakai 12/13/16/26px untuk catatan, bantuan, judul bagian/kartu, dan judul halaman. Nilai khusus HTML (misalnya isi 14px dan judul tahap 24px) adalah detail artefak, bukan token global baru.
- Warisi palet night `#2A1B1B`, crimson `#A50C22`, red aksi `#C1272D`, gold `#AE9970`, dan putih. Pertahankan paragraf justify, tombol pill tanpa border, cakram ikon panah SVG, serta indikator fokus yang terlihat.
- Jangan menambah kicker kecil di atas judul, monospace kecil, glow, gradient wash, tint transparan, em dash, atau panah Unicode dalam copy. Aturan hero landing 100dvh tidak menjadi komposisi baru untuk formulir app ini.

## Keadaan pratinjau

| Keadaan | Perilaku HTML yang tersedia | Batas kebenaran |
| --- | --- | --- |
| Setup | Password dan konfirmasi, Show/Hide, validasi panjang minimal 16 karakter serta minimal tiga dari huruf besar, huruf kecil, angka, simbol. Ketidakcocokan menghasilkan pesan. | Validasi mock; tidak membuat kredensial, kunci atau penyimpanan terenkripsi. |
| Unlock | Tombol mode mengganti judul dan formulir, menghilangkan konfirmasi, lalu menampilkan pesan hasil pratinjau. | Tidak memeriksa password terhadap vault nyata. |
| Simulasi cadangan terenkripsi | Setup yang valid menampilkan tahap cadangan; aksi simpan memberi pesan bahwa tidak ada file atau kunci dibuat. | Tidak mengenkripsi, membuat atau mengunduh backup. |
| Restore tanpa sampel | Form pemulihan terbuka; mencoba restore meminta pemilihan sampel terlebih dahulu. | Tidak membaca file pengguna. |
| Restore salah password | Sampel fiktif sudah dipilih; password yang tidak cocok memberi pesan kegagalan dan pengguna dapat mencoba lagi. | Tidak mendekripsi data nyata. |
| Restore berhasil | Password sampel fiktif yang ditampilkan menghasilkan pesan sukses dan mengosongkan kolom password. | Tidak memulihkan kredensial atau data privat. |
| Jalur keluar demo | “Continue with labelled demo data” menjelaskan bahwa demo tersedia tanpa ruang privat atau transaksi. | Dalam HTML, ini hanya pesan status, bukan navigasi app. |

**[Fakta]** Selector setup/unlock memakai tombol biasa dalam `role="group"`, masing-masing dengan `aria-pressed` yang diperbarui. Pesan hasil memakai `role="status"` dan `aria-live="polite"` (`design/private-state-vault.html`).

## Kejujuran demo dan bukti review

**[Fakta]** Header menampilkan “Preview only” pada desktop dan mobile. Catatan bawah menyatakan tidak ada password, kunci atau koneksi wallet yang dibuat atau disimpan. Restore menyatakan sampel berisi data fiktif dan tidak ada file dibaca. Semua input password hanya digunakan untuk interaksi mock selama halaman terbuka.

Screenshot yang diserahkan untuk review:

- Desktop: `/private/tmp/senyap-vault-preview-desktop.png`.
- Mobile: `/private/tmp/senyap-vault-preview-mobile.png`.

**[Fakta]** Disposisi review **ship** hanya berlaku untuk empat perbaikan pratinjau yang tercatat dalam handoff:

1. Pengungkapan pratinjau terlihat pada kedua lebar layar.
2. Restore mock mencakup keadaan belum memilih sampel, salah password, dan berhasil.
3. Validasi mock password memeriksa kategori karakter sesuai petunjuk.
4. Selector memakai tombol grup biasa dengan `aria-pressed`.

Disposisi tersebut tidak mengesahkan desain produk, integrasi vault, keamanan, atau implementasi UI aplikasi.

## Batas implementasi berikutnya

- Tunjukkan rancangan kepada Dien dan tunggu persetujuan desain sebelum mengimplementasikan UI app. Gunakan komponen dan aturan app yang sudah ada; jangan mengangkat detail HTML ini menjadi perubahan `DESIGN.md` atau konfigurasi visual global tanpa persetujuan.
- Pertahankan label demo, jalur keluar demo, pemisahan Lace dan ruang privat, serta pesan hasil yang akurat terhadap kemampuan yang benar-benar tersedia.
- Implementasi kelak harus menghubungkan keadaan UI ke provider penyimpanan privat dan alur cadangan yang nyata. Jangan menganggap hasil mock unlock/restore sebagai bukti keberhasilan fungsi tersebut.
- Pengujian provider, persistensi terenkripsi, pemulihan kunci, backup/restore lintas perangkat, dan kegagalan dekripsi terpisah dari HTML ini. Screenshot dan review pratinjau bukan bukti lulus pengujian tersebut.
- Tidak ada izin deploy, transaksi onchain, koneksi wallet baru, atau penulisan kredensial yang diberikan melalui handoff ini.

Dokumen permukaan ini tidak mengubah `PRODUCT.md`, `DESIGN.md`, kode app, konfigurasi, atau keputusan produk yang sudah dikunci.
