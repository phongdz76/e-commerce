---
name: create-feature
description: >-
  Sử dụng skill này khi người dùng yêu cầu tạo một tính năng mới, thêm route, 
  page, hoặc module mới vào dự án e-commerce. Hướng dẫn quy trình chuẩn từ tạo 
  route, component, API, đến cập nhật types và API paths.
---

# Tạo Tính Năng Mới — SGTech E-Commerce

## Quy Trình Chuẩn

### Bước 1: Tạo Route Page (Server Component)

Tạo file `app/<feature>/page.tsx` làm entry point. Đây là **server component** — nơi fetch dữ liệu và truyền xuống client component.

```tsx
// app/<feature>/page.tsx
import Container from "../components/Container";
import { getCurrentUser } from "@/actions/getCurrentUser";
import <Feature>Client from "./<Feature>Client";

export default async function <Feature>Page() {
  const currentUser = await getCurrentUser();

  return (
    <div className="pt-8">
      <Container>
        <<Feature>Client currentUser={currentUser} />
      </Container>
    </div>
  );
}
```

**Lưu ý:**
- Page mặc định là **server component** — KHÔNG thêm `"use client"`
- Dùng `getCurrentUser()` nếu cần thông tin user
- Wrap nội dung bằng `<Container>` để giữ max-width nhất quán

### Bước 2: Tạo Client Component

Tạo file `app/<feature>/<Feature>Client.tsx` chứa logic tương tác.

```tsx
// app/<feature>/<Feature>Client.tsx
"use client";

import { safeUser } from "@/types";
import Heading from "../components/Headinng";

interface <Feature>ClientProps {
  currentUser: safeUser | null;
}

export default function <Feature>Client({ currentUser }: <Feature>ClientProps) {
  return (
    <div>
      <Heading title="Feature Name" />
      {/* Nội dung */}
    </div>
  );
}
```

**Pattern quan trọng:**
- `"use client"` ở dòng đầu tiên
- Props interface rõ ràng
- Import `safeUser` từ `@/types` (không import `User` từ Prisma trực tiếp)

### Bước 3: Tạo API Route (nếu cần)

Tạo file `app/api/<feature>/route.ts`:

```tsx
// app/api/<feature>/route.ts
import { NextResponse } from "next/server";
import prisma from "@/libs/prismadb";
import { getCurrentUser } from "@/actions/getCurrentUser";

export async function POST(request: Request) {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    // ... business logic
    return NextResponse.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Something went wrong";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

**Quy tắc:**
- Luôn kiểm tra auth bằng `getCurrentUser()`
- Trả về `NextResponse.json()` 
- Error handling: try-catch + typed error message
- HTTP methods: `GET`, `POST`, `PATCH`, `DELETE` tương ứng với export function

### Bước 4: Cập nhật Prisma Schema (nếu cần model mới)

```prisma
// prisma/schema.prisma
model NewModel {
    id        String   @id @default(auto()) @map("_id") @db.ObjectId
    // ... fields
    userId    String   @db.ObjectId
    createdAt DateTime @default(now())
    updatedAt DateTime @updatedAt

    user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

Sau khi cập nhật schema:
```bash
npx prisma generate   # Regenerate Prisma Client
npx prisma db push    # Sync schema to MongoDB (KHÔNG dùng migrations)
```

### Bước 5: Thêm Types

Cập nhật `types/index.ts` nếu cần type mới cho client:

```tsx
// types/index.ts
export type SafeNewModel = Omit<NewModel, "createdAt" | "updatedAt"> & {
  createdAt: string;
  updatedAt: string;
};
```

**Pattern:** Dùng `Omit` để loại bỏ `Date` fields, thay bằng `string` (ISO format)

### Bước 6: Cập nhật API Paths

Thêm path vào `utils/apiPaths.ts`:

```tsx
export const API_PATHS = {
  // ... existing paths
  NEW_FEATURE: {
    CREATE: "/api/<feature>",
    GET_BY_ID: "/api/<feature>/[id]",
  },
};
```

## Checklist Xác Minh

- [ ] Page server component tạo đúng tại `app/<feature>/page.tsx`
- [ ] Client component có `"use client"` directive
- [ ] API route trả về đúng format `NextResponse.json()`
- [ ] Prisma schema sync: `npx prisma generate` + `npx prisma db push`
- [ ] Types cập nhật tại `types/index.ts`
- [ ] API paths cập nhật tại `utils/apiPaths.ts`
- [ ] Import sử dụng alias `@/` thay vì relative path dài
- [ ] Error handling bằng `react-hot-toast`
