import { supportHandlers } from "@/libs/supportRoute";
export const runtime = "nodejs";
const handlers = supportHandlers(true);
type Context = { params: Promise<{ conversationId: string }> };
export const GET = (request: Request, context: Context) => handlers.GET(request, context);
export const POST = (request: Request, context: Context) => handlers.POST(request, context);
