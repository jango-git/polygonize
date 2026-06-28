# Polygonize

[en](../README.md) · [zh-Hans](README.zh-Hans.md) · [hi](README.hi.md) · [es](README.es.md) · [fr](README.fr.md) · [bn](README.bn.md) · [pt](README.pt.md) · [ru](README.ru.md) · [id](README.id.md) · [de](README.de.md) · [ja](README.ja.md) · **tr** · [vi](README.vi.md) · [ko](README.ko.md) · [it](README.it.md) · [pl](README.pl.md) · [uk](README.uk.md) · [uz](README.uz.md) · [az](README.az.md) · [kk](README.kk.md) · [be](README.be.md)

Tarayıcı tabanlı bir low-poly görsel düzenleyici. Bir fotoğraf yükleyin, üçgenlemeyi ayarlayın, şekil değiştiricileriyle kenarları iyileştirin ve SVG ya da PNG olarak dışa aktarın.

**[DÜZENLEYİCİ](https://jango-git.github.io/polygonize/)**

![Ekran görüntüsü](../image.png)

## Özellikler

- **Akıllı nokta tohumlama** - Sobel kenar algılamasıyla yönlendirilen değişken yarıçaplı Bridson Poisson diski örneklemesi: kenarlar dar bir minimum yarıçap alır (yoğun üçgenler), düz alanlar geniş bir maksimum yarıçap alır (seyrek üçgenler). Üretim tamamen tohumludur, yani belirli bir tohum aynı örgüyü yeniden oluşturur
- **Değiştirici yığını** - Tahribatsız çoklu çizgi, daire ve Catmull-Rom eğrisi katmanları, temel örgünün üzerine kısıtlama kenarları ekler; bunları sürükle-bırak ile özgürce yeniden sıralayın veya gruplayın
- **Renk örnekleme** - Üçgen başına ortalama veya medyan piksel rengi; isteğe bağlı köşe başına gradyan
- **Dışa aktarma** - Vektörel SVG veya PDF, ya da 4096 piksele kadar rasterleştirilmiş PNG, JPG veya WebP
- **Projeler** - Çalışmanızı `.json` olarak kaydedin ve geri yükleyin; oturum otomatik olarak localStorage'a kaydedilir
- **Yerelleştirilmiş arayüz** - Tarayıcıdan otomatik algılanan ve üst çubuktan değiştirilebilen 21 arayüz dili

## Klavye kısayolları

| Tuş     | Eylem                          |
| ------- | ------------------------------ |
| `~`     | İmleç (seç)                    |
| `1`     | Çoklu çizgi aracı              |
| `2`     | Catmull-Rom eğri aracı         |
| `3`     | Daire aracı (merkez ve yarıçap) |
| `4`     | Daire aracı (3 nokta)          |
| `Q`     | Arka plan saydamlığını değiştir |
| `W`     | Nokta saydamlığını değiştir    |
| `E`     | Sivri katmanını değiştir       |
| `F`     | Görseli görünüme sığdır        |
| `Space` | Açık yolu uygula               |
| `Esc`   | Çizimi iptal et / seçimi kaldır |

## Geliştirme

```sh
npm install
npm run dev    # http://localhost:3000 adresinde geliştirme sunucusu
npm run build  # dist/bundle.js çıktısını üretir
```

## Lisans

[MIT](../LICENSE)
