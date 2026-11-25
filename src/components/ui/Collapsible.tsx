"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";

// زرار يفتح/يقفل فورم الإضافة
export default function Collapsible({ label, children, defaultOpen = false }: {
  label: string; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="card">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between p-4 font-semibold">
        <span className="flex items-center gap-2">{open ? <X size={18} /> : <Plus size={18} />} {label}</span>
      </button>
      {open && <div className="border-t border-neutral-100 p-4">{children}</div>}
    </div>
  );
}
