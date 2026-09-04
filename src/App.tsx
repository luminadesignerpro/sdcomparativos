import React, { useState, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import SuppliersPage from "@/components/modules/SuppliersPage";
import { SDLoginScreen } from "@/components/auth/SDLoginScreen";
import { Layers, Scale, Sparkles, ShoppingBag, LogOut, User, Shield } from "lucide-react";
import logoSVG from "@/assets/logo.svg";
import bannerSVG from "@/assets/banner.svg";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const SDComparativoApp: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return localStorage.getItem("sd_auth_token") === "authenticated";
  });
  const [currentUser, setCurrentUser] = useState<string>(() => {
    return localStorage.getItem("sd_auth_user") || "admin";
  });

  const handleLoginSuccess = (user: string) => {
    setCurrentUser(user);
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    localStorage.removeItem("sd_auth_token");
    localStorage.removeItem("sd_auth_user");
    setIsAuthenticated(false);
  };

  if (!isAuthenticated) {
    return (
      <SDLoginScreen
        onLoginSuccess={handleLoginSuccess}
        appName="SDcomparativo"
        subtitle="Comparador Inteligente de Preços & Gestão de Fornecedores"
      />
    );
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-slate-950 text-slate-100 font-sans selection:bg-amber-500 selection:text-black">

      {/* ══ HEADER — COMPACTO E PADRONIZADO ══ */}
      <header className="flex-shrink-0 z-50 border-b border-amber-500/20 bg-slate-900/95 backdrop-blur-md px-3.5 sm:px-6 py-2.5 shadow-lg">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-2">

          {/* Logo & Branding */}
          <div className="flex items-center gap-3">
            <div className="relative group shrink-0">
              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl overflow-hidden border border-amber-500/40 bg-slate-900 flex items-center justify-center shadow-inner group-hover:border-amber-400 transition-colors">
                <img src={logoSVG} alt="SDcomparativo Logo" className="w-full h-full object-cover" />
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
              </span>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-black tracking-tight bg-gradient-to-r from-amber-400 via-amber-200 to-amber-500 bg-clip-text text-transparent">
                  SDcomparativo
                </h1>
                <span className="text-[9px] uppercase font-black tracking-wider px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30">
                  v1.0 Pro
                </span>
              </div>
              <p className="text-[11px] text-slate-400 truncate max-w-[280px] sm:max-w-md">
                Comparador Inteligente de Preços &amp; Gestão de Fornecedores
              </p>
            </div>
          </div>

          {/* Ações do Usuário & Logout */}
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700/60 text-xs text-slate-300">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <User className="w-3.5 h-3.5 text-amber-400" />
              <span className="font-semibold text-white truncate max-w-[120px]">{currentUser}</span>
            </div>

            <button
              onClick={handleLogout}
              title="Sair do Sistema"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 border border-red-500/30 text-xs font-semibold transition-colors duration-150 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden xs:inline">Sair</span>
            </button>
          </div>
        </div>
      </header>


      {/* ══ CONTEÚDO ══ */}
      <main className="flex-1 overflow-hidden w-full flex flex-col">
        <SuppliersPage />
      </main>

      {/* Footer */}
      <footer className="flex-shrink-0 border-t border-slate-800/80 bg-slate-950/80 py-3 px-4 text-center text-xs text-slate-400">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <p>© {new Date().getFullYear()} SDcomparativo • SD Móveis Projetados</p>
          <p className="flex items-center gap-1 text-slate-400">
            <Layers className="w-3.5 h-3.5 text-amber-500" />
            Módulo de Comparação e Aquisição de Insumos
          </p>
        </div>
      </footer>

    </div>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <SDComparativoApp />
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
