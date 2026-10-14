import { getVnpayConfig } from "@/libs/vnpay";
import { getMomoConfig } from "@/libs/momo";
import { getZaloPayConfig, getZaloPayUrls } from "@/libs/zalopay";

function isConfigured(check: () => unknown) {
  try {
    check();
    return true;
  } catch {
    return false;
  }
}

export function getPaymentConfiguration() {
  return {
    availableMethods: {
      COD: true,
      VNPAY: isConfigured(getVnpayConfig),
      MOMO: isConfigured(getMomoConfig),
      ZALOPAY: isConfigured(() => {
        getZaloPayConfig();
        getZaloPayUrls();
      }),
      STRIPE: Boolean(
        process.env.STRIPE_SECRET_KEY?.trim() &&
          process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim(),
      ),
    },
    reconciliationConfigured: Boolean(process.env.CRON_SECRET?.trim()),
    stripeWebhookConfigured: Boolean(process.env.STRIPE_WEBHOOK_SECRET?.trim()),
  };
}
