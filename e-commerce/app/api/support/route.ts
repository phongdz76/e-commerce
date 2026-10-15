import { supportHandlers } from "@/libs/supportRoute";
export const runtime = "nodejs";
const handlers = supportHandlers(false);
export const GET = (request: Request) => handlers.GET(request);
export const POST = (request: Request) => handlers.POST(request);
