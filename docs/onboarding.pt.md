# Tesselot - arquitetura

## Prefácio

Tesselot é um editor de imagens low-poly no navegador: o usuário desenha guias sobre a imagem (**modificadores**: linhas, curvas, círculos), e o aplicativo semeia pontos no restante do espaço, triangula e colore. O que isso oferece ao usuário está no README; este documento trata da estrutura do código.

O principal a entender antes de ler o código: o pipeline é totalmente não destrutivo. O estado é rigidamente dividido em **source** - o que o usuário definiu (imagem, configurações, árvore de figuras) - e **derived** - pontos, triangulação, cores. Apenas o source é armazenado e entra no histórico; o derived é recalculado a partir dele a cada alteração e a cada carregamento, e nunca é salvo.

Dessa divisão decorre quase toda a demais arquitetura: o undo é barato (o snapshot é só o source), tudo é determinístico (um mesmo source sempre produz o mesmo derived), os cálculos pesados são delegados a segundo plano (o derived é caro de calcular), e os dados fluem estritamente em uma direção - do source para o derived, nunca ao contrário.

Para quem já conhece, isso lembra o fluxo de dados unidirecional do Redux/Flux - estado único, alterações apenas via comandos, assinantes reagindo a eventos - somado a uma camada de estado computado por cima, como computed/reselect.

## Cinco camadas

| Camada | Pasta | Responsabilidade | Conhece |
|---|---|---|---|
| **UI** | `src/ui/` | entrada: desenho, painel, ferramentas, atalhos | o modelo (envia comandos) |
| **Modelo** | `src/document/` | source + derived, histórico, eventos | nada acima de si mesmo |
| **Domínio** | `src/domain/` | lógica pura: como uma figura vira pontos, pontes para o WASM | o modelo o chama |
| **Renderização** | `src/preview/` | desenha a imagem e os triângulos com three.js | apenas escuta o modelo |
| **Nativo** | `crates/` | Rust->WASM: geometria pesada e cor | nada, funções puras |

Há ainda algumas pastas auxiliares: `persistence/` (salvamento e exportação), `settings/`, `i18n/`.

Regra de fluxo: a UI só altera o modelo, a renderização só lê o modelo, e eles não se comunicam diretamente entre si. Quem os conecta é o barramento de eventos dentro do modelo - é isso que forma o ciclo unidirecional.

## Fluxo de dados

O cenário principal - "do traço do mouse aos triângulos recoloridos":

```
   usuário             (1) a UI captura a entrada
       |
       v
   (2) um comando altera o SOURCE: adicionou/moveu uma figura
       |
       v
   (3) recálculo: source -> pontos -> triângulos       [pesado, em worker de segundo plano]
       |
       v
   (4) o modelo grava o resultado em buffers planos e dispara o evento "pronto"
       |
       v
   (5) a renderização escuta o evento e atualiza a imagem na tela
       |
       +--> (6) em paralelo, a cor dos triângulos é calculada -> outro evento -> recoloração
```

Três técnicas tornam esse ciclo responsivo:

- **Um recálculo por quadro.** Ao arrastar, os eventos de mouse chegam às dezenas por segundo, mas o recálculo não é disparado mais de uma vez por quadro - posições intermediárias são descartadas.
- **A renderização nunca espera.** Enquanto a cor exata é calculada em segundo plano, os triângulos já aparecem com uma cor aproximada; a cor definitiva chega em um evento separado e é aplicada por cima.
- **Nenhuma alocação desnecessária.** Os triângulos não existem como objetos, mas como longos arrays planos de números; tanto a renderização quanto a exportação leem esses arrays diretamente.

## Mapa de tarefas

| Quero alterar... | Vou olhar em... |
|---|---|
| o comportamento das ferramentas de desenho | `src/ui/tools/` |
| o painel direito (árvore de figuras, grupos) | `src/ui/panel/` |
| como uma figura vira pontos | `src/domain/modifiers/` |
| o algoritmo de semeadura de pontos / triangulação | `crates/pipeline/` |
| como a cor de um triângulo é calculada | `crates/color/` |
| a renderização, a câmera, as sobreposições | `src/preview/` |
| o formato de salvamento / undo | `src/document/` |
| salvamento em disco / exportação SVG, PDF, PNG | `src/persistence/` |

## Detalhes por camada

### Modelo (`src/document/`)

O estado é um único objeto `DocumentData` (`types.ts`), dividido exatamente por essa fronteira:

- **Source** (é salvo, está no histórico): `image`, `seed`, `seedSettings`, `colorSettings`, `stack` (árvore de figuras).
- **Derived** (recalculado, não é salvo): `points` e os buffers planos de renderização - `renderPositions` (xyz por vértice), `renderColors` (rgb por triângulo), `triangleCount`.

Como uma alteração passa pelo modelo:

- `store.ts` - o único objeto de estado mutável (`store.data()`).
- `commands/` - a única forma de alterá-lo, equivalente a reducers. Um comando ajusta o source no local e chama o commit: `commit.ts` decide se é necessário um recálculo (`commitStructural` para edições de geometria) ou se basta gravar um passo no histórico (`commitViewOnly`, por exemplo recolher uma pasta).
- `commands/pipeline.ts` - o recálculo (`evaluatePoints`). Funciona segundo o princípio "uma requisição em voo": não importa quantas edições cheguem, apenas um cálculo é enviado ao worker por vez, mas o último é sempre levado até o fim.
- `commands/recompute.ts` - distribuição do resultado nos buffers planos (`buildGeometry`) e aplicação da cor calculada (`applyColorGrid`).
- `signals.ts` - o barramento de eventos (baseado em `ferrsign`). O modelo não renderiza nada; ele apenas informa "os pontos mudaram", "os triângulos mudaram", "o source foi totalmente substituído", e os assinantes - a renderização, o painel, o histórico - reagem.
- `history.ts` - undo/redo. O snapshot é apenas o source, sem sequer a imagem, por isso é barato; um gesto inteiro de arrastar é condensado em um único passo.
- `selectors/` - leitura do modelo para fora. Retorna clones, para que ninguém corrompa o estado sem passar pelos comandos; a exceção são os buffers planos, retornados por referência por questão de desempenho.

A árvore de figuras (`stack`) é de nível único, como as coleções no Blender: um elemento é ou uma figura livre, ou um grupo com filhos. Um grupo pode ser "recolhido" (apenas visual) e "silenciado" (excluído do cálculo). A ordem na pilha é significativa. As operações estruturais sobre a árvore ficam em `commands/stackTree.ts`, `modifierCommands.ts`, `groupCommands.ts`.

### Domínio (`src/domain/`)

Lógica sem DOM e sem three.js; a única exceção é `imageSource.ts`, que lê pixels de um `<canvas>`. Dois subtemas:

- `modifiers/` - como cada figura vira pontos e arestas de restrição (`ModifierResult`): `path.ts` (linha poligonal ou spline de Catmull-Rom), `bezier.ts` (curva de Bézier com alças simétricas), `circle.ts`. O montador comum é `result.ts`.
- Pontes para a camada nativa: para cada crate WASM há um trio "fachada + worker + cliente". Os cálculos pesados vão para Web Workers, os dados cruzam a fronteira como arrays transferíveis, sem cópia.

Detalhes menores: `rng.ts` (gerador pseudoaleatório determinístico), `colorGrid.ts` (busca espacial de cor), `groupColor.ts` (a cor do grupo é derivada de seu nome - renomeou, então recolore).

### Renderização (`src/preview/`)

Escuta os eventos do modelo estritamente em uma direção, sem referência de volta ao modelo. As coordenadas do mundo coincidem com as coordenadas da imagem (Y para baixo), a câmera é ortográfica.

- `preview.ts` - o coordenador: uma cena, um renderizador, um conjunto de camadas.
- As camadas possuem seus próprios objetos three.js: `triangleLayer.ts` (triângulos; reutiliza os buffers em vez de recriá-los a cada quadro), `imageLayer.ts` (a imagem original), `pointLayer.ts` (pontos de semeadura), `overlayLayer.ts` (sobreposições de edição: seleção, alças, rascunho).
- `receiving.ts` - a ponte "eventos do modelo -> chamadas às camadas". É aqui que está a otimização: no evento "recolorido" apenas as cores são atualizadas, no evento "reconstruído" tanto as posições quanto as cores.
- `viewport.ts` - a câmera e a conversão de coordenadas tela<->imagem (zoom, panorâmica).

### UI (`src/ui/`)

DOM/canvas imperativo, sem framework; os painéis reconstroem seu próprio DOM a cada evento. O estado da UI nunca é alterado diretamente - apenas via comandos.

- `tools.ts` (`ToolController`) - uma máquina de estados com os modos "seleção / desenho / arrastar"; captura a entrada na tela.
- `tools/` - implementação das ferramentas: rascunhos das figuras sendo desenhadas (`*Draft.ts`) e `dragSession.ts` - arrastar um ponto; é aqui que vivem o "um recálculo por quadro" e a condensação de um gesto em um único passo de undo.
- `panel/` - o painel direito: a árvore de figuras com grupos e drag-and-drop (`stackView.ts`, `dnd.ts`).
- O restante - paleta de ferramentas, seleção e destaque, atalhos, notificações.

### Camada nativa (`crates/`)

Dois crates independentes; cada um armazena em cache a imagem carregada em seu próprio estado, para não reenviá-la a cada chamada.

- `crates/pipeline/` - geometria: `sobel.rs` (mapa de densidade a partir das bordas da imagem: onde há uma variação brusca, os pontos ficam mais densos), `seeding.rs` (distribuição de pontos pelo método de Bridson com raio variável), `triangulate.rs` (triangulação de Delaunay com restrições, crate `spade`), `contours.rs` (rastreamento dos contornos da imagem para figuras editáveis, Canny).
- `crates/color/` - cor: amostra a cor sob cada triângulo (média ou mediana) e constrói uma grade espacial para busca rápida. Roda no worker de cor.

As partes críticas para o determinismo - o gerador pseudoaleatório, a semeadura, a amostragem - coincidem propositalmente, bit a bit, com a antiga implementação em TS: uma mesma seed produz sempre a mesma imagem, em qualquer execução.

## Build

- `npm run build:wasm` - para cada crate: cargo -> wasm-bindgen (`--target web`) -> wasm-opt (`-Oz`). O código de ligação vai para `src/generated/` (no gitignore), o `.wasm` é copiado para `dist/` e carregado em tempo de execução.
- `npm run build` = `build:wasm`, seguido de `rollup -c`. `npm run dev` adiciona watch (`-w`).
- O deploy é estático (GitHub Pages), sem backend.

## Resumo

O aplicativo armazena apenas o source: o usuário o edita pela UI, o modelo o conduz por um pipeline Rust/WASM em segundo plano até buffers planos, e a renderização apenas reflete esses buffers. Todo o resto é consequência dessa única divisão.
