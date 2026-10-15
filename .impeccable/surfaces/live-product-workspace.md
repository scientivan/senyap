# Live product workspace (pratinjau dan integrasi baca)

## Status dan arah

**[Fakta]** Dien menyetujui integrasi pratinjau. Route `/app/preprod` kini diimplementasikan melalui `apps/web/src/app/pages/LiveWorkspace.tsx`, `live-workspace.css`, dan `AppLayout.tsx` sebagai permukaan koneksi serta pembacaan state. Produk belum dideploy atau dikonfigurasi lengkap; kontrol transaksi produk masih dinyatakan sedang diintegrasikan. `design/live-product-workspace.html` tetap menjadi riwayat pratinjau sintetis.

**[Fakta]** Mode **Operate**, arah **existing-world local extension** (perluasan pola app yang sudah ada), mewarisi konteks `PRODUCT.md`, `DESIGN.md`, dan skala app di `AGENTS.md`. Tidak ada sistem visual atau token global baru. Tidak ada comp atau quality-bar card baru untuk perluasan sempit ini.

Kontrak permukaan adalah memisahkan Demo dan Preprod secara jelas, menampilkan syarat Lace dan ruang privat sebelum aksi live, memperlihatkan deployment yang belum tersedia, serta membedakan persiapan bukti dari transaksi dengan hasil belum pasti. Jangan menyamarkan kegagalan live dengan data demo.

## Warisan visual

- SF Pro system stack, judul halaman 26px berbobot 300, isi 400, label 500–600. Skala app 12/13/16/26px tetap menjadi acuan, bukan skala hero landing.
- Night `#2A1B1B`, crimson `#A50C22`, red aksi `#C1272D`, gold `#AE9970`, putih, panel netral dan hairline yang sudah ada.
- Tombol pill tanpa border, cakram panah SVG, fokus gold terlihat, paragraf justify, baris persyaratan ringkas dan panel status sederhana. Tidak memakai glow, gradient wash, label monospace kecil, kicker di atas judul, atau warna menang/kalah.
- HTML memakai konten maksimal 760px dengan sidebar statis yang disembunyikan pada lebar maksimal 650px. Ini komposisi pratinjau; implementasi kelak harus mempertahankan navigasi app yang ada, bukan menyalin sidebar sebagai perubahan sistem global.

## Riwayat empat keadaan pratinjau

| State | Isi dan aksi yang terlihat | Makna yang disimulasikan |
| --- | --- | --- |
| `connect` | Judul “Use Senyap on Preprod”, Lace belum tersambung, ruang privat terkunci, deployment produk tidak tersedia. “Open live markets” dinonaktifkan. | Pengguna belum dapat menjalankan aksi produk; demo berlabel tetap dapat dijelajahi. Tombol Connect/Unlock hanya menampilkan pesan mock. |
| `ready` | Intro menyatakan wallet tersambung dan ruang privat siap; panel siap serta satu contoh market dengan tombol “Seal a pick”. | Market, 5 scout dan 500 dUSD seluruhnya sintetis. Tombol hanya beralih ke `pending`. |
| `pending` | Intro menjelaskan pilihan tersimpan dan bukti sedang dipersiapkan. “Building your proof” menyatakan belum ada transaksi dikirim; tombol persiapan dinonaktifkan. | Tidak ada penyimpanan pilihan, pembuatan bukti, atau transaksi nyata dalam HTML. |
| `uncertain` | Intro dan panel menyatakan hasil akhir belum tersedia, meminta pemeriksaan status sebelum aksi lain. “Check transaction status” menghasilkan pesan belum terkonfirmasi. | Tidak ada resend atau retry transaksi; pemeriksaan status juga mock. |

**[Fakta]** Intro berubah sesuai state, sehingga keadaan `ready`, `pending`, dan `uncertain` tidak lagi meminta koneksi wallet atau unlock yang secara skenario sudah selesai. Perbaikan intro ini telah diselesaikan dalam review pratinjau.

**[Fakta]** Kontrol “Preview states” dan parameter URL `?state=ready`, `?state=pending`, atau `?state=uncertain` memilih skenario statis. Selector Demo/Preprod menggunakan tombol biasa dalam grup dengan `aria-pressed`; Demo hanya menampilkan pesan, sedangkan Preprod mengembalikan state `connect`. Pesan aksi memakai `role="status"` dan `aria-live="polite"` (`design/live-product-workspace.html`).

## Riwayat kebenaran dan batas pratinjau

**[Fakta]** Header menampilkan “Design preview”; penjelasan kontrol menyatakan semua market dan jumlah sintetis. HTML tidak menghubungi Lace, membuat atau menyimpan kunci, memanggil layanan, membangun bukti, atau mengirim transaksi. Copy tentang wallet siap, pilihan tersimpan dan data jaringan hanya merupakan skenario desain.

Bukti pratinjau tidak menguji integrasi nyata dan tidak memberi izin deploy atau transaksi. Materi submisi (deck, video, dan pengiriman hackathon) di luar scope pekerjaan ini.

## Riwayat bukti dan disposisi review statis

**[Fakta]** `docs/evidence/live-preview-browser.json` mencatat delapan capture (empat state pada lebar 1440px dan 390px). Seluruh pemeriksaan `noOverflow`, `expectedPanelVisible`, `previewLabel`, dan `noWallet` lulus dalam profil Chrome terisolasi tanpa wallet atau transaksi.

Delapan gambar review terbaru berada di:

| State | Desktop | Mobile |
| --- | --- | --- |
| connect | `.impeccable/review/live-product/connect-1440.png` | `.impeccable/review/live-product/connect-390.png` |
| ready | `.impeccable/review/live-product/ready-1440.png` | `.impeccable/review/live-product/ready-390.png` |
| pending | `.impeccable/review/live-product/pending-1440.png` | `.impeccable/review/live-product/pending-390.png` |
| uncertain | `.impeccable/review/live-product/uncertain-1440.png` | `.impeccable/review/live-product/uncertain-390.png` |

**[Fakta]** Handoff reviewer statis mencatat disposisi **ship** setelah perbaikan intro per state diselesaikan. Disposisi tersebut hanya untuk pratinjau statis. Persetujuan integrasi Dien dan review implementasi berikutnya dicatat terpisah di bawah.

**[Fakta]** Handoff pemeriksaan mencatat detector modern berjalan dalam keadaan degraded karena parser yang diperlukan tidak tersedia. Hasil tersebut bukan detector clean. Detector app lama yang diwajibkan menghasilkan `[]`; kedua hasil ini tidak boleh disatukan menjadi klaim semua pemeriksaan modern lulus.

## Perilaku terintegrasi `/app/preprod`

**[Fakta]** Navigasi atas app tetap dipakai. Pada route Preprod, `AppLayout.tsx` menampilkan label jaringan sebagai pengganti saldo demo, menu Preprod/Demo, akses ruang privat, dan footer khusus data live. Link Demo menuju `/app`; route Preprod tidak menampilkan market sintetis sebagai pengganti state jaringan yang gagal dibaca.

| Keadaan | Perilaku implementasi | Batas saat ini |
| --- | --- | --- |
| Deployment unavailable | Menampilkan syarat Lace, ruang privat dan konfigurasi deployment. Open live markets dinonaktifkan jika salah satu syarat belum terpenuhi. | Deployment produk belum tersedia atau dikonfigurasi lengkap. |
| Create/unlock | Menyematkan komponen `Workspace` yang sudah ada, termasuk create, unlock, backup nyata dan lock. Back to Preprod kembali ke ringkasan tanpa membuang komponen sesi. | Profil lokal independen dari Lace; membuka profil tidak membuktikan koneksi wallet. |
| Unlocked | Intro dan baris workspace menyatakan kunci lokal siap. Tombol berubah menjadi Manage workspace untuk backup atau lock. Intro tetap meminta Lace jika wallet belum tersambung. | Status unlocked saja tidak membuka market saat deployment atau wallet belum tersedia. |
| Pembacaan live | Jika semua syarat terpenuhi, SDK memverifikasi binding deployment dan membaca state finalized, posisi milik workspace serta jurnal operasi. Metadata yang gagal diverifikasi diberi penjelasan unavailable. | Alur baca jaringan belum dibuktikan oleh browser probe tanpa wallet/deployment ini. |
| Operasi tersimpan | Jurnal prepared/submitted/uncertain menampilkan kebutuhan review atau pemeriksaan hasil; rekonsiliasi hanya tersedia bila ada txId. | Tidak ada tombol stake, purchase atau claim produk yang aktif; market menyatakan transaction controls masih diintegrasikan. |

**[Fakta]** Perubahan wallet membatalkan koneksi dan hasil baca lama. Keluar route mengunci sesi; perubahan storage profil juga mengunci melalui komponen Workspace. Penghitung generasi mencegah hasil pembacaan terlambat dipasang setelah invalidasi. State gagal dibaca dibersihkan dan ditampilkan sebagai unavailable, tanpa synthetic data fallback (`LiveWorkspace.tsx`, komponen Workspace).

**[Fakta]** Gaya lokal mempertahankan konten maksimal 760px, judul 26px berbobot 300, label 12/13px dan judul panel 16px, palette app serta pill/cakram panah yang ada. Handoff hook-admin mencatat pengecualian font CSS terbatas 12/13/16/26px telah dipersistenkan sesuai skala app yang disahkan `AGENTS.md`; ini bukan perubahan token global. Detector modern tetap degraded karena parser hilang, sedangkan detector app lama yang diwajibkan menghasilkan `[]`.

## Bukti dan disposisi implementasi

**[Fakta]** `docs/evidence/live-workspace-browser.json` mencatat semua checks bernilai `true`: deployment diblokir, tanpa saldo demo, tanpa market sintetis, wallet tidak ada, unlock berhasil, keluar route mengunci, profil yang ada masuk mode unlock, dan perubahan storage mengunci. Enam screenshot juga mencatat `noOverflow: true`. Pengujian memakai profil Chrome terisolasi dan workspace sintetis lokal, tanpa wallet atau transaksi.

Enam gambar review terbaru:

| State | Desktop | Mobile |
| --- | --- | --- |
| unavailable | `.impeccable/review/live-app/unavailable-1440.png` | `.impeccable/review/live-app/unavailable-390.png` |
| create | `.impeccable/review/live-app/create-1440.png` | `.impeccable/review/live-app/create-390.png` |
| unlocked | `.impeccable/review/live-app/unlocked-1440.png` | `.impeccable/review/live-app/unlocked-390.png` |

**[Fakta]** Reviewer implementasi telah memverifikasi perbaikan copy intro dan baris workspace saat unlocked, menandai temuan tersebut resolved, dan memberi disposisi **ship** untuk permukaan koneksi serta baca yang dibatasi deployment ini. Disposisi tidak membuktikan transaksi produk atau deployment yang belum tersedia.

Dokumen ini mencatat kontrak permukaan dan bukti integrasi lokal. Handoff ini tidak mengubah `DESIGN.md`, token global, kode app, keputusan deployment, atau cakupan materi submisi.
