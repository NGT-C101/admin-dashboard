"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  ChevronDown, ClipboardList, FolderOpen, Handshake, Award, Inbox, LayoutDashboard, ListChecks, UserCircle,
  Megaphone, Menu, Settings, Users, Wallet, X,
} from "lucide-react";
import { BRAND } from "@/lib/brand";
import type { Section } from "@/lib/nav";
import Skyline from "@/components/ui/Skyline";

const ICONS = {
  users: Users, handshake: Handshake, clipboard: ClipboardList,
  folder: FolderOpen, wallet: Wallet, megaphone: Megaphone,
};

export default function Sidebar({ sections, isAdmin, hasEmployee, pendingApprovals = 0, teamLead = false }: {
  sections: Section[]; isAdmin: boolean; hasEmployee: boolean; pendingApprovals?: number;
  teamLead?: boolean; // مدير مباشر بدون صلاحية على قسم الموظفين
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [open, setOpen] = useState<string | null>(pathname.split("/")[1] || null);

  const linkCls = (active: boolean) =>
    `flex items-center gap-3 rounded-xl px-3 min-h-11 text-[15px] transition ${
      active ? "bg-gradient-to-l from-gold-300 via-gold-500 to-gold-600 text-navy-950 font-bold shadow-lg shadow-gold-700/30" : "text-navy-100 hover:bg-white/8 hover:text-white"
    }`;

  return (
    <>
      <button
        onClick={() => setMobileOpen(true)}
        className="print:hidden lg:hidden fixed top-3 right-3 z-30 rounded-xl border border-gold-500/40 bg-navy-900 p-2 text-gold-300"
        aria-label="فتح القائمة"
      >
        <Menu size={20} />
      </button>
      {mobileOpen && <div className="lg:hidden fixed inset-0 z-30 bg-black/40" onClick={() => setMobileOpen(false)} />}

      <aside
        className={`print:hidden fixed inset-y-0 right-0 z-40 w-64 bg-navy-950/95 backdrop-blur border-l border-white/10 flex flex-col transition-transform lg:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-4 h-20">
          <Link href="/" className="flex items-center gap-3">
            <Image src={BRAND.logoOnDark} alt={BRAND.short} width={72} height={40} priority className="h-9 w-auto" />
            <span className="text-xs leading-tight text-navy-200">{BRAND.tagline}</span>
          </Link>
          <button onClick={() => setMobileOpen(false)} className="lg:hidden text-neutral-400" aria-label="إغلاق">
            <X size={20} />
          </button>
        </div>

        <div className="mx-4 h-px bg-gradient-to-l from-transparent via-gold-500/60 to-transparent" />

        <nav className="flex-1 overflow-y-auto p-3 space-y-1" onClick={(e) => (e.target as HTMLElement).closest("a") && setMobileOpen(false)}>
          <Link href="/" className={linkCls(pathname === "/")}>
            <LayoutDashboard size={18} /> الرئيسية
          </Link>
          {hasEmployee && (
            <Link href="/me" className={linkCls(pathname === "/me")}>
              <UserCircle size={18} /> خدماتي
            </Link>
          )}
          {teamLead && (
            <Link href="/employees/performance" className={linkCls(pathname.startsWith("/employees/performance"))}>
              <Award size={18} /> تقييم أداء فريقي
            </Link>
          )}
          {pendingApprovals > 0 && (
            <Link href="/employees/leaves" className={linkCls(pathname === "/employees/leaves")}>
              <Inbox size={18} /> طلبات بانتظار موافقتي
              <span className="mr-auto rounded-full bg-brand-600 px-2 text-xs font-bold text-white">{pendingApprovals}</span>
            </Link>
          )}

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
                  <div className="mr-6 mt-1 space-y-1 border-r border-gold-500/25 pr-2">
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
              <p className="px-3 text-xs text-navy-300">الإعدادات</p>
              <Link href="/settings/users" className={linkCls(pathname === "/settings/users")}>
                <Settings size={18} /> المستخدمون والصلاحيات
              </Link>
              <Link href="/settings/lists" className={linkCls(pathname === "/settings/lists")}>
                <ListChecks size={18} /> القوائم والمراحل
              </Link>
            </div>
          )}
        </nav>

        <div className="relative h-24 shrink-0 overflow-hidden border-t border-white/10">
          <Skyline sky={false} className="absolute inset-x-0 bottom-0 h-full w-full opacity-60" />
          <p className="relative pt-3 text-center font-display text-sm font-bold text-gold-gradient">{BRAND.slogan}</p>
        </div>
      </aside>
    </>
  );
}
