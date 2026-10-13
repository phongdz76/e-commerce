import { User, PaymentAttempt, PaymentException } from "@prisma/client";

export type SafePaymentException = Omit<
  PaymentException,
  "createdAt" | "reviewedAt"
> & {
  createdAt: string;
  reviewedAt: string | null;
};

export interface SafeCatalogGroup {
  id: string;
  name: string;
  slug: string;
  isVisible: boolean;
  productCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface MonthlyRevenueItem {
  month: string;
  amount: number;
  orderCount: number;
}

export interface PaymentDistributionItem {
  method: string;
  label: string;
  count: number;
  amount: number;
  percentage: number;
  color: string;
}

export interface CategoryDistributionItem {
  name: string;
  count: number;
  percentage: number;
}

export interface TopSellingProductItem {
  id: string;
  name: string;
  slug: string;
  categoryName: string;
  brandName: string;
  image: string;
  price: number;
  unitsSold: number;
  revenue: number;
  month: string; // e.g. "October 2026", "September 2026", "All Time"
}

export interface AdminOverview {
  users: number;
  blockedUsers: number;
  products: number;
  activeProducts: number;
  categories: number;
  brands: number;
  unpaidOrders: number;
  reviewPayments: number;
  openExceptions: number;
  confirmedOnlineAmount: number;
  confirmedOnlineOrders: number;
  generatedAt: string;
  monthlyRevenue?: MonthlyRevenueItem[];
  paymentDistribution?: PaymentDistributionItem[];
  categoryDistribution?: CategoryDistributionItem[];
  topSellingProducts?: TopSellingProductItem[];
}

export interface AdminOrderSummary {
  id: string;
  amount: number;
  currency: string;
  status: string;
  deliveryStatus: string | null;
  paymentMethod: string;
  createDate: string;
  customer: { name: string | null; email: string | null };
  recipientName: string | null;
  itemCount: number;
}

export interface AdminOrderDetail extends AdminOrderSummary {
  recipientPhone: string | null;
  address: {
    line1: string;
    line2: string | null;
    city: string;
    state: string;
    postal_code: string;
    country: string;
  } | null;
  products: {
    id: string;
    name: string;
    category: string;
    brand: string;
    quantity: number;
    price: number;
    color: string;
    image: string | null;
  }[];
}

export interface AdminOrderList {
  orders: AdminOrderSummary[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}

export interface AdminCatalogVariant {
  id?: string;
  sku: string;
  name: string;
  price: number;
  image: { color: string; colorCode: string; image: string };
  attributes: Record<string, string>;
  isActive: boolean;
  inStock: boolean;
}

export interface AdminCatalogProduct {
  id: string;
  name: string;
  slug: string;
  description: string;
  status: "DRAFT" | "ACTIVE" | "ARCHIVED";
  categoryId: string;
  brandId: string;
  categoryName: string;
  brandName: string;
  updatedAt: string;
  variants: AdminCatalogVariant[];
}

export type safeUser = Pick<
  User,
  | "id"
  | "name"
  | "email"
  | "image"
  | "address"
  | "phoneNumber"
  | "role"
  | "status"
  | "pendingEmail"
> & {
  createdAt: string;
  updatedAt: string;
  emailVerified: string | null;
  hasPassword: boolean;
};

export type SafePaymentAttempt = Pick<
  PaymentAttempt,
  | "id"
  | "orderId"
  | "paymentMethod"
  | "amount"
  | "currency"
  | "state"
  | "providerTransactionId"
> & {
  createDate: string;
  lastCheckedAt: string | null;
  canCheck: boolean;
  order: { id: string; status: string; deliveryStatus: string | null; customerName: string } | null;
};
