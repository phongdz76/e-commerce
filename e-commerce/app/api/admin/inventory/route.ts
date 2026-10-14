import { readAdminInventory } from "@/libs/adminInventory";

export async function GET(request: Request) {
  return readAdminInventory(request);
}
