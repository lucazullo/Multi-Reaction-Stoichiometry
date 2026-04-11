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
  onDownloadPNG?: () => void;
}

// Custom node: reaction
function ReactionNodeComponent({ data }: { data: { label: string; equation: string; index: number; displayName?: string } }) {
  const title = data.displayName
    ? `Reaction ${data.index + 1} — ${data.displayName}`
    : `Reaction ${data.index + 1}`;
  return (
    <div className="rounded-lg border-2 border-teal-500 bg-white px-4 py-3 shadow-md min-w-[180px] max-w-[280px]">
      <Handle type="target" position={Position.Top} className="!bg-teal-500 !w-3 !h-3" />
      <div className="text-xs font-semibold text-teal-700 mb-1">{title}</div>
      <div className="text-xs font-mono text-gray-700 leading-snug break-words">{data.equation}</div>
      <div className="text-[10px] text-gray-400 mt-1 truncate">{data.label}</div>
      <Handle type="source" position={Position.Bottom} className="!bg-teal-500 !w-3 !h-3" />
    </div>
  );
}

// Custom node: output product (leaving the system)
function OutputNodeComponent({ data }: { data: { formula: string; name: string } }) {
  return (
    <div className="rounded-lg border-2 border-green-400 bg-green-50 px-3 py-2 shadow-sm min-w-[100px]">
      <Handle type="target" position={Position.Top} className="!bg-green-500 !w-2.5 !h-2.5" />
      <div className="text-xs font-semibold text-green-700">{data.formula}</div>
      <div className="text-[10px] text-green-600">{data.name}</div>
      <div className="text-[9px] text-green-500 mt-0.5">product out</div>
    </div>
  );
}

// Custom node: input feedstock (entering the system)
function InputNodeComponent({ data }: { data: { formula: string; name: string } }) {
  return (
    <div className="rounded-lg border-2 border-blue-400 bg-blue-50 px-3 py-2 shadow-sm min-w-[100px]">
      <div className="text-xs font-semibold text-blue-700">{data.formula}</div>
      <div className="text-[10px] text-blue-600">{data.name}</div>
      <div className="text-[9px] text-blue-500 mt-0.5">feedstock in</div>
      <Handle type="source" position={Position.Bottom} className="!bg-blue-500 !w-2.5 !h-2.5" />
    </div>
  );
}

const nodeTypes: NodeTypes = {
  reaction: ReactionNodeComponent,
  output: OutputNodeComponent,
  input: InputNodeComponent,
};

function buildGraph(system: ReactionSystem) {
  const { nodes, links } = system;

  // Build link lookup
  const linkedProducts = new Set<string>(); // "nodeId:productIdx"
  const linkedReactants = new Set<string>(); // "nodeId:reactantIdx"
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
  const ySpacing = 200;
  const maxLevel = Math.max(...levels.values(), 0);

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
        x: indexInGroup * xSpacing - groupWidth / 2 + 400,
        y: level * ySpacing + 120,
      },
      data: {
        label: node.label.slice(0, 50),
        equation: node.reaction.equation,
        index: nodes.indexOf(node),
        displayName: node.displayName,
      },
    };
  });

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

  // --- Output nodes: products not linked downstream ---
  let outputCount = 0;
  for (const node of nodes) {
    for (let pi = 0; pi < node.reaction.products.length; pi++) {
      const key = `${node.id}:${pi}`;
      if (linkedProducts.has(key)) continue; // linked to downstream

      const product = node.reaction.products[pi];
      const nodeLevel = levels.get(node.id) ?? 0;
      const outputId = `output-${node.id}-${pi}`;

      graphNodes.push({
        id: outputId,
        type: "output",
        position: {
          x: (graphNodes.find((n) => n.id === node.id)?.position.x ?? 400) + 150 + outputCount * 140,
          y: (maxLevel + 1) * ySpacing + 120,
        },
        data: { formula: product.formula, name: product.name },
      });

      graphEdges.push({
        id: `edge-${outputId}`,
        source: node.id,
        target: outputId,
        label: product.formula,
        style: { stroke: "#22c55e", strokeWidth: 1.5, strokeDasharray: "5 3" },
        labelStyle: { fontSize: 9, fontFamily: "monospace", fill: "#16a34a" },
        labelBgStyle: { fill: "#f0fdf4", fillOpacity: 0.9 },
        labelBgPadding: [4, 2] as [number, number],
        markerEnd: { type: MarkerType.ArrowClosed, color: "#22c55e" },
      });

      outputCount++;
    }
  }

  // --- Input nodes: reactants not linked from upstream ---
  let inputCount = 0;
  for (const node of nodes) {
    for (let ri = 0; ri < node.reaction.reactants.length; ri++) {
      const key = `${node.id}:${ri}`;
      if (linkedReactants.has(key)) continue; // linked from upstream

      const reactant = node.reaction.reactants[ri];
      const inputId = `input-${node.id}-${ri}`;

      graphNodes.push({
        id: inputId,
        type: "input",
        position: {
          x: (graphNodes.find((n) => n.id === node.id)?.position.x ?? 400) - 100 + inputCount * 140,
          y: -80,
        },
        data: { formula: reactant.formula, name: reactant.name },
      });

      graphEdges.push({
        id: `edge-${inputId}`,
        source: inputId,
        target: node.id,
        label: reactant.formula,
        style: { stroke: "#3b82f6", strokeWidth: 1.5, strokeDasharray: "5 3" },
        labelStyle: { fontSize: 9, fontFamily: "monospace", fill: "#2563eb" },
        labelBgStyle: { fill: "#eff6ff", fillOpacity: 0.9 },
        labelBgPadding: [4, 2] as [number, number],
        markerEnd: { type: MarkerType.ArrowClosed, color: "#3b82f6" },
      });

      inputCount++;
    }
  }

  return { graphNodes, graphEdges };
}

/** Inner component with useReactFlow access */
function GraphInner({ system }: { system: ReactionSystem }) {
  const { fitView, getNodes } = useReactFlow();
  const containerRef = useRef<HTMLDivElement>(null);
  const { graphNodes, graphEdges } = useMemo(() => buildGraph(system), [system]);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0 && entry.contentRect.height > 0) {
          setTimeout(() => fitView({ padding: 0.15, duration: 200 }), 150);
        }
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [fitView]);

  useEffect(() => {
    setTimeout(() => fitView({ padding: 0.15, duration: 200 }), 250);
  }, [graphNodes.length, graphEdges.length, fitView]);

  const handleDownloadPNG = () => {
    if (!containerRef.current) return;
    const svgEl = containerRef.current.querySelector(".react-flow__viewport");
    if (!svgEl) return;

    // Use the container dimensions
    const rect = containerRef.current.getBoundingClientRect();
    const canvas = document.createElement("canvas");
    const scale = 2;
    canvas.width = rect.width * scale;
    canvas.height = rect.height * scale;
    const ctx = canvas.getContext("2d")!;

    // Serialize the SVG-based viewport
    const svgData = new XMLSerializer().serializeToString(svgEl);
    const svgBlob = new Blob(
      [`<svg xmlns="http://www.w3.org/2000/svg" width="${rect.width}" height="${rect.height}">${svgData}</svg>`],
      { type: "image/svg+xml;charset=utf-8" }
    );
    const url = URL.createObjectURL(svgBlob);
    const img = new Image();
    img.onload = () => {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      canvas.toBlob((blob) => {
        if (!blob) return;
        const dlUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = dlUrl;
        a.download = "reaction-network.png";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(dlUrl);
      }, "image/png");
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      // Fallback: use Canvas 2D text rendering
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.font = "bold 20px sans-serif";
      ctx.fillStyle = "#1f2937";
      ctx.fillText("Reaction Network", 40, 40);
      let y = 80;
      ctx.font = "14px monospace";
      for (const node of system.nodes) {
        const title = node.displayName
          ? `Rxn ${system.nodes.indexOf(node) + 1} — ${node.displayName}`
          : `Rxn ${system.nodes.indexOf(node) + 1}`;
        ctx.fillStyle = "#0d9488";
        ctx.fillText(title, 40, y);
        y += 20;
        ctx.fillStyle = "#374151";
        ctx.fillText(node.reaction.equation, 60, y);
        y += 30;
      }
      canvas.toBlob((blob) => {
        if (!blob) return;
        const dlUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = dlUrl;
        a.download = "reaction-network.png";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(dlUrl);
      }, "image/png");
    };
    img.src = url;
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
        style={{ height: Math.max(totalLevels + 250, 450) }}
      >
        <ReactFlow
          nodes={graphNodes}
          edges={graphEdges}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.15 }}
          minZoom={0.2}
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
