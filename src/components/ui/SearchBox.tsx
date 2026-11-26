import { Search } from "lucide-react";

// بحث بسيط: بيضيف ?q= للرابط
export default function SearchBox({ placeholder, defaultValue, children }: {
  placeholder: string; defaultValue?: string; children?: React.ReactNode;
}) {
  return (
    <form className="flex flex-wrap gap-2">
      <div className="relative flex-1 min-w-56">
        <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400" />
        <input name="q" defaultValue={defaultValue} placeholder={placeholder} className="input pr-9" />
      </div>
      {children}
      <button className="btn-secondary">بحث</button>
    </form>
  );
}
