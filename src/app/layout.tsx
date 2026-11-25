import type { Metadata } from "next";
import { Cairo } from "next/font/google";
import "./globals.css";
import { BRAND } from "@/lib/brand";

const cairo = Cairo({ subsets: ["arabic", "latin"], variable: "--font-cairo" });

export const metadata: Metadata = {
  title: BRAND.name,
  description: `${BRAND.company} — ${BRAND.slogan}`,
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" className={cairo.variable}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
