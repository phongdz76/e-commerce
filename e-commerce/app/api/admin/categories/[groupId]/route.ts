import { saveCatalogGroup } from "@/libs/catalogGroup";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ groupId: string }> },
) {
  const { groupId } = await params;
  return saveCatalogGroup(request, "categories", groupId);
}
