# Senyap demo video revision

Revision prepared 19 October 2026. Dien approved a duration of 4–5 minutes in this conversation. This edit targets **5:00**, with English narration to match the existing submission materials. Editorial instructions are in Indonesian.

**Status 19 Oktober 2026** Dien menyetujui implementasi melalui chat. Komposisi `SenyapDemoV2`, 17 scene, ilustrasi dan 90 cue subtitle telah dibuat. Dua master visual 5 menit sudah dirender dan diverifikasi, dengan subtitle panduan serta versi tanpa subtitle. Suara dan face cam tetap direkam Dien. Rincian keluaran dan rekaman suara tersedia di [handoff produksi](demo-video-v2-production.md). Draft 4 tetap tersedia.

Naskah awal dipertahankan di [versi 3 menit](demo-video-script-v1-3min.md). Sumber klaim, inventaris teknis, panduan QA, dan proses editing tersedia di [catatan revisi](demo-video-revision-notes.md).

Untuk merekam suara, gunakan [teks narasi saja](demo-voiceover-v2-5min.txt).

## Arah revisi

**[Inferensi]** Format paling sesuai adalah gabungan rekaman produk yang sudah ada dan ilustrasi pendek. Rekaman membuktikan alur bekerja. Ilustrasi menjelaskan alasan produk, batas privasi, hubungan antarkomponen, dan perilaku saat gagal.

Tiga pilihan yang dipertimbangkan adalah mempertahankan 3 menit dengan penjelasan padat, memperluas ke 5 menit dengan ilustrasi, atau memisahkan penjelasan teknis ke video tambahan. Pilihan kedua dipakai dalam rancangan ini sesuai izin durasi Dien.

**[Fakta]** Bobot yang tersimpan di tracker adalah Engineering 40%, QA 15%, Product 15%, UX 15%, Communication 10%, Business 5%. Sumber asli dan batas verifikasi ulang dijelaskan di catatan revisi. Pembagian waktu berikut merupakan keputusan editorial.

## Timeline 5 menit

| Waktu | Scene | Visual | Tujuan utama |
| --- | --- | --- | --- |
| 0:00–0:12 | 01. Produk dan pengguna | Landing dan dua kelompok pengguna | Product |
| 0:12–0:35 | 02. Masalah dengan bukti | Dua kartu sumber publik | Product |
| 0:35–0:50 | 03. Pendekatan solusi | Scout, agregat, pembeli, outcome | Product, Business |
| 0:50–1:04 | 04. Wallet dan vault | Unlock dan batas prover | UX, Engineering |
| 1:04–1:25 | 05. Scout mengirim pick | Rekaman stake market #6 | UX, Engineering |
| 1:25–1:40 | 06. Publik dan operator | Public view dan registry | Engineering |
| 1:40–2:05 | 07. Preview dan pembelian | Market #7 dan Purchases | UX, Engineering |
| 2:05–2:23 | 08. Outcome dan klaim | Market #3 yang settled | Product, Engineering |
| 2:23–2:45 | 09. Peta sistem | Diagram arsitektur progresif | Engineering |
| 2:45–3:05 | 10. Kriptografi dan akses | Tally dan tiga potongan kunci | Engineering |
| 3:05–3:27 | 11. Siklus dan akuntabilitas | Jalur A/B, jury, reputasi | Engineering |
| 3:27–3:44 | 12. QA atas serangan | Tes asli dan ilustrasi penolakan | QA |
| 3:44–4:02 | 13. QA saat layanan gagal | Status uncertain dan pemulihan | QA, UX |
| 4:02–4:15 | 14. Bukti yang dapat diperiksa | CI dan bukti Preprod | QA, Engineering |
| 4:15–4:32 | 15. Bisnis dan pilot | Alokasi pembayaran | Business |
| 4:32–4:48 | 16. Batas demo | Kartu pengungkapan | Communication |
| 4:48–5:00 | 17. Penutup | Nama dan satu ajakan | Product, Communication |

## Naskah dan arahan scene

Blockquote adalah **narasi yang dibaca Dien**. Caption merupakan ringkasan visual, bukan subtitle lengkap. Sumber dan label bukti tidak dibacakan.

### 01. Produk dan pengguna · 0:00–0:12

> Senyap is a private market for insider recommendations on Midnight. It helps ecosystems find promising builders, and builders choose ecosystems that support them.

Visual memakai hero, lalu kelompok `Ecosystem teams` dan `Builders` yang terhubung melalui sinyal.

Caption `Better builder decisions. Private recommendations.`

### 02. Masalah dengan bukti · 0:12–0:35

> The problem runs both ways. A published Arbitrum program review identified sourcing quality grant applications as a major risk. Another evaluation documented fragmented communication and disbursement problems. Our hypothesis is that insiders can improve these decisions when sharing candid experience does not require a public endorsement.

Visual dua kartu bergantian. Pertama `Finding quality applicants`, atribusi `Plurality Labs review · 2024`. Kedua `Communication and payment friction`, atribusi `ARDC evaluation · 2025`. Akhiri dengan `Hypothesis to test` untuk hubungan privasi dan kemauan memberi rekomendasi.

**[Fakta]** Review Plurality Labs melaporkan kekhawatiran Questbook tentang pencarian proposal berkualitas. [Sumber](https://forum.arbitrum.foundation/t/plurality-labs-milestone-1-review/20198).

**[Fakta]** Evaluasi ARDC membahas komunikasi terpencar, keterlambatan pelepasan dana, dan kesalahan pencairan. [Sumber](https://forum.arbitrum.foundation/t/recommendations-for-improving-the-dao-s-grant-programs/28645).

**[Inferensi]** Bukti itu mendukung masalah seleksi dan pengalaman program. Kesediaan membayar sinyal privat serta hambatan berbicara pada target Senyap masih perlu diuji. Jangan tampilkan `PMF validated`.

### 03. Pendekatan solusi · 0:35–0:50

> Scouts back an option with refundable stakes and reasons. Buyers pay for aggregate support. Rewards follow outcomes. This connects private recommendations to accountability, while keeping ordinary misses sealed.

Visual empat langkah `Back an option`, `Buy aggregate support`, `Check the outcome`, `Return stake and pay rewards`. Pisahkan aliran pokok stake dari pembayaran buyer.

Caption `Refundable stakes. Buyer-funded rewards.`

### 04. Wallet dan vault · 0:50–1:04

> I connect a wallet and unlock my encrypted vault. It stores my private state. This demo uses a local proof server, while the wallet balances, signs and pays.

Visual rekaman wallet/vault, lalu kotak `Vault`, `Local proof server`, `Wallet`. Hubungan vault ke prover berlabel `Private witness`. Jangan gambarkan prover tidak menerima informasi privat.

Caption `Encrypted local storage. Local proving.`

### 05. Scout mengirim pick · 1:04–1:25

> Here I stake fifty demo dollars on market six. The proof checks group membership and a valid sealed choice. A one-use code prevents duplicate positions. My reason goes to Veritas for screening, so that service remains a trust boundary. I can track delivery separately from the stake.

Visual stake yang tersedia. Pertahankan opsi, nominal, konfirmasi wallet, dan hasil transaksi yang dapat dibaca. Tampilkan `Demo dUSD` dan `Recorded on market #6`. Sorot status delivery hanya jika terlihat pada rekaman.

Caption `Prove eligibility. Seal the choice.`

Callout berganti dari `Compact proof` ke `Veritas screening`. Operator dan model screening dapat memproses alasan dalam bentuk terbaca. Jangan tulis `Only my vault knows my choice`.

### 06. Publik dan operator · 1:25–1:40

> Public viewers see stakes, commitments and encrypted totals. Individual picks stay sealed on the public ledger. Admissions and market approvals require three staked approvals from five registered operator keys.

Visual public view market #6 selama 7 detik, lalu registry selama 8 detik. Label `3 of 5 operator approvals` dan `500 dUSD per funded seat`. Jangan memakai gambar lima organisasi independen.

Caption `Public accounting. Sealed individual picks.`

### 07. Preview dan pembelian · 1:40–2:05

> Now we switch to market seven, where I bought a signal as a builder. After five scouts participate, the committee publishes a strength histogram. A paid buyer requests three valid decryption shares and opens the purchased total locally. The committee can also reconstruct totals, which is an explicit trust assumption.

Visual close, preview, buy, lalu `My signals` dan hasil. Pertahankan indikator pergantian market. Histogram publik hanya memperlihatkan jumlah opsi per kategori kekuatan, bukan total setiap opsi. Jangan buka agregat sebelum pembayaran.

Caption berganti antara `Preview without public option totals` dan `Purchased total opens for the buyer`.

### 08. Outcome dan klaim · 2:05–2:23

> Market three shows the completed cycle. Its buyer reported an outcome, scouts proved hits without opening misses, and claims finalized. Outcome reporting has a challenge process. These are synthetic participants on Preprod, using the same contract rules.

Visual market #3 yang settled serta hash `proveHit` dan `claim`. Label `Separate completed market #3` dan `Synthetic scouts and buyer`. Pergantian #6, #7, #3 harus terbaca sebagai contoh berbeda.

Caption `Outcome recorded. Hits proven. Claims finalized.`

### 09. Peta sistem · 2:23–2:45

> The React app uses our TypeScript SDK and Midnight.js. The indexer supplies public state. An operator API handles credentials, metadata and screened reasons. Five committee services deliver shares, and a keeper advances phases. On Midnight, the Senyap contract has fifty-two circuits, alongside a separate demo-token contract.

Visual tiga tahap. Pertama app, vault, prover, wallet. Kedua indexer, operator, komite, keeper. Pada cabang operator, label `Reclaim credentials`, `Veritas screening` dan `Hash-bound metadata` muncul bergantian. Ketiga dua kontrak, dengan label `Staged verifier installation`. Framework sekunder cukup di label. Versi dan port tetap di dokumentasi.

Caption `Client, services and contracts have distinct roles.`

Label `52 Senyap circuits` dan `Separate dUSD contract`. Jangan menyebut seluruh sistem hanya satu kontrak.

### 10. Kriptografi dan akses · 2:45–3:05

> Encrypted choices add into an ElGamal tally on JubJub. Joint key generation produces three-of-five shares. DLEQ proofs check their correctness, and encrypted buyer channels bind delivery to paid access. Shared membership proofs hide the selected scout group from the public transcript.

Visual ciphertext masuk ke tally, lalu tiga dari lima share membuka total untuk kunci buyer. Label `ElGamal`, `Joint key generation`, `DLEQ`, `X25519 + AES-GCM`, `Shared group registry` muncul satu per satu.

Caption `Add encrypted votes. Verify each opening.`

**[Fakta]** Share demo dibuat dan dijalankan di satu mesin. Visual tidak boleh menyiratkan key generation sudah tersebar ke pihak independen. Istilah DKG dijelaskan lebih tepat di catatan revisi.

### 11. Siklus dan akuntabilitas · 3:05–3:27

> The lifecycle also covers sealed ecosystem auctions, fixed-price builder purchases, subsidies, cancellation and refunds. Anonymous jurors use committed votes to resolve disputes. Proven hoaxes can trigger penalties and membership revocation. Private hit credentials support reputation renewal. These additional paths have local tests. The recorded Preprod cycle demonstrates fixed-price purchases.

Visual cabang `Ecosystems find builders` dan `Builders choose ecosystems`, lalu kelompok `Access and payment`, `Disputes and refunds`, `Private reputation`. Label persisten `Additional paths · local test evidence`.

Caption `Rules cover access, failure and accountability.`

Tambahkan label `Consent-based contact sharing` sebagai kemampuan teruji lokal. Jangan sajikan sebagai aksi Preprod yang direkam.

### 12. QA atas serangan · 3:27–3:44

> QA checks rejection paths too. Tests reject unpaid access, forged decryption shares, invalid membership and inflated payouts. Below five scouts, cancellation returns stakes. Transcript checks inspect whether private group information leaks into public operations.

Visual tiga cuplikan tes asli, masing-masing sekitar 5–6 detik. Label `Unpaid access rejected`, `Forged share rejected`, `Low participation refunded`. Pasang `Simulator and local cryptographic tests`.

Caption `Rejection paths are part of QA.`

Jangan membuat console lulus palsu. Command dan nama tes ada di catatan revisi.

### 13. QA saat layanan gagal · 3:44–4:02

> Recovery is part of the design. An uncertain transaction stays blocked until its receipt is checked. It is never automatically resubmitted. If reason screening fails, raw text is withheld. Paid signal recovery preserves access, so the buyer does not pay again.

Visual tiga keadaan bergantian. `Unknown receipt` berlanjut ke `Check status`, `Screening unavailable` ke `Retry delivery`, `Paid access retained` ke `Retry opening`. Gunakan connector grafis. Label `Illustration of tested recovery behavior`.

Caption `Unknown stays blocked. Recovery preserves access.`

Nama tes asli menjadi pendamping. Ini ilustrasi pengujian lokal, bukan rekaman outage Preprod.

### 14. Bukti yang dapat diperiksa · 4:02–4:15

> CI passes compilation, type checks, tests and build. The indexer export records one hundred fifty-seven finalized contract actions. Market three includes five hit proofs and five claims, with receipts in the repository.

Visual CI `1e798da`, lalu subset bukti hit dan claim. Label `157 indexed contract actions · snapshot 19 Oct 2026`. Angka itu menghitung aksi kontrak Senyap dalam ekspor, bukan seluruh transaksi token, pelanggan, atau pengguna.

Caption `Reproducible tests. Inspectable network receipts.`

### 15. Bisnis dan pilot · 4:15–4:32

> Ecosystem teams are the target paying customers. Buyer payments allocate eighty-five percent to scouts and fifteen percent to the platform, with part supporting builder-side subsidies. The proposed pilot tests paid demand, useful recommendations and repeat purchases. We have no paying customers yet.

Visual 100 unit menjadi 85 scout dan 15 platform. Cabang subsidi berasal dari bagian platform. Tampilkan `Proposed pilot` dengan `Paid conversion`, `Decision usefulness`, `Repeat purchase`.

Caption `A defined payer. Demand still to validate.`

### 16. Batas demo · 4:32–4:48

> Today I control every operator and committee seat. Funding wallets remain visible, and the local prover processes private witnesses. The next step is independent operators and a measured pilot. These are prototype limits, not claims of production readiness.

Visual tiga baris bergantian, `One person controls all seats`, `Funding wallets remain public`, `Local prover handles private inputs`. Detail Reclaim, alasan, versi bukti dan penalti yang belum ditegakkan tersedia di catatan revisi dan harus tersedia di dokumen submisi final.

Caption `Working prototype. Explicit trust boundaries.`

### 17. Penutup · 4:48–5:00

> Senyap turns private experience into accountable recommendations. Built on Midnight, demonstrated on Preprod. Explore the code and receipts behind the demo.

Visual nama Senyap, tagline `Private recommendations. Accountable outcomes.` dan ajakan `Explore the code and receipts`. URL repo `github.com/scientivan/senyap`. Dien memastikan akses publik saat submisi.

## Catatan perekaman

- Baca narasi baru sebagai satu naskah. Jangan menempelkan seluruh tambahan setelah narasi 3 menit karena alurnya berulang.
- Rekaman lama menjadi bahan utama. Ilustrasi masuk pada scene 02–03, 09–13, 15–17.
- Timing termasuk pergantian visual. Lakukan pembacaan nyata sebelum menetapkan timing final, khususnya istilah kriptografi.
- Output 1920×1080 pada 30 fps. Sisakan face cam 300×270 mengikuti layout lama, atau tetapkan posisi tetap saat merancang ilustrasi.
- Label `Preprod`, `Demo dUSD`, market berbeda, dan peserta sintetis harus terbaca pada scene terkait.
- Jangan tampilkan seed, password, kunci, file vault, isi `.env`, atau witness.
- Tidak ada transaksi baru yang dibutuhkan untuk rancangan edit ini.
