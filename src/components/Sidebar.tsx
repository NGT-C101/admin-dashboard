"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  Building2, ChevronDown, ClipboardList, FolderOpen, Handshake, LayoutDashboard,
  Megaphone, Menu, Settings, Users, Wallet, X,
} from "lucide-react";
import type { Section } from "@/lib/nav";

const ICONS = {
  users: Users, handshake: Handshake, clipboard: ClipboardList,
  folder: FolderOpen, wallet: Wallet, megaphone: Megaphone,
};

export default function Sidebar({ sections, isAdmin }: { sections: Section[]; isAdmin: boolean }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [open, setOpen] = useState<string | null>(pathname.split("/")[1] || null);

  const linkCls = (active: boolean) =>
    `flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
      active ? "bg-teal-700 text-white" : "text-slate-300 hover:bg-slate-800 hover:text-white"
    }`;

  return (
    <>
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-3 right-3 z-30 rounded-lg bg-slate-900 p-2 text-white"
        aria-label="فتح القائمة"
      >
        <Menu size={20} />
      </button>
      {mobileOpen && <div className="lg:hidden fixed inset-0 z-30 bg-black/40" onClick={() => setMobileOpen(false)} />}

      <aside
        className={`fixed inset-y-0 right-0 z-40 w-64 bg-slate-900 flex flex-col transition-transform lg:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-4 h-16 border-b border-slate-800">
          <div className="flex items-center gap-2 text-white font-bold">
            <Building2 size={22} className="text-teal-400" /> منصة الإدارة
          </div>
          <button onClick={() => setMobileOpen(false)} className="lg:hidden text-slate-400" aria-label="إغلاق">
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto p-3 space-y-1" onClick={(e) => (e.target as HTMLElement).closest("a") && setMobileOpen(false)}>
          <Link href="/" className={linkCls(pathname === "/")}>
            <LayoutDashboard size={18} /> الرئيسية
          </Link>

          {sections.map((s) => {
            const Icon = ICONS[s.icon];
            const expanded = open === s.slug;
            return (
              <div key={s.slug}>
                <button
                  onClick={() => setOpen(expanded ? null : s.slug)}
                  className={`${linkCls(false)} w-full justify-between`}
                >
                  <span className="flex items-center gap-3"><Icon size={18} /> {s.title}</span>
                  <ChevronDown size={16} className={`transition ${expanded ? "rotate-180" : ""}`} />
                </button>
                {expanded && (
                  <div className="mr-6 mt-1 space-y-1 border-r border-slate-700 pr-2">
                    {s.subs.map((sub) => {
                      const href = `/${s.slug}/${sub.slug}`;
                      return (
                        <Link key={sub.slug} href={href} className={linkCls(pathname === href)}>
                          {sub.title}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          {isAdmin && (
            <Link href="/settings/users" className={linkCls(pathname.startsWith("/settings"))}>
              <Settings size={18} /> المستخدمين والصلاحيات
            </Link>
          )}
        </nav>
      </aside>
    </>
  );
}
