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
import type { ReactionSystem, GraphLayout, HandleSide, GraphEdgeLayout } from "@/lib/types";
import { normalizeFormula } from "@/lib/utils";

// --- Color Palettes ---

const REACTION_COLORS = [
  "#ef4444", "#f97316", "#f59e0b", "#eab308",
  "#84cc16", "#22c55e", "#10b981", "#14b8a6",
  "#06b6d4", "#3b82f6", "#6366f1", "#8b5cf6",
  "#a855f7", "#d946ef", "#ec4899", "#f43f5e",
  "#64748b", "#78716c",
];

const SUBSTANCE_COLORS = [
  "#3b82f6", "#06b6d4", "#6366f1", "#8b5cf6",
  "#14b8a6", "#22c55e", "#84cc16", "#f59e0b",
  "#f97316", "#ef4444", "#ec4899", "#64748b",
];

const EXOTHERMIC_COLOR = "#ef4444";
const ENDOTHERMIC_COLOR = "#3b82f6";
const NEUTRAL_COLOR = "#14b8a6";

function computeDeltaH(
  reactants: { coefficient: number; enthalpyOfFormation: number }[],
  products: { coefficient: number; enthalpyOfFormation: number }[]
): number | null {
  const sumProducts = products.reduce((s, p) => s + p.coefficient * (p.enthalpyOfFormation ?? 0), 0);
  const sumReactants = reactants.reduce((s, r) => s + r.coefficient * (r.enthalpyOfFormation ?? 0), 0);
  if (sumProducts === 0 && sumReactants === 0) return null;
  return sumProducts - sumReactants;
}

const SIDE_TO_POSITION: Record<HandleSide, Position> = {
  top: Position.Top,
  bottom: Position.Bottom,
  left: Position.Left,
  right: Position.Right,
};

interface ReactionNetworkGraphProps {
  system: ReactionSystem;
  graphLayout?: GraphLayout;
  onLayoutChange?: (layout: GraphLayout) => void;
}

// --- Color Picker (expanded, all colors visible) ---
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
  // Close on click outside
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as globalThis.Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute z-50 top-full left-0 mt-1 rounded-lg border border-gray-200 bg-white p-3 shadow-lg"
      style={{ minWidth: Math.min(colors.length, 9) * 32 + 16 }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="flex flex-wrap gap-2">
        {colors.map((c) => (
          <button
            key={c}
            onClick={(e) => { e.stopPropagation(); onSelect(c); onClose(); }}
            className="h-6 w-6 rounded-full border-2 transition-all hover:scale-110"
            style={{
              backgroundColor: c,
              borderColor: currentColor === c ? "#1e293b" : "transparent",
              boxShadow: currentColor === c ? "0 0 0 2px #cbd5e1" : "none",
            }}
          />
        ))}
      </div>
    </div>
  );
}

// --- Edge Editor Popover (shown when clicking an edge) ---
function EdgeEditor({
  edgeId,
  sourceLabel,
  targetLabel,
  currentSourceSide,
  currentTargetSide,
  position,
  onChangeSide,
  onClose,
}: {
  edgeId: string;
  sourceLabel: string;
  targetLabel: string;
  currentSourceSide: HandleSide;
  currentTargetSide: HandleSide;
  position: { x: number; y: number };
  onChangeSide: (edgeId: string, which: "source" | "target", side: HandleSide) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as globalThis.Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  const sides: { side: HandleSide; icon: string }[] = [
    { side: "top", icon: "↑" },
    { side: "right", icon: "→" },
    { side: "bottom", icon: "↓" },
    { side: "left", icon: "←" },
  ];

  return (
    <div
      ref={ref}
      className="fixed z-[100] rounded-lg border border-gray-200 bg-white p-3 shadow-xl text-xs"
      style={{ left: position.x, top: position.y, transform: "translate(-50%, -100%) translateY(-8px)" }}
    >
      <p className="font-semibold text-gray-700 mb-2 text-center">Edge connection points</p>
      <div className="space-y-2">
        <div>
          <p className="text-gray-500 mb-1">From: <span className="font-medium text-gray-700">{sourceLabel}</span></p>
          <div className="flex gap-1">
            {sides.map(({ side, icon }) => (
              <button
                key={side}
                onClick={() => onChangeSide(edgeId, "source", side)}
                className={`h-7 w-7 rounded flex items-center justify-center text-sm font-bold transition ${
                  currentSourceSide === side
                    ? "bg-purple-100 text-purple-700 ring-1 ring-purple-400"
                    : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                }`}
              >
                {icon}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="text-gray-500 mb-1">To: <span className="font-medium text-gray-700">{targetLabel}</span></p>
          <div className="flex gap-1">
            {sides.map(({ side, icon }) => (
              <button
                key={side}
                onClick={() => onChangeSide(edgeId, "target", side)}
                className={`h-7 w-7 rounded flex items-center justify-center text-sm font-bold transition ${
                  currentTargetSide === side
                    ? "bg-purple-100 text-purple-700 ring-1 ring-purple-400"
                    : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                }`}
              >
                {icon}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Custom Nodes (4 handles each, no toggle buttons) ---

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
    onColorChange?: (nodeId: string, color: string) => void;
  };
}) {
  const [showPicker, setShowPicker] = useState(false);
  const color = data.color || NEUTRAL_COLOR;
  const title = data.displayName
    ? `Reaction ${data.index + 1} — ${data.displayName}`
    : `Reaction ${data.index + 1}`;

  const handleStyle = (bg: string) => ({ background: bg, width: 10, height: 10 });

  return (
    <div
      className="relative rounded-lg border-2 bg-white px-4 py-3 shadow-md min-w-[180px] max-w-[280px]"
      style={{ borderColor: color }}
    >
      {/* 4 target handles + 4 source handles on all sides */}
      <Handle id="target-top" type="target" position={Position.Top} style={handleStyle(color)} />
      <Handle id="target-right" type="target" position={Position.Right} style={{ ...handleStyle(color), top: "30%" }} />
      <Handle id="target-bottom" type="target" position={Position.Bottom} style={handleStyle(color)} />
      <Handle id="target-left" type="target" position={Position.Left} style={{ ...handleStyle(color), top: "30%" }} />
      <Handle id="source-top" type="source" position={Position.Top} style={{ ...handleStyle(color), left: "60%" }} />
      <Handle id="source-right" type="source" position={Position.Right} style={{ ...handleStyle(color), top: "70%" }} />
      <Handle id="source-bottom" type="source" position={Position.Bottom} style={handleStyle(color)} />
      <Handle id="source-left" type="source" position={Position.Left} style={{ ...handleStyle(color), top: "70%" }} />

      <div className="flex items-center gap-1.5 mb-1">
        <div className="relative">
          <button
            title="Change color"
            onClick={(e) => { e.stopPropagation(); setShowPicker(!showPicker); }}
            className="h-3.5 w-3.5 rounded-full border border-gray-300 flex-shrink-0 hover:scale-125 transition-transform"
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
    onColorChange?: (nodeId: string, color: string) => void;
  };
}) {
  const [showPicker, setShowPicker] = useState(false);
  const color = data.color || "#3b82f6";
  const handleStyle = (bg: string) => ({ background: bg, width: 8, height: 8 });

  return (
    <div
      className="relative flex items-center justify-center rounded-full border-2 px-5 py-2.5 shadow-sm min-w-[90px]"
      style={{ borderColor: color, backgroundColor: `${color}10` }}
    >
      <Handle id="source-top" type="source" position={Position.Top} style={handleStyle(color)} />
      <Handle id="source-right" type="source" position={Position.Right} style={handleStyle(color)} />
      <Handle id="source-bottom" type="source" position={Position.Bottom} style={handleStyle(color)} />
      <Handle id="source-left" type="source" position={Position.Left} style={handleStyle(color)} />
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
        </div>
        <div className="text-[9px]" style={{ color, opacity: 0.7 }}>{data.name}</div>
      </div>
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
    onColorChange?: (nodeId: string, color: string) => void;
  };
}) {
  const [showPicker, setShowPicker] = useState(false);
  const color = data.color || "#22c55e";
  const handleStyle = (bg: string) => ({ background: bg, width: 8, height: 8 });

  return (
    <div
      className="relative flex items-center justify-center rounded-full border-2 px-5 py-2.5 shadow-sm min-w-[90px]"
      style={{ borderColor: color, backgroundColor: `${color}10` }}
    >
      <Handle id="target-top" type="target" position={Position.Top} style={handleStyle(color)} />
      <Handle id="target-right" type="target" position={Position.Right} style={handleStyle(color)} />
      <Handle id="target-bottom" type="target" position={Position.Bottom} style={handleStyle(color)} />
      <Handle id="target-left" type="target" position={Position.Left} style={handleStyle(color)} />
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

// --- Build Graph ---

function buildGraph(
  system: ReactionSystem,
  savedLayout: GraphLayout | undefined,
  onColorChange: (nodeId: string, color: string) => void
) {
  const { nodes, links } = system;
  const nodeLayouts = savedLayout?.nodes ?? {};
  const edgeLayouts = savedLayout?.edges ?? {};

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
    const saved = nodeLayouts[nodeId];
    return saved ? { x: saved.x, y: saved.y } : { x: defaultX, y: defaultY };
  };
  const colorOf = (nodeId: string) => nodeLayouts[nodeId]?.color;

  // Build a label map for nodes (used in edge editor)
  const nodeLabelMap = new Map<string, string>();

  // --- Reaction nodes ---
  const graphNodes: Node[] = nodes.map((node) => {
    const level = levels.get(node.id) ?? 0;
    const group = levelGroups.get(level) ?? [node.id];
    const indexInGroup = group.indexOf(node.id);
    const groupWidth = (group.length - 1) * xSpacing;
    const defaultX = indexInGroup * xSpacing - groupWidth / 2 + centerX;
    const defaultY = level * ySpacing + 150;

    let defaultColor = NEUTRAL_COLOR;
    if (!colorOf(node.id)) {
      const deltaH = computeDeltaH(node.reaction.reactants, node.reaction.products);
      if (deltaH !== null && deltaH < -0.5) defaultColor = EXOTHERMIC_COLOR;
      else if (deltaH !== null && deltaH > 0.5) defaultColor = ENDOTHERMIC_COLOR;
    }

    const label = node.displayName || `R${nodes.indexOf(node) + 1}`;
    nodeLabelMap.set(node.id, label);

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
        onColorChange,
      },
    };
  });

  // --- Link edges ---
  const graphEdges: Edge[] = links.map((link) => {
    const fromNode = nodes.find((n) => n.id === link.fromReactionId);
    const product = fromNode?.reaction.products[link.fromProductIndex];
    const pct = Math.round(link.fraction * 100);
    const label = product ? `${product.formula} (${pct}%)` : `${pct}%`;
    const el = edgeLayouts[link.id];
    const sourceSide: HandleSide = el?.sourceSide ?? "bottom";
    const targetSide: HandleSide = el?.targetSide ?? "top";

    return {
      id: link.id,
      source: link.fromReactionId,
      target: link.toReactionId,
      sourceHandle: `source-${sourceSide}`,
      targetHandle: `target-${targetSide}`,
      label,
      animated: true,
      style: { stroke: "#8b5cf6", strokeWidth: 2, cursor: "pointer" },
      labelStyle: { fontSize: 10, fontFamily: "monospace", fill: "#6d28d9" },
      labelBgStyle: { fill: "#f5f3ff", fillOpacity: 0.9 },
      labelBgPadding: [6, 3] as [number, number],
      markerEnd: { type: MarkerType.ArrowClosed, color: "#8b5cf6" },
    };
  });

  // --- Feedstock nodes ---
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
    nodeLabelMap.set(nodeId, fs.formula);
    graphNodes.push({
      id: nodeId,
      type: "feedstock",
      position: pos(nodeId, defaultX, 0),
      draggable: true,
      data: { formula: fs.formula, name: fs.name, color: colorOf(nodeId), onColorChange },
    });
    for (const targetId of fs.targetReactions) {
      const edgeId = `edge-fs-${key}-${targetId}`;
      const edgeColor = colorOf(nodeId) || "#3b82f6";
      const el = edgeLayouts[edgeId];
      const sourceSide: HandleSide = el?.sourceSide ?? "bottom";
      const targetSide: HandleSide = el?.targetSide ?? "top";
      graphEdges.push({
        id: edgeId,
        source: nodeId,
        target: targetId,
        sourceHandle: `source-${sourceSide}`,
        targetHandle: `target-${targetSide}`,
        style: { stroke: edgeColor, strokeWidth: 1.5, strokeDasharray: "6 3", cursor: "pointer" },
        markerEnd: { type: MarkerType.ArrowClosed, color: edgeColor },
      });
    }
  });

  // --- Product nodes ---
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
    nodeLabelMap.set(nodeId, pr.formula);
    graphNodes.push({
      id: nodeId,
      type: "product",
      position: pos(nodeId, defaultX, productY),
      draggable: true,
      data: { formula: pr.formula, name: pr.name, color: colorOf(nodeId), onColorChange },
    });
    for (const sourceId of pr.sourceReactions) {
      const edgeId = `edge-pr-${key}-${sourceId}`;
      const edgeColor = colorOf(nodeId) || "#22c55e";
      const el = edgeLayouts[edgeId];
      const sourceSide: HandleSide = el?.sourceSide ?? "bottom";
      const targetSide: HandleSide = el?.targetSide ?? "top";
      graphEdges.push({
        id: edgeId,
        source: sourceId,
        target: nodeId,
        sourceHandle: `source-${sourceSide}`,
        targetHandle: `target-${targetSide}`,
        style: { stroke: edgeColor, strokeWidth: 1.5, strokeDasharray: "6 3", cursor: "pointer" },
        markerEnd: { type: MarkerType.ArrowClosed, color: edgeColor },
      });
    }
  });

  return { graphNodes, graphEdges, nodeLabelMap };
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
  const layoutRef = useRef<GraphLayout>(graphLayout ?? { nodes: {}, edges: {} });
  const [selectedEdge, setSelectedEdge] = useState<{
    id: string;
    sourceId: string;
    targetId: string;
    position: { x: number; y: number };
  } | null>(null);

  // Keep ref in sync with prop
  useEffect(() => {
    if (graphLayout) layoutRef.current = graphLayout;
  }, [graphLayout]);

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
        const existing = prev.nodes[nodeId] ?? { x: 0, y: 0 };
        return { ...prev, nodes: { ...prev.nodes, [nodeId]: { ...existing, color } } };
      });
      setFlowNodes((nds) =>
        nds.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, color } } : n))
      );
    },
    [updateLayout]
  );

  const handleEdgeSideChange = useCallback(
    (edgeId: string, which: "source" | "target", side: HandleSide) => {
      updateLayout((prev) => {
        const existing = prev.edges[edgeId] ?? {};
        const key = which === "source" ? "sourceSide" : "targetSide";
        return { ...prev, edges: { ...prev.edges, [edgeId]: { ...existing, [key]: side } } };
      });
      // Update edge handle in flow
      setFlowEdges((eds) =>
        eds.map((e) => {
          if (e.id !== edgeId) return e;
          const handleKey = which === "source" ? "sourceHandle" : "targetHandle";
          const prefix = which === "source" ? "source-" : "target-";
          return { ...e, [handleKey]: `${prefix}${side}` };
        })
      );
    },
    [updateLayout]
  );

  const { graphNodes, graphEdges, nodeLabelMap } = useMemo(
    () => buildGraph(system, graphLayout, handleColorChange),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [system, graphLayout]
  );

  const [flowNodes, setFlowNodes] = useState<Node[]>(graphNodes);
  const [flowEdges, setFlowEdges] = useState<Edge[]>(graphEdges);

  useEffect(() => { setFlowNodes(graphNodes); }, [graphNodes]);
  useEffect(() => { setFlowEdges(graphEdges); }, [graphEdges]);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      setFlowNodes((nds) => {
        const updated = applyNodeChanges(changes, nds);
        const hasDragEnd = changes.some((c) => c.type === "position" && c.dragging === false);
        if (hasDragEnd) {
          updateLayout((prev) => {
            const newNodes = { ...prev.nodes };
            for (const node of updated) {
              const existing = newNodes[node.id];
              newNodes[node.id] = { x: node.position.x, y: node.position.y, color: existing?.color };
            }
            return { ...prev, nodes: newNodes };
          });
        }
        return updated;
      });
    },
    [updateLayout]
  );

  // Handle edge click — show editor popover
  const onEdgeClick = useCallback(
    (event: React.MouseEvent, edge: Edge) => {
      event.stopPropagation();
      // Position the popover at click location
      setSelectedEdge({
        id: edge.id,
        sourceId: edge.source,
        targetId: edge.target,
        position: { x: event.clientX, y: event.clientY },
      });
    },
    []
  );

  // Close edge editor on pane click
  const onPaneClick = useCallback(() => {
    setSelectedEdge(null);
  }, []);

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
    layoutRef.current = { nodes: {}, edges: {} };
    onLayoutChange?.({ nodes: {}, edges: {} });
    const { graphNodes: fresh, graphEdges: freshEdges } = buildGraph(system, undefined, handleColorChange);
    setFlowNodes(fresh);
    setFlowEdges(freshEdges);
    setSelectedEdge(null);
    setTimeout(() => fitView({ padding: 0.12, duration: 300 }), 50);
  }, [system, onLayoutChange, fitView, handleColorChange]);

  const handleDownloadPNG = useCallback(() => {
    if (!containerRef.current) return;
    const viewport = containerRef.current.querySelector(".react-flow__viewport") as HTMLElement | null;
    const target = viewport ?? containerRef.current;
    toPng(target, {
      backgroundColor: "#ffffff",
      pixelRatio: 2,
      style: { width: containerRef.current.offsetWidth + "px", height: containerRef.current.offsetHeight + "px" },
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

  // Get current edge layout for the selected edge
  const selectedEdgeLayout: GraphEdgeLayout | undefined = selectedEdge
    ? layoutRef.current.edges[selectedEdge.id]
    : undefined;

  const totalLevels = Math.max(...flowNodes.map((n) => n.position.y), 200);

  return (
    <div>
      <div className="flex justify-between items-center mb-2">
        <p className="text-[10px] text-gray-400">
          Drag nodes to rearrange • Click color dot to customize • Click an arrow to edit its connection points
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
          onEdgeClick={onEdgeClick}
          onPaneClick={onPaneClick}
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

      {/* Edge editor popover */}
      {selectedEdge && (
        <EdgeEditor
          edgeId={selectedEdge.id}
          sourceLabel={nodeLabelMap.get(selectedEdge.sourceId) ?? selectedEdge.sourceId}
          targetLabel={nodeLabelMap.get(selectedEdge.targetId) ?? selectedEdge.targetId}
          currentSourceSide={selectedEdgeLayout?.sourceSide ?? "bottom"}
          currentTargetSide={selectedEdgeLayout?.targetSide ?? "top"}
          position={selectedEdge.position}
          onChangeSide={handleEdgeSideChange}
          onClose={() => setSelectedEdge(null)}
        />
      )}
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
