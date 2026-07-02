# <img src="../logo.svg" alt="" height="28" align="absmiddle"> Polygonize

[en](../README.md) · [zh-Hans](README.zh-Hans.md) · [hi](README.hi.md) · [es](README.es.md) · [fr](README.fr.md) · [bn](README.bn.md) · [pt](README.pt.md) · [ru](README.ru.md) · [id](README.id.md) · [de](README.de.md) · [ja](README.ja.md) · [tr](README.tr.md) · **vi** · [ko](README.ko.md) · [it](README.it.md) · [pl](README.pl.md) · [uk](README.uk.md) · [uz](README.uz.md) · [az](README.az.md) · [kk](README.kk.md) · [be](README.be.md)

Trình chỉnh sửa chạy trên trình duyệt, biến một bức ảnh thành hình ảnh low-poly - được ghép từ các hình tam giác. Điểm khác biệt so với các trình tạo thông thường nằm ở chỗ: trên lưới điểm được sinh tự động, bạn tự vẽ các đường dẫn hướng, và các cạnh tam giác sẽ chạy dọc theo chúng. Những đường nét quan trọng - đường viền cằm, gọng kính, đường viền silhouette - vẫn giữ được nét rõ ràng, thay vì bị chìm trong một lưới ngẫu nhiên.

**[MỞ TRÌNH CHỈNH SỬA](https://jango-git.github.io/polygonize/)**

![Ảnh chụp màn hình](../image.png)

## Tính năng

- **Đường dẫn hướng.** Bạn vẽ các đường thẳng, đường tròn và đường cong mượt lên trên ảnh - các hình tam giác sẽ tự sắp xếp dọc theo chúng. Đây không phải là thao tác một lần, mà là các bộ điều chỉnh (modifier): bất cứ lúc nào bạn cũng có thể di chuyển, thay đổi mức chi tiết, hoặc nhóm chúng lại.
- **Lưới tự thích ứng với chi tiết.** Ở những nơi có nhiều chi tiết nhỏ và ranh giới sắc nét, các hình tam giác sẽ nhỏ hơn; ở những vùng phẳng như bầu trời, chúng sẽ lớn hơn. Kết quả là hình ảnh chi tiết ở những nơi cần thiết, và mượt mà ở phần còn lại.
- **Tự động dò viền.** Để không phải bắt đầu từ một trang trắng, hãy nhấn "Dò viền": trình chỉnh sửa sẽ tìm các cạnh của ảnh và biến chúng thành các bộ điều chỉnh có thể chỉnh sửa, được gom vào một nhóm riêng.
- **Màu sắc tam giác.** Mỗi hình tam giác được tô bằng màu trung bình của các điểm ảnh bên dưới nó - hoặc màu trung vị (median), nếu bạn muốn giảm bớt các điểm sáng bất thường.
- **Xuất file.** Vector (SVG, PDF) hoặc raster (PNG, JPG, WebP) với độ phân giải lên đến 4096 pixel.
- **Dự án.** Lưu công việc của bạn vào một file `.json` và quay lại sau. Phiên làm việc hiện tại cũng tự khôi phục - ngay cả khi bạn chỉ đơn giản là đóng tab.
- **Giao diện hỗ trợ 21 ngôn ngữ.** Ngôn ngữ được xác định theo trình duyệt, và có thể chuyển đổi ở thanh công cụ phía trên.

## Bên trong hoạt động thế nào

Các điểm được sắp xếp bằng phương pháp lấy mẫu đĩa Poisson (thuật toán Bridson) với bán kính biến thiên - bán kính này được xác định bởi bản đồ biên Sobel, vì vậy lưới sẽ dày đặc hơn dọc theo các đường viền. Việc sinh điểm là tất định: cùng một seed sẽ luôn cho ra cùng một lưới. Toàn bộ pipeline hình học nặng - bản đồ biên, sắp xếp điểm, tam giác hóa - được đóng gói trong một module WASM viết bằng Rust; màu sắc của các hình tam giác được tính riêng, trong một Web Worker.

Nếu bạn định đọc mã nguồn, hãy bắt đầu với [tổng quan kiến trúc](onboarding.vi.md).

## Phát triển

```sh
npm install
npm run dev    # máy chủ phát triển tại http://localhost:3000
npm run build  # tạo ra dist/bundle.js
```

## Giấy phép

[MIT](../LICENSE)
