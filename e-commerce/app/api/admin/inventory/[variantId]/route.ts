import { readAdminInventory, adjustAdminInventory } from "@/libs/adminInventory";

type Context = { params: Promise<{ variantId: string }> };

export async function GET(request: Request, context: Context) {
  return readAdminInventory(request, (await context.params).variantId);
}

export async function PATCH(request: Request, context: Context) {
  return adjustAdminInventory(request, (await context.params).variantId);
}
