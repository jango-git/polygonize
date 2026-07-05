# Tesselot - kiến trúc

## Lời mở đầu

Tesselot là một trình chỉnh sửa ảnh low-poly chạy trên trình duyệt: người dùng vẽ lên trên ảnh các hình dẫn hướng (**modifier**: đường thẳng, đường cong, đường tròn), còn ứng dụng sẽ gieo điểm (seed) vào phần không gian còn lại, tam giác hóa và tô màu. Ứng dụng mang lại gì cho người dùng thì đã có trong README; tài liệu này nói về cấu trúc của mã nguồn.

Điều quan trọng nhất cần hiểu trước khi đọc mã nguồn: pipeline hoàn toàn không phá hủy (non-destructive). Trạng thái được tách bạch rạch ròi thành **source** - những gì người dùng đã thiết lập (ảnh, cài đặt, cây các hình) - và **derived** - các điểm, tam giác hóa, màu sắc. Chỉ có source được lưu trữ và đưa vào lịch sử (history); derived luôn được tính lại từ source mỗi khi có thay đổi và mỗi khi tải lại, và không bao giờ được lưu.

Từ sự phân tách này mà gần như toàn bộ phần kiến trúc còn lại được suy ra: undo rẻ (bản chụp chỉ gồm source), mọi thứ đều tất định (một source luôn cho ra một derived), các phép tính nặng được đưa ra nền (derived tốn kém để tính), và dữ liệu chỉ chảy theo một chiều duy nhất - từ source tới derived, không bao giờ ngược lại.

Nếu đã quen thuộc, mô hình này giống luồng dữ liệu một chiều của Redux/Flux - một trạng thái duy nhất, thay đổi chỉ qua các command, các subscriber phản ứng theo sự kiện - cộng thêm một lớp trạng thái tính toán (computed) ở trên, giống như computed/reselect.

## Năm lớp

| Lớp | Thư mục | Chịu trách nhiệm về | Biết về |
|---|---|---|---|
| **UI** | `src/ui/` | đầu vào: vẽ, bảng điều khiển, công cụ, phím tắt | model (gửi command) |
| **Model** | `src/document/` | source + derived, lịch sử, sự kiện | không biết gì phía trên nó |
| **Domain** | `src/domain/` | logic thuần: cách một hình biến thành các điểm, cầu nối tới WASM | model gọi nó |
| **Render** | `src/preview/` | vẽ ảnh và các tam giác bằng three.js | chỉ lắng nghe model |
| **Native** | `crates/` | Rust->WASM: hình học nặng và màu sắc | không biết gì, các hàm thuần túy |

Ngoài ra còn một số thư mục hỗ trợ: `persistence/` (lưu trữ và xuất file), `settings/`, `i18n/`.

Quy tắc luồng dữ liệu: UI chỉ thay đổi model, render chỉ đọc model, chúng không giao tiếp trực tiếp với nhau. Kết nối chúng là một bus sự kiện bên trong model - đây chính là vòng lặp một chiều.

## Luồng dữ liệu

Kịch bản chính - "từ một nét chuột đến các tam giác đã đổi màu":

```
   người dùng          (1) UI bắt lấy đầu vào
       |
       v
   (2) command thay đổi SOURCE: thêm/di chuyển một hình
       |
       v
   (3) tính lại: source -> điểm -> tam giác      [nặng, chạy trong worker nền]
       |
       v
   (4) model đặt kết quả vào các buffer phẳng và phát sự kiện "đã xong"
       |
       v
   (5) render nghe sự kiện và cập nhật hình ảnh trên màn hình
       |
       +--> (6) song song, màu của các tam giác được tính -> thêm một sự kiện nữa -> tô lại màu
```

Ba kỹ thuật giúp vòng lặp này phản hồi nhanh nhạy:

- **Chỉ một lần tính lại mỗi khung hình.** Khi kéo thả, các sự kiện chuột đổ về hàng chục lần mỗi giây, nhưng việc tính lại không chạy quá một lần mỗi khung hình - các vị trí trung gian bị bỏ qua.
- **Render không bao giờ chờ đợi.** Trong lúc màu chính xác đang được tính ở nền, các tam giác lập tức được hiển thị với màu tạm thời; màu hoàn chỉnh sẽ đến sau qua một sự kiện riêng và phủ lên trên.
- **Không có phân bổ bộ nhớ (allocation) thừa.** Các tam giác không tồn tại dưới dạng object, mà là các mảng số phẳng, dài; cả render lẫn export đều đọc trực tiếp các mảng này.

## Bản đồ tác vụ

| Tôi muốn thay đổi... | Tôi xem trong... |
|---|---|
| hành vi của công cụ vẽ | `src/ui/tools/` |
| bảng điều khiển bên phải (cây hình, nhóm) | `src/ui/panel/` |
| cách một hình biến thành các điểm | `src/domain/modifiers/` |
| thuật toán gieo điểm / tam giác hóa | `crates/pipeline/` |
| cách tính màu của một tam giác | `crates/color/` |
| việc vẽ, camera, các lớp phủ | `src/preview/` |
| định dạng lưu trữ / undo | `src/document/` |
| lưu ra đĩa / xuất SVG, PDF, PNG | `src/persistence/` |

## Chi tiết từng lớp

### Model (`src/document/`)

Trạng thái là một object duy nhất `DocumentData` (`types.ts`), được chia đúng theo ranh giới này:

- **Source** (được lưu, có trong lịch sử): `image`, `seed`, `seedSettings`, `colorSettings`, `stack` (cây các hình).
- **Derived** (được tính lại, không lưu): `points` và các buffer phẳng dùng cho render - `renderPositions` (xyz cho mỗi đỉnh), `renderColors` (rgb cho mỗi tam giác), `triangleCount`.

Một thay đổi đi qua model như thế nào:

- `store.ts` - object trạng thái mutable duy nhất (`store.data()`).
- `commands/` - cách duy nhất để thay đổi nó, tương tự reducer. Command chỉnh sửa source tại chỗ rồi gọi commit: `commit.ts` quyết định có cần tính lại hay không (`commitStructural` cho các chỉnh sửa hình học) hoặc chỉ cần ghi một bước lịch sử là đủ (`commitViewOnly`, ví dụ như thu gọn một thư mục).
- `commands/pipeline.ts` - tính lại (`evaluatePoints`). Hoạt động theo nguyên tắc "chỉ một yêu cầu đang bay": dù có bao nhiêu chỉnh sửa gửi tới, worker chỉ xử lý một phép tính tại một thời điểm, nhưng phép tính cuối cùng luôn được hoàn tất đến cùng.
- `commands/recompute.ts` - sắp xếp kết quả vào các buffer phẳng (`buildGeometry`) và áp dụng màu đã tính xong (`applyColorGrid`).
- `signals.ts` - bus sự kiện (dựa trên `ferrsign`). Model không tự render gì cả; nó chỉ báo "các điểm đã thay đổi", "các tam giác đã thay đổi", "toàn bộ source đã bị thay thế", còn các subscriber - render, bảng điều khiển, lịch sử - sẽ phản ứng lại.
- `history.ts` - undo/redo. Bản chụp (snapshot) chỉ gồm source, thậm chí không có ảnh, nên rất rẻ; toàn bộ một cử chỉ kéo thả được gộp lại thành một bước duy nhất.
- `selectors/` - đọc model ra bên ngoài. Trả về bản sao (clone) để không ai có thể làm hỏng trạng thái ngoài các command; ngoại lệ là các buffer phẳng, chúng được trả về theo tham chiếu để đảm bảo tốc độ.

Cây các hình (`stack`) chỉ có một cấp, giống như các collection trong Blender: mỗi phần tử hoặc là một hình tự do, hoặc là một nhóm có các phần tử con. Một nhóm có thể "thu gọn" (chỉ ảnh hưởng hiển thị) và "tắt" (loại khỏi phép tính). Thứ tự trong stack có ý nghĩa. Các thao tác cấu trúc trên cây nằm ở `commands/stackTree.ts`, `modifierCommands.ts`, `groupCommands.ts`.

### Domain (`src/domain/`)

Logic không phụ thuộc DOM và three.js; ngoại lệ duy nhất là `imageSource.ts`, nơi đọc pixel từ `<canvas>`. Có hai chủ đề chính:

- `modifiers/` - cách mỗi hình biến thành các điểm và các cạnh ràng buộc (`ModifierResult`): `path.ts` (đường gấp khúc hoặc spline Catmull-Rom), `bezier.ts` (đường cong Bezier với tay cầm đối xứng), `circle.ts`. Bộ gom kết quả chung là `result.ts`.
- Các cầu nối tới lớp native: mỗi WASM crate có một bộ ba "facade + worker + client". Các phép tính nặng chạy trong Web Worker, dữ liệu vượt biên dưới dạng mảng transferable, không cần sao chép.

Những phần nhỏ khác: `rng.ts` (bộ sinh số giả ngẫu nhiên tất định), `colorGrid.ts` (tìm kiếm màu theo không gian), `groupColor.ts` (màu của nhóm được suy ra từ tên của nó - đổi tên tức là đổi màu).

### Render (`src/preview/`)

Lắng nghe sự kiện của model theo đúng một chiều, không có tham chiếu ngược vào model. Tọa độ thế giới trùng với tọa độ ảnh (trục Y hướng xuống), camera là ortho (trực giao).

- `preview.ts` - bộ điều phối: một scene, một renderer, một tập các layer.
- Các layer sở hữu đối tượng three.js của riêng mình: `triangleLayer.ts` (các tam giác; tái sử dụng buffer thay vì tạo lại mỗi khung hình), `imageLayer.ts` (ảnh gốc), `pointLayer.ts` (các điểm seed), `overlayLayer.ts` (các lớp phủ chỉnh sửa: lựa chọn, tay cầm, bản nháp).
- `receiving.ts` - cầu nối "sự kiện của model -> lời gọi tới các layer". Ở đây có một tối ưu hóa: với sự kiện "đã tô lại màu" chỉ cập nhật màu, với sự kiện "đã dựng lại" thì cập nhật cả vị trí lẫn màu.
- `viewport.ts` - camera và chuyển đổi tọa độ màn hình<->ảnh (zoom, pan).

### UI (`src/ui/`)

DOM/canvas mệnh lệnh (imperative), không dùng framework; các panel dựng lại DOM của mình theo sự kiện. Trạng thái UI không bao giờ bị thay đổi trực tiếp - chỉ thông qua các command.

- `tools.ts` (`ToolController`) - máy trạng thái hữu hạn giữa các chế độ "chọn / vẽ / kéo thả"; bắt đầu vào trên canvas.
- `tools/` - phần triển khai công cụ: bản nháp của các hình đang vẽ (`*Draft.ts`) và `dragSession.ts` - kéo thả một điểm; đây là nơi tồn tại cơ chế "một lần tính lại mỗi khung hình" và việc gộp một cử chỉ thành một bước undo.
- `panel/` - bảng điều khiển bên phải: cây các hình với nhóm và kéo-thả (`stackView.ts`, `dnd.ts`).
- Phần còn lại - bảng công cụ, lựa chọn và làm nổi bật, phím tắt, thông báo (toast).

### Lớp native (`crates/`)

Có hai crate độc lập; mỗi crate tự cache ảnh đã tải ở phía mình để không phải gửi lại ảnh ở mỗi lần gọi.

- `crates/pipeline/` - hình học: `sobel.rs` (bản đồ mật độ theo biên của ảnh: nơi có sự thay đổi đột ngột thì điểm dày hơn), `seeding.rs` (rải điểm bằng phương pháp Bridson với bán kính biến thiên), `triangulate.rs` (tam giác hóa Delaunay có ràng buộc, dùng crate `spade`), `contours.rs` (dò biên của ảnh thành các hình có thể chỉnh sửa, dùng Canny).
- `crates/color/` - màu sắc: lấy mẫu màu bên dưới mỗi tam giác (trung bình hoặc trung vị) và xây dựng một lưới không gian để tìm kiếm nhanh. Chạy trong color worker.

Những phần quan trọng đối với tính tất định - bộ sinh số giả ngẫu nhiên, gieo điểm, lấy mẫu - được cố tình làm khớp bit-với-bit với bản triển khai TS trước đây: cùng một seed sẽ cho ra cùng một ảnh trên bất kỳ lần chạy nào.

## Build

- `npm run build:wasm` - với mỗi crate: cargo -> wasm-bindgen (`--target web`) -> wasm-opt (`-Oz`). Mã glue được đặt vào `src/generated/` (nằm trong gitignore), file `.wasm` được sao chép vào `dist/` và được nạp lúc chạy.
- `npm run build` = `build:wasm`, sau đó `rollup -c`. `npm run dev` thêm chế độ watch (`-w`).
- Deploy dạng static (GitHub Pages), không có backend.

## Tổng kết

Ứng dụng chỉ lưu trữ source: người dùng chỉnh sửa nó qua UI, model đưa nó qua pipeline Rust/WASM chạy nền để tạo ra các buffer phẳng, còn render chỉ phản ánh lại các buffer đó. Mọi thứ khác đều là hệ quả của chính sự phân tách duy nhất này.
