# Live product workspace (pratinjau statis)

## Status dan arah

**[Fakta]** `design/live-product-workspace.html` adalah pratinjau HTML sintetis untuk integrasi produk Preprod. Persetujuan desain Dien masih menunggu. Dokumen ini tidak menyatakan UI produk telah diimplementasikan atau kontrak telah dideploy.

**[Fakta]** Mode **Operate**, arah **existing-world local extension** (perluasan pola app yang sudah ada), mewarisi konteks `PRODUCT.md`, `DESIGN.md`, dan skala app di `AGENTS.md`. Tidak ada sistem visual atau token global baru. Tidak ada comp atau quality-bar card baru untuk perluasan sempit ini.

Kontrak permukaan adalah memisahkan Demo dan Preprod secara jelas, menampilkan syarat Lace dan ruang privat sebelum aksi live, memperlihatkan deployment yang belum tersedia, serta membedakan persiapan bukti dari transaksi dengan hasil belum pasti. Jangan menyamarkan kegagalan live dengan data demo.

## Warisan visual

- SF Pro system stack, judul halaman 26px berbobot 300, isi 400, label 500–600. Skala app 12/13/16/26px tetap menjadi acuan, bukan skala hero landing.
- Night `#2A1B1B`, crimson `#A50C22`, red aksi `#C1272D`, gold `#AE9970`, putih, panel netral dan hairline yang sudah ada.
- Tombol pill tanpa border, cakram panah SVG, fokus gold terlihat, paragraf justify, baris persyaratan ringkas dan panel status sederhana. Tidak memakai glow, gradient wash, label monospace kecil, kicker di atas judul, atau warna menang/kalah.
- HTML memakai konten maksimal 760px dengan sidebar statis yang disembunyikan pada lebar maksimal 650px. Ini komposisi pratinjau; implementasi kelak harus mempertahankan navigasi app yang ada, bukan menyalin sidebar sebagai perubahan sistem global.

## Empat keadaan

| State | Isi dan aksi yang terlihat | Makna yang disimulasikan |
| --- | --- | --- |
| `connect` | Judul “Use Senyap on Preprod”, Lace belum tersambung, ruang privat terkunci, deployment produk tidak tersedia. “Open live markets” dinonaktifkan. | Pengguna belum dapat menjalankan aksi produk; demo berlabel tetap dapat dijelajahi. Tombol Connect/Unlock hanya menampilkan pesan mock. |
| `ready` | Intro menyatakan wallet tersambung dan ruang privat siap; panel siap serta satu contoh market dengan tombol “Seal a pick”. | Market, 5 scout dan 500 dUSD seluruhnya sintetis. Tombol hanya beralih ke `pending`. |
| `pending` | Intro menjelaskan pilihan tersimpan dan bukti sedang dipersiapkan. “Building your proof” menyatakan belum ada transaksi dikirim; tombol persiapan dinonaktifkan. | Tidak ada penyimpanan pilihan, pembuatan bukti, atau transaksi nyata dalam HTML. |
| `uncertain` | Intro dan panel menyatakan hasil akhir belum tersedia, meminta pemeriksaan status sebelum aksi lain. “Check transaction status” menghasilkan pesan belum terkonfirmasi. | Tidak ada resend atau retry transaksi; pemeriksaan status juga mock. |

**[Fakta]** Intro berubah sesuai state, sehingga keadaan `ready`, `pending`, dan `uncertain` tidak lagi meminta koneksi wallet atau unlock yang secara skenario sudah selesai. Perbaikan intro ini telah diselesaikan dalam review pratinjau.

**[Fakta]** Kontrol “Preview states” dan parameter URL `?state=ready`, `?state=pending`, atau `?state=uncertain` memilih skenario statis. Selector Demo/Preprod menggunakan tombol biasa dalam grup dengan `aria-pressed`; Demo hanya menampilkan pesan, sedangkan Preprod mengembalikan state `connect`. Pesan aksi memakai `role="status"` dan `aria-live="polite"` (`design/live-product-workspace.html`).

## Kebenaran dan batas

**[Fakta]** Header menampilkan “Design preview”; penjelasan kontrol menyatakan semua market dan jumlah sintetis. HTML tidak menghubungi Lace, membuat atau menyimpan kunci, memanggil layanan, membangun bukti, atau mengirim transaksi. Copy tentang wallet siap, pilihan tersimpan dan data jaringan hanya merupakan skenario desain.

Implementasi live kelak memerlukan sumber data, konfigurasi deployment, koneksi Lace, ruang privat, serta status transaksi nyata. Bukti pratinjau tidak menguji integrasi tersebut dan tidak memberi izin deploy atau transaksi. Materi submisi (deck, video, dan pengiriman hackathon) di luar scope pekerjaan ini.

## Bukti dan disposisi review

**[Fakta]** `docs/evidence/live-preview-browser.json` mencatat delapan capture (empat state pada lebar 1440px dan 390px). Seluruh pemeriksaan `noOverflow`, `expectedPanelVisible`, `previewLabel`, dan `noWallet` lulus dalam profil Chrome terisolasi tanpa wallet atau transaksi.

Delapan gambar review terbaru berada di:

| State | Desktop | Mobile |
| --- | --- | --- |
| connect | `.impeccable/review/live-product/connect-1440.png` | `.impeccable/review/live-product/connect-390.png` |
| ready | `.impeccable/review/live-product/ready-1440.png` | `.impeccable/review/live-product/ready-390.png` |
| pending | `.impeccable/review/live-product/pending-1440.png` | `.impeccable/review/live-product/pending-390.png` |
| uncertain | `.impeccable/review/live-product/uncertain-1440.png` | `.impeccable/review/live-product/uncertain-390.png` |

**[Fakta]** Handoff reviewer mencatat disposisi **ship** setelah perbaikan intro per state diselesaikan. Disposisi ini hanya untuk pratinjau statis; persetujuan Dien dan review implementasi live tetap terpisah.

**[Fakta]** Handoff pemeriksaan mencatat detector modern berjalan dalam keadaan degraded karena parser yang diperlukan tidak tersedia. Hasil tersebut bukan detector clean. Detector app lama yang diwajibkan menghasilkan `[]`; kedua hasil ini tidak boleh disatukan menjadi klaim semua pemeriksaan modern lulus.

Dokumen ini hanya mencatat kontrak permukaan dan bukti pratinjau. `DESIGN.md`, token global, kode app, dan keputusan deployment tidak berubah melalui handoff ini.
