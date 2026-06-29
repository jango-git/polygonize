# <img src="../logo.svg" alt="" height="28" align="absmiddle"> Polygonize

[en](../README.md) · [zh-Hans](README.zh-Hans.md) · [hi](README.hi.md) · [es](README.es.md) · [fr](README.fr.md) · [bn](README.bn.md) · [pt](README.pt.md) · [ru](README.ru.md) · [id](README.id.md) · [de](README.de.md) · [ja](README.ja.md) · [tr](README.tr.md) · [vi](README.vi.md) · [ko](README.ko.md) · [it](README.it.md) · **pl** · [uk](README.uk.md) · [uz](README.uz.md) · [az](README.az.md) · [kk](README.kk.md) · [be](README.be.md)

Edytor działający w przeglądarce, który pozwala zamienić zdjęcie w obraz low-poly (obraz złożony z trójkątów). Od zwykłych generatorów odróżnia go jedna kluczowa rzecz: oprócz podstawowej, wygenerowanej siatki możesz sam rysować prowadnice, a krawędzie trójkątów będą się wzdłuż nich układać. Dzięki temu ważne kontury - linia podbródka, oprawki okularów, sylwetka - pozostają wyraźne i nie giną w przypadkowej siatce. Gotowy efekt zapiszesz jako wektor (SVG, PDF) lub obraz (PNG, JPG, WebP).

**[OTWÓRZ EDYTOR](https://jango-git.github.io/polygonize/)**

![Zrzut ekranu](../image.png)

## Możliwości

- **Prowadnice, które rysujesz sam.** Prowadzisz linie, okręgi i płynne krzywe na obrazie - a trójkąty układają się wzdłuż nich. To osobne modyfikatory nałożone na obraz, więc w każdej chwili możesz je przesuwać, zmieniać parametry szczegółowości czy grupować.
- **Siatka dopasowuje się do szczegółów.** Tam, gdzie jest dużo drobiazgów i ostrych granic, trójkąty są mniejsze; na gładkich obszarach takich jak niebo czy tło - większe. Obraz wychodzi szczegółowy tam, gdzie trzeba, i spokojny w pozostałych miejscach. Przy tym wynik jest przewidywalnie powtarzalny: z tymi samymi ustawieniami siatka wyjdzie dokładnie taka sama.
- **Automatyczny obrys na start.** Żeby nie zaczynać od pustej kartki, naciśnij "Obrysuj obraz" - edytor sam znajdzie krawędzie obrazu i zamieni je w edytowalne modyfikatory, zebrane w osobnej grupie.
- **Kolor trójkątów.** Każdy trójkąt zostaje wypełniony średnim kolorem pikseli pod nim - albo medianowym, jeśli chcesz wytłumić jaskrawe odchyłki.
- **Eksport.** Wektor (SVG, PDF) lub raster (PNG, JPG, WebP) aż do 4096 pikseli.
- **Projekty.** Zapisuj pracę do pliku `.json` i wracaj do niej później. Ale i bieżąca sesja przywraca się sama, nawet jeśli po prostu zamkniesz kartę.
- **Interfejs w 21 językach.** Język jest wykrywany na podstawie przeglądarki i przełączany w górnym pasku.

## Skróty klawiszowe

| Klawisz | Działanie                                       |
| ------- | ----------------------------------------------- |
| `~`     | Kursor (zaznaczanie)                            |
| `1`     | Narzędzie "Łamana"                              |
| `2`     | Narzędzie "Krzywa"                              |
| `3`     | Okrąg (środek i promień)                        |
| `4`     | Okrąg (3 punkty)                                |
| `Q`     | Odwróć krycie tła                               |
| `W`     | Odwróć krycie punktów                           |
| `E`     | Odwróć podświetlenie zdegenerowanych trójkątów  |
| `F`     | Wyśrodkuj obraz                                 |
| `Space` | Zakończ otwartą ścieżkę                         |
| `Esc`   | Anuluj rysowanie / usuń zaznaczenie             |

## Pod maską

Dla ciekawskich: punkty są rozmieszczane metodą próbkowania dysku Poissona (algorytm Bridsona) ze zmiennym promieniem - wyznacza go mapa krawędzi Sobela, dlatego wzdłuż konturów siatka jest gęstsza. Generowanie jest deterministyczne: ten sam seed daje tę samą siatkę.
Cały kosztowny obliczeniowo potok geometrii - mapa krawędzi, rozmieszczenie punktów i sama triangulacja - jest zebrany w module WASM napisanym w Rust. Kolor trójkątów liczony jest osobno, w Web Workerze.

## Rozwój

```sh
npm install
npm run dev    # serwer deweloperski pod http://localhost:3000
npm run build  # tworzy dist/bundle.js
```

## Licencja

[MIT](../LICENSE)
