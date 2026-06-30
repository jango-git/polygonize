# <img src="../logo.svg" alt="" height="28" align="absmiddle"> Polygonize

[en](../README.md) · [zh-Hans](README.zh-Hans.md) · [hi](README.hi.md) · [es](README.es.md) · [fr](README.fr.md) · [bn](README.bn.md) · [pt](README.pt.md) · [ru](README.ru.md) · [id](README.id.md) · [de](README.de.md) · [ja](README.ja.md) · [tr](README.tr.md) · [vi](README.vi.md) · [ko](README.ko.md) · [it](README.it.md) · [pl](README.pl.md) · [uk](README.uk.md) · **uz** · [az](README.az.md) · [kk](README.kk.md) · [be](README.be.md)

Fotosuratni low-poly tasvirga (uchburchaklardan yig'ilgan rasmga) aylantirishga imkon beradigan brauzer muharriri. Uni oddiy generatorlardan ajratib turadigan asosiy narsa shu: tayyor yaratilgan to'rdan tashqari, yo'naltiruvchilarni o'zing chiza olasan, uchburchaklarning qirralari esa ular bo'ylab joylashadi. Shu sababli muhim konturlar - iyak chizig'i, ko'zoynak gardishi, siluet - tasodifiy to'r ichida yo'qolib ketmaydi, aniq bo'lib qoladi. Tayyor natijani vektor (SVG, PDF) yoki rasm (PNG, JPG, WebP) ko'rinishida saqlashing mumkin.

**[MUHARRIRNI OCHISH](https://jango-git.github.io/polygonize/)**

![Skrinshot](../image.png)

## Imkoniyatlari

- **O'zing chizadigan yo'naltiruvchilar.** Tasvir ustiga chiziqlar, aylanalar, silliq egri chiziqlar tortasan - uchburchaklar esa ular bo'ylab saflanadi. Bular rasm ustidagi alohida modifikatorlar, shu sababli istalgan paytda ularni surishing, detallashtirish sozlamalarini o'zgartirishing yoki guruhlashing mumkin.
- **To'r tafsilotlarga moslashadi.** Mayda detallar va keskin chegaralar ko'p joyda uchburchaklar maydaroq; osmon yoki fon kabi tekis joylarda esa yiriroq bo'ladi. Rasm kerakli joyda batafsil, qolgan joyda esa sokin chiqadi. Bunda natija oldindan aytib bo'ladigan tarzda takrorlanadi: bir xil sozlamalar bilan to'r aynan o'sha ko'rinishda chiqadi.
- **Boshlash uchun avtomatik chizish.** Toza varaqdan boshlamaslik uchun "Rasmni chizish" tugmasini bos - muharrir tasvir qirralarini o'zi topadi va ularni alohida guruhga jamlangan tahrirlanadigan modifikatorlarga aylantiradi.
- **Uchburchaklar rangi.** Har bir uchburchak ostidagi piksellarning o'rtacha rangi bilan bo'yaladi - yoki yorqin chetga chiqishlarni bo'g'ish kerak bo'lsa, median rang bilan.
- **Eksport.** Vektor (SVG, PDF) yoki rastr (PNG, JPG, WebP), 4096 pikselgacha.
- **Loyihalar.** Ishingni `.json` faylga saqlab, keyinroq unga qaytishing mumkin. Ammo joriy seans ham o'zi tiklanadi, hatto sen shunchaki yorliqni yopgan bo'lsang ham.
- **21 tilda interfeys.** Til brauzerga qarab aniqlanadi, yuqori paneldan almashtiriladi.

## Kapot ostida

Qiziquvchilar uchun: nuqtalar o'zgaruvchan radiusli Puasson diski namunalashi (Bridson algoritmi) yordamida joylashtiriladi - radiusni Sobel chegara xaritasi belgilaydi, shu sababli konturlar bo'ylab to'r zichroq bo'ladi. Generatsiya deterministik: bir xil seed har doim bir xil to'rni beradi.
Butun og'ir geometrik quvur - chegara xaritasi, nuqtalarni joylashtirish va triangulyatsiyaning o'zi - Rust tilida yozilgan WASM modulida jamlangan. Uchburchaklar rangi esa alohida, Web Worker ichida hisoblanadi.

## Ishlab chiqish

```sh
npm install
npm run dev    # http://localhost:3000 manzilidagi ishlab chiqish serveri
npm run build  # dist/bundle.js faylini yaratadi
```

## Litsenziya

[MIT](../LICENSE)
