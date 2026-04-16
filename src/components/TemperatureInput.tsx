"use client";

import { useState } from "react";

interface TemperatureInputProps {
  valueK: number; // always stored as Kelvin
  onChange: (kelvin: number) => void;
  label?: string;
}

export default function TemperatureInput({ valueK, onChange, label = "Temperature" }: TemperatureInputProps) {
  const [unit, setUnit] = useState<"K" | "°C">("K");
  const displayValue = unit === "K" ? valueK : valueK - 273.15;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = Number(e.target.value);
    if (isNaN(v)) return;
    const kelvin = unit === "K" ? v : v + 273.15;
    if (kelvin > 0) onChange(kelvin);
  };

  return (
    <div className="flex items-center gap-2">
      <label className="text-xs font-medium text-gray-600 whitespace-nowrap">{label}</label>
      <input
        type="number"
        step="any"
        value={Number(displayValue.toFixed(2))}
        onChange={handleChange}
        className="w-24 rounded border border-gray-300 px-2 py-1 text-xs font-mono"
      />
      <div className="flex rounded border border-gray-300 overflow-hidden text-xs">
        <button
          onClick={() => setUnit("K")}
          className={`px-2 py-1 font-medium transition ${unit === "K" ? "bg-teal-600 text-white" : "text-gray-600 hover:bg-gray-50"}`}
        >K</button>
        <button
          onClick={() => setUnit("°C")}
          className={`px-2 py-1 font-medium transition ${unit === "°C" ? "bg-teal-600 text-white" : "text-gray-600 hover:bg-gray-50"}`}
        >°C</button>
      </div>
    </div>
  );
}
