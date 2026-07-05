# Tesselot - mimari

## Önsöz

Tesselot, tarayıcı tabanlı bir low-poly görüntü editörüdür: kullanıcı görüntünün üzerine kılavuz şekiller (**modifikatörler**: çizgiler, eğriler, çemberler) çizer, uygulama ise kalan alanı noktalarla doldurur, üçgenler ve boyar. Bunun kullanıcıya ne kazandırdığı README'de anlatılıyor; bu belge kodun nasıl kurgulandığıyla ilgili.

Koda bakmadan önce anlaşılması gereken en önemli şey: pipeline tamamen yıkıcı olmayandır (non-destructive). Durum kesin bir şekilde ikiye ayrılır: kullanıcının belirlediği **source** (görüntü, ayarlar, şekil ağacı) ve **derived** (noktalar, üçgenleme, renkler). Yalnızca source saklanır ve geçmişe (history) girer; derived, her değişiklikte ve her yüklemede source'tan yeniden hesaplanır ve asla kaydedilmez.

Mimarinin geri kalanının neredeyse tamamı bu ayrımdan çıkar: undo ucuzdur (anlık görüntü sadece source'tur), her şey deterministiktir (bir source her zaman aynı derived'i verir), ağır hesaplamalar arka plana taşınmıştır (derived'i hesaplamak pahalıdır) ve veri kesinlikle tek yönde akar - source'tan derived'e, asla tersine değil.

Tanıdık gelen bir benzetmeyle: bu, Redux/Flux'un tek yönlü veri akışına benziyor - tek bir durum, değişiklikler yalnızca komutlarla, aboneler olaylara tepki verir - buna ek olarak, computed/reselect gibi üzerine kurulu bir hesaplanmış durum katmanı var.

## Beş katman

| Katman | Klasör | Sorumluluğu | Neyi bilir |
|---|---|---|---|
| **UI** | `src/ui/` | girdi: çizim, panel, araçlar, kısayol tuşları | modeli (komut gönderir) |
| **Model** | `src/document/` | source + derived, geçmiş, olaylar | kendinden üstünü bilmez |
| **Domain** | `src/domain/` | saf mantık: şeklin noktalara dönüşümü, WASM'a köprüler | model onu çağırır |
| **Render** | `src/preview/` | görüntüyü ve üçgenleri three.js ile çizer | yalnızca modeli dinler |
| **Native** | `crates/` | Rust->WASM: ağır geometri ve renk | başka hiçbir şeyi bilmez, saf fonksiyonlar |

Birkaç yardımcı klasör daha var: `persistence/` (kaydetme ve dışa aktarma), `settings/`, `i18n/`.

Akış kuralı: UI yalnızca modeli değiştirir, render yalnızca modeli okur, ikisi doğrudan birbiriyle konuşmaz. Onları model içindeki olay veriyolu (event bus) birbirine bağlar - tek yönlü döngü budur.

## Veri akışı

Ana senaryo - "fare hareketinden yeniden boyanmış üçgenlere":

```
   kullanıcı            (1) UI girdiyi yakalar
       |
       v
   (2) komut SOURCE'u değiştirir: şekil eklendi/taşındı
       |
       v
   (3) yeniden hesaplama: source -> noktalar -> üçgenler      [ağır, arka plan worker'ında]
       |
       v
   (4) model sonucu düz buffer'lara yazar ve "hazır" olayını gönderir
       |
       v
   (5) render olayı duyar ve ekrandaki görüntüyü günceller
       |
       +--> (6) paralel olarak üçgenlerin rengi hesaplanır -> bir olay daha -> yeniden boyama
```

Bu döngüyü hızlı tepki verir hale getiren üç teknik var:

- **Kare başına tek yeniden hesaplama.** Sürükleme sırasında fare olayları saniyede onlarca kez gelir, ama yeniden hesaplama karede en fazla bir kez çalışır - aradaki pozisyonlar atlanır.
- **Render asla beklemez.** Arka planda kesin renk hesaplanırken üçgenler hemen yaklaşık bir renkle gösterilir; hazır renk ayrı bir olayla gelir ve üzerine biner.
- **Gereksiz bellek ayırma yok.** Üçgenler nesne olarak değil, uzun düz sayı dizileri olarak yaşar; hem render hem dışa aktarma bu dizileri doğrudan okur.

## Görev haritası

| Değiştirmek istediğim... | Baktığım yer... |
|---|---|
| çizim araçlarının davranışı | `src/ui/tools/` |
| sağ panel (şekil ağacı, gruplar) | `src/ui/panel/` |
| şeklin noktalara nasıl dönüştüğü | `src/domain/modifiers/` |
| nokta serpme algoritması / üçgenleme | `crates/pipeline/` |
| üçgen renginin nasıl hesaplandığı | `crates/color/` |
| çizim, kamera, overlay'ler | `src/preview/` |
| kayıt formatı / undo | `src/document/` |
| diske kaydetme / SVG, PDF, PNG dışa aktarma | `src/persistence/` |

## Katman detayları

### Model (`src/document/`)

Durum tek bir `DocumentData` nesnesidir (`types.ts`), tam olarak şu sınırla ikiye ayrılır:

- **Source** (kaydedilir, geçmişte yer alır): `image`, `seed`, `seedSettings`, `colorSettings`, `stack` (şekil ağacı).
- **Derived** (yeniden hesaplanır, kaydedilmez): `points` ve düz render buffer'ları - `renderPositions` (köşe başına xyz), `renderColors` (üçgen başına rgb), `triangleCount`.

Bir değişiklik modelden şöyle geçer:

- `store.ts` - tek, değiştirilebilir durum nesnesi (`store.data()`).
- `commands/` - onu değiştirmenin tek yolu, reducer'ların benzeri. Komut source'u yerinde düzenler ve bir commit çağırır: `commit.ts`, yeniden hesaplama mı gerektiği (geometri düzenlemeleri için `commitStructural`) yoksa sadece bir geçmiş adımı yazmak mı yeterli olduğuna (`commitViewOnly`, örneğin bir klasörü daraltmak) karar verir.
- `commands/pipeline.ts` - yeniden hesaplama (`evaluatePoints`). "Uçuşta tek istek" ilkesiyle çalışır: ne kadar düzenleme gelirse gelsin, worker'a aynı anda yalnızca bir hesaplama gider, ama sonuncusu her zaman sonuna kadar tamamlanır.
- `commands/recompute.ts` - sonucu düz buffer'lara yerleştirme (`buildGeometry`) ve hesaplanan rengin uygulanması (`applyColorGrid`).
- `signals.ts` - olay veriyolu (`ferrsign` üzerinde). Model hiçbir şeyi çizmez; yalnızca "noktalar değişti", "üçgenler değişti", "kaynak tamamen değiştirildi" der, aboneler ise - render, panel, geçmiş - buna tepki verir.
- `history.ts` - undo/redo. Anlık görüntü yalnızca source'tur, görüntü bile içermez, bu yüzden ucuzdur; bütün bir sürükleme hareketi tek bir adıma sıkışır.
- `selectors/` - modelin dışa okunması. Kimse durumu komutları es geçerek bozmasın diye klonlar döner; istisna, düz buffer'lardır - hız için referansla döndürülürler.

Şekil ağacı (`stack`) Blender'daki koleksiyonlar gibi tek katmanlıdır: bir öğe ya bağımsız bir şekildir ya da çocukları olan bir gruptur. Grubun "daralt" (yalnızca görünüm) ve "sustur" (hesaplamadan hariç tut) özellikleri vardır. Stack içindeki sıra önemlidir. Ağaç üzerindeki yapısal işlemler `commands/stackTree.ts`, `modifierCommands.ts`, `groupCommands.ts` içindedir.

### Domain (`src/domain/`)

DOM ve three.js olmadan çalışan mantık; tek istisna, `<canvas>`'tan piksel okuyan `imageSource.ts`. İki alt konu var:

- `modifiers/` - her şeklin noktalara ve kısıt kenarlarına (`ModifierResult`) nasıl dönüştüğü: `path.ts` (çoklu çizgi ya da Catmull-Rom spline), `bezier.ts` (simetrik tutamaçlı Bezier eğrisi), `circle.ts`. Ortak toplayıcı `result.ts`.
- Native katmana köprüler: her WASM crate'i için bir "facade + worker + client" üçlüsü vardır. Ağır hesaplamalar Web Worker'larda çalışır, veri sınırı transferable dizileri olarak, kopyalanmadan geçer.

Ufak tefek şeyler: `rng.ts` (deterministik PRNG), `colorGrid.ts` (uzamsal renk arama), `groupColor.ts` (grup rengi adından türetilir - adını değiştirdiysen rengi de değişmiştir).

### Render (`src/preview/`)

Model olaylarını kesinlikle tek yönde dinler, modele geri referans yoktur. Dünya koordinatları görüntü koordinatlarıyla örtüşür (Y aşağı doğru), kamera ortografiktir.

- `preview.ts` - koordinatör: tek sahne, tek renderer, bir dizi katman.
- Katmanlar kendi three.js nesnelerine sahiptir: `triangleLayer.ts` (üçgenler; buffer'ları her karede yeniden oluşturmak yerine yeniden kullanır), `imageLayer.ts` (kaynak görüntü), `pointLayer.ts` (serpilen noktalar), `overlayLayer.ts` (düzenleme overlay'leri: seçim, tutamaçlar, taslak).
- `receiving.ts` - "model olayları -> katman çağrıları" köprüsü. Buradaki optimizasyon: "yeniden boyandı" olayında yalnızca renkler, "yeniden inşa edildi" olayında ise hem pozisyonlar hem renkler güncellenir.
- `viewport.ts` - kamera ve ekran<->görüntü koordinat dönüşümü (zum, kaydırma).

### UI (`src/ui/`)

Framework içermeyen, buyurgan (imperative) DOM/canvas kodu; paneller olay üzerine kendi DOM'unu yeniden kurar. UI durumu asla doğrudan değiştirilmez - yalnızca komutlar üzerinden.

- `tools.ts` (`ToolController`) - "seçim / çizim / sürükleme" modları için bir durum makinesi; tuvaldeki girdiyi yakalar.
- `tools/` - araçların uygulanması: çizilen şekillerin taslakları (`*Draft.ts`) ve nokta sürüklemesi için `dragSession.ts`; "kare başına tek yeniden hesaplama" ve hareketin tek bir undo adımına sıkıştırılması burada yaşar.
- `panel/` - sağ panel: gruplu şekil ağacı ve sürükle-bırak (`stackView.ts`, `dnd.ts`).
- Geri kalanı - araç paleti, seçim ve vurgulama, kısayol tuşları, bildirimler.

### Native katman (`crates/`)

İki bağımsız crate; her biri her çağrıda görüntüyü yeniden göndermemek için yüklenen görüntüyü kendi içinde önbelleğe alır.

- `crates/pipeline/` - geometri: `sobel.rs` (görüntünün kenarlarına göre yoğunluk haritası: keskin geçiş olan yerde noktalar sıklaşır), `seeding.rs` (değişken yarıçaplı Bridson yöntemiyle nokta yerleştirme), `triangulate.rs` (kısıtlı Delaunay üçgenlemesi, `spade` crate'i), `contours.rs` (görüntü konturlarının düzenlenebilir şekillere izlenmesi, Canny).
- `crates/color/` - renk: her üçgenin altındaki rengi örnekler (ortalama ya da medyan) ve hızlı arama için uzamsal bir ızgara kurar. Renk worker'ı içinde çalışır.

Determinizm için kritik olan kısımlar - PRNG, serpme, örnekleme - eski TS uygulamasıyla kasıtlı olarak bit bit örtüşür: bir seed her çalıştırmada aynı görüntüyü verir.

## Derleme

- `npm run build:wasm` - her crate için: cargo -> wasm-bindgen (`--target web`) -> wasm-opt (`-Oz`). Üretilen bağlantı kodu `src/generated/` içine konur (gitignore'da), `.wasm` dosyası `dist/` içine kopyalanır ve çalışma zamanında yüklenir.
- `npm run build` = `build:wasm`, ardından `rollup -c`. `npm run dev`, watch (`-w`) ekler.
- Dağıtım statiktir (GitHub Pages), backend yoktur.

## Özet

Uygulama yalnızca source'u saklar: kullanıcı onu UI üzerinden düzenler, model onu arka plandaki Rust/WASM pipeline'ından geçirip düz buffer'lara dönüştürür, render ise yalnızca bu buffer'ları yansıtır. Geri kalan her şey bu tek ayrımın sonucudur.
