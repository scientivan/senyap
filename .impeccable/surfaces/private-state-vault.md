# Private state vault (pratinjau dan implementasi lokal)

## Status dan otoritas

**[Fakta]** Dien telah menyetujui integrasi pratinjau; UI lokal kini tersedia pada `/app/workspace` melalui `apps/web/src/app/pages/Workspace.tsx`, `apps/web/src/app/pages/workspace.css`, dan `packages/sdk/src/workspace.ts`. Ini tetap perluasan permukaan lokal, tanpa perubahan sistem visual global. `design/private-state-vault.html` dipertahankan sebagai riwayat pratinjau mock.

**[Fakta]** Verdict reviewer implementasi masih menunggu satu perbaikan lock yang tercatat dalam handoff. Bukti browser setelah perbaikan sudah mencatat `pendingOpenStaysLocked: true`; hasil tersebut tidak otomatis menjadi verdict ship reviewer.

**[Fakta]** Konteks produk dan visual berasal dari `PRODUCT.md`, `DESIGN.md`, dan aturan skala app di `AGENTS.md`. Mode kerja adalah **Operate**, dengan arah **existing-world local extension** (memperluas pola app Senyap yang sudah ada). Tidak ada comp atau quality-bar card untuk perluasan sempit ini; review tidak menyatakan artefak tersebut tersedia.

## Kontrak arah lokal

- Tugas pengguna adalah membuat atau membuka ruang privat perangkat, menyimpan cadangan terenkripsi, atau memulihkan data. Lace menangani transaksi; ruang privat melindungi pilihan dan kunci lokal. Perbedaan tersebut harus dijelaskan dalam bahasa sederhana.
- Gunakan shell app ringkas, konten satu kolom terpusat, formulir dahulu, lalu bantuan cadangan dan jalur demo. Implementasi mempertahankan navigasi atas app yang sudah ada. Sidebar statis dan breakpoint 650px hanya milik HTML pratinjau, bukan kontrak navigasi implementasi.
- Warisi SF Pro system stack, judul berbobot 300, isi 400, label 500–600. Skala app yang disahkan memakai 12/13/16/26px untuk catatan, bantuan, judul bagian/kartu, dan judul halaman. Nilai khusus HTML (misalnya isi 14px dan judul tahap 24px) adalah detail artefak, bukan token global baru.
- Warisi palet night `#2A1B1B`, crimson `#A50C22`, red aksi `#C1272D`, gold `#AE9970`, dan putih. Pertahankan paragraf justify, tombol pill tanpa border, cakram ikon panah SVG, serta indikator fokus yang terlihat.
- Jangan menambah kicker kecil di atas judul, monospace kecil, glow, gradient wash, tint transparan, em dash, atau panah Unicode dalam copy. Aturan hero landing 100dvh tidak menjadi komposisi baru untuk formulir app ini.

## Riwayat keadaan pratinjau

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

## Riwayat kejujuran demo dan review pratinjau

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

## Perilaku implementasi `/app/workspace`

**[Fakta]** Form mempertahankan selector tombol grup `aria-pressed`, Show/Hide, konfirmasi password, keadaan sibuk dengan kontrol dinonaktifkan, dan pesan `role="status"`/`aria-live="polite"`. Tipografi memakai judul halaman 26px, label 13px dan judul bantuan 16px, dengan token app yang ada; judul tahap cadangan 24px adalah detail lokal (`workspace.css`).

| Keadaan | Perilaku yang tersedia | Batas |
| --- | --- | --- |
| Create | Validasi minimal 16 karakter dan tiga kategori, konfirmasi kecocokan, lalu SDK membuat profil lokal beserta kunci dalam penyimpanan terenkripsi. Provider dapat menolak password lemah atau penyimpanan yang gagal. | Profil independen dari Lace; tidak mendaftarkan identitas pada kontrak produk. |
| Unlock | Password membuka profil perangkat yang sudah ada; password salah ditolak. Tidak ada profil menghasilkan pesan untuk membuat atau memulihkan. | Akses hanya ke sesi ruang privat lokal. |
| Backup | Sesi terbuka mengekspor backup terenkripsi dan meminta unduhan file JSON nyata. Pesan menyatakan unduhan diminta, bukan memastikan file tersimpan. | Pengguna tetap perlu menyimpan password untuk pemulihan. |
| Restore | Membaca file JSON nyata berukuran positif sampai 1.000.000 byte (1 MB desimal), mengimpor satu state, memvalidasi profil serta pasangan kunci, lalu membuka sesi. | Password salah ditolak; create/restore menolak menimpa workspace yang sudah ada. |
| Lock | Tombol Lock mengosongkan rahasia sesi. Meninggalkan route, reload/pagehide, perubahan marker profil dari tab lain, dan peristiwa clear storage mengunci sesi. | Tidak menghapus backup atau salinan terenkripsi perangkat. |
| Operasi terbuka yang tertunda | Penghitung generasi membatalkan penerimaan hasil setelah lock atau perubahan siklus halaman; sesi yang selesai terlambat langsung dikunci. | Bukti ini menguji keadaan UI/sesi, bukan pembatalan seluruh pekerjaan penyimpanan yang sudah berjalan. |
| Keluar ke demo | Link menuju `/app` sungguhan. | Market tetap berlabel demo; staking, pembelian dan klaim produk belum tersambung. |

**[Fakta]** `localStorage` hanya menyimpan namespace acak nonsecret berformat 32 digit hex pada marker `senyap-workspace-v1`; data profil dan material kunci memakai provider penyimpanan terenkripsi SDK. Scope provider adalah `local-profile`, bukan alamat kontrak terdeploy. Pembukaan memakai Web Locks untuk mengatur akses profil antartab (`packages/sdk/src/workspace.ts`).

**[Fakta]** Klaim “tidak ada kunci dibuat” di bagian riwayat hanya berlaku untuk HTML mock. Implementasi nyata membuat kunci lokal saat create. UI menjelaskan pemisahan password workspace dan Lace, risiko kehilangan salinan lokal saat browser data dibersihkan, kebutuhan backup, serta batas market demo (`Workspace.tsx`). Tidak ada kontrak produk atau transaksi yang dihubungkan oleh permukaan ini.

## Bukti implementasi dan batas review

Screenshot implementasi:

- Desktop: `/private/tmp/senyap-workspace-desktop.png`.
- Mobile: `/private/tmp/senyap-workspace-mobile.png`.

**[Fakta]** `docs/evidence/workspace-browser.json` mencatat seluruh pemeriksaan boolean bernilai `true`: tidak overflow, konfirmasi tidak cocok, create, penyimpanan terenkripsi, password salah, unlock, terkunci setelah reload, operasi tertunda tetap terkunci, penggantian profil ditolak, restore gagal, dan restore berhasil. Lingkupnya profil Chrome headless terisolasi dengan password serta kunci sintetis, tanpa wallet atau transaksi.

**[Fakta]** Probe `scripts/probe-workspace-browser.ts` menjalankan pemeriksaan `pendingOpenStaysLocked` sesudah tiga peristiwa saat open masih tertunda: `pagehide`, storage change untuk marker profil, dan storage clear (`key: null`). JSON menyimpan hasil gabungan ketiganya. Reviewer independen menilai satu temuan lockfix resolved dengan disposition ship, terbatas pada perbaikan tersebut dan bukan audit keamanan.

- Pertahankan navigasi app, token yang ada, label demo dan batas fitur saat iterasi berikutnya. Tidak ada perubahan global `DESIGN.md` atau konfigurasi visual yang disahkan melalui dokumen ini.
- Pengujian provider, persistensi terenkripsi, dan pemulihan kunci terpisah dari HTML pratinjau. Bukti browser implementasi menambah validasi alur nyata tetapi tidak mengubah screenshot mock menjadi bukti provider atau menjamin semua browser/perangkat.
- Tidak ada izin deploy, transaksi onchain atau koneksi wallet baru yang diberikan melalui handoff ini.

Dokumen permukaan ini tidak mengubah `PRODUCT.md`, `DESIGN.md`, kode app, konfigurasi, atau keputusan produk yang sudah dikunci.
