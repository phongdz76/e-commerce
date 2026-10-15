import { ticketListHandlers } from "@/libs/supportTicketRoute";
export const runtime = "nodejs";
export const GET = ticketListHandlers(true).GET;
