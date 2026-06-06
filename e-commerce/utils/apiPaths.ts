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
  },
};
