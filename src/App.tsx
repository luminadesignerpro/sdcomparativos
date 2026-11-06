import React, { useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import SuppliersPage from "@/components/modules/SuppliersPage";
import { SDLoginScreen } from "@/components/auth/SDLoginScreen";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Layers, LogOut, User, ArrowLeft } from "lucide-react";
import appLogo from "@/assets/logo-sd.png";
import { UpdateButton } from "@/components/common/UpdateButton";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const SDComparativoApp: React.FC = () => {
  const handleVoltarAoOrcamento = () => {
    try {
      // 1. Tenta fechar se foi aberto via window.open / popup
      if (window.opener && !window.opener.closed) {
        window.close();
        return;
      }

      // 2. Se houver histórico de navegação, volta direto sem recarregar ou preencher parâmetros
      if (window.history && window.history.length > 1) {
        window.history.back();
        return;
      }

      // 3. Fallback: redireciona para a URL do sistema limpa, SEM parâmetros de itens
      const urlParams = new URLSearchParams(window.location.search);
      const retornoBase = urlParams.get('retorno') || 'https://sdmoveisprojetados.vercel.app';
      const cleanUrl = new URL(retornoBase, window.location.origin);
      cleanUrl.search = '';
      window.location.href = cleanUrl.toString();
    } catch {
      window.location.href = 'https://sdmoveisprojetados.vercel.app';
    }
  };

  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    const token = localStorage.getItem("sd_auth_token");
    return token === "authenticated" || token === "authenticated_biometry";
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
        subtitle="Comparador Inteligente de Precos & Gestao de Fornecedores"
      />
    );
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-slate-950 text-slate-100 font-sans selection:bg-amber-500 selection:text-black">

      {/* HEADER COMPACTO E 100% RESPONSIVO SEM SOBREPOSICAO */}
      <header className="flex-shrink-0 z-50 border-b border-amber-500/20 bg-slate-900/95 backdrop-blur-md px-2 sm:px-6 py-2 shadow-lg">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-1.5 sm:gap-2">

          {/* Esquerda: Botao Voltar + Logo & Branding */}
          <div className="flex items-center gap-1 sm:gap-2.5 min-w-0 flex-1">
            {/* Botao Voltar */}
            <button
              type="button"
              onClick={handleVoltarAoOrcamento}
              title="Voltar ao Orcamento SD Moveis"
              className="flex items-center gap-1 px-2 sm:px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500/25 to-amber-600/20 hover:from-amber-500/40 hover:to-amber-600/30 text-amber-300 hover:text-white border border-amber-500/50 text-xs font-black transition-all duration-150 cursor-pointer shadow-md active:scale-95 shrink-0"
            >
              <ArrowLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400 shrink-0 font-bold" />
              <span className="font-extrabold text-[11px] sm:text-xs">Voltar</span>
            </button>

            {/* Logo SD */}
            <div className="relative group shrink-0">
              <div className="w-7 h-7 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl overflow-hidden border border-amber-500/50 bg-black flex items-center justify-center shadow-lg shadow-amber-500/20 group-hover:border-amber-400 transition-all">
                <img src={appLogo} alt="SDcomparativo Logo" className="w-full h-full object-cover" />
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 flex h-2 w-2 sm:h-2.5 sm:w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 sm:h-2.5 sm:w-2.5 bg-amber-500"></span>
              </span>
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-1 sm:gap-2">
                <h1 className="text-xs sm:text-lg font-black tracking-tight bg-gradient-to-r from-amber-400 via-amber-200 to-amber-500 bg-clip-text text-transparent truncate">
                  SDcomparativo
                </h1>
                <span className="text-[9px] uppercase font-black tracking-wider px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30 shrink-0 hidden md:inline-flex">
                  v1.0 Pro
                </span>
              </div>
              <p className="text-[10px] sm:text-[11px] text-slate-400 truncate hidden md:block">
                Comparador Inteligente de Precos &amp; Gestao de Fornecedores
              </p>
            </div>
          </div>

          {/* Direita: Atualizado + Usuario + Logout */}
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            {/* Botao de Atualizacao com Notificacao */}
            <UpdateButton />

            <div className="flex items-center gap-1 px-1.5 sm:px-3 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700/60 text-xs text-slate-300">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
              <User className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span className="font-semibold text-white truncate max-w-[50px] sm:max-w-[120px] hidden sm:inline">{currentUser}</span>
            </div>

            <button
              onClick={handleLogout}
              title="Sair do Sistema"
              className="flex items-center gap-1 px-2 sm:px-3 py-1.5 rounded-xl bg-red-500/15 hover:bg-red-500/25 text-red-400 hover:text-red-300 border border-red-500/40 text-xs font-bold transition-all duration-150 cursor-pointer shadow-sm active:scale-95 shrink-0"
            >
              <LogOut className="w-3.5 h-3.5 shrink-0" />
              <span className="font-bold hidden sm:inline">Sair</span>
            </button>
          </div>
        </div>
      </header>

      {/* CONTEUDO */}
      <main className="flex-1 overflow-hidden w-full flex flex-col">
        <SuppliersPage />
      </main>

      {/* Footer */}
      <footer className="flex-shrink-0 border-t border-slate-800/80 bg-slate-950/80 py-3 px-4 text-center text-xs text-slate-400">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <p>© {new Date().getFullYear()} SDcomparativo • SD Moveis Projetados</p>
          <p className="flex items-center gap-1 text-slate-400">
            <Layers className="w-3.5 h-3.5 text-amber-500" />
            Modulo de Comparacao e Aquisicao de Insumos
          </p>
        </div>
      </footer>

    </div>
  );
};

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <SDComparativoApp />
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
