import prisma from "@/libs/prismadb";

export async function cleanupOrphanSupportImages() {
  const where = { createdAt: { lt: new Date(Date.now() - 86400000) }, OR: [{ messageId: null }, { messageId: { isSet: false } }] };
  const images = await prisma.supportAttachment.findMany({ where, orderBy: { createdAt: "asc" }, take: 50, select: { id: true } });
  if (!images.length) return 0;
  // Recheck binding in the deletion: sending an image after the scan must keep it.
  const result = await prisma.supportAttachment.deleteMany({ where: { ...where, id: { in: images.map(image => image.id) } } });
  return result.count;
}
