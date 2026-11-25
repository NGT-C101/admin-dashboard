"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  ChevronDown, ClipboardList, FolderOpen, Handshake, LayoutDashboard, ListChecks,
  Megaphone, Menu, Settings, Users, Wallet, X,
} from "lucide-react";
import { BRAND } from "@/lib/brand";
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
      active ? "bg-brand-600 text-white shadow-sm" : "text-neutral-300 hover:bg-white/10 hover:text-white"
    }`;

  return (
    <>
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-3 right-3 z-30 rounded-lg bg-brand-950 p-2 text-white"
        aria-label="فتح القائمة"
      >
        <Menu size={20} />
      </button>
      {mobileOpen && <div className="lg:hidden fixed inset-0 z-30 bg-black/40" onClick={() => setMobileOpen(false)} />}

      <aside
        className={`fixed inset-y-0 right-0 z-40 w-64 bg-gradient-to-b from-brand-950 to-[#1a0304] flex flex-col transition-transform lg:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-4 h-20 border-b border-white/10">
          <Link href="/" className="flex items-center gap-3">
            <Image src={BRAND.logoOnDark} alt={BRAND.short} width={72} height={40} priority className="h-9 w-auto" />
            <span className="text-xs leading-tight text-neutral-300">{BRAND.tagline}</span>
          </Link>
          <button onClick={() => setMobileOpen(false)} className="lg:hidden text-neutral-400" aria-label="إغلاق">
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
                  <div className="mr-6 mt-1 space-y-1 border-r border-white/15 pr-2">
                    {s.subs.map((sub) => {
                      const href = `/${s.slug}/${sub.slug}`;
                      return (
                        <Link key={sub.slug} href={href} className={linkCls(pathname === href || pathname.startsWith(href + "/"))}>
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
            <div className="pt-3 mt-3 border-t border-white/10 space-y-1">
              <p className="px-3 text-xs text-neutral-500">الإعدادات</p>
              <Link href="/settings/users" className={linkCls(pathname === "/settings/users")}>
                <Settings size={18} /> المستخدمين والصلاحيات
              </Link>
              <Link href="/settings/lists" className={linkCls(pathname === "/settings/lists")}>
                <ListChecks size={18} /> القوائم والمراحل
              </Link>
            </div>
          )}
        </nav>

        <p className="px-4 py-3 text-center text-[11px] text-neutral-500 border-t border-white/10">{BRAND.slogan}</p>
      </aside>
    </>
  );
}
