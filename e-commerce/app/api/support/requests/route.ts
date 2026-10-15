import { ticketListHandlers } from "@/libs/supportTicketRoute";
export const runtime = "nodejs";
const handlers = ticketListHandlers(false);
export const GET = handlers.GET;
export const POST = handlers.POST;
