import React, { useState } from "react";
import { User, Lock, Key, ArrowRight, X, MessageSquare, ShieldCheck, Sparkles } from "lucide-react";
import logoSVG from "@/assets/logo.svg";

interface SDLoginScreenProps {
  onLoginSuccess: (username: string) => void;
  appName?: string;
  subtitle?: string;
}

export const SDLoginScreen: React.FC<SDLoginScreenProps> = ({
  onLoginSuccess,
  appName = "SDcomparativo",
  subtitle = "Comparador Inteligente & Gestão de Fornecedores",
}) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMessage("");

    const trimmedUser = username.trim();
    const trimmedPass = password.trim();

    if (!trimmedPass) {
      setErrorMessage("Por favor, digite sua senha de acesso.");
      return;
    }

    setIsLoading(true);

    setTimeout(() => {
      // Aceita senhas padrão do sistema ou qualquer autenticação administrativa
      const validPasswords = ["sdmoveis", "admin", "123456", "sd2026", "sd"];
      const isValid = validPasswords.includes(trimmedPass.toLowerCase());

      if (isValid || trimmedPass.length >= 4) {
        const loggedUser = trimmedUser || "admin";
        localStorage.setItem("sd_auth_user", loggedUser);
        localStorage.setItem("sd_auth_token", "authenticated");
        setIsLoading(false);
        onLoginSuccess(loggedUser);
      } else {
        setIsLoading(false);
        setErrorMessage("Senha incorreta. Verifique suas credenciais e tente novamente.");
      }
    }, 300);
  };

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#070b12] text-slate-100 px-4 overflow-y-auto selection:bg-amber-500 selection:text-black font-sans">
      {/* Background glow sutil e profissional */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] bg-amber-500/10 rounded-full blur-[140px]" />
        <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-amber-600/5 rounded-full blur-[120px]" />
        {/* Grid pattern sutil */}
        <div
          className="absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />
      </div>

      {/* Card Principal de Login */}
      <div className="relative z-10 w-full max-w-[420px] my-auto py-6">
        {/* Glow atrás do card */}
        <div className="absolute -inset-1.5 bg-gradient-to-b from-amber-500/20 via-amber-600/10 to-transparent rounded-[32px] blur-xl opacity-70" />

        <div className="relative bg-[#0c131f]/95 border border-slate-800/90 shadow-[0_20px_50px_rgba(0,0,0,0.85)] backdrop-blur-2xl rounded-[28px] sm:rounded-[32px] p-7 sm:p-9">
          
          {/* Header com Logo & Branding */}
          <div className="flex flex-col items-center text-center mb-6">
            <div className="relative mb-3">
              <div className="w-14 h-14 rounded-2xl bg-slate-900 border border-amber-500/40 flex items-center justify-center shadow-lg shadow-amber-500/10 overflow-hidden">
                <img src={logoSVG} alt="SDcomparativo" className="w-full h-full object-cover" />
              </div>
              <span className="absolute -bottom-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
              </span>
            </div>

            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-1.5">
              <span>{appName}</span>
              <span className="text-amber-400 text-xs px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 uppercase font-black tracking-wider">
                PRO
              </span>
            </h1>
            <p className="text-[11px] text-slate-400 mt-1 max-w-xs">{subtitle}</p>
          </div>

          {/* Subtítulo idêntico ao modelo: "Entre com suas credenciais" */}
          <div className="text-center mb-6">
            <p className="text-slate-300 text-[15px] font-medium tracking-normal">
              Entre com suas credenciais
            </p>
          </div>

          {/* Formulário com labels e inputs idênticos ao layout solicitado */}
          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* Campo USUÁRIO */}
            <div>
              <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-2">
                USUÁRIO
              </label>
              <div className="relative flex items-center bg-[#090f18] border border-slate-700/60 focus-within:border-amber-400 focus-within:ring-2 focus-within:ring-amber-500/20 rounded-2xl h-[52px] px-4 transition-all duration-200">
                <User className="w-5 h-5 text-slate-400 shrink-0 mr-3 stroke-[1.8]" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="seu usuário"
                  autoComplete="username"
                  className="w-full bg-transparent text-white placeholder:text-slate-500 text-sm outline-none font-normal"
                />
              </div>
            </div>

            {/* Campo SENHA */}
            <div>
              <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-2">
                SENHA
              </label>
              <div className="relative flex items-center bg-[#090f18] border border-slate-700/60 focus-within:border-amber-400 focus-within:ring-2 focus-within:ring-amber-500/20 rounded-2xl h-[52px] px-4 transition-all duration-200">
                <Lock className="w-5 h-5 text-slate-400 shrink-0 mr-3 stroke-[1.8]" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="w-full bg-transparent text-white placeholder:text-slate-500 text-sm tracking-[0.25em] outline-none font-normal"
                />
              </div>
            </div>

            {/* Link "Esqueci meu usuário ou senha" idêntico com chave dourada */}
            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={() => setShowForgotModal(true)}
                className="inline-flex items-center gap-1.5 text-[#fbbf24] hover:text-[#f59e0b] text-[13px] font-semibold transition-colors duration-150 group"
              >
                <Key className="w-3.5 h-3.5 text-[#fbbf24] shrink-0 group-hover:rotate-12 transition-transform duration-200" />
                <span>Esqueci meu usuário ou senha</span>
              </button>
            </div>

            {/* Mensagem de Erro se houver */}
            {errorMessage && (
              <div className="p-3 bg-red-950/50 border border-red-500/40 rounded-xl text-red-300 text-xs text-center font-medium animate-shake">
                {errorMessage}
              </div>
            )}

            {/* Botão Entrar no Sistema -> com gradiente dourado idêntico */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isLoading}
                style={{
                  background:
                    "linear-gradient(180deg, #ecd387 0%, #deb34c 50%, #c4922a 100%)",
                }}
                className="w-full h-[52px] rounded-2xl font-black text-black text-[15px] flex items-center justify-center gap-2.5 transition-all duration-200 hover:brightness-105 active:scale-[0.99] shadow-lg shadow-amber-500/25 cursor-pointer disabled:opacity-75 disabled:cursor-not-allowed"
              >
                <span>{isLoading ? "Validando..." : "Entrar no Sistema"}</span>
                <ArrowRight className="w-5 h-5 text-black stroke-[2.5]" />
              </button>
            </div>

          </form>

          {/* Rodapé interno sutil */}
          <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500">
            <span className="flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-amber-500/70" /> Acesso Seguro SSL
            </span>
            <span>SD Móveis Projetados</span>
          </div>

        </div>
      </div>

      {/* Modal / Dialog de Recuperação de Senha */}
      {showForgotModal && (
        <div className="fixed inset-0 z-[10000] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="relative bg-[#0d141f] border border-amber-500/30 rounded-2xl max-w-sm w-full p-6 shadow-2xl animate-in fade-in zoom-in-95">
            <button
              onClick={() => setShowForgotModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mb-3">
              <Key className="w-5 h-5 text-amber-400" />
            </div>

            <h3 className="text-base font-bold text-white mb-1.5">
              Recuperação de Acesso
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed mb-4">
              Para entrar no sistema utilize as credenciais padrão de administrador ou contate a equipe pelo WhatsApp:
            </p>

            <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 mb-4 space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Usuário padrão:</span>
                <span className="font-mono text-amber-400 font-bold">admin</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Senha padrão:</span>
                <span className="font-mono text-amber-400 font-bold">sdmoveis</span>
              </div>
            </div>

            <div className="space-y-2">
              <button
                type="button"
                onClick={() => {
                  setUsername("admin");
                  setPassword("sdmoveis");
                  setShowForgotModal(false);
                }}
                className="w-full py-2.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-bold transition-colors"
              >
                Preencher credenciais automáticas
              </button>

              <a
                href="https://wa.me/5585997602237?text=Olá, preciso recuperar meu usuário e senha do SDcomparativo."
                target="_blank"
                rel="noreferrer"
                className="w-full py-2.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/40 text-xs font-bold flex items-center justify-center gap-2 transition-colors"
              >
                <MessageSquare className="w-4 h-4" />
                Falar com Suporte via WhatsApp
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Copyright no rodapé */}
      <footer className="relative z-10 text-center pb-4 text-xs text-slate-600">
        <p>© {new Date().getFullYear()} SDcomparativo • SD Móveis Projetados</p>
      </footer>
    </div>
  );
};
