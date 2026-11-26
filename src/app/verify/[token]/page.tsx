import type { Metadata } from "next";
import Image from "next/image";
import { BadgeCheck, CircleX } from "lucide-react";
import { BRAND } from "@/lib/brand";
import { getCompanyProfile } from "@/lib/company";
import { db } from "@/lib/db";
import { formatDateFull, formatHijri } from "@/lib/format";
import { letterNumber } from "@/lib/letters";

export const metadata: Metadata = { title: "التحقق من خطاب", robots: { index: false, follow: false } };

// صفحة عامة (دون تسجيل دخول) يفتحها رمز QR: تعرض بيانات الخطاب فقط دون نصه
export default async function VerifyPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const valid = /^[a-f0-9]{32}$/.test(token);
  const [l, p] = await Promise.all([
    valid ? db.letter.findUnique({
      where: { verifyToken: token },
      select: {
        direction: true, year: true, seq: true, status: true, subject: true, party: true, letterDate: true, approvedAt: true,
        approvedBy: { select: { name: true } },
      },
    }) : null,
    getCompanyProfile(),
  ]);
  const ok = l?.status === "APPROVED";
  const cancelled = l?.status === "CANCELLED";
  const issuer = p.legalName || BRAND.company;

  return (
    <main className="min-h-screen bg-navy-950 px-4 py-10 text-neutral-900">
      <div className="mx-auto max-w-lg space-y-6">
        <div className="flex justify-center"><Image src={BRAND.logoOnDark} alt={BRAND.short} width={160} height={89} className="h-auto w-32" /></div>
        <div className="space-y-5 rounded-2xl bg-white p-6 shadow-lg">
          {ok ? (
            <div className="flex items-center gap-3 rounded-xl bg-emerald-50 p-4 text-emerald-800">
              <BadgeCheck size={32} className="shrink-0" />
              <div><p className="text-lg font-bold">خطاب صحيح ومعتمد</p><p className="text-sm">صادر من {issuer}</p></div>
            </div>
          ) : (
            <div className="flex items-center gap-3 rounded-xl bg-rose-50 p-4 text-rose-800">
              <CircleX size={32} className="shrink-0" />
              <div>
                <p className="text-lg font-bold">{cancelled ? "هذا الخطاب ملغى" : "لم يُعثر على خطاب معتمد بهذا الرمز"}</p>
                <p className="text-sm">{cancelled ? `أُلغي من قِبل ${issuer} ولا يُعتد به.` : "يرجى التأكد من مسح الرمز الصحيح أو التواصل مع الجهة المصدرة."}</p>
              </div>
            </div>
          )}
          {l && (ok || cancelled) && (
            <dl className="grid gap-3 text-sm">
              {[
                ["رقم الخطاب", <bdi key="n">{letterNumber(l)}</bdi>],
                ["التاريخ", l.letterDate ? `${formatHijri(l.letterDate)} — الموافق ${formatDateFull(l.letterDate)}` : "—"],
                ["الموضوع", l.subject],
                ["موجّه إلى", l.party],
                ["اعتمده", l.approvedBy?.name ?? "—"],
                ["الجهة المصدرة", issuer],
              ].map(([k, v]) => (
                <div key={k as string} className="flex justify-between gap-4 border-b border-neutral-100 pb-2">
                  <dt className="text-neutral-500">{k}</dt><dd className="text-left font-medium">{v}</dd>
                </div>
              ))}
            </dl>
          )}
          <p className="text-xs leading-relaxed text-neutral-500">
            تعرض هذه الصفحة بيانات الخطاب الأساسية فقط للتحقق من صحة صدوره. للاستفسار يرجى التواصل مع {issuer}{p.phone ? ` على ${p.phone}` : ""}.
          </p>
        </div>
      </div>
    </main>
  );
}
