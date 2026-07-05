# <img src="../logo.svg" alt="" height="28" align="absmiddle"> Tesselot

[en](../README.md) · [zh-Hans](README.zh-Hans.md) · [hi](README.hi.md) · [es](README.es.md) · [fr](README.fr.md) · [bn](README.bn.md) · **pt** · [ru](README.ru.md) · [id](README.id.md) · [de](README.de.md) · [ja](README.ja.md) · [tr](README.tr.md) · [vi](README.vi.md) · [ko](README.ko.md) · [it](README.it.md) · [pl](README.pl.md) · [uk](README.uk.md) · [uz](README.uz.md) · [az](README.az.md) · [kk](README.kk.md) · [be](README.be.md)

Um editor no navegador que transforma uma foto em uma imagem low-poly, montada a partir de triângulos. A principal diferença em relação aos geradores comuns: sobre a malha gerada, você mesmo desenha guias, e as arestas dos triângulos seguem essas linhas. Contornos importantes - a linha do queixo, a armação dos óculos, uma silhueta - permanecem nítidos, em vez de se perderem em uma malha aleatória.

**[ABRIR EDITOR](https://jango-git.github.io/tesselot/)**

![Captura de tela](../image.png)

## O que ele faz

- **Guias.** Desenhe linhas, círculos e curvas suaves sobre a imagem - os triângulos se alinham ao longo delas. Isso não é uma operação única, mas modificadores: a qualquer momento você pode movê-los, ajustar o nível de detalhe e agrupá-los.
- **Uma malha que se adapta aos detalhes.** Onde há muitos detalhes e bordas nítidas, os triângulos ficam menores; em áreas uniformes, como o céu, ficam maiores. A imagem fica detalhada onde é preciso e tranquila no restante.
- **Contorno automático.** Para não começar do zero, clique em "Contornar": o editor encontra as bordas da imagem e as transforma em modificadores editáveis, reunidos em um grupo separado.
- **Cor dos triângulos.** Cada triângulo é preenchido com a cor média dos pixels sob ele - ou a cor mediana, caso você queira atenuar picos de brilho.
- **Exportação.** Vetor (SVG, PDF) ou raster (PNG, JPG, WebP) de até 4096 pixels.
- **Projetos.** Salve seu trabalho em um arquivo `.json` e volte a ele mais tarde. A sessão atual também é restaurada automaticamente, mesmo que você apenas tenha fechado a aba.
- **Interface em 21 idiomas.** O idioma é detectado pelo navegador e pode ser alterado na barra superior.

## Por baixo do capô

Os pontos são distribuídos por amostragem de disco de Poisson (algoritmo de Bridson) com raio variável, definido por um mapa de bordas de Sobel, de modo que a malha fica mais densa ao longo dos contornos. A geração é determinística: a mesma semente sempre produz a mesma malha. Todo o pipeline geométrico pesado - mapa de bordas, distribuição de pontos, triangulação - está reunido em um módulo WASM escrito em Rust; a cor dos triângulos é calculada separadamente, em um Web Worker.

Se você pretende ler o código-fonte, comece pela [visão geral da arquitetura](onboarding.pt.md).

## Desenvolvimento

```sh
npm install
npm run dev    # servidor de desenvolvimento em http://localhost:3000
npm run build  # gera dist/bundle.js
```

## Licença

[MIT](../LICENSE)
