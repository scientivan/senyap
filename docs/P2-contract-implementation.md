{
  "name": "@senyap/sdk",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "license": "Apache-2.0",
  "exports": { "./ephemeral-state": "./src/ephemeral-state.ts", "./paid-signals": "./src/paid-signals.ts" },
  "dependencies": {
    "@midnight-ntwrk/midnight-js-types": "4.1.1",
    "@midnight-ntwrk/midnight-js-protocol": "4.1.1"
  }
}

| 15 Okt 2026 | P3.2 transport lokal lulus: lima instance HTTP localhost membaca snapshot simulator tepercaya, memakai satu share per node dan mengirim ciphertext hanya ke kunci buyer di ledger. SDK memverifikasi konteks/DLEQ/ID endpoint, menggabungkan tiga share dan membaca total 480; dua node offline ditoleransi, tiga offline/key salah/opsi belum dibeli/origin asing/request rusak ditolak. Handler tidak menerima state/key/tujuan dari request dan tidak mengembalikan error mentah. Seluruh 64 test dan root typecheck lulus; build web lulus. Indexer produk, proses layanan, relay onchain belum berjalan. | Codex |

| 15 Okt 2026 | P5.1 lulus empat test simulator: credential diindeks per epoch penerbitan yang dicek lewat waktu blok; renew membuktikan path privat tanpa lookup publik ke posisi asal. Pertahankan tier memakai satu hit dari dua epoch terakhir, naik satu memakai dua hit epoch berjalan, naik dua memakai tiga. Credential berbeda/owned/root sah wajib, nullifier sekali per epoch tujuan dan satu renewal per scout/sisi/ekosistem. Credential terlalu lama/masa depan, duplikat, posisi palsu, root salah, membership kedaluwarsa, ekosistem berubah dan anggota dicabut ditolak. Tidak ada deploy/transaksi produk. CI 4265f0e run 38680265717 SUCCESS. | Codex |

## Portable reputation

Hit issuance now additionally appends the same credential to an epoch-indexed
historic tree, with the epoch checked against block-time bounds. Renewal proves
private credential membership and ownership without looking up public position
identifiers. Public roots/epochs and domain-separated one-use nullifiers enforce
freshness and prevent reuse without revealing the old position.

One recent hit maintains a tier; two current-epoch hits advance one tier and three
advance two. The source membership must still be active, and the target group must
be the next epoch with the same side/ecosystem. Expired or revoked members cannot
renew; renewal happens once per scout/side/ecosystem and target epoch. Four
simulator tests cover these boundaries. Proving/network execution remains pending.
