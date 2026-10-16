import { returnDetailHandlers } from "@/libs/returnCaseRoute";
export const runtime = "nodejs";
export const { GET, POST } = returnDetailHandlers(false);
