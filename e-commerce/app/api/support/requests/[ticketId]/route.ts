import { ticketDetailHandlers } from "@/libs/supportTicketRoute";
export const runtime = "nodejs";
const handlers = ticketDetailHandlers(false);
export const GET = handlers.GET;
export const POST = handlers.POST;
