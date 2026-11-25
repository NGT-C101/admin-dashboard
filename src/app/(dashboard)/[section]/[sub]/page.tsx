import { notFound, redirect } from "next/navigation";
import { Construction } from "lucide-react";
import { canAccess, requireUser } from "@/lib/auth";
import { findSection } from "@/lib/nav";

export default async function SubSectionPage({
  params,
}: {
  params: Promise<{ section: string; sub: string }>;
}) {
  const { section: sectionSlug, sub: subSlug } = await params;
  const section = findSection(sectionSlug);
  const sub = section?.subs.find((s) => s.slug === subSlug);
  if (!section || !sub) notFound();

  const user = await requireUser();
  if (!canAccess(user, section.department)) redirect("/");

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-slate-500">{section.title}</p>
        <h1 className="text-2xl font-bold">{sub.title}</h1>
      </div>
      <div className="card p-12 text-center text-slate-500">
        <Construction className="mx-auto mb-3 text-amber-500" size={40} />
        القسم ده هيتبني في المراحل الجاية
      </div>
    </div>
  );
}
