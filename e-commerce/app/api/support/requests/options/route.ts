import { NextResponse } from "next/server";
import { supportTicketOrderOptions } from "@/libs/supportTickets";
import { ticketViewer, ticketHeaders, ticketFailure } from "@/libs/supportTicketRoute";
export async function GET() { try {
  const viewer = await ticketViewer(false);
  return NextResponse.json({ orders: await supportTicketOrderOptions(viewer.id) }, { headers: ticketHeaders });
} catch (error) { return ticketFailure(error); } }
