import React from "react";
import { Minus, Plus } from "lucide-react";

interface NudgeInputProps {
  label: string;
  value: number;
  step?: number;
  onChange: (v: number) => void;
}

export const NudgeInput: React.FC<NudgeInputProps> = ({ 
  label, 
  value, 
  step = 50, 
  onChange 
}) => (
  <div className="flex items-center justify-between">
    <span className="text-xs text-gray-500 font-medium">{label}</span>
    <div className="flex items-center gap-2">
      <button 
        onClick={() => onChange(value - step)} 
        className="w-10 h-10 bg-white border rounded-xl shadow-sm text-gray-600 hover:text-amber-600 transition-colors flex items-center justify-center"
      >
        <Minus className="w-4 h-4" />
      </button>
      <span className="w-16 text-center font-bold text-sm">{value}</span>
      <button 
        onClick={() => onChange(value + step)} 
        className="w-10 h-10 bg-white border rounded-xl shadow-sm text-gray-600 hover:text-amber-600 transition-colors flex items-center justify-center"
      >
        <Plus className="w-4 h-4" />
      </button>
    </div>
  </div>
);
