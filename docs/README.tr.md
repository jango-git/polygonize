# <img src="../logo.svg" alt="" height="28" align="absmiddle"> Polygonize

[en](../README.md) · [zh-Hans](README.zh-Hans.md) · [hi](README.hi.md) · [es](README.es.md) · [fr](README.fr.md) · [bn](README.bn.md) · [pt](README.pt.md) · [ru](README.ru.md) · [id](README.id.md) · [de](README.de.md) · [ja](README.ja.md) · **tr** · [vi](README.vi.md) · [ko](README.ko.md) · [it](README.it.md) · [pl](README.pl.md) · [uk](README.uk.md) · [uz](README.uz.md) · [az](README.az.md) · [kk](README.kk.md) · [be](README.be.md)

Bir fotoğrafı low-poly bir görsele (üçgenlerden oluşan bir resme) dönüştürmeni sağlayan, tarayıcıda çalışan bir editör. Onu sıradan üreteçlerden ayıran asıl şey şu: üretilen temel ağa ek olarak, kılavuz çizgilerini kendin çizebilirsin ve üçgenlerin kenarları bu çizgileri takip eder. Böylece önemli hatlar - çene çizgisi, gözlük çerçevesi, silüet - rastgele bir ağın içinde kaybolmaz, net kalır. Tamamladığın sonucu vektör (SVG, PDF) ya da resim (PNG, JPG, WebP) olarak kaydedebilirsin.

**[EDİTÖRÜ AÇ](https://jango-git.github.io/polygonize/)**

![Ekran görüntüsü](../image.png)

## Neler yapabilir

- **Kendi çizdiğin kılavuzlar.** Görüntünün üzerine çizgiler, çemberler, yumuşak eğriler çizersin - üçgenler de bunlar boyunca dizilir. Bunlar resmin üzerindeki ayrı modifiye katmanlarıdır, bu yüzden istediğin an onları taşıyabilir, detay ayarlarını değiştirebilir ya da gruplayabilirsin.
- **Ağ, detaylara göre kendini ayarlar.** Çok sayıda küçük öğenin ve keskin sınırın olduğu yerlerde üçgenler daha küçük; gökyüzü ya da arka plan gibi düz alanlarda ise daha büyük olur. Resim, gerektiği yerde ayrıntılı, geri kalanında ise sakin çıkar. Üstelik sonuç öngörülebilir biçimde yeniden üretilebilir: aynı ayarlarla ağ birebir aynı çıkar.
- **Başlangıç için otomatik izleme.** Boş bir sayfadan başlamamak için "Görseli izle"ye bas - editör görüntünün kenarlarını kendisi bulur ve onları düzenlenebilir modifiye katmanlarına dönüştürüp ayrı bir grupta toplar.
- **Üçgenlerin rengi.** Her üçgen, altında kalan piksellerin ortalama rengiyle doldurulur - ya da parlak uç değerleri bastırmak istersen medyan renkle.
- **Dışa aktarma.** Vektör (SVG, PDF) ya da raster (PNG, JPG, WebP), 4096 piksele kadar.
- **Projeler.** Çalışmanı bir `.json` dosyasına kaydedip sonra ona geri dönebilirsin. Ama mevcut oturum da kendiliğinden geri yüklenir, sekmeyi öylece kapatmış olsan bile.
- **21 dilde arayüz.** Dil, tarayıcına göre belirlenir ve üst panelden değiştirilir.

## Kısayol tuşları

| Tuş     | Eylem                                          |
| ------- | ---------------------------------------------- |
| `~`     | İmleç (seçim)                                  |
| `1`     | "Çoklu çizgi" aracı                            |
| `2`     | "Eğri" aracı                                   |
| `3`     | Çember (merkez ve yarıçap)                     |
| `4`     | Çember (3 nokta)                               |
| `Q`     | Arka plan saydamlığını tersine çevir           |
| `W`     | Nokta saydamlığını tersine çevir               |
| `E`     | İğnemsi üçgen vurgusunu tersine çevir          |
| `F`     | Görüntüyü ortala                               |
| `Space` | Açık yolu tamamla                              |
| `Esc`   | Çizimi iptal et / seçimi kaldır                |

## Kaputun altında

Meraklılar için: noktalar, değişken yarıçaplı Poisson disk örneklemesiyle (Bridson algoritması) yerleştirilir - yarıçapı Sobel kenar haritası belirler, bu yüzden hatlar boyunca ağ daha sıktır. Üretim deterministiktir: aynı seed her zaman aynı ağı verir.
Ağır geometri işlem hattının tamamı - kenar haritası, nokta yerleşimi ve triangülasyonun kendisi - Rust ile yazılmış bir WASM modülünde toplanmıştır. Üçgenlerin rengi ise ayrıca, bir Web Worker içinde hesaplanır.

## Geliştirme

```sh
npm install
npm run dev    # http://localhost:3000 adresinde geliştirme sunucusu
npm run build  # dist/bundle.js dosyasını oluşturur
```

## Lisans

[MIT](../LICENSE)
