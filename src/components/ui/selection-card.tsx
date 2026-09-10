import React from "react";
import { cn } from "@/lib/utils";

interface SelectionCardProps {
  title: string;
  desc: string;
  icon: string;
  gold?: boolean;
  onClick: () => void;
}

export const SelectionCard: React.FC<SelectionCardProps> = ({ title, desc, icon, gold, onClick }) => (
  <button 
    onClick={onClick} 
    className={cn(
      "w-72 p-10 rounded-[40px] text-center transition-all duration-300 hover:scale-105 shadow-2xl",
      gold 
        ? "bg-gradient-to-br from-amber-500 to-amber-700 text-white" 
        : "bg-white text-gray-800 hover:shadow-amber-200/50"
    )}
  >
    <span className="text-5xl block mb-6">{icon}</span>
    <h3 className="text-xl font-black uppercase tracking-wide">{title}</h3>
    <p className="text-xs opacity-70 mt-2">{desc}</p>
  </button>
);
