# Polygonize - arxitektura

## Kirish

Polygonize - brauzerda ishlaydigan low-poly tasvir muharriri: foydalanuvchi rasm ustiga yo'naltiruvchi shakllar (**modifikatorlar**: chiziqlar, egri chiziqlar, aylanalar) chizadi, ilova esa qolgan bo'shliqni nuqtalar bilan to'ldiradi, triangulyatsiya qiladi va bo'yaydi. Bu foydalanuvchiga nima berishi - README faylida; ushbu hujjat esa kod tuzilishi haqida.

Koddan oldin tushunish kerak bo'lgan asosiy narsa: pipeline to'liq nodestruktiv. Holat qat'iy ravishda ikkiga bo'lingan - foydalanuvchi belgilagan **source** (rasm, sozlamalar, shakllar daraxti) va **derived** (nuqtalar, triangulyatsiya, ranglar). Faqat source saqlanadi va tarixga tushadi; derived esa har bir o'zgarishda va har bir yuklashda source'dan qaytadan hisoblanadi va hech qachon saqlanmaydi.

Shu bo'linishdan qolgan deyarli butun arxitektura kelib chiqadi: undo arzon (snapshot - faqat source), hamma narsa deterministik (bitta source doim bitta derived beradi), og'ir hisoblar fonga chiqarilgan (derived hisoblash qimmat), va ma'lumotlar faqat bir tomonga oqadi - source'dan derived'ga, hech qachon teskarisiga.

Tanish narsalardan aytganda, bu Redux/Flux'ning bir yo'nalishli ma'lumot oqimiga o'xshaydi - yagona holat, o'zgarishlar faqat buyruqlar orqali, obunachilar hodisalarga javob beradi - ustiga esa computed/reselect kabi hisoblangan holat qatlami qo'shilgan.

## Beshta qatlam

| Qatlam | Papka | Nimaga javobgar | Nimalarni biladi |
|---|---|---|---|
| **UI** | `src/ui/` | kirish: chizish, panel, asboblar, tezkor tugmalar | modelni (buyruqlar yuboradi) |
| **Model** | `src/document/` | source + derived, tarix, hodisalar | o'zidan yuqoridagi hech narsani |
| **Domen** | `src/domain/` | sof mantiq: shakl qanday nuqtalarga aylanadi, WASM'ga ko'priklar | model uni chaqiradi |
| **Render** | `src/preview/` | rasm va uchburchaklarni three.js orqali chizadi | faqat modelni tinglaydi |
| **Native** | `crates/` | Rust->WASM: og'ir geometriya va rang | hech narsani, sof funksiyalar |

Yana bir nechta yordamchi papkalar bor: `persistence/` (saqlash va eksport), `settings/`, `i18n/`.

Oqim qoidasi: UI faqat modelni o'zgartiradi, render faqat modelni o'qiydi, ular bevosita bir-biri bilan gaplashmaydi. Ularni model ichidagi hodisalar shinasi bog'laydi - bu aynan bir yo'nalishli sikl.

## Ma'lumotlar oqimi

Asosiy stsenariy - "sichqoncha chizig'idan qayta bo'yalgan uchburchaklargacha":

```
   foydalanuvchi        (1) UI kirishni ushlaydi
       |
       v
   (2) buyruq SOURCE'ni o'zgartiradi: shakl qo'shildi/siljidi
       |
       v
   (3) qayta hisoblash: source -> nuqtalar -> uchburchaklar      [og'ir, fon worker'ida]
       |
       v
   (4) model natijani tekis buferlarga joylashtiradi va "tayyor" hodisasini yuboradi
       |
       v
   (5) render hodisani eshitadi va ekrandagi rasmni yangilaydi
       |
       +--> (6) parallel ravishda uchburchaklar rangi hisoblanadi -> yana bir hodisa -> qayta bo'yash
```

Bu siklni tezkor qiladigan uchta usul bor:

- **Bitta kadrga bitta qayta hisoblash.** Sudrab olib borishda sichqoncha hodisalari soniyasiga o'nlab tushadi, lekin qayta hisoblash kadrga bir martadan ko'p ishga tushmaydi - oraliq pozitsiyalar tashlab yuboriladi.
- **Render hech qachon kutmaydi.** Fonda aniq rang hisoblanayotgan paytda uchburchaklar darhol taxminiy rang bilan ko'rsatiladi; tayyor rang alohida hodisa sifatida keladi va ustiga tushadi.
- **Ortiqcha xotira ajratilmaydi.** Uchburchaklar obyekt sifatida emas, uzun tekis sonlar massivi sifatida yashaydi; render ham, eksport ham bu massivlarni to'g'ridan-to'g'ri o'qiydi.

## Vazifalar xaritasi

| O'zgartirmoqchi bo'lgan narsam... | Qarayotgan joyim... |
|---|---|
| chizish asboblarining xatti-harakati | `src/ui/tools/` |
| o'ng panel (shakllar daraxti, guruhlar) | `src/ui/panel/` |
| shakl qanday nuqtalarga aylanadi | `src/domain/modifiers/` |
| nuqtalarni sochish algoritmi / triangulyatsiya | `crates/pipeline/` |
| uchburchak rangi qanday hisoblanadi | `crates/color/` |
| chizish, kamera, qoplamalar | `src/preview/` |
| saqlash formati / undo | `src/document/` |
| diskka saqlash / SVG, PDF, PNG eksporti | `src/persistence/` |

## Qatlamlar bo'yicha tafsilotlar

### Model (`src/document/`)

Holat - bitta `DocumentData` obyekti (`types.ts`), aynan shu chegara bo'yicha bo'lingan:

- **Source** (saqlanadi, tarixda bor): `image`, `seed`, `seedSettings`, `colorSettings`, `stack` (shakllar daraxti).
- **Derived** (qayta hisoblanadi, saqlanmaydi): `points` va tekis render buferlari - `renderPositions` (har vertex uchun xyz), `renderColors` (har uchburchak uchun rgb), `triangleCount`.

O'zgarish model orqali qanday o'tadi:

- `store.ts` - yagona o'zgaruvchan holat obyekti (`store.data()`).
- `commands/` - uni o'zgartirishning yagona yo'li, reducer'larning analogi. Buyruq source'ni joyida tuzatadi va commit chaqiradi: `commit.ts` qayta hisoblash kerakligini hal qiladi (`commitStructural` - geometriya tuzatishlari uchun) yoki tarix qadamini yozish yetarli bo'ladimi (`commitViewOnly`, masalan papkani yig'ish).
- `commands/pipeline.ts` - qayta hisoblash (`evaluatePoints`). "Bir vaqtda bitta so'rov" tamoyili bo'yicha ishlaydi: qancha tuzatish kelmasin, worker'ga bir vaqtda faqat bitta hisob-kitob boradi, lekin oxirgisi doim oxirigacha yetkaziladi.
- `commands/recompute.ts` - natijani tekis buferlarga joylashtirish (`buildGeometry`) va hisoblangan rangni qo'llash (`applyColorGrid`).
- `signals.ts` - hodisalar shinasi (`ferrsign` ustida). Model hech narsani render qilmaydi; u faqat "nuqtalar o'zgardi", "uchburchaklar o'zgardi", "manba to'liq almashtirildi" deb xabar beradi, obunachilar esa - render, panel, tarix - javob berishadi.
- `history.ts` - undo/redo. Snapshot - faqat source, hatto rasmsiz ham, shu sababli arzon; butun sudrash harakati bitta qadamga siqiladi.
- `selectors/` - modelni tashqariga o'qish. Klonlarni qaytaradi, hech kim holatni buyruqlar chetlab o'zgartirmasligi uchun; istisno - tekis buferlar, tezlik uchun ular havola orqali qaytariladi.

Shakllar daraxti (`stack`) bir darajali, Blender'dagi kolleksiyalarga o'xshab: element - yo erkin shakl, yo bolalari bo'lgan guruh. Guruhda "yig'ish" (faqat ko'rinish) va "o'chirib qo'yish" (hisobdan chiqarish) bor. Stekdagi tartib ahamiyatli. Daraxt ustidagi strukturaviy amallar - `commands/stackTree.ts`, `modifierCommands.ts`, `groupCommands.ts`.

### Domen (`src/domain/`)

DOM'siz va three.js'siz mantiq; yagona istisno - `<canvas>`'dan piksellarni o'qiydigan `imageSource.ts`. Ikkita quyi mavzu bor:

- `modifiers/` - har bir shakl qanday qilib nuqtalar va cheklovchi qirralarga (`ModifierResult`) aylanadi: `path.ts` (siniq chiziq yoki Katmull-Rom splayni), `bezier.ts` (simmetrik dastaklari bilan Bezier egri chizig'i), `circle.ts`. Umumiy yig'uvchi - `result.ts`.
- Native qatlamga ko'priklar: har bir WASM crate uchun "fasad + worker + klient" uchligi bor. Og'ir hisoblar Web Worker'larda ishlaydi, ma'lumotlar chegarani transferable massivlar sifatida, nusxalanmasdan kesib o'tadi.

Mayda-chuydalar: `rng.ts` (deterministik pseudo-tasodifiy son generatori), `colorGrid.ts` (fazoviy rang qidiruvi), `groupColor.ts` (guruh rangi uning nomidan chiqariladi - nomini o'zgartirding, demak qayta bo'yading).

### Render (`src/preview/`)

Model hodisalarini faqat bir yo'nalishda tinglaydi, modelga teskari havola yo'q. Dunyo koordinatalari rasm koordinatalari bilan mos keladi (Y pastga), kamera ortografik.

- `preview.ts` - koordinator: bitta sahna, bitta render, qatlamlar to'plami.
- Qatlamlar o'z three.js obyektlariga egalik qiladi: `triangleLayer.ts` (uchburchaklar; buferlarni har kadrda qayta yaratmasdan qayta ishlatadi), `imageLayer.ts` (asl rasm), `pointLayer.ts` (sochilgan nuqtalar), `overlayLayer.ts` (tahrirlash qoplamalari: tanlash, dastaklar, qoralama).
- `receiving.ts` - "model hodisalari -> qatlam chaqiruvlari" ko'prigi. Shu yerda optimallashtirish ham bor: "qayta bo'yaldi" hodisasida faqat ranglar yangilanadi, "qayta qurildi" hodisasida esa - ham pozitsiyalar, ham ranglar.
- `viewport.ts` - kamera va ekran<->rasm koordinatalarini qayta hisoblash (zoom, panorama).

### UI (`src/ui/`)

Freymvorksiz imperativ DOM/canvas; panellar o'z DOM'ini hodisa bo'yicha qayta quradi. UI holati hech qachon bevosita o'zgartirilmaydi - faqat buyruqlar orqali.

- `tools.ts` (`ToolController`) - "tanlash / chizish / sudrash" rejimlari bo'yicha holat mashinasi; kirishni tuvalda ushlaydi.
- `tools/` - asboblarning amalga oshirilishi: chizilayotgan shakllarning qoralamalari (`*Draft.ts`) va `dragSession.ts` - nuqtani sudrash; aynan shu yerda "bitta kadrga bitta qayta hisoblash" va harakatni bitta undo qadamiga siqish yashaydi.
- `panel/` - o'ng panel: guruhlari va drag-and-drop'i bilan shakllar daraxti (`stackView.ts`, `dnd.ts`).
- Qolgani - asboblar paletasi, tanlash va yoritish, tezkor tugmalar, bildirishnomalar.

### Native qatlam (`crates/`)

Ikkita mustaqil crate; har biri yuklangan rasmni har chaqiruvda qayta yubormaslik uchun o'z ichida keshlaydi.

- `crates/pipeline/` - geometriya: `sobel.rs` (rasm chetlari bo'yicha zichlik xaritasi: keskin o'zgarish bo'lgan joyda nuqtalar zichroq), `seeding.rs` (o'zgaruvchan radiusli Bridson usulida nuqtalarni joylashtirish), `triangulate.rs` (cheklovlar bilan Delone triangulyatsiyasi, `spade` crate), `contours.rs` (rasm konturlarini tahrirlanadigan shakllarga aylantirish, Canny).
- `crates/color/` - rang: har bir uchburchak ostidagi rangni (o'rtacha yoki mediana) namunalaydi va tezkor qidiruv uchun fazoviy to'r quradi. Rang worker'ida ishlaydi.

Determinizm uchun muhim bo'lgan qismlar - pseudo-tasodifiy son generatori, sochish, namunalash - avvalgi TS implementatsiyasi bilan bit-bitiga ataylab mos keladi: bitta seed istalgan ishga tushirishda bir xil rasmni beradi.

## Quruvi

- `npm run build:wasm` - har bir crate uchun: cargo -> wasm-bindgen (`--target web`) -> wasm-opt (`-Oz`). Yelim kod `src/generated/` ichiga qo'yiladi (gitignore'da), `.wasm` `dist/` ichiga nusxalanadi va runtime'da yuklanadi.
- `npm run build` = `build:wasm`, keyin `rollup -c`. `npm run dev` watch (`-w`) qo'shadi.
- Deploy statik (GitHub Pages), backend'siz.

## Xulosa

Ilova faqat source'ni saqlaydi: foydalanuvchi uni UI orqali tuzatadi, model uni fon Rust/WASM pipeline orqali tekis buferlarga aylantiradi, render esa faqat shu buferlarni aks ettiradi. Qolgan hamma narsa - shu bitta bo'linishning natijasi.
