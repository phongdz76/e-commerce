import { ticketDetailHandlers } from "@/libs/supportTicketRoute";
export const runtime = "nodejs";
const handlers = ticketDetailHandlers(true);
export const GET = handlers.GET;
export const POST = handlers.POST;
