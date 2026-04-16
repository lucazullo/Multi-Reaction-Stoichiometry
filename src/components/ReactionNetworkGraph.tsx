"use client";

import { useMemo, useRef, useEffect, useCallback, useState } from "react";
import { toPng } from "html-to-image";
import {
  ReactFlow,
  Background,
  Controls,
  useReactFlow,
  ReactFlowProvider,
  applyNodeChanges,
  type Node,
  type Edge,
  type NodeTypes,
  type NodeChange,
  Handle,
  Position,
  MarkerType,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { ReactionSystem, GraphLayout, HandleSide } from "@/lib/types";
import { normalizeFormula } from "@/lib/utils";

// --- Color Palettes ---

const REACTION_COLORS = [
  "#ef4444", // Red
  "#f97316", // Orange
  "#f59e0b", // Amber
  "#eab308", // Yellow
  "#84cc16", // Lime
  "#22c55e", // Green
  "#10b981", // Emerald
  "#14b8a6", // Teal (legacy default)
  "#06b6d4", // Cyan
  "#3b82f6", // Blue
  "#6366f1", // Indigo
  "#8b5cf6", // Purple
  "#a855f7", // Violet
  "#d946ef", // Fuchsia
  "#ec4899", // Pink
  "#f43f5e", // Rose
  "#64748b", // Slate
  "#78716c", // Stone
];

const SUBSTANCE_COLORS = [
  "#3b82f6", // Blue
  "#06b6d4", // Cyan
  "#6366f1", // Indigo
  "#8b5cf6", // Purple
  "#14b8a6", // Teal
  "#22c55e", // Green
  "#84cc16", // Lime
  "#f59e0b", // Amber
  "#f97316", // Orange
  "#ef4444", // Red
  "#ec4899", // Pink
  "#64748b", // Slate
];

// Default colors for exothermic/endothermic reactions
const EXOTHERMIC_COLOR = "#ef4444"; // Red
const ENDOTHERMIC_COLOR = "#3b82f6"; // Blue
const NEUTRAL_COLOR = "#14b8a6"; // Teal (legacy default, for zero or unknown ΔH)

/** Compute reaction deltaH from enthalpies of formation */
function computeDeltaH(
  reactants: { coefficient: number; enthalpyOfFormation: number }[],
  products: { coefficient: number; enthalpyOfFormation: number }[]
): number | null {
  const sumProducts = products.reduce((s, p) => s + p.coefficient * (p.enthalpyOfFormation ?? 0), 0);
  const sumReactants = reactants.reduce((s, r) => s + r.coefficient * (r.enthalpyOfFormation ?? 0), 0);
  // If all enthalpies are zero, we can't determine — return null
  if (sumProducts === 0 && sumReactants === 0) return null;
  return sumProducts - sumReactants;
}

// --- Handle position helpers ---

const SIDE_TO_POSITION: Record<HandleSide, Position> = {
  top: Position.Top,
  bottom: Position.Bottom,
  left: Position.Left,
  right: Position.Right,
};

const SIDE_CYCLE: HandleSide[] = ["top", "right", "bottom", "left"];

function nextSide(current: HandleSide): HandleSide {
  const idx = SIDE_CYCLE.indexOf(current);
  return SIDE_CYCLE[(idx + 1) % SIDE_CYCLE.length];
}

interface ReactionNetworkGraphProps {
  system: ReactionSystem;
  graphLayout?: GraphLayout;
  onLayoutChange?: (layout: GraphLayout) => void;
}

// --- Color Picker Popover ---
function ColorPicker({
  colors,
  currentColor,
  onSelect,
  onClose,
}: {
  colors: string[];
  currentColor?: string;
  onSelect: (color: string) => void;
  onClose: () => void;
}) {
  return (
    <div
      className="absolute z-50 top-full left-0 mt-1 grid grid-cols-6 gap-1.5 rounded-lg border border-gray-200 bg-white p-2 shadow-lg"
      onMouseDown={(e) => e.stopPropagation()}
    >
      {colors.map((c) => (
        <button
          key={c}
          onClick={(e) => { e.stopPropagation(); onSelect(c); onClose(); }}
          className="h-5 w-5 rounded-full border-2 transition-transform hover:scale-125"
          style={{
            backgroundColor: c,
            borderColor: currentColor === c ? "#1e293b" : c,
            boxShadow: currentColor === c ? "0 0 0 2px #e2e8f0" : "none",
          }}
        />
      ))}
    </div>
  );
}

// --- Handle Side Toggle Button ---
function HandleToggle({
  side,
  label,
  onCycle,
}: {
  side: HandleSide;
  label: string;
  onCycle: () => void;
}) {
  const arrows: Record<HandleSide, string> = { top: "↑", right: "→", bottom: "↓", left: "←" };
  return (
    <button
      title={`${label}: ${side} — click to cycle`}
      onClick={(e) => { e.stopPropagation(); onCycle(); }}
      onMouseDown={(e) => e.stopPropagation()}
      className="h-4 w-4 rounded text-[9px] font-bold leading-none bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-gray-700 transition flex items-center justify-center"
    >
      {arrows[side]}
    </button>
  );
}

// --- Custom Nodes ---

function ReactionNodeComponent({
  id,
  data,
}: {
  id: string;
  data: {
    label: string;
    equation: string;
    index: number;
    displayName?: string;
    color?: string;
    sourcePos: HandleSide;
    targetPos: HandleSide;
    onColorChange?: (nodeId: string, color: string) => void;
    onHandleChange?: (nodeId: string, which: "source" | "target", side: HandleSide) => void;
  };
}) {
  const [showPicker, setShowPicker] = useState(false);
  const color = data.color || NEUTRAL_COLOR;
  const title = data.displayName
    ? `Reaction ${data.index + 1} — ${data.displayName}`
    : `Reaction ${data.index + 1}`;

  const sourcePos = SIDE_TO_POSITION[data.sourcePos];
  const targetPos = SIDE_TO_POSITION[data.targetPos];

  return (
    <div
      className="relative rounded-lg border-2 bg-white px-4 py-3 shadow-md min-w-[180px] max-w-[280px]"
      style={{ borderColor: color }}
    >
      {/* Handles on the active sides */}
      <Handle id="target" type="target" position={targetPos} style={{ background: color, width: 12, height: 12 }} />
      <Handle id="source" type="source" position={sourcePos} style={{ background: color, width: 12, height: 12 }} />

      <div className="flex items-center gap-1.5 mb-1">
        <div className="relative">
          <button
            title="Change color"
            onClick={(e) => { e.stopPropagation(); setShowPicker(!showPicker); }}
            className="h-3 w-3 rounded-full border border-gray-300 flex-shrink-0 hover:scale-125 transition-transform"
            style={{ backgroundColor: color }}
            onMouseDown={(e) => e.stopPropagation()}
          />
          {showPicker && (
            <ColorPicker
              colors={REACTION_COLORS}
              currentColor={color}
              onSelect={(c) => data.onColorChange?.(id, c)}
              onClose={() => setShowPicker(false)}
            />
          )}
        </div>
        <div className="text-xs font-semibold flex-1" style={{ color }}>{title}</div>
        <div className="flex gap-0.5" title="Arrow connection points">
          <HandleToggle
            side={data.targetPos}
            label="In"
            onCycle={() => data.onHandleChange?.(id, "target", nextSide(data.targetPos))}
          />
          <HandleToggle
            side={data.sourcePos}
            label="Out"
            onCycle={() => data.onHandleChange?.(id, "source", nextSide(data.sourcePos))}
          />
        </div>
      </div>
      <div className="text-xs font-mono text-gray-700 leading-snug break-words">{data.equation}</div>
    </div>
  );
}

function FeedstockNodeComponent({
  id,
  data,
}: {
  id: string;
  data: {
    formula: string;
    name: string;
    color?: string;
    sourcePos: HandleSide;
    onColorChange?: (nodeId: string, color: string) => void;
    onHandleChange?: (nodeId: string, which: "source" | "target", side: HandleSide) => void;
  };
}) {
  const [showPicker, setShowPicker] = useState(false);
  const color = data.color || "#3b82f6";
  const sourcePos = SIDE_TO_POSITION[data.sourcePos];
  return (
    <div
      className="relative flex items-center justify-center rounded-full border-2 px-5 py-2.5 shadow-sm min-w-[90px]"
      style={{ borderColor: color, backgroundColor: `${color}10` }}
    >
      <div className="text-center">
        <div className="flex items-center justify-center gap-1">
          <div className="relative">
            <button
              title="Change color"
              onClick={(e) => { e.stopPropagation(); setShowPicker(!showPicker); }}
              className="h-2.5 w-2.5 rounded-full border border-gray-300 flex-shrink-0 hover:scale-125 transition-transform"
              style={{ backgroundColor: color }}
              onMouseDown={(e) => e.stopPropagation()}
            />
            {showPicker && (
              <ColorPicker
                colors={SUBSTANCE_COLORS}
                currentColor={color}
                onSelect={(c) => data.onColorChange?.(id, c)}
                onClose={() => setShowPicker(false)}
              />
            )}
          </div>
          <div className="text-xs font-bold" style={{ color }}>{data.formula}</div>
          <HandleToggle
            side={data.sourcePos}
            label="Out"
            onCycle={() => data.onHandleChange?.(id, "source", nextSide(data.sourcePos))}
          />
        </div>
        <div className="text-[9px]" style={{ color, opacity: 0.7 }}>{data.name}</div>
      </div>
      <Handle id="source" type="source" position={sourcePos} style={{ background: color, width: 10, height: 10 }} />
    </div>
  );
}

function ProductNodeComponent({
  id,
  data,
}: {
  id: string;
  data: {
    formula: string;
    name: string;
    color?: string;
    targetPos: HandleSide;
    onColorChange?: (nodeId: string, color: string) => void;
    onHandleChange?: (nodeId: string, which: "source" | "target", side: HandleSide) => void;
  };
}) {
  const [showPicker, setShowPicker] = useState(false);
  const color = data.color || "#22c55e";
  const targetPos = SIDE_TO_POSITION[data.targetPos];
  return (
    <div
      className="relative flex items-center justify-center rounded-full border-2 px-5 py-2.5 shadow-sm min-w-[90px]"
      style={{ borderColor: color, backgroundColor: `${color}10` }}
    >
      <Handle id="target" type="target" position={targetPos} style={{ background: color, width: 10, height: 10 }} />
      <div className="text-center">
        <div className="flex items-center justify-center gap-1">
          <div className="relative">
            <button
              title="Change color"
              onClick={(e) => { e.stopPropagation(); setShowPicker(!showPicker); }}
              className="h-2.5 w-2.5 rounded-full border border-gray-300 flex-shrink-0 hover:scale-125 transition-transform"
              style={{ backgroundColor: color }}
              onMouseDown={(e) => e.stopPropagation()}
            />
            {showPicker && (
              <ColorPicker
                colors={SUBSTANCE_COLORS}
                currentColor={color}
                onSelect={(c) => data.onColorChange?.(id, c)}
                onClose={() => setShowPicker(false)}
              />
            )}
          </div>
          <div className="text-xs font-bold" style={{ color }}>{data.formula}</div>
          <HandleToggle
            side={data.targetPos}
            label="In"
            onCycle={() => data.onHandleChange?.(id, "target", nextSide(data.targetPos))}
          />
        </div>
        <div className="text-[9px]" style={{ color, opacity: 0.7 }}>{data.name}</div>
      </div>
    </div>
  );
}

const nodeTypes: NodeTypes = {
  reaction: ReactionNodeComponent,
  feedstock: FeedstockNodeComponent,
  product: ProductNodeComponent,
};

function buildGraph(
  system: ReactionSystem,
  savedLayout: GraphLayout | undefined,
  onColorChange: (nodeId: string, color: string) => void,
  onHandleChange: (nodeId: string, which: "source" | "target", side: HandleSide) => void
) {
  const { nodes, links } = system;

  // Build link lookup
  const linkedProducts = new Set<string>();
  const linkedReactants = new Set<string>();
  for (const link of links) {
    linkedProducts.add(`${link.fromReactionId}:${link.fromProductIndex}`);
    linkedReactants.add(`${link.toReactionId}:${link.toReactantIndex}`);
  }

  // Topology levels
  const inDegree = new Map<string, number>();
  const outgoing = new Map<string, string[]>();
  for (const node of nodes) {
    inDegree.set(node.id, 0);
    outgoing.set(node.id, []);
  }
  for (const link of links) {
    inDegree.set(link.toReactionId, (inDegree.get(link.toReactionId) ?? 0) + 1);
    outgoing.get(link.fromReactionId)?.push(link.toReactionId);
  }

  const levels = new Map<string, number>();
  const queue: string[] = [];
  for (const [id, deg] of inDegree) {
    if (deg === 0) { queue.push(id); levels.set(id, 0); }
  }
  while (queue.length > 0) {
    const id = queue.shift()!;
    const level = levels.get(id) ?? 0;
    for (const next of outgoing.get(id) ?? []) {
      const newLevel = Math.max(levels.get(next) ?? 0, level + 1);
      levels.set(next, newLevel);
      if (!queue.includes(next)) queue.push(next);
    }
  }
  for (const node of nodes) {
    if (!levels.has(node.id)) levels.set(node.id, 0);
  }

  const levelGroups = new Map<number, string[]>();
  for (const [id, level] of levels) {
    const group = levelGroups.get(level) ?? [];
    group.push(id);
    levelGroups.set(level, group);
  }

  const xSpacing = 320;
  const ySpacing = 220;
  const maxLevel = Math.max(...levels.values(), 0);
  const centerX = 400;

  const pos = (nodeId: string, defaultX: number, defaultY: number) => {
    const saved = savedLayout?.[nodeId];
    return saved ? { x: saved.x, y: saved.y } : { x: defaultX, y: defaultY };
  };

  const colorOf = (nodeId: string) => savedLayout?.[nodeId]?.color;
  const sourcePosOf = (nodeId: string, fallback: HandleSide = "bottom"): HandleSide =>
    savedLayout?.[nodeId]?.sourcePosition ?? fallback;
  const targetPosOf = (nodeId: string, fallback: HandleSide = "top"): HandleSide =>
    savedLayout?.[nodeId]?.targetPosition ?? fallback;

  // --- Reaction nodes ---
  const graphNodes: Node[] = nodes.map((node) => {
    const level = levels.get(node.id) ?? 0;
    const group = levelGroups.get(level) ?? [node.id];
    const indexInGroup = group.indexOf(node.id);
    const groupWidth = (group.length - 1) * xSpacing;
    const defaultX = indexInGroup * xSpacing - groupWidth / 2 + centerX;
    const defaultY = level * ySpacing + 150;

    // Determine default color from thermodynamics if no custom color set
    let defaultColor = NEUTRAL_COLOR;
    if (!colorOf(node.id)) {
      const deltaH = computeDeltaH(node.reaction.reactants, node.reaction.products);
      if (deltaH !== null && deltaH < -0.5) defaultColor = EXOTHERMIC_COLOR;
      else if (deltaH !== null && deltaH > 0.5) defaultColor = ENDOTHERMIC_COLOR;
    }

    return {
      id: node.id,
      type: "reaction",
      position: pos(node.id, defaultX, defaultY),
      draggable: true,
      data: {
        label: node.label.slice(0, 50),
        equation: node.reaction.equation,
        index: nodes.indexOf(node),
        displayName: node.displayName,
        color: colorOf(node.id) || defaultColor,
        sourcePos: sourcePosOf(node.id, "bottom"),
        targetPos: targetPosOf(node.id, "top"),
        onColorChange,
        onHandleChange,
      },
    };
  });

  // --- Link edges (purple, between reactions) ---
  const graphEdges: Edge[] = links.map((link) => {
    const fromNode = nodes.find((n) => n.id === link.fromReactionId);
    const product = fromNode?.reaction.products[link.fromProductIndex];
    const pct = Math.round(link.fraction * 100);
    const label = product ? `${product.formula} (${pct}%)` : `${pct}%`;

    return {
      id: link.id,
      source: link.fromReactionId,
      target: link.toReactionId,
      sourceHandle: "source",
      targetHandle: "target",
      label,
      animated: true,
      style: { stroke: "#8b5cf6", strokeWidth: 2 },
      labelStyle: { fontSize: 10, fontFamily: "monospace", fill: "#6d28d9" },
      labelBgStyle: { fill: "#f5f3ff", fillOpacity: 0.9 },
      labelBgPadding: [6, 3] as [number, number],
      markerEnd: { type: MarkerType.ArrowClosed, color: "#8b5cf6" },
    };
  });

  // --- Deduplicated feedstock nodes ---
  const feedstockMap = new Map<string, { formula: string; name: string; targetReactions: string[] }>();
  for (const node of nodes) {
    for (let ri = 0; ri < node.reaction.reactants.length; ri++) {
      if (linkedReactants.has(`${node.id}:${ri}`)) continue;
      const reactant = node.reaction.reactants[ri];
      const key = normalizeFormula(reactant.formula);
      const existing = feedstockMap.get(key);
      if (existing) {
        if (!existing.targetReactions.includes(node.id)) existing.targetReactions.push(node.id);
      } else {
        feedstockMap.set(key, { formula: reactant.formula, name: reactant.name, targetReactions: [node.id] });
      }
    }
  }

  const feedstocks = Array.from(feedstockMap.entries());
  const feedstockWidth = (feedstocks.length - 1) * 160;
  feedstocks.forEach(([key, fs], i) => {
    const nodeId = `feedstock-${key}`;
    const defaultX = i * 160 - feedstockWidth / 2 + centerX;
    const srcPos = sourcePosOf(nodeId, "bottom");
    graphNodes.push({
      id: nodeId,
      type: "feedstock",
      position: pos(nodeId, defaultX, 0),
      draggable: true,
      data: { formula: fs.formula, name: fs.name, color: colorOf(nodeId), sourcePos: srcPos, onColorChange, onHandleChange },
    });
    for (const targetId of fs.targetReactions) {
      const edgeColor = colorOf(nodeId) || "#3b82f6";
      graphEdges.push({
        id: `edge-fs-${key}-${targetId}`,
        source: nodeId,
        target: targetId,
        sourceHandle: "source",
        targetHandle: "target",
        style: { stroke: edgeColor, strokeWidth: 1.5, strokeDasharray: "6 3" },
        markerEnd: { type: MarkerType.ArrowClosed, color: edgeColor },
      });
    }
  });

  // --- Deduplicated product nodes ---
  const productMap = new Map<string, { formula: string; name: string; sourceReactions: string[] }>();
  for (const node of nodes) {
    for (let pi = 0; pi < node.reaction.products.length; pi++) {
      if (linkedProducts.has(`${node.id}:${pi}`)) continue;
      const product = node.reaction.products[pi];
      const key = normalizeFormula(product.formula);
      const existing = productMap.get(key);
      if (existing) {
        if (!existing.sourceReactions.includes(node.id)) existing.sourceReactions.push(node.id);
      } else {
        productMap.set(key, { formula: product.formula, name: product.name, sourceReactions: [node.id] });
      }
    }
  }

  const products = Array.from(productMap.entries());
  const productWidth = (products.length - 1) * 160;
  const productY = (maxLevel + 1) * ySpacing + 150;
  products.forEach(([key, pr], i) => {
    const nodeId = `product-${key}`;
    const defaultX = i * 160 - productWidth / 2 + centerX;
    const tgtPos = targetPosOf(nodeId, "top");
    graphNodes.push({
      id: nodeId,
      type: "product",
      position: pos(nodeId, defaultX, productY),
      draggable: true,
      data: { formula: pr.formula, name: pr.name, color: colorOf(nodeId), targetPos: tgtPos, onColorChange, onHandleChange },
    });
    for (const sourceId of pr.sourceReactions) {
      const edgeColor = colorOf(nodeId) || "#22c55e";
      graphEdges.push({
        id: `edge-pr-${key}-${sourceId}`,
        source: sourceId,
        target: nodeId,
        sourceHandle: "source",
        targetHandle: "target",
        style: { stroke: edgeColor, strokeWidth: 1.5, strokeDasharray: "6 3" },
        markerEnd: { type: MarkerType.ArrowClosed, color: edgeColor },
      });
    }
  });

  return { graphNodes, graphEdges };
}

/** Inner component with useReactFlow access */
function GraphInner({
  system,
  graphLayout,
  onLayoutChange,
}: {
  system: ReactionSystem;
  graphLayout?: GraphLayout;
  onLayoutChange?: (layout: GraphLayout) => void;
}) {
  const { fitView } = useReactFlow();
  const containerRef = useRef<HTMLDivElement>(null);
  const layoutRef = useRef<GraphLayout>(graphLayout ?? {});

  // Shared layout updater
  const updateLayout = useCallback(
    (updater: (prev: GraphLayout) => GraphLayout) => {
      const updated = updater(layoutRef.current);
      layoutRef.current = updated;
      onLayoutChange?.(updated);
      return updated;
    },
    [onLayoutChange]
  );

  const handleColorChange = useCallback(
    (nodeId: string, color: string) => {
      updateLayout((prev) => {
        const existing = prev[nodeId] ?? { x: 0, y: 0 };
        return { ...prev, [nodeId]: { ...existing, color } };
      });
      setFlowNodes((nds) =>
        nds.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, color } } : n))
      );
    },
    [updateLayout]
  );

  const handleHandleChange = useCallback(
    (nodeId: string, which: "source" | "target", side: HandleSide) => {
      updateLayout((prev) => {
        const existing = prev[nodeId] ?? { x: 0, y: 0 };
        const key = which === "source" ? "sourcePosition" : "targetPosition";
        return { ...prev, [nodeId]: { ...existing, [key]: side } };
      });
      setFlowNodes((nds) =>
        nds.map((n) => {
          if (n.id !== nodeId) return n;
          const dataKey = which === "source" ? "sourcePos" : "targetPos";
          return { ...n, data: { ...n.data, [dataKey]: side } };
        })
      );
    },
    [updateLayout]
  );

  const { graphNodes, graphEdges } = useMemo(
    () => buildGraph(system, graphLayout, handleColorChange, handleHandleChange),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [system, graphLayout]
  );

  const [flowNodes, setFlowNodes] = useState<Node[]>(graphNodes);
  const [flowEdges] = useState<Edge[]>(graphEdges);

  useEffect(() => {
    setFlowNodes(graphNodes);
  }, [graphNodes]);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      setFlowNodes((nds) => {
        const updated = applyNodeChanges(changes, nds);
        const hasDragEnd = changes.some((c) => c.type === "position" && c.dragging === false);
        if (hasDragEnd) {
          updateLayout((prev) => {
            const newLayout = { ...prev };
            for (const node of updated) {
              const existing = newLayout[node.id];
              newLayout[node.id] = {
                x: node.position.x,
                y: node.position.y,
                color: existing?.color,
                sourcePosition: existing?.sourcePosition,
                targetPosition: existing?.targetPosition,
              };
            }
            return newLayout;
          });
        }
        return updated;
      });
    },
    [updateLayout]
  );

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0 && entry.contentRect.height > 0) {
          setTimeout(() => fitView({ padding: 0.12, duration: 200 }), 150);
        }
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [fitView]);

  useEffect(() => {
    setTimeout(() => fitView({ padding: 0.12, duration: 200 }), 250);
  }, [graphNodes.length, graphEdges.length, fitView]);

  const handleResetLayout = useCallback(() => {
    layoutRef.current = {};
    onLayoutChange?.({});
    const { graphNodes: fresh } = buildGraph(system, undefined, handleColorChange, handleHandleChange);
    setFlowNodes(fresh);
    setTimeout(() => fitView({ padding: 0.12, duration: 300 }), 50);
  }, [system, onLayoutChange, fitView, handleColorChange, handleHandleChange]);

  const handleDownloadPNG = useCallback(() => {
    if (!containerRef.current) return;
    const viewport = containerRef.current.querySelector(".react-flow__viewport") as HTMLElement | null;
    const target = viewport ?? containerRef.current;

    toPng(target, {
      backgroundColor: "#ffffff",
      pixelRatio: 2,
      style: {
        width: containerRef.current.offsetWidth + "px",
        height: containerRef.current.offsetHeight + "px",
      },
    })
      .then((dataUrl) => {
        const a = document.createElement("a");
        a.href = dataUrl;
        a.download = "reaction-network.png";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      })
      .catch(() => {
        toPng(containerRef.current!, { backgroundColor: "#ffffff", pixelRatio: 2 })
          .then((dataUrl) => {
            const a = document.createElement("a");
            a.href = dataUrl;
            a.download = "reaction-network.png";
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
          })
          .catch(() => alert("Could not export graph as PNG."));
      });
  }, []);

  const totalLevels = Math.max(...flowNodes.map((n) => n.position.y), 200);

  return (
    <div>
      <div className="flex justify-between items-center mb-2">
        <p className="text-[10px] text-gray-400">
          Drag nodes to rearrange • Click color dot to customize • Arrow buttons (↑→↓←) move connection points
        </p>
        <div className="flex gap-2">
          <button
            onClick={handleResetLayout}
            className="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 transition hover:bg-gray-50"
            title="Reset to automatic layout"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
            </svg>
            Reset Layout
          </button>
          <button
            onClick={handleDownloadPNG}
            className="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 transition hover:bg-gray-50"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            Download PNG
          </button>
        </div>
      </div>
      <div
        ref={containerRef}
        className="rounded-xl border border-gray-200 bg-white overflow-hidden"
        style={{ height: Math.max(totalLevels + 150, 450) }}
      >
        <ReactFlow
          nodes={flowNodes}
          edges={flowEdges}
          onNodesChange={onNodesChange}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.12 }}
          minZoom={0.15}
          maxZoom={1.5}
          proOptions={{ hideAttribution: true }}
        >
          <Background gap={20} size={1} color="#f0f0f0" />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>
    </div>
  );
}

export default function ReactionNetworkGraph({
  system,
  graphLayout,
  onLayoutChange,
}: ReactionNetworkGraphProps) {
  return (
    <ReactFlowProvider>
      <GraphInner system={system} graphLayout={graphLayout} onLayoutChange={onLayoutChange} />
    </ReactFlowProvider>
  );
}
