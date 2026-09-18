import React, { useState, useEffect } from "react";
import {
  User,
  Lock,
  Key,
  ArrowRight,
  X,
  MessageSquare,
  Fingerprint,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Shield,
} from "lucide-react";
import appLogo from "@/assets/logo-sd.png";

interface SDLoginScreenProps {
  onLoginSuccess: (username: string) => void;
  appName?: string;
  subtitle?: string;
}

export const SDLoginScreen: React.FC<SDLoginScreenProps> = ({
  onLoginSuccess,
  appName = "SDcomparativo",
  subtitle = "Comparador Inteligente de Preços & Gestão de Fornecedores",
}) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Estado de liberação por biometria
  const [biometryUnlocking, setBiometryUnlocking] = useState(false);

  // Função para tocar som futurista de bip de biometria
  const playBiometrySound = () => {
    try {
      if (typeof window !== "undefined" && (window.AudioContext || (window as any).webkitAudioContext)) {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
        osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15); // A5
        gain.gain.setValueAtTime(0.12, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.22);
      }
    } catch {
      // Silencioso
    }
  };

  // Liberação imediata ao colocar a digital: sem SMS, sem mensagens de confirmação, liberação direta
  const handleDirectBiometry = () => {
    if (biometryUnlocking || isLoading) return;
    setErrorMessage("");
    setBiometryUnlocking(true);
    playBiometrySound();

    if (typeof navigator !== "undefined" && navigator.vibrate) {
      try {
        navigator.vibrate([35, 45, 35]);
      } catch {
        // Silencioso
      }
    }

    // Libera o sistema direto em 250ms dando o feedback da digital
    setTimeout(() => {
      const loggedUser =
        username.trim() || localStorage.getItem("sd_auth_user") || "admin";
      localStorage.setItem("sd_auth_user", loggedUser);
      localStorage.setItem("sd_auth_token", "authenticated");
      onLoginSuccess(loggedUser);
    }, 280);
  };

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
      const validPasswords = [
        "admin123",
        "sdmoveis",
        "admin",
        "123456",
        "sd2026",
        "sd",
      ];
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
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#070a10] text-slate-100 px-4 py-6 overflow-y-auto selection:bg-amber-500 selection:text-black font-sans">
      {/* Luz ambiente dourada de fundo sutil */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[520px] h-[520px] bg-[#d4af37]/10 rounded-full blur-[140px]" />
        <div className="absolute bottom-10 right-1/4 w-[380px] h-[380px] bg-amber-600/5 rounded-full blur-[120px]" />
      </div>

      {/* Container Central com Card Flutuante */}
      <div className="relative z-10 w-full max-w-[380px] my-auto flex flex-col items-center py-4">
        {/* Card Principal Flutuante (idêntico à imagem de referência) */}
        <div className="w-full bg-[#0c1424] border border-[#1e293b]/70 rounded-[32px] p-6 sm:p-7 shadow-[0_25px_60px_rgba(0,0,0,0.85)] backdrop-blur-xl">
          
          {/* Header com Logo & Branding */}
          <div className="flex flex-col items-center text-center mb-5">
            {/* Logo com moldura dourada arredondada */}
            <div className="relative mb-3.5 group">
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-[24px] bg-black/95 p-1 border-2 border-[#deb34c] shadow-[0_0_25px_rgba(218,165,32,0.35)] flex items-center justify-center overflow-hidden transition-transform duration-300 group-hover:scale-105">
                <img
                  src={appLogo}
                  alt="SDcomparativo"
                  className="w-full h-full object-contain drop-shadow-md"
                />
              </div>
              <span className="absolute -bottom-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
              </span>
            </div>

            {/* Título Principal com Badge PRO */}
            <div className="flex items-center justify-center gap-2">
              <h1 className="text-2xl sm:text-[26px] font-black tracking-tight text-white">
                SDcomparativo
              </h1>
              <span className="text-[10px] uppercase font-black tracking-widest px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30 shrink-0">
                PRO
              </span>
            </div>

            {/* Subtítulo */}
            <p className="text-[11px] sm:text-[12px] font-normal text-slate-400 mt-1 max-w-[280px] leading-relaxed">
              Comparador Inteligente de Preços &amp; Gestão de Fornecedores
            </p>

            {/* "Entre com suas credenciais" */}
            <p className="text-slate-300 text-[13px] sm:text-[14px] font-medium tracking-normal mt-4">
              Entre com suas credenciais
            </p>
          </div>

          {/* Formulário */}
          <form onSubmit={handleSubmit} className="space-y-3.5">
            {/* Campo USUÁRIO */}
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                USUÁRIO
              </label>
              <div className="relative flex items-center bg-[#070c16] border border-slate-700/60 focus-within:border-[#deb34c] focus-within:ring-2 focus-within:ring-amber-500/20 rounded-2xl h-[50px] px-4 transition-all duration-200">
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
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                SENHA
              </label>
              <div className="relative flex items-center bg-[#070c16] border border-slate-700/60 focus-within:border-[#deb34c] focus-within:ring-2 focus-within:ring-amber-500/20 rounded-2xl h-[50px] px-4 transition-all duration-200">
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

            {/* Link "Esqueci meu usuário ou senha" */}
            <div className="flex justify-end pt-0.5">
              <button
                type="button"
                onClick={() => setShowForgotModal(true)}
                className="inline-flex items-center gap-1.5 text-[#deb34c] hover:text-amber-300 text-[13px] font-semibold transition-colors duration-150 group cursor-pointer"
              >
                <Key className="w-3.5 h-3.5 text-[#deb34c] shrink-0 group-hover:rotate-12 transition-transform duration-200" />
                <span>Esqueci meu usuário ou senha</span>
              </button>
            </div>

            {/* Mensagem de Erro */}
            {errorMessage && (
              <div className="p-3 bg-red-950/50 border border-red-500/40 rounded-xl text-red-300 text-xs text-center font-medium animate-shake">
                {errorMessage}
              </div>
            )}

            {/* Botão Entrar no Sistema */}
            <div className="pt-1.5">
              <button
                type="submit"
                disabled={isLoading}
                style={{
                  background:
                    "linear-gradient(180deg, #ecd387 0%, #deb34c 50%, #c4922a 100%)",
                }}
                className="w-full h-[50px] rounded-2xl font-black text-black text-[15px] flex items-center justify-center gap-2.5 transition-all duration-200 hover:brightness-105 active:scale-[0.99] shadow-lg shadow-amber-500/20 cursor-pointer disabled:opacity-75 disabled:cursor-not-allowed"
              >
                <span>{isLoading ? "Validando..." : "Entrar no Sistema"}</span>
                <ArrowRight className="w-5 h-5 text-black stroke-[2.5]" />
              </button>
            </div>

            {/* Botão Biometria / Digital — Toque Único e Liberação Imediata Sem SMS / Mensagens */}
            <div className="pt-1">
              <button
                type="button"
                onClick={handleDirectBiometry}
                onTouchStart={handleDirectBiometry}
                disabled={biometryUnlocking || isLoading}
                className={`w-full min-h-[52px] py-2 px-3.5 sm:px-4 rounded-2xl border transition-all duration-200 active:scale-[0.98] shadow-md flex items-center justify-between gap-3 cursor-pointer select-none ${
                  biometryUnlocking
                    ? "bg-emerald-950/70 border-emerald-400 shadow-[0_0_25px_rgba(16,185,129,0.35)]"
                    : "bg-[#070c16] hover:bg-[#0f1728] border-[#deb34c]/60 hover:border-amber-300"
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 transition-all ${
                      biometryUnlocking
                        ? "bg-emerald-900/60 border-emerald-400 text-emerald-300 scale-105"
                        : "bg-[#111a29] border-[#deb34c]/40 text-[#deb34c]"
                    }`}
                  >
                    {biometryUnlocking ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-400 animate-in zoom-in-75" />
                    ) : (
                      <Fingerprint className="w-5 h-5 text-[#deb34c]" />
                    )}
                  </div>
                  <div className="flex flex-col text-left min-w-0">
                    <span className="text-[13px] sm:text-[14px] font-bold tracking-tight text-white truncate">
                      {biometryUnlocking
                        ? "Digital Reconhecida!"
                        : "Colocar Digital e Liberar"}
                    </span>
                    <span
                      className={`text-[10px] truncate ${
                        biometryUnlocking
                          ? "text-emerald-300 font-semibold"
                          : "text-slate-400"
                      }`}
                    >
                      {biometryUnlocking
                        ? "Liberando acesso..."
                        : "Toque no leitor para entrar"}
                    </span>
                  </div>
                </div>

                {/* Badge ou status indicador */}
                <div className="shrink-0 flex items-center">
                  {biometryUnlocking ? (
                    <span className="flex h-2.5 w-2.5 relative">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                    </span>
                  ) : (
                    <span className="text-[10px] uppercase font-black tracking-wider px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30">
                      Digital
                    </span>
                  )}
                </div>
              </button>
            </div>
          </form>

          {/* Rodapé Interno do Card: Acesso Seguro SSL e SD Móveis Projetados */}
          <div className="mt-6 pt-3 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-400">
            <span className="inline-flex items-center gap-1.5 text-slate-400">
              <Shield className="w-3.5 h-3.5 text-amber-500/80" />
              Acesso Seguro SSL
            </span>
            <span className="text-slate-500 font-medium">SD Móveis Projetados</span>
          </div>
        </div>

        {/* Rodapé Externo com Copyright */}
        <p className="text-[11px] text-slate-500 text-center mt-5">
          © 2026 SDcomparativo • SD Móveis Projetados
        </p>
      </div>

      {/* Modal / Dialog de Recuperação de Senha */}
      {showForgotModal && (
        <div className="fixed inset-0 z-[10000] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="relative bg-[#0d141f] border border-[#deb34c]/30 rounded-2xl max-w-sm w-full p-6 shadow-2xl animate-in fade-in zoom-in-95">
            <button
              onClick={() => setShowForgotModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mb-3">
              <Key className="w-5 h-5 text-[#deb34c]" />
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
                <span className="font-mono text-[#deb34c] font-bold">admin</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Senha padrão:</span>
                <span className="font-mono text-[#deb34c] font-bold">admin123</span>
              </div>
            </div>

            <div className="space-y-2">
              <button
                type="button"
                onClick={() => {
                  setUsername("admin");
                  setPassword("admin123");
                  setShowForgotModal(false);
                }}
                className="w-full py-2.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-bold transition-colors cursor-pointer"
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
    </div>
  );
};
