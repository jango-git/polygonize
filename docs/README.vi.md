# Polygonize

[en](../README.md) · [zh-Hans](README.zh-Hans.md) · [hi](README.hi.md) · [es](README.es.md) · [fr](README.fr.md) · [bn](README.bn.md) · [pt](README.pt.md) · [ru](README.ru.md) · [id](README.id.md) · [de](README.de.md) · [ja](README.ja.md) · [tr](README.tr.md) · **vi** · [ko](README.ko.md) · [it](README.it.md) · [pl](README.pl.md) · [uk](README.uk.md) · [uz](README.uz.md) · [az](README.az.md) · [kk](README.kk.md) · [be](README.be.md)

Trình chỉnh sửa ảnh low-poly chạy trên trình duyệt. Tải một bức ảnh, tinh chỉnh phép tam giác hóa, làm mượt các cạnh bằng bộ chỉnh sửa hình dạng, rồi xuất ra SVG hoặc PNG.

**[TRÌNH CHỈNH SỬA](https://jango-git.github.io/polygonize/)**

![Ảnh chụp màn hình](../image.png)

## Tính năng

- **Gieo điểm thông minh** - Lấy mẫu đĩa Poisson Bridson với bán kính thay đổi theo phát hiện biên cạnh Sobel: vùng biên dùng bán kính nhỏ nhất (tam giác dày đặc), vùng phẳng dùng bán kính lớn nhất (tam giác thưa). Quá trình tạo điểm hoàn toàn dựa trên hạt giống, nên cùng một hạt giống sẽ tái tạo đúng cùng một lưới
- **Ngăn xếp bộ chỉnh sửa** - Các lớp đường gấp khúc, hình tròn và đường cong Catmull-Rom không phá hủy thêm các cạnh ràng buộc lên trên lưới gốc; sắp xếp lại hoặc nhóm chúng tùy ý bằng thao tác kéo và thả
- **Lấy mẫu màu** - Màu pixel trung bình hoặc trung vị cho từng tam giác; tùy chọn dải màu theo từng đỉnh
- **Xuất** - Vector SVG hoặc PDF, hoặc raster PNG, JPG hay WebP lên đến 4096px
- **Dự án** - Lưu và khôi phục công việc dưới dạng `.json`; phiên làm việc tự lưu vào localStorage
- **Giao diện bản địa hóa** - 21 ngôn ngữ giao diện, tự động nhận diện từ trình duyệt và có thể chuyển đổi ở thanh trên cùng

## Phím tắt

| Phím    | Hành động                           |
| ------- | ----------------------------------- |
| `~`     | Con trỏ (chọn)                      |
| `1`     | Công cụ đường gấp khúc              |
| `2`     | Công cụ đường cong Catmull-Rom      |
| `3`     | Công cụ hình tròn (tâm và bán kính) |
| `4`     | Công cụ hình tròn (3 điểm)          |
| `Q`     | Đảo độ mờ của nền                   |
| `W`     | Đảo độ mờ của điểm                  |
| `E`     | Đảo lớp gai nhọn                    |
| `F`     | Vừa khung ảnh                       |
| `Space` | Áp dụng đường mở                    |
| `Esc`   | Hủy vẽ / bỏ chọn                    |

## Phát triển

```sh
npm install
npm run dev    # máy chủ phát triển tại http://localhost:3000
npm run build  # xuất ra dist/bundle.js
```

## Giấy phép

[MIT](../LICENSE)
