"use client";

import { useMemo, useRef, useEffect } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  useReactFlow,
  ReactFlowProvider,
  type Node,
  type Edge,
  type NodeTypes,
  Handle,
  Position,
  MarkerType,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { ReactionSystem } from "@/lib/types";
import { normalizeFormula } from "@/lib/utils";

interface ReactionNetworkGraphProps {
  system: ReactionSystem;
}

// --- Custom Nodes ---

// Reaction: rectangle (teal border)
function ReactionNodeComponent({ data }: { data: { label: string; equation: string; index: number; displayName?: string } }) {
  const title = data.displayName
    ? `Reaction ${data.index + 1} — ${data.displayName}`
    : `Reaction ${data.index + 1}`;
  return (
    <div className="rounded-lg border-2 border-teal-500 bg-white px-4 py-3 shadow-md min-w-[180px] max-w-[280px]">
      <Handle type="target" position={Position.Top} className="!bg-teal-500 !w-3 !h-3" />
      <div className="text-xs font-semibold text-teal-700 mb-1">{title}</div>
      <div className="text-xs font-mono text-gray-700 leading-snug break-words">{data.equation}</div>
      <Handle type="source" position={Position.Bottom} className="!bg-teal-500 !w-3 !h-3" />
    </div>
  );
}

// Feedstock: blue oval
function FeedstockNodeComponent({ data }: { data: { formula: string; name: string } }) {
  return (
    <div className="flex items-center justify-center rounded-full border-2 border-blue-500 bg-blue-50 px-5 py-2.5 shadow-sm min-w-[90px]">
      <div className="text-center">
        <div className="text-xs font-bold text-blue-700">{data.formula}</div>
        <div className="text-[9px] text-blue-500">{data.name}</div>
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-blue-500 !w-2.5 !h-2.5" />
    </div>
  );
}

// Product: green oval
function ProductNodeComponent({ data }: { data: { formula: string; name: string } }) {
  return (
    <div className="flex items-center justify-center rounded-full border-2 border-green-500 bg-green-50 px-5 py-2.5 shadow-sm min-w-[90px]">
      <Handle type="target" position={Position.Top} className="!bg-green-500 !w-2.5 !h-2.5" />
      <div className="text-center">
        <div className="text-xs font-bold text-green-700">{data.formula}</div>
        <div className="text-[9px] text-green-500">{data.name}</div>
      </div>
    </div>
  );
}

const nodeTypes: NodeTypes = {
  reaction: ReactionNodeComponent,
  feedstock: FeedstockNodeComponent,
  product: ProductNodeComponent,
};

function buildGraph(system: ReactionSystem) {
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

  // --- Reaction nodes ---
  const graphNodes: Node[] = nodes.map((node) => {
    const level = levels.get(node.id) ?? 0;
    const group = levelGroups.get(level) ?? [node.id];
    const indexInGroup = group.indexOf(node.id);
    const groupWidth = (group.length - 1) * xSpacing;

    return {
      id: node.id,
      type: "reaction",
      position: {
        x: indexInGroup * xSpacing - groupWidth / 2 + centerX,
        y: level * ySpacing + 150,
      },
      data: {
        label: node.label.slice(0, 50),
        equation: node.reaction.equation,
        index: nodes.indexOf(node),
        displayName: node.displayName,
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
      label,
      animated: true,
      style: { stroke: "#8b5cf6", strokeWidth: 2 },
      labelStyle: { fontSize: 10, fontFamily: "monospace", fill: "#6d28d9" },
      labelBgStyle: { fill: "#f5f3ff", fillOpacity: 0.9 },
      labelBgPadding: [6, 3] as [number, number],
      markerEnd: { type: MarkerType.ArrowClosed, color: "#8b5cf6" },
    };
  });

  // --- Deduplicated feedstock nodes (blue ovals, top) ---
  // Group unlinked reactants by normalized formula → single node per unique feedstock
  const feedstockMap = new Map<string, { formula: string; name: string; targetReactions: string[] }>();
  for (const node of nodes) {
    for (let ri = 0; ri < node.reaction.reactants.length; ri++) {
      if (linkedReactants.has(`${node.id}:${ri}`)) continue;
      const reactant = node.reaction.reactants[ri];
      const key = normalizeFormula(reactant.formula);
      const existing = feedstockMap.get(key);
      if (existing) {
        if (!existing.targetReactions.includes(node.id)) {
          existing.targetReactions.push(node.id);
        }
      } else {
        feedstockMap.set(key, {
          formula: reactant.formula,
          name: reactant.name,
          targetReactions: [node.id],
        });
      }
    }
  }

  const feedstocks = Array.from(feedstockMap.entries());
  const feedstockWidth = (feedstocks.length - 1) * 160;
  feedstocks.forEach(([key, fs], i) => {
    const nodeId = `feedstock-${key}`;
    graphNodes.push({
      id: nodeId,
      type: "feedstock",
      position: {
        x: i * 160 - feedstockWidth / 2 + centerX,
        y: 0,
      },
      data: { formula: fs.formula, name: fs.name },
    });
    for (const targetId of fs.targetReactions) {
      graphEdges.push({
        id: `edge-fs-${key}-${targetId}`,
        source: nodeId,
        target: targetId,
        style: { stroke: "#3b82f6", strokeWidth: 1.5, strokeDasharray: "6 3" },
        markerEnd: { type: MarkerType.ArrowClosed, color: "#3b82f6" },
      });
    }
  });

  // --- Deduplicated product nodes (green ovals, bottom) ---
  const productMap = new Map<string, { formula: string; name: string; sourceReactions: string[] }>();
  for (const node of nodes) {
    for (let pi = 0; pi < node.reaction.products.length; pi++) {
      if (linkedProducts.has(`${node.id}:${pi}`)) continue;
      const product = node.reaction.products[pi];
      const key = normalizeFormula(product.formula);
      const existing = productMap.get(key);
      if (existing) {
        if (!existing.sourceReactions.includes(node.id)) {
          existing.sourceReactions.push(node.id);
        }
      } else {
        productMap.set(key, {
          formula: product.formula,
          name: product.name,
          sourceReactions: [node.id],
        });
      }
    }
  }

  const products = Array.from(productMap.entries());
  const productWidth = (products.length - 1) * 160;
  const productY = (maxLevel + 1) * ySpacing + 150;
  products.forEach(([key, pr], i) => {
    const nodeId = `product-${key}`;
    graphNodes.push({
      id: nodeId,
      type: "product",
      position: {
        x: i * 160 - productWidth / 2 + centerX,
        y: productY,
      },
      data: { formula: pr.formula, name: pr.name },
    });
    for (const sourceId of pr.sourceReactions) {
      graphEdges.push({
        id: `edge-pr-${key}-${sourceId}`,
        source: sourceId,
        target: nodeId,
        style: { stroke: "#22c55e", strokeWidth: 1.5, strokeDasharray: "6 3" },
        markerEnd: { type: MarkerType.ArrowClosed, color: "#22c55e" },
      });
    }
  });

  return { graphNodes, graphEdges };
}

/** Inner component with useReactFlow access */
function GraphInner({ system }: { system: ReactionSystem }) {
  const { fitView } = useReactFlow();
  const containerRef = useRef<HTMLDivElement>(null);
  const { graphNodes, graphEdges } = useMemo(() => buildGraph(system), [system]);

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

  const handleDownloadPNG = () => {
    if (!containerRef.current) return;

    // Fallback: Canvas 2D text rendering (reliable across all browsers)
    const rect = containerRef.current.getBoundingClientRect();
    const scale = 2;
    const canvas = document.createElement("canvas");
    canvas.width = rect.width * scale;
    canvas.height = rect.height * scale;
    const ctx = canvas.getContext("2d")!;
    ctx.scale(scale, scale);

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, rect.width, rect.height);

    // Title
    ctx.font = "bold 18px sans-serif";
    ctx.fillStyle = "#1f2937";
    ctx.fillText("Reaction Network", 30, 30);

    let y = 60;

    // Feedstocks
    ctx.font = "bold 12px sans-serif";
    ctx.fillStyle = "#3b82f6";
    ctx.fillText("Feedstocks:", 30, y); y += 18;
    ctx.font = "12px monospace";
    const feedstocks = new Set<string>();
    for (const node of system.nodes) {
      for (let ri = 0; ri < node.reaction.reactants.length; ri++) {
        const key = `${node.id}:${ri}`;
        const isLinked = system.links.some(l => l.toReactionId === node.id && l.toReactantIndex === ri);
        if (!isLinked) feedstocks.add(`${node.reaction.reactants[ri].formula} (${node.reaction.reactants[ri].name})`);
      }
    }
    for (const fs of feedstocks) { ctx.fillText(`  ${fs}`, 30, y); y += 16; }
    y += 10;

    // Reactions
    ctx.font = "bold 12px sans-serif";
    ctx.fillStyle = "#0d9488";
    ctx.fillText("Reactions:", 30, y); y += 18;
    for (const node of system.nodes) {
      const idx = system.nodes.indexOf(node) + 1;
      const title = node.displayName ? `${idx}. ${node.displayName}` : `${idx}.`;
      ctx.font = "bold 12px sans-serif";
      ctx.fillStyle = "#0d9488";
      ctx.fillText(title, 30, y); y += 16;
      ctx.font = "12px monospace";
      ctx.fillStyle = "#374151";
      ctx.fillText(`   ${node.reaction.equation}`, 30, y); y += 20;
    }
    y += 10;

    // Links
    if (system.links.length > 0) {
      ctx.font = "bold 12px sans-serif";
      ctx.fillStyle = "#7c3aed";
      ctx.fillText("Links:", 30, y); y += 18;
      ctx.font = "12px monospace";
      for (const link of system.links) {
        const from = system.nodes.find(n => n.id === link.fromReactionId);
        const to = system.nodes.find(n => n.id === link.toReactionId);
        const prod = from?.reaction.products[link.fromProductIndex];
        const pct = Math.round(link.fraction * 100);
        ctx.fillText(`  Rxn ${system.nodes.indexOf(from!) + 1} → Rxn ${system.nodes.indexOf(to!) + 1}: ${prod?.formula ?? '?'} (${pct}%)`, 30, y);
        y += 16;
      }
      y += 10;
    }

    // Products
    ctx.font = "bold 12px sans-serif";
    ctx.fillStyle = "#22c55e";
    ctx.fillText("Products:", 30, y); y += 18;
    ctx.font = "12px monospace";
    const products = new Set<string>();
    for (const node of system.nodes) {
      for (let pi = 0; pi < node.reaction.products.length; pi++) {
        const key = `${node.id}:${pi}`;
        const isLinked = system.links.some(l => l.fromReactionId === node.id && l.fromProductIndex === pi);
        if (!isLinked) products.add(`${node.reaction.products[pi].formula} (${node.reaction.products[pi].name})`);
      }
    }
    for (const pr of products) { ctx.fillText(`  ${pr}`, 30, y); y += 16; }

    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "reaction-network.png";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, "image/png");
  };

  const totalLevels = Math.max(...graphNodes.map((n) => n.position.y), 200);

  return (
    <div>
      <div className="flex justify-end mb-2">
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
      <div
        ref={containerRef}
        className="rounded-xl border border-gray-200 bg-white overflow-hidden"
        style={{ height: Math.max(totalLevels + 150, 450) }}
      >
        <ReactFlow
          nodes={graphNodes}
          edges={graphEdges}
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

export default function ReactionNetworkGraph({ system }: ReactionNetworkGraphProps) {
  return (
    <ReactFlowProvider>
      <GraphInner system={system} />
    </ReactFlowProvider>
  );
}
