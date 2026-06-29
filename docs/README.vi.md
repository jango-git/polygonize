# <img src="../logo.svg" alt="" height="28" align="absmiddle"> Polygonize

[en](../README.md) · [zh-Hans](README.zh-Hans.md) · [hi](README.hi.md) · [es](README.es.md) · [fr](README.fr.md) · [bn](README.bn.md) · [pt](README.pt.md) · [ru](README.ru.md) · [id](README.id.md) · [de](README.de.md) · [ja](README.ja.md) · [tr](README.tr.md) · **vi** · [ko](README.ko.md) · [it](README.it.md) · [pl](README.pl.md) · [uk](README.uk.md) · [uz](README.uz.md) · [az](README.az.md) · [kk](README.kk.md) · [be](README.be.md)

Một trình chỉnh sửa chạy ngay trên trình duyệt, biến một bức ảnh thành tranh low-poly (hình ghép từ các tam giác). Điều khiến nó khác với những trình tạo thông thường nằm ở một điểm cốt lõi: ngoài lưới được tạo sẵn ở mức cơ bản, bạn còn có thể tự tay vẽ các đường dẫn hướng, và các cạnh tam giác sẽ chạy theo chúng. Nhờ vậy những đường nét quan trọng - đường cằm, gọng kính, dáng hình bóng - vẫn sắc nét, không bị lạc mất trong một lưới ngẫu nhiên. Kết quả hoàn chỉnh bạn có thể lưu thành vector (SVG, PDF) hoặc ảnh (PNG, JPG, WebP).

**[MỞ TRÌNH CHỈNH SỬA](https://jango-git.github.io/polygonize/)**

![Ảnh chụp màn hình](../image.png)

## Tính năng

- **Đường dẫn hướng do chính bạn vẽ.** Kéo các đường thẳng, đường tròn, đường cong mượt lên trên ảnh - và các tam giác sẽ tự sắp xếp men theo chúng. Đây là những modifier riêng nằm phía trên ảnh, nên bất cứ lúc nào bạn cũng có thể di chuyển, đổi mức chi tiết hay gộp nhóm chúng.
- **Lưới tự điều chỉnh theo chi tiết.** Ở nơi có nhiều chi tiết nhỏ và biên sắc, tam giác nhỏ hơn; ở vùng phẳng như bầu trời hay nền thì lớn hơn. Bức ảnh trở nên tỉ mỉ ở chỗ cần và êm dịu ở phần còn lại. Đồng thời kết quả có thể tái tạo một cách chắc chắn: với cùng thiết lập, lưới sẽ ra y hệt.
- **Màu tam giác.** Mỗi tam giác được tô bằng màu trung bình của các pixel bên dưới nó - hoặc màu trung vị, nếu bạn muốn làm dịu những điểm màu chói gắt.
- **Xuất file.** Vector (SVG, PDF) hoặc raster (PNG, JPG, WebP) lên đến 4096 pixel.
- **Dự án.** Lưu công việc vào file `.json` rồi quay lại với nó sau. Mà phiên làm việc hiện tại cũng tự khôi phục, kể cả khi bạn chỉ đóng tab.
- **Giao diện 21 ngôn ngữ.** Ngôn ngữ được nhận theo trình duyệt, và đổi được ở thanh trên cùng.

## Phím tắt

| Phím    | Hành động                                       |
| ------- | ----------------------------------------------- |
| `~`     | Con trỏ (chọn)                                  |
| `1`     | Công cụ "Đường gấp khúc"                         |
| `2`     | Công cụ "Đường cong"                             |
| `3`     | Đường tròn (tâm và bán kính)                     |
| `4`     | Đường tròn (3 điểm)                              |
| `Q`     | Đảo độ mờ của nền                               |
| `W`     | Đảo độ mờ của các điểm                          |
| `E`     | Đảo làm nổi tam giác nhọn (gần như suy biến)     |
| `F`     | Canh giữa ảnh                                    |
| `Space` | Hoàn tất đường chưa khép                         |
| `Esc`   | Hủy vẽ / bỏ chọn                                 |

## Bên trong

Dành cho ai tò mò: các điểm được rải bằng lấy mẫu đĩa Poisson (thuật toán Bridson) với bán kính thay đổi - bán kính do bản đồ biên Sobel quyết định, nên lưới dày hơn dọc theo các đường nét. Quá trình tạo là tất định: cùng một seed luôn cho ra cùng một lưới.
Toàn bộ pipeline hình học nặng nề - bản đồ biên, rải điểm và chính phần tam giác hóa - được gói trong một module WASM viết bằng Rust. Màu tam giác được tính riêng, trong một Web Worker.

## Phát triển

```sh
npm install
npm run dev    # máy chủ phát triển tại http://localhost:3000
npm run build  # tạo ra dist/bundle.js
```

## Giấy phép

[MIT](../LICENSE)
