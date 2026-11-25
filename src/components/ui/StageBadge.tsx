import type { StageKind } from "@prisma/client";

export default function StageBadge({ name, kind }: { name: string; kind: StageKind }) {
  const cls =
    kind === "DONE" ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
    : kind === "CANCELLED" ? "bg-rose-50 text-rose-700 ring-rose-200"
    : "bg-sky-50 text-sky-700 ring-sky-200";
  return <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs ring-1 ${cls}`}>{name}</span>;
}
