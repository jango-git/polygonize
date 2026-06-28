# Polygonize

[en](../README.md) · [zh-Hans](README.zh-Hans.md) · [hi](README.hi.md) · [es](README.es.md) · [fr](README.fr.md) · [bn](README.bn.md) · [pt](README.pt.md) · [ru](README.ru.md) · [id](README.id.md) · [de](README.de.md) · [ja](README.ja.md) · [tr](README.tr.md) · [vi](README.vi.md) · [ko](README.ko.md) · [it](README.it.md) · [pl](README.pl.md) · [uk](README.uk.md) · **uz** · [az](README.az.md) · [kk](README.kk.md) · [be](README.be.md)

Brauzerda ishlaydigan low-poly rasm muharriri. Fotosuratni yuklang, triangulyatsiyani sozlang, chetlarni shakl modifikatorlari bilan aniqlashtiring va SVG yoki PNG sifatida eksport qiling.

**[MUHARRIR](https://jango-git.github.io/polygonize/)**

![Skrinshot](../image.png)

## Imkoniyatlar

- **Aqlli nuqta yaratish** - Sobel chetlarini aniqlash asosida oʻzgaruvchan radiusli Bridson Poisson disk namunalari: chetlar tor minimal radius oladi (zich uchburchaklar), tekis joylar esa keng maksimal radius oladi (siyrak uchburchaklar). Yaratish toʻliq urugʻga bogʻliq, shuning uchun berilgan urugʻ aynan oʻsha toʻrni qayta hosil qiladi
- **Modifikatorlar tizimi** - Buzilmaydigan siniq chiziq, doira va Catmull-Rom egri chiziq qatlamlari asosiy toʻr ustiga cheklov chetlarini qoʻshadi; ularni sudrab tashlash orqali bemalol tartibga soling yoki guruhlang
- **Rang namunasi** - Har uchburchak uchun oʻrtacha yoki median piksel rangi; ixtiyoriy ravishda har bir uchun gradient
- **Eksport** - Vektorli SVG yoki PDF, yoki rasterli PNG, JPG yoki WebP, 4096px gacha
- **Loyihalar** - Ishni `.json` sifatida saqlang va tiklang; sessiya localStorage'ga avtomatik saqlanadi
- **Mahalliylashtirilgan interfeys** - 21 ta interfeys tili, brauzerdan avtomatik aniqlanadi va yuqori paneldan almashtiriladi

## Tugmalar birikmasi

| Tugma   | Amal                                           |
| ------- | ---------------------------------------------- |
| `~`     | Kursor (tanlash)                               |
| `1`     | Siniq chiziq vositasi                          |
| `2`     | Catmull-Rom egri chizigʻi vositasi             |
| `3`     | Doira vositasi (markaz va radius)              |
| `4`     | Doira vositasi (3 nuqta)                       |
| `Q`     | Fon shaffofligini almashtirish                 |
| `W`     | Nuqtalar shaffofligini almashtirish            |
| `E`     | Tikanlar qatlamini almashtirish                |
| `F`     | Rasmni ekranga moslash                         |
| `Space` | Ochiq yoʻlni qoʻllash                          |
| `Esc`   | Chizishni bekor qilish / tanlovni bekor qilish |

## Ishlab chiqish

```sh
npm install
npm run dev    # dev server http://localhost:3000 manzilida
npm run build  # dist/bundle.js fayliga chiqaradi
```

## Litsenziya

[MIT](../LICENSE)
