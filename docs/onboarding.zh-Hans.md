# Tesselot - 架构

## 前言

Tesselot 是一个浏览器端的 low-poly 图像编辑器：用户在图片上绘制引导图形（**修改器**：直线、曲线、圆），应用程序会用点填充其余空间，进行三角剖分并上色。这能为用户带来什么，README 中已经说明；本文档讲的是代码的构造方式。

在阅读代码之前，最需要理解的一点是：整条流水线是完全非破坏性的。状态被严格划分为 **source**（用户设定的内容 - 图片、设置、图形树）和 **derived**（点、三角剖分、颜色）。只有 source 会被保存并进入历史记录；derived 会在每次修改和每次加载时从 source 重新计算，永远不会被保存。

由这个划分几乎可以推导出其余的整个架构：撤销操作很轻量（快照只包含 source），一切都是确定性的（同一个 source 总会得到同一个 derived），繁重的计算被放到后台执行（derived 计算代价高），数据严格单向流动 - 从 source 到 derived，绝不反向流动。

如果要类比熟悉的概念，这类似于 Redux/Flux 的单向数据流 - 统一的状态、只能通过命令修改、订阅者对事件做出反应 - 再加上一层计算状态，类似 computed/reselect。

## 五个层

| 层 | 目录 | 负责什么 | 了解谁 |
|---|---|---|---|
| **UI** | `src/ui/` | 输入：绘制、面板、工具、快捷键 | 模型（向它发送命令） |
| **模型** | `src/document/` | source + derived、历史记录、事件 | 不了解自己之上的任何层 |
| **领域（Domain）** | `src/domain/` | 纯逻辑：图形如何变成点、到 WASM 的桥接 | 由模型调用 |
| **渲染** | `src/preview/` | 用 three.js 绘制图片和三角形 | 只监听模型 |
| **原生层** | `crates/` | Rust -> WASM：繁重的几何和颜色计算 | 不了解任何层，纯函数 |

此外还有几个辅助目录：`persistence/`（保存和导出）、`settings/`、`i18n/`。

数据流规则：UI 只修改模型，渲染只读取模型，两者之间不直接通信。把它们连接起来的是模型内部的事件总线 - 这正是单向循环的关键所在。

## 数据流

主要场景 - "从一次鼠标笔画到重新着色的三角形"：

```
   用户            (1) UI 捕获输入
       |
       v
   (2) 命令修改 SOURCE：添加或移动了一个图形
       |
       v
   (3) 重新计算：source -> 点 -> 三角形      [繁重，在后台 worker 中执行]
       |
       v
   (4) 模型把结果写入扁平缓冲区，并发出"完成"事件
       |
       v
   (5) 渲染层监听事件并更新屏幕上的画面
       |
       +--> (6) 与此同时并行计算三角形颜色 -> 再发出一个事件 -> 重新着色
```

使这个循环保持响应迅速的有三个手段：

- **每帧只计算一次。** 拖拽时鼠标事件每秒会产生几十个，但重新计算每帧最多只触发一次 - 中间的位置会被丢弃。
- **渲染永不等待。** 当后台在计算精确颜色时，三角形会先用近似颜色立即显示；计算好的颜色会作为单独的事件到达并覆盖上去。
- **没有多余的分配。** 三角形不是以对象形式存在，而是长长的扁平数字数组；渲染和导出都直接读取这些数组。

## 任务索引

| 我想修改... | 我该去看... |
|---|---|
| 绘图工具的行为 | `src/ui/tools/` |
| 右侧面板（图形树、分组） | `src/ui/panel/` |
| 图形如何变成点 | `src/domain/modifiers/` |
| 点的播种算法 / 三角剖分 | `crates/pipeline/` |
| 三角形颜色的计算方式 | `crates/color/` |
| 绘制、相机、叠加层 | `src/preview/` |
| 保存格式 / 撤销 | `src/document/` |
| 保存到磁盘 / 导出 SVG、PDF、PNG | `src/persistence/` |

## 各层细节

### 模型（`src/document/`）

状态是一个单一对象 `DocumentData`（`types.ts`），严格按照这条边界划分：

- **Source**（会被保存，进入历史记录）：`image`、`seed`、`seedSettings`、`colorSettings`、`stack`（图形树）。
- **Derived**（重新计算，不会被保存）：`points` 以及渲染用的扁平缓冲区 - `renderPositions`（每个顶点的 xyz）、`renderColors`（每个三角形的 rgb）、`triangleCount`。

修改是如何流经模型的：

- `store.ts` - 单一可变的状态对象（`store.data()`）。
- `commands/` - 修改它的唯一方式，相当于 reducer。命令直接修改 source，并调用提交：`commit.ts` 决定是否需要重新计算（`commitStructural`，用于几何相关的修改）还是只需记录一条历史步骤（`commitViewOnly`，例如折叠一个文件夹）。
- `commands/pipeline.ts` - 重新计算（`evaluatePoints`）。遵循"同一时刻只有一个请求在途"的原则：无论有多少次修改到来，同一时间只有一个计算会发往 worker，但最后一次修改总会被完整处理完。
- `commands/recompute.ts` - 把结果展开进扁平缓冲区（`buildGeometry`），并应用计算好的颜色（`applyColorGrid`）。
- `signals.ts` - 事件总线（基于 `ferrsign`）。模型本身不渲染任何东西；它只是通知"点变了"、"三角形变了"、"数据源被整体替换"，订阅者 - 渲染层、面板、历史记录 - 各自做出反应。
- `history.ts` - 撤销/重做。快照只包含 source，甚至不含图片，因此非常轻量；整个拖拽手势会被折叠成一步。
- `selectors/` - 对外读取模型的入口。返回的是克隆，防止有人绕过命令破坏状态；例外是扁平缓冲区，为了速度会按引用返回。

图形树（`stack`）是单层结构，类似 Blender 中的集合：一个元素要么是独立图形，要么是带子元素的分组。分组可以"折叠"（仅影响显示）和"静音"（从计算中排除）。栈中的顺序是有意义的。对树的结构性操作在 `commands/stackTree.ts`、`modifierCommands.ts`、`groupCommands.ts` 中。

### 领域（`src/domain/`）

不涉及 DOM 和 three.js 的逻辑；唯一的例外是 `imageSource.ts`，它从 `<canvas>` 读取像素。分两个子主题：

- `modifiers/` - 每个图形如何变成点和约束边（`ModifierResult`）：`path.ts`（折线或 Catmull-Rom 样条）、`bezier.ts`（带对称控制柄的贝塞尔曲线）、`circle.ts`。公共的组装器是 `result.ts`。
- 到原生层的桥接：每个 WASM crate 都有一套"facade + worker + client"三件套。繁重的计算放在 Web Worker 中执行，数据以可转移（transferable）数组的形式跨越边界，不需要拷贝。

细节部分：`rng.ts`（确定性伪随机数生成器）、`colorGrid.ts`（颜色的空间查找）、`groupColor.ts`（分组的颜色由其名称推导 - 重命名了，也就等于重新着色了）。

### 渲染（`src/preview/`）

严格单向地监听模型的事件，没有反向引用回模型。世界坐标与图片坐标一致（Y 轴向下），相机是正交相机。

- `preview.ts` - 协调器：一个场景、一个渲染器、一组图层。
- 图层各自拥有自己的 three.js 对象：`triangleLayer.ts`（三角形；复用缓冲区而不是每帧重建）、`imageLayer.ts`（原始图片）、`pointLayer.ts`（种子点）、`overlayLayer.ts`（编辑时的叠加层：选中状态、控制柄、草稿）。
- `receiving.ts` - "模型事件 -> 图层调用"之间的桥接。这里也做了优化：收到"已重新着色"事件时只更新颜色，收到"已重建"事件时则同时更新位置和颜色。
- `viewport.ts` - 相机以及屏幕坐标与图片坐标之间的换算（缩放、平移）。

### UI（`src/ui/`）

命令式的 DOM/canvas 操作，不依赖框架；面板会在事件触发时重建自己的 DOM。UI 状态从不直接被修改 - 只能通过命令。

- `tools.ts`（`ToolController`）- 一个在"选择 / 绘制 / 拖拽"模式之间切换的状态机；负责捕获画布上的输入。
- `tools/` - 各工具的具体实现：待绘制图形的草稿（`*Draft.ts`）以及 `dragSession.ts` - 拖拽点；"每帧只计算一次"和"把整个手势折叠成一步撤销"的逻辑都在这里。
- `panel/` - 右侧面板：带分组和拖放（drag-and-drop）的图形树（`stackView.ts`、`dnd.ts`）。
- 其余部分：工具调色板、选中与高亮、快捷键、提示条。

### 原生层（`crates/`）

两个相互独立的 crate；每个都会在自身内部缓存已加载的图片，避免每次调用都重新传输。

- `crates/pipeline/` - 几何：`sobel.rs`（按图片边缘计算的密度图：突变越剧烈的地方点越密）、`seeding.rs`（用 Bridson 方法、可变半径布置点）、`triangulate.rs`（带约束的 Delaunay 三角剖分，使用 `spade` crate）、`contours.rs`（把图片的轮廓描摹成可编辑图形，基于 Canny 算法）。
- `crates/color/` - 颜色：对每个三角形下方的颜色进行采样（平均值或中位数），并构建用于快速查找的空间网格。运行在颜色 worker 中。

对确定性至关重要的部分 - 伪随机数生成器、播种、采样 - 特意与旧的 TS 实现逐位保持一致：同一个 seed 在任何一次运行中都会得到完全相同的图像。

## 构建

- `npm run build:wasm` - 对每个 crate 依次执行：cargo -> wasm-bindgen（`--target web`）-> wasm-opt（`-Oz`）。生成的胶水代码放在 `src/generated/`（已加入 gitignore），`.wasm` 文件被复制到 `dist/`，在运行时加载。
- `npm run build` = `build:wasm`，然后 `rollup -c`。`npm run dev` 会加上 watch（`-w`）。
- 部署是静态的（GitHub Pages），没有后端。

## 小结

应用只保存 source：用户通过 UI 修改它，模型把它送入后台的 Rust/WASM 流水线，转化为扁平缓冲区，渲染层只是反映这些缓冲区的内容。其余的一切，都是这一个划分带来的结果。
</content>
