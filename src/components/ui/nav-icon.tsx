import React from "react";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, Box, FileText, MessageSquare, MessageCircle, Home, Image, Plus, Clock,
  Navigation, BookOpen, Shield, Fuel, Wrench, Building, Package, ClipboardList,
  Banknote, TrendingDown, TrendingUp, FileSignature, Laptop, Settings, Bot, Camera, Calendar, FileDown,
} from "lucide-react";

interface NavIconProps {
  icon: string;
  label: string;
  active?: boolean;
  onClick: () => void;
  isFab?: boolean;
}

const iconMap: Record<string, React.ElementType> = {
  "layout-dashboard": LayoutDashboard,
  "cube": Box,
  "box": Box,
  "file-text": FileText,
  "message-square": MessageSquare,
  "message-circle": MessageCircle,
  "home": Home,
  "image": Image,
  "plus": Plus,
  "clock": Clock,
  "navigation": Navigation,
  "book-open": BookOpen,
  "shield": Shield,
  "fuel": Fuel,
  "wrench": Wrench,
  "building": Building,
  "package": Package,
  "clipboard-list": ClipboardList,
  "banknote": Banknote,
  "trending-down": TrendingDown,
  "trending-up": TrendingUp,
  "file-signature": FileSignature,
  "monitor": Laptop,
  "settings": Settings,
  "bot": Bot,
  "camera": Camera,
  "calendar": Calendar,
  "file-down": FileDown,
};

export const NavIcon: React.FC<NavIconProps> = ({ icon, label, active, onClick, isFab }) => {
  const IconComponent = iconMap[icon] || Box;

  if (isFab) {
    return (
      <button
        onClick={onClick}
        className="group w-14 h-14 bg-gradient-to-br from-primary to-primary/80 rounded-2xl flex items-center justify-center text-primary-foreground shadow-glow hover:scale-110 transition-all duration-300"
        style={{ perspective: "600px" }}
      >
        <Plus className="w-6 h-6 transition-transform duration-300 group-hover:rotate-90 group-hover:scale-110" />
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      className={cn(
        "group flex flex-col items-center justify-center gap-0.5 py-1 px-1.5 rounded-xl transition-all duration-300 flex-shrink-0 min-w-[52px]",
        active
          ? "text-amber-400"
          : "text-gray-400 hover:text-white"
      )}
      style={{ perspective: "600px" }}
    >
      <div
        className={cn(
          "w-8 h-8 sm:w-11 sm:h-11 rounded-lg sm:rounded-xl flex items-center justify-center transition-all duration-300 ease-out",
          active
            ? "bg-gradient-to-br from-amber-400 to-amber-600 text-black shadow-lg shadow-amber-500/30 scale-105"
            : "bg-white/5 border border-white/10 group-hover:bg-white/10 group-hover:border-amber-500/30"
        )}
        style={{
          transformStyle: "preserve-3d",
          willChange: "transform",
        }}
      >
        <IconComponent
          className={cn(
            "w-4 h-4 sm:w-5 sm:h-5 transition-all duration-300 ease-out",
            "group-hover:scale-110",
            active ? "text-black drop-shadow-sm font-bold" : "text-gray-300 group-hover:text-amber-400"
          )}
          style={{
            transition: "transform 0.3s cubic-bezier(0.23, 1, 0.32, 1)",
          }}
        />
      </div>
      <span className={cn(
        "text-[8px] sm:text-[9px] font-bold uppercase tracking-tight transition-all duration-300 text-center leading-tight whitespace-nowrap max-w-[64px] truncate",
        active ? "text-amber-400" : "text-gray-400 group-hover:text-gray-200"
      )}>
        {label}
      </span>

      {/* Active indicator line */}
      {active && (
        <div className="hidden sm:block absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-8 rounded-r-full bg-primary shadow-glow" />
      )}
    </button>
  );
};
