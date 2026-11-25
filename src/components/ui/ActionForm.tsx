"use client";

// فورم عام: بيبعت للسيرفر، ويعرض رسالة النجاح أو الخطأ، ويفضّي نفسه بعد النجاح
import { startTransition, useActionState, useEffect, useRef } from "react";
import type { FormState } from "@/lib/forms";

type Props = {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  children: React.ReactNode;
  submitLabel: string;
  resetOnSuccess?: boolean;
  className?: string;
  onSuccess?: () => void;
};

export default function ActionForm({ action, children, submitLabel, resetOnSuccess = true, className, onSuccess }: Props) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.success) {
      if (resetOnSuccess) ref.current?.reset();
      onSuccess?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <form
      ref={ref}
      className={className ?? "space-y-4"}
      // بنبعت الفورم بنفسنا عشان React ميفضّيش الحقول لو فيه خطأ
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        startTransition(() => formAction(data));
      }}
    >
      {children}
      {state?.error && <p className="text-sm text-red-600 bg-red-50 rounded-lg p-2">{state.error}</p>}
      {state?.success && <p className="text-sm text-brand-700 bg-brand-50 rounded-lg p-2">{state.success}</p>}
      <button disabled={pending} className="btn-primary">
        {pending ? "جاري الحفظ..." : submitLabel}
      </button>
    </form>
  );
}
