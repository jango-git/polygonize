# Polygonize - architektura

## Wstęp

Polygonize to działający w przeglądarce edytor obrazów low-poly: użytkownik rysuje na obrazie kształty pomocnicze (**modyfikatory**: linie, krzywe, okręgi), a aplikacja obsiewa punktami resztę przestrzeni, triangularyzuje ją i koloruje. Co to daje użytkownikowi - opisano w README; ten dokument dotyczy budowy kodu.

Najważniejsze, co trzeba zrozumieć przed czytaniem kodu: potok danych jest w pełni niedestrukcyjny. Stan jest ściśle podzielony na **source** - to, co ustalił użytkownik (obraz, ustawienia, drzewo kształtów) - oraz **derived** - punkty, triangulacja, kolory. W historii i w zapisie znajduje się wyłącznie source; derived jest przeliczane od nowa z source przy każdej zmianie i każdym wczytaniu, i nigdy nie jest zapisywane.

Z tego podziału wynika niemal cała pozostała architektura: cofanie (undo) jest tanie (migawka to tylko source), wszystko jest deterministyczne (jeden source zawsze daje jeden derived), ciężkie obliczenia są wyniesione w tło (derived jest kosztowne w obliczeniu), a dane płyną ściśle w jedną stronę - od source do derived, nigdy odwrotnie.

Z rzeczy znajomych przypomina to jednokierunkowy przepływ danych Redux/Flux - jeden wspólny stan, zmiany tylko przez komendy, subskrybenci reagują na zdarzenia - plus warstwa stanu wyliczanego nad tym, jak computed/reselect.

## Pięć warstw

| Warstwa | Folder | Za co odpowiada | Co zna |
|---|---|---|---|
| **UI** | `src/ui/` | wejście: rysowanie, panel, narzędzia, skróty klawiszowe | model (wysyła komendy) |
| **Model** | `src/document/` | source + derived, historia, zdarzenia | nic ponad siebie |
| **Domena** | `src/domain/` | czysta logika: jak kształt zamienia się w punkty, mosty do WASM | model go wywołuje |
| **Render** | `src/preview/` | rysuje obraz i trójkąty w three.js | tylko słucha modelu |
| **Natywna** | `crates/` | Rust->WASM: ciężka geometria i kolor | nic, czyste funkcje |

Jest jeszcze kilka pomocniczych folderów: `persistence/` (zapis i eksport), `settings/`, `i18n/`.

Zasada przepływu: UI zmienia tylko model, render tylko odczytuje model, bezpośrednio ze sobą nie rozmawiają. Łączy je szyna zdarzeń wewnątrz modelu - to właśnie ten jednokierunkowy cykl.

## Przepływ danych

Główny scenariusz - "od ruchu myszy do przemalowanych trójkątów":

```
   użytkownik          (1) UI przechwytuje wejście
       |
       v
   (2) komenda zmienia SOURCE: dodała/przesunęła kształt
       |
       v
   (3) przeliczenie: source -> punkty -> trójkąty      [ciężkie, w wątku roboczym w tle]
       |
       v
   (4) model umieszcza wynik w płaskich buforach i wysyła zdarzenie "gotowe"
       |
       v
   (5) render słyszy zdarzenie i aktualizuje obraz na ekranie
       |
       +--> (6) równolegle liczony jest kolor trójkątów -> kolejne zdarzenie -> przemalowanie
```

Ten cykl czynią responsywnym trzy zabiegi:

- **Jedno przeliczenie na klatkę.** Podczas przeciągania zdarzenia myszy sypią się dziesiątkami na sekundę, ale przeliczenie uruchamia się nie częściej niż raz na klatkę - pośrednie pozycje są odrzucane.
- **Render nigdy nie czeka.** Podczas gdy w tle liczony jest dokładny kolor, trójkąty od razu pokazywane są z przybliżonym; gotowy kolor przylatuje osobnym zdarzeniem i nakłada się na wierzch.
- **Żadnych zbędnych alokacji.** Trójkąty istnieją nie jako obiekty, lecz jako długie, płaskie tablice liczb; zarówno render, jak i eksport odczytują te tablice bezpośrednio.

## Mapa zadań

| Chcę zmienić... | Patrzę w... |
|---|---|
| zachowanie narzędzi do rysowania | `src/ui/tools/` |
| prawy panel (drzewo kształtów, grupy) | `src/ui/panel/` |
| jak kształt zamienia się w punkty | `src/domain/modifiers/` |
| algorytm siewu punktów / triangulację | `crates/pipeline/` |
| jak liczony jest kolor trójkąta | `crates/color/` |
| rysowanie, kamerę, nakładki | `src/preview/` |
| format zapisu / undo | `src/document/` |
| zapis na dysk / eksport SVG, PDF, PNG | `src/persistence/` |

## Szczegóły warstw

### Model (`src/document/`)

Stan to jeden obiekt `DocumentData` (`types.ts`), podzielony dokładnie wzdłuż tej granicy:

- **Source** (zapisywane, jest w historii): `image`, `seed`, `seedSettings`, `colorSettings`, `stack` (drzewo kształtów).
- **Derived** (przeliczane, niezapisywane): `points` oraz płaskie bufory renderu - `renderPositions` (xyz na wierzchołek), `renderColors` (rgb na trójkąt), `triangleCount`.

Jak zmiana przechodzi przez model:

- `store.ts` - pojedynczy mutowalny obiekt stanu (`store.data()`).
- `commands/` - jedyny sposób jego zmiany, odpowiednik reducerów. Komenda modyfikuje source na miejscu i wywołuje commit: `commit.ts` decyduje, czy potrzebne jest przeliczenie (`commitStructural` przy zmianach geometrii), czy wystarczy zapisać krok historii (`commitViewOnly`, na przykład zwinięcie folderu).
- `commands/pipeline.ts` - przeliczenie (`evaluatePoints`). Działa na zasadzie "jedno zapytanie w locie": niezależnie od liczby napływających zmian, do workera trafia jednocześnie tylko jedno obliczenie, ale ostatnie jest zawsze doprowadzane do końca.
- `commands/recompute.ts` - rozłożenie wyniku w płaskie bufory (`buildGeometry`) i zastosowanie wyliczonego koloru (`applyColorGrid`).
- `signals.ts` - szyna zdarzeń (na `ferrsign`). Model niczego nie renderuje; jedynie informuje "punkty się zmieniły", "trójkąty się zmieniły", "source zastąpiony całkowicie", a subskrybenci - render, panel, historia - reagują.
- `history.ts` - undo/redo. Migawka to tylko source, nawet bez obrazu, więc jest tania; cały gest przeciągania zwija się do jednego kroku.
- `selectors/` - odczyt modelu na zewnątrz. Zwraca klony, żeby nikt nie psuł stanu z pominięciem komend; wyjątek to płaskie bufory - są zwracane przez referencję dla szybkości.

Drzewo kształtów (`stack`) jest jednopoziomowe, jak kolekcje w Blenderze: element jest albo samodzielnym kształtem, albo grupą z dziećmi. Grupa ma opcje "zwiń" (tylko widok) i "wycisz" (wyklucz z obliczeń). Kolejność w stosie ma znaczenie. Strukturalne operacje na drzewie znajdują się w `commands/stackTree.ts`, `modifierCommands.ts`, `groupCommands.ts`.

### Domena (`src/domain/`)

Logika bez DOM i three.js; jedynym wyjątkiem jest `imageSource.ts`, który odczytuje piksele z `<canvas>`. Dwa podtematy:

- `modifiers/` - jak każdy kształt zamienia się w punkty i krawędzie-ograniczenia (`ModifierResult`): `path.ts` (łamana lub splajn Catmulla-Roma), `bezier.ts` (krzywa Beziera z symetrycznymi uchwytami), `circle.ts`. Wspólny agregator to `result.ts`.
- Mosty do warstwy natywnej: dla każdego crate'a WASM istnieje trójka "fasada + worker + klient". Ciężkie obliczenia idą do Web Workerów, dane przekraczają granicę jako tablice transferable, bez kopiowania.

Drobiazgi: `rng.ts` (deterministyczny generator liczb pseudolosowych), `colorGrid.ts` (przestrzenne wyszukiwanie koloru), `groupColor.ts` (kolor grupy wynika z jej nazwy - zmieniłeś nazwę, znaczy przemalowałeś).

### Render (`src/preview/`)

Nasłuchuje zdarzeń modelu ściśle w jedną stronę, nie ma odwrotnego odwołania do modelu. Współrzędne świata pokrywają się ze współrzędnymi obrazu (Y w dół), kamera jest ortograficzna.

- `preview.ts` - koordynator: jedna scena, jeden renderer, zestaw warstw.
- Warstwy posiadają własne obiekty three.js: `triangleLayer.ts` (trójkąty; ponownie wykorzystuje bufory zamiast tworzyć je od nowa co klatkę), `imageLayer.ts` (obraz źródłowy), `pointLayer.ts` (punkty siewu), `overlayLayer.ts` (nakładki edycji: zaznaczenie, uchwyty, szkic).
- `receiving.ts` - most "zdarzenia modelu -> wywołania warstw". Tu też jest optymalizacja: przy zdarzeniu "przemalowano" aktualizowane są tylko kolory, przy "przebudowano" - zarówno pozycje, jak i kolory.
- `viewport.ts` - kamera i przeliczanie współrzędnych ekran<->obraz (zoom, panoramowanie).

### UI (`src/ui/`)

Imperatywny DOM/canvas bez frameworka; panele przebudowują swój DOM na podstawie zdarzenia. Stan UI nigdy nie zmienia się bezpośrednio - tylko przez komendy.

- `tools.ts` (`ToolController`) - automat skończony trybów "wybór / rysowanie / przeciąganie"; przechwytuje wejście na płótnie.
- `tools/` - implementacja narzędzi: szkice rysowanych kształtów (`*Draft.ts`) oraz `dragSession.ts` - przeciąganie punktu; tu żyją "jedno przeliczenie na klatkę" i zwinięcie gestu w jeden krok undo.
- `panel/` - prawy panel: drzewo kształtów z grupami i przeciąganiem-upuszczaniem (`stackView.ts`, `dnd.ts`).
- Reszta - paleta narzędzi, zaznaczanie i podświetlanie, skróty klawiszowe, powiadomienia.

### Warstwa natywna (`crates/`)

Dwa niezależne crate'y; każdy buforuje u siebie wczytany obraz, żeby nie przesyłać go przy każdym wywołaniu.

- `crates/pipeline/` - geometria: `sobel.rs` (mapa gęstości na podstawie krawędzi obrazu: gdzie jest ostry skok, tam punkty są gęściej), `seeding.rs` (rozmieszczanie punktów metodą Bridsona ze zmiennym promieniem), `triangulate.rs` (triangulacja Delaunaya z ograniczeniami, crate `spade`), `contours.rs` (śledzenie konturów obrazu i zamiana na edytowalne kształty, Canny).
- `crates/color/` - kolor: próbkuje kolor pod każdym trójkątem (średnia albo mediana) i buduje siatkę przestrzenną do szybkiego wyszukiwania. Działa w workerze kolorów.

Części krytyczne dla determinizmu - generator liczb pseudolosowych, siew, próbkowanie - celowo pokrywają się bit w bit z dawną implementacją TS: ten sam seed daje ten sam obraz przy każdym uruchomieniu.

## Budowanie

- `npm run build:wasm` - dla każdego crate'a: cargo -> wasm-bindgen (`--target web`) -> wasm-opt (`-Oz`). Sklejony kod trafia do `src/generated/` (w gitignore), plik `.wasm` jest kopiowany do `dist/` i ładowany w czasie działania.
- `npm run build` = `build:wasm`, następnie `rollup -c`. `npm run dev` dodaje watch (`-w`).
- Wdrożenie jest statyczne (GitHub Pages), bez backendu.

## Podsumowanie

Aplikacja przechowuje tylko source: użytkownik modyfikuje go przez UI, model przepuszcza go przez działający w tle potok Rust/WASM do płaskich buforów, a render jedynie odzwierciedla te bufory. Wszystko pozostałe jest konsekwencją tego jednego podziału.
