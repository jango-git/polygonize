# Polygonize

[en](../README.md) · [zh-Hans](README.zh-Hans.md) · [hi](README.hi.md) · [es](README.es.md) · [fr](README.fr.md) · [bn](README.bn.md) · [pt](README.pt.md) · [ru](README.ru.md) · [id](README.id.md) · [de](README.de.md) · [ja](README.ja.md) · [tr](README.tr.md) · [vi](README.vi.md) · [ko](README.ko.md) · [it](README.it.md) · [pl](README.pl.md) · [uk](README.uk.md) · [uz](README.uz.md) · **az** · [kk](README.kk.md) · [be](README.be.md)

Brauzerdə işləyən low-poly şəkil redaktoru. Fotonu yükləyin, üçbucaqlaşdırmanı tənzimləyin, kənarları forma modifikatorları ilə dəqiqləşdirin və SVG və ya PNG kimi ixrac edin.

**[REDAKTOR](https://jango-git.github.io/polygonize/)**

![Ekran görüntüsü](../image.png)

## İmkanlar

- **Ağıllı nöqtə yerləşdirmə** - Sobel kənar aşkarlamasından idarə olunan dəyişən radiuslu Bridson Poisson disk nümunələməsi: kənarlar dar minimum radius alır (sıx üçbucaqlar), düz sahələr isə geniş maksimum radius alır (seyrək üçbucaqlar). Yaradılma tam toxumludur, ona görə də verilmiş toxum eyni meşi təkrar yaradır
- **Modifikator yığını** - Dağıdıcı olmayan çoxxətli, dairə və Catmull-Rom əyri qatları baza meşinin üzərinə məhdudlaşdırıcı kənarlar əlavə edir; onları sürüklə-burax ilə sərbəst şəkildə yenidən sıralayın və ya qruplaşdırın
- **Rəng nümunələmə** - Üçbucaq başına orta və ya median piksel rəngi; istəyə bağlı təpə üzrə qradiyent
- **İxrac** - Vektor SVG və ya PDF, yaxud rastrlaşdırılmış PNG, JPG və ya WebP 4096px-ə qədər
- **Layihələr** - İşi `.json` kimi saxlayın və bərpa edin; seans avtomatik olaraq localStorage-də saxlanılır
- **Yerliləşdirilmiş interfeys** - 21 interfeys dili, brauzerdən avtomatik aşkarlanır və yuxarı zolaqdan dəyişdirilir

## Klaviatura qısayolları

| Düymə   | Əməliyyat                       |
| ------- | ------------------------------- |
| `~`     | Kursor (seçim)                  |
| `1`     | Çoxxətli alət                   |
| `2`     | Catmull-Rom əyri aləti          |
| `3`     | Dairə aləti (mərkəz və radius)  |
| `4`     | Dairə aləti (3 nöqtə)           |
| `Q`     | Fon şəffaflığını dəyiş          |
| `W`     | Nöqtə şəffaflığını dəyiş        |
| `E`     | Tikan qatını dəyiş              |
| `F`     | Şəkli görünüşə sığdır           |
| `Space` | Açıq yolu tətbiq et             |
| `Esc`   | Çəkməni ləğv et / seçimi götür  |

## Tərtibat

```sh
npm install
npm run dev    # http://localhost:3000 üzərində dev server
npm run build  # dist/bundle.js çıxarır
```

## Lisenziya

[MIT](../LICENSE)
