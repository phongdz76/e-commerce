# Hướng dẫn sử dụng SGTech — trang khách hàng và trang quản trị

Cập nhật ngày **16/10/2026**, đối chiếu với mã nguồn hiện có trong workspace.

Tài liệu dành cho người sử dụng website và người quản trị cửa hàng. Tên nút tiếng Anh được giữ lại để bạn đối chiếu trực tiếp với giao diện. Các bảng có ví dụ nhập liệu, quy tắc và kết quả cần kiểm tra.

**Người mới nên bắt đầu bằng [chương 9 — 30 bài thực hành từng cú bấm](#demo-data).** Phần này đi theo một bộ dữ liệu thống nhất, có form mẫu đã điền, nội dung có thể sao chép, cách mở các khối thu gọn, nút lưu chính xác và kết quả cần nhìn thấy sau mỗi bước. Chương 1–8 là phần tra cứu chức năng/quy tắc; không cần học thuộc trước khi thực hành.

**Phạm vi bản hiện tại:** dự án phục vụ demo/CV, thanh toán online dùng sandbox/test. Một số thay đổi trong workspace chưa được triển khai lên Vercel; nếu website chưa có một nút được mô tả, kiểm tra phiên bản triển khai trước. Những chức năng chưa hoàn thiện được liệt kê ở cuối tài liệu.

## Mục lục

1. [Truy cập, vai trò và quy tắc nhập dữ liệu](#bat-dau)
2. [Hướng dẫn trang khách hàng](#user)
3. [Bản đồ chức năng trang admin](#admin-map)
4. [Tạo danh mục, thương hiệu, sản phẩm và tồn kho](#catalog)
5. [Quản lý đơn, giao hàng, COD, thanh toán và hoàn tiền](#orders-admin)
6. [Chat, phiếu hỗ trợ, tiếp nhận trả hàng và đổi hàng](#support-admin)
7. [Liên hệ, bản đồ, FAQ, chính sách và giờ hỗ trợ](#content-admin)
8. [Báo cáo, tài khoản, thông báo, nhật ký và vận hành](#operations-admin)
9. [30 bài thực hành cầm tay chỉ việc, có mẫu điền từng form](#demo-data)
10. [Lỗi thường gặp và cách xử lý](#troubleshooting)
11. [Những phần chưa có hoặc chưa nghiệm thu đầy đủ](#limitations)
12. [Checklist sử dụng hằng ngày](#checklist)

<a id="bat-dau"></a>

## 1. Truy cập, vai trò và quy tắc nhập dữ liệu

### 1.1. Mở website

- Website Vercel của dự án: <https://e-commerce-orcin-one-32.vercel.app>.
- Khi chạy ứng dụng trên máy, dùng địa chỉ mà terminal thông báo, thường là `http://localhost:3000`.
- Các đường dẫn như `/admin/products` trong tài liệu được mở trên **cùng website bạn đang sử dụng**.
- Nội dung xuất bản trên local chỉ xuất hiện trên Vercel nếu hai môi trường dùng cùng database. Không mặc định rằng chúng dùng chung dữ liệu.

### 1.2. Phân biệt tài khoản và khu vực giao diện

| Đối tượng | Sử dụng được | Điểm cần nhớ |
|---|---|---|
| Khách chưa đăng nhập | Xem/tìm sản phẩm, xem trang trợ giúp, thao tác giỏ hàng trên trình duyệt | Các luồng gắn tài khoản như đặt đơn, xem đơn, chat lưu lịch sử cần đăng nhập |
| Tài khoản USER | Mua hàng; quản lý hồ sơ, đơn, yêu cầu hỗ trợ và đổi trả của mình | Không truy cập được trang quản trị |
| Tài khoản ADMIN | Truy cập `/admin` và các trang quản lý | Phải được cấp vai trò ADMIN; đăng ký thông thường không tự thành admin |

Trang có thanh tìm kiếm sản phẩm, giỏ hàng và banner là **trang mua hàng**. Trang có sidebar Dashboard, Products, Orders, Inventory… là **khu vực quản trị**.

Menu phía mua hàng có các mục cá nhân như `Your Orders`, `Your support requests`, `Your return requests`; tài khoản ADMIN còn có liên kết `Admin page`. Để xử lý yêu cầu của khách với tư cách quản trị, hãy vào `/admin` rồi dùng **Support requests / Returns trên sidebar admin**, không dùng liên kết Your… của tài khoản cá nhân. Vị trí hiển thị và vai trò tài khoản là hai khái niệm riêng: hãy nhìn cả địa chỉ trang và menu trước khi thao tác.

Không có nút tự nâng quyền ADMIN trên giao diện. Người phụ trách kỹ thuật cấp quyền bằng công cụ quản trị của dự án; không sửa role qua form hồ sơ khách hàng.

### 1.3. Quy tắc nhập dữ liệu chung

| Loại dữ liệu | Cách nhập đúng | Ví dụ / cách tránh lỗi |
|---|---|---|
| Tiền VND | Số nguyên, không thêm ký hiệu tiền và dấu phân cách | Nhập `199000`, không nhập `199.000đ` hoặc `199,000` vào ô số |
| Số lượng | Số nguyên; lượng mua/nhập/xuất thường phải lớn hơn 0 | `1`, `5`, `10`; kiểm kê có thể bằng `0` nếu không thấp hơn lượng đã giữ |
| Email | Đúng định dạng, dùng hộp thư bạn kiểm soát nếu cần nhận thư | `khach-demo@example.test` chỉ minh họa, không dùng để thử nhận email |
| Điện thoại | Nên dùng dạng chỉ có số hoặc `+` đầu chuỗi | Ví dụ định dạng `0901234567` hoặc `+84901234567`; đây là dữ liệu mô phỏng |
| Slug | Chữ thường không dấu, số, dấu `-`, không khoảng trắng | `tai-nghe-sgtech-demo` |
| SKU | Mã riêng của từng phiên bản; chữ HOA, số, `_` hoặc `-` | `SG-DEMO-BLK`, `SG-DEMO-WHT`; không dùng lại mã của SKU khác |
| Màu HEX | Dấu `#` và đúng 6 ký tự hệ 16 | `#111827`, `#FFFFFF`; không nhập `đen` vào ô mã màu |
| Ngày giờ | Chọn bằng ô ngày/giờ trên form; các màn hình nghiệp vụ ghi rõ giờ Việt Nam | Ví dụ `16/10/2026 14:30`, UTC+7; cách hiển thị phụ thuộc trình duyệt |
| Lý do thao tác | Viết điều đã kiểm tra, tài liệu đối chiếu và hành động cần làm | `Nhập 10 tai nghe theo phiếu NK-DEMO-001.` tốt hơn `ok` |
| Link ảnh | Dùng URL ảnh được hệ thống cho phép, hoặc upload từ nút trên form | Link trang Google Images hay đường dẫn `C:\...` không phải URL ảnh hợp lệ |
| Mã chứng từ/tracking | Nhập mã thật tương ứng hành động đang ghi nhận | Trong demo có thể dùng `DEMO-SHIP-001`; phải ghi rõ là mô phỏng |

Nhiều thao tác quản trị cần **lý do + ô xác nhận**. Nếu nút bị mờ, kiểm tra các trường bắt buộc, quyền nhận xử lý, trạng thái hiện tại và thay đổi chưa lưu. Sau khi bấm, chờ thông báo thành công rồi kiểm tra lại dữ liệu.

Các giá trị `ID`, số đơn `SG-…`, số yêu cầu `SR-…`, số đổi trả `RT-…`, lịch sử và phiên bản bản ghi do hệ thống tạo. Người dùng chọn bản ghi có sẵn; không tự chế những mã này để điền vào URL.

### 1.4. Dữ liệu nào nhập tay, dữ liệu nào hệ thống tự lưu?

| Nhóm dữ liệu | Bạn nhập qua đâu? | Hệ thống tự ghi / cách quản lý |
|---|---|---|
| Danh mục, thương hiệu | Form admin tương ứng | ID, liên kết với sản phẩm và thời điểm cập nhật |
| Sản phẩm và SKU | Products → Add/Edit | ID sản phẩm/SKU, lịch sử thay đổi; mỗi SKU liên kết đúng sản phẩm |
| Tồn đầu kỳ/nhập/xuất/kiểm kê | Inventory | Số dư sau thao tác và lịch sử; Available được tính, không nhập tay |
| Đơn hàng | Khách đặt qua checkout | Số đơn, bản lưu sản phẩm/giá/địa chỉ/phí, lượng giữ và chính sách khi có |
| Kết quả thanh toán online | Thao tác ở sandbox + kiểm tra của hệ thống | Tham chiếu cổng và kết quả đã xác minh; admin không gõ Paid tùy ý |
| Chứng từ COD | Panel COD của đơn | Chứng từ thu/nhận tiền riêng, không sửa đè lịch sử đã ghi |
| Giao hàng | Shipment form | Người cập nhật, thời điểm, lịch sử, thay đổi tồn khi xuất |
| Chat, ticket, return | Form của khách và bước xử lý của admin | Mã hồ sơ, phân công, tin nhắn, lịch sử và liên kết giữa các hồ sơ |
| Liên hệ/FAQ/chính sách/giờ hỗ trợ | Form nội dung hoặc giờ hỗ trợ | Bản nháp, bản công khai và lịch sử xuất bản theo tính năng |
| Báo cáo/nhật ký/thông báo | Chủ yếu là màn hình xem | Tổng hợp từ hành động và dữ liệu đã ghi, không nhập số tổng thủ công |

Với các bài thực hành, hãy tạo dữ liệu bằng đúng form để liên kết đơn–kho–thanh toán–lịch sử nhất quán. Không cần tự chèn JSON vào MongoDB. Sửa tay một con số tồn, trạng thái tiền hoặc xóa bản ghi trong database có thể làm dữ liệu không còn khớp nhau.

<a id="user"></a>

## 2. Hướng dẫn trang khách hàng

### 2.1. Đăng ký tài khoản — `/register`

1. Mở menu tài khoản → **Register**, hoặc vào `/register`.
2. Điền các trường dưới đây.
3. Bấm nút tạo tài khoản và chờ kết quả; sau đó đăng nhập theo hướng dẫn trên màn hình.

| Trường | Cách nhập | Ví dụ mô phỏng |
|---|---|---|
| Name | Tên hiển thị của bạn | `Nguyễn Minh Demo` |
| Email | Email đúng định dạng; dùng email thật của bạn nếu thử xác minh/quên mật khẩu | `khach-demo@example.test` chỉ dùng làm mẫu định dạng |
| Password | Tối thiểu 8 ký tự, tối đa 72 byte; có chữ HOA, chữ thường, số và ký tự thuộc `@$!%*?&` | `Demo@Shop2026` chỉ minh họa, không dùng làm mật khẩu chung |

Mật khẩu hiện chỉ chấp nhận bộ ký tự phù hợp quy tắc trên; tránh dấu cách, chữ có dấu hoặc ký tự đặc biệt khác. Không đăng ký bằng email đã thuộc một tài khoản khác.

**Continue with Google/Facebook:** chọn nhà cung cấp và hoàn tất đăng nhập khi tích hợp OAuth của môi trường đã được cấu hình. Đây không phải cách tự tạo quyền admin.

### 2.2. Đăng nhập, quên mật khẩu và xác minh email

**Đăng nhập tại `/login`:**

1. Nhập **Email or Username** và **Password**.
2. Có thể chọn **Remember my email** để nhớ email trên trình duyệt; tùy chọn này không phải lưu mật khẩu.
3. Bấm **Login**.
4. Nếu bạn đang mở một trang yêu cầu đăng nhập, hệ thống có thể đưa bạn trở lại trang đó.

**Quên mật khẩu:**

1. Chọn **Forgot password?** → `/forgot-password`.
2. Nhập email tài khoản và gửi yêu cầu.
3. Mở thư, theo liên kết đến trang `/reset-password`.
4. Nhập mật khẩu mới, nhập lại mật khẩu xác nhận rồi bấm **Reset Password**.
5. Đăng nhập lại. Nếu link không hợp lệ/hết hạn, gửi yêu cầu mới.

**Xác minh email:** mở liên kết được gửi qua email đến `/verify-email`, rồi bấm **Confirm email**. Link xác minh hiện có hạn 1 giờ. Không chụp/chia sẻ nguyên liên kết có token cho người khác.

Việc nhận thư phụ thuộc cấu hình sender của môi trường. Bản demo không có sẵn hộp thư thật cho các địa chỉ `example.test` trong tài liệu.

### 2.3. Hồ sơ cá nhân — `/profile`

1. Mở menu tài khoản → **Profile**.
2. Chỉnh các trường cần thay đổi.
3. Bấm **Save Changes**; nút **Reset** đưa form về dữ liệu đang có, không xóa tài khoản.

| Nhóm dữ liệu | Cách dùng |
|---|---|
| Ảnh đại diện | Chọn **Change avatar / Upload Avatar**, upload ảnh rồi lưu hồ sơ; dịch vụ upload cần được cấu hình |
| Username | Nhập tên đăng nhập mong muốn; nếu trùng hoặc sai quy tắc, xem thông báo của form |
| Email | Đổi sang hộp thư bạn kiểm soát; email đăng nhập chưa đổi cho đến khi xác minh email mới |
| Address | Bấm **Change**, chọn tỉnh/thành → quận/huyện → phường/xã theo danh sách, rồi nhập số nhà/đường |
| Phone Number | Nhập số điện thoại hợp lệ, ví dụ định dạng `0901234567` |
| Current Password | Cần cho các thao tác nhạy cảm mà form yêu cầu, chẳng hạn đổi mật khẩu/đổi email với tài khoản có mật khẩu |
| New Password | Để trống nếu không đổi; nếu đổi thì áp dụng quy tắc mật khẩu ở mục đăng ký |

Ví dụ địa chỉ để thực hành: chọn một bộ tỉnh/huyện/xã **thực sự có trong dropdown**, sau đó nhập `12 Đường Demo, Tòa A, tầng 2`. Không chỉ gõ tên tỉnh vào ô số nhà.

Tài khoản đăng nhập xã hội chưa có mật khẩu có thể được yêu cầu thiết lập mật khẩu hoặc đăng nhập lại gần đây trước thao tác nhạy cảm. Đọc thông báo trên form.

Các nút xác minh có thể là **Verify current email** hoặc gửi lại liên kết xác minh tùy trạng thái. **Sign out all sessions** đăng xuất mọi thiết bị, kể cả thiết bị hiện tại; sau đó cần đăng nhập lại.

### 2.4. Trang chủ, tìm kiếm và bộ lọc — `/`, `/products`

1. Gõ tên sản phẩm vào ô **Search products…** trên header; chọn gợi ý hoặc mở kết quả tìm kiếm.
2. Có thể bấm nhóm hàng trên trang chủ hoặc vào `/products`.
3. Chọn danh mục, thương hiệu, giá thấp nhất/cao nhất và các thông số được cấu hình cho danh mục.
4. Chọn **In stock** nếu chỉ muốn xem hàng khả dụng.
5. Chọn cách sắp xếp và trang kết quả.
6. Bấm dấu bỏ từng bộ lọc, hoặc **Clear all filters** để trở về danh sách đầy đủ.

Giá lọc cũng nhập bằng số nguyên VND, ví dụ từ `100000` đến `500000`; giá tối thiểu không được lớn hơn giá tối đa. Các bộ lọc thông số chỉ có ý nghĩa khi sản phẩm đã được nhập thông số tương ứng.

Trên điện thoại, bấm biểu tượng tìm kiếm nếu ô nhập đang thu gọn. Sản phẩm/danh mục/thương hiệu bị ẩn hoặc sản phẩm chưa Active sẽ không có hành vi như hàng đang bán.

### 2.5. Xem sản phẩm và chọn SKU — `/product/<productId>`

1. Mở một sản phẩm từ danh sách.
2. Chọn màu/phiên bản trong **Colors / Product option**.
3. Kiểm tra tên phiên bản, mã SKU, giá, ảnh và số lượng khả dụng.
4. Xem ảnh chính, ảnh bổ sung; xem **Technical specifications**, **Warranty policy**, **In the box** khi có dữ liệu.
5. Chọn số lượng rồi bấm nút thêm vào giỏ.
6. Sau khi có thông báo thêm thành công, chọn **View Cart** hoặc tiếp tục mua.

Mỗi SKU có thể có giá, tồn, thông số, ảnh và điều kiện bảo hành riêng. Ví dụ sản phẩm `Tai nghe SGTech Demo` có SKU `SG-DEMO-BLK` màu đen và `SG-DEMO-WHT` màu trắng; phải chọn đúng phiên bản trước khi thêm.

Nếu hiện **Out of Stock**, không thể coi sản phẩm là mua được chỉ vì ảnh vẫn hiện. Hàng chưa được giữ khi bạn đang xem sản phẩm hoặc mới thêm vào giỏ; lượng còn lại có thể thay đổi trước khi đặt đơn.

Các liên kết **Shipping & delivery**, **Returns & exchanges**, **Ask about warranty** mở chính sách hoặc tạo yêu cầu hỗ trợ có ngữ cảnh sản phẩm. Hỏi bảo hành không tự tạo một hồ sơ tiếp nhận sửa chữa.

### 2.6. Giỏ hàng — `/cart`

1. Bấm biểu tượng giỏ hàng.
2. Kiểm tra sản phẩm, phiên bản, giá và số lượng.
3. Tăng/giảm số lượng; xóa dòng không mua hoặc dùng **Clear Cart** để xóa cả giỏ.
4. Nếu có cảnh báo giá/tồn/phiên bản thay đổi, xem lại và chọn phương án cập nhật được đề nghị trước khi checkout.
5. Bấm nút đi tới thanh toán; **Continue Shopping** quay lại mua hàng.

**Choose a current option** xuất hiện khi dòng giỏ cần chọn lại SKU hiện hành. Dòng cũ không bảo đảm giá hoặc khả dụng cũ.

Giỏ hiện lưu trên trình duyệt. Đổi trình duyệt/thiết bị hoặc xóa dữ liệu website có thể làm giỏ khác; đăng nhập chưa đồng bộ giỏ giữa thiết bị.

### 2.7. Nhập thông tin giao hàng và lấy báo phí — `/checkout`

1. Đăng nhập và bảo đảm giỏ còn ít nhất một dòng mua được.
2. Trong **Delivery Information**, nhập tên người nhận, địa chỉ và số điện thoại.
3. Nếu đang dùng thông tin đã lưu, bấm **Change** để sửa cho đơn này; **Cancel and use saved delivery information** dùng lại thông tin đã lưu.
4. Chọn đủ địa bàn trong các dropdown đang yêu cầu. Địa chỉ cũ có thể cần bổ sung tỉnh/thành.
5. Bấm **Get delivery quote**.
6. Kiểm tra **Delivery fee**, **Total**, nhãn chính sách phí và các chính sách cửa hàng.
7. Chọn phương thức thanh toán, rồi đặt đơn/thanh toán.

| Trường | Ví dụ nhập | Quy tắc sử dụng |
|---|---|---|
| Full Name | `Nguyễn Minh Demo` | Tên người nhận, không nhất thiết trùng tên tài khoản |
| Province / City | Chọn từ danh sách | Không tự nhập mã tỉnh đoán được |
| District, Ward | Chọn sau cấp cha khi form yêu cầu | Đổi tỉnh/huyện phải chọn lại các cấp phụ thuộc |
| House Number, Street Name | `12 Đường Demo, Tòa A, tầng 2` | Nhập chi tiết giao hàng, không để trống |
| Phone Number | `0901234567` | Dùng số người nhận để liên lạc; số mẫu chỉ để demo |

**Ví dụ tính phí theo cấu hình demo mặc định:** tiền hàng `199000` + phí giao `15000` = tổng `214000`. Từ tiền hàng `300000` thì được miễn phí. Nếu admin đã thay cấu hình, dùng **báo phí thực tế hiện trên checkout**, không áp dụng cứng ví dụ này.

Báo phí có hiệu lực 10 phút. Khi đổi hàng, số lượng, địa chỉ hoặc nội dung/chính sách liên quan thay đổi, có thể phải bấm **Refresh delivery quote** và xác nhận lại tổng. Trước khi có báo phí, số tiền hàng hiện trên màn hình chưa phải tổng cuối gồm phí giao.

Nút đặt đơn bị khóa nếu chưa có quote hợp lệ hoặc hệ thống đang xử lý. Với Stripe, địa chỉ bị khóa lúc chuẩn bị thanh toán thẻ; chuyển phương thức theo giao diện để hủy bước chuẩn bị an toàn trước khi sửa địa chỉ.

### 2.8. Thanh toán COD và online

| Phương thức | Thao tác | Kết quả cần kiểm tra |
|---|---|---|
| Cash on Delivery (COD) | Chọn COD → **Place Order** | Có đơn trong Your Orders; COD mới đặt vẫn chưa thanh toán |
| VNPay | Chọn → **Continue with VNPay**, hoàn tất ở trang sandbox | Quay lại website và kiểm tra đơn; trạng thái phải được hệ thống xác minh |
| MoMo | Chọn → **Continue with MoMo**, hoàn tất tại trang sandbox | Xem lại trạng thái đơn, không chỉ dựa vào việc đã mở trang thanh toán |
| ZaloPay | Chọn → **Continue with ZaloPay**, làm theo trang sandbox | Có thể dùng liên kết **View your ZaloPay order status** để kiểm tra |
| Stripe | Chọn thẻ, chờ form thẻ sẵn sàng, nhập dữ liệu thẻ test rồi **Pay Now** | Đợi kết quả xác minh và xem đơn |

Chỉ dùng tài khoản/thẻ thử nghiệm do môi trường sandbox tương ứng hỗ trợ. Không nhập thẻ thật hoặc tiền thật vào bài demo. Tài liệu không cung cấp tài khoản sandbox dùng chung.

Nếu phương thức bị mờ hoặc báo unavailable, cấu hình hoặc điều kiện của môi trường chưa cho phép sử dụng. Chọn phương thức đang khả dụng để thực hành.

Nếu bị treo/mất mạng sau khi bấm thanh toán: mở **Your Orders** để kiểm tra đơn đã được tạo chưa. Dùng **Check again / Continue payment** nếu màn hình và trạng thái cho phép. Không liên tục tạo thêm đơn mới để thử lại một giao dịch chưa rõ kết quả.

### 2.9. Theo dõi đơn — `/orders`, `/orders/<orderId>`

1. Mở menu tài khoản → **Your Orders**.
2. Dùng bộ lọc đang có để tìm đơn, rồi mở chi tiết.
3. Kiểm tra số đơn, ngày tạo, tiền hàng/phí/tổng đã lưu, phiên bản sản phẩm, người nhận và phương thức thanh toán.
4. Xem riêng phần thanh toán, tiến trình giao hàng và lịch sử đơn.
5. Chọn **Ask about this order** khi cần hỗ trợ; yêu cầu sẽ giữ ngữ cảnh đơn của bạn.

Phân biệt ba loại trạng thái:

| Nhóm | Ý nghĩa | Ví dụ |
|---|---|---|
| Đơn thương mại | Cửa hàng đang tiếp nhận hay đã xác nhận/hủy đơn | Awaiting confirmation, Confirmed, Cancelled |
| Thanh toán | Kết quả thu tiền | Pending, Processing, Paid, Failed |
| Giao hàng | Hàng đã chuẩn bị/gửi/giao hay chưa | Preparing, Ready to ship, Shipped, In transit, Delivered |

**Confirmed không có nghĩa đã trả tiền. Delivered không tự tạo chứng từ thu COD.** Một đơn đã thu tiền rồi hủy vẫn phải giữ lịch sử tiền đã thu và theo dõi hoàn tiền riêng.

Các liên kết chính sách trong đơn, nếu có bản lưu, mở phiên bản áp dụng lúc tạo đơn. Đơn cũ chưa lưu chính sách sẽ được thông báo tương ứng; không mặc định chính sách mới áp dụng hồi tố.

### 2.10. Xin hủy đơn đã thanh toán trước khi bàn giao

1. Mở chi tiết đơn của bạn.
2. Tìm **Cancellation & refund**.
3. Nếu có hành động **Request cancellation & refund**, chọn hành động đó.
4. Nhập lý do tối thiểu 10, tối đa 500 ký tự, ví dụ `Tôi đặt nhầm phiên bản, đề nghị hủy trước khi bàn giao vận chuyển.`
5. Đánh dấu xác nhận và gửi.
6. Theo dõi quyết định của admin và kết quả hoàn tiền trong chính đơn đó.

Yêu cầu chờ duyệt sẽ chặn giao hàng theo luồng này. Admin duyệt hủy chưa có nghĩa tiền đã hoàn. Chỉ **Refund confirmed** là kết quả hoàn đã được xác nhận.

Nếu đơn đã bàn giao/xuất kho, dùng luồng đổi trả hàng đã giao hoặc liên hệ hỗ trợ theo điều kiện đơn. Chưa có một nút hủy chung áp dụng cho mọi loại đơn ở mọi trạng thái.

### 2.11. Quick help, chat và Zalo

**Quick help:** mở nút trợ giúp nổi, chọn câu hỏi FAQ để đọc câu trả lời tự động. Nội dung tự động có nhãn riêng.

**Chat lưu lịch sử:** mở `/support` hoặc phần chat với đội hỗ trợ trên widget:

1. Đăng nhập.
2. Nhập nội dung, ví dụ `Nhờ cửa hàng kiểm tra giúp thời điểm gửi đơn SG-… của tôi.`
3. Có thể đính kèm một ảnh PNG/JPEG/WebP tối đa 1 MiB.
4. Gửi và chờ phản hồi; dùng **Refresh messages** khi cần cập nhật.
5. **Older messages / Latest messages** để chuyển đoạn lịch sử.

Tin chat tối đa 2.000 ký tự; giới hạn gửi hiện là 20 tin/phút/tài khoản, upload 20 ảnh trong 24 giờ. Khi gửi lỗi, form giữ nội dung để bạn thử lại. Ảnh hỗ trợ là ảnh riêng tư theo quyền hội thoại.

Lịch sử được lưu theo tài khoản và có thể xem lại sau đăng nhập. Tin mới cập nhật theo chu kỳ, không cam kết thời gian trả lời. Giờ hỗ trợ đã xuất bản không có nghĩa nhân viên đang online.

Nút **Zalo** mở liên kết ngoài khi đã cấu hình. Tin nhắn gửi trong Zalo không tự đồng bộ về inbox chat của SGTech.

### 2.12. Tạo và theo dõi phiếu hỗ trợ — `/support/requests`

Phiếu hỗ trợ giúp bạn có **mã yêu cầu và trạng thái xử lý riêng**. Chat là nơi trao đổi chung; một tài khoản có thể có nhiều phiếu dùng chung lịch sử hội thoại.

1. Vào `/support/requests/new` hoặc chọn **Create support request**.
2. Chọn loại yêu cầu, nhập tiêu đề và mô tả.
3. Chọn đơn liên quan nếu có; đi từ trang sản phẩm/đơn sẽ giữ ngữ cảnh tương ứng.
4. Có thể đính kèm ảnh riêng tư.
5. Gửi, ghi lại mã `SR-…` và theo dõi tại **Your support requests**.

| Trường | Cách nhập | Ví dụ |
|---|---|---|
| Request type | General question, Order and payment, Delivery, Return or cancellation enquiry, Warranty enquiry | `Delivery` |
| Subject | 5–100 ký tự | `Cần kiểm tra địa chỉ giao đơn demo` |
| Details | 10–1.800 ký tự | `Nhờ cửa hàng xác nhận giúp thông tin tòa nhà trước khi gửi hàng.` |
| Linked order/product | Chọn bản ghi của mình hoặc dùng ngữ cảnh đã có | Chọn đơn vừa đặt; không nhập ID người khác |
| Image | PNG/JPEG/WebP tối đa 1 MiB, không bắt buộc | Ảnh vấn đề cần hỗ trợ |

Mở chi tiết phiếu để xem **Open → In progress → Reply requested → Resolved → Closed** theo xử lý của admin. Khi **Reply requested**, gửi thêm thông tin trong phần hội thoại chung. Khách không tự đặt trạng thái quản trị.

Phiếu hỏi trả hàng/bảo hành chỉ là yêu cầu tư vấn; nó không tự duyệt trả, hoàn tiền hoặc tiếp nhận sửa chữa.

### 2.13. Tạo yêu cầu trả hàng — `/returns/new`

1. Mở đơn đã giao → **Request a return**, hoặc vào `/returns/new`.
2. Chọn **Order**; nếu không thấy đơn cũ, dùng **Find an older order** để về danh sách đơn và mở từ đơn cần tìm.
3. Chọn **Order item** và số lượng còn được phép yêu cầu.
4. Chọn lý do, mong muốn xử lý, nhập mô tả và ảnh nếu cần.
5. Bấm **Submit return request**.
6. Theo dõi hồ sơ `RT-…` trong **Your return requests** tại `/returns`.

| Trường | Cách nhập / ví dụ |
|---|---|
| Order item | Chọn đúng dòng đã mua; mỗi hồ sơ tạo cho một dòng hàng |
| Quantity | Số nguyên từ 1 đến lượng còn khả dụng; mua 2, đã yêu cầu 1 thì không tạo thêm yêu cầu cho cả 2 |
| Reason | Damaged or faulty item; Wrong item received; Item differs from description; Other reason for review |
| Preferred resolution | Request a refund hoặc Request an exchange; đây là mong muốn, chưa phải kết quả được duyệt |
| Details | 10–1.000 ký tự; ví dụ `Tai nghe bên trái không phát âm thanh, đã thử với hai thiết bị. Đề nghị kiểm tra và đổi.` |
| Private image | PNG/JPEG/WebP tối đa 1 MiB; không bắt buộc |

Điều kiện hệ thống kiểm tra gồm chủ đơn, trạng thái giao/xuất kho đã ghi nhận và lượng chưa được phân bổ vào hồ sơ trả khác. Đơn cũ thiếu bằng chứng giao/xuất kho có thể cần hỗ trợ xem xét.

Sau khi được duyệt:

1. Đọc **Return instructions for the customer**; chờ hướng dẫn trước khi gửi hàng.
2. Trước khi gửi, có thể chọn **Withdraw return request** nếu hành động còn được phép.
3. Khi đã gửi, chọn **Record goods sent back**, nhập ghi chú và mã tham chiếu/tracking được yêu cầu, xác nhận rồi ghi nhận.
4. Theo dõi các bước nhận, kiểm định và phương án xử lý.

Được duyệt gửi hàng về, đã nhận hàng hoặc đã nhập lại kho **chưa xác nhận đã hoàn tiền**.

### 2.14. Duyệt và nhận hàng đổi cùng giá

Khi admin đã đề nghị đổi, mở hồ sơ `/returns/<caseId>`:

1. Xem phần **Replacement exchange**: SKU, màu/phiên bản, giá gốc, số lượng và địa chỉ giao được lưu trong đề nghị.
2. Chọn **Accept this replacement** nếu đồng ý hoặc **Decline this replacement** nếu không đồng ý.
3. Nhập ghi chú tối thiểu 10 ký tự, đánh dấu xác nhận rồi gửi.
4. Nếu SKU/địa chỉ không đúng, liên hệ hỗ trợ trước khi duyệt; không mặc định sửa hồ sơ tài khoản sẽ sửa đề nghị đã lưu.
5. Sau khi admin ghi nhận gửi, xem hãng vận chuyển/tracking.
6. Chỉ chọn **Confirm replacement received** sau khi thực sự nhận và kiểm tra hàng; hoàn thành ghi chú/xác nhận trên form.

Khách có thể từ chối trước khi hàng đổi được gửi, kể cả đã đồng ý trước đó. Hàng đã gửi không còn là một lượng giữ kho có thể giải phóng bằng nút từ chối.

Nếu đề nghị bị thay đổi khi bạn đang mở form, phải chọn lại hành động và xác nhận bản mới. Luồng hiện chỉ hỗ trợ **cùng sản phẩm, cùng đơn giá gốc VND**, không phát sinh thu chênh lệch hoặc hoàn tiền tự động.

### 2.15. Thông báo — chuông trên header và `/notifications`

1. Bấm biểu tượng chuông để mở danh sách gần đây.
2. Chọn **All / Unread**.
3. Bấm liên kết trong thông báo để mở đơn, hội thoại, phiếu hỗ trợ hoặc hồ sơ đổi trả liên quan.
4. Dùng **Mark as read** cho một tin, **Mark all as read** cho loạt tin hiện có.
5. **View all notifications** mở lịch sử; **Older / Latest** để chuyển trang.

Trạng thái đã đọc được lưu theo tài khoản. Đọc hết tin cũ không làm những tin mới đến sau đó tự thành đã đọc. Thông báo trong app và email là hai kênh riêng.

### 2.16. Liên hệ, FAQ và chính sách

| Trang | Nội dung / hành động |
|---|---|
| `/help/contact` | Xem thông tin liên hệ đã xuất bản, gửi yêu cầu hỗ trợ, xem giờ hỗ trợ khi có |
| `/help/faq` | Mở từng câu hỏi để đọc câu trả lời |
| `/help/shipping` | Chính sách giao hàng và đường vào hỗ trợ/theo dõi đơn |
| `/help/returns` | Chính sách đổi trả và đường vào hồ sơ/yêu cầu |
| `/help/warranty` | Thông tin bảo hành; gửi câu hỏi gắn sản phẩm/đơn khi cần |

Footer dùng liên hệ/bản đồ đã xuất bản từ admin. Nếu không có bản xuất bản, không có dữ liệu liên hệ để hiện bản đồ. Nội dung bản nháp chưa hiển thị cho khách.

<a id="admin-map"></a>

## 3. Bản đồ chức năng trang admin

Đăng nhập bằng tài khoản ADMIN rồi mở `/admin`. Trên màn hình nhỏ, dùng nút mở điều hướng admin để xem các mục sidebar.

| Nhóm | Mục trên giao diện | Đường dẫn | Công việc chính |
|---|---|---|---|
| Overview | Dashboard | `/admin` | Tổng quan và các việc cần xem |
| Overview | Sales reports | `/admin/reports` | Báo cáo sản phẩm, biểu đồ, xuất CSV |
| Catalog | Products | `/admin/products` | Thêm/sửa sản phẩm và SKU |
| Catalog | Inventory | `/admin/inventory` | Khai báo tồn, nhập/xuất/kiểm kê |
| Catalog | Categories | `/admin/categories` | Danh mục và mẫu thông số |
| Catalog | Brands | `/admin/brands` | Thương hiệu |
| Orders & Payments | Orders | `/admin/orders` | Xem và xử lý đơn |
| Orders & Payments | COD follow-up | `/admin/cod` | Theo dõi thu tiền và tiền vận chuyển chuyển về |
| Orders & Payments | Shipments | `/admin/shipments` | Cập nhật giao hàng, phiếu đóng gói |
| Orders & Payments | Delivery settings | `/admin/shipping-settings` | Phí và vùng phục vụ |
| Orders & Payments | Payments | `/admin/payments` | Theo dõi các lần thanh toán online |
| Orders & Payments | Payment issues | `/admin/payment-exceptions` | Rà thanh toán trùng, muộn, sau giải phóng tồn |
| Orders & Payments | Refunds | `/admin/refunds` | Duyệt hủy đã thu tiền và theo dõi hoàn |
| Orders & Payments | Returns | `/admin/returns` | Tiếp nhận, kiểm định, nhập kho và đổi hàng |
| Orders & Payments | Support inbox | `/admin/support` | Chat và người nhận xử lý |
| Orders & Payments | Support requests | `/admin/support-requests` | Phiếu hỗ trợ và ghi chú nội bộ |
| Orders & Payments | Support hours | `/admin/support-hours` | Nháp/xuất bản giờ hỗ trợ |
| Orders & Payments | Customer service content | `/admin/customer-service` | Liên hệ, bản đồ, FAQ, chính sách |
| Orders & Payments | Notifications | `/admin/notifications` | Thông báo trong app của admin |
| Orders & Payments | Email delivery | `/admin/notifications/email` | Hàng đợi gửi email và thử lại |
| Accounts & Activity | User accounts | `/admin/users` | Tìm và khóa/mở tài khoản khách |
| Accounts & Activity | Activity log | `/admin/audit` | Xem nhật ký quản trị |
| Accounts & Activity | Operations | `/admin/operations` | Worker, cảnh báo, sự cố vận hành |
| Trang con vận hành | Online stock holds | `/admin/operations/holds` | Rà hàng giữ cho thanh toán online quá ngưỡng |

`Support inbox`, `Support requests`, `Returns` có mục đích riêng: **hội thoại**, **phiếu công việc**, **hồ sơ xử lý hàng**. Một hồ sơ trả hàng liên kết phiếu hỗ trợ và dùng chung hội thoại, không cần tạo một chat mới cho mỗi hồ sơ.

<a id="catalog"></a>

## 4. Tạo danh mục, thương hiệu, sản phẩm và tồn kho

### 4.1. Thứ tự nhập dữ liệu lần đầu

1. Tạo danh mục và mẫu thông số.
2. Tạo thương hiệu.
3. Tạo sản phẩm với ít nhất một SKU; có thể để Draft trong lúc hoàn thiện.
4. Lưu sản phẩm để có bản ghi SKU.
5. Vào Inventory ghi số kiểm kê đầu kỳ cho từng SKU.
6. Kiểm tra SKU được bật bán, trạng thái khả dụng và sản phẩm Active.
7. Mở trang khách để thử tìm sản phẩm, chọn SKU và thêm vào giỏ.

Tạo một sản phẩm Active **không tự sinh tồn kho**. Bật In stock cũng không tự nhập hàng.

### 4.2. Danh mục — `/admin/categories`

1. Nhập **Name**, kiểm tra **URL Slug** được gợi ý.
2. Chọn **Visible catalog group** nếu muốn sử dụng danh mục để bán hàng.
3. Nếu cần, thêm mẫu thông số theo mục tiếp theo.
4. Bấm **Create category**.
5. Khi sửa, bấm **Edit** trên dòng cần sửa → điều chỉnh → **Save changes**.

| Trường | Quy tắc | Ví dụ |
|---|---|---|
| Name | 2–80 ký tự | `Tai nghe Demo` |
| URL Slug | Tối đa 100 ký tự; chữ thường, số, dấu `-` | `tai-nghe-demo` |
| Visible catalog group | Bật để danh mục được sử dụng công khai theo điều kiện bán | Bật trong bài demo |

Slug phải không trùng với bản ghi khác cùng loại. Khi đã tự sửa slug, thay tên không buộc slug tự đổi theo. Dùng ô tìm kiếm, phân trang và nút Refresh để kiểm tra kết quả.

### 4.3. Mẫu thông số của danh mục

Trong form danh mục, chọn **Add specification field**, tối đa 20 trường.

| Trường cấu hình | Ý nghĩa | Ví dụ |
|---|---|---|
| Field key | Khóa dùng trong dữ liệu SKU; nên giữ ổn định | `CONNECTION` |
| Display label | Tên hiển thị cho người xem | `Kết nối` |
| Value type: Text | Nội dung tự do | `USB-C` |
| Value type: Number with optional unit | Giá trị số không âm, có thể gắn đơn vị | Key `BATTERY`, label `Thời lượng pin`, unit `h` |
| Value type: Selection | Chỉ chọn trong các giá trị đã khai báo | `Bluetooth`, `USB-C`, `3.5mm`, mỗi lựa chọn một dòng |

Ví dụ mẫu cho danh mục tai nghe:

| Field key | Display label | Type | Unit | Choices |
|---|---|---|---|---|
| `CONNECTION` | Kết nối | Selection | Để trống | `Bluetooth`, `USB-C`, `3.5mm` — nhập mỗi mục một dòng |
| `BATTERY` | Thời lượng pin | Number with optional unit | `h` | Để trống |
| `WEIGHT` | Khối lượng | Number with optional unit | `g` | Để trống |

Không dùng key trùng nhau chỉ khác hoa/thường/dấu. Key tối đa 60 ký tự, nhãn 80 ký tự. Trường Selection cần 1–30 lựa chọn không trùng, mỗi lựa chọn tối đa 100 ký tự; chỉ trường Number được có đơn vị. Nhập số thập phân bằng dấu chấm, tối đa 4 chữ số sau dấu chấm.

Thay đổi mẫu không xóa dữ liệu thông số cũ của SKU. Không đổi key tùy tiện chỉ để đổi tên hiển thị; hãy sửa Display label nếu chỉ đổi cách trình bày.

### 4.4. Thương hiệu — `/admin/brands`

Thao tác tương tự danh mục: nhập tên, slug, trạng thái Visible → **Create brand**; sửa bằng **Edit → Save changes**.

Ví dụ: Name `SGTech Demo`, slug `sgtech-demo`, Visible bật. Tìm tên trước khi tạo để tránh sinh nhiều thương hiệu giống nhau. Form sản phẩm cũng có **Add Brand Instantly** nếu cần thêm nhanh một thương hiệu mới.

### 4.5. Thêm sản phẩm — `/admin/products/new`

1. Vào Products → **Add product**.
2. Điền thông tin cơ bản, chọn danh mục và thương hiệu đã có.
3. Tạo các SKU theo mục 4.6.
4. Chọn trạng thái sản phẩm và lưu bằng nút của form.
5. Mở lại sản phẩm để kiểm tra dữ liệu đã lưu.

| Trường | Quy tắc | Ví dụ có thể điền theo |
|---|---|---|
| Product Name | 2–200 ký tự | `Tai nghe SGTech Demo` |
| URL Slug | Tối đa 150 ký tự, chữ thường không dấu/số/`-`, không trùng | `tai-nghe-sgtech-demo` |
| Detailed Description | 10–10.000 ký tự | `Sản phẩm mô phỏng phục vụ kiểm thử mua hàng và đổi SKU; không dùng làm thông tin thương mại thực tế.` |
| Category | Chọn danh mục đang có | `Tai nghe Demo` |
| Brand | Chọn thương hiệu đang có | `SGTech Demo` |
| Product status | Draft / Active / Archived | Bắt đầu `Draft`, hoàn thiện rồi chuyển `Active` |

| Trạng thái | Khi dùng |
|---|---|
| Draft | Đang nhập dữ liệu, chưa sẵn sàng bán |
| Active | Sẵn sàng xuất hiện theo các điều kiện danh mục/thương hiệu/SKU |
| Archived | Ngừng bán/lưu trữ; không coi là xóa lịch sử đơn |

Active cần danh mục và thương hiệu hiển thị, cùng ít nhất một SKU được Enable. Sản phẩm có thể tồn tại trong admin nhưng chưa có hàng mua được nếu tồn/khả dụng của SKU chưa đáp ứng.

### 4.6. Nhập SKU, giá, màu, ảnh, thông số và nội dung riêng

Mỗi sản phẩm có 1–20 SKU. Bấm **Add variant** để thêm phiên bản.

| Trường SKU | Quy tắc | Ví dụ SKU đen | Ví dụ SKU trắng |
|---|---|---|---|
| SKU Code | 2–80 ký tự, chữ HOA/số/`_`/`-`, không trùng | `SG-DEMO-BLK` | `SG-DEMO-WHT` |
| Variant name | 1–100 ký tự | `Đen Bluetooth` | `Trắng Bluetooth` |
| Price (VND) | Số nguyên > 0, tối đa 2.147.483.647 | `199000` | `199000` |
| Color Name | Có nội dung, tối đa 60 ký tự | `Đen` | `Trắng` |
| Color Code (Hex) | `#` + 6 ký tự HEX | `#111827` | `#FFFFFF` |
| Image Preview / URL | Ảnh hợp lệ và truy cập được | Upload ảnh đen rồi dùng URL trả về | Upload ảnh trắng rồi dùng URL trả về |
| Enable variant | Bật để SKU hoạt động | Bật | Bật |
| Catalog availability | Trạng thái In stock/Out of stock | In stock nếu dự định bán và đã nhập tồn | In stock nếu dự định bán và đã nhập tồn |

**Generate SKU** có thể giúp tạo mã; vẫn cần kiểm tra mã có ý nghĩa và không trùng. Không đổi mã SKU cũ để giả lập một món hàng hoàn toàn khác.

**Ảnh:** có thể dùng ảnh local dạng `/products/ten-anh.webp` khi file thực sự nằm trong `public/products`, hoặc URL HTTPS từ các host đang được cho phép: `res.cloudinary.com`, `firebasestorage.googleapis.com`, `m.media-amazon.com`, `images.unsplash.com`. Cách ít nhầm nhất là upload bằng nút trên form và giữ URL được trả về. Đường dẫn local mẫu không tự tạo ra file ảnh.

**Extra photos:** tối đa 8 ảnh bổ sung/SKU. Bấm **Add extra photo**, điền URL và Image description; dùng **Move up / Move down** đổi thứ tự, **Remove photo** bỏ ảnh. Không lặp cùng URL trong danh sách ảnh bổ sung.

**Thông số:** dùng các ô theo mẫu danh mục hoặc nhập trong Specifications, một cặp `Tên: giá trị` mỗi dòng:

```text
CONNECTION: Bluetooth
BATTERY: 20
WEIGHT: 180
```

Với mẫu mục 4.3, BATTERY/WEIGHT sẽ được chuẩn hóa cùng đơn vị. Nếu danh mục chưa có mẫu, có thể dùng tên thông số có nghĩa, ví dụ `Kết nối: Bluetooth`. Không nhập JSON vào ô này; không bỏ dấu `:`; không lặp tên thông số. Mỗi SKU tối đa 30 thông số, giá trị tối đa 500 ký tự.

**Warranty for this SKU** và **In the box:** mỗi ô tối đa 3.000 ký tự. Ví dụ dành riêng dữ liệu demo:

```text
Warranty for this SKU:
Thông tin mô phỏng cho bài demo. Điều kiện thực tế cần được cửa hàng xác nhận.

In the box:
1 tai nghe demo, 1 cáp USB-C, 1 tờ hướng dẫn mô phỏng.
```

Không đưa lời hứa bảo hành/thành phần hộp chưa kiểm tra vào dữ liệu cửa hàng thực tế. Nếu chưa có nội dung, để trống các trường tùy chọn thay vì viết dữ liệu đoán.

**Remove variant:** dùng để bỏ dòng chưa cần trong lúc nhập. Với SKU đã có lịch sử hoặc bị hệ thống từ chối xóa, dùng ngừng kích hoạt/ngừng bán theo điều kiện thay vì tìm cách xóa lịch sử.

### 4.7. Khai báo và điều chỉnh tồn — `/admin/inventory`

Tìm SKU → **View stock** mở `/admin/inventory/<variantId>`.

Ba con số cần hiểu:

| Chỉ số | Ý nghĩa |
|---|---|
| On hand | Số lượng tồn vật lý đang ghi nhận |
| Reserved | Phần đang giữ cho đơn hoặc đề nghị đổi hàng |
| Available | Lượng có thể bán/giữ mới = On hand − Reserved |

Ví dụ On hand `10`, Reserved `2` thì Available `8`. Không được kiểm kê xuống dưới 2 khi 2 món vẫn đang được giữ.

| Action | Ý nghĩa ô Quantity | Ví dụ |
|---|---|---|
| Opening count | Tổng kiểm đếm ban đầu, chỉ khi SKU chưa có sổ tồn | Nhập `10` nghĩa là tồn ban đầu 10 |
| Stock received | Số lượng nhập thêm | Đang 10, nhập `5` → On hand 15 |
| Stock removed | Số lượng lấy ra khỏi tồn vật lý | Đang 10, nhập `2` → On hand 8 nếu vẫn đủ cho Reserved |
| Physical recount | Tổng tồn mới sau kiểm kê, không phải chênh lệch | Đang 10, đếm được 8 thì nhập `8` |

Thao tác:

1. Chọn Action phù hợp, nhập số nguyên.
2. Nhập lý do 10–500 ký tự: `Kiểm kê đầu kỳ 10 tai nghe theo phiếu KK-DEMO-001.`
3. Đọc số trước/sau mà form thể hiện.
4. Đánh dấu xác nhận → **Record adjustment**.
5. Kiểm tra On hand/Reserved/Available và **Stock history**.

Nhập/xuất bổ sung phải lớn hơn 0; kiểm kê có thể bằng 0 nếu hợp lệ. Giới hạn số lượng hiện là 2.000.000.000. Nếu hệ thống báo bản ghi đã đổi, bấm **Reload latest stock**, kiểm tra lại rồi quyết định.

Lịch sử cũng ghi tự động các bước giữ/giải phóng/xuất hàng cho đơn, nhập lại hàng trả đã kiểm định, giữ/xuất SKU đổi. Không tự nhập bù lần nữa cho một bước hệ thống đã ghi.

<a id="orders-admin"></a>

## 5. Quản lý đơn, giao hàng, COD, thanh toán và hoàn tiền

### 5.1. Danh sách đơn và xem chi tiết

1. Mở `/admin/orders`.
2. Dùng tìm kiếm/bộ lọc trạng thái, phương thức thanh toán và ngày theo các trường đang có.
3. Mở đơn để xem `/admin/orders/<orderId>`.
4. Kiểm tra người mua, người nhận, SKU/số lượng/giá đã mua, tổng tiền, thanh toán, giao hàng, lịch sử và các phiếu liên quan.

Khi tìm bằng mã đơn, sao chép nguyên mã `SG-…` hoặc ID đầy đủ từ đơn thay vì chỉ nhớ vài ký tự cuối. Nếu chọn khoảng ngày, lưu ý các màn hình có ghi giờ Việt Nam; các bộ lọc khoảng ngày được giới hạn theo form, thường tối đa 366 ngày.

Ảnh/tên/giá trong chi tiết đơn lấy từ dữ liệu đã lưu của đơn. Sửa giá sản phẩm không sửa giá một đơn đã đặt.

### 5.2. Xác nhận hoặc từ chối COD; sửa người nhận; ghi chú

Trong **Order management and activity**, chỉ những hành động được phép theo trạng thái mới xuất hiện.

| Action | Cách thực hiện | Kết quả |
|---|---|---|
| Confirm order | Chọn, nhập lý do, xác nhận và ghi nhận | Đơn được chấp nhận cho bước chuẩn bị; COD vẫn chưa trả tiền |
| Decline COD order | Dùng cho COD chưa thanh toán còn đủ điều kiện, nêu lý do | Hủy đơn và giải phóng lượng đang giữ |
| Edit recipient / address | Sửa tên, số điện thoại, địa chỉ đường trước khi packing | Giữ vùng giao và tổng/phí đã chốt |
| Add note | Chọn loại ghi chú, nhập nội dung, lý do và xác nhận | Lưu vào lịch sử đơn |

Lý do thao tác cần 10–500 ký tự. Ví dụ: `Đã liên hệ xác nhận số điện thoại và phiên bản trước khi chuẩn bị đơn.`

Số điện thoại khi sửa người nhận nên dùng `0901234567` hoặc `+84901234567`; không nhập lời ghi chú vào ô điện thoại. Không dùng bước sửa đường để đổi tỉnh/huyện/xã hoặc âm thầm thay phí. Luồng đổi khu vực có duyệt phí mới chưa hoàn thiện.

Ghi chú có hai loại:

- **Admin only:** nội dung nội bộ, khách không thấy.
- **Visible to customer:** khách thấy trong lịch sử đơn.

Ví dụ ghi chú công khai: `Cửa hàng đã xác nhận thông tin người nhận và đang chuẩn bị hàng.` Ví dụ nội bộ: `Đối chiếu chứng từ thu tiền tại quầy số DEMO-RC-001.` Ghi chú đơn tối đa 2.000 ký tự; không đặt thông tin cần giữ riêng vào ghi chú công khai.

### 5.3. Giao hàng — `/admin/shipments`

1. Tìm đơn trong Shipments hoặc bấm **Manage shipment** từ chi tiết đơn.
2. Mở `/admin/shipments/<orderId>`.
3. Chọn **Delivery status** trong những lựa chọn được phép.
4. Điền hãng vận chuyển, tracking và ghi chú theo trạng thái.
5. Bấm **Save changes**; nếu thay trạng thái, đọc và xác nhận hộp **Confirm delivery update**.
6. Kiểm tra Shipment history và chi tiết đơn.

| Trường | Ví dụ dữ liệu demo | Khi cần |
|---|---|---|
| Delivery status | Preparing → Ready to ship → Shipped | Đi tuần tự theo lựa chọn form, không nhảy bằng sửa dữ liệu |
| Carrier | `Vận chuyển Demo` | Cần có thông tin khi ghi nhận đã gửi |
| Tracking number | `DEMO-SHIP-001` | Bắt buộc ở các trạng thái đã gửi/giao/thất bại/trả về |
| Delivery note | `Bàn giao 1 tai nghe theo biên bản demo lúc 14:30.` | Đặc biệt cần nêu lý do khi Delivery failed/Returned |

Luồng thông thường:

```text
Not shipped → Preparing → Ready to ship → Shipped → In transit → Delivered
```

Từ Shipped có thể ghi Delivered trực tiếp khi có bằng chứng; Delivery failed có thể quay lại In transit/Delivered hoặc chuyển Returned theo lựa chọn hệ thống. Delivered/Returned là điểm kết thúc của form giao hàng này.

Đơn cần được xác nhận và online cần được xác minh thu tiền trước khi chuẩn bị/gửi. COD chưa thu vẫn có thể giao sau khi được xác nhận theo quy tắc. Đơn đang có yêu cầu hủy/hoàn có thể bị khóa giao hàng.

**Khi Shipped:** hệ thống trừ tồn vật lý và lượng đã giữ của đơn. Không tự trừ thêm ở Inventory. Chuyển Delivery failed/Returned không phải thao tác kiểm định và nhập lại kho; xử lý hàng về bằng quy trình phù hợp.

**Packing slip:** mở liên kết ở chi tiết shipment → `/admin/shipments/<orderId>/packing-slip`, kiểm tra rồi in bằng chức năng trên trang/trình duyệt. Phiếu đóng gói không phải hóa đơn điện tử.

Giao hàng hiện là ghi nhận thủ công. Nhập carrier/tracking không tự đặt đơn với hãng vận chuyển và không tự chứng minh hàng đã giao.

### 5.4. Thu COD và nhận tiền vận chuyển chuyển về

Mở `/admin/cod` để xem hàng chờ thu/chờ tiền về. Danh sách có tìm người nhận, carrier/tracking, mã chứng từ hoặc ID đơn, bộ lọc giai đoạn và ngày. Vào chi tiết đơn, tìm **COD collection & store receipts**.

**Bước A — Record customer payment:**

1. Chọn **Collected by**: `Carrier` hoặc `Store directly`.
2. Nhập toàn bộ số tiền khách đã thanh toán đúng tổng đơn.
3. Điền mã chứng từ, thời điểm thực tế và ghi chú nếu cần.
4. Đánh dấu đã kiểm tra → **Record collection**.

| Trường | Ví dụ cho đơn tổng 214.000đ |
|---|---|
| Collected by | `Carrier` |
| Customer payment (VND) | `214000` |
| Receipt or remittance reference | `DEMO-COL-001` |
| Receipt time | Chọn thời điểm thực tế theo giờ Việt Nam |
| Internal note | `Biên nhận mô phỏng: khách đã trả đủ tiền cho người giao.` |

**Bước B — Record carrier remittance:** nếu người vận chuyển thu hộ, ghi nhận riêng khi cửa hàng thực sự nhận tiền:

| Trường | Ví dụ |
|---|---|
| Money received (VND) | `204000` |
| Carrier fee deducted (VND) | `10000` |
| Receipt or remittance reference | `DEMO-SET-001` |
| Receipt time | Thời điểm khoản tiền về cửa hàng |
| Internal note | `Đối chiếu bản kê COD mô phỏng, phí bị khấu trừ 10.000đ.` |

Ví dụ trên khớp `204000 + 10000 = 214000`. Phí hãng vận chuyển bị khấu trừ là dữ liệu đối soát; không tự thay phí giao đã tính cho khách. Chọn xác nhận rồi **Record store receipt**.

Nếu `Store directly` thu tiền thì chứng từ thu cũng xác nhận cửa hàng nhận tiền theo luồng hiện tại; không tạo thêm một chứng từ vận chuyển chuyển về cho cùng khoản.

Mã chứng từ cần 4–120 ký tự, ghi chú tối đa 1.000 ký tự; số tiền phải là số nguyên hợp lệ. Chứng từ đã ghi không sửa đè trên form này. Thu một phần/sửa bằng chứng từ điều chỉnh và import đối soát chưa đầy đủ; đừng ghi sai một khoản toàn phần để mô phỏng khoản thu một phần.

### 5.5. Theo dõi thanh toán online — `/admin/payments`

1. Chọn bộ lọc **Payment status**; có thể mở lịch sử theo đơn từ các liên kết ở trang khác.
2. Xem phương thức, số tiền, trạng thái lần thanh toán và trạng thái đơn riêng.
3. Chọn **View details** để xem lịch sử/chi tiết lần thanh toán.
4. Nếu được phép, bấm **Check payment** để truy vấn kết quả từ cổng.
5. Mở **View order** để đối chiếu kết quả đơn và tồn.

Một dòng payment là **một lần thanh toán**, không phải một đơn mới. Một đơn có thể có lịch sử nhiều lần thử. Kết quả pending/không rõ cần tiếp tục xác minh, không tự đổi Paid vì khách gửi ảnh QR hoặc vì đã quay về trang return.

### 5.6. Ngoại lệ thanh toán — `/admin/payment-exceptions`

Trang dành cho khoản trùng, tới muộn hoặc nhận tiền sau khi tồn đã được giải phóng.

1. Lọc trạng thái cần rà và mở **Review issue**.
2. Đối chiếu đơn, lần thanh toán và bằng chứng cổng sandbox.
3. Chọn **Reviewed** hoặc **Refund required** theo kết quả nghiệp vụ.
4. Nhập Review note tối thiểu 10 ký tự, ví dụ `Đã đối chiếu giao dịch sandbox, khoản này là lần thu trùng cần hoàn riêng.`
5. Lưu rồi theo dõi trong Refund follow-up nếu cần hoàn.

Quyết định Refund required chỉ ghi nhận việc cần xử lý, **không gửi lệnh chuyển tiền/hoàn tiền**. Luồng hoàn khoản thu ngoại lệ riêng vẫn cần đối soát theo nguồn, không gộp tùy tiện vào khoản thu chính của đơn.

### 5.7. Hủy đơn đã thu tiền và hoàn toàn phần — `/admin/refunds`

Trang Refunds có phần yêu cầu hủy đơn đã thanh toán và phần theo dõi khoản ngoại lệ cần hoàn; đọc đúng nhóm trước khi xử lý.

1. Trong **Paid-order cancellation requests**, chọn trạng thái rồi **Review order**.
2. Xem trạng thái giao; chỉ duyệt luồng này trước bàn giao vận chuyển.
3. Trong **Cancellation & refund**, chọn **Approve cancellation** hoặc **Decline cancellation**.
4. Nhập lý do 10–500 ký tự, kiểm tra và xác nhận.
5. Nếu được duyệt, đơn bị hủy và lượng đang giữ được giải phóng; khoản tiền đã thu vẫn còn trong lịch sử.
6. Với online, chọn **Submit full refund** khi nguồn thu và cấu hình sandbox đủ điều kiện.
7. Theo dõi bằng **Check refund status** đến khi có kết quả xác nhận.

| Nhãn/trạng thái | Ý nghĩa |
|---|---|
| Cancellation requested / REQUESTED | Khách xin hủy, chờ quyết định |
| APPROVED | Đã hủy, khoản hoàn còn chờ gửi |
| DECLINED | Không chấp nhận yêu cầu hủy |
| SENDING | Đã bắt đầu bước gửi, còn cần xác nhận kết quả |
| PROCESSING | Cổng đang xử lý |
| REVIEW | Chưa rõ hoặc cần người xử lý rà soát |
| SUCCEEDED / Refund confirmed | Đã có kết quả hoàn được xác nhận |

Nếu gửi hoàn bị timeout/mất phản hồi, dùng **Check refund status** trên khoản đã có. Không tạo yêu cầu mới/chứng từ mới để né trạng thái chưa rõ; đối chiếu cổng sandbox khi cần.

**COD đã thu tiền:** thực hiện trả tiền ngoài ứng dụng trước, sau đó dùng **Record COD refund receipt** để ghi mã chứng từ và thời gian thật. Ví dụ mã `DEMO-REF-001`, lý do `Đã đối chiếu chứng từ hoàn COD mô phỏng cho đơn hủy trước bàn giao.` Form ghi nhận bằng chứng; nó không tự chuyển khoản. Không dùng cách này để đánh dấu hoàn online thành công.

Luồng hiện hoàn **toàn phần cho hủy trước bàn giao**, gồm phí giao đã lưu theo đơn. Hoàn một phần hàng đã giao chưa được thực hiện bằng panel này.

### 5.8. Cấu hình phí và vùng giao — `/admin/shipping-settings`

1. Chọn **Accept deliveries** nếu nhận giao hàng.
2. Điền nhãn dịch vụ, phí và ngưỡng miễn phí.
3. Chọn toàn quốc hoặc nhập danh sách mã tỉnh phục vụ theo các mã từ danh sách checkout.
4. Nhập lý do thay đổi, hoàn thành xác nhận mà form yêu cầu rồi lưu.
5. Mở checkout lấy báo phí mới để kiểm tra.

| Trường | Ví dụ | Ý nghĩa |
|---|---|---|
| Delivery service label | `Giao hàng demo toàn quốc` | Nhãn để khách biết chính sách đang áp dụng |
| Delivery fee (VND) | `15000` | Số nguyên không âm |
| Free delivery from (VND) | `300000` | Xét tiền hàng trước phí; để trống nếu không có ngưỡng miễn phí |
| Serve all provinces and cities | Bật | Không cần tự điền mã tỉnh khi phục vụ toàn quốc |
| Served province codes | Chỉ điền khi giới hạn vùng | Chọn/đối chiếu mã nguồn hiện tại của checkout, không sao chép mã hành chính cũ theo trí nhớ |
| Reason for the change | `Thiết lập phí giao mô phỏng 15.000đ, miễn phí từ 300.000đ.` | Giải thích việc đổi cấu hình |

Thay cấu hình không sửa phí/tổng đơn cũ. Sửa văn bản trong Shipping policy cũng không sửa bảng phí này. Đây là phí do cửa hàng cấu hình; chưa phải báo giá tự động từ hãng vận chuyển.

<a id="support-admin"></a>

## 6. Chat, phiếu hỗ trợ, tiếp nhận trả hàng và đổi hàng

### 6.1. Support inbox — `/admin/support`

1. Mở inbox, lọc/tìm cuộc hội thoại cần xử lý.
2. Mở `/admin/support/<conversationId>`.
3. Bấm nút nhận xử lý hội thoại đang mở, thường là **Accept conversation**.
4. Đọc tin gần đây/ngữ cảnh sản phẩm hoặc đơn trước khi trả lời.
5. Nhập tin, đính kèm ảnh nếu cần và gửi.
6. Dùng **Release to inbox** để trả cuộc hội thoại về hàng chờ, **Close conversation** khi kết thúc hoặc **Reopen conversation** khi mở lại.

Admin phải nhận hội thoại trước khi trả lời/upload ảnh hoặc quản lý các nghiệp vụ yêu cầu quyền người phụ trách. Nếu admin khác đang xử lý, không ghi đè người đó; phối hợp để người đang nhận trả về inbox.

Tin nhắn/ảnh có cùng giới hạn như phần khách. Đóng hội thoại giữ lịch sử. Mở lại giải phóng phân công cũ; cần nhận xử lý lại khi thao tác yêu cầu.

### 6.2. Phiếu hỗ trợ — `/admin/support-requests`

1. Lọc phiếu theo trạng thái, mở phiếu `SR-…`.
2. Đọc loại yêu cầu, khách, ngữ cảnh và **Original request**.
3. Nếu báo chưa có quyền quản lý, nhận hội thoại chung bên dưới, sau đó **Refresh request**.
4. Chọn trạng thái tiếp theo trong **Request status**, điền nội dung/giải thích mà form yêu cầu và lưu.
5. Trao đổi với khách trong **Shared conversation**.
6. Lưu việc nội bộ tại **Internal request notes**, không gửi vào chat công khai.

| Trạng thái | Dùng khi |
|---|---|
| Open | Yêu cầu mới |
| In progress | Đã bắt đầu xử lý |
| Reply requested | Cần khách cung cấp thêm thông tin |
| Resolved | Đã có kết quả cho phiếu này |
| Closed | Đóng phiếu đã giải quyết |

Từ Resolved có thể mở lại In progress hoặc đóng Closed theo lựa chọn form; Closed không có bước mở lại trong luồng trạng thái phiếu hiện tại. Đừng nhầm nút Reopen conversation với mở lại phiếu Closed.

Nội dung Internal note tối đa 1.000 ký tự. Ví dụ: `Đã kiểm tra ảnh, cần đối chiếu mã SKU trên hộp trước khi duyệt đổi.` Chỉ admin thấy; ghi chú không tự gửi cho khách. Có phân trang ghi chú cũ/mới.

Giải quyết một phiếu không tự giải quyết tất cả yêu cầu khác của tài khoản. Tin chat chung cũng không tự thay trạng thái mọi phiếu.

### 6.3. Duyệt hồ sơ trả hàng — `/admin/returns`

1. Mở danh sách, lọc trạng thái hoặc theo đơn rồi chọn hồ sơ `RT-…`.
2. Kiểm tra dòng hàng, số lượng, lý do, ảnh, nguyện vọng và chính sách đã lưu theo đơn.
3. Nhận/mở lại hội thoại chung nếu cần, rồi **Refresh return**.
4. Trong **Record next step → Return action**, chọn một hành động đang được phép.
5. Nhập ghi chú công khai 10–1.000 ký tự, mã tham chiếu nếu bắt buộc và đánh dấu xác nhận.
6. Ghi nhận bằng nút của form, kiểm tra Return history.

| Hành động | Khi dùng | Dữ liệu phải chuẩn bị |
|---|---|---|
| Accept return and give instructions | Đồng ý cho khách gửi hàng về | Hướng dẫn địa điểm/cách gửi/đóng gói đã được cửa hàng xác nhận |
| Decline return request | Không chấp thuận yêu cầu | Lý do đủ rõ để khách biết kết quả |
| Record goods received | Đã nhận hàng thực tế | Mã biên nhận và mô tả số lượng/tình trạng nhận |
| Inspect as suitable for stock | Đã kiểm định, hàng phù hợp để đưa về tồn bán | Kết quả kiểm định |
| Inspect as unsuitable for stock | Hàng cần xử lý riêng, không đủ điều kiện đưa vào tồn bán | Lỗi/tình trạng và hướng xử lý cần xem xét |
| Add inspected goods to stock | Hàng đã kiểm định phù hợp và thực sự nhập về tồn bán | Xác nhận số lượng, chứng từ theo form |
| Record goods returned to customer | Gửi lại chính hàng đó cho khách theo quyết định xử lý | Bằng chứng/tracking và ghi chú |

Ví dụ ghi chú duyệt: `Đồng ý tiếp nhận kiểm tra 1 tai nghe. Vui lòng đóng gói đủ phụ kiện và liên hệ trước khi gửi về điểm tiếp nhận đã xác nhận trong hội thoại.` Không tự dùng địa chỉ demo để hướng dẫn khách thật gửi hàng.

Ví dụ nhận hàng: reference `DEMO-RT-RECEIVE-001`, note `Đã nhận đủ 1 tai nghe theo biên bản mô phỏng; hộp ngoài có dấu mở, chờ kiểm định.`

Ví dụ kiểm định: `Đã kiểm tra lại kết nối, hai bên phát âm thanh bình thường, phụ kiện đủ; phù hợp đưa về tồn bán trong bài demo.` Chỉ ghi kết quả tương ứng kiểm tra thực tế.

**Nhận hàng và kiểm định không tự tăng tồn.** Phải dùng Add inspected goods to stock sau bước phù hợp. Hàng đánh giá không phù hợp luôn nằm ngoài tồn bán. Không đồng thời nhập tay Inventory cho chính bước đã restock qua hồ sơ trả.

Tất cả ghi chú/lịch sử hồ sơ trả hàng khách đều có thể xem. Nội dung riêng phải đặt ở Internal request notes trong phiếu liên kết.

### 6.4. Đọc trạng thái trả hàng

| Trạng thái | Nghĩa |
|---|---|
| REQUESTED | Chờ xem xét |
| AWAITING_RETURN | Đã cho phép gửi hàng về |
| IN_TRANSIT | Khách ghi nhận đã gửi hàng về |
| RECEIVED | Cửa hàng đã nhận, chờ kiểm định |
| INSPECTED_RESTOCKABLE | Đã kiểm định, phù hợp nhập lại tồn |
| INSPECTED_OTHER | Đã kiểm định, cần phương án khác |
| RESTOCKED | Đã nhập lại tồn, kết quả xử lý còn chờ |
| RETURNED_TO_CUSTOMER | Đã gửi hàng lại khách |
| REJECTED | Từ chối yêu cầu |
| WITHDRAWN | Khách rút yêu cầu |
| EXCHANGED | Đổi hàng hoàn tất |

Không đọc RESTOCKED là đã hoàn tiền hoặc đã đổi xong.

### 6.5. Đề nghị đổi SKU cùng sản phẩm, cùng giá

Điều kiện trước khi làm:

- Hồ sơ ở **RESTOCKED** hoặc **INSPECTED_OTHER**.
- Nếu hàng phù hợp nhập kho, phải restock trước khi đề nghị đổi.
- SKU thay thế thuộc cùng sản phẩm, đang hoạt động/hiển thị, giá bằng **đơn giá gốc của dòng đã mua**, đủ Available cho lượng đổi.
- Đơn gốc có đủ thông tin người nhận/địa chỉ; người phụ trách đã nhận hội thoại.

Các bước:

1. Chọn **Reserve a replacement for approval**.
2. Chọn **Replacement SKU** trong danh sách hệ thống cho phép; dùng **Refresh replacement choices** nếu cần.
3. Kiểm tra lượng đổi và nơi giao; lượng đổi bằng lượng của hồ sơ, không tự điền thêm số lượng tùy ý.
4. Nhập ghi chú, xác nhận và ghi nhận.
5. Kiểm tra phần **Replacement exchange**; trạng thái **OFFERED** nghĩa là đã giữ hàng, đang chờ khách duyệt.
6. Chờ khách **Accept this replacement**; khi **ACCEPTED** mới được gửi.
7. Chọn **Record replacement dispatch**, nhập carrier, tracking và ghi chú bàn giao; xác nhận.
8. Hệ thống chuyển **SHIPPED**, trừ On hand và Reserved của SKU thay thế.
9. Khách xác nhận đã nhận, hoặc admin chọn **Record replacement delivery evidence** và nhập bằng chứng/tham chiếu giao hàng thực tế.
10. Khi delivery được xác nhận, hồ sơ thành **EXCHANGED**, phiếu hỗ trợ liên kết được resolve; các phiếu khác và hội thoại vẫn còn.

Ví dụ note đề nghị: `Đề nghị đổi 1 SKU SG-DEMO-WHT cùng sản phẩm, đơn giá gốc 199.000đ; nhờ khách kiểm tra màu và địa chỉ.` Ví dụ tracking gửi đổi `DEMO-EX-SHIP-001`, biên nhận giao `DEMO-EX-DELIVER-001`.

**Release replacement reservation:** dùng trước khi gửi để hủy giữ SKU đề nghị. Nếu cần đổi đề nghị, giải phóng đề nghị hiện tại rồi kiểm tra thông tin nguồn và tạo đề nghị mới. Không có hết hạn tự động; phải theo dõi các lượng giữ đang chờ.

Không dùng Release cho hàng đã SHIPPED. Các ngoại lệ thất lạc/giao thất bại/hàng đổi bị trả và hậu mãi tiếp theo chưa có đủ luồng riêng.

Đổi cùng giá không đổi sản phẩm/tổng tiền/thanh toán gốc của đơn, không tự tạo thêm một khoản thu hay hoàn. Nếu giá SKU hiện khác giá gốc, không sửa giá đơn cũ để ép qua điều kiện.

<a id="content-admin"></a>

## 7. Liên hệ, bản đồ, FAQ, chính sách và giờ hỗ trợ

### 7.1. Nguyên tắc nháp → lưu → xuất bản

Mở `/admin/customer-service`:

1. Chọn **Edit section** để chọn Contact details, trang chính sách hoặc FAQ.
2. Sửa nội dung; các phần nằm trong cùng một bộ nội dung xuất bản.
3. Mở **Preview draft · not published** để kiểm tra.
4. Bấm **Save content draft**.
5. Chờ thông báo `Draft saved. Public information has not changed.`
6. Nếu không sửa thêm gì, bấm **Publish saved content**.
7. Chờ xác nhận xuất bản, mở lại trang khách và tải lại khi cần.

| Tình trạng | Vì sao / làm gì |
|---|---|
| Form có thông tin nhưng chưa từng lưu | Có thể là mẫu điền sẵn; phải Save trước |
| Save đang sáng, Publish mờ | Form có thay đổi chưa lưu hoặc chưa có bản nháp lưu trên server |
| Publish đã sáng | Đã có draft lưu và form không còn khác draft; đọc lại trước khi bấm |
| Đã Save rồi sửa thêm | Save lại trước khi Publish |
| Báo nội dung không hợp lệ | Kiểm tra cả các tab FAQ/chính sách, không chỉ Contact đang nhìn |
| Báo nội dung đã thay đổi ở nơi khác | Dùng Reload saved content, đối chiếu với bản mới rồi làm lại |

Nội dung công khai chỉ lấy từ **bản đã Publish**. Push Git/deploy không tự Save/Publish dữ liệu quản trị.

### 7.2. Nhập thông tin liên hệ và bản đồ

Trong **Contact details**:

| Trường | Quy tắc | Ví dụ |
|---|---|---|
| Store name | Bắt buộc 2–80 ký tự | `SGTech` |
| Contact phone | Có thể trống; tối đa 25 ký tự, định dạng điện thoại | `19002004` là thông tin mẫu đang có, cần kiểm tra trước khi dùng thật |
| Contact email | Có thể trống, đúng định dạng, tối đa 200 ký tự | Dùng email hỗ trợ mà cửa hàng thực sự quản lý |
| Store address | Có thể trống, tối đa 300 ký tự | Mẫu hiện có: `387 Bình Thành, Quận Bình Tân, TP. Hồ Chí Minh`; phải xác nhận địa chỉ thực tế |
| Zalo URL | Có thể trống; HTTPS `zalo.me`, không query/hash | Dạng `https://zalo.me/your-id`, thay bằng link đúng của bạn |
| Map embed URL | Có thể trống, tối đa 3.000 ký tự; URL nhúng Google Maps được cho phép | Dạng `https://www.google.com/maps/embed?pb=...` |

**Cách lấy link bản đồ để nhập:**

1. Mở địa điểm cần hiển thị trong Google Maps.
2. Dùng mục chia sẻ/nhúng bản đồ mà giao diện Google Maps cung cấp.
3. Nếu nhận một đoạn `<iframe ...>`, chỉ sao chép giá trị URL trong thuộc tính `src`.
4. Dán URL vào **Map embed URL**, không dán nguyên thẻ iframe.
5. Link phải có host `www.google.com`, đường dẫn `/maps/embed` và tham số `pb` không trống.
6. Preview → Save → Publish → kiểm tra footer.

Link chia sẻ ngắn `maps.app.goo.gl/...`, link tìm kiếm Maps và nguyên HTML iframe không hợp lệ cho ô này. Chuỗi `...` trong ví dụ chỉ mô tả định dạng; phải dùng toàn bộ link nhúng thực tế hoặc link có sẵn đã kiểm tra.

Để ẩn một kênh, xóa giá trị trường đó rồi Save/Publish. Bản đồ bị ẩn nếu chưa có map URL đã xuất bản. Nếu chỉ có địa chỉ mà không có map URL, có thể hiện địa chỉ mà không có iframe.

### 7.3. Nhập trang Contact/Shipping/Returns/Warranty

| Trường | Quy tắc | Ví dụ dành cho bản demo |
|---|---|---|
| Title | 2–80 ký tự | `Returns & exchanges` |
| Introduction | 1–500 ký tự | `Liên hệ đội hỗ trợ để xem xét phương án xử lý cho đơn đã mua.` |
| Section title | 2–100 ký tự | `Trước khi gửi hàng` |
| Section text | 1–1.500 ký tự | `Tạo hồ sơ từ đơn đủ điều kiện và chờ hướng dẫn trước khi gửi hàng về.` |

Mỗi trang cần 1–6 section. Sử dụng nút thêm/bỏ section của form, điền đủ nội dung cho mọi section còn giữ. Văn bản hiển thị dưới dạng chữ; không nhập HTML/JavaScript để tạo giao diện.

Sửa Shipping policy không sửa phí giao; phí nằm ở Delivery settings. Văn bản bảo hành không tự tạo luồng sửa chữa. Không công bố thời hạn trả hàng/ETA/thời gian phản hồi chưa được cửa hàng xác nhận.

### 7.4. Nhập FAQ

1. Chọn tab FAQ; điền tiêu đề, giới thiệu.
2. Thêm câu hỏi bằng **Add FAQ**, nhập câu trả lời, keywords và liên kết được hỗ trợ.
3. Bỏ mục không dùng; không giữ dòng mới trống.
4. Preview → Save → Publish.

| Trường | Quy tắc | Ví dụ |
|---|---|---|
| FAQ title | 2–80 ký tự | `Câu hỏi thường gặp` |
| FAQ introduction | 1–500 ký tự | `Hướng dẫn nhanh khi mua hàng và theo dõi đơn.` |
| Question | 5–120 ký tự; không trùng câu khác khi bỏ qua hoa/thường | `Tôi xem trạng thái đơn hàng ở đâu?` |
| Answer | 1–1.200 ký tự | `Đăng nhập, mở Your Orders và chọn đơn để xem thanh toán cùng giao hàng.` |
| Keywords | Tối đa 6 từ/cụm từ, mỗi mục 1–40 ký tự | `đơn hàng, theo dõi đơn, order` — nhập theo ô Keywords của form |
| Link | Chọn từ danh sách được cho phép | `/orders` |

Cần 1–20 câu FAQ. Liên kết chọn trong các trang hỗ trợ sẵn có, không dán tùy ý link ngoài vào trường Link. FAQ đã xuất bản được dùng ở trang FAQ và câu trả lời nhanh; không phải tin do admin đang chat trực tiếp.

### 7.5. Xem lịch sử và phục hồi nội dung

1. Trong **Published history**, chuyển trang nếu cần.
2. Bấm **Review revision** để xem một bản; thao tác xem không tự ghi đè form đang sửa.
3. Nếu cần dùng lại, bấm **Use reviewed revision as draft**.
4. Kiểm tra bản nháp được phục hồi, chỉnh nếu cần rồi Save/Publish theo trạng thái form.
5. Lần xuất bản tiếp theo tạo một bản mới, không sửa đè lịch sử cũ.

Đơn đã đặt giữ chính sách lúc tạo đơn khi có snapshot. Phục hồi/xuất bản nội dung mới không sửa chính sách trên đơn cũ. Quote checkout chưa dùng có thể phải lấy lại sau khi xuất bản.

### 7.6. Nhập và xuất bản giờ hỗ trợ — `/admin/support-hours`

1. Mở **Draft weekly schedule**.
2. Với từng ngày trong đủ 7 ngày, bật nếu làm việc; điền **From / Until**.
3. Nhập **Support message**.
4. Mở **Draft preview · not published** để kiểm tra.
5. Bấm **Save hours draft** → chờ lưu → **Publish saved hours**.
6. Kiểm tra trang trợ giúp/widget và giờ đã công bố.

Ví dụ lịch **mô phỏng** để thực hành:

| Ngày | Bật hỗ trợ | From | Until |
|---|---|---|---|
| Thứ hai đến thứ sáu | Có | `09:00` | `17:00` |
| Thứ bảy | Có | `09:00` | `12:00` |
| Chủ nhật | Không | Không áp dụng | Không áp dụng |

Ví dụ Support message: `Lịch mô phỏng giờ Việt Nam. Tin ngoài giờ vẫn được lưu, thời điểm phản hồi tùy đội hỗ trợ.`

Support message bắt buộc và tối đa 300 ký tự. Với ngày nghỉ, tắt ngày nhưng giữ nguyên From/Until mặc định hợp lệ trong form; dữ liệu của cả 7 ngày vẫn cần giờ đúng định dạng, không xóa thành chuỗi trống.

Múi giờ cố định Việt Nam UTC+7. Mỗi ngày có một khoảng cùng ngày, giờ bắt đầu phải trước giờ kết thúc. Không nhập `22:00–02:00` vào một ngày; chưa hỗ trợ ca qua đêm, nhiều ca hoặc lịch nghỉ lễ. Chưa xuất bản lịch thì bản hiện tại ẩn dòng thông báo chưa cấu hình đã được yêu cầu bỏ.

Xuất bản giờ hỗ trợ là thao tác riêng với xuất bản liên hệ/FAQ/chính sách. Lịch không chặn khách gửi tin và không tự bật trạng thái nhân viên online.

<a id="operations-admin"></a>

## 8. Báo cáo, tài khoản, thông báo, nhật ký và vận hành

### 8.1. Dashboard — `/admin`

1. Xem các ô tổng quan và nhóm **Needs attention**.
2. Bấm Pending orders, Payments to check, Open payment issues để mở đúng danh sách cần làm.
3. Xem biểu đồ và sản phẩm bán chạy; dùng liên kết sang Sales reports khi cần chọn kỳ cụ thể.
4. Refresh để tải dữ liệu hiện tại.

Các số tổng hợp có cơ sở tính riêng. Chẳng hạn tổng thanh toán online xác nhận không phải tiền cổng đã chuyển về tài khoản ngân hàng, doanh thu không phải lợi nhuận và chưa phải báo cáo thu ròng sau hoàn.

### 8.2. Báo cáo bán sản phẩm và xuất CSV — `/admin/reports`

1. Chọn **Period**: Monthly, Quarterly, Yearly, Custom date range hoặc All time.
2. Điền năm/tháng/quý hoặc From/To khi phù hợp.
3. Chọn cách xếp hạng theo lựa chọn có trên form, ví dụ số lượng/doanh thu.
4. Bấm nút áp dụng bộ lọc, xem số sản phẩm, số lượng và doanh thu cùng biểu đồ/bảng.
5. Chuyển trang nếu có nhiều dòng.
6. Bấm **Export CSV** để tải báo cáo theo bộ lọc đã áp dụng.

Ví dụ Custom: From `01/10/2026`, To `16/10/2026`. Khoảng tùy chọn 1–366 ngày, ngày kết thúc tính trong khoảng. Muốn CSV phản ánh lựa chọn mới phải Apply trước, không chỉ sửa ô lọc.

CSV giới hạn tối đa 5.000 sản phẩm cho kỳ xuất; nếu vượt, thu hẹp kỳ. Đây là xuất báo cáo, không phải công cụ nhập sản phẩm hàng loạt. Số liệu dựa trên nghiệp vụ đã ghi của hệ thống, chưa phải sổ dòng tiền/lợi nhuận sau mọi phí/hoàn.

### 8.3. Quản lý tài khoản — `/admin/users`

1. Tìm khách bằng tên/email, mở hoặc đối chiếu đúng dòng tài khoản.
2. Chọn **Block account** để khóa hoặc **Unblock account** để mở.
3. Đọc thông tin trong hộp xác nhận rồi xác nhận.
4. Kiểm tra trạng thái mới.

Khóa tài khoản sẽ thu hồi các phiên đang hoạt động. Mở lại cho phép đăng nhập mới nhưng không phục hồi phiên cũ đã thu hồi. Tài khoản ADMIN được bảo vệ khỏi thao tác khóa thông thường trên màn hình này.

Trang không có chức năng xóa sạch dữ liệu giao dịch của khách hoặc tự cấp quyền nhân viên chi tiết. Không tạo bản ghi email/password mới ở đây để thay thế quy trình đăng ký/cấp quyền.

### 8.4. Thông báo admin — `/admin/notifications`

Thao tác All/Unread, Refresh, Mark as read, Mark all as read, phân trang tương tự phần khách, nhưng đây là inbox dành cho sự kiện quản trị. Mở liên kết để xử lý đúng đơn/hội thoại/hồ sơ; đánh dấu đọc không thay thế việc xử lý nghiệp vụ.

### 8.5. Hàng đợi email — `/admin/notifications/email`

1. Chọn **Show deliveries**, lọc All states hoặc trạng thái cần xem.
2. Xem lần chạy email gần nhất, trạng thái từng bản ghi và thông tin lỗi đã được rút gọn.
3. Nếu bản ghi đủ điều kiện, mở **Review and retry email**.
4. Nhập lý do 10–500 ký tự, ví dụ `Đã khắc phục cấu hình sender và xác nhận địa chỉ người nhận trước khi xếp hàng gửi lại.`
5. Với UNKNOWN, kiểm tra bằng chứng và chọn ô **Confirm possible duplicate email** trước khi **Queue another attempt**.
6. Refresh để theo dõi kết quả worker; bấm retry chỉ xếp hàng, không gửi tức thì.

| Trạng thái | Cách hiểu |
|---|---|
| PENDING | Đã xếp hàng |
| SENDING | Worker đang xử lý |
| RETRY | Chờ lần thử theo backoff |
| SENT | SMTP đã chấp nhận thư; chưa chứng minh người nhận đã đọc hoặc thư vào Inbox |
| FAILED | Dừng do lỗi cần xem xét |
| SKIPPED | Không có người nhận đủ điều kiện |
| UNKNOWN | Kết quả không chắc chắn, có khả năng đã gửi |

Chỉ tài khoản đang hoạt động, email đủ điều kiện và đã xác minh mới nhận email sự kiện. Mặc định gửi email sự kiện đang tắt; người phụ trách kỹ thuật cần cấu hình sender, bật gửi và vận hành worker. Bật/tắt sender không được thực hiện chỉ bằng việc Publish contact email.

Manual retry hiện giới hạn 10 lần/admin/24 giờ và chỉ áp dụng các trạng thái FAILED/UNKNOWN/SKIPPED đủ điều kiện. Không bấm retry nhiều lần để kiểm tra xem khách có nhận hay chưa. Email quên mật khẩu/xác minh có luồng riêng với email sự kiện đơn.

### 8.6. Nhật ký — `/admin/audit`

1. Bấm Refresh và dùng phân trang để tìm thời điểm/người thao tác; bản hiện tại chưa có bộ lọc tìm kiếm chi tiết trên trang nhật ký.
2. Mở chi tiết thay đổi khi có để kiểm tra dữ liệu trước/sau và thời điểm.
3. Đối chiếu với đơn/SKU/hồ sơ liên quan khi có tranh chấp hoặc lỗi.

Nhật ký dùng để xem và đối chiếu, không phải nơi chỉnh trực tiếp nghiệp vụ. **Completed/SUCCEEDED của một hành động không mặc định nghĩa thanh toán đã Paid hoặc khoản hoàn đã về khách.** Xem kết quả tiền trong phần tương ứng.

### 8.7. Operations — `/admin/operations`

1. Xem **Last payment job**, Result, Started và Last successful completion.
2. Rà số việc cần xem xét và **Recent incidents**.
3. Bấm **Review details** để tới hàng giữ/giao dịch cần kiểm tra.
4. Ghi lại **Incident reference** nếu cần nhờ kỹ thuật tra log.

Heartbeat cũ hoặc health báo lỗi cần được kiểm tra. Không sửa đơn Paid/Failed hoặc bỏ giữ hàng chỉ để trang hết cảnh báo. Các nút Refresh đọc lại dữ liệu; đây không phải nút triển khai code hay sao lưu database.

### 8.8. Online stock holds — `/admin/operations/holds`

Trang hiển thị lượng giữ cho thanh toán online quá một giờ để rà soát; một giờ là **ngưỡng cần xem**, không tự là thời hạn hủy giao dịch.

1. Mở bản ghi, đọc lý do và hướng dẫn recovery của nó.
2. Xem **Payment history** và đơn liên quan.
3. Nếu có quyền/đủ điều kiện, dùng thao tác kiểm tra lại thanh toán.
4. Với yêu cầu Stripe chuẩn bị bị gián đoạn, nếu hiện hành động recovery: nhập lý do ít nhất 10 ký tự, đọc hộp xác nhận rồi khôi phục tham chiếu gốc.
5. Refresh và đối chiếu lại đơn/giữ kho.

Recovery Stripe giữ lại lượng đang giữ, không xác nhận thu tiền và không tạo một lần thu mới. Công cụ này từ chối recovery ngoài cửa sổ 23 giờ; trường hợp cũ hơn cần đối chiếu sandbox với kỹ thuật.

Đối với cổng khác, việc giải phóng phụ thuộc kết quả đóng/thất bại đã xác minh và điều kiện của cổng. Không suy thất bại chỉ từ tuổi bản ghi, timeout hoặc việc khách đóng tab.

<a id="demo-data"></a>

## 9. Thực hành cầm tay chỉ việc — làm theo như đang nhập trên website

Đây là phần dành cho **người mới sử dụng lần đầu**. Bạn có thể bắt đầu tại đây, thực hiện theo thứ tự và quay lại các chương trước khi muốn tra giới hạn dữ liệu.

Các mẫu form bên dưới là **bản minh họa đã điền**, không phải ảnh chụp hoặc bằng chứng rằng dữ liệu này đã được tạo trên website của bạn. Bạn thực hiện từng thao tác để tạo dữ liệu trong môi trường mình chọn. Những đoạn trong khung `text` là nội dung mẫu, không phải lệnh cần chạy.

**Chọn bài để mở nhanh:**

| Bài | Mở hướng dẫn |
|---|---|
| 9.1 | [Chuẩn bị trước khi bấm nút đầu tiên](#bai-01) |
| 9.2 | [ADMIN — đăng nhập và nhận diện trang quản trị](#bai-02) |
| 9.3 | [ADMIN — tạo danh mục, điền đầy đủ mẫu thông số](#bai-03) |
| 9.4 | [ADMIN — tạo thương hiệu](#bai-04) |
| 9.5 | [ADMIN — điền sản phẩm với hai SKU, từng ô một](#bai-05) |
| 9.6 | [ADMIN — nhập tồn đầu kỳ và bật sản phẩm để bán](#bai-06) |
| 9.7 | [ADMIN — đặt phí giao để phép tính bài mẫu khớp](#bai-07) |
| 9.8 | [ADMIN — nhập liên hệ và bản đồ, Save rồi Publish](#bai-08) |
| 9.9 | [ADMIN — nhập mẫu chính sách, FAQ và giờ hỗ trợ](#bai-09) |
| 9.10 | [KHÁCH — đăng ký, đăng nhập và điền hồ sơ](#bai-10) |
| 9.11 | [KHÁCH — tìm sản phẩm, chọn đúng SKU, thử giỏ](#bai-11) |
| 9.12 | [KHÁCH — đặt 1 đơn COD với mẫu form hoàn chỉnh](#bai-12) |
| 9.13 | [ADMIN — mở đúng đơn, xác nhận, ghi chú và sửa người nhận](#bai-13) |
| 9.14 | [ADMIN — chuẩn bị, gửi, in phiếu và ghi nhận đã giao](#bai-14) |
| 9.15 | [ADMIN — ghi chứng từ thu COD và nhận tiền về cửa hàng](#bai-15) |
| 9.16 | [KHÁCH và ADMIN — tạo phiếu, nhận chat, trả lời và ghi chú riêng](#bai-16) |
| 9.17 | [KHÁCH — tạo hồ sơ trả 1 SKU đen](#bai-17) |
| 9.18 | [ADMIN — duyệt trả; KHÁCH — ghi gửi hàng về](#bai-18) |
| 9.19 | [ADMIN — nhận, kiểm định và nhập lại tồn](#bai-19) |
| 9.20 | [ADMIN đề nghị đổi → KHÁCH duyệt → ADMIN gửi → KHÁCH nhận](#bai-20) |
| 9.21 | [Bảng đối chiếu bài chính — tự kiểm tra mình đã làm đúng](#bai-21) |
| 9.22 | [Bài riêng — thanh toán online và hủy/hoàn trước bàn giao](#bai-22) |
| 9.23 | [Bài riêng — rà Payment issues và Refund follow-up](#bai-23) |
| 9.24 | [KHÁCH và ADMIN — đọc thông báo, lọc và đánh dấu](#bai-24) |
| 9.25 | [ADMIN — chạy một báo cáo và tải CSV](#bai-25) |
| 9.26 | [ADMIN — khóa/mở một tài khoản và xem nhật ký](#bai-26) |
| 9.27 | [ADMIN — xem Email delivery và xếp hàng thử lại](#bai-27) |
| 9.28 | [ADMIN — xem Operations và Online stock holds](#bai-28) |
| 9.29 | [KHÁCH — đổi mật khẩu, email, quên mật khẩu và đăng xuất](#bai-29) |
| 9.30 | [Bảng kiểm kết thúc — biết mình đang dừng ở đâu](#bai-30) |

<a id="bai-01"></a>

### 9.1. Chuẩn bị trước khi bấm nút đầu tiên

**Mục tiêu bài chính:** admin tạo một sản phẩm có hai SKU, khách mua 1 món COD, admin giao và ghi tiền, sau đó khách gửi trả và được đổi sang SKU còn lại. Các bài bổ sung hướng dẫn các chức năng khác.

#### Bước 1 — chọn đúng website

1. Mở trình duyệt.
2. Bấm vào thanh địa chỉ ở phía trên, không phải ô Search products của website.
3. Nhập `https://e-commerce-orcin-one-32.vercel.app` rồi nhấn Enter nếu thực hành trên Vercel. Nếu thực hành local, thay bằng địa chỉ ứng dụng local đang chạy.
4. Trong toàn bộ bài, dùng cùng một địa chỉ gốc. Không tạo sản phẩm ở local rồi đi tìm sản phẩm đó ở một Vercel dùng database khác.

#### Bước 2 — tách cửa sổ admin và khách

1. Dùng cửa sổ thường cho ADMIN.
2. Mở thêm một cửa sổ ẩn danh hoặc một hồ sơ trình duyệt khác cho USER.
3. Trên cửa sổ thứ hai, mở lại cùng website.
4. Từ đây, cụm **CỬA SỔ ADMIN** và **CỬA SỔ KHÁCH** trong bài chỉ hai cửa sổ này. Mở hai tab trong cùng cửa sổ thường vẫn có thể dùng chung tài khoản.

#### Bước 3 — chuẩn bị tài khoản

- Admin: dùng tài khoản đã được cấp ADMIN. Nếu chưa có, cần người quản lý dự án cấp quyền; tài liệu không có một email/mật khẩu admin dùng chung.
- Khách: dùng một tài khoản riêng, hoặc đăng ký ở bài 9.10.
- Khi cần nhận email: dùng hộp thư thật bạn đang quản lý. Địa chỉ có đuôi `example.test` chỉ là ví dụ định dạng.

#### Bước 4 — hiểu thao tác nhập trong bài

- **Thay nội dung ô:** bấm vào ô → nhấn `Ctrl+A` khi con trỏ đang ở trong ô → gõ/dán giá trị mới. `Ctrl+A` ngoài ô nhập có thể chọn cả trang.
- **Chọn dropdown:** bấm ô có mũi tên → bấm đúng lựa chọn. Không gõ chữ thay thế nếu đó là danh sách chọn.
- **Bật checkbox:** ô có dấu tích là bật. Nếu đã tích thì giữ nguyên; không bấm thêm làm nó tắt.
- **Ô dài nhiều dòng:** dán nguyên đoạn mô tả; xuống dòng bằng Enter khi cần.
- **Chờ lưu:** sau khi bấm, đợi nút hết trạng thái Saving/Recording/Processing và xem thông báo. Nếu có lỗi, dừng ở bước đó để sửa.
- **Khối đang gập:** bấm tiêu đề của khối để mở ra. Cuộn trang xuống nếu chưa thấy các ô được nhắc đến.

#### Bước 5 — ghi lại các mốc

Tạo một ghi chú cá nhân để điền sau mỗi bài:

```text
Website đang thực hành:
Email admin của tôi:
Email khách của tôi:
Tên sản phẩm: Tai nghe SGTech Demo
Slug sản phẩm: tai-nghe-sgtech-demo
SKU đen: SG-DEMO-BLK
SKU trắng: SG-DEMO-WHT
Số đơn COD: chép sau khi đặt, bắt đầu SG-...
Mã phiếu hỗ trợ: chép sau khi tạo, bắt đầu SR-...
Mã hồ sơ đổi trả: chép sau khi tạo, bắt đầu RT-...
```

Không ghi mật khẩu vào file ghi chú dùng chung. Không nhập nguyên chuỗi `chép sau khi tạo` hay `SG-...` vào form; đó là vị trí để bạn lưu mã hệ thống thực sự cấp.

**Quy tắc lặp lại bài:** nếu slug hoặc SKU đã tồn tại, mở lại đúng bản ghi để dùng tiếp. Nếu muốn một bộ hoàn toàn mới, thêm cùng hậu tố, chẳng hạn `-02`, vào tên/slug/SKU và dùng nhất quán cho mọi bước sau. Không chạy lại các bước nhập kho/thu tiền cho bản ghi đã hoàn tất mà không kiểm tra lịch sử.

<a id="bai-02"></a>

### 9.2. ADMIN — đăng nhập và nhận diện trang quản trị

**Điểm bắt đầu:** CỬA SỔ ADMIN đang ở trang chủ, chưa đăng nhập.

1. Bấm ảnh tròn hoặc biểu tượng tài khoản ở góc phải header.
2. Bấm **Login**. Cách khác: nhập đường dẫn `/login` trên cùng website.
3. Điền form:

```text
Email or Username: [điền email admin của chính bạn]
Password:          [điền mật khẩu của chính bạn]
Remember my email: có thể bật trên máy cá nhân
```

4. Bấm **Login**, chờ đăng nhập.
5. Bấm lại menu tài khoản → **Admin page**. Có thể mở trực tiếp `/admin`.
6. Nhìn sidebar: phải có **Dashboard, Products, Inventory, Categories, Brands, Orders…**. Trên màn hình nhỏ, bấm nút menu admin ở header để mở sidebar.

**Bạn đã làm đúng khi:** địa chỉ có `/admin` và bạn thấy nội dung quản trị. Trang chủ có banner và giỏ hàng vẫn là khu vực mua hàng, kể cả tài khoản bạn đang đăng nhập là ADMIN.

**Nếu không có Admin page hoặc bị đưa về trang chủ:** kiểm tra đúng email có quyền ADMIN. Không tiếp tục nhập dữ liệu quản trị bằng một tài khoản USER.

<a id="bai-03"></a>

### 9.3. ADMIN — tạo danh mục, điền đầy đủ mẫu thông số

**Điểm bắt đầu:** đã ở khu vực admin.

#### A. Nhập danh mục

1. Trong sidebar, tìm nhóm **Catalog**.
2. Bấm **Categories**. Kiểm tra địa chỉ `/admin/categories`.
3. Nhìn khung **Add New Category**. Nếu đang thấy Edit Category của một bản ghi khác, bấm **Cancel** ở form để về chế độ thêm mới.
4. Bấm ô **Name**, nhập `Tai nghe Demo`.
5. Bấm ô **URL Slug**, thay toàn bộ bằng `tai-nghe-demo`.
6. Kiểm tra **Visible catalog group** có dấu tích.
7. Chưa bấm Create category; tiếp tục khai báo ba thông số bên dưới.

#### B. Thông số thứ nhất: kiểu kết nối

1. Kéo xuống phần **Specification template**.
2. Bấm **Add specification field** một lần.
3. Tại khối vừa xuất hiện, nhập:

```text
Field key:     CONNECTION
Display label: Kết nối
Value type:    Selection
```

4. Sau khi chọn Selection, ô **Choices (one per line, up to 30)** hiện ra. Dán đúng ba dòng sau, không thêm một dòng trống cuối:

```text
Bluetooth
USB-C
3.5mm
```

#### C. Thông số thứ hai: thời lượng pin

1. Bấm **Add specification field** thêm một lần.
2. Trong khối thứ hai, nhập/chọn:

```text
Field key:     BATTERY
Display label: Thời lượng pin
Value type:    Number with optional unit
Unit:          h
```

#### D. Thông số thứ ba: khối lượng

1. Bấm **Add specification field** thêm một lần.
2. Trong khối thứ ba, nhập/chọn:

```text
Field key:     WEIGHT
Display label: Khối lượng
Value type:    Number with optional unit
Unit:          g
```

#### E. Kiểm tra và lưu

Form lúc này phải tương đương:

```text
Add New Category
  Name:                  Tai nghe Demo
  URL Slug:              tai-nghe-demo
  Visible catalog group: [x]

Specification template (3/20)
  CONNECTION | Kết nối        | Selection                 | 3 lựa chọn
  BATTERY    | Thời lượng pin | Number with optional unit | h
  WEIGHT     | Khối lượng     | Number with optional unit | g

[Create category]
```

1. Bấm **Create category**.
2. Chờ lưu, tìm dòng `Tai nghe Demo` trong bảng danh mục; dùng ô tìm kiếm nếu danh sách dài.
3. Bấm **Edit** ở dòng vừa tạo để kiểm tra lại ba thông số đã lưu. Bấm Cancel nếu chỉ kiểm tra và không muốn sửa tiếp.

**Bạn đã làm đúng khi:** danh mục có slug đúng, Visible bật và template có 3 trường. Nếu báo trùng slug, kiểm tra bản ghi đã có thay vì bấm Create lặp lại.

<a id="bai-04"></a>

### 9.4. ADMIN — tạo thương hiệu

1. Bấm **Brands** trong sidebar → `/admin/brands`.
2. Tìm khung **Add New Brand**.
3. Điền:

```text
Name:                  SGTech Demo
URL Slug:              sgtech-demo
Visible catalog group: [x]
```

4. Bấm **Create brand**.
5. Chờ lưu; tìm dòng SGTech Demo trong danh sách.

**Bạn đã làm đúng khi:** có thương hiệu SGTech Demo và không bị ẩn. Đến đây bạn đã có đủ điều kiện danh mục/thương hiệu để mở form tạo sản phẩm.

<a id="bai-05"></a>

### 9.5. ADMIN — điền sản phẩm với hai SKU, từng ô một

#### A. Mở form và nhập phần chung

1. Bấm **Products** trong sidebar.
2. Bấm **Add product**. Kiểm tra địa chỉ `/admin/products/new`.
3. Ở **Basic information**, nhập:

```text
Product Name *: Tai nghe SGTech Demo
URL Slug *:     tai-nghe-sgtech-demo
```

4. Trong **Detailed Description**, dán nguyên đoạn:

```text
Sản phẩm mô phỏng phục vụ thực hành quản lý cửa hàng SGTech.
Sản phẩm có hai SKU để thử đặt hàng, giao COD và đổi hàng cùng giá.
Dữ liệu, giá và điều kiện trong bài này không dùng làm cam kết thương mại thực tế.
```

5. Tìm **Product status**, chọn **Draft**.
6. Tìm **Category**, chọn **Tai nghe Demo**.
7. Tìm **Brand**, chọn **SGTech Demo**. Các khối này có thể nằm bên phải trên desktop và phía dưới trên điện thoại.

**Nếu không thấy danh mục/thương hiệu:** kiểm tra đã lưu ở bài 9.3/9.4, chúng đang Visible và bạn đang cùng môi trường. Không gõ tên vào một ô không phải lựa chọn của dropdown để thay thế.

#### B. Nhập SKU đầu tiên: màu đen

1. Tìm **Variants & SKUs**.
2. Nếu đã có khối **Variant 1**, dùng ngay khối đó; không bấm Add variant chỉ để tạo lại SKU đầu tiên.
3. Nếu khối đang gập, bấm dòng tiêu đề Variant 1 để mở.
4. Nhập lần lượt:

```text
SKU Code *:         SG-DEMO-BLK
Variant name *:     Đen Bluetooth
Price (VND) *:      199000
Color Name *:       Đen
Color Code (Hex) *: #111827
```

5. Ở **Image Preview**, bấm ô URL ảnh và nhập:

```text
/products/jbl-tune720bt-black.webp
```

Đây là ảnh minh họa đã có trong repository hiện tại. Sau khi dán, nhìn vùng ảnh xem ảnh đã hiện chưa. Nếu website đang dùng một bản không có file này, dùng **Click to upload** với ảnh của bạn và chờ URL được điền về ô.

6. Tại các trường thông số của danh mục, chọn/nhập:

```text
Kết nối:         Bluetooth
Thời lượng pin: 20
Khối lượng:      180
```

Nếu đang dùng ô nhập thông số nhiều dòng thay vì ba ô riêng, dán:

```text
CONNECTION: Bluetooth
BATTERY: 20
WEIGHT: 180
```

Hai cách cùng biểu diễn một bộ dữ liệu; không cần nhân đôi thông số. Với ô số đã có đơn vị `h` hoặc `g` bên cạnh, chỉ nhập `20`/`180`.

7. Kiểm tra **Catalog availability** và **Enable variant** đều có dấu tích.
8. Mở phần nội dung SKU khi đang thu gọn, điền **Warranty for this SKU**:

```text
Thông tin bảo hành mô phỏng để kiểm tra giao diện. Điều kiện thực tế cần được cửa hàng xác nhận trước khi áp dụng.
```

9. Điền **In the box**:

```text
1 tai nghe demo
1 cáp USB-C minh họa
1 tờ hướng dẫn mô phỏng
```

10. Phần **Extra photos** có thể để 0 ảnh ở bài đầu. Không bấm Add extra photo rồi bỏ trống một dòng ảnh vừa thêm.

#### C. Nhập SKU thứ hai: màu trắng

1. Bấm **Add variant** đúng một lần.
2. Trong khối mới, nhập:

```text
SKU Code *:         SG-DEMO-WHT
Variant name *:     Trắng Bluetooth
Price (VND) *:      199000
Color Name *:       Trắng
Color Code (Hex) *: #FFFFFF
Image Preview:     /products/jbl-tune720bt-black.webp
Kết nối:           Bluetooth
Thời lượng pin:   20
Khối lượng:        180
Catalog availability: [x]
Enable variant:       [x]
```

Trong bài mô phỏng này, hai SKU dùng chung một ảnh đen có sẵn để bạn điền được ngay mà không phụ thuộc dịch vụ upload. Ảnh này **không minh họa đúng màu trắng**. Khi chuẩn bị catalog thực, thay ảnh SKU trắng bằng ảnh đúng màu; tên SKU và mã màu không tự đổi màu tấm ảnh.

3. Điền Warranty for this SKU và In the box tương tự SKU đen.
4. Kiểm tra bộ đếm Variants & SKUs là `2/20`, không có một Variant 3 đang trống.

#### D. Lưu sản phẩm

1. Kiểm tra lại hai giá đều `199000`, không phải `199` hoặc `199.000`.
2. Kiểm tra Category/Brand đã được chọn và status đang Draft.
3. Bấm **Save changes** trên thanh đầu form. Nút tạo sản phẩm mới cũng mang tên Save changes.
4. Chờ lưu; ứng dụng có thể điều hướng về danh sách.
5. Trong Products, tìm `Tai nghe SGTech Demo`, mở lại bằng liên kết sửa sản phẩm.
6. Mở hai khối SKU, kiểm tra hai mã đã lưu đúng.

**Bạn đã làm đúng khi:** sản phẩm tồn tại, có 2 SKU và mỗi SKU hiện link **Manage stock →**. Nếu thấy `Not counted`, đó là chưa nhập tồn — sẽ làm ở bài kế tiếp, không phải lỗi giá.

#### E. Thực hành thêm ảnh phụ nếu muốn

1. Mở Edit product của sản phẩm này, mở SKU đen.
2. Kéo đến Extra photos, bấm **Add extra photo**.
3. Nhập URL ảnh có thật, ví dụ `/products/sony-wh1000xm5-black.webp`, làm ảnh minh họa thứ hai trong bài demo.
4. Ô **Image description**, nhập `Ảnh minh họa bổ sung cho bài thực hành`.
5. Bấm **Save changes**.
6. Sau khi sản phẩm được Active, phía khách mở ảnh bổ sung để kiểm tra. Đây là ảnh sản phẩm khác dùng minh họa; catalog thật cần bộ ảnh đúng sản phẩm.

#### F. Thêm nhanh một thương hiệu ngay trong form sản phẩm

Đây là bài tùy chọn. Bài chính vẫn dùng SGTech Demo để giữ dữ liệu nhất quán.

1. Trong Add/Edit product, tìm khối **Brand**.
2. Bấm **+ Add New** ở góc khối hoặc chọn **+ Add New Brand…** trong dropdown Brand.
3. Khối Add Brand Instantly hiện ra; ô New brand name nhập `SGTech Thử Nhanh` nếu chưa có.
4. Bấm **Create** ngay trong khối thương hiệu, không nhầm với Save changes của sản phẩm.
5. Đợi thương hiệu được tạo/chọn. Nếu không muốn tiếp tục nhập thương hiệu, bấm Cancel của riêng khối đó trước khi Create.
6. Muốn giữ bài chính đúng mẫu, chọn lại **SGTech Demo** ở Brand trước khi Save changes sản phẩm.
7. Vào Brands để kiểm tra thương hiệu tạo nhanh nếu bạn đã bấm Create. Tạo thương hiệu là một lần lưu riêng; không tự mất chỉ vì sau đó bạn hủy form sản phẩm.

#### G. Sửa giá hoặc ngừng bán sau khi hoàn tất bài chính

1. Vào Products → mở đúng sản phẩm → mở đúng khối SKU.
2. Muốn sửa giá, thay Price (VND), ví dụ `209000`, rồi Save changes. Mở phía khách để kiểm tra giá mới; đơn cũ giữ giá đã mua. Chỉ thử sau bài đổi cùng giá, vì đổi giá có thể làm SKU không còn đủ điều kiện đề nghị đổi theo giá gốc.
3. Muốn tạm dừng một SKU, bỏ tích Catalog availability hoặc ngừng Enable theo mục đích rồi Save changes. Không sửa On hand thành 0 nếu thực tế vẫn còn hàng chỉ để dừng bán.
4. Muốn ngừng cả sản phẩm, đổi Product status sang **Archived**, Save changes, kiểm tra không còn bán như sản phẩm Active. Các đơn cũ vẫn giữ lịch sử.
5. Muốn bán lại sau bài mô phỏng, sửa trạng thái/Enable/khả dụng đúng thực tế, Save changes và kiểm tra Available. Không tạo một sản phẩm trùng slug để thay thế sản phẩm cũ.

<a id="bai-06"></a>

### 9.6. ADMIN — nhập tồn đầu kỳ và bật sản phẩm để bán

#### A. Khai báo 10 món SKU đen

1. Trong sidebar, bấm **Inventory** → `/admin/inventory`.
2. Ô **Search product, variant or SKU**, nhập `SG-DEMO-BLK`.
3. Để Count status là **All SKUs**, bấm **Apply filters**.
4. Đối chiếu dòng kết quả có đúng SKU SG-DEMO-BLK, bấm **View stock**.
5. Nếu thấy On hand/Reserved/Available là **Not counted**, đi tiếp. Nếu đã có số tồn, đọc lịch sử trước; không dùng Opening count lần thứ hai.
6. Trong **Record opening count**, điền:

```text
Adjustment type:           Opening count
Counted units (new total): 10
Reason / document reference:
Kiểm kê đầu kỳ 10 tai nghe đen theo phiếu KK-DEMO-001.

[x] I have checked the physical quantity and the reason for this adjustment.
```

7. Trước khi đánh dấu xác nhận, đọc phần xem trước: tổng mới 10, Available sau chỉnh 10 nếu chưa có giữ hàng.
8. Tích xác nhận → bấm **Record adjustment**.
9. Chờ lưu, nhìn ba ô phía trên: `On hand 10 / Reserved 0 / Available 10`.
10. Kéo xuống Stock history, tìm bước Opening count vừa tạo.

#### B. Khai báo 6 món SKU trắng

1. Bấm **Back to inventory** hoặc Inventory ở sidebar.
2. Đổi ô tìm kiếm thành `SG-DEMO-WHT` → Apply filters → View stock đúng dòng.
3. Điền:

```text
Adjustment type:           Opening count
Counted units (new total): 6
Reason / document reference:
Kiểm kê đầu kỳ 6 tai nghe trắng theo phiếu KK-DEMO-002.

[x] I have checked the physical quantity and the reason for this adjustment.
```

4. Bấm Record adjustment, kiểm tra `6 / 0 / 6` và lịch sử.

#### C. Chuyển sản phẩm Active

1. Bấm Products, tìm Tai nghe SGTech Demo, mở Edit product.
2. Kiểm tra hai SKU vẫn được Enable và Catalog availability bật.
3. Tại Product status, đổi **Draft → Active**.
4. Bấm Save changes, chờ lưu.
5. Chuyển sang CỬA SỔ KHÁCH, mở `/products`, tìm tên sản phẩm.

**Bạn đã làm đúng khi:** phía khách thấy sản phẩm và chọn mua được. Nếu không, kiểm tra lần lượt Active → danh mục Visible → thương hiệu Visible → Enable SKU → Catalog availability → Available.

#### D. Nhập thêm/xuất bớt/kiểm kê là ba cách nhập khác nhau

Phần này là bài riêng, **không làm trên hai SKU chính trước khi chạy bài mua hàng** nếu bạn muốn các số đối chiếu sau đó giữ nguyên. Có thể dùng một SKU demo khác hoặc thực hành sau khi hoàn tất bài chính.

Giả sử SKU bạn chọn đang On hand 10, Reserved 0:

| Lần | Chọn Adjustment type | Ô Quantity hiện tên | Nhập | Lý do mẫu | Tổng sau lưu |
|---|---|---|---|---|---|
| 1 | Stock received | Units to add | `5` | `Nhập bổ sung 5 món theo phiếu NK-DEMO-003.` | 15 |
| 2 | Stock removed | Units to remove | `2` | `Đưa 2 món ra khỏi tồn theo phiếu XK-DEMO-004.` | 13 |
| 3 | Physical recount | Counted units (new total) | `12` | `Kiểm kê lại thực tế còn 12 món theo phiếu KK-DEMO-005.` | 12 |

Với **mỗi lần**, chọn loại → nhập số → nhập lý do → đọc tổng trước/sau → tích xác nhận → Record adjustment → kiểm tra lịch sử. Ở lần 3, `12` là tổng mới, không phải nhập thêm 12.

<a id="bai-07"></a>

### 9.7. ADMIN — đặt phí giao để phép tính bài mẫu khớp

**Điều kiện:** bạn được phép thay cấu hình phí của môi trường demo đang dùng. Nếu đang xem một môi trường chia sẻ mà không muốn thay phí, giữ cấu hình hiện có và dùng tổng thực tế trên checkout ở các bài sau.

1. Bấm **Delivery settings** trong sidebar → `/admin/shipping-settings`.
2. Đợi form tải, điền:

```text
Accept deliveries:             [x]
Delivery service label:        Giao hàng demo toàn quốc
Delivery fee (VND):            15000
Free delivery from (VND):      300000
Serve all provinces and cities:[x]
Served province codes:         không cần nhập khi chọn toàn quốc
Reason for the change:
Thiết lập bài thực hành demo: phí giao 15.000đ, miễn phí từ tiền hàng 300.000đ.
```

3. Bấm **Save delivery settings**, chờ thông báo thành công.
4. Mở lại trang để kiểm tra phí vẫn `15000`, ngưỡng `300000`.

**Bạn đã làm đúng khi:** checkout mới tính đơn 1 tai nghe giá 199.000đ thành tổng 214.000đ. Thay cấu hình này không sửa các đơn cũ đã tạo.

<a id="bai-08"></a>

### 9.8. ADMIN — nhập liên hệ và bản đồ, Save rồi Publish

#### A. Điền Contact details

1. Trong sidebar, bấm **Customer service content** → `/admin/customer-service`.
2. Đợi hết Loading customer service content.
3. Trong **Edit section**, chọn **Contact details**.
4. Điền mẫu dưới đây cho môi trường demo:

```text
Store name:     SGTech
Contact phone:  19002004
Contact email:  sgtech@gmail.com
Store address:  387 Bình Thành, Quận Bình Tân, TP. Hồ Chí Minh
Zalo URL:       để trống trong bài đầu
```

Đây là thông tin mẫu hiện có trong dự án; cần xác nhận lại quyền sử dụng/sự chính xác trước khi công bố như thông tin cửa hàng thực tế. Bài này không gửi email hay tin nhắn đến những địa chỉ/số liên hệ đó.

5. Bấm ô **Map embed URL** và dán **nguyên một dòng** sau:

```text
https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3919.1239976004895!2d106.58435777451757!3d10.801813958726004!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x31752b83ee842e07%3A0x2acdb55560c394d0!2zMzg3LCA1NyBCw6xuaCBUaMOgbmgsIEtodSBQaOG7kSA1LCBCw6xuaCBUw6JuLCBI4buTIENow60gTWluaCwgVmnhu4d0IE5hbQ!5e0!3m2!1svi!2s!4v1780799335446!5m2!1svi!2s
```

Đây là link nhúng đầy đủ từ dữ liệu mẫu của dự án, không phải chuỗi rút gọn có `...`. Nếu bạn muốn một địa điểm khác, thay bằng URL nhúng đã kiểm tra của địa điểm đó; không dán nguyên thẻ iframe.

#### B. Xem trước và lưu

1. Kéo xuống **Preview draft · not published**, bấm dòng tiêu đề để mở.
2. Đọc số điện thoại/email/địa chỉ trong preview; kiểm tra không có dữ liệu của một cửa hàng khác bị nhập nhầm.
3. Bấm **Save content draft** ở dưới phần preview.
4. Chờ thông báo ở đầu trang: **Draft saved. Public information has not changed.** Nếu chưa thấy, kéo lên đầu trang xem lỗi.
5. Sau thông báo lưu, không sửa thêm một ký tự nào trong form.
6. Kéo lại xuống, bấm **Publish saved content**.
7. Chờ thông báo có nội dung **Customer service information published** và một bản mới trong **Published history**.

#### C. Kiểm tra như khách

1. Sang CỬA SỔ KHÁCH, mở trang chủ rồi tải lại bằng `Ctrl+R`.
2. Kéo tới cuối trang.
3. Tìm phần vị trí/bản đồ và liên hệ.
4. Kiểm tra số, email và địa chỉ khớp với bản vừa xuất bản.
5. Mở `/help/contact`, đối chiếu tiếp nội dung liên hệ.

**Nếu Publish vẫn mờ:** form chưa Save thành công, hoặc bạn vừa sửa sau khi Save. Save lại → chờ xác nhận → Publish. Nếu Save báo lỗi, xem cả các tab chính sách và FAQ vì toàn bộ nội dung được lưu cùng một bộ.

<a id="bai-09"></a>

### 9.9. ADMIN — nhập mẫu chính sách, FAQ và giờ hỗ trợ

#### A. Sửa một trang chính sách bằng mẫu hoàn chỉnh

1. Vẫn ở Customer service content, đổi Edit section thành **Returns policy**.
2. Điền hai trường đầu:

```text
Page title:   Hướng dẫn đổi trả cho bài demo
Introduction: Tạo hồ sơ từ đơn đã giao để đội hỗ trợ xem xét trước khi gửi hàng về.
```

3. Ở section đầu tiên, điền:

```text
Section heading: Trước khi gửi hàng
Section text:    Mở chi tiết đơn, chọn Request a return, mô tả vấn đề và chờ đội hỗ trợ hướng dẫn. Không gửi hàng chỉ dựa vào việc đã tạo yêu cầu.
```

4. Với section thứ hai đã có, thay bằng:

```text
Section heading: Kết quả xử lý
Section text:    Việc nhận hoặc kiểm định hàng chưa xác nhận đã hoàn tiền. Kết quả đổi hàng và thanh toán được theo dõi riêng trong hồ sơ và đơn.
```

5. Nếu chỉ có một section và bạn muốn thêm section thứ hai, bấm **Add section** một lần rồi nhập. Nếu có các section khác từ bản có sẵn, đọc/giữ nội dung hợp lệ hoặc bấm Remove section tương ứng; không để một khối đang trống.
6. Mở Preview, đọc trang Returns.
7. Save content draft → đợi lưu → Publish saved content.
8. Sang khách, mở `/help/returns`, kiểm tra tiêu đề và hai mục vừa nhập.

Các tab Contact page, Shipping policy, Warranty policy dùng cùng thao tác Page title → Introduction → Section heading/text → Preview → Save → Publish. Không dùng nội dung Returns thay cho nội dung của mọi trang; từng trang cần dữ liệu đúng chủ đề.

**Mẫu nhập đủ hai section cho ba trang còn lại:** nếu muốn thực hành luôn, chọn lần lượt đúng Edit section và thay từng ô theo mẫu tương ứng. Nếu trang có hơn hai section, giữ nội dung hợp lệ của phần còn lại hoặc bỏ bằng Remove section; không để một section trống.

Chọn **Contact page**, điền:

```text
Page title:        Liên hệ SGTech Demo
Introduction:      Gửi yêu cầu để đội hỗ trợ kiểm tra sản phẩm hoặc đơn hàng trong bài thực hành.
Section heading 1: Hỏi về sản phẩm
Section text 1:    Mở sản phẩm cần hỏi, chọn mục hỗ trợ để giữ đúng ngữ cảnh phiên bản.
Section heading 2: Hỏi về đơn hàng
Section text 2:    Đăng nhập, mở đơn đã mua và chọn Ask about this order. Theo dõi phản hồi tại yêu cầu hỗ trợ của bạn.
```

Chọn **Shipping policy**, điền:

```text
Page title:        Giao hàng trong bài demo
Introduction:      Kiểm tra địa chỉ và báo phí trên checkout trước khi đặt đơn.
Section heading 1: Phí giao hàng
Section text 1:    Phí áp dụng theo Delivery settings và báo phí của đơn. Xem Total trước khi xác nhận thanh toán.
Section heading 2: Tiến trình giao
Section text 2:    Mở Your Orders để xem hãng vận chuyển, mã theo dõi và trạng thái được cửa hàng ghi nhận. Bài demo không cam kết thời gian giao thực tế.
```

Chọn **Warranty policy**, điền:

```text
Page title:        Thông tin bảo hành demo
Introduction:      Nội dung mô phỏng, cần đội hỗ trợ xác nhận điều kiện áp dụng cho sản phẩm thực tế.
Section heading 1: Kiểm tra điều kiện
Section text 1:    Xem thông tin bảo hành của đúng SKU đã mua và phiên bản chính sách được lưu với đơn nếu có.
Section heading 2: Gửi câu hỏi
Section text 2:    Chọn Ask about warranty tại sản phẩm hoặc tạo phiếu Warranty enquiry. Phiếu hỏi chưa phải hồ sơ tiếp nhận sửa chữa.
```

Sau khi nhập xong các tab muốn sửa: mở Preview → **Save content draft** → chờ thông báo lưu → **Publish saved content**. Sang khách mở lần lượt `/help/contact`, `/help/shipping`, `/help/warranty` để kiểm tra. Một lần Publish áp dụng cả bộ nội dung đã lưu, không chỉ tab đang mở.

#### B. Thêm một câu FAQ mẫu

1. Trong Edit section, chọn **Frequently asked questions**.
2. Giữ các câu hợp lệ đã có. Kéo xuống bấm **+ Add FAQ**.
3. Ở khối mới cuối danh sách, điền:

```text
Question: Tôi xem trạng thái đơn demo ở đâu?
Answer:   Đăng nhập vào tài khoản mua hàng, mở Your Orders rồi bấm vào đơn để xem thanh toán và giao hàng.
Quick-answer keywords: đơn demo, theo dõi đơn, trạng thái đơn
Link:     /orders
```

4. Keywords nhập trong **một ô**, phân cách bằng dấu phẩy, không thêm dấu phẩy cuối. Link chọn từ dropdown `/orders`.
5. Nếu FAQ page title hoặc Introduction đang trống, nhập `Câu hỏi thường gặp` và `Hướng dẫn nhanh khi thực hành mua hàng tại SGTech.`
6. Preview → Save content draft → đợi lưu → Publish saved content.
7. Sang khách mở `/help/faq`, bấm câu hỏi vừa thêm để thấy câu trả lời.

**Nếu không Save được:** câu mới không được trùng câu đã có, Answer không để trống và Keywords không có một mục rỗng do dấu phẩy cuối.

#### C. Xem lịch sử và phục hồi bản cũ

1. Trên trang Customer service content, kéo xuống Published history.
2. Chọn **Review revision** ở một bản cũ, đọc phần nội dung được mở.
3. Chỉ xem thì dừng ở đây; xem không tự xuất bản lại bản cũ.
4. Muốn dùng bản này làm nền, bấm **Use reviewed revision as draft**.
5. Đọc lại toàn bộ dữ liệu vừa phục hồi, sửa nếu cần.
6. Nếu đã sửa thì Save content draft, chờ lưu; sau đó Publish saved content.
7. Kiểm tra lịch sử có bản mới. Bản cũ vẫn được giữ.

#### D. Điền lịch hỗ trợ một tuần

1. Bấm **Support hours** trên sidebar → `/admin/support-hours`.
2. Nhìn đủ 7 dòng ngày. Sunday là chủ nhật, Monday là thứ hai.
3. Điền từng dòng theo bảng:

| Dòng trên form | Checkbox | From | Until |
|---|---|---|---|
| Sunday | Bỏ tích | `09:00` | `17:00` — giữ hợp lệ dù ngày tắt |
| Monday | Tích | `09:00` | `17:00` |
| Tuesday | Tích | `09:00` | `17:00` |
| Wednesday | Tích | `09:00` | `17:00` |
| Thursday | Tích | `09:00` | `17:00` |
| Friday | Tích | `09:00` | `17:00` |
| Saturday | Tích | `09:00` | `12:00` |

4. Trong **Support message**, dán:

```text
Lịch hỗ trợ mô phỏng theo giờ Việt Nam. Tin ngoài giờ vẫn được lưu; thời điểm phản hồi tùy đội hỗ trợ.
```

5. Đọc **Draft preview · not published**.
6. Bấm **Save hours draft**, đợi lưu, rồi bấm **Publish saved hours**.
7. Sang khách mở `/help/contact`; tìm khối giờ hỗ trợ, mở **Weekly support hours · Vietnam (UTC+7)** nếu đang thu gọn.
8. Đối chiếu ngày/giờ. Khách vẫn gửi tin được ngoài giờ.

**Không làm:** nhập Until sớm hơn From, bỏ trống giờ của ngày tắt hoặc nghĩ Publish content đã tự Publish giờ hỗ trợ. Hai phần được xuất bản riêng.

<a id="bai-10"></a>

### 9.10. KHÁCH — đăng ký, đăng nhập và điền hồ sơ

#### A. Tạo tài khoản khách mới

1. Sang CỬA SỔ KHÁCH, mở menu tài khoản → **Register**.
2. Điền:

```text
Name:     Nguyễn Minh Demo
Email:    [email khách riêng mà bạn đang quản lý]
Password: [mật khẩu riêng đạt quy tắc]
```

Ví dụ `Demo@Shop2026` chỉ minh họa cấu trúc hợp lệ; hãy chọn mật khẩu riêng. Nếu chỉ kiểm thử đăng ký mà không nhận email, địa chỉ `khach-demo@example.test` minh họa định dạng nhưng không có hộp thư thật.

3. Bấm **Sign Up**.
4. Chờ thông báo; nếu được đưa về Login thì đăng nhập bằng email/mật khẩu vừa dùng.
5. Tài khoản mới là USER. Không dùng tài khoản admin cho bài khách nếu cần kiểm tra phân quyền.

#### B. Điền địa chỉ và số điện thoại

1. Mở menu tài khoản → **Profile**.
2. Có thể để Username đang có hoặc nhập tên hợp lệ theo form, ví dụ `minhdemo01` nếu chưa bị dùng.
3. Giữ email đăng nhập hiện tại ở bài đầu.
4. Trong Address, bấm **Change**.
5. Mở dropdown **Province / City**, chọn một tỉnh/thành bạn muốn thực hành trong **danh sách đang có**.
6. Đợi District tải, chọn một huyện/quận thuộc tỉnh đó.
7. Đợi Ward tải, chọn một phường/xã thuộc huyện đó.
8. Ở **House Number, Street Name**, nhập `12 Đường Demo, Tòa A, tầng 2`.
9. Ở **Phone Number**, nhập `0901234567` cho dữ liệu mô phỏng.
10. Để Current Password/New Password trống vì lần này chỉ nhập hồ sơ thông thường, trừ khi form đang yêu cầu một bước xác thực riêng.
11. Bấm **Save Changes**, đợi xác nhận.
12. Tải lại Profile, kiểm tra địa chỉ và số điện thoại còn đúng.

Không có một tên tỉnh/huyện/xã cố định dùng được với mọi phiên bản nguồn địa chỉ. Chọn đúng chuỗi trong dropdown hiện tại; đừng gõ tay mã hành chính mẫu hoặc chọn huyện trước tỉnh.

#### C. Upload avatar

1. Trong Profile, chọn **Change avatar / Upload Avatar** theo nút đang hiện.
2. Chọn ảnh trên máy, hoàn tất cửa sổ upload.
3. Chờ ảnh mới xuất hiện trên form, bấm Save Changes nếu form yêu cầu lưu hồ sơ.
4. Tải lại để kiểm tra ảnh. Nếu upload không mở/không tải được, xem cấu hình dịch vụ ảnh của môi trường.

<a id="bai-11"></a>

### 9.11. KHÁCH — tìm sản phẩm, chọn đúng SKU, thử giỏ

#### A. Tìm và kiểm tra sản phẩm

1. Về trang chủ bằng logo SGTech.
2. Bấm ô **Search products…**, gõ `Tai nghe SGTech Demo`.
3. Chọn gợi ý đúng sản phẩm, hoặc nhấn Enter để mở kết quả rồi bấm thẻ sản phẩm.
4. Nếu dùng `/products`, chọn danh mục Tai nghe Demo và thương hiệu SGTech Demo để thử lọc.
5. Nhìn tên sản phẩm, chọn **Đen Bluetooth** trong màu/option. Nếu hai SKU cùng ảnh minh họa, dùng tên và mã SKU để phân biệt.
6. Kiểm tra mã là **SG-DEMO-BLK**, giá **199.000đ** và số lượng mua là `1`.
7. Mở Technical specifications, đọc Bluetooth, pin và khối lượng; mở Warranty policy/In the box.
8. Bấm **Add to Cart**, chờ thông báo thành công.
9. Bấm **View Cart** hoặc biểu tượng giỏ.

#### B. Thử sửa giỏ rồi đưa về lượng bài mẫu

1. Trong Shopping Cart, tìm đúng dòng SKU đen.
2. Bấm dấu `+` để đổi lượng từ 1 thành 2, nhìn thành tiền đổi.
3. Bấm dấu `−` để về **1** trước khi sang checkout.
4. Không bấm Remove/Clear Cart ở bài mua chính. Nếu muốn thử xóa, thêm một dòng khác để xóa rồi giữ lại 1 SKU đen.
5. Bấm **Proceed to Checkout**. Nếu hiện Login to Checkout, đăng nhập khách rồi quay lại giỏ.
6. Nếu hệ thống yêu cầu rà giá/tồn, đọc từng dòng và chấp nhận cập nhật phù hợp trước khi tiếp tục.

**Bạn đã làm đúng khi:** giỏ chỉ có 1 SKU SG-DEMO-BLK, tiền hàng 199.000đ. Giỏ chưa giữ tồn nên Inventory vẫn có thể là 10/0/10 ở thời điểm này.

<a id="bai-12"></a>

### 9.12. KHÁCH — đặt 1 đơn COD với mẫu form hoàn chỉnh

1. Ở Checkout, xem **Delivery Information**.
2. Ô **Full Name**, nhập `Nguyễn Minh Demo` nếu chưa đúng.
3. Nếu Saved Delivery Information đúng bài 9.10, dùng thông tin đó. Nếu cần sửa, bấm Change và chọn đủ địa bàn tương tự bài 9.10.
4. Kiểm tra địa chỉ chi tiết `12 Đường Demo, Tòa A, tầng 2`, điện thoại `0901234567`.
5. Bấm **Get delivery quote**. Đừng bấm Place Order trước bước này.
6. Chờ hết Calculating delivery; đọc khối tổng tiền.

Với cấu hình bài 9.7, trước khi đặt bạn phải thấy ý nghĩa tương đương:

```text
Sản phẩm:       Tai nghe SGTech Demo — Đen Bluetooth
Số lượng:      1
Tiền hàng:     199.000đ
Delivery fee:   15.000đ
Total:         214.000đ

Payment Information
(x) Cash on Delivery (COD)
( ) Pay with VNPay
( ) Pay with MoMo
( ) Pay with ZaloPay
( ) Credit or debit card (Stripe)

[Place Order]
```

7. Chọn **Cash on Delivery (COD)**.
8. Nếu Total không bằng 214.000đ, kiểm tra lượng mua và bảng phí. Nếu cố ý dùng phí khác, ghi **tổng thực tế của đơn** để dùng khi thu COD sau này.
9. Bấm **Place Order** đúng một lần và chờ.
10. Khi có Order received, bấm **View Your Orders**.
11. Mở đơn vừa tạo; chép nguyên số `SG-…` vào ghi chú bài 9.1.

**Bạn đã làm đúng khi:** khách có một đơn COD, chưa Paid; SKU đen On hand 10, Reserved 1, Available 9 nếu chưa có đơn khác dùng SKU này.

**Nếu mất mạng sau khi bấm:** mở Your Orders để xem đơn có tồn tại trước. Không đặt lại ngay vì có thể thao tác trước đã tạo đơn thành công.

<a id="bai-13"></a>

### 9.13. ADMIN — mở đúng đơn, xác nhận, ghi chú và sửa người nhận

#### A. Tìm đơn

1. Sang CỬA SỔ ADMIN, bấm **Orders**.
2. Bấm ô tìm kiếm, dán số SG-… đã ghi từ cửa sổ khách.
3. Để bộ lọc phù hợp hoặc xóa bộ lọc cũ bằng **Clear filters**, rồi tìm lại; Apply filters nếu form yêu cầu.
4. Bấm **View** hoặc liên kết số đơn đúng dòng.
5. Đối chiếu tên khách, người nhận, SKU đen, lượng 1, COD, tổng 214.000đ.

#### B. Xác nhận đơn COD

1. Kéo tới **Order management and activity**.
2. Trong **Action**, chọn **Confirm order** nếu đang được phép.
3. Trong **Reason for this change**, nhập:

```text
Đã đối chiếu thông tin nhận hàng và xác nhận 1 tai nghe đen trong bài thực hành COD.
```

4. Tích **I have reviewed this action and the current order.**
5. Bấm **Confirm order** ở cuối form, chờ lưu.
6. Xem trạng thái đơn thành Confirmed; kiểm tra COD vẫn chưa Paid.

#### C. Ghi chú công khai cho khách

1. Trong Action, chọn **Add note**.
2. **Note visibility**, chọn **Visible to customer**.
3. **Note**, nhập:

```text
Cửa hàng đã xác nhận đơn demo và sẽ chuyển sang bước chuẩn bị hàng.
```

4. Reason for this change, nhập `Ghi thông tin xác nhận để khách theo dõi tiến trình của đơn demo.`
5. Tích xác nhận → bấm **Add note**.
6. Sang khách, tải lại chi tiết đơn và tìm dòng ghi chú này trong lịch sử.

#### D. Ghi chú nội bộ

Làm lại bước C nhưng chọn **Admin only** và Note `Đã kiểm tra bộ dữ liệu mô phỏng, chưa bàn giao hàng.` Sau khi lưu, khách không được thấy ghi chú này.

#### E. Sửa người nhận trước khi packing nếu muốn thử

1. Thực hiện **trước bài giao hàng**; trong Action chọn **Edit recipient / address** nếu còn được phép.
2. Giữ nguyên vùng giao; chỉ thay Street address thành `12 Đường Demo, Tòa A, tầng 3`.
3. Recipient name giữ `Nguyễn Minh Demo`, Recipient phone giữ `0901234567`.
4. Province/city đã lưu có thể bị khóa; không tìm cách thay tỉnh bằng ô này.
5. Nhập lý do `Khách xác nhận đổi tầng nhận hàng trong cùng khu vực trước khi chuẩn bị đơn.`
6. Tích xác nhận → **Edit recipient / address** để ghi nhận.
7. Kiểm tra địa chỉ mới, tổng tiền vẫn giữ nguyên. Nếu dùng nhánh này, địa chỉ hàng đổi sau đó sẽ dựa trên thông tin nguồn được lưu khi đề nghị.

**Từ chối COD:** chỉ thử trên một **đơn COD mới khác** còn đủ điều kiện. Chọn Decline COD order, điền lý do, tích xác nhận và lưu; kiểm tra đơn hủy và lượng giữ được giải phóng. Không từ chối đơn đang dùng cho bài giao/đổi hàng.

<a id="bai-14"></a>

### 9.14. ADMIN — chuẩn bị, gửi, in phiếu và ghi nhận đã giao

#### A. Đến màn hình Shipment details

1. Trên chi tiết đơn, bấm **Manage shipment**; hoặc vào Shipments rồi chọn **Manage** ở đúng đơn.
2. Kiểm tra đang ở `/admin/shipments/<ID thực tế của đơn>`.
3. Tìm khối **Carrier & delivery**.

#### B. Ghi Preparing

1. Trong **Delivery status**, chọn **Preparing**.
2. Nếu có ô ghi chú, nhập `Chuẩn bị 1 tai nghe đen theo đơn demo đã xác nhận.`
3. Bấm **Save changes** ở đầu trang.
4. Nếu mở hộp Confirm delivery update, đọc nội dung rồi bấm nút xác nhận lưu trên hộp. Không bấm Cancel nếu muốn hoàn tất bước.
5. Chờ lưu và kiểm tra trạng thái Preparing trong lịch sử.

#### C. Ghi Ready to ship

1. Chọn Delivery status **Ready to ship**.
2. Nhập ghi chú `Đã kiểm đếm và đóng gói 1 tai nghe đen, sẵn sàng bàn giao mô phỏng.`
3. Save changes → xác nhận → chờ lưu.
4. Bấm **Packing slip**; tab phiếu mở ra. Đối chiếu SKU, số lượng, người nhận; dùng chức năng in của trang/trình duyệt nếu cần.

#### D. Ghi Shipped

1. Quay lại Shipment details, chọn **Shipped**.
2. Điền các ô carrier/tracking/ghi chú theo nhãn trên form:

```text
Carrier:         Vận chuyển Demo
Tracking number: DEMO-SHIP-001
Delivery note:   Đã bàn giao mô phỏng 1 tai nghe đen theo mã DEMO-SHIP-001.
```

3. Save changes → đọc và xác nhận thay đổi.
4. Đợi lưu. Sang Inventory của SKU đen, kiểm tra `On hand 9 / Reserved 0 / Available 9`.

#### E. Ghi In transit rồi Delivered

1. Trở lại Shipment details, chọn **In transit** → ghi chú mô phỏng → Save changes và xác nhận.
2. Khi đến mốc giao thành công trong bài demo, chọn **Delivered**.
3. Giữ carrier và tracking, ghi `Đã giao mô phỏng đủ 1 tai nghe cho người nhận theo DEMO-SHIP-001.`
4. Save changes → xác nhận → chờ lưu.
5. Sang khách, mở chi tiết đơn, kiểm tra Delivery là Delivered.

**Bạn đã làm đúng khi:** lịch sử đủ các bước đã ghi, kho chỉ bị xuất một lần ở Shipped. Chưa ghi chứng từ COD thì giao thành công không tự có nghĩa đã thu/đã nhận tiền.

**Nhánh giao thất bại:** chỉ chọn Delivery failed/Returned khi thực sự đang mô phỏng nhánh khác. Các nhánh này cần lý do và giữ tracking; không phải cách tự nhập lại kho. Bài đổi hàng tiếp theo cần đơn gốc đã Delivered.

<a id="bai-15"></a>

### 9.15. ADMIN — ghi chứng từ thu COD và nhận tiền về cửa hàng

#### A. Ghi khách trả đủ tiền cho người giao

1. Mở lại chi tiết **đúng đơn bài 9.12** ở Orders.
2. Kéo tới **COD collection & store receipts**.
3. Tìm phần **Record customer payment**.
4. Điền:

```text
Collected by:                    Carrier
Customer payment (VND):          214000
Receipt or remittance reference: DEMO-COL-001
Receipt time (Vietnam, UTC+7):   [chọn thời điểm mô phỏng thực hiện ở bài này]
Internal note:                   Biên nhận demo: khách đã trả đủ tiền cho người giao.

[x] I verified the receipt, amount and time...
[Record collection]
```

5. Nếu tổng đơn thực tế khác 214.000đ, nhập đúng tổng đó, không sao chép số mẫu.
6. Với ô thời gian, chọn ngày và giờ bằng bộ chọn của trình duyệt; đừng dán chuỗi chữ trong dấu ngoặc vuông.
7. Tích xác nhận → bấm **Record collection**.
8. Chờ lưu, kiểm tra phần Customer payment có amount/reference/time.

#### B. Ghi tiền đơn vị vận chuyển chuyển về

1. Sau bước A với Collected by = Carrier, form cho ghi **Record carrier remittance** khi đủ điều kiện.
2. Bài mẫu giả sử phí khấu trừ 10.000đ, điền:

```text
Money received (VND):            204000
Carrier fee deducted (VND):      10000
Receipt or remittance reference: DEMO-SET-001
Receipt time (Vietnam, UTC+7):   [thời điểm mô phỏng tiền về cửa hàng]
Internal note:                   Đối chiếu bản kê demo, nhận 204.000đ sau phí 10.000đ.
```

3. Kiểm tra phép cộng `204000 + 10000 = 214000`.
4. Tích xác nhận → bấm **Record store receipt**.
5. Xem phần **Money received by the store** có chứng từ vừa ghi.
6. Bấm **COD follow-up**, tìm lại đơn để đối chiếu giai đoạn tiền.

**Nếu cửa hàng thu trực tiếp:** trên một bài/đơn khác chọn Store directly ở bước A. Chứng từ đó ghi nhận cả tiền khách trả và cửa hàng nhận theo luồng hiện tại; không tạo remittance của carrier cho cùng tiền.

Chứng từ này là ghi nhận dữ liệu, không thực hiện chuyển khoản. Không xóa/sửa đè để làm lại bài; muốn thực hành lại từ đầu hãy tạo đơn demo mới.

<a id="bai-16"></a>

### 9.16. KHÁCH và ADMIN — tạo phiếu, nhận chat, trả lời và ghi chú riêng

#### A. Khách tạo một phiếu có ngữ cảnh đơn

1. CỬA SỔ KHÁCH: mở Your Orders → đơn vừa giao.
2. Bấm **Ask about this order** để mở form có ngữ cảnh đơn. Nếu mở `/support/requests/new` trực tiếp, chọn đúng đơn trong Request order.
3. Điền:

```text
Request type: Delivery
Subject:      Cần kiểm tra thông tin giao của đơn demo
Details:      Tôi đang thực hành theo dõi đơn. Nhờ cửa hàng xác nhận thông tin bàn giao và mã vận chuyển của đơn này.
Linked order: [đúng đơn vừa tạo]
Image:        để trống ở lượt đầu
```

4. Bấm **Submit support request**, chờ chuyển tới chi tiết.
5. Chép mã **SR-…** vào ghi chú thực hành.

#### B. Admin nhận cuộc hội thoại

1. CỬA SỔ ADMIN: bấm **Support requests**, mở phiếu đúng mã SR-… hoặc đúng khách/tiêu đề.
2. Kéo xuống **Shared conversation**.
3. Nếu hiện **Accept conversation**, bấm nút đó. Nếu hội thoại Closed, Reopen conversation rồi nhận lại.
4. Nếu admin khác đang xử lý, phối hợp để họ Release to inbox; không đổi tài khoản để ghi đè tùy tiện.
5. Bấm **Refresh request** ở phần chi tiết phiếu để tải lại quyền và trạng thái.

#### C. Admin trả lời và chuyển trạng thái

1. Bấm **Start reviewing** trong các nút trạng thái phiếu khi đang Open.
2. Trong Message của hội thoại chung, nhập:

```text
Cửa hàng đã nhận yêu cầu demo. Mã vận chuyển đang lưu là DEMO-SHIP-001; bạn có thể xem tiến trình trong chi tiết đơn.
```

3. Bấm **Send message**, đợi tin xuất hiện trong lịch sử.
4. Kéo tới Internal request notes, ô **Internal note** nhập:

```text
Đã kiểm tra số đơn và tracking mô phỏng; ghi chú này chỉ dành cho quản trị viên.
```

5. Bấm **Save internal note**, kiểm tra ghi chú được thêm vào danh sách riêng.
6. Có thể bấm **Await customer reply** để yêu cầu khách phản hồi.

#### D. Khách phản hồi, admin giải quyết

1. Sang khách, mở phiếu, dùng **Refresh request / Refresh messages** nếu chưa thấy cập nhật.
2. Đọc tin admin, nhập `Tôi đã kiểm tra và thấy đúng mã vận chuyển, cảm ơn cửa hàng.` vào Message → Send message.
3. Kiểm tra phía khách không thấy Internal note vừa tạo.
4. Sang admin, Refresh request/messages; khi đã giải quyết xong, bấm **Mark request resolved**.
5. Nếu muốn kết thúc phiếu, bấm **Close request** khi nút xuất hiện.

**Support inbox khác gì?** mở `/admin/support`, chọn Show conversations = Assigned to me để thấy hội thoại đang nhận; Waiting for assignment để xem hàng chờ. Từ đó có thể mở chat trực tiếp. Release to inbox, Close conversation và Reopen conversation là thao tác với hội thoại; trạng thái từng phiếu vẫn được quản lý riêng.

#### E. Thử gửi ảnh

1. Ở một cuộc hội thoại bạn có quyền gửi, bấm ô chọn tệp tại **Attach an image**.
2. Chọn một ảnh PNG/JPEG/WebP nhỏ hơn 1 MiB trên máy.
3. Nhập tin `Gửi ảnh minh họa cho bài thực hành hỗ trợ.`
4. Bấm Send message, kiểm tra ảnh trong lịch sử ở hai phía.
5. Nếu chọn nhầm trước khi gửi, bấm Remove image rồi chọn lại. Không upload PDF hoặc file chỉ đổi đuôi thành `.png`.

<a id="bai-17"></a>

### 9.17. KHÁCH — tạo hồ sơ trả 1 SKU đen

**Điểm bắt đầu:** đơn chính đã Delivered, SKU đen đã được xuất kho theo bài giao hàng. Đây là hồ sơ xử lý hàng, tách với phiếu hỏi thông tin ở bài 9.16.

1. Khách mở Your Orders → đúng đơn chính.
2. Tìm phần Returns & exchanges, bấm **Request a return**.
3. Kiểm tra Order là đúng đơn; đợi Loading available items kết thúc.
4. Điền:

```text
Order item:           Tai nghe SGTech Demo — Đen Bluetooth
Quantity:             1
Reason:               Other reason for review
Preferred resolution: Request an exchange
Details:              Tôi muốn nhờ cửa hàng xem xét đổi màu trắng cho tai nghe demo; sản phẩm còn đủ phụ kiện và đang dùng để thực hành đổi SKU cùng giá.
Private image:        để trống hoặc chọn ảnh hợp lệ nếu muốn thử
```

5. Bấm **Submit return request**.
6. Chờ mở hồ sơ, chép mã **RT-…** vào ghi chú.
7. Đọc trạng thái Awaiting review/REQUESTED. Chưa gửi hàng ngay vì chưa có hướng dẫn nhận của admin.

**Nếu Order item trống/không cho chọn:** kiểm tra đúng đơn Delivered, đúng tài khoản và số lượng chưa bị hồ sơ khác giữ. Dùng Refresh available items hoặc Ask support to review this order, không tạo hồ sơ bằng ID tự nghĩ ra.

<a id="bai-18"></a>

### 9.18. ADMIN — duyệt trả; KHÁCH — ghi gửi hàng về

#### A. Admin duyệt

1. Admin mở **Returns**, tìm hồ sơ RT-… vừa ghi.
2. Mở hồ sơ, đọc Return summary, SKU, số lượng và mô tả.
3. Nếu cần, nhận/mở lại Shared support conversation ở cuối trang; bấm **Refresh return**.
4. Trong **Record next step → Action**, chọn **Accept return and give instructions**.
5. Ở **Return instructions for the customer**, nhập:

```text
Đồng ý tiếp nhận 1 tai nghe demo để kiểm tra. Đây là bài mô phỏng; hãy ghi nhận gửi hàng bằng mã DEMO-RT-SEND-001, không gửi hàng vật lý theo địa chỉ mẫu của tài liệu.
```

6. Reference có thể để trống nếu form ghi optional ở bước này.
7. Tích **I confirm the recorded facts, quantity and instructions for this step.**
8. Bấm **Save return step**, chờ trạng thái **Approved to send goods back / AWAITING_RETURN**.

Khi sử dụng thật, thay hướng dẫn mô phỏng bằng nơi nhận/cách gửi đã xác minh. Không copy câu “không gửi hàng vật lý” vào hồ sơ khách thật nếu đang vận hành thật.

#### B. Khách ghi đã gửi

1. Khách mở Your return requests → đúng RT-… → **Refresh return**.
2. Đọc hướng dẫn admin, sau đó Action chọn **Record goods sent back**.
3. Ô Public note / inspection findings, nhập:

```text
Đã ghi nhận gửi mô phỏng 1 tai nghe theo hướng dẫn của cửa hàng, mã DEMO-RT-SEND-001.
```

4. **Receipt or evidence reference**, nhập `DEMO-RT-SEND-001`.
5. Tích xác nhận → **Save return step**.
6. Kiểm tra **Customer sent goods back / IN_TRANSIT**.

**Nếu khách muốn rút:** trên một hồ sơ trước gửi còn cho phép, chọn Withdraw return request, điền ghi chú, tích xác nhận và Save return step. Không rút hồ sơ chính nếu muốn làm tiếp bài nhận/đổi.

<a id="bai-19"></a>

### 9.19. ADMIN — nhận, kiểm định và nhập lại tồn

Mỗi bước sau phải **lưu riêng, chờ thành công rồi mới chọn bước kế**.

#### A. Nhận hàng

1. Admin mở hồ sơ chính → Refresh return.
2. Action chọn **Record goods received**.
3. Điền:

```text
Public note / inspection findings:
Đã nhận mô phỏng đủ 1 tai nghe và phụ kiện; đang chờ kiểm định theo biên bản DEMO-RT-RECEIVE-001.

Receipt or evidence reference: DEMO-RT-RECEIVE-001
```

4. Tích xác nhận → Save return step.
5. Kiểm tra **Goods received, awaiting inspection / RECEIVED**.
6. Inventory SKU đen vẫn **9/0/9**, chưa tăng vì mới nhận hàng.

#### B. Ghi kiểm định phù hợp nhập kho

1. Action chọn **Inspect as suitable for stock**.
2. Điền note:

```text
Kiểm định mô phỏng: đủ số lượng, kết nối hoạt động và phụ kiện đầy đủ; phù hợp đưa lại vào tồn bán của bài thực hành.
```

3. Reference nhập `DEMO-INSPECT-001` nếu muốn lưu mã kiểm định; điền bắt buộc nếu form yêu cầu.
4. Tích xác nhận → Save return step.
5. Kiểm tra **Inspected, suitable for stock / INSPECTED_RESTOCKABLE**. Tồn vẫn chưa tăng ở bước kiểm định.

#### C. Nhập lại hàng đã kiểm định

1. Action chọn **Add inspected goods to stock**.
2. Điền:

```text
Public note / inspection findings:
Nhập lại 1 tai nghe đen đã kiểm định phù hợp theo phiếu DEMO-RESTOCK-001.

Receipt or evidence reference: DEMO-RESTOCK-001
```

3. Đọc cảnh báo sẽ thêm 1 món vào tồn bán, tích xác nhận.
4. Bấm Save return step.
5. Kiểm tra trạng thái **Goods restocked, resolution pending / RESTOCKED**.
6. Mở Inventory SKU đen: **On hand 10 / Reserved 0 / Available 10** và có lịch sử Inspected return restocked.

**Nhánh unsuitable:** nếu kiểm định không phù hợp, chọn Inspect as unsuitable for stock, ghi lỗi thực tế rồi lưu. Không nhập vào tồn bán. Từ trạng thái đó có thể làm phương án được hệ thống cho phép, chẳng hạn đề nghị đổi hoặc trả lại chính hàng cho khách. Không làm nhánh suitable chỉ để phép tính bài mẫu đẹp.

<a id="bai-20"></a>

### 9.20. ADMIN đề nghị đổi → KHÁCH duyệt → ADMIN gửi → KHÁCH nhận

#### A. Admin giữ SKU trắng để khách duyệt

1. Mở hồ sơ chính đang RESTOCKED → Refresh return.
2. Action chọn **Reserve a replacement for approval**.
3. Chờ **Replacement SKU** tải, chọn **SG-DEMO-WHT · Trắng Bluetooth**.
4. Đọc phần địa chỉ và thông tin nguồn; Quantity lấy theo hồ sơ là 1, không nhập thành 2.
5. Điền note:

```text
Đề nghị đổi 1 SKU SG-DEMO-WHT màu trắng, cùng sản phẩm và đơn giá gốc 199.000đ; khách vui lòng kiểm tra phiên bản và nơi nhận.
```

6. Reference nhập `DEMO-EX-OFFER-001` nếu muốn ghi tham chiếu và form cho phép.
7. Tích xác nhận → **Save return step**.
8. Kiểm tra Replacement exchange là **Replacement reserved, awaiting your approval / OFFERED**.
9. Inventory SKU trắng: **On hand 6 / Reserved 1 / Available 5**.

**Nếu dropdown rỗng:** giá hiện tại SKU trắng phải bằng giá gốc 199.000đ, cùng sản phẩm, đủ tồn, được Enable và hiển thị. Bấm Refresh replacement choices sau khi kiểm tra. Không sửa giá đơn gốc để ép lựa chọn xuất hiện.

#### B. Khách duyệt đề nghị

1. Khách mở đúng RT-… → Refresh return.
2. Đọc **Replacement exchange**: SKU trắng, lượng 1, giá gốc và địa chỉ nhận.
3. Action chọn **Accept this replacement**.
4. Điền note `Tôi đồng ý nhận 1 tai nghe SKU SG-DEMO-WHT theo đề nghị và địa chỉ đang hiển thị.`
5. Tích xác nhận → Save return step.
6. Kiểm tra **Replacement approved, awaiting dispatch / ACCEPTED**.

Nếu không đồng ý, chọn Decline this replacement, ghi lý do, tích xác nhận và Save return step; lượng giữ được giải phóng khi chưa gửi. Muốn làm tiếp bài chính thì chọn Accept, không chọn Decline.

#### C. Admin gửi hàng đổi

1. Admin Refresh return, phải thấy ACCEPTED.
2. Action chọn **Record replacement dispatch**.
3. Điền:

```text
Replacement carrier:         Vận chuyển Demo
Public note / inspection findings:
Đã bàn giao mô phỏng 1 tai nghe trắng theo đề nghị khách đã chấp thuận.

Replacement tracking number: DEMO-EX-SHIP-001
```

4. Tích xác nhận → Save return step.
5. Kiểm tra **Replacement dispatched / SHIPPED**.
6. Inventory SKU trắng phải là **5 / 0 / 5**. Không tự xuất thêm một lần tại Inventory.

#### D. Khách nhận và kết thúc

1. Khách Refresh return.
2. Sau mốc nhận/kiểm tra mô phỏng, Action chọn **Confirm replacement received**.
3. Note nhập `Tôi đã nhận và kiểm tra mô phỏng 1 tai nghe trắng đúng SKU đã chấp thuận.`
4. Reference nhập `DEMO-EX-RECEIVE-001` nếu muốn ghi; nếu form yêu cầu thì không bỏ trống.
5. Tích xác nhận → Save return step.
6. Kiểm tra **Exchange completed / EXCHANGED** và lịch sử.
7. Admin mở phiếu hỗ trợ **liên kết với hồ sơ return này**, kiểm tra phiếu đã resolved; không nhầm với phiếu Delivery khác ở bài 9.16.

Admin cũng có thể Record replacement delivery evidence khi có bằng chứng hợp lệ; trong nhánh đó cần nhập mã tham chiếu/bằng chứng thật tương ứng. Chỉ có tracking chưa đủ để xác nhận giao thành công.

#### E. Đổi đề nghị hoặc hủy giữ trước gửi

Trên một đề nghị chưa SHIPPED, admin có **Release replacement reservation**. Chọn → nhập lý do ít nhất 10 ký tự → xác nhận → Save return step. Kiểm tra Reserved giảm đúng lượng. Sau đó mới tạo đề nghị mới nếu cần. Không làm bước này giữa bài chính nếu bạn đang chờ khách nhận hàng đổi đã gửi.

<a id="bai-21"></a>

### 9.21. Bảng đối chiếu bài chính — tự kiểm tra mình đã làm đúng

Các số dưới đây giả sử không có người khác mua/điều chỉnh các SKU này trong lúc thực hành.

| Mốc bạn vừa làm | SKU đen On hand / Reserved / Available | SKU trắng On hand / Reserved / Available |
|---|---|---|
| Nhập tồn đầu kỳ | 10 / 0 / 10 | 6 / 0 / 6 |
| Thêm giỏ, chưa đặt | 10 / 0 / 10 | 6 / 0 / 6 |
| Đặt đơn COD 1 SKU đen | 10 / 1 / 9 | 6 / 0 / 6 |
| Confirm order | 10 / 1 / 9 | 6 / 0 / 6 |
| Shipped đơn gốc | 9 / 0 / 9 | 6 / 0 / 6 |
| Delivered + ghi COD | 9 / 0 / 9 | 6 / 0 / 6 |
| Khách tạo trả, admin nhận/kiểm định | 9 / 0 / 9 | 6 / 0 / 6 |
| Add inspected goods to stock | 10 / 0 / 10 | 6 / 0 / 6 |
| Reserve replacement trắng | 10 / 0 / 10 | 6 / 1 / 5 |
| Khách Accept replacement | 10 / 0 / 10 | 6 / 1 / 5 |
| Gửi replacement | 10 / 0 / 10 | 5 / 0 / 5 |
| Khách xác nhận nhận | 10 / 0 / 10 | 5 / 0 / 5 |

Đơn gốc vẫn giữ thông tin hàng đã mua và tổng 214.000đ theo bài mẫu. Hồ sơ đổi giữ bản ghi SKU thay thế riêng. Thay vì sửa tay số tồn cho giống bảng, hãy đọc Stock history để tìm mốc bị thiếu/lặp nếu dữ liệu khác kỳ vọng.

<a id="bai-22"></a>

### 9.22. Bài riêng — thanh toán online và hủy/hoàn trước bàn giao

**Không dùng đơn chính đã Delivered.** Tạo một đơn mới, dùng sandbox đang được cấu hình. Nếu merchant chưa nghiệm thu hoặc provider từ chối, ghi nhận giới hạn đó, không giả kết quả Paid/Refund confirmed.

#### A. Đặt đơn online

1. Khách chọn 1 SKU còn Available, thêm giỏ → Proceed to Checkout.
2. Điền địa chỉ → Get delivery quote → kiểm tra Total.
3. Chọn một phương thức đang khả dụng:

| Bạn chọn | Nút cần bấm | Làm tiếp |
|---|---|---|
| VNPay | Continue with VNPay | Hoàn tất ở giao diện sandbox bằng dữ liệu test hợp lệ |
| MoMo | Continue with MoMo | Làm theo trang sandbox được mở |
| ZaloPay | Continue with ZaloPay | Làm theo trang sandbox, quay lại xem đơn |
| Stripe | Pay Now sau khi form thẻ sẵn sàng | Nhập dữ liệu thẻ test hợp lệ của môi trường rồi thanh toán |

4. Khi quay lại, mở **Your Orders**, ghi số đơn mới và kiểm tra kết quả xác minh.
5. Admin mở **Payments**, tìm lần thanh toán/đơn tương ứng, View details; bấm **Check payment** nếu đang được phép.
6. Nếu còn pending/unknown, dừng việc gửi hàng và tiếp tục đối chiếu. Đã mở trang QR/redirect không tự có nghĩa đã trả tiền.

Không điền thẻ thật. Các dữ liệu thẻ/tài khoản test phụ thuộc provider, không dùng số điện thoại/biên nhận demo trong các bài COD như thông tin thanh toán online.

#### B. Khách xin hủy khi đơn mới đã thanh toán, chưa Shipped

1. Khách mở chi tiết đơn online mới.
2. Kéo tới Cancellation & refund, Action chọn **Request cancellation & refund**.
3. Reason nhập:

```text
Tôi đặt nhầm phiên bản trong bài thực hành, đề nghị hủy đơn trước khi bàn giao vận chuyển.
```

4. Tích ô xác nhận của form → bấm **Request cancellation & refund** ở cuối.
5. Chờ trạng thái Cancellation requested.

#### C. Admin duyệt hủy

1. Admin mở **Refunds** → phần Paid-order cancellation requests.
2. Chọn **Review order** đúng đơn vừa xin hủy.
3. Trong Cancellation & refund, chọn **Approve cancellation**.
4. Reason nhập `Đã kiểm tra đơn chưa bàn giao; đồng ý hủy toàn phần theo yêu cầu demo của khách.`
5. Tích xác nhận → bấm Approve cancellation.
6. Kiểm tra đơn hủy và lượng giữ được giải phóng. Trạng thái thu tiền gốc vẫn được giữ.

Nếu không chấp thuận, chọn Decline cancellation trên đúng yêu cầu, ghi lý do, xác nhận và lưu. Đây là nhánh khác, không thực hiện thêm Approve cho cùng kết quả đã từ chối mà không có điều kiện nghiệp vụ mới.

#### D. Admin gửi và kiểm tra hoàn

1. Khi đủ điều kiện, Action chọn **Submit full refund**.
2. Nhập lý do rõ ràng, đọc xác nhận rồi bấm nút Submit full refund.
3. Đợi phản hồi. PROCESSING/REVIEW/SENDING không có nghĩa đã hoàn.
4. Khi được phép, chọn **Check refund status**, điền lý do nếu form yêu cầu và thực hiện kiểm tra.
5. Chỉ ghi bài đã hoàn tất khi có **Refund confirmed** từ kết quả khớp nguồn thu.
6. Nếu mạng lỗi sau submit, dùng Check refund status trên khoản cũ; không gửi một lệnh hoàn mới để thử vận may.

**Record COD refund receipt:** chỉ dùng trên đơn COD đủ điều kiện sau khi đã thực hiện trả tiền ngoài app. Nhập reference `DEMO-REF-001` khi mô phỏng, chọn thời gian, ghi lý do, xác nhận rồi lưu. Không dùng chứng từ COD để biến một khoản hoàn online chưa rõ thành đã hoàn.

<a id="bai-23"></a>

### 9.23. Bài riêng — rà Payment issues và Refund follow-up

Trang này cần có một **ngoại lệ do hệ thống ghi nhận**, ví dụ thu trùng/tới muộn. Không có nút tạo một payment issue tùy ý và không cần chèn database chỉ để có dòng demo.

1. Admin mở **Payment issues**.
2. Chọn bộ lọc Review status thích hợp. Nếu danh sách rỗng, bài chỉ dừng ở nhận diện giao diện.
3. Nếu có bản ghi, bấm **Review issue**, đọc khoản tiền và lịch sử đúng đơn.
4. Chỉ sau khi có bằng chứng, điền ví dụ tương ứng:

```text
Review outcome: Refund required
Review note:    Đã đối chiếu chứng từ sandbox cho khoản thu trùng này; cần xử lý hoàn theo đúng nguồn thu riêng.
```

5. Bấm **Save review**.
6. Mở Refunds, xem phần Refund follow-up, đối chiếu reason/note và View order.

Đây là ghi quyết định cần xử lý; Save review không chuyển tiền. Không chọn Refund required chỉ để danh sách có thêm dữ liệu nếu chưa xác nhận được ngoại lệ.

<a id="bai-24"></a>

### 9.24. KHÁCH và ADMIN — đọc thông báo, lọc và đánh dấu

Sau các bài đặt đơn/chat/đổi trả, tài khoản có thể đã có thông báo.

1. Ở đúng cửa sổ tài khoản, bấm biểu tượng **chuông** trên header.
2. Chọn **Unread** để xem tin chưa đọc.
3. Bấm **Mark as read** cho một tin; nhìn số chưa đọc giảm khi cập nhật.
4. Bấm liên kết trong tin, kiểm tra mở đúng đơn/phiếu/hồ sơ tương ứng.
5. Mở lại chuông → **View all notifications** để vào trang lịch sử.
6. Chọn All, bấm Older notifications/Latest notifications nếu có nhiều trang.
7. Bấm **Mark all as read**, kiểm tra các tin cũ không còn tính chưa đọc.
8. Thực hiện một sự kiện mới từ tài khoản còn lại, Refresh notifications để xem tin mới vẫn được tính là chưa đọc.

Khách dùng `/notifications`, admin dùng `/admin/notifications` cho inbox quản trị. Đánh dấu đọc không tự duyệt đơn, trả lời chat hoặc hoàn tiền.

<a id="bai-25"></a>

### 9.25. ADMIN — chạy một báo cáo và tải CSV

1. Bấm **Sales reports** → `/admin/reports`.
2. Trong **Period**, chọn **Custom date range**.
3. Chọn From là ngày đầu của kỳ thực hành, To là ngày thực hành kết thúc. Ví dụ nếu làm ngày 16/10/2026, dùng 01/10/2026 → 16/10/2026; làm ngày khác thì dùng kỳ bao gồm ngày đó.
4. Trong **Rank by**, chọn **Units sold**.
5. Bấm **Apply report**. Chỉ sửa ngày mà chưa bấm thì bảng vẫn dùng bộ lọc cũ.
6. Chờ bảng/biểu đồ tải. Tìm sản phẩm Tai nghe SGTech Demo nếu đủ cơ sở tính báo cáo.
7. Đổi Rank by sang **Product revenue**, Apply report để thử cách xếp hạng khác.
8. Bấm **Export CSV**, đợi trình duyệt tải file.
9. Mở file bằng phần mềm bảng tính, đối chiếu sản phẩm/số liệu của kỳ.

Nếu không có sản phẩm trong kỳ, xem kỳ, trạng thái thanh toán và cơ sở tính báo cáo; không nhập tay số doanh thu mong muốn vào ứng dụng. CSV giới hạn 5.000 sản phẩm, khoảng Custom 1–366 ngày. Báo cáo doanh thu chưa phải báo cáo lợi nhuận hay thu ròng sau mọi hoàn/phí.

<a id="bai-26"></a>

### 9.26. ADMIN — khóa/mở một tài khoản và xem nhật ký

#### A. Thử khóa/mở trên một tài khoản demo phụ

Không khóa khách đang dùng bài chính giữa lúc họ còn cần thao tác. Dùng một tài khoản USER phụ do bạn quản lý, chẳng hạn tài khoản đăng ký với Name `Khách kiểm tra khóa Demo` và email riêng.

1. Admin mở **User accounts**.
2. Trong ô **Search accounts by name or email**, nhập email tài khoản demo phụ.
3. Thực hiện tìm kiếm bằng nút của form, đối chiếu đúng tên/email.
4. Bấm **Block account**.
5. Đọc hộp Block account? và xác nhận bằng **Block account**.
6. Kiểm tra status Blocked; phiên đang mở của tài khoản đó sẽ mất hiệu lực.
7. Bấm **Unblock account**, xác nhận trong hộp.
8. Ở cửa sổ của tài khoản phụ, đăng nhập lại để kiểm tra. Mở khóa không làm phiên đã thu hồi tự sống lại.

#### B. Xem nhật ký vừa phát sinh

1. Admin bấm **Activity log**.
2. Bấm Refresh nếu chưa thấy bản mới.
3. Nhìn các cột **When / Who**, **Activity / Target**, **Result**, **Changes**.
4. Tìm hành động vừa làm theo thời điểm và người thao tác; chuyển trang nếu cần.
5. Mở phần thay đổi của bản ghi nếu có, xem giá trị trước/sau.

Trang hiện chưa có bộ lọc nhật ký nâng cao. Không nhập dữ liệu lên bảng này và không coi Completed của hành động là bằng chứng tiền đã thu/hoàn.

<a id="bai-27"></a>

### 9.27. ADMIN — xem Email delivery và xếp hàng thử lại

Điều kiện để có email sự kiện: môi trường đã tạo sự kiện phù hợp, người nhận đủ điều kiện và sender/worker được cấu hình. Không cần gửi email ngoài chỉ để đọc tài liệu này.

1. Mở **Email delivery** → `/admin/notifications/email`.
2. Chọn **Show deliveries = All states**, bấm Refresh email queue khi cần.
3. Đọc kết quả job gần nhất và các dòng email. Nếu rỗng hoặc gửi đang tắt, không có nghĩa form Contact email bị lỗi.
4. Chọn một dòng FAILED/SKIPPED/UNKNOWN đủ điều kiện, bấm **Review and retry email**.
5. Đối chiếu nguyên nhân. Chỉ khi đã xử lý được, ô Reason nhập:

```text
Đã kiểm tra lại người nhận và cấu hình sender của môi trường demo trước khi xếp hàng gửi lại.
```

6. Nếu UNKNOWN, kiểm tra khả năng thư cũ đã gửi rồi mới tích ô **Confirm possible duplicate email**.
7. Bấm **Queue another attempt**, đợi xác nhận.
8. Refresh sau khi worker chạy để theo dõi kết quả. Nút này không gửi ngay trong lúc bấm.

SENT nghĩa SMTP chấp nhận thư, không chứng minh đã đọc. UNKNOWN không tự retry vì có thể gửi trùng. Không có nút nhập SMTP password tại trang liên hệ; phần cấu hình sender thuộc người phụ trách triển khai.

<a id="bai-28"></a>

### 9.28. ADMIN — xem Operations và Online stock holds

#### A. Kiểm tra Operations

1. Bấm **Operations**.
2. Đọc **Last payment job → Result**, thời điểm Started và Last successful completion.
3. Xem số việc cần rà, Recent incidents và Incident reference.
4. Nếu có lỗi, chép mã incident và giờ xảy ra để nhờ kỹ thuật đối chiếu; không chép secret/token.
5. Bấm **Review details** khi có để mở danh sách công việc tương ứng.

#### B. Kiểm tra hold

1. Mở `/admin/operations/holds`.
2. Nếu thấy No overdue online holds, đây là kết quả hợp lệ; không cần tạo một giao dịch treo để làm mẫu.
3. Nếu có bản ghi, đọc tuổi giữ hàng, lý do và hướng dẫn recovery.
4. Bấm Payment history và mở đơn liên quan để đối chiếu.
5. Chỉ dùng nút Check/recovery khi dòng đó cho phép và đã có cơ sở thực hiện.
6. Với recovery Stripe đủ điều kiện, nhập lý do chẳng hạn `Khôi phục tham chiếu chuẩn bị Stripe bị gián đoạn sau khi đối chiếu trạng thái yêu cầu demo.`, đọc hộp xác nhận rồi thực hiện.
7. Refresh và xem lại kết quả. Recovery không xác nhận thu tiền và không giải phóng hàng giữ.

Một giờ là ngưỡng rà, không phải quyền tự hủy. Không sửa Paid/Failed hoặc giảm Reserved trực tiếp để trang xanh.

<a id="bai-29"></a>

### 9.29. KHÁCH — đổi mật khẩu, email, quên mật khẩu và đăng xuất

#### A. Đổi mật khẩu từ Profile

1. Khách mở Profile.
2. Giữ các dữ liệu khác, nhập **Current Password** là mật khẩu hiện tại của chính bạn.
3. Nhập **New Password** là mật khẩu riêng mới đạt quy tắc.
4. Bấm Save Changes, chờ kết quả; đăng nhập lại nếu hệ thống yêu cầu.
5. Dùng mật khẩu mới từ lần sau, không dùng lại ví dụ chung trong tài liệu.

#### B. Đổi email có xác nhận

1. Mở Profile, thay Email bằng một hộp thư mới bạn quản lý.
2. Nhập Current Password khi form yêu cầu; tài khoản xã hội có thể cần bước xác thực/đăng nhập gần đây.
3. Bấm Save Changes.
4. Đọc thông báo chờ xác minh; mở email mới để lấy link.
5. Mở link → trang Verify your email → **Confirm email**.
6. Chờ kết quả, đăng nhập lại theo hướng dẫn và kiểm tra email mới.

Email đăng nhập chưa đổi chỉ vì bạn đã gõ email mới và bấm Save; phải hoàn tất xác minh. Không dùng `example.test` để thử nhận thư.

#### C. Quên mật khẩu

1. Đăng xuất tài khoản khách hoặc mở một cửa sổ riêng chưa đăng nhập.
2. Vào Login → **Forgot password?**.
3. Email Address nhập email đang thuộc tài khoản, bấm **Send Reset Link**.
4. Màn hình Check Your Email không khẳng định email đó chắc chắn có tài khoản; kiểm tra hộp thư bạn quản lý.
5. Mở thư reset → nhập **New Password**, **Confirm New Password** giống nhau → **Reset Password**.
6. Đăng nhập lại bằng mật khẩu mới.

#### D. Đăng xuất một phiên hoặc mọi phiên

- Một phiên: mở menu tài khoản → Logout/Sign out.
- Mọi phiên: Profile → cuối trang → **Sign out all sessions** → chờ đăng xuất; lần sau đăng nhập lại. Thao tác này cũng kết thúc phiên hiện tại.

<a id="bai-30"></a>

### 9.30. Bảng kiểm kết thúc — biết mình đang dừng ở đâu

| Việc | Dấu hiệu xong | Nếu chưa thấy |
|---|---|---|
| Tạo category/brand | Có bản ghi tên/slug đúng, Visible bật | Kiểm tra Save, trùng slug, môi trường |
| Tạo product/SKU | Có sản phẩm và đúng 2 SKU | Kiểm tra trường bắt buộc, ảnh, giá, SKU trùng |
| Nhập tồn | Có số On hand/Reserved/Available và Stock history | Kiểm tra Record adjustment và checkbox |
| Bán được phía khách | Tìm thấy sản phẩm, Add to Cart hoạt động | Kiểm tra Active/Visible/Enable/khả dụng/tồn |
| Lưu/xuất bản nội dung | Có revision mới, khách thấy liên hệ/FAQ | Kiểm tra đã Publish sau Save, đúng database |
| Xuất bản giờ | Khách thấy lịch đã công bố | Kiểm tra Save hours và Publish hours riêng |
| Đặt COD | Có số SG-… trong tài khoản khách | Kiểm tra quote, giỏ và lỗi khi submit |
| Xác nhận/gửi | Đơn Confirmed, shipment đúng, tồn xuất một lần | Kiểm tra từng lần Save changes và xác nhận |
| Ghi tiền COD | Có collection và store receipt theo nhánh thu | Kiểm tra amount/time/reference, đúng đơn |
| Tạo hỗ trợ | Có SR-…, admin thấy đúng phiếu | Kiểm tra Submit support request/ngữ cảnh |
| Trả/đổi hàng | Có RT-… và đi đến EXCHANGED theo bài chính | Kiểm tra phân công, trạng thái, hành động và đủ tồn |
| Refund online | Có kết quả provider xác nhận | REVIEW/PROCESSING là chưa hoàn tất, cần đối chiếu |
| Báo cáo | Apply report đúng kỳ, CSV tải được | Kiểm tra kỳ và cơ sở tính, không nhập số liệu giả |
| Email/Operations | Hiểu trạng thái và đúng việc cần xử lý | Không cần ép mọi hàng đợi thành công để hoàn tất việc đọc hướng dẫn |

Lần đầu, nên làm xong **9.1–9.21** để hiểu luồng mua–giao–thu COD–đổi hàng. **9.22–9.29** là các bài riêng; chỉ thực hiện hành động ghi dữ liệu khi có điều kiện của bài đó. Các bảng ở chương 1–8 dùng để tra lại giới hạn và ý nghĩa khi gặp trạng thái khác ví dụ.


<a id="troubleshooting"></a>

## 10. Lỗi thường gặp và cách xử lý

| Hiện tượng | Kiểm tra / xử lý |
|---|---|
| Không mở được `/admin` | Đăng nhập đúng tài khoản đã có role ADMIN; USER không được tự nâng quyền |
| Nhầm menu khách với admin | Kiểm tra URL, sidebar và vai trò tài khoản; mở thẳng `/admin` nếu có quyền |
| Lưu local rồi Vercel không đổi | Đối chiếu database/môi trường và phiên bản triển khai; Git không đồng bộ bản ghi quản trị |
| Publish saved content bị mờ | Save content draft trước; không sửa tiếp giữa Save và Publish; xem thông báo lỗi ở đầu trang |
| Save content draft bị mờ | Không có thay đổi, đang tải/lưu hoặc một phần nội dung không hợp lệ; kiểm tra cả FAQ/chính sách |
| Bấm Save nhưng chưa xuất bản được | Chờ thông báo lưu thành công; kéo lên vùng lỗi nếu có; giữ nội dung đang nhập để đối chiếu trước Reload |
| Mất liên hệ/bản đồ sau deploy | Kiểm tra có bản đã Publish trên database của website chưa; trường trống sẽ ẩn kênh tương ứng |
| Dán bản đồ không lưu được | Chỉ dán URL `src` Google Maps embed `pb`, không dán iframe/link chia sẻ ngắn |
| Link Zalo không hợp lệ | Dùng HTTPS `zalo.me/<id>` không thêm query/hash; để trống nếu chưa có link đúng |
| Thay giờ hỗ trợ nhưng khách chưa thấy | Save hours draft rồi Publish saved hours; đây là luồng riêng với Publish nội dung |
| Sản phẩm lưu rồi không thấy phía khách | Kiểm tra Active, danh mục/thương hiệu Visible, Enable SKU và điều kiện bán |
| Có In stock nhưng không mua được | Kiểm tra Opening count, On hand, Reserved, Available; cờ khả dụng không tự tạo tồn |
| Giá/SKU/slug bị từ chối | Giá nhập số nguyên; SKU đúng ký tự HOA; slug không dấu/khoảng trắng; không trùng mã |
| Ảnh không hiện/lưu lỗi | Kiểm tra URL ảnh trực tiếp, host cho phép, file local có thật hoặc cấu hình upload |
| Thông số không lưu | Dùng `Tên: giá trị` từng dòng, không trùng key; giá trị Selection đúng lựa chọn; Number dùng dấu chấm |
| Checkout không bấm được Place Order/Pay Now | Điền đủ địa chỉ và Get delivery quote; chờ quote/form thanh toán sẵn sàng |
| Quote hết hạn/chính sách thay đổi | Lấy lại quote, kiểm tra phí/tổng rồi xác nhận lại |
| Thanh toán pending/unknown | Xem đơn và payment history, dùng Check payment khi được phép; không coi timeout là thất bại chắc chắn |
| Không sửa được giao hàng | Xem lock reason: đơn chưa xác nhận, online chưa Paid, đang xin hủy hoặc trạng thái không cho chuyển |
| Khách nhận hàng nhưng COD chưa Paid | Ghi chứng từ thu COD đúng thực tế; Delivered không tự xác nhận thu tiền |
| Khách trả COD nhưng cửa hàng chưa thấy tiền về | Carrier collection và Store receipt là hai bước; rà remittance và phí bị trừ |
| Không trả lời/đổi trạng thái ticket/return được | Nhận hoặc mở lại hội thoại, Refresh request/return và kiểm tra đúng người phụ trách |
| Không có đơn/hàng để chọn trả | Kiểm tra Delivered + bằng chứng xuất kho + quyền sở hữu + lượng chưa được yêu cầu trước đó |
| Đã nhận trả nhưng kho không tăng | Nhận/kiểm định không tăng tồn; cần đúng bước restock sau kiểm định phù hợp |
| Không có SKU đề nghị đổi | Cùng sản phẩm, giá hiện bằng giá gốc, Enable/hiển thị và đủ Available; xem lại tồn và người xử lý |
| Đề nghị đổi bị thay trong lúc đang duyệt | Refresh/chọn lại hành động, đọc bản mới rồi đánh dấu xác nhận lại |
| Refund APPROVED mà khách chưa nhận tiền | Duyệt hủy mới dừng giao/giải phóng hold; còn submit và xác minh hoàn |
| Gửi hoàn mất phản hồi | Check refund status với khoản đã lưu, đối chiếu sandbox; không tạo lệnh hoàn mới tùy ý |
| Không nhận email | Kiểm tra hộp thư, xác minh email, trạng thái tài khoản, cấu hình sender/worker và Email delivery; contact email không bật sender |
| Email UNKNOWN | Rà bằng chứng trước retry; thử lại có thể gửi trùng, phải xác nhận điều đó |
| Thông báo chưa đổi ngay | Refresh khi cần; các danh sách dùng polling, không cam kết cập nhật tức thì |
| Báo dữ liệu đã thay đổi/409 | Tải bản mới, đối chiếu nội dung và chọn/xác nhận lại; tránh ghi đè người đang làm |
| Operations còn cảnh báo | Kiểm tra sự cố/payment/hold theo tham chiếu; không sửa giả trạng thái để cảnh báo biến mất |

Nếu phải báo lỗi cho người phụ trách kỹ thuật, gửi **trang đang mở, hành động vừa bấm, giờ xảy ra, mã đơn/phiếu và thông báo lỗi**. Không gửi mật khẩu, token đăng nhập, secret hoặc nguyên liên kết xác minh/reset mật khẩu.

<a id="limitations"></a>

## 11. Những phần chưa có hoặc chưa nghiệm thu đầy đủ

Không dùng các bước tưởng tượng để thao tác những chức năng dưới đây:

| Phần | Trạng thái cần biết |
|---|---|
| Review có sao/ảnh xác minh đã mua, bình luận/hỏi đáp sản phẩm | Chưa có luồng hoàn chỉnh để gửi/lưu/kiểm duyệt như tính năng đang dùng được |
| Hồ sơ bảo hành thực tế | Hiện có nội dung và phiếu hỏi; chưa đủ quy trình nhận/sửa/đổi/trả có tiến trình |
| Hoàn tiền một phần sau trả hàng | Chưa hoàn thiện |
| Đổi hàng khác giá / thu-hoàn chênh lệch | Chưa hoàn thiện |
| Hàng đổi thất lạc, giao thất bại, trả/bảo hành tiếp hàng đổi | Cần luồng ngoại lệ/hậu mãi riêng |
| Sổ nhiều địa chỉ, giỏ đồng bộ thiết bị, mua lại, yêu thích, so sánh, báo có hàng | Chưa triển khai đầy đủ |
| Voucher, combo, quà tặng, sale có lịch | Chưa có luồng hoàn chỉnh |
| Quản trị banner/trang chủ | Chưa có module CMS đầy đủ cho banner; CMS hiện tập trung liên hệ/FAQ/chính sách |
| Cảnh báo tồn thấp tự động | Chưa có cấu hình/luồng cảnh báo hoàn chỉnh |
| Đổi vùng giao kèm phí mới; xác thực địa bàn chuẩn đầy đủ; ETA có nguồn | Còn cần phát triển, không tự hứa thời gian giao |
| Đặt vận đơn và webhook giao hàng từ hãng | Chưa tích hợp đầy đủ; hiện ghi nhận thủ công |
| Thu COD một phần, import đối soát, chứng từ điều chỉnh đầy đủ | Chưa hoàn thiện |
| Báo cáo thu ròng/lợi nhuận sau hoàn, phí và giá vốn | Chưa đầy đủ; không gọi báo cáo doanh thu hiện tại là lợi nhuận |
| Import catalog hàng loạt, nhà cung cấp/đơn nhập/phiên kiểm kê | Chưa phải chức năng giao diện hoàn chỉnh hiện có |
| Phân quyền nhân viên chi tiết, nhiều kho/chi nhánh, hóa đơn điện tử | Phạm vi mở rộng |
| Đóng/xóa tài khoản cùng chính sách dữ liệu giao dịch | Chưa có luồng hoàn chỉnh; không tự xóa bản ghi DB |
| Email sự kiện ngoài và các cổng thanh toán/hoàn sandbox | Có code nhưng cần cấu hình và nghiệm thu đúng môi trường/merchant; test local không chứng minh mọi tích hợp ngoài đã đạt |

Đối chiếu bản đang deploy trước khi demo một tính năng mới trong workspace. Dự án chưa được nghiệm thu cho thu tiền thật chỉ dựa vào việc build/tests đạt.

<a id="checklist"></a>

## 12. Checklist sử dụng hằng ngày

### 12.1. Admin

- [ ] Đăng nhập đúng tài khoản và đúng môi trường.
- [ ] Xem Dashboard/Operations và những việc cần rà.
- [ ] Xử lý đơn mới, thanh toán cần kiểm tra và yêu cầu hủy trước khi giao.
- [ ] Kiểm tra đủ hàng, đúng SKU/người nhận trước khi bàn giao.
- [ ] Cập nhật carrier/tracking/trạng thái dựa trên diễn biến thực tế.
- [ ] Ghi riêng chứng từ khách trả COD và tiền vận chuyển chuyển về.
- [ ] Nhận xử lý hội thoại trước khi trả lời/duyệt hồ sơ.
- [ ] Theo dõi hồ sơ trả hàng, kiểm định, restock và các đề nghị đổi đang giữ hàng.
- [ ] Theo dõi refund đến kết quả xác nhận, không dừng ở APPROVED.
- [ ] Kiểm tra cảnh báo kho/hold và lịch sử thay đổi khi cần.
- [ ] Nội dung liên hệ/chính sách/giờ hỗ trợ đã Save và Publish đúng môi trường.
- [ ] Xem thông báo, hàng đợi email và lỗi cần chuyển kỹ thuật.

### 12.2. Khách hàng

- [ ] Kiểm tra đúng phiên bản, số lượng và giá trước khi thêm giỏ.
- [ ] Kiểm tra người nhận, địa chỉ, phí giao và tổng sau báo phí.
- [ ] Chỉ dùng dữ liệu thanh toán thử nghiệm khi demo.
- [ ] Lưu số đơn và kiểm tra trạng thái sau thanh toán.
- [ ] Gửi yêu cầu hỗ trợ có đủ mô tả/ngữ cảnh/ảnh khi cần.
- [ ] Chờ duyệt và hướng dẫn trước khi gửi hàng trả.
- [ ] Đọc kỹ SKU/địa chỉ đề nghị đổi trước khi duyệt.
- [ ] Chỉ xác nhận nhận hàng đổi khi đã nhận và kiểm tra.

## Tài liệu đối chiếu trong repository

- [README dự án](README.md): cách chạy và kiểm tra ứng dụng.
- [Operations runbook](e-commerce/OPERATIONS.md): quy tắc vận hành payment/refund/hold/chat/CMS/returns/email.
- Màn hình và nút thực tế nằm trong `e-commerce/app`; danh sách điều hướng admin nằm tại `e-commerce/app/admin/adminNavigation.ts`.

File hướng dẫn này được đặt ở gốc repository để có thể lưu cùng Git; không nằm trong thư mục `e-commerce/docs` đang bị bỏ qua bởi cấu hình Git của dự án.
