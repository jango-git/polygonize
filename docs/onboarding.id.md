# Tesselot - arsitektur

## Pendahuluan

Tesselot adalah editor gambar low-poly berbasis browser: pengguna menggambar bentuk panduan (**modifier**: garis, kurva, lingkaran) di atas gambar, dan aplikasi menyebarkan titik ke ruang yang tersisa, melakukan triangulasi, lalu mewarnainya. Apa manfaatnya bagi pengguna - ada di README; dokumen ini membahas struktur kodenya.

Hal utama yang perlu dipahami sebelum membaca kode: pipeline-nya sepenuhnya non-destruktif. Status dibagi tegas menjadi **source** - apa yang ditentukan pengguna (gambar, pengaturan, pohon bentuk) - dan **derived** - titik, triangulasi, warna. Yang disimpan dan masuk ke riwayat (history) hanyalah source; derived selalu dihitung ulang dari source pada setiap perubahan dan setiap pemuatan, dan tidak pernah disimpan.

Dari pemisahan ini muncul hampir seluruh arsitektur lainnya: undo menjadi murah (snapshot hanya berisi source), semuanya deterministik (satu source selalu menghasilkan satu derived yang sama), komputasi berat dipindahkan ke latar belakang (derived mahal untuk dihitung), dan data mengalir searah - dari source ke derived, tidak pernah sebaliknya.

Bagi yang sudah familiar, ini mirip dengan aliran data satu arah ala Redux/Flux - status tunggal, perubahan hanya lewat command, subscriber bereaksi terhadap event - ditambah lapisan status turunan (computed) di atasnya, seperti computed/reselect.

## Lima lapisan

| Lapisan | Folder | Tanggung jawab | Tahu tentang |
|---|---|---|---|
| **UI** | `src/ui/` | input: menggambar, panel, alat, hotkey | model (mengirim command) |
| **Model** | `src/document/` | source + derived, riwayat, event | tidak tahu apa pun di atasnya |
| **Domain** | `src/domain/` | logika murni: bagaimana bentuk menjadi titik, jembatan ke WASM | dipanggil oleh model |
| **Render** | `src/preview/` | menggambar gambar dan segitiga dengan three.js | hanya mendengarkan model |
| **Native** | `crates/` | Rust->WASM: geometri dan warna yang berat | tidak tahu apa pun, fungsi murni |

Ada beberapa folder pendukung lain: `persistence/` (penyimpanan dan ekspor), `settings/`, `i18n/`.

Aturan alur: UI hanya mengubah model, render hanya membaca model, keduanya tidak berkomunikasi langsung. Yang menghubungkan mereka adalah bus event di dalam model - inilah siklus satu arah tersebut.

## Alur data

Skenario utama - "dari goresan mouse hingga segitiga yang terwarnai ulang":

```
   pengguna             (1) UI menangkap input
       |
       v
   (2) command mengubah SOURCE: menambah/menggeser bentuk
       |
       v
   (3) hitung ulang: source -> titik -> segitiga      [berat, di worker latar belakang]
       |
       v
   (4) model menaruh hasil ke buffer datar dan mengirim event "selesai"
       |
       v
   (5) render mendengar event dan memperbarui gambar di layar
       |
       +--> (6) secara paralel warna segitiga dihitung -> event lain -> pewarnaan ulang
```

Ada tiga teknik yang membuat siklus ini responsif:

- **Satu kali hitung ulang per frame.** Saat menyeret (drag), event mouse mengalir puluhan kali per detik, tetapi hitung ulang tidak dijalankan lebih dari sekali per frame - posisi antara dibuang.
- **Render tidak pernah menunggu.** Selagi warna presisi dihitung di latar belakang, segitiga langsung ditampilkan dengan warna perkiraan; warna final tiba lewat event terpisah dan diterapkan menimpa yang lama.
- **Tanpa alokasi berlebih.** Segitiga tidak hidup sebagai objek, melainkan sebagai array angka datar yang panjang; render maupun ekspor membaca array ini secara langsung.

## Peta tugas

| Ingin mengubah... | Lihat di... |
|---|---|
| perilaku alat menggambar | `src/ui/tools/` |
| panel kanan (pohon bentuk, grup) | `src/ui/panel/` |
| bagaimana bentuk menjadi titik | `src/domain/modifiers/` |
| algoritma penyebaran titik / triangulasi | `crates/pipeline/` |
| cara warna segitiga dihitung | `crates/color/` |
| rendering, kamera, overlay | `src/preview/` |
| format penyimpanan / undo | `src/document/` |
| penyimpanan ke disk / ekspor SVG, PDF, PNG | `src/persistence/` |

## Detail per lapisan

### Model (`src/document/`)

Status adalah satu objek `DocumentData` (`types.ts`), dibagi tepat sesuai batas berikut:

- **Source** (disimpan, ada di riwayat): `image`, `seed`, `seedSettings`, `colorSettings`, `stack` (pohon bentuk).
- **Derived** (dihitung ulang, tidak disimpan): `points` dan buffer render datar - `renderPositions` (xyz per vertex), `renderColors` (rgb per segitiga), `triangleCount`.

Bagaimana perubahan melewati model:

- `store.ts` - satu objek status mutable tunggal (`store.data()`).
- `commands/` - satu-satunya cara untuk mengubahnya, mirip reducer. Command mengubah source di tempat lalu memanggil commit: `commit.ts` menentukan apakah perlu hitung ulang (`commitStructural` untuk perubahan geometri) atau cukup mencatat langkah riwayat (`commitViewOnly`, misalnya melipat folder).
- `commands/pipeline.ts` - hitung ulang (`evaluatePoints`). Bekerja dengan prinsip "satu permintaan yang berjalan": berapa pun banyaknya perubahan yang masuk, hanya ada satu perhitungan yang berjalan ke worker pada satu waktu, tetapi yang terakhir selalu dituntaskan.
- `commands/recompute.ts` - menyusun hasil ke buffer datar (`buildGeometry`) dan menerapkan warna yang sudah dihitung (`applyColorGrid`).
- `signals.ts` - bus event (berbasis `ferrsign`). Model tidak merender apa pun; ia hanya memberitahu "titik berubah", "segitiga berubah", "source diganti seluruhnya", dan subscriber - render, panel, riwayat - bereaksi.
- `history.ts` - undo/redo. Snapshot hanya berisi source, bahkan tanpa gambar, sehingga murah; satu gestur drag utuh diringkas menjadi satu langkah.
- `selectors/` - akses baca model ke luar. Mengembalikan clone, agar tidak ada yang merusak status di luar command; kecualinya adalah buffer datar, yang dikembalikan sebagai referensi demi kecepatan.

Pohon bentuk (`stack`) bertingkat satu level, seperti koleksi di Blender: elemen bisa berupa bentuk bebas atau grup dengan anak. Grup punya "lipat" (hanya tampilan) dan "bisukan" (dikecualikan dari perhitungan). Urutan dalam stack itu penting. Operasi struktural pada pohon ada di `commands/stackTree.ts`, `modifierCommands.ts`, `groupCommands.ts`.

### Domain (`src/domain/`)

Logika tanpa DOM dan three.js; satu-satunya pengecualian adalah `imageSource.ts`, yang membaca piksel dari `<canvas>`. Dua subtema:

- `modifiers/` - bagaimana setiap bentuk menjadi titik dan tepi-pembatas (`ModifierResult`): `path.ts` (garis patah atau spline Catmull-Rom), `bezier.ts` (kurva Bezier dengan handle simetris), `circle.ts`. Perakit bersama - `result.ts`.
- Jembatan ke lapisan native: untuk setiap WASM crate ada trio "facade + worker + client". Komputasi berat berjalan di Web Worker, data melintasi batas sebagai array transferable, tanpa penyalinan.

Hal-hal kecil lain: `rng.ts` (PRNG deterministik), `colorGrid.ts` (pencarian warna spasial), `groupColor.ts` (warna grup diturunkan dari namanya - ganti nama berarti ganti warna).

### Render (`src/preview/`)

Mendengarkan event model secara ketat satu arah, tidak ada referensi balik ke model. Koordinat dunia sama dengan koordinat gambar (Y ke bawah), kamera ortografik.

- `preview.ts` - koordinator: satu scene, satu renderer, sekumpulan layer.
- Layer memiliki objek three.js masing-masing: `triangleLayer.ts` (segitiga; memakai ulang buffer, tidak membuat ulang setiap frame), `imageLayer.ts` (gambar sumber), `pointLayer.ts` (titik sebar), `overlayLayer.ts` (overlay editing: seleksi, handle, draft).
- `receiving.ts` - jembatan "event model -> pemanggilan layer". Di sinilah optimasi diterapkan: saat event "diwarnai ulang" hanya warna yang diperbarui, saat "dibangun ulang" - posisi dan warna sekaligus.
- `viewport.ts` - kamera dan konversi koordinat layar<->gambar (zoom, pan).

### UI (`src/ui/`)

DOM/canvas imperatif tanpa framework; panel membangun ulang DOM-nya sendiri berdasarkan event. Status UI tidak pernah diubah langsung - hanya lewat command.

- `tools.ts` (`ToolController`) - mesin status (state machine) untuk mode "seleksi / menggambar / menyeret"; menangkap input di kanvas.
- `tools/` - implementasi alat: draft bentuk yang sedang digambar (`*Draft.ts`) dan `dragSession.ts` - menyeret titik; di sinilah "satu hitung ulang per frame" dan peringkasan gestur menjadi satu langkah undo berada.
- `panel/` - panel kanan: pohon bentuk dengan grup dan drag-and-drop (`stackView.ts`, `dnd.ts`).
- Sisanya - palet alat, seleksi dan sorotan (highlight), hotkey, notifikasi toast.

### Lapisan native (`crates/`)

Dua crate independen; masing-masing menyimpan cache gambar yang dimuat di sisinya sendiri, agar tidak perlu mengirim ulang gambar pada setiap panggilan.

- `crates/pipeline/` - geometri: `sobel.rs` (peta kepadatan berdasarkan tepi gambar: makin tajam perubahannya, makin padat titiknya), `seeding.rs` (penyebaran titik dengan metode Bridson berjari-jari variabel), `triangulate.rs` (triangulasi Delaunay dengan batasan, crate `spade`), `contours.rs` (penelusuran kontur gambar menjadi bentuk yang bisa diedit, Canny).
- `crates/color/` - warna: mengambil sampel warna di bawah setiap segitiga (rata-rata atau median) dan membangun kisi spasial untuk pencarian cepat. Berjalan di worker warna.

Bagian yang krusial untuk determinisme - PRNG, penyebaran, sampling - sengaja dibuat sama persis, bit demi bit, dengan implementasi TS sebelumnya: satu seed selalu menghasilkan gambar yang sama pada setiap eksekusi.

## Build

- `npm run build:wasm` - untuk setiap crate: cargo -> wasm-bindgen (`--target web`) -> wasm-opt (`-Oz`). Hasil glue-nya diletakkan di `src/generated/` (ada di gitignore), `.wasm` disalin ke `dist/` dan dimuat saat runtime.
- `npm run build` = `build:wasm`, lalu `rollup -c`. `npm run dev` menambahkan watch (`-w`).
- Deployment bersifat statis (GitHub Pages), tanpa backend.

## Kesimpulan

Aplikasi hanya menyimpan source: pengguna mengubahnya lewat UI, model menjalankannya melalui pipeline Rust/WASM di latar belakang menjadi buffer datar, dan render hanya mencerminkan buffer tersebut. Semua yang lain adalah konsekuensi dari satu pemisahan ini.
