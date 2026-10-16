# Eksplorasi ruang disk (16 Oktober 2026)

Eksplorasi baca-saja. Tidak ada file dihapus. Instruksi terbaru Dien hanya meminta eksplorasi; daftar ini bukan izin eksekusi pembersihan.

[Fakta] Ruang tersedia saat awal pemeriksaan 431280128 byte (sekitar411 MiB). Pengukuran memakai disk_usage dan du, dengan ukuran alokasi filesystem, bukan janji ruang yang akan benar-benar kembali pada APFS.

| Kandidat | Alokasi terukur | Dampak bila kelak dihapus | Rekomendasi |
| --- | ---: | --- | --- |
| 33 profil Chrome terisolasi untuk tes/PDF | 773996544 byte (738 MiB) | Riwayat sesi tes sintetis hilang; profil Brave/Lace pengguna tidak termasuk | Prioritas pertama setelah izin eksplisit |
| 156 direktori tes sintetis sementara | 153645056 byte (147 MiB) | Fixture/cache tes sementara hilang; tes membuat ulang | Prioritas pertama setelah izin eksplisit |
| 41 salinan public prover | 497123328 byte (474 MiB) | Browser tidak bisa mengambil proving key tersebut sampai aset dibuat ulang | Opsional, mengganggu kesiapan browser |
| apps/web/dist | 501988 KiB (490 MiB) | Build produksi harus dibuat ulang; server vite preview port5176 sedang memakainya | Pertahankan selama pratinjau digunakan |
| apps/web/node_modules/.vite | 105712 KiB (103 MiB) | Vite perlu mengoptimalkan dependensi ulang; ada deps_temp sekitar51 MiB yang belum dibuktikan tidak aktif | Kandidat lanjutan setelah server berhenti dan pemeriksaan ulang |
| node_modules | 519108 KiB (507 MiB) | Pengerjaan/tests tidak jalan sebelum instalasi ulang, perlu jaringan | Tidak direkomendasikan sekarang |

[Fakta] Daftar230path lama berada di local-disk-cleanup-proposal.json. Seluruhnya masih ada, tidak ditemukan symlink kandidat yang diproses, tidak ada referensi path itu dalam command proses saat diperiksa, dan41public prover semuanya SHA256-identik dengan retainedPrimary. Pemeriksaan proses merupakan snapshot, sehingga harus diulang sebelum penghapusan apa pun.

[Inferensi] Membersihkan hanya189direktori tes/profil dalam proposal berpotensi mengembalikan sekitar885 MiB tanpa menghilangkan proving key browser. Dasarnya jumlah alokasi kedua kelompok, bukan pengukuran setelah penghapusan. Jika ditambah41salinan prover, total terukur sekitar1.33 GiB. Jangan menjumlahkan kembali public prover dengan folder induknya karena akan menghitung file dua kali.

Pertahankan source, .git, contracts/managed, journal transaksi asli/recovery, dokumen bukti, screenshot, .env, profil pengguna, dan volume Docker. Ukuran besar saja bukan alasan menghapusnya. Error Docker overlay2 I/O tetap perlu diperiksa setelah ruang disk pulih; eksplorasi ini tidak membuktikan disk penuh sebagai satu-satunya penyebab.

Sumber pemeriksaan lokal: du -k -d2 ., du -k -d3 apps/web, disk_usage, ps command paths (tanpa menampilkan keseluruhan argumen), serta SHA256 public prover dibanding primary. Tidak membaca isi secret atau profil wallet pengguna. Cakupan eksplorasi dibatasi artefak Senyap dan direktori sementara yang terkait; belum audit seluruh home/Downloads.

## Hasil tindakan yang kemudian disetujui

[Fakta] Setelah eksplorasi, Dien menyetujui rekomendasi189folder sementara saja.189folder dihapus setelah pemeriksaan ulang,0dilewati;41public prover tetap ada. Free disk meningkat943083520byte menjadi3645374464byte. Bukti local-disk-cleanup-result.json. Instruksi eksplorasi awal tidak dipakai sebagai izin penghapusan; eksekusi dilakukan setelah jawaban baru “oke, kerjakan”.
