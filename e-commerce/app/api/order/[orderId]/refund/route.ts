import { refundHandlers } from "@/libs/orderRefundRoute";
export const runtime = "nodejs";
export const maxDuration = 60;
const handlers = refundHandlers(false);
export const GET = handlers.GET;
export const POST = handlers.POST;
