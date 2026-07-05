# <img src="../logo.svg" alt="" height="28" align="absmiddle"> Tesselot

[en](../README.md) · **zh-Hans** · [hi](README.hi.md) · [es](README.es.md) · [fr](README.fr.md) · [bn](README.bn.md) · [pt](README.pt.md) · [ru](README.ru.md) · [id](README.id.md) · [de](README.de.md) · [ja](README.ja.md) · [tr](README.tr.md) · [vi](README.vi.md) · [ko](README.ko.md) · [it](README.it.md) · [pl](README.pl.md) · [uk](README.uk.md) · [uz](README.uz.md) · [az](README.az.md) · [kk](README.kk.md) · [be](README.be.md)

一个运行在浏览器中的编辑器，可以把照片变成由三角形拼接而成的低多边形（low-poly）图像。它与普通生成器的根本区别在于：在自动生成的网格之上，你可以自己绘制辅助线，三角形的边会沿着这些辅助线排列。重要的轮廓 - 下巴的线条、眼镜框、剪影 - 会保持清晰，而不会淹没在随机网格里。

**[打开编辑器](https://jango-git.github.io/tesselot/)**

![截图](../image.png)

## 功能

- **辅助线。** 在图像上绘制直线、圆和平滑曲线 - 三角形会沿着它们排列。这不是一次性操作，而是修改器：随时可以移动它们、调整细节，或者将它们编成组。
- **随细节自适应的网格。** 在细节多、边缘锐利的地方，三角形更小；在天空这类平坦区域，三角形更大。图像在需要的地方细腻，在其他地方则显得平静。
- **自动描边。** 为了不用从空白开始，点击"描边"：编辑器会找到图像的边缘，并把它们转换成可编辑的修改器，归入单独的一组。
- **三角形颜色。** 每个三角形都用其下方像素的平均颜色填充 - 如果想抑制过亮的异常值，也可以用中位数颜色。
- **导出。** 矢量格式（SVG、PDF）或位图格式（PNG、JPG、WebP），分辨率最高可达 4096 像素。
- **项目。** 将工作保存为 `.json` 文件，之后再回来继续。即使只是关闭了标签页，当前会话也会自动恢复。
- **21 种语言的界面。** 语言根据浏览器自动识别，也可以在顶部栏切换。

## 底层原理

点的排布采用泊松圆盘采样（Bridson 算法），半径可变 - 由 Sobel 边缘图决定，因此沿轮廓的网格更密。生成过程是确定性的：相同的种子总会得到相同的网格。整个繁重的几何处理流水线 - 边缘图、点的排布、三角剖分 - 都封装在一个用 Rust 编写的 WASM 模块中；三角形的颜色则在 Web Worker 中单独计算。

如果你打算阅读源码，可以从[架构概览](onboarding.zh-Hans.md)开始。

## 开发

```sh
npm install
npm run dev    # 开发服务器，地址为 http://localhost:3000
npm run build  # 生成 dist/bundle.js
```

## 许可证

[MIT](../LICENSE)
</content>
