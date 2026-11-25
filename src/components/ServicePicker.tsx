"use client";

// اختيار الجهة ثم الخدمة: الخدمات بتتفلتر حسب الجهة
import { useState } from "react";
import { Field } from "@/components/ui/Field";

type Entity = { id: string; name: string };
type Service = { id: string; name: string; govEntityId: string | null };

export default function ServicePicker({ entities, services, defaultEntityId, defaultServiceId }: {
  entities: Entity[];
  services: Service[];
  defaultEntityId?: string | null;
  defaultServiceId?: string | null;
}) {
  const [entityId, setEntityId] = useState(defaultEntityId ?? "");
  const [serviceId, setServiceId] = useState(defaultServiceId ?? "");

  const general = services.filter((s) => !s.govEntityId);
  const ofEntity = entityId ? services.filter((s) => s.govEntityId === entityId) : [];

  function chooseEntity(id: string) {
    setEntityId(id);
    // لو الخدمة المختارة مش تبع الجهة الجديدة نفضّيها
    const current = services.find((s) => s.id === serviceId);
    if (current?.govEntityId && current.govEntityId !== id) setServiceId("");
  }

  function chooseService(id: string) {
    setServiceId(id);
    // لو اختار خدمة من غير ما يحدد الجهة، نحددها له
    const s = services.find((x) => x.id === id);
    if (s?.govEntityId && !entityId) setEntityId(s.govEntityId);
  }

  return (
    <>
      <Field label="الجهة / المنصة الحكومية">
        <select name="govEntityId" value={entityId} onChange={(e) => chooseEntity(e.target.value)} className="input">
          <option value="">—</option>
          {entities.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select>
      </Field>
      <Field label="الخدمة">
        <select name="serviceTypeId" value={serviceId} onChange={(e) => chooseService(e.target.value)} className="input">
          <option value="">—</option>
          {entityId ? (
            <>
              {ofEntity.length > 0 && (
                <optgroup label={entities.find((e) => e.id === entityId)?.name}>
                  {ofEntity.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </optgroup>
              )}
              <optgroup label="خدمات عامة">
                {general.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </optgroup>
            </>
          ) : (
            // من غير جهة: كل الخدمات متجمّعة حسب الجهة
            <>
              {entities.map((e) => {
                const list = services.filter((s) => s.govEntityId === e.id);
                return list.length ? (
                  <optgroup key={e.id} label={e.name}>
                    {list.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </optgroup>
                ) : null;
              })}
              <optgroup label="خدمات عامة">
                {general.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </optgroup>
            </>
          )}
        </select>
      </Field>
    </>
  );
}
