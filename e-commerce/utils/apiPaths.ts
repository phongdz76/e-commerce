export const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "";

export const API_PATHS = {
  AUTH: {
    REGISTER: "/api/register",
    FORGOT_PASSWORD: "/api/forgot-password",
    RESET_PASSWORD: "/api/reset-password",
    PROFILE: "/api/profile",
    REQUEST_EMAIL_VERIFICATION: "/api/email-verification/request",
    VERIFY_EMAIL: "/api/email-verification/confirm",
    REVOKE_SESSIONS: "/api/profile/revoke-sessions",
  },
  PAYMENT: {
    CREATE_INTENT: "/api/create-payment-intent",
    SYNC_STRIPE_ORDER: "/api/order/stripe-status",
    MOMO_CREATE_URL: "/api/momo/create-payment-url",
    VNPAY_CREATE_URL: "/api/vnpay/create-payment-url",
    PAYMENT_STATUS: "/api/order/payment-status",
    ZALOPAY_CREATE_URL: "/api/zalopay/create-payment-url",
    ZALOPAY_STATUS: "/api/zalopay/status",
  },
  ORDER: {
    GET_ALL: "/api/order",
    GET_BY_ID: (id: string) => `/api/order/${id}`,
    CREATE_COD: "/api/order/create-cod",
    RETRY_PAYMENT: (id: string) => `/api/order/${id}/retry-payment`,
  },
  ADMIN: {
    ORDERS: "/api/admin/orders",
    ORDER: (id: string) => `/api/admin/orders/${id}`,
    PRODUCTS: "/api/admin/products",
    PRODUCT: (id: string) => `/api/admin/products/${id}`,
    OVERVIEW: "/api/admin/overview",
    CATEGORIES: "/api/admin/categories",
    CATEGORY: (id: string) => `/api/admin/categories/${id}`,
    BRANDS: "/api/admin/brands",
    BRAND: (id: string) => `/api/admin/brands/${id}`,
    USERS: "/api/admin/users",
    AUDIT: "/api/admin/audit",
    USER_STATUS: (id: string) => `/api/admin/users/${id}/status`,
    PAYMENTS: "/api/admin/payments",
    PAYMENT_EXCEPTIONS: "/api/admin/payment-exceptions",
    REVIEW_PAYMENT_EXCEPTION: (id: string) =>
      `/api/admin/payment-exceptions/${id}`,
    RECONCILE_PAYMENT: (id: string) => `/api/admin/payments/${id}/reconcile`,
  },
};
