import type { ReactionNode, SeriesLink } from "@/lib/types";

interface LinkBadgeProps {
  link: SeriesLink;
  nodes: ReactionNode[];
  onDelete: (linkId: string) => void;
}

export default function LinkBadge({ link, nodes, onDelete }: LinkBadgeProps) {
  const fromNode = nodes.find((n) => n.id === link.fromReactionId);
  const toNode = nodes.find((n) => n.id === link.toReactionId);
  const product = fromNode?.reaction.products[link.fromProductIndex];
  const reactant = toNode?.reaction.reactants[link.toReactantIndex];

  if (!product || !reactant) return null;

  const fromIdx = nodes.indexOf(fromNode!);
  const toIdx = nodes.indexOf(toNode!);
  const pct = Math.round(link.fraction * 100);

  return (
    <div className="flex items-center justify-center gap-2 py-2">
      <div className="flex items-center gap-1.5 rounded-full bg-purple-50 border border-purple-200 px-3 py-1 text-xs text-purple-700">
        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 13.5L12 21m0 0l-7.5-7.5M12 21V3" />
        </svg>
        <span>
          Rxn {fromIdx + 1} <span className="font-semibold">{product.formula}</span>
          {" "}({pct}%) → Rxn {toIdx + 1} <span className="font-semibold">{reactant.formula}</span>
        </span>
        <button
          onClick={() => onDelete(link.id)}
          className="ml-1 text-purple-400 hover:text-red-500"
          title="Remove link"
        >
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
