export const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "";

export const API_PATHS = {
  AUTH: {
    REGISTER: "/api/register",
    FORGOT_PASSWORD: "/api/forgot-password",
    RESET_PASSWORD: "/api/reset-password",
    PROFILE: "/api/profile",
  },
  PAYMENT: {
    CREATE_INTENT: "/api/create-payment-intent",
    SYNC_STRIPE_ORDER: "/api/order/stripe-status",
    MOMO_CREATE_URL: "/api/momo/create-payment-url",
  },
  ORDER: {
    GET_ALL: "/api/order",
    GET_BY_ID: (id: string) => `/api/order/${id}`,
    CREATE_COD: "/api/order/create-cod",
  },
};
