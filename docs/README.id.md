# <img src="../logo.svg" alt="" height="28" align="absmiddle"> Tesselot

[en](../README.md) · [zh-Hans](README.zh-Hans.md) · [hi](README.hi.md) · [es](README.es.md) · [fr](README.fr.md) · [bn](README.bn.md) · [pt](README.pt.md) · [ru](README.ru.md) · **id** · [de](README.de.md) · [ja](README.ja.md) · [tr](README.tr.md) · [vi](README.vi.md) · [ko](README.ko.md) · [it](README.it.md) · [pl](README.pl.md) · [uk](README.uk.md) · [uz](README.uz.md) · [az](README.az.md) · [kk](README.kk.md) · [be](README.be.md)

Editor berbasis browser yang mengubah foto menjadi gambar low-poly - gambar yang tersusun dari segitiga. Bedanya dengan generator biasa terletak pada satu hal utama: di atas kisi (grid) yang dihasilkan secara otomatis, kamu sendiri menggambar garis panduan, dan tepi segitiga mengikuti garis tersebut. Kontur penting - garis dagu, bingkai kacamata, siluet - tetap tajam, tidak tenggelam dalam kisi acak.

**[BUKA EDITOR](https://jango-git.github.io/tesselot/)**

![Tangkapan layar](../image.png)

## Fitur

- **Garis panduan.** Gambar garis, lingkaran, dan kurva halus di atas gambar - segitiga akan menyesuaikan diri mengikutinya. Ini bukan operasi sekali pakai, melainkan modifier: kapan saja bisa dipindahkan, diubah tingkat detailnya, atau dikelompokkan.
- **Kisi yang menyesuaikan diri dengan detail.** Di area dengan banyak detail kecil dan tepi tajam, segitiga menjadi lebih kecil; di area rata seperti langit, segitiga lebih besar. Hasilnya detail di bagian yang perlu, dan tenang di sisanya.
- **Penelusuran otomatis.** Agar tidak mulai dari kanvas kosong, klik "Telusuri": editor akan menemukan tepi gambar dan mengubahnya menjadi modifier yang bisa diedit, dikumpulkan dalam grup tersendiri.
- **Warna segitiga.** Setiap segitiga diisi dengan warna rata-rata piksel di bawahnya - atau warna median, jika ingin meredam nilai ekstrem yang mencolok.
- **Ekspor.** Vektor (SVG, PDF) atau raster (PNG, JPG, WebP) hingga 4096 piksel.
- **Proyek.** Simpan pekerjaanmu ke file `.json` dan lanjutkan nanti. Sesi saat ini juga pulih dengan sendirinya - bahkan jika kamu hanya menutup tab.
- **Antarmuka dalam 21 bahasa.** Bahasa terdeteksi otomatis dari browser, bisa diganti di panel atas.

## Di balik layar

Titik-titik disebar menggunakan pengambilan sampel disk Poisson (algoritma Bridson) dengan radius variabel - radius ini ditentukan oleh peta tepi Sobel, sehingga kisi lebih rapat di sepanjang kontur. Pembuatannya bersifat deterministik: seed yang sama selalu menghasilkan kisi yang sama. Seluruh pipeline geometri berat - peta tepi, penyebaran titik, triangulasi - dibangun dalam modul WASM berbasis Rust; warna segitiga dihitung secara terpisah, di Web Worker.

Jika kamu berencana membaca kode sumbernya, mulailah dari [gambaran arsitektur](onboarding.id.md).

## Pengembangan

```sh
npm install
npm run dev    # server pengembangan di http://localhost:3000
npm run build  # menghasilkan dist/bundle.js
```

## Lisensi

[MIT](../LICENSE)
