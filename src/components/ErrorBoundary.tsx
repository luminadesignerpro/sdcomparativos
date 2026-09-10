import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#0d1117] text-white flex flex-col items-center justify-center p-6 text-center">
          <div className="bg-[#161b22] border border-amber-500/40 rounded-2xl p-6 max-w-md shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-400">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-black text-amber-400">Ops! Algo inesperado aconteceu</h2>
            <p className="text-xs text-gray-300">
              Ocorreu uma instabilidade visual momentânea. Clique abaixo para reiniciar a tela sem perder seus dados salvos.
            </p>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
              className="bg-amber-500 hover:bg-amber-400 text-black font-black px-6 py-2.5 rounded-xl text-xs flex items-center justify-center gap-2 mx-auto transition-all shadow-lg active:scale-95"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Recarregar Sistema</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
