# Polygonize

[en](../README.md) · [zh-Hans](README.zh-Hans.md) · [hi](README.hi.md) · [es](README.es.md) · [fr](README.fr.md) · [bn](README.bn.md) · [pt](README.pt.md) · [ru](README.ru.md) · [id](README.id.md) · [de](README.de.md) · [ja](README.ja.md) · [tr](README.tr.md) · [vi](README.vi.md) · [ko](README.ko.md) · [it](README.it.md) · **pl** · [uk](README.uk.md) · [uz](README.uz.md) · [az](README.az.md) · [kk](README.kk.md) · [be](README.be.md)

Niskopoligonowy edytor obrazów działający w przeglądarce. Wczytaj zdjęcie, dostrój triangulację, dopracuj krawędzie za pomocą modyfikatorów kształtu i wyeksportuj jako SVG lub PNG.

**[EDYTOR](https://jango-git.github.io/polygonize/)**

![Zrzut ekranu](../image.png)

## Funkcje

- **Inteligentne rozmieszczanie punktów** - próbkowanie metodą dysku Poissona Bridsona ze zmiennym promieniem sterowanym detekcją krawędzi Sobel: krawędzie otrzymują ciasny minimalny promień (gęste trójkąty), a płaskie obszary luźny maksymalny promień (rzadkie trójkąty). Generowanie jest w pełni oparte na ziarnie, więc dane ziarno odtwarza tę samą siatkę
- **Stos modyfikatorów** - nieniszczące warstwy linii łamanych, okręgów i krzywych Catmull-Rom dodają krawędzie ograniczające na bazowej siatce; dowolnie zmieniaj ich kolejność lub grupuj metodą przeciągnij i upuść
- **Próbkowanie koloru** - średni lub medianowy kolor pikseli na trójkąt; opcjonalny gradient na wierzchołek
- **Eksport** - wektorowy SVG lub PDF albo rasterowy PNG, JPG lub WebP do 4096px
- **Projekty** - zapisuj i przywracaj pracę jako `.json`; sesja jest automatycznie zapisywana w localStorage
- **Zlokalizowany interfejs** - 21 języków interfejsu, wykrywanych automatycznie z przeglądarki i przełączanych w górnym pasku

## Skróty klawiszowe

| Klawisz | Akcja                          |
| ------- | ------------------------------ |
| `~`     | Kursor (zaznaczanie)           |
| `1`     | Narzędzie linii łamanej        |
| `2`     | Narzędzie krzywej Catmull-Rom  |
| `3`     | Narzędzie okręgu (środek i promień) |
| `4`     | Narzędzie okręgu (3 punkty)    |
| `Q`     | Przełącz przezroczystość tła   |
| `W`     | Przełącz przezroczystość punktów |
| `E`     | Przełącz nakładkę kolców       |
| `F`     | Dopasuj obraz do widoku        |
| `Space` | Zastosuj otwartą ścieżkę       |
| `Esc`   | Anuluj rysowanie / odznacz     |

## Rozwój

```sh
npm install
npm run dev    # serwer deweloperski na http://localhost:3000
npm run build  # generuje dist/bundle.js
```

## Licencja

[MIT](../LICENSE)
