import type { Metadata } from "next";
import { IBM_Plex_Sans_Arabic, Noto_Kufi_Arabic, Readex_Pro } from "next/font/google";
import "./globals.css";
import { BRAND } from "@/lib/brand";

// خط الواجهة: واضح في الجداول والأحجام الصغيرة
const plex = IBM_Plex_Sans_Arabic({
  subsets: ["arabic", "latin"], weight: ["400", "500", "600", "700"], variable: "--font-plex", display: "swap",
});
// خط العناوين: كوفي هندسي حديث
const kufi = Noto_Kufi_Arabic({
  subsets: ["arabic", "latin"], weight: ["500", "700", "800"], variable: "--font-kufi", display: "swap",
});

// خط العناوين في نظام التصميم الجديد (ds): عربي حديث متغيّر الوزن
const readex = Readex_Pro({ subsets: ["arabic", "latin"], variable: "--font-readex", display: "swap" });

export const metadata: Metadata = {
  title: BRAND.name,
  description: `${BRAND.company} — ${BRAND.slogan}`,
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" className={`${plex.variable} ${kufi.variable} ${readex.variable}`}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
