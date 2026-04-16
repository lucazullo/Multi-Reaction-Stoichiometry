"use client";

import { useState } from "react";

interface ConversionSliderProps {
  value: number; // 0–1
  onChange: (value: number) => void;
}

export default function ConversionSlider({ value, onChange }: ConversionSliderProps) {
  const [inputText, setInputText] = useState(String(Math.round(value * 100)));

  const handleSlider = (e: React.ChangeEvent<HTMLInputElement>) => {
    const pct = Number(e.target.value);
    setInputText(String(pct));
    onChange(pct / 100);
  };

  const handleText = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputText(e.target.value);
    const pct = Number(e.target.value);
    if (!isNaN(pct) && pct >= 0 && pct <= 100) {
      onChange(pct / 100);
    }
  };

  const handleBlur = () => {
    const pct = Math.round(value * 100);
    setInputText(String(pct));
  };

  return (
    <div className="flex items-center gap-3">
      <label className="text-xs font-medium text-gray-600 whitespace-nowrap">
        Conversion
      </label>
      <input
        type="range"
        min={0}
        max={100}
        step={1}
        value={Math.round(value * 100)}
        onChange={handleSlider}
        className="flex-1 h-1.5 accent-teal-600"
      />
      <div className="flex items-center gap-0.5">
        <input
          type="text"
          value={inputText}
          onChange={handleText}
          onBlur={handleBlur}
          className="w-12 rounded border border-gray-300 px-1.5 py-0.5 text-xs text-right font-mono"
        />
        <span className="text-xs text-gray-500">%</span>
      </div>
    </div>
  );
}
