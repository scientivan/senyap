# Senyap demo video v2 production handoff

Versi visual 5 menit dari naskah yang disetujui Dien pada 19 Oktober 2026.

Tautan final yang diunggah Dien tersedia di [YouTube](https://youtu.be/UV4MjUZe6lI).
Metadata video dapat diakses dengan judul yang sesuai. Pemeriksaan ini tidak
mencakup pemutaran penuh atau perbandingan isi unggahan dengan master lokal.

## Berkas keluaran

- Video utama dengan subtitle sebagai acuan waktu rekaman di `video/remotion/out/senyap-demo-v2-5min.mp4`.
- Master tanpa subtitle di `video/remotion/out/senyap-demo-v2-5min-clean.mp4` sebagai cadangan editing.
- Subtitle dengan timing tetap di `video/remotion/out/senyap-demo-v2-5min.srt`. Nama lama `senyap-demo-v2-narration-guide.srt` tetap tersedia sebagai salinan yang identik.
- Pratinjau storyboard di `design/demo-video-v2-preview.html`.
- Frame pemeriksaan di `video/remotion/out/v2-review/`.
- Narasi yang dibaca Dien di `docs/submission/demo-voiceover-v2-5min.txt`.
- Naskah lengkap di `docs/submission/demo-video-script-v2-5min.md`.

## Isi versi ini

Tujuh belas scene memadukan footage produk asli dan ilustrasi animasi. Pembuka menjelaskan pengguna, masalah yang didukung sumber publik, serta hipotesis yang masih perlu diuji. Bagian engineering menjelaskan client, vault, local prover, wallet, indexer, operator, Reclaim, Veritas, Gemini, penyimpanan terenkripsi, lima layanan committee, keeper, dua kontrak, tally, threshold opening, dan aturan siklus. Bagian QA memakai kutipan source tes asli dan hasil 44 tes yang diverifikasi. Diagram recovery secara eksplisit dilabeli ilustrasi pengujian lokal.

Angka 157 merupakan snapshot aksi kontrak Senyap dari indexer, bukan jumlah pengguna atau pembelian. Pergantian market #6, #7 dan #3 diberi label. Peserta sintetis, demo dUSD, kendali seluruh seat oleh satu orang, dan trust boundary prover serta alasan tidak disamarkan.

## Suara, subtitle dan face cam

Video merupakan **master visual tanpa suara narasi**. Tidak ada suara sintetis atau rekaman suara yang diambil dari pitch Bisik. Seluruh kalimat narasi tersedia sebagai 67 cue subtitle yang dibakar ke video. Setiap cue menampilkan satu kalimat lengkap sampai titik. Kalimat panjang membungkus maksimal dua baris yang tampil bersamaan, tanpa pergantian frasa di tengah kalimat.

Master clean mempertahankan area face cam dan seluruh ilustrasi, dengan teks narasi di area footer dihilangkan. Master ini hanya cadangan. Acuan rekaman Dien adalah video utama yang sudah bersubtitle.

**Keputusan Dien terbaru, 19 Oktober 2026** Subtitle dan timing video dijadikan acuan tetap. Dien merekam suara dan face cam mengikuti subtitle yang tampil. Atas permintaan terbaru, 90 potongan frasa digabung menjadi 67 kalimat utuh. Rentang waktu setiap kalimat dipertahankan, dengan pembulatan tampil pada 30 fps. Narasi, footage dan timeline 5 menit tetap sama. SRT berasal dari naskah, bukan transkripsi suara.

Area face cam tetap 300×270 piksel pada x1560. Posisi y150 pada intro dan scene public/operator, y760 pada scene lain, serta tidak ditampilkan pada penutup. Pasang rekaman wajah di area tersebut. Pada intro, posisi atas tetap berlaku saat ilustrasi dua pengguna muncul.

## Struktur source

Komposisi `SenyapDemoV2` berada di `video/remotion/src/v2/`. Komposisi asli `SenyapDemo` dan hasil draft 4 dipertahankan.

- `script.json` menyimpan 17 scene dan narasi yang diturunkan dari naskah.
- `DemoV2.tsx` mengatur footage, durasi, subtitle dan area kamera.
- `Visuals.tsx` menggambar ilustrasi dengan animasi deterministik berbasis frame.
- `evidence.json` menyimpan kutipan source dan snapshot bukti yang dipakai di layar.
- `captions.json` memakai struktur Caption dari Remotion.
- `render-v2.mjs` membuat preview atau satu bagian render.
- `sync-v2.mjs` menyinkronkan naskah ke JSON narasi, caption dan SRT panduan.

## Render ulang

Jalankan perintah dari `Akindo/video/remotion`.

```sh
rtk proxy node sync-v2.mjs --check
rtk proxy npx tsc --noEmit
rtk proxy node render-v2.mjs preview
rtk proxy node render-v2.mjs render 0
```

Jika naskah berubah, jalankan `rtk proxy node sync-v2.mjs` sebelum typecheck dan render. Perintah ini memperbarui JSON narasi dan SRT panduan tanpa mengubah footage atau bukti QA.

Argumen terakhir render dapat diganti 1 hingga 6. Ada 9000 frame pada 30 fps. Bagian 0 hingga 5 masing-masing berisi 1350 frame, sedangkan bagian 6 berisi 900 frame. Part output memakai nama `out/senyap-v2-part-N.mp4`. Jangan render dua bagian bersamaan ke folder bundle yang sama.

Setelah semua bagian selesai, jalankan `rtk proxy node finish-v2.mjs`. Skrip ini menggabungkan part dengan stream copy, membuat master clean, memeriksa jumlah frame melalui dekode ffprobe, serta mengekstrak contact sheet dan frame di sambungan. Saat menambahkan suara dan face cam Dien, ikuti timing subtitle yang telah ditetapkan.

## Batas verifikasi

Typecheck proyek video dan pemeriksaan komposisi memverifikasi ukuran 1920×1080, 30 fps dan 9000 frame. Durasi seluruh shot cocok dengan 17 slot naskah. Seluruh cue berurutan, tidak bertumpuk dan cocok dengan teks narasi. Hash source tes, kontrak, dan implementasi terkait masih cocok dengan bukti QA sesi sebelumnya.

Pemeriksaan visual memakai frame sampel dan contact sheet. Ini bukan audit produk baru atau pemutaran penuh dengan rekaman suara Dien. Bukti render akhir tersedia di [laporan render](../evidence/demo-video-v2-render-2026-10-19.json).

## Hasil verifikasi akhir

**[Fakta]** Kedua master selesai dirender dan didekode penuh. Masing-masing berdurasi tepat 300 detik, berisi 9000 frame pada 1920×1080 dan 30 fps. Codec H.264. Tidak ada audio narasi pada kedua file.

Ekspor subtitle kalimat penuh berukuran 14.094.728 byte, sekitar 13,44 MiB. Master tanpa subtitle sekitar 12,87 MiB. File SRT terbaru berisi 67 cue panduan. Typecheck video lulus. Paket Remotion memakai versi yang sama, 4.0.290. Hash source QA tetap sesuai bukti verifikasi sebelumnya.

Pemeriksaan visual mencakup contact sheet lintas scene, sampel final ilustrasi dan QA, area clean yang bebas subtitle, serta 12 frame sebelum/sesudah enam sambungan render. Teks sekunder pada bidang emas telah digelapkan agar terbaca. Ini pemeriksaan visual berbasis sampel, bukan pemutaran penuh dengan suara.

Source video dan hasil render tetap berada di folder `video/` yang memang diabaikan Git sesuai aturan proyek. Draft 4 tetap dipertahankan. Tidak ada upload atau push.

## Revisi subtitle kalimat penuh

Keluaran yang mudah dibedakan dari versi sebelumnya adalah
`video/remotion/out/senyap-demo-v2-5min-full-sentences.mp4`. Isinya identik dengan
video utama terbaru `senyap-demo-v2-5min.mp4`. SRT padanannya memakai akhiran
`full-sentences.srt`. Versi frasa lama disimpan terpisah.

Generator `sync-v2.mjs` kini membentuk satu cue per kalimat tanpa batas jumlah
kata atau karakter yang memecah kalimat. `DemoV2.tsx` menyediakan area dua baris.
Untuk ekspor kali ini, browser merender teks SF Pro menjadi strip PNG melalui
`sentence-subtitles-v2.mjs`, kemudian FFmpeg menempelkannya ke master clean.
Ini mempertahankan semua scene dan hanya mengganti area subtitle.

Seluruh 67 cue lolos pemeriksaan ukuran tanpa overflow, maksimal dua baris.
Pencocokan area subtitle pada 216 frame sebelum dan sesudah batas kalimat serta
batas frasa lama menemukan nol kalimat yang salah. MP4 didekode penuh menjadi
9000 frame, 1920×1080, 30 fps dan tepat 300 detik. Tidak ada audio. Bukti revisi
ada di [laporan subtitle kalimat penuh](../evidence/demo-video-v2-sentence-subtitles-2026-10-19.json).

Pemeriksaan source dilakukan dengan `node sync-v2.mjs --check` dan
`pnpm exec tsc --noEmit`. Untuk render visual penuh berikutnya, regenerasi semua
part sebelum menjalankan `finish-v2.mjs`. Part lama masih berisi subtitle frasa.
