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

const ALL_SIDES: HandleSide[] = ["top", "right", "bottom", "left"];
const SIDE_LABELS: Record<HandleSide, string> = { top: "Top", right: "Right", bottom: "Bottom", left: "Left" };
const SIDE_TO_POSITION: Record<HandleSide, Position> = {
  top: Position.Top, bottom: Position.Bottom, left: Position.Left, right: Position.Right,
};

interface ReactionNetworkGraphProps {
  system: ReactionSystem;
  graphLayout?: GraphLayout;
  onLayoutChange?: (layout: GraphLayout) => void;
}

// --- Color Picker ---

function ColorPicker({
  colors, currentColor, onSelect, onClose,
}: {
  colors: string[]; currentColor?: string; onSelect: (c: string) => void; onClose: () => void;
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
    <div ref={ref}
      className="absolute z-50 top-full left-0 mt-1 rounded-lg border border-gray-200 bg-white p-3 shadow-lg"
      style={{ minWidth: Math.min(colors.length, 9) * 32 + 16 }}
      onMouseDown={(e) => e.stopPropagation()}>
      <div className="flex flex-wrap gap-2">
        {colors.map((c) => (
          <button key={c}
            onClick={(e) => { e.stopPropagation(); onSelect(c); onClose(); }}
            className="h-6 w-6 rounded-full border-2 transition-all hover:scale-110"
            style={{
              backgroundColor: c,
              borderColor: currentColor === c ? "#1e293b" : "transparent",
              boxShadow: currentColor === c ? "0 0 0 2px #cbd5e1" : "none",
            }} />
        ))}
      </div>
    </div>
  );
}

// --- Edge Context Menu (right-click on arrow) ---

function EdgeContextMenu({
  edgeId, sourceLabel, targetLabel, currentSourceSide, currentTargetSide,
  position, onChangeSide, onClose,
}: {
  edgeId: string; sourceLabel: string; targetLabel: string;
  currentSourceSide: HandleSide; currentTargetSide: HandleSide;
  position: { x: number; y: number };
  onChangeSide: (edgeId: string, sourceSide: HandleSide, targetSide: HandleSide) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [srcSide, setSrcSide] = useState(currentSourceSide);
  const [tgtSide, setTgtSide] = useState(currentTargetSide);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as globalThis.Node)) onClose();
    };
    // Small delay so the right-click event doesn't immediately close it
    const timer = setTimeout(() => document.addEventListener("mousedown", handler), 50);
    return () => { clearTimeout(timer); document.removeEventListener("mousedown", handler); };
  }, [onClose]);

  // Apply changes immediately when a side is clicked
  const handleSrcChange = (side: HandleSide) => {
    setSrcSide(side);
    onChangeSide(edgeId, side, tgtSide);
  };
  const handleTgtChange = (side: HandleSide) => {
    setTgtSide(side);
    onChangeSide(edgeId, srcSide, side);
  };

  return (
    <div ref={ref}
      className="fixed z-[100] rounded-lg border border-gray-200 bg-white py-3 px-4 shadow-xl text-xs"
      style={{ left: position.x + 4, top: position.y + 4 }}>
      <p className="font-semibold text-gray-600 mb-2.5">Route edge</p>

      <div className="mb-2.5">
        <p className="text-gray-400 mb-1.5">
          From <span className="font-medium text-gray-600">{sourceLabel}</span>
        </p>
        <div className="flex gap-1">
          {ALL_SIDES.map((s) => (
            <button key={s} onClick={() => handleSrcChange(s)}
              className={`px-2 py-1 rounded text-[11px] font-medium transition ${
                srcSide === s
                  ? "bg-purple-100 text-purple-700 ring-1 ring-purple-300"
                  : "bg-gray-50 text-gray-500 hover:bg-gray-100"
              }`}>
              {SIDE_LABELS[s]}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-gray-400 mb-1.5">
          To <span className="font-medium text-gray-600">{targetLabel}</span>
        </p>
        <div className="flex gap-1">
          {ALL_SIDES.map((s) => (
            <button key={s} onClick={() => handleTgtChange(s)}
              className={`px-2 py-1 rounded text-[11px] font-medium transition ${
                tgtSide === s
                  ? "bg-purple-100 text-purple-700 ring-1 ring-purple-300"
                  : "bg-gray-50 text-gray-500 hover:bg-gray-100"
              }`}>
              {SIDE_LABELS[s]}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// --- Custom Nodes ---

const handleDot = (color: string, size = 8) => ({ background: color, width: size, height: size });

function ReactionNodeComponent({ id, data }: {
  id: string;
  data: { label: string; equation: string; index: number; displayName?: string; color?: string;
    onColorChange?: (nodeId: string, color: string) => void };
}) {
  const [showPicker, setShowPicker] = useState(false);
  const color = data.color || NEUTRAL_COLOR;
  const title = data.displayName
    ? `Reaction ${data.index + 1} — ${data.displayName}`
    : `Reaction ${data.index + 1}`;

  return (
    <div className="relative rounded-lg border-2 bg-white px-4 py-3 shadow-md min-w-[180px] max-w-[280px]"
      style={{ borderColor: color }}>
      <Handle id="target-top"    type="target" position={Position.Top}    style={handleDot(color)} />
      <Handle id="target-right"  type="target" position={Position.Right}  style={{ ...handleDot(color), top: "30%" }} />
      <Handle id="target-bottom" type="target" position={Position.Bottom} style={handleDot(color)} />
      <Handle id="target-left"   type="target" position={Position.Left}   style={{ ...handleDot(color), top: "30%" }} />
      <Handle id="source-top"    type="source" position={Position.Top}    style={{ ...handleDot(color), left: "60%" }} />
      <Handle id="source-right"  type="source" position={Position.Right}  style={{ ...handleDot(color), top: "70%" }} />
      <Handle id="source-bottom" type="source" position={Position.Bottom} style={handleDot(color)} />
      <Handle id="source-left"   type="source" position={Position.Left}   style={{ ...handleDot(color), top: "70%" }} />
      <div className="flex items-center gap-1.5 mb-1">
        <div className="relative">
          <button title="Change color"
            onClick={(e) => { e.stopPropagation(); setShowPicker(!showPicker); }}
            className="h-3.5 w-3.5 rounded-full border border-gray-300 flex-shrink-0 hover:scale-125 transition-transform"
            style={{ backgroundColor: color }}
            onMouseDown={(e) => e.stopPropagation()} />
          {showPicker && (
            <ColorPicker colors={REACTION_COLORS} currentColor={color}
              onSelect={(c) => data.onColorChange?.(id, c)} onClose={() => setShowPicker(false)} />
          )}
        </div>
        <div className="text-xs font-semibold flex-1" style={{ color }}>{title}</div>
      </div>
      <div className="text-xs font-mono text-gray-700 leading-snug break-words">{data.equation}</div>
    </div>
  );
}

function SubstanceNodeComponent({ id, data, type }: {
  id: string; type: "feedstock" | "product";
  data: { formula: string; name: string; color?: string;
    onColorChange?: (nodeId: string, color: string) => void };
}) {
  const [showPicker, setShowPicker] = useState(false);
  const defaultColor = type === "feedstock" ? "#3b82f6" : "#22c55e";
  const color = data.color || defaultColor;
  const ht = type === "feedstock" ? "source" : "target";

  return (
    <div className="relative flex items-center justify-center rounded-full border-2 px-5 py-2.5 shadow-sm min-w-[90px]"
      style={{ borderColor: color, backgroundColor: `${color}10` }}>
      <Handle id={`${ht}-top`}    type={ht} position={Position.Top}    style={handleDot(color, 7)} />
      <Handle id={`${ht}-right`}  type={ht} position={Position.Right}  style={handleDot(color, 7)} />
      <Handle id={`${ht}-bottom`} type={ht} position={Position.Bottom} style={handleDot(color, 7)} />
      <Handle id={`${ht}-left`}   type={ht} position={Position.Left}   style={handleDot(color, 7)} />
      <div className="text-center">
        <div className="flex items-center justify-center gap-1">
          <div className="relative">
            <button title="Change color"
              onClick={(e) => { e.stopPropagation(); setShowPicker(!showPicker); }}
              className="h-2.5 w-2.5 rounded-full border border-gray-300 flex-shrink-0 hover:scale-125 transition-transform"
              style={{ backgroundColor: color }}
              onMouseDown={(e) => e.stopPropagation()} />
            {showPicker && (
              <ColorPicker colors={SUBSTANCE_COLORS} currentColor={color}
                onSelect={(c) => data.onColorChange?.(id, c)} onClose={() => setShowPicker(false)} />
            )}
          </div>
          <div className="text-xs font-bold" style={{ color }}>{data.formula}</div>
        </div>
        <div className="text-[9px]" style={{ color, opacity: 0.7 }}>{data.name}</div>
      </div>
    </div>
  );
}

function FeedstockNodeComponent(props: { id: string; data: { formula: string; name: string; color?: string; onColorChange?: (id: string, c: string) => void } }) {
  return <SubstanceNodeComponent {...props} type="feedstock" />;
}
function ProductNodeComponent(props: { id: string; data: { formula: string; name: string; color?: string; onColorChange?: (id: string, c: string) => void } }) {
  return <SubstanceNodeComponent {...props} type="product" />;
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

  // Topology
  const inDeg = new Map<string, number>();
  const out = new Map<string, string[]>();
  for (const n of nodes) { inDeg.set(n.id, 0); out.set(n.id, []); }
  for (const l of links) {
    inDeg.set(l.toReactionId, (inDeg.get(l.toReactionId) ?? 0) + 1);
    out.get(l.fromReactionId)?.push(l.toReactionId);
  }
  const levels = new Map<string, number>();
  const q: string[] = [];
  for (const [id, d] of inDeg) { if (d === 0) { q.push(id); levels.set(id, 0); } }
  while (q.length) {
    const id = q.shift()!;
    for (const nx of out.get(id) ?? []) {
      levels.set(nx, Math.max(levels.get(nx) ?? 0, (levels.get(id) ?? 0) + 1));
      if (!q.includes(nx)) q.push(nx);
    }
  }
  for (const n of nodes) { if (!levels.has(n.id)) levels.set(n.id, 0); }

  const groups = new Map<number, string[]>();
  for (const [id, lv] of levels) { const g = groups.get(lv) ?? []; g.push(id); groups.set(lv, g); }

  const xSp = 320, ySp = 220;
  const maxLv = Math.max(...levels.values(), 0);
  const cx = 400;

  const pos = (nid: string, dx: number, dy: number) => {
    const s = nodeLayouts[nid]; return s ? { x: s.x, y: s.y } : { x: dx, y: dy };
  };
  const colorOf = (nid: string) => nodeLayouts[nid]?.color;
  const edgeHandles = (eid: string, defSrc: HandleSide = "bottom", defTgt: HandleSide = "top") => {
    const el = edgeLayouts[eid];
    return { sourceHandle: `source-${el?.sourceSide ?? defSrc}`, targetHandle: `target-${el?.targetSide ?? defTgt}` };
  };

  // Node label map (for context menu display)
  const labelMap = new Map<string, string>();

  // Reaction nodes
  const gNodes: Node[] = nodes.map((n) => {
    const lv = levels.get(n.id) ?? 0;
    const gr = groups.get(lv) ?? [n.id];
    const ix = gr.indexOf(n.id);
    const gw = (gr.length - 1) * xSp;
    let defColor = NEUTRAL_COLOR;
    if (!colorOf(n.id)) {
      const dH = computeDeltaH(n.reaction.reactants, n.reaction.products);
      if (dH !== null && dH < -0.5) defColor = EXOTHERMIC_COLOR;
      else if (dH !== null && dH > 0.5) defColor = ENDOTHERMIC_COLOR;
    }
    const label = n.displayName || `R${nodes.indexOf(n) + 1}`;
    labelMap.set(n.id, label);
    return {
      id: n.id, type: "reaction",
      position: pos(n.id, ix * xSp - gw / 2 + cx, lv * ySp + 150),
      draggable: true,
      data: {
        label: n.label.slice(0, 50), equation: n.reaction.equation,
        index: nodes.indexOf(n), displayName: n.displayName,
        color: colorOf(n.id) || defColor, onColorChange,
      },
    };
  });

  // Link edges
  const gEdges: Edge[] = links.map((l) => {
    const fn = nodes.find((n) => n.id === l.fromReactionId);
    const pr = fn?.reaction.products[l.fromProductIndex];
    const pct = Math.round(l.fraction * 100);
    const label = pr ? `${pr.formula} (${pct}%)` : `${pct}%`;
    return {
      id: l.id, source: l.fromReactionId, target: l.toReactionId,
      ...edgeHandles(l.id), label, animated: true,
      style: { stroke: "#8b5cf6", strokeWidth: 2 },
      labelStyle: { fontSize: 10, fontFamily: "monospace", fill: "#6d28d9" },
      labelBgStyle: { fill: "#f5f3ff", fillOpacity: 0.9 },
      labelBgPadding: [6, 3] as [number, number],
      markerEnd: { type: MarkerType.ArrowClosed, color: "#8b5cf6" },
    };
  });

  // Feedstock nodes
  const fsMap = new Map<string, { formula: string; name: string; targets: string[] }>();
  for (const n of nodes) {
    for (let i = 0; i < n.reaction.reactants.length; i++) {
      if (linkedReactants.has(`${n.id}:${i}`)) continue;
      const r = n.reaction.reactants[i];
      const k = normalizeFormula(r.formula);
      const ex = fsMap.get(k);
      if (ex) { if (!ex.targets.includes(n.id)) ex.targets.push(n.id); }
      else fsMap.set(k, { formula: r.formula, name: r.name, targets: [n.id] });
    }
  }
  const fsList = Array.from(fsMap.entries());
  const fsW = (fsList.length - 1) * 160;
  fsList.forEach(([k, fs], i) => {
    const nid = `feedstock-${k}`;
    labelMap.set(nid, fs.formula);
    gNodes.push({
      id: nid, type: "feedstock",
      position: pos(nid, i * 160 - fsW / 2 + cx, 0),
      draggable: true,
      data: { formula: fs.formula, name: fs.name, color: colorOf(nid), onColorChange },
    });
    for (const tid of fs.targets) {
      const eid = `edge-fs-${k}-${tid}`;
      const ec = colorOf(nid) || "#3b82f6";
      gEdges.push({
        id: eid, source: nid, target: tid, ...edgeHandles(eid),
        style: { stroke: ec, strokeWidth: 1.5, strokeDasharray: "6 3" },
        markerEnd: { type: MarkerType.ArrowClosed, color: ec },
      });
    }
  });

  // Product nodes
  const prMap = new Map<string, { formula: string; name: string; sources: string[] }>();
  for (const n of nodes) {
    for (let i = 0; i < n.reaction.products.length; i++) {
      if (linkedProducts.has(`${n.id}:${i}`)) continue;
      const p = n.reaction.products[i];
      const k = normalizeFormula(p.formula);
      const ex = prMap.get(k);
      if (ex) { if (!ex.sources.includes(n.id)) ex.sources.push(n.id); }
      else prMap.set(k, { formula: p.formula, name: p.name, sources: [n.id] });
    }
  }
  const prList = Array.from(prMap.entries());
  const prW = (prList.length - 1) * 160;
  const prY = (maxLv + 1) * ySp + 150;
  prList.forEach(([k, pr], i) => {
    const nid = `product-${k}`;
    labelMap.set(nid, pr.formula);
    gNodes.push({
      id: nid, type: "product",
      position: pos(nid, i * 160 - prW / 2 + cx, prY),
      draggable: true,
      data: { formula: pr.formula, name: pr.name, color: colorOf(nid), onColorChange },
    });
    for (const sid of pr.sources) {
      const eid = `edge-pr-${k}-${sid}`;
      const ec = colorOf(nid) || "#22c55e";
      gEdges.push({
        id: eid, source: sid, target: nid, ...edgeHandles(eid),
        style: { stroke: ec, strokeWidth: 1.5, strokeDasharray: "6 3" },
        markerEnd: { type: MarkerType.ArrowClosed, color: ec },
      });
    }
  });

  return { graphNodes: gNodes, graphEdges: gEdges, labelMap };
}

/** Inner component */
function GraphInner({
  system, graphLayout, onLayoutChange,
}: {
  system: ReactionSystem; graphLayout?: GraphLayout; onLayoutChange?: (l: GraphLayout) => void;
}) {
  const { fitView } = useReactFlow();
  const containerRef = useRef<HTMLDivElement>(null);
  const layoutRef = useRef<GraphLayout>(graphLayout ?? { nodes: {}, edges: {} });

  // Edge context menu state
  const [edgeMenu, setEdgeMenu] = useState<{
    edgeId: string; sourceId: string; targetId: string;
    sourceSide: HandleSide; targetSide: HandleSide;
    pos: { x: number; y: number };
  } | null>(null);

  useEffect(() => { if (graphLayout) layoutRef.current = graphLayout; }, [graphLayout]);

  const updateLayout = useCallback(
    (fn: (prev: GraphLayout) => GraphLayout) => {
      const u = fn(layoutRef.current);
      layoutRef.current = u;
      onLayoutChange?.(u);
    },
    [onLayoutChange]
  );

  const handleColorChange = useCallback(
    (nodeId: string, color: string) => {
      updateLayout((p) => ({
        ...p, nodes: { ...p.nodes, [nodeId]: { ...(p.nodes[nodeId] ?? { x: 0, y: 0 }), color } },
      }));
      setFlowNodes((nds) =>
        nds.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, color } } : n))
      );
    },
    [updateLayout]
  );

  // Edge side change — update layout AND directly update flowEdges for instant feedback
  const handleEdgeSideChange = useCallback(
    (edgeId: string, sourceSide: HandleSide, targetSide: HandleSide) => {
      updateLayout((p) => ({
        ...p, edges: { ...p.edges, [edgeId]: { sourceSide, targetSide } },
      }));
      setFlowEdges((eds) =>
        eds.map((e) =>
          e.id === edgeId
            ? { ...e, sourceHandle: `source-${sourceSide}`, targetHandle: `target-${targetSide}` }
            : e
        )
      );
    },
    [updateLayout]
  );

  const { graphNodes, graphEdges, labelMap } = useMemo(
    () => buildGraph(system, graphLayout, handleColorChange),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [system, graphLayout]
  );

  const [flowNodes, setFlowNodes] = useState<Node[]>(graphNodes);
  const [flowEdges, setFlowEdges] = useState<Edge[]>(graphEdges);

  // Sync from buildGraph when it recomputes (system or layout change)
  useEffect(() => {
    setFlowNodes(graphNodes);
    setFlowEdges(graphEdges);
  }, [graphNodes, graphEdges]);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      setFlowNodes((nds) => {
        const updated = applyNodeChanges(changes, nds);
        if (changes.some((c) => c.type === "position" && c.dragging === false)) {
          updateLayout((p) => {
            const nn = { ...p.nodes };
            for (const n of updated) {
              nn[n.id] = { x: n.position.x, y: n.position.y, color: nn[n.id]?.color };
            }
            return { ...p, nodes: nn };
          });
        }
        return updated;
      });
    },
    [updateLayout]
  );

  // Right-click on edge → show context menu
  const onEdgeContextMenu = useCallback(
    (event: React.MouseEvent, edge: Edge) => {
      event.preventDefault();
      event.stopPropagation();
      const el = layoutRef.current.edges[edge.id];
      setEdgeMenu({
        edgeId: edge.id,
        sourceId: edge.source,
        targetId: edge.target,
        sourceSide: el?.sourceSide ?? "bottom",
        targetSide: el?.targetSide ?? "top",
        pos: { x: event.clientX, y: event.clientY },
      });
    },
    []
  );

  const onPaneClick = useCallback(() => { setEdgeMenu(null); }, []);

  // Fit view
  useEffect(() => {
    if (!containerRef.current) return;
    const obs = new ResizeObserver((entries) => {
      for (const e of entries) {
        if (e.contentRect.width > 0 && e.contentRect.height > 0)
          setTimeout(() => fitView({ padding: 0.12, duration: 200 }), 150);
      }
    });
    obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, [fitView]);

  useEffect(() => {
    setTimeout(() => fitView({ padding: 0.12, duration: 200 }), 250);
  }, [graphNodes.length, graphEdges.length, fitView]);

  const handleResetLayout = useCallback(() => {
    layoutRef.current = { nodes: {}, edges: {} };
    onLayoutChange?.({ nodes: {}, edges: {} });
    const { graphNodes: fresh, graphEdges: freshE } = buildGraph(system, undefined, handleColorChange);
    setFlowNodes(fresh);
    setFlowEdges(freshE);
    setEdgeMenu(null);
    setTimeout(() => fitView({ padding: 0.12, duration: 300 }), 50);
  }, [system, onLayoutChange, fitView, handleColorChange]);

  const handleDownloadPNG = useCallback(() => {
    if (!containerRef.current) return;
    const vp = containerRef.current.querySelector(".react-flow__viewport") as HTMLElement | null;
    const target = vp ?? containerRef.current;

    // Filter out handle dots, controls, and color-picker buttons during clone
    const filter = (node: HTMLElement): boolean => {
      if (!(node instanceof HTMLElement)) return true;
      if (node.classList?.contains("react-flow__handle")) return false;
      if (node.classList?.contains("react-flow__minimap")) return false;
      if (node.classList?.contains("react-flow__controls")) return false;
      if (node.getAttribute?.("title") === "Change color") return false;
      return true;
    };

    // Temporarily strip box-shadows from all nodes for a clean export
    const nodesWithShadow = containerRef.current.querySelectorAll<HTMLElement>(
      ".shadow-md, .shadow-sm, .shadow-lg, .shadow-xl"
    );
    const savedShadows: string[] = [];
    nodesWithShadow.forEach((el, i) => {
      savedShadows[i] = el.style.boxShadow;
      el.style.boxShadow = "none";
    });

    const restore = () => {
      nodesWithShadow.forEach((el, i) => {
        el.style.boxShadow = savedShadows[i];
      });
    };

    const opts = {
      backgroundColor: "#ffffff", pixelRatio: 2, filter,
      style: { width: containerRef.current.offsetWidth + "px", height: containerRef.current.offsetHeight + "px" },
    };
    const dl = (url: string) => {
      const a = document.createElement("a");
      a.href = url; a.download = "reaction-network.png";
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
    };

    toPng(target, opts)
      .then((url) => { dl(url); restore(); })
      .catch(() => {
        toPng(containerRef.current!, { backgroundColor: "#ffffff", pixelRatio: 2, filter })
          .then((url) => { dl(url); restore(); })
          .catch(() => { restore(); alert("Could not export graph as PNG."); });
      });
  }, []);

  const totalLevels = Math.max(...flowNodes.map((n) => n.position.y), 200);

  return (
    <div>
      <div className="flex justify-between items-center mb-2">
        <p className="text-[10px] text-gray-400">
          Drag nodes to rearrange • Click color dot to customize • Right-click an arrow to change its routing
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
      <div ref={containerRef}
        className="rounded-xl border border-gray-200 bg-white overflow-hidden"
        style={{ height: Math.max(totalLevels + 150, 450) }}>
        <ReactFlow
          nodes={flowNodes}
          edges={flowEdges}
          onNodesChange={onNodesChange}
          onEdgeContextMenu={onEdgeContextMenu}
          onPaneClick={onPaneClick}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.12 }}
          minZoom={0.15}
          maxZoom={1.5}
          proOptions={{ hideAttribution: true }}>
          <Background gap={20} size={1} color="#f0f0f0" />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>

      {/* Right-click context menu for edge routing */}
      {edgeMenu && (
        <EdgeContextMenu
          edgeId={edgeMenu.edgeId}
          sourceLabel={labelMap.get(edgeMenu.sourceId) ?? edgeMenu.sourceId}
          targetLabel={labelMap.get(edgeMenu.targetId) ?? edgeMenu.targetId}
          currentSourceSide={edgeMenu.sourceSide}
          currentTargetSide={edgeMenu.targetSide}
          position={edgeMenu.pos}
          onChangeSide={handleEdgeSideChange}
          onClose={() => setEdgeMenu(null)}
        />
      )}
    </div>
  );
}

export default function ReactionNetworkGraph({
  system, graphLayout, onLayoutChange,
}: ReactionNetworkGraphProps) {
  return (
    <ReactFlowProvider>
      <GraphInner system={system} graphLayout={graphLayout} onLayoutChange={onLayoutChange} />
    </ReactFlowProvider>
  );
}
