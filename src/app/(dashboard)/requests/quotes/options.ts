import "server-only";
import { db } from "@/lib/db";

// خيارات فورم عرض السعر: العملاء وشركاتهم + الخدمات مجمّعة حسب الجهة
export async function loadQuoteOptions(currentClientId?: string | null) {
  const [clients, services] = await Promise.all([
    db.client.findMany({
      where: { OR: [{ archivedAt: null }, ...(currentClientId ? [{ id: currentClientId }] : [])] },
      select: { id: true, name: true, companies: { select: { id: true, name: true }, orderBy: { name: "asc" } } },
      orderBy: { name: "asc" },
    }),
    db.serviceType.findMany({
      where: { active: true },
      orderBy: [{ govEntity: { order: "asc" } }, { order: "asc" }],
      select: { id: true, name: true, govEntity: { select: { name: true } } },
    }),
  ]);
  return {
    clients,
    services: services.map((s) => ({ id: s.id, name: s.name, group: s.govEntity?.name ?? "خدمات عامة" })),
  };
}
