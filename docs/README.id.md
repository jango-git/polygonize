# <img src="../logo.svg" alt="" height="28" align="absmiddle"> Polygonize

[en](../README.md) · [zh-Hans](README.zh-Hans.md) · [hi](README.hi.md) · [es](README.es.md) · [fr](README.fr.md) · [bn](README.bn.md) · [pt](README.pt.md) · [ru](README.ru.md) · **id** · [de](README.de.md) · [ja](README.ja.md) · [tr](README.tr.md) · [vi](README.vi.md) · [ko](README.ko.md) · [it](README.it.md) · [pl](README.pl.md) · [uk](README.uk.md) · [uz](README.uz.md) · [az](README.az.md) · [kk](README.kk.md) · [be](README.be.md)

Editor berbasis browser yang mengubah sebuah foto menjadi gambar low-poly (gambar yang tersusun dari segitiga). Yang membedakannya dari generator biasa ada satu hal utama: selain jala dasar yang dihasilkan otomatis, kamu sendiri bisa menggambar garis pemandu, dan sisi-sisi segitiga akan mengikuti garis itu. Karena itu kontur penting - garis dagu, bingkai kacamata, siluet - tetap tajam, tidak hilang di tengah jala acak. Hasil jadinya bisa kamu simpan sebagai vektor (SVG, PDF) atau gambar (PNG, JPG, WebP).

**[BUKA EDITOR](https://jango-git.github.io/polygonize/)**

![Tangkapan layar](../image.png)

## Fitur

- **Garis pemandu yang kamu gambar sendiri.** Tarik garis, lingkaran, dan kurva mulus di atas gambar - dan segitiga pun menata diri mengikutinya. Ini adalah modifier terpisah yang berada di atas gambar, jadi kapan saja bisa kamu geser, ubah pengaturan detailnya, atau kelompokkan.
- **Jala menyesuaikan diri dengan detail.** Di tempat yang penuh detail kecil dan tepi tajam, segitiganya lebih kecil; di area datar seperti langit atau latar, lebih besar. Gambarnya jadi rinci di bagian yang memang perlu, dan tenang di sisanya. Selain itu hasilnya bisa direproduksi dengan pasti: dengan pengaturan yang sama, jala yang dihasilkan akan persis sama.
- **Pelacakan otomatis sebagai titik awal.** Supaya kamu tidak mulai dari nol, tekan "Lacak gambar" - editor akan menemukan sendiri tepi gambar dan mengubahnya menjadi modifier yang bisa diedit, terkumpul dalam grup tersendiri.
- **Warna segitiga.** Setiap segitiga diisi dengan warna rata-rata piksel di bawahnya - atau warna median, kalau kamu ingin meredam warna-warna mencolok yang ekstrem.
- **Ekspor.** Vektor (SVG, PDF) atau raster (PNG, JPG, WebP) hingga 4096 piksel.
- **Proyek.** Simpan hasil kerjamu ke file `.json` dan lanjutkan lagi nanti. Tapi sesi yang sedang berjalan pun pulih sendiri, bahkan kalau kamu cuma menutup tab.
- **Antarmuka dalam 21 bahasa.** Bahasa ditentukan dari browser, dan bisa diganti di panel atas.

## Di balik layar

Buat yang penasaran: titik-titik ditebar dengan Poisson disk sampling (algoritma Bridson) dengan jari-jari yang berubah-ubah - ditentukan oleh peta tepi Sobel, sehingga jala jadi lebih padat di sepanjang kontur. Pembangkitannya deterministik: seed yang sama selalu menghasilkan jala yang sama.
Seluruh pipeline geometri yang berat - peta tepi, penebaran titik, dan triangulasinya sendiri - dirangkum dalam satu modul WASM yang ditulis dengan Rust. Warna segitiga dihitung terpisah, di dalam Web Worker.

## Pengembangan

```sh
npm install
npm run dev    # server pengembangan di http://localhost:3000
npm run build  # membuat dist/bundle.js
```

## Lisensi

[MIT](../LICENSE)
