# <img src="../logo.svg" alt="" height="28" align="absmiddle"> Tesselot

[en](../README.md) · [zh-Hans](README.zh-Hans.md) · [hi](README.hi.md) · [es](README.es.md) · [fr](README.fr.md) · [bn](README.bn.md) · [pt](README.pt.md) · [ru](README.ru.md) · [id](README.id.md) · [de](README.de.md) · [ja](README.ja.md) · [tr](README.tr.md) · [vi](README.vi.md) · [ko](README.ko.md) · [it](README.it.md) · **pl** · [uk](README.uk.md) · [uz](README.uz.md) · [az](README.az.md) · [kk](README.kk.md) · [be](README.be.md)

Edytor działający w przeglądarce, który zamienia zdjęcie w obraz low-poly - obraz złożony z trójkątów. Od zwykłych generatorów odróżnia go jedna kluczowa rzecz: oprócz automatycznie wygenerowanej siatki sam rysujesz linie pomocnicze, a krawędzie trójkątów podążają wzdłuż nich. Ważne kontury - linia podbródka, oprawki okularów, sylwetka - pozostają wyraźne, zamiast ginąć w przypadkowej siatce.

**[OTWÓRZ EDYTOR](https://jango-git.github.io/tesselot/)**

![Zrzut ekranu](../image.png)

## Co potrafi

- **Linie pomocnicze.** Rysujesz linie, okręgi i płynne krzywe na obrazie - trójkąty ustawiają się wzdłuż nich. To nie jednorazowa operacja, lecz modyfikatory: w każdej chwili możesz je przesuwać, zmieniać szczegółowość, grupować.
- **Siatka, która dostosowuje się do detali.** Tam, gdzie jest dużo drobiazgów i ostrych krawędzi, trójkąty są mniejsze, a na płaskich obszarach, takich jak niebo - większe. Obraz wychodzi szczegółowy tam, gdzie trzeba, a spokojny w pozostałych miejscach.
- **Automatyczne obrysowanie.** Aby nie zaczynać od pustej kartki, naciśnij "Obrysuj": edytor znajdzie krawędzie obrazu i zamieni je w edytowalne modyfikatory, zebrane w osobnej grupie.
- **Kolor trójkątów.** Każdy trójkąt jest wypełniany średnim kolorem pikseli pod nim - lub medianowym, jeśli trzeba stłumić jaskrawe wartości odstające.
- **Eksport.** Wektor (SVG, PDF) lub raster (PNG, JPG, WebP) aż do 4096 pikseli.
- **Projekty.** Zapisuj pracę do pliku `.json` i wracaj do niej później. Bieżąca sesja odtwarza się też sama - nawet jeśli po prostu zamknąłeś kartę.
- **Interfejs w 21 językach.** Język jest wykrywany na podstawie przeglądarki, przełącza się na górnym pasku.

## Pod maską

Punkty są rozmieszczane metodą próbkowania dysku Poissona (algorytm Bridsona) ze zmiennym promieniem - wyznacza go mapa krawędzi Sobela, dlatego wzdłuż konturów siatka jest gęstsza. Generowanie jest deterministyczne: ten sam seed daje tę samą siatkę. Cały ciężki geometryczny potok obliczeniowy - mapa krawędzi, rozmieszczanie punktów, triangulacja - jest zebrany w module WASM napisanym w Rust; kolor trójkątów liczony jest osobno, w Web Workerze.

Jeśli zamierzasz czytać kod źródłowy, zacznij od [przeglądu architektury](onboarding.pl.md).

## Rozwój

```sh
npm install
npm run dev    # serwer deweloperski na http://localhost:3000
npm run build  # tworzy dist/bundle.js
```

## Licencja

[MIT](../LICENSE)
