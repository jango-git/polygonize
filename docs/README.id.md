# Polygonize

[en](../README.md) · [zh-Hans](README.zh-Hans.md) · [hi](README.hi.md) · [es](README.es.md) · [fr](README.fr.md) · [bn](README.bn.md) · [pt](README.pt.md) · [ru](README.ru.md) · **id** · [de](README.de.md) · [ja](README.ja.md) · [tr](README.tr.md) · [vi](README.vi.md) · [ko](README.ko.md) · [it](README.it.md) · [pl](README.pl.md) · [uk](README.uk.md) · [uz](README.uz.md) · [az](README.az.md) · [kk](README.kk.md) · [be](README.be.md)

Editor gambar low-poly berbasis peramban. Muat foto, atur triangulasinya, perhalus tepi dengan modifier bentuk, lalu ekspor sebagai SVG atau PNG.

**[EDITOR](https://jango-git.github.io/polygonize/)**

![Tangkapan layar](../image.png)

## Fitur

- **Penyemaian titik cerdas** - Pengambilan sampel Bridson Poisson disk dengan radius variabel yang dikendalikan oleh deteksi tepi Sobel: tepi mendapat radius minimum yang rapat (segitiga padat), area datar mendapat radius maksimum yang longgar (segitiga jarang). Pembuatannya sepenuhnya disemai, sehingga seed tertentu menghasilkan mesh yang sama
- **Tumpukan modifier** - Lapisan polyline, lingkaran, dan kurva Catmull-Rom yang non-destruktif menambahkan tepi kendala di atas mesh dasar; susun ulang atau kelompokkan dengan bebas lewat seret-dan-lepas
- **Penyamplingan warna** - Warna piksel rata-rata atau median per segitiga; gradien per-vertex opsional
- **Ekspor** - Vektor SVG atau PDF, atau raster PNG, JPG, atau WebP hingga 4096px
- **Proyek** - Simpan dan pulihkan pekerjaan sebagai `.json`; sesi tersimpan otomatis ke localStorage
- **Antarmuka terlokalisasi** - 21 bahasa antarmuka, terdeteksi otomatis dari peramban dan dapat diganti di bilah atas

## Pintasan keyboard

| Tombol  | Aksi                               |
| ------- | ---------------------------------- |
| `~`     | Kursor (pilih)                     |
| `1`     | Alat polyline                      |
| `2`     | Alat kurva Catmull-Rom             |
| `3`     | Alat lingkaran (pusat & radius)    |
| `4`     | Alat lingkaran (3 titik)           |
| `Q`     | Balik opasitas latar               |
| `W`     | Balik opasitas titik               |
| `E`     | Balik lapisan lonjakan             |
| `F`     | Paskan gambar ke tampilan          |
| `Space` | Terapkan jalur terbuka             |
| `Esc`   | Batalkan gambar / batalkan pilihan |

## Pengembangan

```sh
npm install
npm run dev    # server pengembangan di http://localhost:3000
npm run build  # menghasilkan dist/bundle.js
```

## Lisensi

[MIT](../LICENSE)
