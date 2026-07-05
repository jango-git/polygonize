# Tesselot - arxitektura

## Ön söz

Tesselot - low-poly şəkil redaktoru: istifadəçi şəklin üstündə istiqamətləndirici fiqurlar (**modifikatorlar**: xətlər, əyrilər, çevrələr) çəkir, tətbiq isə qalan sahəni nöqtələrlə səpələyir, triangulyasiya edir və rəngləyir. Bunun istifadəçiyə nə verdiyi README-də yazılıb; bu sənəd isə kodun quruluşu haqqındadır.

Koda baxmazdan əvvəl anlamalı olduğun ən vacib şey: kanvyer tamamilə dağıdıcı deyil (non-destructive). Vəziyyət ciddi şəkildə ikiyə bölünür - **source** (istifadəçinin təyin etdiyi: şəkil, parametrlər, fiqurlar ağacı) və **derived** (nöqtələr, triangulyasiya, rənglər). Yalnız source saxlanılır və tarixçəyə düşür; derived isə hər dəyişiklikdə və hər yükləmədə source-dan yenidən hesablanır və heç vaxt saxlanılmır.

Demək olar ki, bütün digər arxitektura bu bölgüdən irəli gəlir: undo ucuzdur (snapshot - yalnız source), hər şey deterministikdir (bir source həmişə bir derived verir), ağır hesablamalar fon rejiminə çıxarılıb (derived-i hesablamaq bahalıdır), məlumat isə yalnız bir istiqamətdə axır - source-dan derived-ə, heç vaxt geriyə.

Tanış olan bir şeylə müqayisə etsək, bu Redux/Flux-un birtərəfli məlumat axınına bənzəyir - vahid vəziyyət, dəyişikliklər yalnız komandalar vasitəsilə, abunəçilər hadisələrə reaksiya verir - üstəgəl bunun üzərində hesablanan vəziyyət qatı, computed/reselect kimi.

## Beş qat

| Qat | Qovluq | Nəyə cavabdehdir | Nədən xəbərdardır |
|---|---|---|---|
| **UI** | `src/ui/` | giriş: çəkmə, panel, alətlər, qısayollar | modeldən (ona komandalar göndərir) |
| **Model** | `src/document/` | source + derived, tarixçə, hadisələr | özündən yuxarıda heç nədən |
| **Domen** | `src/domain/` | təmiz məntiq: fiqur necə nöqtəyə çevrilir, WASM-a körpülər | model onu çağırır |
| **Render** | `src/preview/` | şəkli və üçbucaqları three.js ilə çəkir | yalnız modeli dinləyir |
| **Native** | `crates/` | Rust->WASM: ağır həndəsə və rəng | heç nədən, təmiz funksiyalar |

Bir neçə köməkçi qovluq da var: `persistence/` (saxlama və ixrac), `settings/`, `i18n/`.

Axının qaydası: UI yalnız modeli dəyişir, render yalnız modeli oxuyur, birbaşa bir-biri ilə danışmırlar. Onları model daxilindəki hadisə şini birləşdirir - birtərəfli dövr elə budur.

## Məlumat axını

Əsas ssenari - "siçan xəttindən yenidən rənglənmiş üçbucaqlara qədər":

```
   istifadəçi         (1) UI girişi tutur
       |
       v
   (2) komanda SOURCE-u dəyişir: fiqur əlavə edir/köçürür
       |
       v
   (3) yenidən hesablama: source -> nöqtələr -> üçbucaqlar      [ağır, fon worker-ində]
       |
       v
   (4) model nəticəni yastı buferlərə yazır və "hazırdır" hadisəsini göndərir
       |
       v
   (5) render hadisəni eşidir və ekrandakı şəkli yeniləyir
       |
       +--> (6) paralel olaraq üçbucaqların rəngi hesablanır -> daha bir hadisə -> yenidən rəngləmə
```

Bu dövrü sürətli edən üç üsul var:

- **Kadr başına bir hesablama.** Sürükləmə zamanı siçan hadisələri saniyədə onlarla gəlir, amma yenidən hesablama kadr başına birdən çox işə düşmür - aralıq mövqelər atılır.
- **Render heç vaxt gözləmir.** Fonda dəqiq rəng hesablanan zaman üçbucaqlar dərhal təxmini rənglə göstərilir; hazır rəng ayrıca hadisə kimi gəlir və üzərinə düşür.
- **Artıq ayırma (allocation) yoxdur.** Üçbucaqlar obyekt kimi deyil, uzun yastı ədəd massivləri kimi yaşayır; həm render, həm də ixrac bu massivləri birbaşa oxuyur.

## Tapşırıq xəritəsi

| Nəyi dəyişmək istəyirəm... | Haraya baxıram... |
|---|---|
| çəkmə alətlərinin davranışı | `src/ui/tools/` |
| sağ panel (fiqurlar ağacı, qruplar) | `src/ui/panel/` |
| fiqur necə nöqtəyə çevrilir | `src/domain/modifiers/` |
| nöqtə səpələmə alqoritmi / triangulyasiya | `crates/pipeline/` |
| üçbucağın rəngi necə hesablanır | `crates/color/` |
| çəkiliş, kamera, overlay-lər | `src/preview/` |
| saxlama formatı / undo | `src/document/` |
| diskə yazma / SVG, PDF, PNG ixracı | `src/persistence/` |

## Qatlar üzrə təfərrüatlar

### Model (`src/document/`)

Vəziyyət - `types.ts`-də təyin olunmuş, məhz bu sərhəd üzrə bölünmüş vahid `DocumentData` obyektidir:

- **Source** (saxlanılır, tarixçədə var): `image`, `seed`, `seedSettings`, `colorSettings`, `stack` (fiqurlar ağacı).
- **Derived** (yenidən hesablanır, saxlanılmır): `points` və render-in yastı buferləri - `renderPositions` (təpə başına xyz), `renderColors` (üçbucaq başına rgb), `triangleCount`.

Dəyişikliyin model daxilindəki yolu:

- `store.ts` - vahid dəyişdirilə bilən vəziyyət obyekti (`store.data()`).
- `commands/` - onu dəyişməyin yeganə yolu, reducers-in analoqu. Komanda source-u yerində düzəldir və commit çağırır: `commit.ts` yenidən hesablamanın lazım olub-olmadığına qərar verir (`commitStructural` - həndəsə düzəlişləri üçün) və ya tarixçəyə yalnız bir addım yazmaq kifayət edir (`commitViewOnly`, məsələn qovluğu yığmaq).
- `commands/pipeline.ts` - yenidən hesablama (`evaluatePoints`). "Uçuşda bir sorğu" prinsipi ilə işləyir: nə qədər düzəliş gəlsə də, worker-ə eyni anda yalnız bir hesablama gedir, amma sonuncusu həmişə sona qədər aparılır.
- `commands/recompute.ts` - nəticənin yastı buferlərə yerləşdirilməsi (`buildGeometry`) və hesablanmış rəngin tətbiqi (`applyColorGrid`).
- `signals.ts` - hadisə şini (`ferrsign` üzərində). Model heç nəyi çəkmir; sadəcə "nöqtələr dəyişdi", "üçbucaqlar dəyişdi", "mənbə tamamilə əvəz olundu" deyir, abunəçilər isə - render, panel, tarixçə - buna reaksiya verir.
- `history.ts` - undo/redo. Snapshot - yalnız source-dur, şəkil belə yoxdur, ona görə ucuzdur; bütün sürükləmə jesti bir addıma yığılır.
- `selectors/` - modelin xaricə oxunması. Kimsə komandalardan kənar vəziyyəti korlamasın deyə klonlar qaytarılır; istisna - yastı buferlər, sürət üçün onlar istinadla verilir.

Fiqurlar ağacı (`stack`) Blender-dəki kolleksiyalar kimi bir səviyyəlidir: element ya sərbəst fiqurdur, ya da uşaqları olan qrupdur. Qrupun "yığmaq" (yalnız görünüş) və "susdurmaq" (hesablamadan çıxarmaq) imkanı var. Stekdəki sıra əhəmiyyətlidir. Ağac üzərində struktur əməliyyatlar - `commands/stackTree.ts`, `modifierCommands.ts`, `groupCommands.ts`.

### Domen (`src/domain/`)

DOM və three.js olmadan məntiq; yeganə istisna - `<canvas>`-dan pikselləri oxuyan `imageSource.ts`. İki alt-mövzu:

- `modifiers/` - hər fiqurun necə nöqtələrə və məhdudlaşdırıcı tillərə (`ModifierResult`) çevrildiyi: `path.ts` (sınıq xətt və ya Catmull-Rom splayn), `bezier.ts` (simmetrik dəstəkli Bezier əyrisi), `circle.ts`. Ümumi yığıcı - `result.ts`.
- Native qata körpülər: hər WASM crate üçün "fasad + worker + client" üçlüyü var. Ağır hesablamalar Web Worker-lərdə gedir, məlumat sərhədi köçürülə bilən (transferable) massivlər kimi, kopiyasız keçir.

Xırdalıqlar: `rng.ts` (deterministik PSGY), `colorGrid.ts` (rəngin fəza üzrə axtarışı), `groupColor.ts` (qrupun rəngi onun adından çıxarılır - adı dəyişdinsə, rəngi də dəyişilib).

### Render (`src/preview/`)

Model hadisələrini yalnız bir istiqamətdə dinləyir, modelə geri istinad yoxdur. Dünya koordinatları şəklin koordinatları ilə üst-üstə düşür (Y aşağı), kamera ortoqrafikdir.

- `preview.ts` - koordinator: bir səhnə, bir renderer, qatlar toplusu.
- Qatlar öz three.js obyektlərinin sahibidir: `triangleLayer.ts` (üçbucaqlar; buferləri hər kadr yenidən yaratmaq əvəzinə təkrar istifadə edir), `imageLayer.ts` (orijinal şəkil), `pointLayer.ts` (səpələnmə nöqtələri), `overlayLayer.ts` (redaktə overlay-ləri: seçim, tutacaqlar, qaralama).
- `receiving.ts` - "model hadisələri -> qat çağırışları" körpüsü. Burada optimizasiya var: "yenidən rənglənib" hadisəsində yalnız rənglər, "yenidən qurulub" hadisəsində isə həm mövqelər, həm rənglər yenilənir.
- `viewport.ts` - kamera və ekran<->şəkil koordinatlarının çevrilməsi (zoom, panorama).

### UI (`src/ui/`)

Freymvorksuz imperativ DOM/canvas; panellər öz DOM-larını hadisə üzrə yenidən qururlar. UI vəziyyəti heç vaxt birbaşa dəyişmir - yalnız komandalar vasitəsilə.

- `tools.ts` (`ToolController`) - "seçim / çəkmə / sürükləmə" rejimləri üzrə sonlu avtomat; canvas-da girişi tutur.
- `tools/` - alətlərin realizasiyası: çəkilən fiqurların qaralamaları (`*Draft.ts`) və nöqtənin sürüklənməsi üçün `dragSession.ts`; "kadr başına bir hesablama" və jestin bir undo addımına yığılması burada yaşayır.
- `panel/` - sağ panel: qruplu fiqurlar ağacı və sürükləyib-burax (`stackView.ts`, `dnd.ts`).
- Qalanı - alət paleti, seçim və işıqlandırma, qısayollar, bildirişlər.

### Native qat (`crates/`)

İki müstəqil crate; hər biri yüklənmiş şəkli özündə keşləyir ki, onu hər çağırışda yenidən göndərmək lazım olmasın.

- `crates/pipeline/` - həndəsə: `sobel.rs` (şəklin kənarları üzrə sıxlıq xəritəsi: kəskin keçid olan yerdə nöqtələr daha sıxdır), `seeding.rs` (dəyişkən radiuslu Bridson metodu ilə nöqtələrin yerləşdirilməsi), `triangulate.rs` (məhdudiyyətli Delaunay triangulyasiyası, `spade` crate-i), `contours.rs` (şəklin konturlarının redaktə oluna bilən fiqurlara izlənməsi, Canny).
- `crates/color/` - rəng: hər üçbucağın altındakı rəngi (orta və ya median) seçir və sürətli axtarış üçün fəza toru qurur. Rəng worker-i daxilində işləyir.

Determinizm üçün kritik hissələr - PSGY, səpələmə, seçmə - əvvəlki TS-realizasiyası ilə bit-bə-bit qəsdən üst-üstə düşür: bir seed istənilən işə salmada eyni şəkli verir.

## Yığma (Build)

- `npm run build:wasm` - hər crate üçün: cargo -> wasm-bindgen (`--target web`) -> wasm-opt (`-Oz`). Yapışdırma `src/generated/`-ə qoyulur (gitignore-da), `.wasm` `dist/`-ə kopyalanır və işlədilmə zamanı yüklənir.
- `npm run build` = `build:wasm`, sonra `rollup -c`. `npm run dev` watch (`-w`) əlavə edir.
- Deploy statikdir (GitHub Pages), backend yoxdur.

## Yekun

Tətbiq yalnız source-u saxlayır: istifadəçi onu UI vasitəsilə düzəldir, model onu fon Rust/WASM kanvyerindən keçirib yastı buferlərə çevirir, render isə sadəcə bu buferləri əks etdirir. Qalan hər şey bu tək bölgünün nəticəsidir.
</content>
