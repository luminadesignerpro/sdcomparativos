import React, { useState, useEffect, useCallback, useRef } from "react";
import { CheckCircle2, RefreshCw, Sparkles, DownloadCloud } from "lucide-react";
import { toast } from "sonner";

interface UpdateButtonProps {
  className?: string;
}

export const UpdateButton: React.FC<UpdateButtonProps> = ({ className = "" }) => {
  const [hasUpdate, setHasUpdate] = useState<boolean>(false);
  const [checking, setChecking] = useState<boolean>(false);
  const [updating, setUpdating] = useState<boolean>(false);
  const notifiedRef = useRef<boolean>(false);

  // Identificador da versão atual carregada em memória
  const currentBuildTime = typeof __BUILD_TIMESTAMP__ !== "undefined" ? __BUILD_TIMESTAMP__ : "";

  // Obtém o nome do script principal atualmente em execução no DOM
  const getCurrentScriptSrc = () => {
    const scripts = Array.from(document.querySelectorAll("script[src]"));
    const mainScript = scripts.find((s) => s.getAttribute("src")?.includes("index-"));
    return mainScript?.getAttribute("src") || "";
  };

  const checkForUpdate = useCallback(async (isManual: boolean = false) => {
    if (checking || updating) return;
    
    if (isManual) {
      setChecking(true);
    }

    try {
      let updateFound = false;

      // 1. Verificação via Service Worker
      if ("serviceWorker" in navigator) {
        try {
          const regs = await navigator.serviceWorker.getRegistrations();
          for (const reg of regs) {
            if (reg.waiting) {
              updateFound = true;
              break;
            }
            // Força o SW a checar o servidor
            reg.update().catch(() => {});
          }
        } catch (e) {}
      }

      // 2. Verificação via version.json
      if (!updateFound) {
        try {
          const res = await fetch(`/version.json?t=${Date.now()}`, {
            cache: "no-store",
            headers: { "Cache-Control": "no-cache", Pragma: "no-cache" },
          });
          if (res.ok) {
            const data = await res.json();
            if (data.version && currentBuildTime && data.version !== currentBuildTime) {
              updateFound = true;
            }
          }
        } catch (e) {}
      }

      // 3. Verificação via hash do bundle no index.html
      if (!updateFound) {
        try {
          const res = await fetch(`/?t=${Date.now()}`, {
            cache: "no-store",
            headers: { "Cache-Control": "no-cache", Pragma: "no-cache" },
          });
          if (res.ok) {
            const html = await res.text();
            const currentSrc = getCurrentScriptSrc();
            // Procura tag de script com index-*.js
            const match = html.match(/src=["']([^"']*index-[^"']+\.js)["']/);
            if (match && currentSrc && match[1] !== currentSrc) {
              updateFound = true;
            }
          }
        } catch (e) {}
      }

      if (updateFound) {
        setHasUpdate(true);
        if (!notifiedRef.current) {
          notifiedRef.current = true;
          toast.success("Nova atualização disponível!", {
            description: "Uma nova versão do SDcomparativo está pronta. Toque em 'Atualizar' para carregar as novidades.",
            duration: 10000,
            icon: "🚀",
          });
        }
      } else {
        if (isManual) {
          toast.success("Sistema Atualizado!", {
            description: "Você já está utilizando a versão mais recente.",
            duration: 3500,
          });
        }
      }
    } catch (err) {
      if (isManual) {
        toast.info("Sistema verificado", {
          description: "Nenhuma atualização pendente.",
          duration: 3000,
        });
      }
    } finally {
      if (isManual) {
        setTimeout(() => setChecking(false), 600);
      }
    }
  }, [checking, updating, currentBuildTime]);

  // Listener periódico e em eventos de foco/visibilidade
  useEffect(() => {
    // Checagem inicial após 3 segundos
    const initialTimer = setTimeout(() => {
      checkForUpdate(false);
    }, 3000);

    // Checagem a cada 60 segundos
    const interval = setInterval(() => {
      checkForUpdate(false);
    }, 60 * 1000);

    // Checagem quando o usuário volta para a aba
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        checkForUpdate(false);
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    // Listener para Service Worker updatefound
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.getRegistrations().then((regs) => {
        for (const reg of regs) {
          reg.addEventListener("updatefound", () => {
            const newWorker = reg.installing;
            if (!newWorker) return;
            newWorker.addEventListener("statechange", () => {
              if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
                setHasUpdate(true);
                if (!notifiedRef.current) {
                  notifiedRef.current = true;
                  toast.success("Nova atualização disponível!", {
                    description: "Toque no botão para atualizar agora.",
                    duration: 10000,
                  });
                }
              }
            });
          });
        }
      });
    }

    return () => {
      clearTimeout(initialTimer);
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [checkForUpdate]);

  // Ação ao clicar no botão
  const handleClick = async () => {
    if (updating) return;

    if (hasUpdate) {
      // Executa a atualização
      setUpdating(true);
      toast.loading("Atualizando sistema...", { id: "app-update" });

      try {
        // Limpa todos os caches do navegador
        if ("caches" in window) {
          const cacheKeys = await caches.keys();
          await Promise.all(cacheKeys.map((key) => caches.delete(key)));
        }

        // Notifica e remove service workers
        if ("serviceWorker" in navigator) {
          const regs = await navigator.serviceWorker.getRegistrations();
          for (const reg of regs) {
            if (reg.waiting) {
              reg.waiting.postMessage({ type: "SKIP_WAITING" });
            }
            await reg.unregister();
          }
        }
      } catch (e) {
        console.warn("Erro ao limpar caches:", e);
      }

      setTimeout(() => {
        // Recarrega forçando novo timestamp para burlar qualquer cache
        window.location.href = `${window.location.origin}${window.location.pathname}?v=${Date.now()}`;
      }, 600);
    } else {
      // Se já está atualizado, faz uma nova verificação sob demanda
      checkForUpdate(true);
    }
  };

  if (hasUpdate) {
    return (
      <button
        onClick={handleClick}
        disabled={updating}
        title="Nova atualização disponível! Toque para atualizar"
        className={`relative group flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-black text-xs shadow-md shadow-amber-500/30 border border-amber-300 active:scale-95 transition-all cursor-pointer shrink-0 animate-pulse ${className}`}
      >
        {/* Badge de notificação 1 */}
        <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-red-500 text-[9px] font-black text-white items-center justify-center shadow">
            1
          </span>
        </span>

        {updating ? (
          <>
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            <span className="font-extrabold">Atualizando...</span>
          </>
        ) : (
          <>
            <DownloadCloud className="w-3.5 h-3.5 text-slate-950 stroke-[2.5]" />
            <span className="font-extrabold tracking-tight">Atualizar</span>
          </>
        )}
      </button>
    );
  }

  return (
    <button
      onClick={handleClick}
      disabled={checking}
      title="Sistema atualizado. Clique para verificar novamente."
      className={`group flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-emerald-950/40 hover:bg-emerald-900/50 border border-emerald-500/30 hover:border-emerald-500/50 text-emerald-400 hover:text-emerald-300 text-xs font-semibold transition-all active:scale-95 cursor-pointer shrink-0 ${className}`}
    >
      {checking ? (
        <>
          <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-400" />
          <span className="text-[11px] sm:text-xs">Verificando...</span>
        </>
      ) : (
        <>
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span className="text-[11px] sm:text-xs font-bold tracking-tight">Atualizado</span>
        </>
      )}
    </button>
  );
};

export default UpdateButton;
