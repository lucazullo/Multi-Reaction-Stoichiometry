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
  reconnectEdge,
  type Node,
  type Edge,
  type NodeTypes,
  type NodeChange,
  type Connection,
  Handle,
  Position,
  MarkerType,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { ReactionSystem, GraphLayout, HandleSide } from "@/lib/types";
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
  const sumP = products.reduce((s, p) => s + p.coefficient * (p.enthalpyOfFormation ?? 0), 0);
  const sumR = reactants.reduce((s, r) => s + r.coefficient * (r.enthalpyOfFormation ?? 0), 0);
  if (sumP === 0 && sumR === 0) return null;
  return sumP - sumR;
}

interface ReactionNetworkGraphProps {
  system: ReactionSystem;
  graphLayout?: GraphLayout;
  onLayoutChange?: (layout: GraphLayout) => void;
}

// --- Color Picker (expanded, all visible) ---

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

// --- Custom Nodes (handles on all 4 sides) ---

const HANDLE_SIZE = 8;
const handleDot = (color: string, size = HANDLE_SIZE) => ({
  background: color,
  width: size,
  height: size,
});

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

  return (
    <div
      className="relative rounded-lg border-2 bg-white px-4 py-3 shadow-md min-w-[180px] max-w-[280px]"
      style={{ borderColor: color }}
    >
      {/* Target handles (incoming) */}
      <Handle id="target-top"    type="target" position={Position.Top}    style={handleDot(color)} />
      <Handle id="target-right"  type="target" position={Position.Right}  style={{ ...handleDot(color), top: "30%" }} />
      <Handle id="target-bottom" type="target" position={Position.Bottom} style={handleDot(color)} />
      <Handle id="target-left"   type="target" position={Position.Left}   style={{ ...handleDot(color), top: "30%" }} />
      {/* Source handles (outgoing) — offset to avoid overlap with target */}
      <Handle id="source-top"    type="source" position={Position.Top}    style={{ ...handleDot(color), left: "60%" }} />
      <Handle id="source-right"  type="source" position={Position.Right}  style={{ ...handleDot(color), top: "70%" }} />
      <Handle id="source-bottom" type="source" position={Position.Bottom} style={handleDot(color)} />
      <Handle id="source-left"   type="source" position={Position.Left}   style={{ ...handleDot(color), top: "70%" }} />

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

function SubstanceNodeComponent({
  id,
  data,
  type,
}: {
  id: string;
  type: "feedstock" | "product";
  data: {
    formula: string;
    name: string;
    color?: string;
    onColorChange?: (nodeId: string, color: string) => void;
  };
}) {
  const [showPicker, setShowPicker] = useState(false);
  const defaultColor = type === "feedstock" ? "#3b82f6" : "#22c55e";
  const color = data.color || defaultColor;
  const handleType = type === "feedstock" ? "source" : "target";

  return (
    <div
      className="relative flex items-center justify-center rounded-full border-2 px-5 py-2.5 shadow-sm min-w-[90px]"
      style={{ borderColor: color, backgroundColor: `${color}10` }}
    >
      {/* Handles on all 4 sides */}
      <Handle id={`${handleType}-top`}    type={handleType} position={Position.Top}    style={handleDot(color, 7)} />
      <Handle id={`${handleType}-right`}  type={handleType} position={Position.Right}  style={handleDot(color, 7)} />
      <Handle id={`${handleType}-bottom`} type={handleType} position={Position.Bottom} style={handleDot(color, 7)} />
      <Handle id={`${handleType}-left`}   type={handleType} position={Position.Left}   style={handleDot(color, 7)} />
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

function FeedstockNodeComponent(props: { id: string; data: { formula: string; name: string; color?: string; onColorChange?: (nodeId: string, color: string) => void } }) {
  return <SubstanceNodeComponent {...props} type="feedstock" />;
}
function ProductNodeComponent(props: { id: string; data: { formula: string; name: string; color?: string; onColorChange?: (nodeId: string, color: string) => void } }) {
  return <SubstanceNodeComponent {...props} type="product" />;
}

const nodeTypes: NodeTypes = {
  reaction: ReactionNodeComponent,
  feedstock: FeedstockNodeComponent,
  product: ProductNodeComponent,
};

// --- Build graph ---

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
  for (const node of nodes) { inDegree.set(node.id, 0); outgoing.set(node.id, []); }
  for (const link of links) {
    inDegree.set(link.toReactionId, (inDegree.get(link.toReactionId) ?? 0) + 1);
    outgoing.get(link.fromReactionId)?.push(link.toReactionId);
  }
  const levels = new Map<string, number>();
  const queue: string[] = [];
  for (const [id, deg] of inDegree) { if (deg === 0) { queue.push(id); levels.set(id, 0); } }
  while (queue.length > 0) {
    const id = queue.shift()!;
    const level = levels.get(id) ?? 0;
    for (const next of outgoing.get(id) ?? []) {
      const newLevel = Math.max(levels.get(next) ?? 0, level + 1);
      levels.set(next, newLevel);
      if (!queue.includes(next)) queue.push(next);
    }
  }
  for (const node of nodes) { if (!levels.has(node.id)) levels.set(node.id, 0); }

  const levelGroups = new Map<number, string[]>();
  for (const [id, level] of levels) {
    const group = levelGroups.get(level) ?? [];
    group.push(id);
    levelGroups.set(level, group);
  }

  const xSpacing = 320, ySpacing = 220;
  const maxLevel = Math.max(...levels.values(), 0);
  const centerX = 400;

  const pos = (nodeId: string, dx: number, dy: number) => {
    const s = nodeLayouts[nodeId];
    return s ? { x: s.x, y: s.y } : { x: dx, y: dy };
  };
  const colorOf = (nodeId: string) => nodeLayouts[nodeId]?.color;

  // --- Reaction nodes ---
  const graphNodes: Node[] = nodes.map((node) => {
    const level = levels.get(node.id) ?? 0;
    const group = levelGroups.get(level) ?? [node.id];
    const idx = group.indexOf(node.id);
    const gw = (group.length - 1) * xSpacing;

    let defaultColor = NEUTRAL_COLOR;
    if (!colorOf(node.id)) {
      const dH = computeDeltaH(node.reaction.reactants, node.reaction.products);
      if (dH !== null && dH < -0.5) defaultColor = EXOTHERMIC_COLOR;
      else if (dH !== null && dH > 0.5) defaultColor = ENDOTHERMIC_COLOR;
    }

    return {
      id: node.id,
      type: "reaction",
      position: pos(node.id, idx * xSpacing - gw / 2 + centerX, level * ySpacing + 150),
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

  // Helper to get edge handles from saved layout
  const edgeHandles = (edgeId: string, defaultSource: HandleSide = "bottom", defaultTarget: HandleSide = "top") => {
    const el = edgeLayouts[edgeId];
    return {
      sourceHandle: `source-${el?.sourceSide ?? defaultSource}`,
      targetHandle: `target-${el?.targetSide ?? defaultTarget}`,
    };
  };

  // --- Link edges (purple) ---
  const graphEdges: Edge[] = links.map((link) => {
    const fromNode = nodes.find((n) => n.id === link.fromReactionId);
    const product = fromNode?.reaction.products[link.fromProductIndex];
    const pct = Math.round(link.fraction * 100);
    const label = product ? `${product.formula} (${pct}%)` : `${pct}%`;
    const handles = edgeHandles(link.id);

    return {
      id: link.id,
      source: link.fromReactionId,
      target: link.toReactionId,
      ...handles,
      reconnectable: true,
      label,
      animated: true,
      style: { stroke: "#8b5cf6", strokeWidth: 2 },
      labelStyle: { fontSize: 10, fontFamily: "monospace", fill: "#6d28d9" },
      labelBgStyle: { fill: "#f5f3ff", fillOpacity: 0.9 },
      labelBgPadding: [6, 3] as [number, number],
      markerEnd: { type: MarkerType.ArrowClosed, color: "#8b5cf6" },
    };
  });

  // --- Feedstock nodes ---
  const feedstockMap = new Map<string, { formula: string; name: string; targets: string[] }>();
  for (const node of nodes) {
    for (let ri = 0; ri < node.reaction.reactants.length; ri++) {
      if (linkedReactants.has(`${node.id}:${ri}`)) continue;
      const r = node.reaction.reactants[ri];
      const key = normalizeFormula(r.formula);
      const ex = feedstockMap.get(key);
      if (ex) { if (!ex.targets.includes(node.id)) ex.targets.push(node.id); }
      else feedstockMap.set(key, { formula: r.formula, name: r.name, targets: [node.id] });
    }
  }
  const feedstocks = Array.from(feedstockMap.entries());
  const fsW = (feedstocks.length - 1) * 160;
  feedstocks.forEach(([key, fs], i) => {
    const nid = `feedstock-${key}`;
    graphNodes.push({
      id: nid, type: "feedstock",
      position: pos(nid, i * 160 - fsW / 2 + centerX, 0),
      draggable: true,
      data: { formula: fs.formula, name: fs.name, color: colorOf(nid), onColorChange },
    });
    for (const tid of fs.targets) {
      const eid = `edge-fs-${key}-${tid}`;
      const ec = colorOf(nid) || "#3b82f6";
      const handles = edgeHandles(eid);
      graphEdges.push({
        id: eid, source: nid, target: tid, ...handles,
        reconnectable: true,
        style: { stroke: ec, strokeWidth: 1.5, strokeDasharray: "6 3" },
        markerEnd: { type: MarkerType.ArrowClosed, color: ec },
      });
    }
  });

  // --- Product nodes ---
  const productMap = new Map<string, { formula: string; name: string; sources: string[] }>();
  for (const node of nodes) {
    for (let pi = 0; pi < node.reaction.products.length; pi++) {
      if (linkedProducts.has(`${node.id}:${pi}`)) continue;
      const p = node.reaction.products[pi];
      const key = normalizeFormula(p.formula);
      const ex = productMap.get(key);
      if (ex) { if (!ex.sources.includes(node.id)) ex.sources.push(node.id); }
      else productMap.set(key, { formula: p.formula, name: p.name, sources: [node.id] });
    }
  }
  const products = Array.from(productMap.entries());
  const prW = (products.length - 1) * 160;
  const prY = (maxLevel + 1) * ySpacing + 150;
  products.forEach(([key, pr], i) => {
    const nid = `product-${key}`;
    graphNodes.push({
      id: nid, type: "product",
      position: pos(nid, i * 160 - prW / 2 + centerX, prY),
      draggable: true,
      data: { formula: pr.formula, name: pr.name, color: colorOf(nid), onColorChange },
    });
    for (const sid of pr.sources) {
      const eid = `edge-pr-${key}-${sid}`;
      const ec = colorOf(nid) || "#22c55e";
      const handles = edgeHandles(eid);
      graphEdges.push({
        id: eid, source: sid, target: nid, ...handles,
        reconnectable: true,
        style: { stroke: ec, strokeWidth: 1.5, strokeDasharray: "6 3" },
        markerEnd: { type: MarkerType.ArrowClosed, color: ec },
      });
    }
  });

  return { graphNodes, graphEdges };
}

// --- Parse handle ID → side ---
function handleIdToSide(handleId: string | null | undefined): HandleSide {
  if (!handleId) return "bottom";
  const parts = handleId.split("-");
  const side = parts[parts.length - 1] as HandleSide;
  return ["top", "right", "bottom", "left"].includes(side) ? side : "bottom";
}

/** Inner component */
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

  const { graphNodes, graphEdges } = useMemo(
    () => buildGraph(system, graphLayout, handleColorChange),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [system, graphLayout]
  );

  const [flowNodes, setFlowNodes] = useState<Node[]>(graphNodes);
  const [flowEdges, setFlowEdges] = useState<Edge[]>(graphEdges);

  useEffect(() => { setFlowNodes(graphNodes); }, [graphNodes]);
  useEffect(() => { setFlowEdges(graphEdges); }, [graphEdges]);

  // --- Node drag ---
  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      setFlowNodes((nds) => {
        const updated = applyNodeChanges(changes, nds);
        if (changes.some((c) => c.type === "position" && c.dragging === false)) {
          updateLayout((prev) => {
            const nn = { ...prev.nodes };
            for (const node of updated) {
              const ex = nn[node.id];
              nn[node.id] = { x: node.position.x, y: node.position.y, color: ex?.color };
            }
            return { ...prev, nodes: nn };
          });
        }
        return updated;
      });
    },
    [updateLayout]
  );

  // --- Edge reconnection (drag arrow endpoint to a different handle) ---
  const onReconnect = useCallback(
    (oldEdge: Edge, newConnection: Connection) => {
      // Only allow reconnecting to a different handle on the same nodes
      if (
        newConnection.source !== oldEdge.source ||
        newConnection.target !== oldEdge.target
      ) return;

      // Update edges in flow state
      setFlowEdges((eds) => reconnectEdge(oldEdge, newConnection, eds));

      // Persist the new handle positions
      const sourceSide = handleIdToSide(newConnection.sourceHandle);
      const targetSide = handleIdToSide(newConnection.targetHandle);
      updateLayout((prev) => ({
        ...prev,
        edges: {
          ...prev.edges,
          [oldEdge.id]: { sourceSide, targetSide },
        },
      }));
    },
    [updateLayout]
  );

  // --- Fit view ---
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
    setTimeout(() => fitView({ padding: 0.12, duration: 300 }), 50);
  }, [system, onLayoutChange, fitView, handleColorChange]);

  const handleDownloadPNG = useCallback(() => {
    if (!containerRef.current) return;
    const vp = containerRef.current.querySelector(".react-flow__viewport") as HTMLElement | null;
    const target = vp ?? containerRef.current;

    // Hide handle dots for a cleaner static image
    const handles = containerRef.current.querySelectorAll<HTMLElement>(".react-flow__handle");
    handles.forEach((h) => (h.style.display = "none"));

    const opts = {
      backgroundColor: "#ffffff",
      pixelRatio: 2,
      style: { width: containerRef.current.offsetWidth + "px", height: containerRef.current.offsetHeight + "px" },
    };

    const restore = () => handles.forEach((h) => (h.style.display = ""));
    const download = (url: string) => {
      const a = document.createElement("a");
      a.href = url;
      a.download = "reaction-network.png";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    };

    toPng(target, opts)
      .then((url) => { download(url); restore(); })
      .catch(() => {
        toPng(containerRef.current!, { backgroundColor: "#ffffff", pixelRatio: 2 })
          .then((url) => { download(url); restore(); })
          .catch(() => { restore(); alert("Could not export graph as PNG."); });
      });
  }, []);

  const totalLevels = Math.max(...flowNodes.map((n) => n.position.y), 200);

  return (
    <div>
      <div className="flex justify-between items-center mb-2">
        <p className="text-[10px] text-gray-400">
          Drag nodes to rearrange • Click color dot to customize • Drag arrow endpoints to change connection side
        </p>
        <div className="flex gap-2">
          <button onClick={handleResetLayout}
            className="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 transition hover:bg-gray-50"
            title="Reset to automatic layout">
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
            </svg>
            Reset Layout
          </button>
          <button onClick={handleDownloadPNG}
            className="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 transition hover:bg-gray-50">
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
          onReconnect={onReconnect}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.12 }}
          minZoom={0.15}
          maxZoom={1.5}
          reconnectRadius={20}
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
