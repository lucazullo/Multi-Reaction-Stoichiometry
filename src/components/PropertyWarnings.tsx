import FormulaText from "./FormulaText";

interface PropertyWarning {
  formula: string;
  field: string;
  message: string;
  severity: "error" | "warning";
}

interface PropertyWarningsProps {
  warnings: PropertyWarning[];
}

export default function PropertyWarnings({ warnings }: PropertyWarningsProps) {
  if (warnings.length === 0) return null;

  const errors = warnings.filter((w) => w.severity === "error");
  const warns = warnings.filter((w) => w.severity === "warning");

  return (
    <div className="space-y-2">
      {errors.length > 0 && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-3">
          <p className="text-xs font-semibold text-red-700 mb-1">Property errors</p>
          {errors.map((w, i) => (
            <div key={i} className="flex items-start gap-1.5 text-xs text-red-700">
              <span className="flex-shrink-0 mt-0.5">{"\u274C"}</span>
              <span>
                <FormulaText formula={w.formula} className="font-semibold" />
                {" "}<span className="text-red-500">({w.field})</span>: {w.message}
              </span>
            </div>
          ))}
        </div>
      )}
      {warns.length > 0 && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 p-3">
          <p className="text-xs font-semibold text-amber-700 mb-1">Property warnings</p>
          {warns.map((w, i) => (
            <div key={i} className="flex items-start gap-1.5 text-xs text-amber-700">
              <span className="flex-shrink-0 mt-0.5">{"\u26A0\uFE0F"}</span>
              <span>
                <FormulaText formula={w.formula} className="font-semibold" />
                {" "}<span className="text-amber-500">({w.field})</span>: {w.message}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
