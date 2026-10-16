import { returnListHandlers } from "@/libs/returnCaseRoute";
export const runtime = "nodejs";
export const GET = returnListHandlers(true).GET;
