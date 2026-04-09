import type { BalancedReaction } from "@/lib/types";

interface EquationDisplayProps {
  reaction: BalancedReaction;
}

export default function EquationDisplay({ reaction }: EquationDisplayProps) {
  const allSubstances = [...reaction.reactants, ...reaction.products];

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-gray-50 border border-gray-200 p-6 text-center">
        <p className="font-mono text-2xl tracking-wide text-gray-800">
          {reaction.equation}
        </p>
      </div>

      <div className="flex flex-wrap gap-2 justify-center">
        {allSubstances.map((s, i) => (
          <div
            key={i}
            className={`rounded-lg border px-3 py-2 text-xs ${
              s.role === "reactant"
                ? "border-blue-200 bg-blue-50 text-blue-700"
                : "border-green-200 bg-green-50 text-green-700"
            }`}
          >
            <span className="font-semibold">{s.formula}</span>
            <span className="mx-1 text-gray-400">|</span>
            <span>{s.name}</span>
            <span className="mx-1 text-gray-400">|</span>
            <span>{s.molarMass} g/mol</span>
            <span className="mx-1 text-gray-400">|</span>
            <span className="italic">{s.state}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
