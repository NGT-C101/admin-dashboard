import Link from "next/link";
import ActionForm from "@/components/ui/ActionForm";
import PageHeader from "@/components/ui/PageHeader";
import { requireSection } from "@/lib/auth";
import { getCompanyProfile } from "@/lib/company";
import { dateKey, DAY_MS, riyadhToday } from "@/lib/time";
import { createQuote } from "../../quote-actions";
import QuoteFields from "../QuoteFields";
import { loadQuoteOptions } from "../options";

export default async function NewQuotePage({ searchParams }: { searchParams: Promise<{ clientId?: string; companyId?: string }> }) {
  await requireSection("requests", "EDIT");
  const { clientId, companyId } = await searchParams;
  const [{ clients, services }, profile] = await Promise.all([loadQuoteOptions(clientId), getCompanyProfile()]);
  const validUntil = dateKey(new Date(riyadhToday().getTime() + profile.quoteValidityDays * DAY_MS));

  return (
    <div className="space-y-6">
      <PageHeader title="عرض سعر جديد" crumbs={[{ label: "عروض الأسعار", href: "/requests/quotes" }, { label: "جديد" }]} />
      <div className="card p-5">
        {clients.length === 0 ? (
          <p className="text-sm text-neutral-600">
            يجب تسجيل عميل أولاً. انتقل إلى <Link href="/clients/directory" className="link">العملاء</Link> وأضف العميل.
          </p>
        ) : (
          <ActionForm action={createQuote} submitLabel="حفظ عرض السعر" resetOnSuccess={false}>
            <QuoteFields clients={clients} services={services}
              draft={{ clientId, companyId, validUntil, notes: profile.quoteTerms, items: [] }} />
          </ActionForm>
        )}
      </div>
    </div>
  );
}
