import React, { useState } from "react";
import { Monitor, ExternalLink, Settings, Maximize2, Minimize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

const HELLOMOB_URL_KEY = "sd-hellomob-url";

const PromobEditor: React.FC = () => {
  const [savedUrl, setSavedUrl] = useState(() => localStorage.getItem(HELLOMOB_URL_KEY) || "");
  const [showConfig, setShowConfig] = useState(false);
  const [urlInput, setUrlInput] = useState(savedUrl);
  const [fullscreen, setFullscreen] = useState(false);

  const handleSaveUrl = () => {
    localStorage.setItem(HELLOMOB_URL_KEY, urlInput);
    setSavedUrl(urlInput);
    setShowConfig(false);
  };

  return (
    <div className={`flex flex-col ${fullscreen ? "fixed inset-0 z-50 bg-background" : "h-[calc(100vh-12rem)]"} gap-3`}>
      {/* Header */}
      <div className="flex items-center justify-between shrink-0 px-1">
        <div>
          <h1 className="text-3xl font-black text-white">Editor SD Móveis Projetados</h1>
          <p className="text-xs text-muted-foreground">
            Configurador de móveis planejados — powered by HelloMob
          </p>
        </div>
        <div className="flex items-center gap-2">
          {savedUrl && (
            <Button variant="ghost" size="icon" onClick={() => setFullscreen(!fullscreen)}>
              {fullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => { setUrlInput(savedUrl); setShowConfig(true); }}>
            <Settings className="w-4 h-4 mr-2" />
            Configurar URL
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 rounded-xl border border-border overflow-hidden bg-muted/30">
        {savedUrl ? (
          <iframe
            src={savedUrl}
            className="w-full h-full border-0"
            allow="clipboard-read; clipboard-write; fullscreen"
            title="HelloMob Configurador"
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-6 p-8 text-center">
            <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Monitor className="w-10 h-10 text-primary" />
            </div>
            <div className="max-w-md space-y-2">
              <h2 className="text-xl font-bold text-foreground">Conecte o HelloMob</h2>
              <p className="text-sm text-muted-foreground">
                O HelloMob é um configurador profissional de móveis que roda no navegador.
                Cadastre-se em{" "}
                <a
                  href="https://www.hellomob.com.br"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary font-medium hover:underline"
                >
                  hellomob.com.br
                </a>
                , copie a URL do seu configurador e cole aqui.
              </p>
            </div>
            <Button onClick={() => setShowConfig(true)}>
              <Settings className="w-4 h-4 mr-2" />
              Configurar URL do HelloMob
            </Button>
          </div>
        )}
      </div>

      {/* Config Dialog */}
      <Dialog open={showConfig} onOpenChange={setShowConfig}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>URL do HelloMob</DialogTitle>
            <DialogDescription>
              Cole a URL do seu configurador HelloMob. Exemplo: https://app.hellomob.com.br/seu-projeto
            </DialogDescription>
          </DialogHeader>
          <Input
            placeholder="https://app.hellomob.com.br/..."
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfig(false)}>Cancelar</Button>
            <Button onClick={handleSaveUrl} disabled={!urlInput.trim()}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PromobEditor;
