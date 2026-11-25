"use client";
import { Printer } from "lucide-react";
export default function PrintButton() {
  return <button onClick={() => window.print()} className="btn-primary"><Printer size={16} /> طباعة / حفظ PDF</button>;
}
