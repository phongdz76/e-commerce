import nodemailer from "nodemailer";
import type { NotificationDelivery } from "@prisma/client";
import { orderReference } from "@/utils/orderManagement";

function applicationUrl() {
  try {
    const url = new URL(process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || "");
    if (url.username || url.password || url.search || url.hash || url.pathname !== "/" || (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname)))) return null;
    return url;
  } catch { return null; }
}
export function eventEmailSettings() {
  return { enabled: process.env.SGTECH_EVENT_EMAILS_ENABLED === "true", configured: !!(process.env.EMAIL_USER && process.env.EMAIL_PASSWORD && applicationUrl()) };
}
export async function sendNotificationEmail(delivery: NotificationDelivery & { toEmail: string }) {
  const settings = eventEmailSettings(), base = applicationUrl();
  if (!settings.enabled || !settings.configured || !base || !/^\/orders\/[a-f\d]{24}$/.test(delivery.href)) throw new Error("Event email transport is not available");
  const transport = nodemailer.createTransport({ service: "gmail", auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASSWORD }, connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 20000, logger: false, debug: false, disableFileAccess: true, disableUrlAccess: true });
  const total = delivery.currency.toLowerCase() === "vnd" && Number.isSafeInteger(delivery.amount) ? `\nRecorded order total: ${delivery.amount.toLocaleString("vi-VN")} VND.\n` : "\n";
  return transport.sendMail({ from: process.env.EMAIL_USER, to: delivery.toEmail, messageId: `<${delivery.id}@${base.hostname}>`, subject: delivery.subject,
    text: `${delivery.subject}\n\nOrder: ${orderReference(delivery.orderId)}${total}\nView the current order and payment/refund details:\n${new URL(delivery.href, base).toString()}\n\nSGTech portfolio sandbox demo. This message reports a saved event; it does not replace the current order record.`, disableFileAccess: true, disableUrlAccess: true });
}
