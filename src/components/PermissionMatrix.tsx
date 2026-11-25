"use client";

// مصفوفة الصلاحيات: لكل قسم مستوى (بدون / عرض / إضافة وتعديل / إدارة كاملة)
import { useState } from "react";
import { ShieldCheck } from "lucide-react";

type Level = "NONE" | "VIEW" | "EDIT" | "MANAGE";
const LEVELS: { v: Level; label: string; hint: string }[] = [
  { v: "NONE", label: "بدون", hint: "لا يظهر القسم" },
  { v: "VIEW", label: "عرض فقط", hint: "اطلاع دون تعديل" },
  { v: "EDIT", label: "إضافة وتعديل", hint: "إدخال البيانات وتحديثها" },
  { v: "MANAGE", label: "إدارة كاملة", hint: "يشمل الحذف والأرشفة والبيانات الحساسة" },
];

export default function PermissionMatrix({ sections, initial, initialAdmin = false, canGrantAdmin }: {
  sections: { department: string; title: string }[];
  initial?: Record<string, string>;
  initialAdmin?: boolean;
  canGrantAdmin: boolean;
}) {
  const [admin, setAdmin] = useState(initialAdmin);
  const [perms, setPerms] = useState<Record<string, Level>>(
    Object.fromEntries(sections.map((s) => [s.department, (initial?.[s.department] as Level) ?? "NONE"])),
  );
  const setAll = (l: Level) => setPerms(Object.fromEntries(sections.map((s) => [s.department, l])));

  return (
    <div className="space-y-3">
      {canGrantAdmin && (
        <label className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer ${admin ? "border-brand-600 bg-brand-50" : "border-neutral-200"}`}>
          <input type="checkbox" name="isAdmin" checked={admin} onChange={(e) => setAdmin(e.target.checked)} className="mt-1 size-4 accent-brand-600" />
          <span>
            <span className="flex items-center gap-1.5 font-semibold"><ShieldCheck size={16} className="text-brand-700" /> مدير النظام</span>
            <span className="text-xs text-neutral-600">صلاحية كاملة على جميع الأقسام والإعدادات وإدارة الحسابات</span>
          </span>
        </label>
      )}

      {!admin && (
        <div className="rounded-lg border border-neutral-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50">
              <tr>
                <th className="p-2.5 text-right font-medium text-neutral-600">القسم</th>
                {LEVELS.map((l) => (
                  <th key={l.v} className="p-2.5 font-medium text-neutral-600 text-center" title={l.hint}>
                    <button type="button" onClick={() => setAll(l.v)} className="hover:text-brand-700 hover:underline">{l.label}</button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sections.map((s) => (
                <tr key={s.department} className="border-t border-neutral-100">
                  <td className="p-2.5 font-medium">{s.title}</td>
                  {LEVELS.map((l) => (
                    <td key={l.v} className="p-2.5 text-center">
                      <input type="radio" name={`perm_${s.department}`} value={l.v} checked={perms[s.department] === l.v}
                        onChange={() => setPerms({ ...perms, [s.department]: l.v })} className="size-4 accent-brand-600" aria-label={`${s.title}: ${l.label}`} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="p-2.5 text-xs text-neutral-500 border-t border-neutral-100">
            💡 اضغط على اسم أي مستوى في رأس الجدول لتطبيقه على جميع الأقسام. «الإدارة الكاملة» على قسم الموظفين تتيح الاطلاع على الرواتب والمستندات الشخصية.
          </p>
        </div>
      )}
    </div>
  );
}
