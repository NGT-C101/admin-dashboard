"use client";

// اختيار العميل ثم شركة من شركاته
import { useState } from "react";
import { Field } from "@/components/ui/Field";

type C = { id: string; name: string; companies: { id: string; name: string }[] };

export default function ClientCompanyPicker({ clients, clientId, companyId }: { clients: C[]; clientId?: string | null; companyId?: string | null }) {
  const [cid, setCid] = useState(clientId ?? "");
  const [coid, setCoid] = useState(companyId ?? "");
  const companies = clients.find((c) => c.id === cid)?.companies ?? [];
  return (
    <>
      <Field label="العميل *">
        <select name="clientId" required value={cid} onChange={(e) => { setCid(e.target.value); setCoid(""); }} className="input">
          <option value="" disabled>اختر العميل</option>
          {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </Field>
      <Field label="الشركة (اختياري)">
        <select name="companyId" value={coid} onChange={(e) => setCoid(e.target.value)} className="input" disabled={!cid}>
          <option value="">— جميع شركات العميل —</option>
          {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </Field>
    </>
  );
}
