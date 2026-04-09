import type { AmountUnit } from "@/lib/types";

interface UnitSelectProps {
  value: AmountUnit;
  onChange: (unit: AmountUnit) => void;
  allowVolume: boolean;
}

export default function UnitSelect({
  value,
  onChange,
  allowVolume,
}: UnitSelectProps) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as AmountUnit)}
      className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-teal-500 focus:ring-1 focus:ring-teal-500 focus:outline-none"
    >
      <optgroup label="Amount">
        <option value="mol">Moles (mol)</option>
      </optgroup>
      <optgroup label="Mass">
        <option value="g">Grams (g)</option>
        <option value="kg">Kilograms (kg)</option>
        <option value="lb">Pounds (lb)</option>
      </optgroup>
      {allowVolume && (
        <optgroup label="Volume">
          <option value="L">Liters (L)</option>
          <option value="gal">Gallons (gal)</option>
        </optgroup>
      )}
    </select>
  );
}
