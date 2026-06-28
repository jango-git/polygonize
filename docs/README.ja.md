# Polygonize

[en](../README.md) · [zh-Hans](README.zh-Hans.md) · [hi](README.hi.md) · [es](README.es.md) · [fr](README.fr.md) · [bn](README.bn.md) · [pt](README.pt.md) · [ru](README.ru.md) · [id](README.id.md) · [de](README.de.md) · **ja** · [tr](README.tr.md) · [vi](README.vi.md) · [ko](README.ko.md) · [it](README.it.md) · [pl](README.pl.md) · [uk](README.uk.md) · [uz](README.uz.md) · [az](README.az.md) · [kk](README.kk.md) · [be](README.be.md)

ブラウザで動作するローポリ画像エディターです。写真を読み込み、三角形分割を調整し、シェイプモディファイアでエッジを整え、SVG や PNG として書き出せます。

**[エディター](https://jango-git.github.io/polygonize/)**

![スクリーンショット](../image.png)

## 機能

- **スマートな点の配置** - Sobel エッジ検出に基づく可変半径で行う Bridson の Poisson ディスクサンプリング。エッジには小さな最小半径（密な三角形）、平坦な領域には大きな最大半径（疎な三角形）が割り当てられます。生成は完全にシード化されているため、同じシードからは常に同じメッシュが再現されます
- **モディファイアスタック** - 非破壊のポリライン、円、Catmull-Rom 曲線のレイヤーが、ベースメッシュの上に制約エッジを追加します。ドラッグ&ドロップで自由に並べ替えたりグループ化したりできます
- **色のサンプリング** - 三角形ごとにピクセル色の平均または中央値を取得。任意で頂点ごとのグラデーションも可能
- **エクスポート** - ベクター形式の SVG や PDF、またはラスター形式の PNG、JPG、WebP を最大 4096px まで
- **プロジェクト** - 作業内容を `.json` として保存・復元。セッションは localStorage に自動保存されます
- **多言語対応 UI** - 21 のインターフェース言語に対応し、ブラウザから自動検出され、上部バーで切り替えられます

## キーボードショートカット

| キー    | 操作                           |
| ------- | ------------------------------ |
| `~`     | カーソル（選択）               |
| `1`     | ポリラインツール               |
| `2`     | Catmull-Rom 曲線ツール         |
| `3`     | 円ツール（中心と半径）         |
| `4`     | 円ツール（3 点）               |
| `Q`     | 背景の不透明度を切り替え       |
| `W`     | 点の不透明度を切り替え         |
| `E`     | スパイクオーバーレイを切り替え |
| `F`     | 画像をビューに合わせる         |
| `Space` | 開いたパスを適用               |
| `Esc`   | 描画をキャンセル／選択を解除   |

## 開発

```sh
npm install
npm run dev    # http://localhost:3000 で開発サーバーを起動
npm run build  # dist/bundle.js を出力
```

## ライセンス

[MIT](../LICENSE)
