# <img src="../logo.svg" alt="" height="28" align="absmiddle"> Polygonize

[en](../README.md) · [zh-Hans](README.zh-Hans.md) · [hi](README.hi.md) · [es](README.es.md) · [fr](README.fr.md) · [bn](README.bn.md) · **pt** · [ru](README.ru.md) · [id](README.id.md) · [de](README.de.md) · [ja](README.ja.md) · [tr](README.tr.md) · [vi](README.vi.md) · [ko](README.ko.md) · [it](README.it.md) · [pl](README.pl.md) · [uk](README.uk.md) · [uz](README.uz.md) · [az](README.az.md) · [kk](README.kk.md) · [be](README.be.md)

Um editor no navegador que te deixa transformar uma foto em low-poly (uma imagem montada a partir de triângulos). O que o distingue dos geradores comuns é o essencial: além da malha gerada de base, tu mesmo podes desenhar guias, e as arestas dos triângulos vão segui-las. Por isso os contornos importantes - a linha do queixo, a armação dos óculos, uma silhueta - ficam nítidos em vez de se perderem numa malha aleatória. O resultado final podes guardar em vetor (SVG, PDF) ou em imagem (PNG, JPG, WebP).

**[ABRIR O EDITOR](https://jango-git.github.io/polygonize/)**

![Captura de ecrã](../image.png)

## O que sabe fazer

- **Guias que tu mesmo desenhas.** Traças linhas, círculos, curvas suaves por cima da imagem, e os triângulos alinham-se ao longo delas. São modificadores independentes sobre a imagem, por isso a qualquer momento podes movê-los, mudar os parâmetros de detalhe ou agrupá-los.
- **A malha adapta-se aos detalhes.** Onde há muitos detalhes finos e bordas marcadas, os triângulos são menores; nas zonas uniformes como o céu ou o fundo, maiores. A imagem fica detalhada onde é preciso e calma no resto. E o resultado é reproduzível de forma previsível: com as mesmas definições a malha sai exatamente igual.
- **Traçado automático como ponto de partida.** Para não começares de uma folha em branco, carrega em "Traçar imagem" - o editor encontra sozinho as bordas da imagem e converte-as em modificadores editáveis, reunidos num grupo próprio.
- **Cor dos triângulos.** Cada triângulo é preenchido com a cor média dos pixels por baixo dele, ou com a mediana, se quiseres atenuar os valores extremos demasiado vivos.
- **Exportação.** Vetor (SVG, PDF) ou raster (PNG, JPG, WebP) até 4096 pixels.
- **Projetos.** Guarda o teu trabalho num ficheiro `.json` e volta a ele mais tarde. E, de qualquer forma, a sessão atual restaura-se sozinha, mesmo que apenas tenhas fechado o separador.
- **Interface em 21 idiomas.** O idioma é detetado a partir do navegador e troca-se na barra superior.

## Atalhos de teclado

| Tecla   | Ação                                               |
| ------- | -------------------------------------------------- |
| `~`     | Cursor (seleção)                                   |
| `1`     | Ferramenta "Polilinha"                             |
| `2`     | Ferramenta "Curva"                                 |
| `3`     | Círculo (centro e raio)                            |
| `4`     | Círculo (3 pontos)                                 |
| `Q`     | Inverter a opacidade do fundo                      |
| `W`     | Inverter a opacidade dos pontos                    |
| `E`     | Inverter a opacidade dos triângulos degenerados    |
| `F`     | Centrar a imagem                                   |
| `Space` | Concluir o traçado aberto                          |
| `Esc`   | Cancelar o desenho / desselecionar                 |

## Por baixo do capô

Para os curiosos: os pontos são distribuídos por amostragem em disco de Poisson (algoritmo de Bridson) com raio variável, definido pelo mapa de bordas de Sobel, e por isso a malha fica mais densa ao longo dos contornos. A geração é determinista: o mesmo seed produz sempre a mesma malha.
Todo o pesado pipeline geométrico - o mapa de bordas, a distribuição dos pontos e a própria triangulação - está reunido num módulo WASM escrito em Rust. A cor dos triângulos é calculada à parte, num Web Worker.

## Desenvolvimento

```sh
npm install
npm run dev    # servidor de desenvolvimento em http://localhost:3000
npm run build  # gera dist/bundle.js
```

## Licença

[MIT](../LICENSE)
