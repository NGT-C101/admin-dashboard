import "server-only";
// كل اللي محتاج متابعة في العملاء: متابعات، مستندات وسجلات هتنتهي، عقود قربت تخلص
import type { Prisma } from "@prisma/client";
import { db } from "./db";
import { endOfToday, inDays } from "./clients";

export const ALERT_HORIZON_DAYS = 60; // المستندات والسجلات: نبّه قبلها بـ 60 يوم
export const CONTRACT_HORIZON_DAYS = 30;

type Scope = { clientId?: string; managerId?: string; followUpAssigneeId?: string };

export async function getClientAlerts(scope: Scope = {}) {
  const docHorizon = inDays(ALERT_HORIZON_DAYS);
  const contractHorizon = inDays(CONTRACT_HORIZON_DAYS);
  const clientWhere: Prisma.ClientWhereInput = {
    ...(scope.clientId ? { id: scope.clientId } : { archivedAt: null }),
    ...(scope.managerId ? { accountManagerId: scope.managerId } : {}),
  };
  const viaClient = { client: clientWhere };
  const docOwner: Prisma.DocumentWhereInput = { OR: [{ client: clientWhere }, { company: { client: clientWhere } }] };

  const [followUps, documents, crs, contracts] = await Promise.all([
    db.interaction.findMany({
      where: {
        ...viaClient,
        followUpDone: false,
        followUpAt: { not: null, lte: inDays(7) },
        ...(scope.followUpAssigneeId ? { assigneeId: scope.followUpAssigneeId } : {}),
      },
      include: { client: { select: { id: true, name: true } }, assignee: { select: { name: true } } },
      orderBy: { followUpAt: "asc" },
    }),
    db.document.findMany({
      where: { ...docOwner, expiresAt: { not: null, lte: docHorizon } },
      include: {
        client: { select: { id: true, name: true } },
        company: { select: { id: true, name: true, client: { select: { id: true, name: true } } } },
      },
      orderBy: { expiresAt: "asc" },
    }),
    db.company.findMany({
      where: { ...viaClient, crExpiry: { not: null, lte: docHorizon } },
      select: { id: true, name: true, crNumber: true, crExpiry: true, client: { select: { id: true, name: true } } },
      orderBy: { crExpiry: "asc" },
    }),
    db.contract.findMany({
      where: { ...viaClient, cancelledAt: null, endDate: { not: null, lte: contractHorizon, gte: inDays(-90) } },
      include: { client: { select: { id: true, name: true } }, company: { select: { name: true } } },
      orderBy: { endDate: "asc" },
    }),
  ]);

  const today = endOfToday();
  const now = new Date();
  return {
    followUps,
    documents,
    crs,
    contracts,
    counts: {
      followUpsDue: followUps.filter((f) => f.followUpAt! <= today).length,
      expired: documents.filter((d) => d.expiresAt! < now).length + crs.filter((c) => c.crExpiry! < now).length,
      total: followUps.filter((f) => f.followUpAt! <= today).length + documents.length + crs.length + contracts.length,
    },
  };
}
export type ClientAlerts = Awaited<ReturnType<typeof getClientAlerts>>;
