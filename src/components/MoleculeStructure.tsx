"use client";

import { useEffect, useRef, useState } from "react";
import Script from "next/script";

/* global SmilesDrawer */
declare global {
  interface Window {
    SmilesDrawer?: {
      parse: (
        smiles: string,
        cb: (tree: unknown) => void,
        errCb?: (err: unknown) => void
      ) => void;
      SvgDrawer: new (opts: Record<string, unknown>) => {
        draw: (
          tree: unknown,
          target: SVGSVGElement | HTMLElement,
          theme: string,
          infoOnly: boolean
        ) => void;
      };
    };
  }
}

/**
 * smiles-drawer collapses implicit hydrogens into formula text (e.g. "C" → "CH₄")
 * instead of drawing bonds. For small molecules we expand to explicit-H SMILES
 * so they render as proper structural diagrams.
 */
const EXPLICIT_H_MAP: Record<string, string> = {
  C: "[H]C([H])([H])[H]",           // methane
  O: "[H]O[H]",                       // water
  N: "[H]N([H])[H]",                  // ammonia
  S: "[H]S[H]",                       // hydrogen sulfide
  "[HH]": "[H][H]",                   // hydrogen gas
  "[H][H]": "[H][H]",                 // hydrogen gas (alt)
  Cl: "[H]Cl",                        // hydrochloric acid
  F: "[H]F",                          // hydrogen fluoride
  Br: "[H]Br",                        // hydrogen bromide
  I: "[H]I",                          // hydrogen iodide
  P: "[H]P([H])[H]",                 // phosphine
};

function expandSmiles(smiles: string): string {
  return EXPLICIT_H_MAP[smiles] ?? smiles;
}

interface MoleculeStructureProps {
  smiles: string;
  width?: number;
  height?: number;
  className?: string;
}

let sdReady = false;
const waiters: Array<() => void> = [];

function onSdReady() {
  sdReady = true;
  for (const w of waiters) w();
  waiters.length = 0;
}

export default function MoleculeStructure({
  smiles,
  width = 200,
  height = 150,
  className = "",
}: MoleculeStructureProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [error, setError] = useState(false);
  const [loaded, setLoaded] = useState(sdReady);

  // Wait for script to load
  useEffect(() => {
    if (sdReady) {
      setLoaded(true);
      return;
    }
    const waiter = () => setLoaded(true);
    waiters.push(waiter);
    return () => {
      const idx = waiters.indexOf(waiter);
      if (idx >= 0) waiters.splice(idx, 1);
    };
  }, []);

  // Draw molecule when ready
  useEffect(() => {
    if (!loaded || !svgRef.current || !window.SmilesDrawer) return;
    setError(false);

    const svg = svgRef.current;
    // Clear previous drawing
    while (svg.firstChild) svg.removeChild(svg.firstChild);

    try {
      // Render at higher internal resolution for quality.
      // smiles-drawer auto-fits via viewBox; the CSS width/height controls display size.
      const drawer = new window.SmilesDrawer.SvgDrawer({
        width: 300,
        height: 300,
        bondThickness: 1,
        bondLength: 25,
        shortBondLength: 0.85,
        bondSpacing: 4.5,
        fontSizeLarge: 11,
        fontSizeSmall: 5,
        padding: 15,
        compactDrawing: true,
        atomVisualization: "default",
      });

      window.SmilesDrawer.parse(
        expandSmiles(smiles),
        (tree) => {
          drawer.draw(tree, svg, "light", false);
        },
        () => {
          setError(true);
        }
      );
    } catch {
      setError(true);
    }
  }, [loaded, smiles, width, height]);

  if (error) {
    return null; // fall back to formula in parent
  }

  return (
    <>
      <Script
        src="/smiles-drawer.min.js"
        strategy="afterInteractive"
        onLoad={onSdReady}
      />
      <svg
        ref={svgRef}
        width={width}
        height={height}
        className={className}
        xmlns="http://www.w3.org/2000/svg"
        style={{ display: "block" }}
      />
    </>
  );
}
