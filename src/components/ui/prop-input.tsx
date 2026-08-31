import React from "react";

interface PropInputProps {
  label: string;
  value: number;
  unit: string;
  min?: number;
  max?: number;
  onChange: (v: number) => void;
}

export const PropInput: React.FC<PropInputProps> = ({ 
  label, 
  value, 
  unit, 
  min = 0, 
  max = 10000, 
  onChange 
}) => (
  <div className="space-y-2">
    <div className="flex justify-between text-xs">
      <span className="text-gray-500 font-medium">{label}</span>
      <span className="font-bold text-gray-900">{value}{unit}</span>
    </div>
    <input 
      type="range" 
      min={min} 
      max={max} 
      value={value} 
      onChange={(e) => onChange(parseInt(e.target.value))} 
      className="w-full h-2 bg-gray-100 rounded-full appearance-none cursor-pointer accent-amber-600" 
    />
  </div>
);
