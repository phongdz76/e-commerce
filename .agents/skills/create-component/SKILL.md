---
name: create-component
description: >-
  Sử dụng skill này khi cần tạo React component mới hoặc sửa component hiện có.
  Hướng dẫn patterns Server vs Client component, cấu trúc tổ chức, và cách sử dụng 
  các reusable components có sẵn trong dự án e-commerce.
---

# Tạo Component — SGTech E-Commerce

## Server Component vs Client Component

### Server Component (Mặc định)
- **KHÔNG** có `"use client"` directive
- Có thể `async` và gọi `await` trực tiếp
- Dùng cho: fetch data, getCurrentUser, SEO-critical content
- **KHÔNG** dùng: useState, useEffect, onClick, event handlers

```tsx
// ✅ Server component
import { getCurrentUser } from "@/actions/getCurrentUser";

const NavBar = async () => {
  const currentUser = await getCurrentUser();
  return <nav>...</nav>;
};
```

### Client Component
- **BẮT BUỘC** có `"use client"` ở dòng đầu tiên
- Dùng cho: interactivity, hooks, event handlers, browser APIs

```tsx
// ✅ Client component
"use client";

import { useState } from "react";

export default function MyComponent() {
  const [state, setState] = useState(false);
  return <div onClick={() => setState(true)}>...</div>;
}
```

## Tổ Chức Thư Mục

```text
app/components/
├── Avatar.tsx              # Standalone components
├── Button.tsx
├── Container.tsx
├── FormWrap.tsx
├── Headinng.tsx
├── banner/                 # Feature-grouped components
│   └── HomeBanner.tsx
├── footer/
│   ├── Footer.tsx
│   └── FooterList.tsx
├── inputs/
│   ├── Input.tsx
│   └── ImageUpload.tsx
├── nav/
│   ├── NavBar.tsx
│   ├── CartCount.tsx
│   ├── UserMenu.tsx
│   ├── MenuItem.tsx
│   └── BackDrop.tsx
└── products/
    └── ProductCard.tsx
```

**Quy tắc đặt tên:**
- Component file: `PascalCase.tsx` (ví dụ: `ProductCard.tsx`)
- Thư mục nhóm: `lowercase` (ví dụ: `products/`, `nav/`)
- Feature pages: `app/<feature>/<Feature>Client.tsx`

## Reusable Components Có Sẵn

### Container — Wrapper max-width
```tsx
import Container from "@/app/components/Container";

// Max-width 1920px, responsive padding
<Container>
  {children}
</Container>
```

### Button — Nút bấm đa năng
```tsx
import Button from "@/app/components/Button";

// Variants:
<Button label="Primary" onClick={handleClick} />          // Solid dark
<Button label="Outline" onClick={handleClick} outline />    // Outline
<Button label="Small" onClick={handleClick} small />        // Nhỏ
<Button label="With Icon" onClick={handleClick} icon={MdSave} />  // Có icon
<Button label="Custom" onClick={handleClick} custom="bg-blue-500 text-white" />

// Props: label, disabled?, outline?, small?, custom?, icon?, onClick
```

### Input — Form input với floating label
```tsx
import Input from "@/app/components/inputs/Input";

<Input
  id="email"
  label="Email"
  type="text"          // "text" | "password" | "email"
  disabled={isLoading}
  required
  register={register}  // từ react-hook-form
  errors={errors}
/>

// Tự động có: floating label, password toggle, helper text
```

### Heading — Tiêu đề trang
```tsx
import Heading from "@/app/components/Headinng";  // Lưu ý: typo trong filename

<Heading title="Shopping Cart" />         // Căn trái (mặc định)
<Heading title="Shopping Cart" center />  // Căn giữa
```

### FormWrap — Wrapper cho form
```tsx
import FormWrap from "@/app/components/FormWrap";

// Centering + shadow + max-width 650px
<FormWrap>
  <LoginForm />
</FormWrap>
```

### Avatar — Ảnh đại diện
```tsx
import Avatar from "@/app/components/Avatar";

<Avatar src={user.image} />          // Mặc định 30px
<Avatar src={user.image} size={50} /> // Custom size
<Avatar />                            // Fallback: FaUserCircle icon
```

### ImageUpload — Upload ảnh Cloudinary
```tsx
import ImageUpload from "@/app/components/inputs/ImageUpload";

<ImageUpload
  value={imageUrl}
  onChange={(url) => setValue("image", url)}
  uploadPreset="ecommerce_avatar"    // Cloudinary preset
/>
```

## Pattern Tạo Component Mới

### 1. Standalone Component (dùng ở nhiều nơi)
Đặt trực tiếp trong `app/components/`:
```tsx
// app/components/Badge.tsx
"use client";

interface BadgeProps {
  text: string;
  variant?: "success" | "warning" | "error";
}

export default function Badge({ text, variant = "success" }: BadgeProps) {
  const colors = {
    success: "bg-green-100 text-green-800",
    warning: "bg-yellow-100 text-yellow-800",
    error: "bg-red-100 text-red-800",
  };

  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[variant]}`}>
      {text}
    </span>
  );
}
```

### 2. Feature Component (chỉ dùng trong 1 feature)
Đặt trong thư mục feature hoặc thư mục con:
```tsx
// app/components/products/ProductFilter.tsx
// hoặc: app/products/ProductFilter.tsx (nếu chỉ dùng ở trang products)
```

### 3. Page-level Client Component
Đặt cùng thư mục với `page.tsx`:
```tsx
// app/orders/page.tsx (server)
// app/orders/OrdersClient.tsx (client — logic và UI)
```

## Checklist

- [ ] Xác định server hay client component
- [ ] `"use client"` directive nếu là client component
- [ ] Interface props rõ ràng (không dùng `any`)
- [ ] Import reusable components thay vì viết lại
- [ ] Đặt file đúng vị trí theo quy tắc tổ chức
- [ ] Export default cho component chính
