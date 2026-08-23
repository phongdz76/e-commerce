---
name: prisma-mongodb
description: >-
  Sử dụng skill này khi cần thao tác database: thêm/sửa model Prisma, 
  thực hiện CRUD operations, hoặc xử lý các đặc thù của MongoDB với Prisma ORM 
  trong dự án e-commerce.
---

# Prisma + MongoDB — SGTech E-Commerce

## Prisma Client Singleton

Luôn import Prisma client từ file singleton, **KHÔNG** tạo `new PrismaClient()` trực tiếp:

```tsx
// Import đúng cách:
import prisma from "@/libs/prismadb";

// File singleton (libs/prismadb.ts):
import { PrismaClient } from "@prisma/client";

declare global {
  var prisma: PrismaClient | undefined;
}

const client = globalThis.prisma || new PrismaClient();
if (process.env.NODE_ENV !== "production") globalThis.prisma = client;

export default client;
```

## Đặc Thù MongoDB với Prisma

### 1. ID Field
MongoDB dùng ObjectId, cấu hình như sau:
```prisma
model Example {
    id String @id @default(auto()) @map("_id") @db.ObjectId
}
```
- `@map("_id")`: Map sang `_id` của MongoDB
- `@db.ObjectId`: Đánh dấu là kiểu ObjectId
- `@default(auto())`: Tự động sinh ID

### 2. Relation Fields
Khi tạo relation, foreign key cũng phải có `@db.ObjectId`:
```prisma
model Order {
    id     String @id @default(auto()) @map("_id") @db.ObjectId
    userId String @db.ObjectId

    user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

### 3. Embedded Documents (`type` vs `model`)
MongoDB hỗ trợ embedded documents. Dùng `type` (không phải `model`) cho dữ liệu nhúng:
```prisma
// ✅ ĐÚNG — embedded document
type CartProductProps {
    id          String @db.ObjectId
    name        String
    price       Float
    quantity    Int
    selectedImg Image
}

type Image {
    color     String
    colorCode String
    image     String
}

// Sử dụng trong model:
model Order {
    products CartProductProps[]
    address  Address?
}
```

**Khác biệt `type` vs `model`:**
- `type`: Nhúng trực tiếp vào document cha, KHÔNG có collection riêng
- `model`: Tạo collection riêng, cần relation

### 4. Unique Compound Index
```prisma
model Account {
    @@unique([provider, providerAccountId])
}
```

## Schema Hiện Tại

```prisma
// User: Tài khoản người dùng
// Order: Đơn hàng (chứa CartProductProps[] và Address?)
// Account: OAuth accounts (Google)
// CartProductProps: Sản phẩm trong đơn (embedded type)
// Image: Ảnh sản phẩm (embedded type)
// Address: Địa chỉ giao hàng (embedded type)
// Role: USER | ADMIN (enum)
```

## CRUD Operations Phổ Biến

### Tạo (Create)
```tsx
const user = await prisma.user.create({
  data: {
    name: "John",
    email: "john@example.com",
    hashedPassword: hashedPassword,
    role: "USER",
  },
});
```

### Đọc (Read)
```tsx
// Tìm theo ID
const user = await prisma.user.findUnique({
  where: { id: userId },
});

// Tìm theo điều kiện
const user = await prisma.user.findFirst({
  where: {
    OR: [
      { email: value },
      { name: value },
    ],
  },
});

// Danh sách với filter
const orders = await prisma.order.findMany({
  where: { userId: currentUser.id },
  orderBy: { createDate: "desc" },
  include: { user: true },
});
```

### Cập nhật (Update)
```tsx
const updated = await prisma.user.update({
  where: { id: userId },
  data: {
    name: newName,
    image: newImage,
    emailVerified: new Date(),
  },
});
```

### Xóa (Delete)
```tsx
await prisma.order.delete({
  where: { id: orderId },
});
```

## Quy Trình Thay Đổi Schema

1. Sửa file `prisma/schema.prisma`
2. Chạy regenerate client:
   ```bash
   npx prisma generate
   ```
3. Sync lên MongoDB (KHÔNG dùng migrations):
   ```bash
   npx prisma db push
   ```
4. Nếu cần xem database:
   ```bash
   npx prisma studio
   ```

## Lưu Ý Quan Trọng

- **KHÔNG** dùng `prisma migrate` với MongoDB — chỉ dùng `prisma db push`
- **Date serialization**: Khi trả về client, convert `Date` sang `string` bằng `.toISOString()`
- **Cascade delete**: Dùng `onDelete: Cascade` cho relations phụ thuộc (Account, Order)
- **Optional fields**: Dùng `?` cho nullable fields (ví dụ: `image String?`)
