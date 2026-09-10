import React from "react";
import { cn } from "@/lib/utils";

export interface DashboardStatProps {
  title: string;
  value: string;
  icon: string;
  dark?: boolean;
  color?: string;
  trend?: string;
}

export const DashboardStat: React.FC<DashboardStatProps> = ({ 
  title, 
  value, 
  icon, 
  dark, 
  color,
  trend
}) => (
  <div className={cn(
    "p-6 rounded-[24px] transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] cursor-pointer group",
    dark 
      ? "bg-neutral-900 text-white border border-white/5" 
      : "bg-white shadow-lg border border-gray-100 hover:shadow-xl hover:border-amber-400/30",
    color
  )}>
    <div className="flex items-start justify-between mb-3">
      <div className={cn(
        "w-12 h-12 rounded-xl flex items-center justify-center text-2xl shadow-sm group-hover:scale-110 group-hover:rotate-3 group-active:scale-95 transition-all duration-300 border",
        dark 
          ? "bg-amber-500/10 border-amber-500/20" 
          : "bg-amber-50 border-amber-100"
      )}>
        {icon}
      </div>
    </div>
    <p className={cn(
      "text-xs font-bold uppercase tracking-wider mb-1 transition-colors duration-300",
      dark ? "text-white/40 group-hover:text-amber-400" : "text-gray-500 group-hover:text-amber-600/80"
    )}>{title}</p>
    <p className={cn(
      "text-2xl font-black transition-colors duration-200",
      dark ? "text-white" : "text-gray-900"
    )}>{value}</p>
    {trend && (
      <p className={cn(
        "text-xs font-bold mt-1 opacity-80 group-hover:opacity-100 group-hover:translate-x-1 transition-all duration-300",
        dark ? "text-amber-400" : "text-amber-600"
      )}>{trend}</p>
    )}
  </div>
);
