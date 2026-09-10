import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Users, FolderOpen, MessageSquare, Sparkles,
  Image, Settings, Clock, Truck, Wrench, Camera, Monitor
} from "lucide-react";
import logoSd from "@/assets/logo-sd.jpeg";

const navItems = [
  { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/clients", icon: Users, label: "Clientes" },
  { to: "/projects", icon: FolderOpen, label: "Projetos" },
  { to: "/crm", icon: MessageSquare, label: "CRM" },
  { to: "/ai-assistant", icon: Sparkles, label: "Assistente IA" },
  { to: "/render", icon: Image, label: "Renderização" },
  { to: "/editor", icon: Wrench, label: "Editor 3D" },
  { to: "/settings", icon: Settings, label: "Configurações" },
];

export function Sidebar() {
  const location = useLocation();

  return (
    <aside className="w-64 bg-card border-r border-border flex flex-col h-full">
      <div className="p-4 border-b border-border flex items-center gap-3">
        <img src={logoSd} alt="SD Logo" className="w-10 h-10 rounded-lg object-cover" />
        <span className="font-display font-bold text-lg">SD Móveis</span>
      </div>
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = location.pathname === item.to;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              }`}
            >
              <item.icon className="w-5 h-5" />
              {item.label}
            </NavLink>
          );
        })}
        
        {/* Deep Link to Native AR App */}
        <button
          onClick={() => {
            // Tentativa de abrir o APK nativo via Deep Link
            window.location.href = "sdmoveisar://open";
            
            // Fallback para caso o app não esteja instalado (opcional)
            setTimeout(() => {
              if (document.hasFocus()) {
                console.log("App AR não detectado ou não instalado.");
                // Aqui poderíamos sugerir o download
              }
            }, 1500);
          }}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-black transition-all bg-amber-500/10 text-amber-500 border border-amber-500/20 hover:bg-amber-500 hover:text-black mt-4 group"
        >
          <div className="p-1 bg-amber-500 rounded-md group-hover:bg-black transition-colors">
            <Camera className="w-3.5 h-3.5 text-black group-hover:text-amber-500" />
          </div>
          Câmera AR Pro
        </button>

        <button
          onClick={() => {
            window.location.href = "fpqsystem://open";
          }}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-black transition-all bg-green-500/10 text-green-500 border border-green-500/20 hover:bg-green-100 mt-2 group"
        >
          <Monitor className="w-5 h-5" />
          Abrir FPQ Desktop
        </button>
      </nav>
    </aside>
  );
}
