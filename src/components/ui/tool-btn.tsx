import React from "react";
import { cn } from "@/lib/utils";
import { MousePointer, Move, RotateCcw } from "lucide-react";

interface ToolBtnProps {
  icon: string;
  label: string;
  active?: boolean;
  onClick?: () => void;
}

const iconMap: Record<string, React.ElementType> = {
  "mouse-pointer": MousePointer,
  "move": Move,
  "rotate-ccw": RotateCcw,
};

export const ToolBtn: React.FC<ToolBtnProps> = ({ icon, label, active, onClick }) => {
  const IconComponent = iconMap[icon] || MousePointer;
  
  return (
    <button 
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-2 p-4 rounded-2xl transition-all",
        active 
          ? "bg-amber-50 text-amber-600 shadow-md" 
          : "text-gray-400 hover:text-gray-600 hover:bg-gray-50"
      )}
    >
      <IconComponent className="w-5 h-5" />
      <span className="text-[8px] font-black uppercase tracking-widest">{label}</span>
    </button>
  );
};
