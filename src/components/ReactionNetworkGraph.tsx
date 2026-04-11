"use client";

import { useMemo, useCallback, useRef, useEffect, useState } from "react";
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

interface ReactionNetworkGraphProps {
  system: ReactionSystem;
}

// Custom node component for reactions
function ReactionNodeComponent({ data }: { data: { label: string; equation: string; index: number; displayName?: string } }) {
  const title = data.displayName
    ? `Reaction ${data.index + 1} — ${data.displayName}`
    : `Reaction ${data.index + 1}`;
  return (
    <div className="rounded-lg border-2 border-teal-500 bg-white px-4 py-3 shadow-md min-w-[180px] max-w-[280px]">
      <Handle type="target" position={Position.Top} className="!bg-teal-500 !w-3 !h-3" />
      <div className="text-xs font-semibold text-teal-700 mb-1">
        {title}
      </div>
      <div className="text-xs font-mono text-gray-700 leading-snug break-words">
        {data.equation}
      </div>
      <div className="text-[10px] text-gray-400 mt-1 truncate">
        {data.label}
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-teal-500 !w-3 !h-3" />
    </div>
  );
}

const nodeTypes: NodeTypes = {
  reaction: ReactionNodeComponent,
};

function buildGraph(system: ReactionSystem) {
  const { nodes, links } = system;

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
  const ySpacing = 180;

  const graphNodes: Node[] = nodes.map((node) => {
    const level = levels.get(node.id) ?? 0;
    const group = levelGroups.get(level) ?? [node.id];
    const indexInGroup = group.indexOf(node.id);
    const groupWidth = (group.length - 1) * xSpacing;

    return {
      id: node.id,
      type: "reaction",
      position: {
        x: indexInGroup * xSpacing - groupWidth / 2 + 300,
        y: level * ySpacing + 50,
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

  return { graphNodes, graphEdges };
}

/** Inner component that has access to useReactFlow */
function GraphInner({ system }: { system: ReactionSystem }) {
  const { fitView } = useReactFlow();
  const containerRef = useRef<HTMLDivElement>(null);
  const { graphNodes, graphEdges } = useMemo(() => buildGraph(system), [system]);

  // Fit view when container becomes visible (details opens)
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0 && entry.contentRect.height > 0) {
          // Small delay to let ReactFlow render nodes first
          setTimeout(() => fitView({ padding: 0.2, duration: 200 }), 100);
        }
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [fitView]);

  // Also fit view when nodes/edges change
  useEffect(() => {
    setTimeout(() => fitView({ padding: 0.2, duration: 200 }), 200);
  }, [graphNodes.length, graphEdges.length, fitView]);

  const maxLevel = Math.max(...graphNodes.map((n) => n.position.y), 200);

  return (
    <div
      ref={containerRef}
      className="rounded-xl border border-gray-200 bg-white overflow-hidden"
      style={{ height: Math.max(maxLevel + 200, 400) }}
    >
      <ReactFlow
        nodes={graphNodes}
        edges={graphEdges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.2}
        maxZoom={1.5}
        defaultViewport={{ x: 0, y: 0, zoom: 0.8 }}
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={20} size={1} color="#f0f0f0" />
        <Controls showInteractive={false} />
      </ReactFlow>
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
