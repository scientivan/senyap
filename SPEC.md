# Senyap (Bisik on Midnight): Spesifikasi Lengkap

> Versi 0.14 · 15 Oktober 2026 · Status: **SPEC v0.2 disetujui Dien; kartu hibrida, batas total bobot, harga flat per opsi, durasi seleksi/toleransi waktu D-05 sisi B dan subsidi 100% ke basis hadiah scout B disetujui 15 Oktober.**
> Frontend demo ada di `apps/web`; kontrak grup/registry/market dan dUSD sudah diuji simulator. S5 browser/Lace Preprod lulus; integrasi produk dan layanan belum.
> Sumber keputusan: living doc Bisik bagian 26 (v0.59), `task-tracker.md`, `AGENTS.md`.
> Penanda: **[Keputusan Dien]** terkunci; **[Usulan]** rancangan agent yang diterima Dien pada 14 Okt,
> boleh diubah Dien kapan saja, dan setiap perubahan dicatat; **[Spike]** asumsi teknis yang wajib
> dibuktikan sebelum dipakai (lihat §9). v0.2 menambah §6.3b struct, §8.5 env, §8.6 antarmuka offchain,
> dan melengkapi §10 setelah audit agent tanpa konteks.

## Daftar isi

1. Ringkasan produk
2. Pengguna, sisi pasar, dan use case
3. Alur produk ujung ke ujung
4. Model privasi: siapa melihat apa
5. Arsitektur sistem
6. Spesifikasi kontrak Compact
7. Kriptografi: total terenkripsi, komite, lelang
8. Layanan offchain dan frontend
9. Spike teknis wajib
10. Parameter ekonomi dan default
11. Testing dan QA
12. Pemetaan ke rubrik juri
13. Kejujuran klaim, pengungkapan, dan batas yang diakui
14. Rencana build (urutan fase dan kriteria selesai)
15. Keputusan yang masih terbuka

---

## 1. Ringkasan produk

**Senyap** (bahasa Indonesia untuk "hening"; versi Solana bernama Bisik) adalah pasar sinyal orang dalam yang privat. Orang dalam
(scout) menaruh stake yang bisa dikembalikan di belakang sebuah pilihan dan menulis alasannya, tanpa
pernah membuka identitasnya. Pembeli membayar untuk melihat **total dukungan per pilihan**, bukan
pilihan per scout. Bayaran pembeli dibagi ke scout yang pilihannya terbukti benar.

- **Mekanisme adalah produknya** [Keputusan Dien, 11 Okt]. Use case hanyalah wedge.
- **Wedge Akindo** [Keputusan Dien, 14 Okt]: builder sourcing dua arah, tidak khusus Colosseum.
  - Sisi A: ekosistem blockchain mencari builder.
  - Sisi B: builder mencari ekosistem.
- **Bukan pasar prediksi**: stake dikembalikan penuh, hadiah hanya dari bayaran pembeli, tidak ada
  pihak kalah yang membayar pihak menang, hanya hoax terbukti yang di-slash.
- **Target**: menang Wave 2 Midnight Buildathon dengan submisi all out [Keputusan Dien].

## 2. Pengguna, sisi pasar, dan use case

### 2.1 Aktor

| Aktor | Peran | Identitas di chain |
|---|---|---|
| Scout | Menaruh stake + alasan di belakang opsi | Anonim (anggota grup tier) |
| Buyer ekosistem (sisi A) | Membeli sinyal tentang builder, ikut lelang eksklusif | Anonim terverifikasi (nama samaran per market) |
| Buyer builder (sisi B) | Membeli sinyal tentang ekosistem | Anonim; harga murah/gratis (disubsidi) |
| Builder terdaftar | Ikut registry secara sukarela agar bisa dinilai (subjek sisi A) | Publik (nama tim, opt-in) |
| Operator | Memverifikasi kredensial scout dan buyer offchain, menjalankan Veritas | Kunci operator publik |
| Anggota komite (5) | Memegang potongan kunci dekripsi; ambang 3 | Kunci publik terdaftar |
| Verifier outcome | Juri anonim ber-stake untuk outcome subjektif dan sengketa hoax | Anonim (grup verifier) |

### 2.2 Sisi A: ekosistem mencari builder [Keputusan Dien]

- **Subjek**: tim builder yang mendaftar sukarela ke **registry builder** (opt-in). Pendaftaran =
  persetujuan untuk dinilai, sekaligus pernyataan bahwa tim sedang mencari ekosistem.
- **Contoh pertanyaan market**: "Dari tim terdaftar berikut, mana yang paling mungkin ship produk
  produksi dalam 6 bulan?" atau "Tim mana yang belum berkomitmen ke chain mana pun dan terbuka pindah?"
- **Sinyal orang dalam yang dijual** (dari keputusan 11 Okt): waktu keputusan tim, tawaran pesaing,
  traksi yang belum publik, kebutuhan konkret, komitmen orang, peringatan. Bukan dokumen rahasia tim.
- **Outcome publik/onchain**: deploy di chain pembeli, grant dari pembeli, atau tawaran pembeli diterima.
- **Lelang eksklusif aktif** (M-13): ekosistem saling berebut tim.

### 2.3 Sisi B: builder mencari ekosistem [Keputusan Dien]

- **Scout**: builder yang sedang/pernah berada di ekosistem itu (grup per ekosistem).
- **Yang dijual**: pengalaman builder di ekosistem. Grant dibayar tepat waktu dan sesuai jumlah, review
  milestone adil, janji BD ditepati, syarat tersembunyi (eksklusivitas, lock-up), insentif benar
  mendatangkan pengguna, kualitas dukungan teknis.
- **Dilarang**: keputusan foundation yang belum diumumkan dan bisa memengaruhi harga token (pemangkasan
  program, penjualan treasury, unlock, listing, kemitraan besar). Pola tipping MNPI.
- **Pertanyaan wajib punya outcome**, contoh: "Kalau tim DeFi masuk program grant X, apakah pembayaran
  milestone cair dalam 30 hari?" Outcome dari catatan publik (Karma GAP, transaksi onchain) atau laporan
  buyer builder sendiri.
- **Tanpa lelang** (M-13). **Harga disubsidi sisi A** (M-14).
- Ambang anonimitas **k = 5** per market: hasil tidak dibuka bila scout < 5.

### 2.4 Kategori lain

Kontrak generik dengan field `category`. Kategori lain hanya tampil sebagai market contoh berlabel demo
dan roadmap di deck [Keputusan Dien, 26.14]. Kandidat yang sudah diriset dan alasannya ada di living
doc 26.14.

## 3. Alur produk ujung ke ujung

### 3.1 Siklus market

```text
Draft -> Open (scout stake) -> Closed (total terkunci) -> Preview (histogram oleh komite; nama fase, bukan network)
  -> Auction (sisi A saja, bid terenkripsi) -> Allocated (pemenang menyembunyikan <=3 opsi,
  sisanya harga tetap) -> Revealed (komite membuka total opsi yang dibeli ke tiap buyer)
  -> OutcomeWindow -> Settling (scout membuktikan hit) -> Settled (klaim ke alamat baru)
```

Sisi B melewati `Auction` dan `Allocated`: semua buyer membeli dengan harga tetap.

### 3.2 F0 Onboarding scout

1. Scout membuat `scoutSecret` di perangkatnya (private state, tidak pernah keluar).
2. Scout membuktikan kredensial ke operator offchain:
   - Sisi A: reputasi developer (zkTLS GitHub, seperti v1 Solana; username tidak pernah ke chain, D-16).
   - Sisi B: bukti pernah membangun di ekosistem X (tanda tangan dari wallet deployer kontrak di chain X,
     atau bukti penerima grant) [Usulan].
3. Operator memanggil `admitScout(tierOrGroupId, commitment)` dengan `commitment = H(scoutSecret, epoch)`.
   Operator tidak menyimpan hubungan identitas dan commitment setelah onboarding.

### 3.3 F0 Onboarding buyer

1. Buyer membuat `buyerSecret` (private state).
2. Operator memverifikasi organisasi buyer offchain (KYB ringan), lalu `admitBuyer(H(buyerSecret))` ke
   tree buyer terverifikasi dan tree **good standing**.
3. Di setiap market, buyer tampil sebagai nama samaran `H(buyerSecret, marketId)` [Keputusan Dien, M-5].

### 3.4 F1 Membuat market

- Buyer terverifikasi (membuktikan keanggotaan good standing) membuat market: kategori, sisi (A/B),
  pertanyaan (hash teks + URI), daftar opsi (ID builder terdaftar untuk sisi A), jendela waktu, flag
  lelang (wajib aktif untuk A, nonaktif untuk B), reserve price, kunci publik komite yang dipakai.

### 3.5 F2 Stake scout

Satu transaksi `stake` membuktikan sekaligus:
1. Keanggotaan grup tier/ekosistem untuk epoch berjalan (jalur Merkle dari witness).
2. Nullifier `H(scoutSecret, marketId, slot)` dengan `slot ∈ {1,2,3}` belum terpakai (maks 3 opsi per
   scout per market).
3. Commitment opsi `persistentCommit(option, salt)` disimpan.
4. N ciphertext ElGamal valid: bobot di opsi terpilih, 0 di opsi lain; ditambahkan ke total market.
5. Kartu anggota terkunci: `Enc_committee(commitment, leafIndex)` dilampirkan (untuk hoax, 26.9).
6. Komitmen kunci pembukaan identitas `H(revealPubKey)` (untuk D-15).
7. Stake token unshielded diterima kontrak (`receiveUnshielded`).

Alasan teks dikirim offchain ke operator dalam keadaan terenkripsi ke kunci komite/operator, terikat ke
nullifier posisi. Veritas menilai dan menulis ulang alasan (D-21; Gemini hanya penyedia model).

### 3.6 F3–F4 Tutup, pratinjau, lelang

- Setelah `closeTime`, `close` mengunci total.
- Komite membuka total di antara mereka **hanya** untuk histogram (berapa opsi kuat/sedang/lemah, tanpa
  nama opsi) dan menyerahkannya lewat persetujuan ambang 3-dari-5 (`postPreview`) [Keputusan Dien, M-4].
- Sisi A: buyer menawar dengan bid terenkripsi ke komite + deposit ceiling publik. Circuit membuktikan
  `bid <= ceiling`. Komite menghitung generalized second price dengan reserve, memposting hasil lewat
  persetujuan ambang (`postAuctionResult`). Bid kalah tidak pernah publik [Keputusan Dien, M-12].
- Pemenang #1 memilih hingga 3 opsi untuk disembunyikan, lalu pemenang #2 dari sisanya; buyer lain
  membeli sisa opsi dengan harga tetap **per opsi** (`buyFlat`, keputusan Dien 15 Okt). Maksimal dua buyer flat berbeda; buyer yang sama boleh membeli beberapa opsi.
- Jendela pemilihan pemenang adalah **5 menit demo / 24 jam produksi**, parameter kontrak, dimulai saat persetujuan komite ketiga memfinalkan hasil (keputusan Dien 15 Okt). Timestamp dikirim komite pada persetujuan ketiga dan wajib berada dalam rentang 0–60 detik sebelum blok finalisasi (toleransi disetujui Dien). Satu deadline bersama berlaku untuk kedua pemenang, tidak diulang saat giliran kedua. Sebelum deadline, pemenang dapat memilih; tepat pada/selepas deadline, siapa pun boleh `skipSelection` dengan mask sembunyi kosong. Hak akses berbayar tetap diberikan sesuai peringkat. Bid pemenang harus diselesaikan terlebih dahulu. Deadline harus mendahului `outcomeUntil`. Implementasi diuji simulator; belum diuji jaringan.

### 3.7 F5 Pembukaan sinyal ke buyer

- Buyer meminta pembukaan ke tiap anggota komite (offchain, terautentikasi dengan bukti nama samaran).
- Tiap anggota membaca hak akses dan kunci publik X25519 buyer dari ledger (terikat saat bid/pembelian pertama, tidak bisa diganti lewat permintaan). Anggota mengembalikan potongan dekripsi untuk opsi yang dibeli buyer itu, dienkripsi ke kunci
  buyer, dengan bukti DLEQ (Chaum-Pedersen) bahwa potongan benar.
- Buyer menggabungkan 3 potongan (Lagrange) dan membaca total per opsi. Komite tidak melihat total ini.
- Alasan yang sudah dibersihkan Veritas untuk opsi yang dibeli diberikan ke buyer.

### 3.8 F6 Pembukaan identitas atas persetujuan (D-15)

Scout boleh membuktikan "akulah pemilik posisi X" hanya kepada buyer pemenang, dengan tanda tangan dari
kunci yang commitment-nya disimpan saat stake. Kontak scout dienkripsi ke kunci buyer. Implementasi offchain menggunakan tanda tangan Ed25519 dari kunci yang komitmennya tersimpan saat stake, dengan konteks network/kontrak/market/posisi/buyer/tujuan, lalu X25519/HKDF/AES-GCM ke kunci penerima pemenang yang tercatat di ledger. SDK menolak buyer nonpemenang atau alokasi belum selesai. Integrasi halaman aplikasi belum dibuat.

### 3.9 F7 Outcome

- **Objektif** (deploy di chain pembeli, grant, pembayaran milestone tercatat): dicatat oleh buyer atau
  operator dengan hash bukti (seperti v1).
- **Subjektif atau disengketakan**: diputus **verifier anonim ber-stake** dengan suara rahasia
  commit-reveal; mayoritas menang, yang minoritas kehilangan sebagian stake, yang mayoritas dapat hadiah
  dari slash [Keputusan Dien: inovasi 5].
- Buyer wajib melapor dalam jendela outcome. Tidak melapor = pelanggaran good standing.
- **Keputusan Dien, 15 Okt (sisi B):** satu laporan buyer/operator yang sah sebelum outcomeUntil memenuhi kewajiban seluruh buyer (termasuk laporan tanpa opsi sukses). Tanpa laporan, default bersama diproses sekali dan tiap buyer berbayar dapat ditandai lalai secara terpisah, bahkan setelah default/settlement. Pencabutan good standing tetap tiga attestasi komite lalu operator. Akses berbayar/dana tidak dipotong; market batal tanpa pembelian tidak punya sanksi laporan. Rancangan: docs/side-b-report-duty-proposal.md.
- Tidak ada opsi sukses: default D-05, opsi terkuat di antara opsi yang dibeli buyer itu, dibuka komite
  lewat persetujuan ambang [M-4]. Untuk sisi B, kandidat berasal dari gabungan seluruh opsi yang pernah dibeli di market tersebut (keputusan Dien 15 Okt); satu pool/mask bersama tetap berlaku. Komite menentukan opsi terkuat dari total yang dibuka internal, kontrak memeriksa kelayakan opsi dan tiga persetujuan yang sama tanpa membuka total.
- **Pemilihan verifier** [Usulan]: verifier mendaftar dengan stake ke `verifierTree`. Untuk tiap sengketa,
  verifier ikut dengan bukti keanggotaan + nullifier `H(verifierSecret, disputeId)`; 7 suara pertama yang
  ter-commit dipakai (tanpa undian acak onchain sampai sumber keacakan Midnight diverifikasi). Kuorum
  minimal 5 suara terungkap; mayoritas sederhana; jendela commit 24 jam dan reveal 24 jam (demo dipercepat).

**Keputusan Dien, 15 Okt:** stake 100 dUSD dikunci per sengketa, bukan jaminan yang dipakai ulang lintas kasus. Pada putusan sah, minoritas kehilangan 50%, verifier tidak reveal kehilangan 100%, dan penalti dibagi ke mayoritas. Bila suara terungkap kurang dari 5 atau seri, kasus tidak diputuskan dan seluruh bond dikembalikan tanpa slash scout. Bond pelapor 50 dUSD dikembalikan bila hoax terbukti; bila laporan ditolak, bond dibagi kepada verifier mayoritas. Keanggotaan verifier tetap dibuktikan anonim.

Implementasi simulator mengunci dana per kasus dan menyimpan sisa pembulatan pembagian penalti terpisah dari pendapatan market. Demo memakai jendela commit/reveal 300 detik; produksi memakai parameter 86400 detik masing-masing.

### 3.10 F8 Sengketa hoax

- Sengketa hanya dapat dibuka setelah market memenuhi minimal 5 scout dan memiliki pembelian atau alokasi pemenang lelang (keputusan Dien 15 Okt). Siapa pun membuka sengketa terhadap posisi (dengan bond), sebelum `outcomeUntil` (keputusan Dien 15 Okt). `proveHit` dan klaim menunggu jendela outcome berakhir serta seluruh sengketa selesai. Posisi hoax dikeluarkan dari hadiah sebelum denominator/credential hit dibentuk.
- Hoax terbukti: stake posisi di-slash ke alamat amal; komite membuka kartu anggota terkunci; operator
  memanggil `revokeMember(group, leafIndex)` dan kontrak mereset riwayat root grup.

### 3.11 F9 Settlement dan klaim

- Scout membuktikan dengan ZK bahwa opsi yang dikomit termasuk mask sukses buyer `b` dan mendaftarkan
  bobotnya ke denominator buyer itu (`proveHit`). Opsi yang meleset tidak pernah dibuka.
- Setelah jendela pendaftaran hit tutup, `claim` membayar stake + `pool_b * 85% * weight / denom_b` ke
  **alamat bebas** mana pun (`sendUnshielded`), dengan nullifier klaim agar tidak dobel. Untuk sisi B, rumus menjadi `floor((pool_b × 8500 + subsidy × 10000) × weight / (10000 × denom_b))`; subsidi tidak terkena potongan 15% kedua (keputusan Dien 15 Okt). Sisa pembulatan tetap mengikuti aturan platform yang telah disetujui.
- Posisi yang meleset hanya mengklaim stake kembali.
- Setiap hit menerbitkan **credential hit** ke `hitTree` (leaf `H(scoutSecret, positionNullifier)`).

**Pembatalan (Dien, 15 Okt):** market boleh dibatalkan permissionless setelah tutup bila scout kurang dari 5, atau pada/selepas `outcomeUntil` bila tidak ada pembelian. Seluruh stake dan escrow bid kembali penuh, tanpa hadiah atau pembukaan pilihan. Subsidi pada market B yang batal dikembalikan ke alokasi market A asal dan memulihkan kapasitas 5 poin persennya untuk dialokasikan lagi. Pembatalan memakai fase 10; refund tidak membutuhkan pembukaan pilihan. Circuit pembatalan, refund dan pengembalian alokasi diuji simulator; belum transaksi jaringan.

### 3.12 F10 Reputasi portabel dan epoch [Keputusan Dien, M-11]

- Tier hanya berlaku satu epoch.
- Untuk epoch berikutnya scout memanggil `renewTier`: membuktikan kepemilikan ≥h credential hit (tiap
  credential dipakai sekali per epoch lewat nullifier), lalu memasukkan commitment baru
  `H(scoutSecret, epoch+1)` ke tree tier yang sesuai. Meleset tidak pernah dibuka.
- Implementasi mengindeks credential ke tree append-only per epoch penerbitan, sambil mempertahankan `hitTree` global. Epoch penerbitan diverifikasi dengan batas waktu blok. Saat renew, path dan identifier posisi tetap witness privat; yang diungkap hanya root credential, epoch dan nullifier sekali pakai yang terikat kontrak/secret/posisi/epoch tujuan.
- Renew dilakukan selama tier sumber masih berlaku untuk epoch berikutnya dengan sisi/ekosistem sama. Pertahankan tier membutuhkan satu hit dari epoch berjalan/sebelumnya; naik satu membutuhkan dua hit epoch berjalan, naik dua membutuhkan tiga. Satu scout hanya dapat renew sekali untuk sisi/ekosistem dan epoch tujuan.
- Scout baru mendapat tier awal dari kredensial onboarding.

## 4. Model privasi: siapa melihat apa

| Data | Publik | Buyer yang membeli | Komite | Operator |
|---|---|---|---|---|
| Identitas scout | ❌ | ❌ (kecuali D-15 atas persetujuan) | ❌ (kecuali hoax terbukti: hanya commitment) | Sesaat saat onboarding |
| Opsi per posisi | ❌ | ❌ | ❌ | ⚠️ ya, lewat alasan (asumsi #6 v1) |
| Total per opsi | ❌ | ✅ opsi yang dibeli | ⚠️ hanya untuk histogram dan D-05 | ❌ |
| Nominal stake per posisi | ✅ (unshielded) | ✅ | ✅ | ✅ |
| Wallet pendana stake | ✅ (kelemahan, 26.10) | ✅ | ✅ | ✅ |
| Identitas buyer | ❌ (nama samaran per market) | – | ❌ | ✅ saat verifikasi |
| Nilai bid | ❌ | ❌ | ✅ kolektif | ❌ |
| Alasan scout | ❌ | ✅ versi Veritas, opsi yang dibeli | ✅ terenkripsi | ✅ plaintext untuk Veritas |
| Hit/meleset posisi | Hit terlihat saat `proveHit`; meleset ❌ | – | – | – |

## 5. Arsitektur sistem

```text
                 +-------------------- Midnight Preprod --------------------+
                 |  senyap.compact (market, grup, stake, tally, lelang,      |
                 |                 outcome, settlement, reputasi, verifier)  |
                 |  dusd.compact  (token unshielded demo)                    |
                 +-----------^---------------------^-------------------------+
                             | tx (proof)          | indexer GraphQL
   +-------------+   +-------+--------+   +--------+---------+   +-------------------+
   | apps/web    |-->| Lace (dapp      |   | services/keeper  |   | apps/committee x5 |
   | React+Vite  |   | connector)      |   | (transisi fase)  |   | (potongan kunci,  |
   +------+------+   +-----------------+   +------------------+   |  DLEQ, persetujuan)|
          |                                                       +-------------------+
          v
   +-------------+
   | apps/operator| verifikasi kredensial, Veritas (Gemini), relay alasan terenkripsi
   +-------------+
```

### 5.1 Struktur repo [Usulan]

```text
Akindo/
  contracts/            senyap.compact, dusd.compact, generated managed/
  packages/crypto/      ElGamal JubJub, threshold (Shamir + Lagrange), DLEQ, baby-step giant-step
  packages/sdk/         wrapper Midnight.js, witnesses, private state, tipe market
  apps/web/             frontend React + Lace
  apps/operator/        API verifikasi, Veritas, relay alasan
  apps/committee/       node komite (5 instance konfigurasi berbeda)
  services/keeper/      penggerak siklus market
  tests/                simulator unit, integrasi local network, e2e Preprod
  docs/                 arsitektur, keputusan, deck, naskah video
  LICENSE (Apache-2.0)  README.md (termasuk pengungkapan 26.17)
```

### 5.2 Toolchain [Fakta, support matrix Midnight]

`compact compile` 0.31.1 (pasang dengan `compact update 0.31.1`), devtools 0.5.1, `compact-runtime`
0.16.0, ledger 8, Midnight.js 4.1.1, proof server 8.1.3, wallet SDK 1.2.0, Node 24.x (terpasang v24.10.0). Override npm
`onchain-runtime-v3` ke 3.0.0 bila terjadi konflik instanceof (temuan peserta lain, belum diverifikasi).

## 6. Spesifikasi kontrak Compact

> Nama dan tipe adalah rancangan. Sintaks final mengikuti hasil spike §9. N opsi maksimum per market
> diusulkan **8** (bukan 16 seperti v1) untuk membatasi ukuran circuit ElGamal [Usulan, dikonfirmasi S2].

### 6.1 State ledger utama

| Field | Tipe (rancangan) | Isi |
|---|---|---|
| `operator` | `Bytes<32>` (sealed) | Commitment kunci operator |
| `committee` | `Vector<5, JubjubPoint>` + `committeePk: JubjubPoint` | Kunci publik per anggota dan kunci gabungan |
| `scoutGroups` | `Map<GroupId, HistoricMerkleTree<20, Bytes<32>>>` [Spike S6: Map berisi tree] | Grup tier sisi A dan grup ekosistem sisi B per epoch |
| `scoutRegistry` | `HistoricMerkleTree<32, Bytes<32>>` | Registry bersama metadata/root grup untuk bukti grup privat (S11) |
| `missedSharedReports` | `Set<Uint<32>>` | Marker laporan B terlewat, tetap tersedia setelah settlement untuk penandaan buyer terpisah |
| `buyerTree`, `goodStanding` | `HistoricMerkleTree<16, Bytes<32>>` | Buyer terverifikasi dan bereputasi baik |
| `verifierTree` | `HistoricMerkleTree<16, Bytes<32>>` | Verifier outcome ber-stake |
| `builderRegistry` | `Map<Bytes<32>, BuilderEntry>` | Tim opt-in (hash profil, status persetujuan) |
| `markets` | `Map<Uint<32>, Market>` | Metadata, fase, waktu, flag lelang, harga, pool |
| `tally` | `Map<Uint<32>, Vector<8, CipherPair>>` [Spike S1] | Total terenkripsi per opsi |
| `positions` | `Map<Bytes<32>, Position>` | Kunci = nullifier posisi; commitment opsi, bobot, kartu terkunci, status |
| `usedNullifiers` | `Set<Bytes<32>>` | Nullifier stake, klaim, credential |
| `hitTree` | `HistoricMerkleTree<20, Bytes<32>>` | Credential hit |
| `bids` | `Map<Bytes<32>, Bid>` | Ciphertext bid + ceiling + nama samaran |
| `approvals` | `Map<Bytes<32>, Counter>` | Hitungan persetujuan komite per hasil |

### 6.2 Circuit (export)

| Circuit | Pemanggil | Inti pembuktian / efek |
|---|---|---|
| `init` (constructor) | Deployer | Set operator, kunci komite, parameter |
| `admitScout`, `admitBuyer`, `admitVerifier` | Operator | Sisipkan commitment ke tree |
| `revokeMember` | Operator setelah persetujuan komite | Ganti leaf dengan default, `resetHistory` |
| `registerBuilder`, `withdrawBuilder` | Builder | Opt-in/opt-out registry |
| `createMarket` | Buyer good standing | Keanggotaan + nama samaran; simpan market |
| `stake` | Scout | §3.5 butir 1–7 |
| `close` | Siapa pun setelah waktu | Fase -> Closed |
| `postPreview`, `postAuctionResult`, `postDefaultStrongest` | Anggota komite | Satu persetujuan per anggota; hasil berlaku saat ≥3 |
| `placeBid` | Buyer good standing | Ciphertext bid valid, `bid <= ceiling`, deposit ceiling |
| `selectHidden`, `skipSelection`, `buyFlat` | Buyer | Alokasi opsi, pembayaran ke pool |
| `settleBid` | Siapa pun | Pemenang bayar harga, refund sisa deposit |
| `recordOutcome` | Buyer atau operator | Mask sukses + hash bukti (outcome objektif) |
| `openDispute`, `commitVote`, `revealVote`, `resolveDispute` | Siapa pun / verifier | Sengketa dan outcome subjektif dengan suara rahasia |
| `proveHit` | Scout | Opsi terkomit ∈ mask; tambah bobot ke denominator; terbitkan credential hit |
| `claim` | Scout | Nullifier klaim; kirim stake + payout ke alamat bebas |
| `renewTier` | Scout | ≥h credential hit; sisipkan commitment epoch berikut |
| `markMissedReport`, `markMissedSharedBuyer` | Keeper/siapa pun | Laporan terlewat A/shared B dan penandaan buyer B terpisah; antrean pencabutan good standing |
| `mint` (dusd.compact) | Faucet demo | Token demo berlabel |

### 6.3 Witness (TypeScript, private state)

`scoutSecret`, `buyerSecret`, `verifierSecret`, `merklePath(group, leaf)`, `option`, `optionSalt`,
`elgamalRandomness[8]`, `bidAmount`, `bidRandomness`, `revealKey`, `hitCredentials[]`, `buyerX25519Secret` (kunci untuk menerima potongan dekripsi dari komite; disimpan di private state buyer). Nilai yang harus
tetap disimpan di private state, tidak dibuat acak ulang tiap panggilan (peringatan docs witness).

### 6.3b Struct (rancangan) [Usulan]

```text
GroupId      = Bytes<32>                      // H("tier", level, epoch) atau H("eco", ecosystemId, epoch)
LockedCard   = { version: Uint<8>, ephemeral: JubjubPoint, ciphertext: Bytes<40>, tag: Bytes<32> }
CipherPair   = { c1: JubjubPoint, c2: JubjubPoint }   // cadangan M-8: { c1x, c1y, c2x, c2y: Field }
BuilderEntry = { profileHash: Bytes<32>, consent: Boolean, registeredAt: Uint<64> }
Market       = { id: Uint<32>, side: Uint<8> (0=A,1=B), category: Bytes<32>, questionHash: Bytes<32>,
                 questionUri: Opaque<"string">, nOptions: Uint<8>, optionRefs: Vector<8, Bytes<32>>,
                 creatorPseudonym: Bytes<32>, phase: Uint<8>, openUntil: Uint<64>, auctionUntil: Uint<64>,
                 outcomeUntil: Uint<64>, auction: Boolean, flatPrice: Uint<64>, reservePrice: Uint<64>,
                 scouts: Uint<32>, stakeTotal: Uint<128>, successMask: Vector<4, Uint<16>>,
                 pools: Vector<4, Uint<128>>, denoms: Vector<4, Uint<64>>, buyerCount: Uint<8> }
Position     = { marketId: Uint<32>, optionCommit: Bytes<32>, weight: Uint<64>, stake: Uint<128>,
                 lockedCard: GroupCard, revealKeyCommit: Bytes<32>, status: Uint<8> }
GroupCard    = { version: Uint<8> (=2), ephemeral: JubjubPoint, ciphertext: Bytes<72>, tag: Bytes<32> }
Bid          = { marketId: Uint<32>, pseudonym: Bytes<32>, enc: CipherPair, ceiling: Uint<128>, refunded: Boolean }
```

- `draft` = market sudah dibuat tapi metadata (teks dan label) belum terkonfirmasi di operator API; `createMarket` langsung ke `open` bila metadata sudah ada.
- Fase sebagai `Uint<8>`: 0 draft, 1 open, 2 closed, 3 preview, 4 auction, 5 allocated, 6 revealed,
  7 outcome, 8 settling, 9 settled, 10 cancelled.
- Teks pertanyaan dan label opsi disimpan offchain (operator API, bagian 8.6); onchain hanya hash + URI.
  Untuk sisi A, `optionRefs` berisi kunci `builderRegistry`.
- Token dUSD: `senyap.compact` menerima `color` token dUSD sebagai parameter konstruktor.
- Batas ukuran Map/Vector final mengikuti hasil spike S1, S2, S6.

### 6.4 Aturan `disclose`

Hanya nilai berikut yang boleh dibuka ke ledger: nullifier, commitment, ciphertext, nama samaran, bobot
posisi, nominal stake, hasil yang disetujui komite. Opsi, secret, salt, randomness tidak pernah di-`disclose`.

## 7. Kriptografi

### 7.1 Total terenkripsi (ElGamal aditif di JubJub) [Keputusan Dien, inovasi 1]

- Kunci komite `PK = d·G`; `d` dibagi Shamir 3-dari-5; anggota j memegang `d_j`, kunci publik
  `Y_j = d_j·G` tersimpan di ledger.
- Untuk opsi i: `C1_i = r_i·G`, `C2_i = w_i·G + r_i·PK`, dengan `w_i = weight` bila i = opsi terpilih,
  selain itu 0. Circuit membuktikan bentuk ini dengan `ecMulGenerator`, `ecMul`, `ecAdd` [Spike S1, S7].
- Total: `Σ C1_i`, `Σ C2_i` per opsi, dijumlahkan langsung di ledger.
- Pembukaan: `W_i·G = ΣC2_i − d·ΣC1_i`; `W_i` dicari dengan baby-step giant-step. Bobot dibatasi
  (contoh `weight < 2^32`) agar pencarian cepat [Usulan].
- **Pembuatan kunci untuk demo**: dealer tepercaya membagi `d` lalu menghapusnya; diungkap di README.
  DKG tanpa dealer (Pedersen/Feldman) adalah kandidat inovasi Wave 3.
- **Cadangan bertingkat** [Keputusan Dien, M-8]: (1) simpan koordinat sebagai `Field` lalu
  `constructJubjubPoint`; (2) bila tetap gagal, opsi terenkripsi offchain ke komite + commitment onchain.

**Batas dekripsi (disetujui Dien, 15 Okt):** jumlah bobot publik seluruh posisi dalam satu market wajib `< 2^40`. Ini lebih ketat dari batas per opsi sebelumnya dan menjamin seluruh total opsi tetap dapat dicari tanpa membuka distribusi dukungan.

### 7.2 Pembukaan untuk buyer

Potongan `D_j = d_j·ΣC1_i` dikirim ke buyer terenkripsi, disertai bukti DLEQ bahwa `log_G Y_j =
log_{ΣC1_i} D_j`. Buyer memverifikasi, menggabungkan 3 potongan dengan koefisien Lagrange.

### 7.3 Persetujuan komite onchain

Tiap anggota memanggil circuit `post*` dengan membuktikan pengetahuan secret autentikasinya
(`H(memberAuthSecret)` terdaftar). Hasil yang sama dari ≥3 anggota mengubah state.

### 7.4 Lelang

Bid = ElGamal(bid) ke `PK` + bukti `bid <= ceiling` di circuit. Komite mendekripsi kolektif, menghitung
generalized second price dua slot dengan reserve (seperti v1), memposting hasil lewat persetujuan.
[Inferensi] Komite melihat nilai bid secara kolektif; trust sama dengan komite dekripsi.

### 7.5 Kartu anggota terkunci

`Enc_PK(commitment || leafIndex)` dilampirkan di `stake` (scout) dan `createMarket`/`placeBid` (buyer).
Circuit membuktikan isinya sama dengan leaf yang dipakai untuk bukti keanggotaan. Dibuka komite hanya
saat hoax terbukti atau pelanggaran buyer.

**Penyempurnaan disetujui Dien, 15 Okt:** payload 32 byte commitment dan 8 byte indeks memakai
kartu hibrida JubJub + hash, bukan satu pasangan ElGamal aditif yang memerlukan log diskret besar.
Format versi 1 menyimpan titik ephemeral, ciphertext 40 byte dan tag 32 byte; indeks scout dibatasi
20 bit. Hash persisten dengan domain berbeda menghasilkan stream per blok dan tag terikat konteks.
Potongan DH tetap 3-dari-5 dan diverifikasi DLEQ. Implementasi kandidat berada di
`contracts/lib/LockedCardEncryption.compact` dan `packages/crypto/src/locked-card.ts`.
S10 sudah lulus simulator dan proving lokal (docs/evidence/S10-proving.json); validasi mencakup kecocokan Compact/TypeScript, seluruh kombinasi tiga anggota, penolakan
potongan/konteks/ciphertext salah serta proving lokal sebelum integrasi. Hasil pengujian bukan audit
kriptografi independen. Siapa yang boleh meminta pembukaan tetap ditegakkan layanan komite.

## 8. Layanan offchain dan frontend

### 8.1 Operator (`apps/operator`)

- Verifikasi kredensial scout: Reclaim zkTLS GitHub (sisi A), bukti builder ekosistem (sisi B).
- KYB ringan buyer.
- Veritas: skor duplikasi D dan kemungkinan AI A, `DRS = 1 − (1 − D)(1 − A)`; pemisahan klaim vs opini;
  penulisan ulang untuk menghapus detail pengenal. Skor = penanda, bukan dasar slash.
- Relay alasan terenkripsi dan penyerahan alasan ke buyer.

### 8.2 Komite (`apps/committee`)

5 proses dengan potongan kunci berbeda. Endpoint: potongan dekripsi + DLEQ untuk buyer terautentikasi,
hitung histogram/D-05/lelang di antara anggota, kirim persetujuan onchain.

Operator mengalokasikan subsidi secara publik lewat `allocateSubsidy(sourceA, targetB, amount)`. Batas kumulatif per sumber adalah `floor(pendapatan buyer A × 500 / 10000)` setelah pendapatan sumber dibekukan. Target harus sudah memiliki pratinjau dan lima scout, serta belum masuk outcome. Alokasi tidak mengubah denominator atau pool yang sudah dibekukan; remainder sumber dikurangi agar dana tidak dihitung dua kali. Subsidi hanya berasal dari pendapatan buyer, tidak dari pokok stake.

### 8.3 Keeper (`services/keeper`)

Memicu `close`, jadwal pratinjau, `settleBid`, penutupan jendela, `markMissedReport`, rotasi epoch.

### 8.4 Frontend (`apps/web`) [Keputusan Dien: web + Lace di W2]

- Vite + React + TypeScript; network `preprod` (diubah dari preview pada 14 Okt, M-7). API resmi `@midnight-ntwrk/dapp-connector-api` 4.0.1 dan Midnight.js 4.1.1 terpasang; koneksi Lace asli dan spike counter Preprod sudah terbukti, integrasi aksi produk belum.
- Halaman: landing, panduan, daftar market (sisi A/B), detail market (histogram, lelang, beli), stake
  scout, posisi scout (hit, klaim, renew tier), registry builder, profil buyer (good standing),
  operator, komite (status), verifier (suara), faucet dUSD demo.
- Design system sudah dibangun dan dicatat di `DESIGN.md` (landing dan halaman app selesai dengan data demo).
  Palet dan motif Bisik Colosseum tidak disalin.

### 8.5 Variabel lingkungan (`.env` di root, nama dicatat di `.env.example`) [Usulan]

| Nama | Dipakai oleh | Isi |
|---|---|---|
| `MIDNIGHT_NETWORK` | semua | `undeployed` (local) atau `preprod` |
| `BLOCKFROST_PROJECT_ID_PREPROD` | deploy script, operator, keeper | Token proyek Blockfrost milik Dien. **Tidak pernah masuk `apps/web` atau variabel `VITE_*`** |
| `PROOF_SERVER_URL` | deploy script, layanan | Default `http://localhost:6300` |
| `DEPLOYER_SEED` | deploy script | Seed wallet deployer (dibuat dan didanai Dien) |
| `OPERATOR_SECRET` | operator | Secret autentikasi operator |
| `COMMITTEE_SHARE_1` … `COMMITTEE_SHARE_5` | node komite | Potongan kunci Shamir, satu per proses. Di demo kelima node berjalan di satu mesin tim, jadi satu mesin memegang seluruh kunci; wajib diungkap di README |
| `COMMITTEE_AUTH_SECRET_1` … `_5` | node komite | Secret autentikasi persetujuan onchain |
| `GEMINI_API_KEY` | operator (Veritas) | Kunci Gemini milik Dien |
| `GEMINI_GENERATION_MODEL`, `GEMINI_EMBEDDING_MODEL` | operator (Veritas) | Model ID eksplisit untuk endpoint generation/embedding yang tersedia di akun Dien; tidak diasumsikan dari default lama |
| `RECLAIM_APP_ID`, `RECLAIM_APP_SECRET`, `RECLAIM_PROVIDER_ID` | operator | Kredensial Reclaim milik Dien (provider GitHub v1 Bisik) |
| `VITE_SENYAP_CONTRACT_ADDRESS`, `VITE_OPERATOR_API_URL`, `VITE_COMMITTEE_URLS` | `apps/web` | Hanya nilai publik |

### 8.6 Antarmuka offchain (rancangan) [Usulan]

- Operator API (`apps/operator`, HTTP JSON, port 8787): `POST /credentials/scout` (bukti Reclaim atau
  tanda tangan deployer + commitment), `POST /credentials/buyer`, `POST /reasons` (alasan terenkripsi
  terikat nullifier), `GET /markets/:id/reasons` (versi Veritas untuk opsi yang dibeli, autentikasi bukti
  nama samaran), `POST /markets/meta` dan `GET /markets/:id/meta` (teks pertanyaan dan label opsi).
- Node komite (`apps/committee`, port 8801–8805): `POST /share` (buyer meminta potongan dekripsi; dibalas
  potongan terenkripsi ke kunci publik X25519 buyer + bukti DLEQ), `POST /internal/preview`,
  `POST /internal/auction`. Antarnode memakai secret bersama dari `.env`.
- Pembacaan state ledger dari web: indexer Midnight (GraphQL) lewat Midnight.js; detail endpoint diisi
  setelah spike S5.
- Veritas: port logika dari repo Bisik `packages/veritas` (rujukan, ditulis ulang di `apps/operator`).
- Pemetaan store demo (`apps/web/src/app/data/store.tsx`) ke kontrak: `stake` ke circuit `stake` + `POST /reasons`;
  `bid` ke `placeBid`; `buy` ke `buyFlat` + `POST /share` ke 3 node komite; `recordOutcome` ke `recordOutcome`;
  `proveHit`, `claim`, `renewTier` ke circuit bernama sama; `registerTeam` ke `registerBuilder`; `createMarket` ke
  `createMarket` + `POST /markets/meta`; halaman Operator ke `admitScout`/`admitBuyer`; Committee ke
  `postPreview`/`postAuctionResult`; Verify ke `commitVote`/`revealVote`. Hanya demo: `advance` (diganti keeper),
  `mint` (diganti `dusd.mint` berlabel demo), `reset` (dihapus di mode nyata). Semua aksi async dengan state
  pending, submitted (tx id), error.

### 8.6a Format metadata yang diimplementasikan

Metadata publik v1 mengikat pertanyaan dan label opsi pada satu `questionHash`.
Hash adalah SHA-256 UTF-8 JSON `["senyap:market-metadata:v1", side, category, question,
[[reference,label],...]]`, dengan urutan opsi sama seperti ledger. Format, batas
dan prosedur upload setelah market finalized dijelaskan di `docs/services.md`
bagian Public market metadata. Implementasi ini tidak mengubah mekanisme kontrak;
format circuit tetap hash 32-byte. Klien memverifikasi seluruh dokumen dan referensi
opsi, serta tidak mengambil `questionUri` sembarang.

## 9. Spike teknis wajib

Dikerjakan pertama setelah aba-aba. Masing-masing menghasilkan kontrak/test kecil + catatan hasil.

| ID | Pertanyaan | Lulus bila |
|---|---|---|
| S1 | Bisakah `JubjubPoint` (atau koordinatnya) disimpan di `Map`/`Vector` ledger dan dijumlahkan dengan `ecAdd` lintas transaksi? | Total dua stake terbaca benar setelah dekripsi offchain |
| S2 | Ukuran circuit dan waktu proving `stake` dengan 8 pasang ElGamal + Merkle depth 20 | Kompilasi lulus dan proving selesai di proof server lokal |
| S3 | Token unshielded demo: mint, `receiveUnshielded` ke kontrak, `sendUnshielded` ke alamat lain | Saldo berubah sesuai di local network |
| S4 | Apakah panggilan circuit membocorkan identitas pemanggil (wallet/DUST)? | Catatan faktual apa yang terlihat di transaksi |
| S5 | Lace + proving dari browser di Preprod | Satu circuit dipanggil dari web |
| S6 | `Map` berisi `HistoricMerkleTree`, `insertIndexDefault` + `resetHistory` untuk pencabutan | Bukti keanggotaan lama ditolak setelah pencabutan |
| S7 | Konversi `Uint`/`Field` ke `JubjubScalar` untuk `ecMul` | Bobot terenkripsi = bobot yang diharapkan |
| S8 | Verifikasi DLEQ dan Lagrange di TypeScript cocok dengan titik dari runtime Compact | Test lintas paket lulus |
| S10 | Kartu anggota hibrida JubJub + hash, sesuai persetujuan 15 Okt | Payload 256-bit + indeks pulih utuh, semua kombinasi 3-dari-5 valid, data salah ditolak dan proving lokal lulus |
| S9 | Pembagian integer dan pengali pecahan di circuit (Compact mungkin tidak punya `/` untuk Uint): hasil bagi dari witness lalu dicek `q × d + r == n`, `r < d` | Bobot, payout, dan epoch dihitung benar di test |

## 10. Parameter ekonomi dan default

| Parameter | Nilai | Status |
|---|---|---|
| Stake per posisi | 10–500 dUSD, refundable | Dibawa dari v1 [Usulan] |
| Opsi per scout per market | Maks 3 | D-17/v1 |
| Opsi per market | Maks 8 | [Usulan, S2] |
| Pembagian bayaran buyer | 85% scout / 15% platform | v1, 12 Okt |
| Subsidi sisi B | Maksimal 5 dari 15 poin persen platform sisi A; 100% subsidi masuk basis hadiah scout B, pembayaran buyer B tetap 85/15 | [Keputusan Dien, O-1 disetujui 14 Okt, pembagian subsidi disetujui 15 Okt] |
| Bobot | stake × pengali tier × bonus awal | v1 |
| Ambang anonimitas | k = 5 per grup dan per market | v1 + 26.15 |
| Komite | 3-dari-5 | [Keputusan Dien, M-6] |
| Lelang | Generalized second price 2 slot + reserve; pemenang sembunyikan ≤3 opsi | v1, sisi A saja |
| Slash hoax | Stake posisi ke alamat amal | v1 |
| Epoch tier | Usulan 30 hari (demo dipercepat) | v1 + M-11 |
| Aturan tier per epoch | Tidak renew = keluar dari grup (tier kedaluwarsa, M-11) dan kembali lewat onboarding sebagai tier 1. Pertahankan tier: >=1 hit dalam 2 epoch terakhir. Naik 1: >=2 hit di epoch berjalan. Naik 2: >=3 hit. Hoax terbukti: dicabut dari grup | [Keputusan Dien, parameter disetujui 14 Okt] |
| Pengali tier dalam bobot | Tier 1 = 1,0; tier 2 = 1,25; tier 3 = 1,5 (tier dibuktikan lewat grup tempat bukti keanggotaan dibuat) | [Usulan] |
| Bonus awal dalam bobot | 1,2 bila stake di 25% pertama jendela Open, selain itu 1,0 (dihitung dari `blockTimeLt`) | [Usulan] |
| Rumus bobot | `weight = stake × pengali_tier × bonus_awal`, dibulatkan ke bawah ke integer, dibatasi `< 2^32` | [Usulan] |
| Ambang histogram | Kuat: bobot >= 50% bobot tertinggi. Lemah: < 20%. Sisanya sedang (sama dengan v1 dan store demo) | v1 |
| Pembulatan payout | `floor(pool × 8500 × weight / (10000 × denom))`; sisa pembulatan ke platform | [Usulan] |
| Opsi < 8 | Ciphertext slot kosong tetap ditambahkan (enkripsi 0) agar bentuk transaksi sama untuk semua market | [Usulan] |
| Banyak buyer | `proveHit(b)` dipanggil per buyer `b` yang mask suksesnya memuat opsi posisi; denominator per buyer | [Usulan] |
| Jendela waktu (produksi / demo) | Open 48 j / 10 mnt · Lelang 24 j / 5 mnt · Pendaftaran hit 72 j / 5 mnt · Outcome 30 hari / 10 mnt · Sengketa commit 24 j + reveal 24 j / 3 + 3 mnt | [Usulan] |
| Penegakan k = 5 | Slot dipakai berurutan (circuit membuktikan slot n hanya bila nullifier slot n-1 milik scout yang sama sudah ada); `scouts` bertambah hanya saat slot = 1. Kontrak menolak `buyFlat`/pembukaan bila `scouts < 5`; komite juga menolak membuka | [Usulan] |
| Desimal dUSD | 0 desimal (1 unit = 1 dUSD) agar bobot dan total per opsi muat untuk baby-step giant-step; batas total seluruh market `< 2^40` (penyempurnaan disetujui Dien, 15 Okt) | [Usulan] |
| Pengali dalam circuit | Ditulis sebagai bilangan bulat: tier 100/125/150, bonus awal 100/120; bobot = `stake × pengaliTier × bonus / 10000` dengan hasil bagi diberikan witness dan dicek lewat perkalian (lihat spike S9) | [Usulan] |
| Batas buyer per market | Sisi A: maks 4 buyer berbayar (2 pemenang lelang + 2 flat) mengikuti vektor `pools`/`denoms`. Sisi B: satu pool dan satu mask untuk semua buyer (outcome tunggal) | [Keputusan Dien, O-9 disetujui 14 Okt] |
| Alamat amal | Konstanta konfigurasi kontrak, diisi Dien sebelum deploy; demo memakai alamat burn berlabel | [Usulan, menunggu Dien] |
| Sumber epoch | `epoch = floor(blockTime / panjang_epoch)` dari kontrak; panjang epoch parameter konstruktor | [Usulan] |
| Autentikasi operator | Operator membuktikan pengetahuan `operatorSecret` dengan `H(operatorSecret)` yang disimpan sealed di konstruktor | [Usulan] |

## 11. Testing dan QA (rubrik QA 15%)

- **Unit simulator** per circuit (**Vitest**, satu runner untuk seluruh workspace, dengan kelas `Contract` hasil kompilasi): jalur sukses dan
  penolakan (slot ke-4, nullifier ganda, root salah, bobot salah, bid > ceiling, klaim ganda, renew
  dengan credential dipakai ulang, anggota dicabut).
- **Kriptografi**: ElGamal homomorfik, Shamir/Lagrange, DLEQ, baby-step giant-step, property test.
- **Integrasi** local network: satu siklus market sisi A penuh dan satu sisi B.
- **E2E Preprod**: skrip demo yang sama dengan video.
- **CI**: GitHub Actions menjalankan `compact compile` + test (bukti gerbang kompilasi untuk juri).
- **Riwayat commit** rapi dan bermakna (rubrik Google Doc menilai version control).

## 12. Pemetaan ke rubrik juri

| Kriteria (bobot resmi) | Bukti yang ditunjukkan |
|---|---|
| Engineering 40% | Kontrak Compact terkompilasi; private state (secret, salt, credential); dual-ledger (publik: total terenkripsi, nullifier; privat: opsi, identitas); ElGamal + komite; README arsitektur |
| QA 15% | Suite simulator + integrasi + CI hijau; demo stabil |
| Product 15% | Masalah dua sisi berbukti (living doc 26.14–26.15); roadmap W3 realistis |
| UX 15% | Web + Lace ujung ke ujung, umpan balik status transaksi, label demo jujur |
| Communication 10% | Deck + video menjelaskan mekanisme dan nilai edukatif tentang Midnight; posting publik |
| Business 5% | Pembeli sisi A punya anggaran (grant/BD), subsidi sisi B, jalur adopsi |

## 13. Kejujuran klaim, pengungkapan, dan batas yang diakui

- README memuat teks pengungkapan living doc 26.17 (asal Colosseum + daftar inovasi Midnight). Butir yang
  belum selesai saat submit dipangkas atau diberi label.
- Data demo (tim, scout, ekosistem) sintetis dan diberi label.
- Batas yang diakui: wallet pendana stake terlihat (unshielded); komite dipercaya tidak berkolusi;
  komite melihat total untuk histogram/D-05 dan nilai bid; dealer tepercaya untuk kunci demo; Veritas
  membaca alasan plaintext; outcome objektif v1 dicatat buyer/operator; bukti permintaan belum ada.
- Dilarang mengklaim fitur yang tidak berjalan di demo.

## 14. Rencana build (urutan, tanpa estimasi waktu)

| Fase | Isi | Selesai bila |
|---|---|---|
| P0 | Toolchain 0.31.1, local network, contoh resmi terkompilasi, repo Apache-2.0 + label | `compact compile` contoh lulus |
| P1 | Spike S1–S9 | Tiap spike punya hasil tertulis; cadangan M-8 dipilih bila perlu |
| P2 | Kontrak inti: grup, registry, market, stake, tally, close, outcome objektif, proveHit, claim, dUSD | Test simulator lulus untuk semua jalur §11 |
| P3 | `packages/crypto` + komite: kunci, pembukaan buyer, histogram, D-05 | Total dibuka benar hanya oleh buyer; DLEQ terverifikasi |
| P4 | Buyer anonim + good standing, lelang terenkripsi, alokasi, buyFlat, sisi B tanpa lelang + subsidi | Siklus sisi A dan B lulus di local network |
| P5 | Reputasi portabel (credential, renewTier), kartu terkunci + revoke, verifier suara rahasia, sengketa hoax, D-15 | Test penolakan anggota dicabut dan suara rahasia lulus |
| P6 | Operator (Reclaim, Veritas), keeper | Satu market berjalan otomatis sampai Settled |
| P7 | Integrasi frontend ke kontrak + Lace (design system sudah ada di `DESIGN.md`) | Semua alur demo bisa diklik di Preprod |
| P8 | Deploy Preprod, CI, README (pengungkapan), deck, video, deskripsi progres | Checklist syarat lolos AKINDO terpenuhi |

Push ke GitHub hanya bila repo **private** (aturan Dien). Membuat repo publik untuk submisi adalah
tindakan Dien.

## 15. Keputusan yang masih terbuka

**Pembaruan 14 Okt 2026:** Dien menyetujui SPEC v0.2 dan seluruh usulan parameternya (O-1 sampai O-9),
serta menyetujui usulan O-10 secara terpisah. Tabel di bawah menyimpan pertanyaan dan rancangan yang
diterima sebagai riwayat. Alamat amal produksi tetap perlu diberikan Dien sebelum deploy; demo memakai
alamat burn berlabel. Persetujuan desain tidak membuktikan asumsi teknis; spike tetap wajib.

| ID | Pertanyaan | Usulan agent |
|---|---|---|
| O-1 | Besaran subsidi sisi B dari bagian platform | 5 dari 15 poin persen |
| O-2 | Sumber kredensial scout sisi B | Tanda tangan wallet deployer di chain ekosistem atau bukti penerima grant, diverifikasi operator |
| O-3 | Lama epoch untuk demo | Dipercepat (menit/jam) dengan parameter, 30 hari di produksi |
| O-4 | Batas bobot untuk pembukaan cepat | `weight < 2^32` |
| O-5 | Bond sengketa dan stake verifier | 50 dUSD / 100 dUSD |
| O-6 | File yang ikut repo publik | Default mengikuti `task-tracker.md` §5 dan P0.1: `AGENTS.md`, `task-tracker.md`, `codex-prompt.md`, dan catatan internal `.impeccable/` di-`.gitignore` (tidak masuk riwayat git); `.impeccable/design.json` ikut git; `SPEC.md`, `PRODUCT.md`, `DESIGN.md` boleh publik |
| O-7 | Persetujuan atas `SPEC.md` | Dien menyatakan setuju atau mengubah butir [Usulan] |
| O-8 | Aturan tier per epoch dan alamat amal (§10) | Lihat §10 |
| O-9 | Batas buyer per market (§10) | Sisi A maks 4, sisi B satu pool bersama |
| O-10 | Siapa boleh membeli dan membuat market sisi B | Usulan: builder dengan kredensial ekosistem (sama seperti scout sisi B) atau KYB ringan; market sisi B dibuat operator atas usulan builder |


## 13. Penyempurnaan S11 (disetujui Dien, 15 Okt)

Group ID dan metadata ekosistem publik saat stake membocorkan opsi sisi B. Dien
menyetujui registry akar grup bersama, bukti metadata/root/anggota privat, serta
kartu terkunci yang memuat group ID, commitment anggota 256-bit dan indeks.
Semantik tier/epoch dan k>=5 per grup/market tetap. Admission, renewal dan
revocation menyinkronkan registry; revocation mengganti root dan mereset riwayat
registry. Representasi baru harus lolos spike S11 (inspeksi transcript publik,
penolakan bukti palsu/anggota dicabut, pemulihan kartu 3-dari-5, compile dan proof
lokal) sebelum diintegrasikan. Rancangan: docs/group-privacy-spike-proposal.md.
Persetujuan ini bukan izin deploy atau transaksi jaringan.


## 13. Outcome jury (Dien, 15 Oktober 2026)

Rancangan `docs/outcome-jury-proposal.md` disetujui seluruhnya: mode outcome
objective/subjective immutable, satu kasus biner per opsi, bond reporter 50 dUSD
dan collateral verifier 100 dUSD per kasus, tujuh commit pertama dan kuorum lima
reveal, penalti minoritas 50%/tidak reveal 100%, aturan quorum/tie dan D-05, serta
settlement menunggu seluruh kasus. Dokumen tersebut menjadi acceptance rinci
untuk implementasi SPEC v0.15. Belum mengklaim kontrak atau proof terbaru selesai.
