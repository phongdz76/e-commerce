---
name: project-overview
description: >-
  Sử dụng skill này khi cần hiểu kiến trúc tổng thể, cấu trúc thư mục, 
  tech stack, hoặc quy ước coding của dự án SGTech e-commerce. Kích hoạt khi 
  bắt đầu một task mới hoặc khi cần context về cách dự án được tổ chức.
---

# SGTech E-Commerce — Bản Đồ Dự Án

## Tech Stack

| Thành phần | Công nghệ | Phiên bản |
|---|---|---|
| Framework | Next.js (App Router + Pages Router) | 16.x |
| Language | TypeScript | 5.x |
| Database | MongoDB | — |
| ORM | Prisma | 6.19 |
| Auth | NextAuth (Google + Facebook + Credentials) | 4.x |
| Payment | VNPAY + MoMo + Stripe | — |
| Styling | Tailwind CSS | 4.x |
| UI Library | MUI (Material UI) | 7.x |
| Forms | React Hook Form | 7.x |
| State | Custom hook `useCart` (localStorage) | — |
| Image Upload | Cloudinary (next-cloudinary) | — |
| Email | Nodemailer | 7.x |
| HTTP Client | Axios | — |
| Notifications | react-hot-toast | — |
| Icons | react-icons + @heroicons/react | — |
| Font | Poppins (body) + Redressed (logo) | — |
| Package Manager | bun (bun.lock) + npm (package-lock.json) | — |

## Cấu Trúc Thư Mục

```text
e-commerce/
├── app/                          # Next.js App Router
│   ├── layout.tsx                # Root layout (Poppins font, NavBar, Footer, CartProvider, Toaster)
│   ├── page.tsx                  # Trang chủ (HomeBanner + ProductCard grid)
│   ├── globals.css               # Global styles (minimal)
│   ├── api/                      # API Routes (App Router)
│   │   ├── create-payment-intent/  # Stripe payment intent
│   │   ├── forgot-password/        # Gửi email reset password
│   │   ├── login/                  # (unused - auth qua pages/)
│   │   ├── momo/                   # MoMo payment
│   │   │   ├── create-payment-url/   # Tạo MoMo payment URL
│   │   │   ├── momo-return/          # MoMo redirect callback
│   │   │   └── momo-ipn/             # MoMo IPN (server-to-server)
│   │   ├── order/                  # Tạo order (COD, etc.)
│   │   ├── profile/                # PATCH profile
│   │   ├── register/               # Đăng ký tài khoản
│   │   ├── reset-password/         # Reset password
│   │   └── vnpay/                  # VNPAY payment URL + callback
│   ├── cart/                     # Trang giỏ hàng
│   │   ├── page.tsx              # Server component wrapper
│   │   ├── CartClient.tsx        # Client component chính
│   │   └── ItemContent.tsx       # Hiển thị từng item trong giỏ
│   ├── checkout/                 # Trang thanh toán
│   │   ├── page.tsx              # Server wrapper
│   │   ├── CheckoutClient.tsx    # Stripe Elements + VNPay flow
│   │   └── CheckoutForm.tsx      # Form thanh toán (address, phone, payment method)
│   ├── components/               # Shared components
│   │   ├── Avatar.tsx            # Avatar (Image hoặc FaUserCircle)
│   │   ├── Button.tsx            # Button (outline, small, icon variants)
│   │   ├── Container.tsx         # Max-width wrapper (max-w-[1920px])
│   │   ├── FormWrap.tsx          # Form centering wrapper (max-w-[650px])
│   │   ├── Headinng.tsx          # Heading h1 (center option) — Lưu ý: tên file bị typo
│   │   ├── banner/HomeBanner.tsx # Slideshow banner (auto-play, swipe, dots)
│   │   ├── footer/              
│   │   │   ├── Footer.tsx        # Footer (map, social links, categories)
│   │   │   └── FooterList.tsx    # Footer column wrapper
│   │   ├── inputs/
│   │   │   ├── Input.tsx         # Reusable input (floating label, password toggle)
│   │   │   └── ImageUpload.tsx   # Cloudinary upload widget
│   │   ├── nav/
│   │   │   ├── NavBar.tsx        # Server component (getCurrentUser)
│   │   │   ├── CartCount.tsx     # Cart icon + badge
│   │   │   ├── UserMenu.tsx      # User dropdown menu
│   │   │   ├── MenuItem.tsx      # Menu item
│   │   │   └── BackDrop.tsx      # Backdrop overlay
│   │   └── products/
│   │       └── ProductCard.tsx   # Product card (image, name, rating, price)
│   ├── hooks/
│   │   └── useCart.tsx           # Cart state management (Context + localStorage)
│   ├── login/                    # Trang đăng nhập (LoginForm.tsx)
│   ├── register/                 # Trang đăng ký
│   ├── forgot-password/          # Quên mật khẩu
│   ├── reset-password/           # Reset mật khẩu (ResetPasswordForm.tsx)
│   ├── product/[productId]/      # Chi tiết sản phẩm
│   ├── profile/                  # Trang hồ sơ (Profile.tsx — avatar, address, password)
│   └── providers/
│       └── CartProvider.tsx      # CartContext provider wrapper
├── pages/                        # Next.js Pages Router
│   └── api/auth/[...nextauth].ts # NextAuth config (Google + Credentials)
├── actions/
│   └── getCurrentUser.ts         # Server action: lấy user hiện tại từ session
├── libs/
│   └── prismadb.ts               # Prisma client singleton
├── prisma/
│   └── schema.prisma             # Database schema (User, Order, Account, etc.)
├── types/
│   └── index.ts                  # Type definitions (safeUser)
├── utils/
│   ├── apiPaths.ts               # API route constants
│   ├── externalApiPaths.ts       # Vietnam Provinces API paths
│   ├── formatPrice.ts            # Format VND price
│   ├── truncateText.ts           # Truncate text utility
│   └── products.tsx              # Static product data (hardcoded)
├── docs/
│   └── clean_architecture_course.md  # Clean Architecture tài liệu
└── public/Image/                 # Banner images, QR code
```

## Data Models (Prisma)

```text
User ──┬── Account[]     (OAuth providers)
       └── Order[]       (Đơn hàng)
             ├── CartProductProps[]  (Embedded: sản phẩm trong đơn)
             │     └── Image        (Embedded: ảnh sản phẩm)
             └── Address?           (Embedded: địa chỉ giao)

Enum Role: USER | ADMIN
```

### Lưu ý quan trọng:
- **MongoDB**: Sử dụng `@map("_id")`, `@db.ObjectId`, embedded `type` (không phải `model`)
- **Không dùng migrations**: MongoDB chỉ dùng `npx prisma db push`
- **Prisma client singleton**: Import từ `@/libs/prismadb`

## Quy Ước Coding

1. **Page pattern**: `page.tsx` (server) → `*Client.tsx` (client component)
2. **"use client"**: Bắt buộc cho components có interactivity
3. **Import alias**: `@/` trỏ đến root project
4. **API paths**: Tập trung trong `utils/apiPaths.ts` và `utils/externalApiPaths.ts`
5. **Error handling**: `react-hot-toast` cho user-facing errors, `console.log` cho dev
6. **Auth check**: `getCurrentUser()` từ `@/actions/getCurrentUser`
7. **Currency**: VND (Vietnamese Dong), sử dụng `formatPrice()` utility
8. **NextAuth**: Cấu hình ở Pages Router (`pages/api/auth/[...nextauth].ts`), KHÔNG phải App Router
