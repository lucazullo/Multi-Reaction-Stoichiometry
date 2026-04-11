import type { ValidationWarning } from "@/lib/topology-validator";

interface ValidationWarningsProps {
  warnings: ValidationWarning[];
}

const STYLES: Record<string, { bg: string; border: string; text: string; icon: string }> = {
  error: { bg: "bg-red-50", border: "border-red-200", text: "text-red-700", icon: "\u274C" },
  warning: { bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-700", icon: "\u26A0\uFE0F" },
  info: { bg: "bg-blue-50", border: "border-blue-200", text: "text-blue-700", icon: "\u2139\uFE0F" },
};

export default function ValidationWarnings({ warnings }: ValidationWarningsProps) {
  if (warnings.length === 0) return null;

  return (
    <div className="space-y-1.5">
      {warnings.map((w, i) => {
        const style = STYLES[w.type] ?? STYLES.info;
        return (
          <div
            key={i}
            className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-xs ${style.bg} ${style.border} ${style.text}`}
          >
            <span className="flex-shrink-0">{style.icon}</span>
            <span>{w.message}</span>
          </div>
        );
      })}
    </div>
  );
}
