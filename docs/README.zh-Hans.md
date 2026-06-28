# Polygonize

[en](../README.md) · **zh-Hans** · [hi](README.hi.md) · [es](README.es.md) · [fr](README.fr.md) · [bn](README.bn.md) · [pt](README.pt.md) · [ru](README.ru.md) · [id](README.id.md) · [de](README.de.md) · [ja](README.ja.md) · [tr](README.tr.md) · [vi](README.vi.md) · [ko](README.ko.md) · [it](README.it.md) · [pl](README.pl.md) · [uk](README.uk.md) · [uz](README.uz.md) · [az](README.az.md) · [kk](README.kk.md) · [be](README.be.md)

一款在浏览器中运行的低多边形图像编辑器。载入照片，调整三角剖分，用形状修改器细化边缘，再导出为 SVG 或 PNG。

**[编辑器](https://jango-git.github.io/polygonize/)**

![截图](../image.png)

## 功能特性

- **智能撒点** - 采用 Bridson Poisson 圆盘采样，半径由 Sobel 边缘检测驱动而可变：边缘处使用更小的最小半径（三角形密集），平坦区域使用更大的最大半径（三角形稀疏）。整个生成过程完全基于随机种子，因此相同的种子会重现完全相同的网格
- **修改器堆栈** - 折线、圆形和 Catmull-Rom 曲线图层以非破坏性方式在基础网格之上叠加约束边；可通过拖放自由重新排序或分组
- **颜色采样** - 按每个三角形取平均色或中值色；可选每顶点渐变
- **导出** - 矢量 SVG 或 PDF，或栅格化的 PNG、JPG、WebP，最高可达 4096px
- **工程文件** - 将工作保存并恢复为 `.json`；会话自动保存到 localStorage
- **本地化界面** - 21 种界面语言，可从浏览器自动检测，并可在顶部栏切换

## 快捷键

| 按键    | 操作                          |
| ------- | ----------------------------- |
| `~`     | 光标（选择）                  |
| `1`     | 折线工具                      |
| `2`     | Catmull-Rom 曲线工具          |
| `3`     | 圆形工具（圆心和半径）        |
| `4`     | 圆形工具（3 点）              |
| `Q`     | 切换背景不透明度              |
| `W`     | 切换顶点不透明度              |
| `E`     | 切换尖刺叠加层                |
| `F`     | 图像适应视图                  |
| `Space` | 应用开放路径                  |
| `Esc`   | 取消绘制／取消选择            |

## 开发

```sh
npm install
npm run dev    # 开发服务器运行于 http://localhost:3000
npm run build  # 输出 dist/bundle.js
```

## 许可证

[MIT](../LICENSE)
