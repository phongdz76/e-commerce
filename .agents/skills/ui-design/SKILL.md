---
name: ui-design
description: >-
  Sử dụng skill này khi cần thiết kế giao diện, xây dựng layout, styling, 
  hoặc tạo trang UI mới. Bao gồm design system, color palette, responsive patterns, 
  và các mẫu giao diện chuẩn đang dùng trong dự án SGTech e-commerce.
---

# Thiết Kế Giao Diện — SGTech E-Commerce

## Design System

### Fonts
```tsx
// Root layout (app/layout.tsx)
import { Poppins } from "next/font/google";        // Body font
import { Redressed } from "next/font/google";       // Logo font

const poppins = Poppins({ subsets: ["latin"], weight: ["400", "700"] });
```

### Color Palette
| Vai trò | Tailwind Class | Hex |
|---|---|---|
| Body text | `text-slate-700` | #334155 |
| Primary brand | `text-teal-400` | #2DD4BF |
| Background light | `bg-slate-50` | #F8FAFC |
| NavBar / Card bg | `bg-slate-200` | #E2E8F0 |
| Footer bg | `bg-slate-700` | #334155 |
| Border | `border-slate-200` / `border-slate-300` | — |
| Button primary | `bg-slate-700 text-white` | — |
| Button outline | `bg-white text-slate-700 border-slate-700` | — |
| Accent (banner CTA) | `bg-[#00b7bd]` | #00B7BD |
| Error | `text-rose-500` / `border-rose-500` | — |
| Link | `text-blue-500` / `text-blue-600` | — |
| Success | `text-teal-500` | — |
| Disabled | `opacity-70 cursor-not-allowed` | — |

### Logo
```tsx
<span className="text-black">SG</span>
<span className="text-teal-400">Tech</span>
// Font: Redressed (NavBar), font-bold text-2xl (Footer)
```

## Layout Patterns

### Trang Chính (Container Layout)
```tsx
<Container>           {/* max-w-[1920px] mx-auto xl:px-20 md:px-2 px-4 */}
  <HomeBanner />
  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 
                  xl:grid-cols-5 2xl:grid-cols-6 gap-4 mt-8">
    {products.map(p => <ProductCard data={p} />)}
  </div>
</Container>
```

### Trang Form (FormWrap Layout)
Dùng cho Login, Register, Forgot Password, Reset Password:
```tsx
<Container>
  <FormWrap>            {/* min-h-[65vh] flex items-center justify-center */}
    <div className="max-w-[650px] w-full shadow-xl rounded-md p-4 md:p-8">
      <Heading title="Login" />
      <Input ... />
      <Button ... />
    </div>
  </FormWrap>
</Container>
```

### Trang Profile (Card Layout)
```tsx
<div className="w-full max-w-[760px] mx-auto rounded-2xl border 
                border-slate-300 bg-slate-50 px-5 py-6 md:px-8 md:py-8">
  <form className="w-full flex flex-col gap-5">
    {/* Avatar section */}
    {/* Form fields */}
    {/* Action buttons */}
  </form>
</div>
```

### Trang Checkout (Two-section Layout)
```tsx
<form>
  <Heading title="Enter your details to complete checkout" />
  <h2 className="text-lg font-semibold mt-4 mb-4">Delivery Information</h2>
  {/* Address fields */}
  <h2 className="text-lg font-semibold mt-6 mb-4">Payment Information</h2>
  {/* Payment options */}
  <div className="py-4 text-center text-slate-700 text-xl font-bold">
    Total: {price}
  </div>
  <Button label="Pay Now" />
</form>
```

## Form Patterns

### Input Field Standard (không dùng reusable Input component)
Dùng trong Profile, Checkout — khi cần kiểm soát nhiều hơn:
```tsx
const inputClassName = "w-full rounded-lg border border-slate-300 bg-white 
  px-4 py-3 text-base outline-none transition focus:border-slate-400 
  disabled:cursor-not-allowed disabled:opacity-70";

<div className="flex flex-col gap-2">
  <label className="text-sm font-medium text-slate-700">
    Field Name <span className="text-rose-500">*</span>
  </label>
  <input type="text" className={inputClassName} disabled={isLoading} />
</div>
```

### Select Field
```tsx
<div className="flex flex-col gap-2">
  <label className="text-sm font-medium text-slate-700">Province / City</label>
  <select className={inputClassName} required disabled={!previousSelected}>
    <option value="" disabled>Select Province / City</option>
    {options.map(opt => (
      <option key={opt.code} value={opt.code}>{opt.name}</option>
    ))}
  </select>
</div>
```

### Grid Layout cho Form
```tsx
<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
  <div className="flex flex-col gap-2">...</div>
  <div className="flex flex-col gap-2">...</div>
</div>
```

### Radio Group (Payment Method)
```tsx
<div className="flex flex-col gap-3 mb-6">
  <label className="flex items-center gap-2 cursor-pointer border p-3 
                    rounded-lg hover:bg-slate-50">
    <input type="radio" name="method" value="VNPAY"
           className="w-4 h-4 text-blue-600 focus:ring-blue-500" />
    <span className="font-medium text-slate-700">Thanh toán qua VNPay</span>
  </label>
</div>
```

### Password Field với Toggle
```tsx
<div className="relative">
  <input
    type={showPassword ? "text" : "password"}
    className="w-full rounded-lg border border-slate-300 bg-white 
               px-4 py-3 pr-12 text-base outline-none transition 
               focus:border-slate-400"
  />
  <button
    type="button"
    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500"
    onClick={() => setShowPassword(prev => !prev)}
  >
    {showPassword ? <AiOutlineEyeInvisible size={20} /> : <AiOutlineEye size={20} />}
  </button>
</div>
```

### Action Buttons
```tsx
<div className="flex items-center gap-3 pt-2">
  <button type="submit" disabled={isLoading}
    className="px-6 py-3 rounded-lg bg-blue-500 text-white font-semibold 
               transition hover:bg-blue-600 disabled:opacity-70 disabled:cursor-not-allowed">
    {isLoading ? "Saving..." : "Save Changes"}
  </button>
  <button type="button" disabled={isLoading}
    className="px-6 py-3 rounded-lg border border-slate-300 bg-white text-slate-700 
               font-medium transition hover:bg-slate-100 disabled:opacity-70">
    Reset
  </button>
</div>
```

## Responsive Breakpoints

| Breakpoint | Tailwind | Dùng cho |
|---|---|---|
| Default | — | Mobile first (< 640px) |
| `sm` | 640px | Tablet nhỏ |
| `md` | 768px | Tablet, 2 cột form |
| `lg` | 1024px | Desktop nhỏ |
| `xl` | 1280px | Desktop (padding xl:px-20) |
| `2xl` | 1536px | Desktop lớn (6 cột grid) |

### Product Grid Responsive:
```
Mobile:    2 cột (grid-cols-2)
Tablet:    3 cột (sm:grid-cols-3)  
Desktop:   4 cột (lg:grid-cols-4)
Wide:      5 cột (xl:grid-cols-5)
Ultra:     6 cột (2xl:grid-cols-6)
```

## Card Patterns

### Product Card
```tsx
<div className="col-span-1 cursor-pointer border-[1.2px] border-slate-200 
                bg-slate-50 rounded-sm p-3 hover:shadow-lg hover:border-slate-300 
                text-center text-xs transition-transform duration-300 ease-out 
                transform-gpu hover:scale-105 hover:-translate-y-1 
                max-w-[200px] w-full h-full">
  <div className="aspect-square w-full overflow-hidden relative">
    <Image src={...} fill className="object-contain p-2" />
  </div>
  <div className="mt-1 font-medium text-xs">{name}</div>
  <Rating value={rating} readOnly size="small" />
  <div className="text-xs">{reviews} reviews</div>
  <div className="font-semibold text-sm">{price}</div>
</div>
```

### Info Card (Saved Delivery Info)
```tsx
<div className="rounded-lg border border-slate-300 bg-slate-50 p-4 shadow-sm">
  <div className="flex items-start justify-between gap-3">
    <div className="space-y-2">
      <p className="text-sm font-semibold text-slate-700">Title</p>
      <p className="text-sm text-slate-600">Content</p>
    </div>
    <button className="text-sm text-blue-600 font-medium hover:underline 
                       bg-white px-3 py-1 rounded border border-blue-200">
      Change
    </button>
  </div>
</div>
```

### Alert/Notice Card
```tsx
<div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 
                text-blue-700 text-sm leading-6">
  Thông báo quan trọng cho người dùng
</div>
```

## Banner / Slider

### HomeBanner Pattern
- Aspect ratio: `aspect-[16/9] md:aspect-[4/1]`
- Auto-play: 5 giây, pause khi hover hoặc touch
- Navigation: Prev/Next buttons (ẩn, hiện khi hover) + dots indicator
- Swipe support: touchStart/touchMove/touchEnd
- IntersectionObserver: Dừng auto-play khi không visible
- Gradient overlay: `bg-gradient-to-b from-transparent to-black/80`

## Empty State
```tsx
<div className="flex flex-col items-center justify-center min-h-[50vh]">
  <div className="text-xl">Your cart is empty</div>
  <Link href="/" className="text-slate-500 flex items-center gap-1 mt-2">
    <MdArrowBack size={15} />
    <span className="text-sm">Start Shopping</span>
  </Link>
</div>
```

## Loading / Success State
```tsx
// Loading
<div className="w-full text-center py-6">
  <p className="text-lg">Loading checkout...</p>
</div>

// Success
<div className="flex items-center justify-center flex-col gap-4">
  <div className="text-teal-500 text-center">Payment successful!</div>
  <div className="max-w-[220px] w-full mx-auto mt-4">
    <Button label="View Your Orders" onClick={() => router.push("/orders")} />
  </div>
</div>

// Redirect
<div className="w-full text-center py-6 flex flex-col gap-4">
  <p className="text-lg">You are already logged in</p>
  <p className="text-sm text-gray-500">Redirecting to home page...</p>
</div>
```

## Third-party UI Components

### MUI — Chỉ dùng khi cần
```tsx
import { Rating } from "@mui/material";    // Product rating stars
import { Checkbox } from "@mui/material";  // Remember me checkbox

// Custom MUI styling:
<Checkbox sx={{
  padding: 0,
  color: "#9CA3AF",
  "&.Mui-checked": { color: "#4F46E5" },
}} />
```

### react-icons — Icons
```tsx
import { MdArrowBack, MdFacebook } from "react-icons/md";
import { FaTwitter, FaInstagram, FaYoutube } from "react-icons/fa";
import { AiOutlineGoogle, AiOutlineEye, AiOutlineEyeInvisible } from "react-icons/ai";
import { FaUserCircle } from "react-icons/fa";
```

### react-hot-toast — Notifications
```tsx
import toast from "react-hot-toast";

toast.success("Profile updated successfully");
toast.error("Something went wrong!");

// Toaster config (layout.tsx):
<Toaster toastOptions={{
  style: { background: "rgb(51 65 85)", color: "#fff" },
}} />
```

## Checklist Thiết Kế

- [ ] Dùng color palette nhất quán (slate + teal-400)
- [ ] Responsive: test mobile → tablet → desktop
- [ ] Loading state cho tất cả async actions
- [ ] Error state với toast notification
- [ ] Empty state cho lists rỗng
- [ ] Disabled state cho buttons khi loading (`disabled:opacity-70`)
- [ ] Hover effects cho interactive elements
- [ ] Focus states cho form inputs
- [ ] Wrap content bằng `<Container>` hoặc `<FormWrap>`
- [ ] Dùng `next/image` thay vì `<img>` (optimization)
- [ ] Dùng `next/link` thay vì `<a>` (client-side navigation)
