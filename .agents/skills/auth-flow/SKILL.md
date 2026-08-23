---
name: auth-flow
description: >-
  Sử dụng skill này khi cần thêm protected routes, kiểm tra phân quyền 
  (role ADMIN/USER), làm việc với NextAuth session, hoặc triển khai 
  các tính năng liên quan đến xác thực và đăng nhập trong dự án e-commerce.
---

# Xác Thực & Phân Quyền — SGTech E-Commerce

## Cấu Hình NextAuth

**Vị trí:** `pages/api/auth/[...nextauth].ts` (Pages Router — KHÔNG phải App Router)

### Providers:
1. **Google OAuth** — Đăng nhập bằng Google
2. **Facebook OAuth** — Đăng nhập bằng Facebook
3. **Credentials** — Đăng nhập bằng email/username + password (bcrypt)

### Cấu trúc Session:
```tsx
// Session strategy: JWT
session: { strategy: "jwt" }

// Session chứa:
{
  user: {
    id: string;        // userId từ token
    name: string;
    email: string;
    image: string;
  },
  accessToken: string;  // Google access token
  idToken: string;      // Google ID token
}
```

## Lấy User Hiện Tại

### Server-side (Server Components, API Routes)
```tsx
import { getCurrentUser } from "@/actions/getCurrentUser";

// Trong server component hoặc API route:
const currentUser = await getCurrentUser();
// Trả về: { id, name, email, image, address, phoneNumber, role, hasPassword, createdAt, updatedAt, emailVerified }
// Hoặc null nếu chưa đăng nhập
```

**Lưu ý:** `getCurrentUser()` gọi `getServerSession(authOptions)` bên trong, rồi query Prisma để lấy đầy đủ thông tin user.

### Client-side
```tsx
"use client";

// Cách 1: Nhận từ server component qua props (KHUYẾN KHÍCH)
interface Props {
  currentUser: safeUser | null;
}
export default function MyClient({ currentUser }: Props) {
  // currentUser đã có sẵn, không cần fetch
}

// Cách 2: Dùng next-auth useSession (ít dùng trong project này)
import { useSession } from "next-auth/react";
const { data: session } = useSession();
```

## Bảo Vệ API Routes

### Pattern chuẩn:
```tsx
// app/api/protected/route.ts
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/actions/getCurrentUser";

export async function POST(request: Request) {
  const currentUser = await getCurrentUser();

  // Kiểm tra đăng nhập
  if (!currentUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Kiểm tra role ADMIN
  if (currentUser.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // ... business logic
}
```

## Bảo Vệ Page Routes

### Server Component (Page):
```tsx
// app/admin/page.tsx
import { getCurrentUser } from "@/actions/getCurrentUser";
import { redirect } from "next/navigation";

export default async function AdminPage() {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    redirect("/login");
  }

  if (currentUser.role !== "ADMIN") {
    redirect("/");
  }

  return <AdminDashboard currentUser={currentUser} />;
}
```

### Client Component — Redirect khi chưa đăng nhập:
```tsx
"use client";
import { useRouter } from "next/navigation";

export default function CheckoutClient({ currentUser }) {
  const router = useRouter();
  
  // Redirect to login with callback
  if (!currentUser) {
    router.push("/login?callbackUrl=/checkout");
    return null;
  }
}
```

## Phân Quyền (Role-based)

### Enum Role (Prisma):
```prisma
enum Role {
    USER
    ADMIN
}
```

### Kiểm tra Role:
```tsx
// Server-side
const currentUser = await getCurrentUser();
if (currentUser?.role === "ADMIN") {
  // Admin-only logic
}

// Client-side (từ props)
{currentUser?.role === "ADMIN" && <AdminPanel />}
```

## Luồng Đăng Ký

```text
1. User điền form (RegisterForm.tsx)
2. POST /api/register → hash password bằng bcrypt → prisma.user.create()
3. Redirect về /login
```

## Luồng Đăng Nhập

```text
1. Credentials: signIn("credentials", { emailOrUsername, password, redirect: false })
   → NextAuth authorize() → prisma.user.findFirst() → bcrypt compare
   
2. Google: signIn("google")
   → OAuth flow → PrismaAdapter tự tạo/link Account
   → linkAccount event: cập nhật image + emailVerified

3. Facebook: signIn("facebook")
   → OAuth flow → PrismaAdapter tự tạo/link Account
   → linkAccount event: cập nhật image + emailVerified
   → Lưu ý: tài khoản FB tạo trên mobile có thể không trả về email
```

## Luồng Forgot/Reset Password

```text
1. POST /api/forgot-password → { email }
   → Tìm user bằng email
   → Tạo resetPasswordToken (random bytes, hex)
   → Lưu token + expiry (1 giờ) vào User
   → Gửi email chứa link: /reset-password?token=xxx (Nodemailer)

2. POST /api/reset-password → { token, password }
   → Tìm user có token chưa hết hạn
   → Hash password mới bằng bcrypt
   → Cập nhật hashedPassword, xóa token
```

## Đăng Xuất
```tsx
"use client";
import { signOut } from "next-auth/react";

// Đăng xuất:
signOut({ callbackUrl: "/login" });
```

## Lưu Ý Quan Trọng

1. **NextAuth config ở Pages Router**: File `pages/api/auth/[...nextauth].ts`, KHÔNG phải `app/api/auth/`
2. **Import authOptions**: `import { authOptions } from "@/pages/api/auth/[...nextauth]"`
3. **allowDangerousEmailAccountLinking**: Đã bật cho Google và Facebook — cho phép link account cùng email
4. **Password lưu dưới dạng bcrypt hash**: Sử dụng `hash()` khi tạo, `compare()` khi verify
5. **Session strategy JWT**: Không lưu session trong DB, dùng JWT token
6. **safeUser type**: Loại bỏ sensitive fields (hashedPassword, resetPasswordToken) khi gửi về client
