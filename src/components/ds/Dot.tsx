// نقطة حالة: اللون يحمل المعنى، والنص بجانبها يقوله
export type Tone = "accent" | "success" | "warning" | "danger" | "info" | "neutral";
export const TONE_BG: Record<Tone, string> = {
  accent: "bg-ds-accent", success: "bg-ds-success", warning: "bg-ds-warning",
  danger: "bg-ds-danger", info: "bg-ds-info", neutral: "bg-ds-neutral",
};
export const TONE_TEXT: Record<Tone, string> = {
  accent: "text-ds-accent", success: "text-ds-success", warning: "text-ds-warning",
  danger: "text-ds-danger", info: "text-ds-info", neutral: "text-ds-muted",
};
export function Dot({ tone, size = "md" }: { tone: Tone; size?: "sm" | "md" }) {
  return <span aria-hidden="true" className={`inline-block shrink-0 rounded-full ${size === "sm" ? "size-1.5" : "size-2"} ${TONE_BG[tone]}`} />;
}
