# <img src="../logo.svg" alt="" height="28" align="absmiddle"> Tesselot

[en](../README.md) · [zh-Hans](README.zh-Hans.md) · [hi](README.hi.md) · [es](README.es.md) · [fr](README.fr.md) · [bn](README.bn.md) · [pt](README.pt.md) · [ru](README.ru.md) · [id](README.id.md) · [de](README.de.md) · [ja](README.ja.md) · **tr** · [vi](README.vi.md) · [ko](README.ko.md) · [it](README.it.md) · [pl](README.pl.md) · [uk](README.uk.md) · [uz](README.uz.md) · [az](README.az.md) · [kk](README.kk.md) · [be](README.be.md)

Bir fotoğrafı, üçgenlerden oluşan low-poly bir görüntüye dönüştüren tarayıcı tabanlı bir editör. Sıradan üreteçlerden temel bir noktada ayrılır: otomatik oluşturulan ağın üzerine kendi kılavuz çizgilerini çizersin ve üçgen kenarları bunları takip eder. Çene çizgisi, gözlük çerçevesi, siluet gibi önemli hatlar keskin kalır, rastgele bir ağ içinde kaybolmaz.

**[EDİTÖRÜ AÇ](https://jango-git.github.io/tesselot/)**

![Ekran görüntüsü](../image.png)

## Neler yapabilir

- **Kılavuz çizgiler.** Görüntünün üzerine çizgiler, çemberler ve yumuşak eğriler çizersin - üçgenler bunlara göre dizilir. Bu tek seferlik bir işlem değil, modifikatörlerdir: istediğin an taşıyabilir, ayrıntı düzeyini değiştirebilir, gruplayabilirsin.
- **Ayrıntıya uyum sağlayan ağ.** İnce detayların ve keskin kenarların çok olduğu yerlerde üçgenler küçülür, gökyüzü gibi düz alanlarda büyür. Görüntü gerektiği yerde ayrıntılı, geri kalanında sakin çıkar.
- **Otomatik izleme.** Boş sayfadan başlamamak için "İzle" düğmesine bas: editör görüntünün kenarlarını bulur ve bunları, ayrı bir grupta toplanmış, düzenlenebilir modifikatörlere dönüştürür.
- **Üçgen rengi.** Her üçgen, altındaki piksellerin ortalama rengiyle boyanır - parlak sapmaları yumuşatmak istersen medyan renkle de olabilir.
- **Dışa aktarma.** Vektör (SVG, PDF) veya raster (PNG, JPG, WebP), 4096 piksele kadar.
- **Projeler.** Çalışmanı bir `.json` dosyasına kaydedip sonra devam edebilirsin. Sekmeyi kapatsan bile mevcut oturum kendiliğinden geri yüklenir.
- **21 dilde arayüz.** Dil tarayıcıya göre belirlenir, üst çubuktan değiştirilebilir.

## Perde arkası

Noktalar, Poisson-disk örneklemesiyle (Bridson algoritması) değişken yarıçapla yerleştirilir - bu yarıçapı bir Sobel kenar haritası belirler, bu yüzden ağ konturlar boyunca daha sıktır. Üretim deterministiktir: aynı tohum (seed) her zaman aynı ağı verir. Ağır geometri hattının tamamı - kenar haritası, nokta yerleştirme, üçgenleme - Rust ile yazılmış bir WASM modülünde toplanmıştır; üçgen rengi ise ayrı olarak bir Web Worker içinde hesaplanır.

Kaynak koda göz atmayı düşünüyorsan [mimari genel bakış](onboarding.tr.md) ile başla.

## Geliştirme

```sh
npm install
npm run dev    # http://localhost:3000 adresinde geliştirme sunucusu
npm run build  # dist/bundle.js dosyasını oluşturur
```

## Lisans

[MIT](../LICENSE)
