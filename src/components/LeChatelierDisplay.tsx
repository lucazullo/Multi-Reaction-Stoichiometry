"use client";

import type { LeChatelierShift } from "@/lib/types";

interface LeChatelierDisplayProps {
  shifts: LeChatelierShift[];
}

export default function LeChatelierDisplay({ shifts }: LeChatelierDisplayProps) {
  if (shifts.length === 0) return null;

  return (
    <div className="space-y-2">
      <h4 className="text-xs font-semibold text-gray-700">Le Chatelier Analysis</h4>
      <div className="space-y-1.5">
        {shifts.map((shift, i) => (
          <div key={i} className="flex items-start gap-2 rounded-lg border border-gray-100 bg-gray-50 p-2">
            <span className={`mt-0.5 flex-shrink-0 text-sm ${
              shift.direction === "forward" ? "text-green-600" : "text-orange-600"
            }`}>
              {shift.direction === "forward" ? "→" : "←"}
            </span>
            <div>
              <p className="text-xs font-medium text-gray-800">{shift.perturbation}</p>
              <p className="text-[10px] text-gray-500">{shift.explanation}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
